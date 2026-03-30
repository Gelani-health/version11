/**
 * AI Configuration Initialization API
 * =====================================
 * 
 * This endpoint ensures that LLM and RAG configurations are initialized
 * on app startup. Called automatically by the SilentAIConfigInitializer component.
 * 
 * GET /api/initialize-ai-config - Check and seed if missing
 * POST /api/initialize-ai-config - Force re-initialization
 * 
 * Key Features:
 * - Always returns valid configurations (database or defaults)
 * - Works in both persistent and ephemeral (Vercel) environments
 * - Uses Z.AI SDK for all AI operations
 * - Automatic seeding when database is empty
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAIConfigStatus, 
  seedDefaultConfigs,
  getLLMConfigs,
  getRAGConfigs,
  getASRConfigs
} from '@/lib/ai-config-service';

/**
 * GET - Check and initialize configurations
 * Always returns valid status
 */
export async function GET() {
  try {
    console.log('[AI Config] Starting initialization check...');

    // Try to seed defaults (will only create if missing)
    const seedResults = await seedDefaultConfigs();

    // Get current status (always returns valid configs)
    const status = await getAIConfigStatus();

    console.log('[AI Config] Initialization complete:', status);

    return NextResponse.json({
      success: true,
      message: 'AI Configuration initialized successfully',
      results: {
        seed: seedResults,
      },
      status: {
        llmProviders: status.llmCount,
        ragServices: status.ragCount,
        asrServices: status.asrCount,
        hasDefaultLLM: status.hasLLM,
        hasDefaultRAG: status.hasRAG,
        hasDefaultASR: status.hasASR,
        defaultLLM: status.defaultLLM,
        defaultRAG: status.defaultRAG,
        defaultASR: status.defaultASR,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AI Config] Initialization error:', error);
    
    // Even on error, return valid status with defaults
    return NextResponse.json({
      success: true,
      message: 'AI Configuration using defaults (database unavailable)',
      results: {
        seed: { llm: { created: 0, existing: 0 }, rag: { created: 0, existing: 0 }, asr: { created: 0, existing: 0 } },
      },
      status: {
        llmProviders: 2,
        ragServices: 2,
        asrServices: 1,
        hasDefaultLLM: true,
        hasDefaultRAG: true,
        hasDefaultASR: true,
        defaultLLM: 'Z.ai GLM-4.7-Flash',
        defaultRAG: 'Medical RAG (Z.AI SDK)',
        defaultASR: 'Z.AI Speech Recognition',
      },
      timestamp: new Date().toISOString(),
      warning: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST - Force re-initialization
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[AI Config] Starting forced re-initialization...');

    // Force seed defaults
    const seedResults = await seedDefaultConfigs();

    // Get all configurations
    const [llmConfigs, ragConfigs, asrConfigs] = await Promise.all([
      getLLMConfigs(),
      getRAGConfigs(),
      getASRConfigs(),
    ]);

    const status = await getAIConfigStatus();

    return NextResponse.json({
      success: true,
      message: 'AI Configuration re-initialized successfully',
      results: {
        seed: seedResults,
      },
      status: {
        llmProviders: status.llmCount,
        ragServices: status.ragCount,
        asrServices: status.asrCount,
        hasDefaultLLM: status.hasLLM,
        hasDefaultRAG: status.hasRAG,
        hasDefaultASR: status.hasASR,
        defaultLLM: status.defaultLLM,
        defaultRAG: status.defaultRAG,
        defaultASR: status.defaultASR,
      },
      configs: {
        llm: llmConfigs,
        rag: ragConfigs,
        asr: asrConfigs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AI Config] Re-initialization error:', error);
    
    // Even on error, return valid status with defaults
    return NextResponse.json({
      success: true,
      message: 'AI Configuration using defaults (database unavailable)',
      status: {
        llmProviders: 2,
        ragServices: 2,
        asrServices: 1,
        hasDefaultLLM: true,
        hasDefaultRAG: true,
        hasDefaultASR: true,
        defaultLLM: 'Z.ai GLM-4.7-Flash',
        defaultRAG: 'Medical RAG (Z.AI SDK)',
        defaultASR: 'Z.AI Speech Recognition',
      },
      timestamp: new Date().toISOString(),
      warning: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
