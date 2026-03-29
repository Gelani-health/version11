import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * Medical RAG API - Proxy to Python FastAPI Service
 * 
 * Uses RAGServiceConfig (SSOT) to determine service URL
 * Forwards requests to the configured RAG service
 */

// Default fallback URL if database config is not available
const DEFAULT_RAG_SERVICE = {
  serviceUrl: 'http://localhost:3031',
  port: 3031,
  healthEndpoint: '/health'
};

interface MedicalQueryRequest {
  query: string;
  patient_context?: {
    age?: number;
    gender?: string;
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
  specialty?: string;
  top_k?: number;
  min_score?: number;
  include_citations?: boolean;
  expand_query?: boolean;
  ragService?: string; // Optional: specify which RAG service to use
}

// Get RAG service configuration from database (SSOT)
async function getRAGServiceConfig(serviceName?: string) {
  try {
    if (serviceName) {
      // Get specific service
      const service = await db.rAGServiceConfig.findUnique({
        where: { serviceName, isActive: true }
      });
      if (service) return service;
    }
    
    // Get default service
    const defaultService = await db.rAGServiceConfig.findFirst({
      where: { 
        isActive: true,
        isDefault: true 
      },
      orderBy: [
        { priority: 'desc' }
      ]
    });
    
    if (defaultService) return defaultService;
    
    // Fallback to first active service
    const firstActive = await db.rAGServiceConfig.findFirst({
      where: { isActive: true },
      orderBy: [{ priority: 'desc' }]
    });
    
    return firstActive || null;
  } catch (error) {
    console.error('Error fetching RAG config:', error);
    return null;
  }
}

// Update service statistics
async function updateServiceStats(
  serviceName: string, 
  success: boolean, 
  latencyMs: number
) {
  try {
    const service = await db.rAGServiceConfig.findUnique({
      where: { serviceName }
    });
    
    if (!service) return;
    
    const totalRequests = service.totalRequests + 1;
    const successfulRequests = success ? service.successfulRequests + 1 : service.successfulRequests;
    const failedRequests = success ? service.failedRequests : service.failedRequests + 1;
    const averageLatency = service.averageLatency 
      ? (service.averageLatency * service.totalRequests + latencyMs) / totalRequests
      : latencyMs;
    
    await db.rAGServiceConfig.update({
      where: { serviceName },
      data: {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageLatency,
        lastHealthCheck: new Date(),
        connectionStatus: success ? 'connected' : 'failed'
      }
    });
  } catch (error) {
    console.error('Error updating service stats:', error);
  }
}

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const startTime = Date.now();
  
  try {
    const body: MedicalQueryRequest = await request.json();
    
    if (!body.query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Get RAG service configuration from SSOT
    const ragConfig = await getRAGServiceConfig(body.ragService);
    
    // Use config or fallback
    const serviceUrl = ragConfig?.serviceUrl || DEFAULT_RAG_SERVICE.serviceUrl;
    const serviceName = ragConfig?.serviceName || 'default';

    // Forward request to Python RAG service
    const response = await fetch(`${serviceUrl}/api/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: body.query,
        patient_context: body.patient_context,
        specialty: body.specialty,
        top_k: body.top_k || 50,
        min_score: body.min_score || 0.5,
        include_citations: body.include_citations ?? true,
        expand_query: body.expand_query ?? true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('RAG service error:', error);
      
      // Update stats
      await updateServiceStats(serviceName, false, Date.now() - startTime);
      
      return NextResponse.json(
        { success: false, error: 'RAG service unavailable', details: error },
        { status: 503 }
      );
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    // Update stats
    await updateServiceStats(serviceName, true, latencyMs);
    
    return NextResponse.json({
      success: true,
      data: {
        query: data.query,
        expanded_query: data.expanded_query,
        results: data.results?.map((r: Record<string, unknown>) => ({
          id: r.id,
          pmid: r.pmid,
          title: r.title,
          abstract: typeof r.abstract === 'string' ? r.abstract.slice(0, 500) + '...' : '',
          journal: r.journal,
          publication_date: r.publication_date,
          score: r.score,
          authors: r.authors,
          mesh_terms: r.mesh_terms,
          doi: r.doi,
        })) || [],
        ai_response: data.ai_response,
        total_results: data.total_results || 0,
        latency_ms: latencyMs,
        metadata: {
          ...data.metadata,
          ragService: serviceName,
          ragServiceUrl: serviceUrl
        },
      },
    });

  } catch (error) {
    console.error('Medical RAG API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process medical query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for service status
export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('serviceName') || undefined;
    
    // Get RAG service config from SSOT
    const ragConfig = await getRAGServiceConfig(serviceName);
    
    if (!ragConfig) {
      return NextResponse.json({
        success: false,
        status: 'unavailable',
        message: 'No RAG service configured or all services are inactive',
        services: [],
      });
    }
    
    // Check health of the service
    const startTime = Date.now();
    const response = await fetch(`${ragConfig.serviceUrl}${ragConfig.healthEndpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    const latencyMs = Date.now() - startTime;
    
    if (!response.ok) {
      // Update status
      await db.rAGServiceConfig.update({
        where: { serviceName: ragConfig.serviceName },
        data: {
          connectionStatus: 'failed',
          lastHealthCheck: new Date(),
          responseTimeMs: latencyMs
        }
      });
      
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: `RAG service '${ragConfig.displayName}' is not responding`,
        service: {
          serviceName: ragConfig.serviceName,
          displayName: ragConfig.displayName,
          serviceUrl: ragConfig.serviceUrl,
          port: ragConfig.port,
          isDefault: ragConfig.isDefault
        }
      });
    }
    
    const healthData = await response.json();
    
    // Update status
    await db.rAGServiceConfig.update({
      where: { serviceName: ragConfig.serviceName },
        data: {
        connectionStatus: 'connected',
        lastHealthCheck: new Date(),
        responseTimeMs: latencyMs
      }
    });
    
    return NextResponse.json({
      success: true,
      status: healthData.status || 'healthy',
      service: {
        serviceName: ragConfig.serviceName,
        displayName: ragConfig.displayName,
        serviceUrl: ragConfig.serviceUrl,
        port: ragConfig.port,
        isDefault: ragConfig.isDefault,
        responseTimeMs: latencyMs
      },
      services: healthData.services,
      timestamp: new Date().toISOString(),
      version: healthData.version,
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'offline',
      message: 'RAG service is offline',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
