import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, AuthenticatedUser } from "@/lib/auth-middleware";
import { encryptApiKey, decryptApiKey, isEncrypted } from "@/lib/encryption";

// LLM Integrations API - Single Source of Truth for AI Providers
// Supports full CRUD operations with the updated schema
// API Keys are encrypted with AES-256-GCM

// Provider types with their default configurations
const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; models: string[] }> = {
  zai: { baseUrl: "https://api.z.ai", models: ["z-1", "z-2"] },
  openai: { baseUrl: "https://api.openai.com/v1", models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"] },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1", models: ["gemini-pro", "gemini-pro-vision"] },
  claude: { baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  ollama: { baseUrl: "http://localhost:11434", models: ["llama2", "mistral", "codellama"] },
  other: { baseUrl: "", models: [] },
};

// Helper function to mask API key (show only last 4 characters)
function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  // Decrypt first if encrypted
  const decryptedKey = isEncrypted(apiKey) ? decryptApiKey(apiKey) : apiKey;
  if (!decryptedKey || decryptedKey.length <= 4) return "••••";
  return "••••" + decryptedKey.slice(-4);
}

// Helper function to prepare integration response with masked sensitive data
function prepareIntegrationResponse(integration: {
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
  settings: string | null;
  notes: string | null;
  totalRequests: number;
  lastUsed: Date | null;
  lastError: string | null;
  connectionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...integration,
    apiKey: maskApiKey(integration.apiKey),
    password: integration.password ? "••••••••" : null, // Always mask password
    hasApiKey: !!integration.apiKey, // Indicate if API key is set
    providerDefaults: PROVIDER_DEFAULTS[integration.provider],
  };
}

/**
 * GET - List all LLM integrations
 * Permission: employee:read (admin only)
 * Query params:
 * - forSelection=true: Return simplified data for dropdown
 * - activeOnly=true: Return only active integrations
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const forSelection = searchParams.get("forSelection") === "true";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where = activeOnly ? { isActive: true } : {};

    const integrations = await db.lLMIntegration.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    // Find current default
    const defaultIntegration = integrations.find((i) => i.isDefault);
    const defaultId = defaultIntegration?.id || null;

    if (forSelection) {
      // Return simplified data for selector dropdown
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

    // Return full data for management with masked sensitive fields
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
}, { requiredPermissions: ['employee:read'] });

/**
 * POST - Create new LLM integration
 * Permission: employee:read (admin only)
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      provider,
      displayName,
      baseUrl,
      username,
      password,
      apiKey,
      model,
      isActive,
      isDefault,
      priority,
      settings,
      notes,
    } = body;

    // Validate required fields
    if (!provider || !displayName || !model) {
      return NextResponse.json(
        { success: false, error: "Provider, display name, and model are required" },
        { status: 400 }
      );
    }

    // Validate provider is one of the allowed values
    const validProviders = ["zai", "openai", "gemini", "claude", "ollama", "other"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await db.lLMIntegration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt API key before storing
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : null;

    const integration = await db.lLMIntegration.create({
      data: {
        provider,
        displayName,
        baseUrl: baseUrl || PROVIDER_DEFAULTS[provider]?.baseUrl || null,
        username: username || null,
        password: password || null,
        apiKey: encryptedApiKey,
        model,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
        priority: priority ?? 0,
        settings: settings ? JSON.stringify(settings) : null,
        notes: notes || null,
        totalRequests: 0,
        connectionStatus: "untested", // Always start as untested
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
 * PUT - Update LLM integration
 * Permission: employee:write (admin only)
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  // Admin only check
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

    // Check if integration exists
    const existingIntegration = await db.lLMIntegration.findUnique({
      where: { id },
    });

    if (!existingIntegration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await db.lLMIntegration.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Prepare update data
    const data: Record<string, unknown> = {};
    
    if (updateData.displayName !== undefined) data.displayName = updateData.displayName;
    if (updateData.baseUrl !== undefined) data.baseUrl = updateData.baseUrl;
    if (updateData.username !== undefined) data.username = updateData.username;
    if (updateData.password !== undefined) data.password = updateData.password;
    
    // Encrypt API key if provided and different from existing
    if (updateData.apiKey !== undefined) {
      // If apiKey is masked (starts with ••••), keep existing
      if (typeof updateData.apiKey === 'string' && updateData.apiKey.startsWith('••••')) {
        // Keep existing encrypted key
      } else if (updateData.apiKey) {
        // Encrypt new API key
        data.apiKey = encryptApiKey(updateData.apiKey);
      } else {
        data.apiKey = null;
      }
    }
    
    if (updateData.model !== undefined) data.model = updateData.model;
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.isDefault !== undefined) data.isDefault = updateData.isDefault;
    if (updateData.priority !== undefined) data.priority = updateData.priority;
    if (updateData.settings !== undefined) data.settings = updateData.settings ? JSON.stringify(updateData.settings) : null;
    if (updateData.notes !== undefined) data.notes = updateData.notes;
    if (updateData.connectionStatus !== undefined) data.connectionStatus = updateData.connectionStatus;
    if (updateData.lastError !== undefined) data.lastError = updateData.lastError;
    if (updateData.lastUsed !== undefined) data.lastUsed = updateData.lastUsed;
    if (updateData.totalRequests !== undefined) data.totalRequests = updateData.totalRequests;

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
 * DELETE - Delete LLM integration
 * Permission: employee:write (admin only)
 */
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  // Admin only check
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

    // Check if this integration exists
    const integration = await db.lLMIntegration.findUnique({
      where: { id },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // Delete the integration
    await db.lLMIntegration.delete({
      where: { id },
    });

    // If deleted integration was default, set another active one as default
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
