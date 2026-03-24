import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, AuthenticatedUser } from "@/lib/auth-middleware";

/**
 * POST - Test LLM integration connection
 * Permission: ai:use
 * Accepts: { id: string }
 * Returns: { success: boolean, message: string, connectionStatus: string }
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Integration ID is required" },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await db.lLMIntegration.findUnique({
      where: { id },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // Check if integration is active
    if (!integration.isActive) {
      return NextResponse.json(
        { success: false, message: "Cannot test inactive integration", connectionStatus: "failed" },
        { status: 400 }
      );
    }

    let connectionStatus: string;
    let lastError: string | null = null;
    let testMessage: string;

    try {
      // Test connection based on provider type
      if (integration.provider === "zai") {
        // Test ZAI connection using direct HTTP call to Z.ai Platform
        const baseUrl = integration.baseUrl || "https://api.z.ai/api/paas/v4";
        const apiKey = integration.apiKey;
        const model = integration.model || "GLM-4.7-Flash";
        
        if (!apiKey) {
          throw new Error("API key is required for Z.ai");
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "user", content: "Say 'OK' in one word" }
            ],
            max_tokens: 5
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            connectionStatus = "connected";
            testMessage = `Connection to Z.ai API successful (Model: ${model})`;
          } else {
            throw new Error("No response received from API");
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (integration.provider === "openai") {
        // Test OpenAI connection
        if (!integration.apiKey) {
          throw new Error("API key is required for OpenAI");
        }

        const baseUrl = integration.baseUrl || "https://api.openai.com/v1";
        const response = await fetch(`${baseUrl}/models`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${integration.apiKey}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          connectionStatus = "connected";
          testMessage = "Connection to OpenAI API successful";
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (integration.provider === "gemini") {
        // Test Google Gemini connection
        if (!integration.apiKey) {
          throw new Error("API key is required for Gemini");
        }

        const baseUrl = integration.baseUrl || "https://generativelanguage.googleapis.com/v1";
        const response = await fetch(`${baseUrl}/models?key=${integration.apiKey}`, {
          method: "GET"
        });

        if (response.ok) {
          connectionStatus = "connected";
          testMessage = "Connection to Google Gemini API successful";
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (integration.provider === "claude") {
        // Test Anthropic Claude connection
        if (!integration.apiKey) {
          throw new Error("API key is required for Claude");
        }

        const baseUrl = integration.baseUrl || "https://api.anthropic.com/v1";
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": integration.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: integration.model || "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "Say 'Connection successful'" }]
          })
        });

        if (response.ok) {
          connectionStatus = "connected";
          testMessage = "Connection to Anthropic Claude API successful";
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (integration.provider === "ollama") {
        // Test Ollama connection (local)
        const baseUrl = integration.baseUrl || "http://localhost:11434";
        
        try {
          const response = await fetch(`${baseUrl}/api/tags`, {
            method: "GET",
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (response.ok) {
            connectionStatus = "connected";
            testMessage = "Connection to Ollama API successful";
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (fetchError: unknown) {
          if (fetchError instanceof Error) {
            if (fetchError.message.includes('fetch failed') || fetchError.message.includes('ECONNREFUSED')) {
              throw new Error(`Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is installed and running. Run 'ollama serve' in terminal.`);
            }
            throw fetchError;
          }
          throw new Error('Unknown connection error');
        }
      } else {
        // For 'other' providers, try a basic connection test
        if (!integration.baseUrl) {
          throw new Error("Base URL is required for custom providers");
        }

        const response = await fetch(integration.baseUrl, {
          method: "GET",
          headers: integration.apiKey ? {
            "Authorization": `Bearer ${integration.apiKey}`
          } : undefined
        });

        if (response.ok || response.status === 404 || response.status === 405) {
          // 404/405 means server is responding but endpoint may not exist
          connectionStatus = "connected";
          testMessage = "Connection to custom endpoint successful (server responding)";
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
    } catch (error: unknown) {
      connectionStatus = "failed";
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      lastError = errorMessage;
      testMessage = `Connection failed: ${errorMessage}`;
    }

    // Update integration with test results
    await db.lLMIntegration.update({
      where: { id },
      data: {
        connectionStatus,
        lastError,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: connectionStatus === "connected",
      message: testMessage,
      connectionStatus,
      lastError
    });
  } catch (error) {
    console.error("Error testing LLM integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test LLM integration" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['ai:use'] });
