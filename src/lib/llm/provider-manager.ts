// LLM Provider Manager - Routes requests through configured providers (SSOT)
import { db } from "@/lib/db";
import { decryptApiKey, isEncrypted } from "@/lib/encryption";
import ZAI from "z-ai-web-dev-sdk";

// Provider configuration interface
export interface LLMProviderConfig {
  id: string;
  provider: string;
  displayName: string;
  baseUrl: string | null;
  username: string | null;
  password: string | null;
  apiKey: string | null;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  settings?: Record<string, unknown>;
  notes?: string | null;
  connectionStatus: string;
  lastError?: string | null;
  totalRequests: number;
  lastUsed?: Date | null;
}

// Decrypt API key helper
function getDecryptedApiKey(encryptedKey: string | null): string | null {
  if (!encryptedKey) return null;
  
  // Check if encrypted, if so decrypt
  if (isEncrypted(encryptedKey)) {
    try {
      return decryptApiKey(encryptedKey);
    } catch (error) {
      console.error("[ProviderManager] Failed to decrypt API key:", error);
      return null;
    }
  }
  
  // Legacy unencrypted key
  return encryptedKey;
}

// Get all active LLM integrations
export async function getActiveIntegrations(): Promise<LLMProviderConfig[]> {
  const integrations = await db.lLMIntegration.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { priority: "desc" }],
  });

  return integrations.map((i) => ({
    id: i.id,
    provider: i.provider,
    displayName: i.displayName,
    baseUrl: i.baseUrl,
    username: i.username,
    password: i.password,
    apiKey: getDecryptedApiKey(i.apiKey), // Decrypt for use
    model: i.model,
    isActive: i.isActive,
    isDefault: i.isDefault,
    priority: i.priority,
    settings: i.settings ? JSON.parse(i.settings) : undefined,
    notes: i.notes,
    connectionStatus: i.connectionStatus,
    lastError: i.lastError,
    totalRequests: i.totalRequests,
    lastUsed: i.lastUsed,
  }));
}

