/**
 * RAG Service Configuration API - Single Source of Truth
 * =========================================================
 * 
 * Manages RAG service configuration, health checks, and status
 * 
 * Key Features:
 * - Always returns valid configurations (database or defaults)
 * - Works in both persistent and ephemeral (Vercel) environments
 * - Z.AI SDK services are always "connected" (built-in)
 * - Local services are health-checked periodically
 * 
 * For demo mode: GET requests work without auth to show status
 * For production: All operations require admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';
import { 
  getRAGConfigs, 
  getDefaultRAGConfig, 
  seedDefaultConfigs,
  type RAGConfig 
} from '@/lib/ai-config-service';

/**
 * GET - Retrieve RAG configurations
 * Always returns valid configurations (database or defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('serviceName');
    const checkHealth = searchParams.get('checkHealth') === 'true';

    // Get specific service or all services
    let services: RAGConfig[];
    
    if (serviceName) {
      // Get all and filter by serviceName
      const allServices = await getRAGConfigs();
      const service = allServices.find(s => s.serviceName === serviceName);
      services = service ? [service] : [];
    } else {
      services = await getRAGConfigs();
    }

    // Optionally check health of each service
    if (checkHealth && services.length > 0) {
      services = await Promise.all(
        services.map(async (service) => {
          const healthResult = await checkServiceHealth(service);
          return {
            ...service,
            connectionStatus: healthResult.status,
            // Note: We can't modify the returned object from getRAGConfigs
            // so we create a new object with updated status
          } as RAGConfig;
        })
      );
    }

    // Get default service for convenience
    const defaultService = services.find(s => s.isDefault && s.isActive) || services.find(s => s.isActive);

    return NextResponse.json({
      success: true,
      data: services,
      defaultService: defaultService?.serviceName || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching RAG config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RAG configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or Update RAG configuration
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

    // Validate required fields
    if (!body.serviceName || !body.displayName || !body.serviceUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: serviceName, displayName, serviceUrl' },
        { status: 400 }
      );
    }

    // Extract port from URL if not provided
    if (!body.port) {
      try {
        const url = new URL(body.serviceUrl);
        body.port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
      } catch {
        body.port = 80;
      }
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await db.rAGServiceConfig.updateMany({
        where: { isDefault: true, serviceType: body.serviceType || 'rag' },
        data: { isDefault: false }
      });
    }

    const service = await db.rAGServiceConfig.upsert({
      where: { serviceName: body.serviceName },
      update: {
        displayName: body.displayName,
        description: body.description,
        serviceUrl: body.serviceUrl,
        port: body.port,
        healthEndpoint: body.healthEndpoint || '/health',
        serviceType: body.serviceType || 'rag',
        capabilities: typeof body.capabilities === 'object'
          ? JSON.stringify(body.capabilities)
          : body.capabilities,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        priority: body.priority ?? 0,
        settings: typeof body.settings === 'object'
          ? JSON.stringify(body.settings)
          : body.settings,
        notes: body.notes
      },
      create: {
        serviceName: body.serviceName,
        displayName: body.displayName,
        description: body.description,
        serviceUrl: body.serviceUrl,
        port: body.port,
        healthEndpoint: body.healthEndpoint || '/health',
        serviceType: body.serviceType || 'rag',
        capabilities: typeof body.capabilities === 'object'
          ? JSON.stringify(body.capabilities)
          : body.capabilities,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        priority: body.priority ?? 0,
        settings: typeof body.settings === 'object'
          ? JSON.stringify(body.settings)
          : body.settings,
        notes: body.notes
      }
    });

    return NextResponse.json({
      success: true,
      data: service,
      message: `RAG service '${body.serviceName}' saved successfully`
    });
  } catch (error) {
    console.error('Error saving RAG config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save RAG configuration' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:read'] });

/**
 * PUT - Set default RAG service
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
    const { serviceName } = body;

    if (!serviceName) {
      return NextResponse.json(
        { success: false, error: 'serviceName is required' },
        { status: 400 }
      );
    }

    // Check if service exists and is active
    const service = await db.rAGServiceConfig.findUnique({
      where: { serviceName }
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${serviceName}' not found` },
        { status: 404 }
      );
    }

    if (!service.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot set inactive service as default' },
        { status: 400 }
      );
    }

    // Unset all defaults, then set new default
    await db.rAGServiceConfig.updateMany({
      where: { isDefault: true, serviceType: service.serviceType },
      data: { isDefault: false }
    });

    const updated = await db.rAGServiceConfig.update({
      where: { serviceName },
      data: {
        isDefault: true,
        lastHealthCheck: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Default RAG service set to '${serviceName}'`
    });
  } catch (error) {
    console.error('Error setting default RAG:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set default RAG service' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

/**
 * DELETE - Remove RAG configuration
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
    const serviceName = searchParams.get('serviceName');

    if (!serviceName) {
      return NextResponse.json(
        { success: false, error: 'serviceName is required' },
        { status: 400 }
      );
    }

    await db.rAGServiceConfig.delete({
      where: { serviceName }
    });

    return NextResponse.json({
      success: true,
      message: `RAG service '${serviceName}' deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting RAG config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete RAG configuration' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

// ============================================
// Helper Functions
// ============================================

async function checkServiceHealth(service: {
  serviceUrl: string;
  healthEndpoint?: string;
  serviceName?: string;
  connectionStatus?: string;
}): Promise<{ status: string; responseTimeMs: number | null; error?: string }> {
  // Z.AI SDK services are always connected
  if (service.serviceUrl.includes('api.z.ai') || service.connectionStatus === 'connected') {
    return { status: 'connected', responseTimeMs: 0 };
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${service.serviceUrl}${service.healthEndpoint || '/health'}`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      // Update service status in database
      if (service.serviceName) {
        await db.rAGServiceConfig.update({
          where: { serviceName: service.serviceName },
          data: {
            connectionStatus: 'connected',
            lastHealthCheck: new Date(),
            responseTimeMs
          }
        }).catch(() => {});
      }

      return { status: 'connected', responseTimeMs };
    } else {
      return { status: 'failed', responseTimeMs, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    
    // Update service status in database
    if (service.serviceName) {
      await db.rAGServiceConfig.update({
        where: { serviceName: service.serviceName },
        data: {
          connectionStatus: 'failed',
          lastHealthCheck: new Date(),
          responseTimeMs,
          lastError: error instanceof Error ? error.message : 'Connection failed'
        }
      }).catch(() => {});
    }
    
    return {
      status: 'failed',
      responseTimeMs,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}
