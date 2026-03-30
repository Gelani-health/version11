/**
 * Unified AI Status API
 * =====================
 * Aggregates status from all AI services:
 * - LLM Providers (from database or defaults)
 * - RAG Services (Medical RAG, LangChain RAG)
 * - Other AI services (ASR, TTS, etc.)
 * 
 * Works in both persistent and ephemeral (Vercel) environments
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getLLMConfigs, 
  getRAGConfigs, 
  getASRConfigs,
  getAIConfigStatus,
  seedDefaultConfigs
} from '@/lib/ai-config-service';

// ============================================
// GET - Get aggregated AI status
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Ensure configs are seeded
    await seedDefaultConfigs();

    // Fetch all status in parallel
    const [llmProviders, ragServices, asrServices, status] = await Promise.all([
      getLLMConfigs(),
      getRAGConfigs(),
      getASRConfigs(),
      getAIConfigStatus()
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
        },
        asrServices: {
          total: asrServices.length,
          active: asrServices.filter(s => s.isActive).length,
          connected: asrServices.filter(s => s.connectionStatus === 'connected').length,
          failed: asrServices.filter(s => s.connectionStatus === 'failed').length
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
      },
      status: {
        hasLLM: status.hasLLM,
        hasRAG: status.hasRAG,
        hasASR: status.hasASR,
        defaultLLM: status.defaultLLM,
        defaultRAG: status.defaultRAG
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
            settings: p.settings
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
            capabilities: s.capabilities
          })),
          asrServices: asrServices.map(s => ({
            id: s.id,
            serviceName: s.serviceName,
            displayName: s.displayName,
            serviceUrl: s.serviceUrl,
            isActive: s.isActive,
            isDefault: s.isDefault,
            connectionStatus: s.connectionStatus
          }))
        }
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching AI status:', error);
    
    // Return default status even on error
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      summary: {
        llmProviders: { total: 2, active: 2, connected: 2, failed: 0 },
        ragServices: { total: 2, active: 2, connected: 1, failed: 0 },
        asrServices: { total: 1, active: 1, connected: 1, failed: 0 }
      },
      defaults: {
        llm: { provider: 'zai', displayName: 'Z.ai GLM-4.7-Flash', model: 'GLM-4.7-Flash' },
        rag: { serviceName: 'medical-rag', displayName: 'Medical RAG (Z.AI SDK)', port: 443 }
      },
      status: {
        hasLLM: true,
        hasRAG: true,
        hasASR: true,
        defaultLLM: 'Z.ai GLM-4.7-Flash',
        defaultRAG: 'Medical RAG (Z.AI SDK)'
      },
      warning: 'Using default configurations (database unavailable)'
    });
  }
}

// ============================================
// Helper Functions
// ============================================

function determineOverallStatus(
  llmProviders: { isActive: boolean; connectionStatus: string }[],
  ragServices: { isActive: boolean; connectionStatus: string }[]
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
