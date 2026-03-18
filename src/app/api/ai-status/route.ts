/**
 * Unified AI Status API
 * =====================
 * Aggregates status from all AI services:
 * - LLM Providers (from database)
 * - RAG Services (Medical RAG, LangChain RAG)
 * - Other AI services (ASR, TTS, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// GET - Get aggregated AI status
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Fetch all status in parallel
    const [llmProviders, ragServices] = await Promise.all([
      getLLMProvidersStatus(),
      getRAGServicesStatus()
    ]);

    // Determine overall status
    const overallStatus = determineOverallStatus(llmProviders, ragServices);

    // Get default services
    const defaultLLM = llmProviders.find(p => p.isDefault && p.isActive);
    const defaultRAG = ragServices.find(s => s.isDefault && s.isActive);

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus,
      summary: {
        llmProviders: {
          total: llmProviders.length,
          active: llmProviders.filter(p => p.isActive).length,
          connected: llmProviders.filter(p => p.connectionStatus === 'connected').length,
          failed: llmProviders.filter(p => p.connectionStatus === 'failed').length
        },
        ragServices: {
          total: ragServices.length,
          active: ragServices.filter(s => s.isActive).length,
          connected: ragServices.filter(s => s.connectionStatus === 'connected').length,
          failed: ragServices.filter(s => s.connectionStatus === 'failed').length
        }
      },
      defaults: {
        llm: defaultLLM ? {
          provider: defaultLLM.provider,
          displayName: defaultLLM.displayName,
          model: defaultLLM.model
        } : null,
        rag: defaultRAG ? {
          serviceName: defaultRAG.serviceName,
          displayName: defaultRAG.displayName,
          port: defaultRAG.port
        } : null
      }
    };

    // Include detailed info if requested
    if (detailed) {
      return NextResponse.json({
        ...response,
        details: {
          llmProviders: llmProviders.map(p => ({
            id: p.id,
            provider: p.provider,
            displayName: p.displayName,
            model: p.model,
            isActive: p.isActive,
            isDefault: p.isDefault,
            priority: p.priority,
            connectionStatus: p.connectionStatus,
            lastUsed: p.lastUsed,
            totalRequests: p.totalRequests
          })),
          ragServices: ragServices.map(s => ({
            id: s.id,
            serviceName: s.serviceName,
            displayName: s.displayName,
            port: s.port,
            serviceType: s.serviceType,
            isActive: s.isActive,
            isDefault: s.isDefault,
            priority: s.priority,
            connectionStatus: s.connectionStatus,
            responseTimeMs: s.responseTimeMs,
            lastHealthCheck: s.lastHealthCheck
          }))
        }
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching AI status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI status' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

async function getLLMProvidersStatus() {
  const providers = await db.lLMIntegration.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  });

  return providers;
}

async function getRAGServicesStatus() {
  const services = await db.rAGServiceConfig.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  });

  // Optionally check health of each service
  const servicesWithHealth = await Promise.all(
    services.map(async (service) => {
      // Only check health if last check was more than 30 seconds ago
      const shouldCheckHealth = !service.lastHealthCheck ||
        (Date.now() - service.lastHealthCheck.getTime()) > 30000;

      if (shouldCheckHealth && service.isActive) {
        const health = await checkServiceHealth(service.serviceUrl, service.healthEndpoint);
        
        // Update status in database
        await db.rAGServiceConfig.update({
          where: { id: service.id },
          data: {
            connectionStatus: health.status,
            responseTimeMs: health.responseTimeMs,
            lastHealthCheck: new Date(),
            lastError: health.error
          }
        }).catch(() => {});

        return {
          ...service,
          connectionStatus: health.status,
          responseTimeMs: health.responseTimeMs,
          lastError: health.error
        };
      }

      return service;
    })
  );

  return servicesWithHealth;
}

async function checkServiceHealth(
  serviceUrl: string,
  healthEndpoint: string
): Promise<{ status: string; responseTimeMs: number | null; error?: string }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${serviceUrl}${healthEndpoint}`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
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

function determineOverallStatus(
  llmProviders: any[],
  ragServices: any[]
): 'healthy' | 'degraded' | 'unhealthy' {
  const activeLLM = llmProviders.filter(p => p.isActive);
  const activeRAG = ragServices.filter(s => s.isActive);

  // Check if we have any active services
  if (activeLLM.length === 0 && activeRAG.length === 0) {
    return 'unhealthy';
  }

  // Check if we have connected services
  const connectedLLM = activeLLM.filter(p => p.connectionStatus === 'connected');
  const connectedRAG = activeRAG.filter(s => s.connectionStatus === 'connected');

  // At least one LLM and one RAG connected
  if (connectedLLM.length > 0 && connectedRAG.length > 0) {
    return 'healthy';
  }

  // At least one service connected
  if (connectedLLM.length > 0 || connectedRAG.length > 0) {
    return 'degraded';
  }

  // No connected services
  return 'unhealthy';
}
