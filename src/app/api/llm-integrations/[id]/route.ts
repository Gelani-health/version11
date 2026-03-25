import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, AuthenticatedUser } from "@/lib/auth-middleware";

// Helper function to mask API key (show only last 4 characters)
function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return "••••";
  return "••••" + apiKey.slice(-4);
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
  };
}

/**
 * GET - Get a single LLM integration by ID
 * Permission: employee:write (admin only)
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: Promise<{ id: string }> }
) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context?.params ?? { id: '' };

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Integration ID is required" },
        { status: 400 }
      );
    }

    const integration = await db.lLMIntegration.findUnique({
      where: { id },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: prepareIntegrationResponse(integration),
    });
  } catch (error) {
    console.error("Error fetching LLM integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch LLM integration" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

/**
 * PUT - Update a single LLM integration by ID
 * Permission: employee:write (admin only)
 */
export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: Promise<{ id: string }> }
) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context?.params ?? { id: '' };
    const body = await request.json();

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

    const updateData = body;

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
    if (updateData.provider !== undefined) data.provider = updateData.provider;
    if (updateData.baseUrl !== undefined) data.baseUrl = updateData.baseUrl;
    if (updateData.username !== undefined) data.username = updateData.username;
    if (updateData.password !== undefined) data.password = updateData.password;
    if (updateData.apiKey !== undefined) data.apiKey = updateData.apiKey;
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
 * DELETE - Delete a single LLM integration by ID
 * Permission: employee:write (admin only)
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: Promise<{ id: string }> }
) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context?.params ?? { id: '' };

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

/**
 * PATCH - Partial update of a single LLM integration by ID
 * Permission: employee:write (admin only)
 */
export const PATCH = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: Promise<{ id: string }> }
) => {
  // Admin only check
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context?.params ?? { id: '' };
    const body = await request.json();

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

    const updateData = body;

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await db.lLMIntegration.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Prepare update data (only include fields that are present in the request)
    const data: Record<string, unknown> = {};

    if (updateData.displayName !== undefined) data.displayName = updateData.displayName;
    if (updateData.provider !== undefined) data.provider = updateData.provider;
    if (updateData.baseUrl !== undefined) data.baseUrl = updateData.baseUrl;
    if (updateData.username !== undefined) data.username = updateData.username;
    if (updateData.password !== undefined) data.password = updateData.password;
    if (updateData.apiKey !== undefined) data.apiKey = updateData.apiKey;
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