// Get the default LLM integration
export async function getDefaultLLM(): Promise<LLMProviderConfig | null> {
  const defaultIntegration = await db.lLMIntegration.findFirst({
    where: { isActive: true, isDefault: true },
  });

  if (defaultIntegration) {
    return {
      id: defaultIntegration.id,
      provider: defaultIntegration.provider,
      displayName: defaultIntegration.displayName,
      baseUrl: defaultIntegration.baseUrl,
      username: defaultIntegration.username,
      password: defaultIntegration.password,
      apiKey: getDecryptedApiKey(defaultIntegration.apiKey), // Decrypt for use
      model: defaultIntegration.model,
      isActive: defaultIntegration.isActive,
      isDefault: defaultIntegration.isDefault,
      priority: defaultIntegration.priority,
      settings: defaultIntegration.settings ? JSON.parse(defaultIntegration.settings) : undefined,
      notes: defaultIntegration.notes,
      connectionStatus: defaultIntegration.connectionStatus,
      lastError: defaultIntegration.lastError,
      totalRequests: defaultIntegration.totalRequests,
      lastUsed: defaultIntegration.lastUsed,
    };
  }

  // Fallback to first active integration
  const firstActive = await db.lLMIntegration.findFirst({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  if (!firstActive) return null;

  return {
    id: firstActive.id,
    provider: firstActive.provider,
    displayName: firstActive.displayName,
    baseUrl: firstActive.baseUrl,
    username: firstActive.username,
    password: firstActive.password,
    apiKey: getDecryptedApiKey(firstActive.apiKey), // Decrypt for use
    model: firstActive.model,
    isActive: firstActive.isActive,
    isDefault: firstActive.isDefault,
    priority: firstActive.priority,
    settings: firstActive.settings ? JSON.parse(firstActive.settings) : undefined,
    notes: firstActive.notes,
    connectionStatus: firstActive.connectionStatus,
    lastError: firstActive.lastError,
    totalRequests: firstActive.totalRequests,
    lastUsed: firstActive.lastUsed,
  };
}

// Get a specific LLM integration by ID
export async function getLLMById(id: string): Promise<LLMProviderConfig | null> {
  const integration = await db.lLMIntegration.findUnique({
    where: { id },
  });

  if (!integration) return null;

  return {
    id: integration.id,
    provider: integration.provider,
    displayName: integration.displayName,
    baseUrl: integration.baseUrl,
    username: integration.username,
    password: integration.password,
    apiKey: getDecryptedApiKey(integration.apiKey), // Decrypt for use
    model: integration.model,
    isActive: integration.isActive,
    isDefault: integration.isDefault,
    priority: integration.priority,
    settings: integration.settings ? JSON.parse(integration.settings) : undefined,
    notes: integration.notes,
    connectionStatus: integration.connectionStatus,
    lastError: integration.lastError,
    totalRequests: integration.totalRequests,
    lastUsed: integration.lastUsed,
  };
}

// Update provider error status
async function updateProviderError(id: string, error: string): Promise<void> {
  try {
    await db.lLMIntegration.update({
      where: { id },
      data: {
        lastError: error,
        connectionStatus: "failed",
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("Failed to update provider error:", e);
  }
}

// Update provider success status
async function updateProviderSuccess(id: string): Promise<void> {
  try {
    await db.lLMIntegration.update({
      where: { id },
      data: {
        lastError: null,
        connectionStatus: "connected",
        totalRequests: { increment: 1 },
        lastUsed: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("Failed to update provider success:", e);
  }
}

// Route an LLM request through the appropriate provider with fallback
export async function routeLLMRequest(
  options: {
    messages: Array<{ role: string; content: string }>;
    providerId?: string;
    temperature?: number;
    maxTokens?: number;
    thinking?: { type: "enabled" | "disabled" };
  }
): Promise<{
  success: boolean;
  content?: string;
  provider?: string;
  model?: string;
  providerId?: string;
  error?: string;
}> {
  try {
    // Get provider config
    let provider: LLMProviderConfig | null = null;

    if (options.providerId) {
      provider = await getLLMById(options.providerId);
    }

    if (!provider) {
      provider = await getDefaultLLM();
    }

    if (!provider) {
      // No configured provider - use Z.ai SDK directly (fallback)
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: options.messages as Array<{ role: "assistant" | "user" | "system"; content: string }>,
        thinking: options.thinking || { type: "disabled" },
      });

      const content = completion.choices[0]?.message?.content || "";

      return {
        success: true,
        content,
        provider: "zai",
        model: "default",
      };
    }

    // Route based on provider type
    try {
      if (provider.provider === "zai") {
        // Use direct HTTP call to Z.ai Platform (GLM-4.7-Flash)
        const baseUrl = provider.baseUrl || "https://api.z.ai/api/paas/v4";
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model || "GLM-4.7-Flash",
            messages: options.messages,
            max_tokens: options.maxTokens ?? 2048,
            thinking: options.thinking || { type: "disabled" },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Z.ai API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      if (provider.provider === "openai") {
        // OpenAI API call
        const baseUrl = provider.baseUrl || "https://api.openai.com/v1";
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: options.messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2048,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      if (provider.provider === "gemini") {
        // Google Gemini API call
        const baseUrl = provider.baseUrl || "https://generativelanguage.googleapis.com/v1";
        const response = await fetch(`${baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: options.messages[options.messages.length - 1]?.content || "" }]
            }],
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens ?? 2048,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      if (provider.provider === "claude") {
        // Anthropic Claude API call
        const baseUrl = provider.baseUrl || "https://api.anthropic.com/v1";
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": provider.apiKey || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: options.maxTokens ?? 2048,
            messages: options.messages.map(m => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.content?.[0]?.text || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      if (provider.provider === "ollama") {
        // Ollama API call (local)
        const baseUrl = provider.baseUrl || "http://localhost:11434";
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            messages: options.messages,
            stream: false,
            options: {
              temperature: options.temperature ?? 0.7,
              num_predict: options.maxTokens ?? 2048,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.message?.content || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      // For 'other' providers, try a generic API call
      if (provider.provider === "other" && provider.baseUrl) {
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(provider.apiKey ? { "Authorization": `Bearer ${provider.apiKey}` } : {}),
            ...(provider.username && provider.password ? {
              "Authorization": `Basic ${Buffer.from(`${provider.username}:${provider.password}`).toString("base64")}`
            } : {}),
          },
          body: JSON.stringify({
            model: provider.model,
            messages: options.messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2048,
          }),
        });

        if (!response.ok) {
          throw new Error(`Custom API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        await updateProviderSuccess(provider.id);

        return {
          success: true,
          content,
          provider: provider.provider,
          model: provider.model,
          providerId: provider.id,
        };
      }

      // Default fallback to Z.ai SDK
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: options.messages as Array<{ role: "assistant" | "user" | "system"; content: string }>,
        thinking: options.thinking || { type: "disabled" },
      });

      const content = completion.choices[0]?.message?.content || "";
      await updateProviderSuccess(provider.id);

      return {
        success: true,
        content,
        provider: provider.provider,
        model: provider.model,
        providerId: provider.id,
      };
    } catch (providerError) {
      const errorMessage = providerError instanceof Error ? providerError.message : "Unknown error";
      await updateProviderError(provider.id, errorMessage);

      // Try fallback to next available provider
      const activeProviders = await getActiveIntegrations();
      const fallbackProvider = activeProviders.find(p => p.id !== provider?.id);

      if (fallbackProvider) {
        console.log(`Falling back to provider: ${fallbackProvider.displayName}`);
        // Recursively try with fallback provider
        return routeLLMRequest({
          ...options,
          providerId: fallbackProvider.id,
        });
      }

      throw providerError;
    }
  } catch (error) {
    console.error("LLM routing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Check if any LLM provider is configured
export async function hasConfiguredProvider(): Promise<boolean> {
  const count = await db.lLMIntegration.count({
    where: { isActive: true },
  });
  return count > 0;
}

// Get provider statistics
export async function getProviderStats(): Promise<{
  totalProviders: number;
  activeProviders: number;
  defaultProvider: string | null;
  connectedProviders: number;
}> {
  const totalProviders = await db.lLMIntegration.count();
  const activeProviders = await db.lLMIntegration.count({ where: { isActive: true } });
  const defaultProvider = await db.lLMIntegration.findFirst({ where: { isDefault: true } });
  const connectedProviders = await db.lLMIntegration.count({ where: { connectionStatus: "connected" } });

  return {
    totalProviders,
    activeProviders,
    defaultProvider: defaultProvider?.displayName || null,
    connectedProviders,
  };
}
