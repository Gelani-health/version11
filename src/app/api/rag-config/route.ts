/**
 * RAG Service Configuration API - Single Source of Truth
 * =========================================================
 * Manages RAG service configuration, health checks, and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default RAG services configuration
const DEFAULT_RAG_SERVICES = [
  {
    serviceName: 'medical-rag',
    displayName: 'Medical RAG',
    description: 'PubMed/PMC-powered medical diagnostic RAG with GLM-4.7-Flash',
    serviceUrl: 'http://localhost:3031',
    port: 3031,
    healthEndpoint: '/health',
    serviceType: 'rag',
    capabilities: JSON.stringify(['query', 'diagnose', 'pubmed-search']),
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: JSON.stringify({
      topK: 50,
      minScore: 0.5,
      embeddingModel: 'all-mpnet-base-v2',
      embeddingDimension: 768,
      pineconeIndex: 'medical-diagnostic-rag',
      pineconeNamespace: 'pubmed'
    })
  },
  {
    serviceName: 'langchain-rag',
    displayName: 'LangChain RAG',
    description: 'READ/WRITE LangChain RAG with Smart Sync capabilities',
    serviceUrl: 'http://localhost:3032',
    port: 3032,
    healthEndpoint: '/health',
    serviceType: 'rag',
    capabilities: JSON.stringify(['query', 'ingest', 'sync', 'batch-ingest', 'delete']),
    isActive: true,
    isDefault: false,
    priority: 5,
    settings: JSON.stringify({
      topK: 50,
      minScore: 0.5,
      embeddingModel: 'all-mpnet-base-v2',
      embeddingDimension: 768,
      vectorIdPrefix: 'lc_',
      sourcePipeline: 'langchain',
      syncEnabled: true,
      customRagUrl: 'http://localhost:3031'
    })
  }
];

// ============================================
// GET - Retrieve RAG configurations
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('serviceName');
    const checkHealth = searchParams.get('checkHealth') === 'true';

    // Get specific service or all services
    let services;
    if (serviceName) {
      services = await db.rAGServiceConfig.findUnique({
        where: { serviceName }
      });
    } else {
      services = await db.rAGServiceConfig.findMany({
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });
    }

    // Initialize default services if none exist
    if (!serviceName && services.length === 0) {
      await initializeDefaultServices();
      services = await db.rAGServiceConfig.findMany({
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });
    }

    // Optionally check health of each service
    if (checkHealth && Array.isArray(services)) {
      services = await Promise.all(
        services.map(async (service) => {
          const healthResult = await checkServiceHealth(service);
          return {
            ...service,
            connectionStatus: healthResult.status,
            responseTimeMs: healthResult.responseTimeMs,
            lastError: healthResult.error
          };
        })
      );
    }

    // Get default service for convenience
    const defaultService = Array.isArray(services)
      ? services.find(s => s.isDefault && s.isActive) || services.find(s => s.isActive)
      : services;

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

// ============================================
// POST - Create or Update RAG configuration
// ============================================
export async function POST(request: NextRequest) {
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
        body.port = parseInt(url.port) || 80;
      } catch {
        body.port = 80;
      }
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await db.rAGServiceConfig.updateMany({
        where: { isDefault: true },
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
}

// ============================================
// PUT - Set default RAG service
// ============================================
export async function PUT(request: NextRequest) {
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
      where: { isDefault: true },
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
}

// ============================================
// DELETE - Remove RAG configuration
// ============================================
export async function DELETE(request: NextRequest) {
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
}

// ============================================
// Helper Functions
// ============================================

async function initializeDefaultServices() {
  for (const service of DEFAULT_RAG_SERVICES) {
    await db.rAGServiceConfig.create({ data: service as any });
  }
}

async function checkServiceHealth(service: {
  serviceUrl: string;
  healthEndpoint: string;
  serviceName?: string;
}): Promise<{ status: string; responseTimeMs: number | null; error?: string }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${service.serviceUrl}${service.healthEndpoint}`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      // Determine service name from URL
      const serviceName = service.serviceUrl.includes('3031') ? 'medical-rag' : 
                          service.serviceUrl.includes('3032') ? 'langchain-rag' : null;
      
      if (serviceName) {
        await db.rAGServiceConfig.update({
          where: { serviceName },
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
    return {
      status: 'failed',
      responseTimeMs,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}
