/**
 * LLM Integrations API - Single Source of Truth for AI Providers
 * 
 * Security Model:
 * - GET requests: Public for UI selection dropdowns
 * - POST/PUT/DELETE: Admin only (require authentication)
 * 
 * API Keys are encrypted with AES-256-GCM
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, AuthenticatedUser } from "@/lib/auth-middleware";
import { encryptApiKey, decryptApiKey, isEncrypted } from "@/lib/encryption";

// Provider types with their default configurations
const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; models: string[] }> = {
  zai: { baseUrl: "https://api.z.ai", models: ["glm-4-flash", "glm-4-plus", "glm-4"] },
  openai: { baseUrl: "https://api.openai.com/v1", models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"] },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1", models: ["gemini-pro", "gemini-pro-vision"] },
  claude: { baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  ollama: { baseUrl: "http://localhost:11434", models: ["llama2", "mistral", "codellama"] },
  other: { baseUrl: "", models: [] },
};

// Default LLM Integration
const DEFAULT_LLM = {
  provider: 'zai',
  displayName: 'Z.AI GLM-4.7-Flash',
  baseUrl: 'https://api.z.ai',
  model: 'glm-4-flash',
  isActive: true,
  isDefault: true,
  priority: 10,
  settings: JSON.stringify({
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
  }),
  notes: 'Default LLM provider for clinical AI assistance.',
  connectionStatus: 'untested',
};

// Helper function to mask API key (show only last 4 characters)
function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  const decryptedKey = isEncrypted(apiKey) ? decryptApiKey(apiKey) : apiKey;
  if (!decryptedKey || decryptedKey.length <= 4) return "••••";
  return "••••" + decryptedKey.slice(-4);
}

// Helper function to prepare integration response
function prepareIntegrationResponse(integration: any) {
  return {
    ...integration,
    apiKey: maskApiKey(integration.apiKey),
    password: integration.password ? "••••••••" : null,
    hasApiKey: !!integration.apiKey,
    providerDefaults: PROVIDER_DEFAULTS[integration.provider],
  };
}

/**
 * GET - List all LLM integrations (Public for UI selection)
 * Query params:
 * - forSelection=true: Return simplified data for dropdown
 * - activeOnly=true: Return only active integrations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forSelection = searchParams.get("forSelection") === "true";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where = activeOnly ? { isActive: true } : {};

    let integrations = await db.lLMIntegration.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    // Initialize default if none exist
    if (integrations.length === 0) {
      await db.lLMIntegration.create({ data: DEFAULT_LLM });
      integrations = await db.lLMIntegration.findMany({
        orderBy: [{ isDefault: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
      });
    }

    const defaultIntegration = integrations.find((i) => i.isDefault);
    const defaultId = defaultIntegration?.id || null;

    if (forSelection) {
      const selectionData = integrations.map((i) => ({
        id: i.id,
        provider: i.provider,
        displayName: i.displayName,
        model: i.model,
        isDefault: i.isDefault,
        isCurrentDefault: i.id === defaultId,
        isActive: i.isActive,
        connectionStatus: i.connectionStatus,
      }));

      return NextResponse.json({
        success: true,
        data: selectionData,
        defaultId,
      });
    }

    return NextResponse.json({
      success: true,
      data: integrations.map(prepareIntegrationResponse),
      defaultId,
      providerDefaults: PROVIDER_DEFAULTS,
    });
  } catch (error) {
    console.error("Error fetching LLM integrations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch LLM integrations" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new LLM integration (Admin only)
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { provider, displayName, baseUrl, apiKey, model, isActive, isDefault, priority, settings, notes } = body;

    if (!provider || !displayName || !model) {
      return NextResponse.json(
        { success: false, error: "Provider, display name, and model are required" },
        { status: 400 }
      );
    }

    const validProviders = ["zai", "openai", "gemini", "claude", "ollama", "other"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    if (isDefault) {
      await db.lLMIntegration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : null;

    const integration = await db.lLMIntegration.create({
      data: {
        provider,
        displayName,
        baseUrl: baseUrl || PROVIDER_DEFAULTS[provider]?.baseUrl || null,
        apiKey: encryptedApiKey,
        model,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
        priority: priority ?? 0,
        settings: settings ? JSON.stringify(settings) : null,
        notes: notes || null,
        connectionStatus: "untested",
      },
    });

    return NextResponse.json({
      success: true,
      data: prepareIntegrationResponse(integration),
      message: "LLM integration created successfully",
    });
  } catch (error) {
    console.error("Error creating LLM integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create LLM integration" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:read'] });

/**
 * PUT - Update LLM integration (Admin only)
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Integration ID is required" },
        { status: 400 }
      );
    }

    const existingIntegration = await db.lLMIntegration.findUnique({ where: { id } });

    if (!existingIntegration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    if (updateData.isDefault) {
      await db.lLMIntegration.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (updateData.displayName !== undefined) data.displayName = updateData.displayName;
    if (updateData.baseUrl !== undefined) data.baseUrl = updateData.baseUrl;
    if (updateData.model !== undefined) data.model = updateData.model;
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.isDefault !== undefined) data.isDefault = updateData.isDefault;
    if (updateData.priority !== undefined) data.priority = updateData.priority;
    if (updateData.settings !== undefined) data.settings = updateData.settings ? JSON.stringify(updateData.settings) : null;
    if (updateData.notes !== undefined) data.notes = updateData.notes;

    if (updateData.apiKey !== undefined && !String(updateData.apiKey).startsWith('••••')) {
      data.apiKey = updateData.apiKey ? encryptApiKey(updateData.apiKey) : null;
    }

    const integration = await db.lLMIntegration.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: prepareIntegrationResponse(integration),
      message: "LLM integration updated successfully",
    });
  } catch (error) {
    console.error("Error updating LLM integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update LLM integration" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

/**
 * DELETE - Delete LLM integration (Admin only)
 */
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Integration ID is required" },
        { status: 400 }
      );
    }

    const integration = await db.lLMIntegration.findUnique({ where: { id } });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    await db.lLMIntegration.delete({ where: { id } });

    if (integration.isDefault) {
      const nextDefault = await db.lLMIntegration.findFirst({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });

      if (nextDefault) {
        await db.lLMIntegration.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "LLM integration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting LLM integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete LLM integration" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });
