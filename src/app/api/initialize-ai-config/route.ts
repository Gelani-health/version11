/**
 * AI Configuration Initialization API
 * =====================================
 * 
 * This endpoint ensures that LLM and RAG configurations are initialized
 * on app startup. Called automatically by the app when it starts.
 * 
 * GET /api/initialize-ai-config
 * - Checks if configurations exist
 * - Seeds default configurations if missing
 * - Returns status of initialization
 * 
 * Note: This endpoint is public (no auth required) for initialization purposes.
 * In production, consider adding rate limiting or admin-only access.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default LLM Provider Configuration
const DEFAULT_LLM_PROVIDERS = [
  {
    provider: 'zai',
    displayName: 'Z.ai GLM-4.7-Flash',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY || '',
    model: 'GLM-4.7-Flash',
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: JSON.stringify({
      contextWindow: 200000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsThinking: true,
      supportsStructuredOutput: true,
    }),
    notes: 'Primary LLM - 200K context window, superior multi-step reasoning',
    connectionStatus: 'untested',
  },
];

// Default RAG Service Configuration
const DEFAULT_RAG_SERVICES = [
  {
    serviceName: 'medical-rag',
    displayName: 'Medical RAG',
    description: 'PubMed/PMC-powered medical diagnostic RAG with GLM-4.7-Flash',
    serviceUrl: 'http://localhost:3031',
    port: 3031,
    healthEndpoint: '/health',
    serviceType: 'rag',
    capabilities: JSON.stringify(['query', 'diagnose', 'pubmed-search', 'clinical-decision-support']),
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: JSON.stringify({
      topK: 50,
      minScore: 0.5,
      embeddingModel: 'NeuML/pubmedbert-base-embeddings',
      embeddingDimension: 768,
    }),
    notes: 'Primary RAG service - PubMedBERT embeddings',
    connectionStatus: 'untested',
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
      syncEnabled: true,
    }),
    notes: 'Secondary RAG - supports document ingestion and sync',
    connectionStatus: 'untested',
  },
];

// Default ASR Service Configuration
const DEFAULT_ASR_SERVICES = [
  {
    serviceName: 'medasr',
    displayName: 'Medical ASR',
    description: 'Medical speech recognition service for clinical documentation',
    serviceUrl: 'http://localhost:3333',
    port: 3333,
    healthEndpoint: '/health',
    serviceType: 'asr',
    capabilities: JSON.stringify(['transcribe', 'realtime', 'medical-terminology']),
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: JSON.stringify({
      language: 'en-US',
      model: 'medical-whisper',
    }),
    notes: 'Medical ASR service - optimized for clinical terminology',
    connectionStatus: 'untested',
  },
];

// Safe encryption for API keys
function safeEncryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  try {
    const { encryptApiKey } = require('@/lib/encryption');
    return encryptApiKey(apiKey);
  } catch {
    return apiKey;
  }
}

export async function GET() {
  const results = {
    llm: { initialized: 0, existing: 0, errors: [] as string[] },
    rag: { initialized: 0, existing: 0, errors: [] as string[] },
    asr: { initialized: 0, existing: 0, errors: [] as string[] },
  };

  try {
    // Initialize LLM Providers
    for (const provider of DEFAULT_LLM_PROVIDERS) {
      try {
        const existing = await db.lLMIntegration.findFirst({
          where: { provider: provider.provider, displayName: provider.displayName },
        });

        if (existing) {
          results.llm.existing++;
          continue;
        }

        await db.lLMIntegration.create({
          data: {
            ...provider,
            apiKey: safeEncryptApiKey(provider.apiKey),
          },
        });
        results.llm.initialized++;
      } catch (error) {
        results.llm.errors.push(`${provider.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Initialize RAG Services
    for (const service of DEFAULT_RAG_SERVICES) {
      try {
        const existing = await db.rAGServiceConfig.findUnique({
          where: { serviceName: service.serviceName },
        });

        if (existing) {
          results.rag.existing++;
          continue;
        }

        await db.rAGServiceConfig.create({
          data: service as any,
        });
        results.rag.initialized++;
      } catch (error) {
        results.rag.errors.push(`${service.serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Initialize ASR Services
    for (const service of DEFAULT_ASR_SERVICES) {
      try {
        const existing = await db.rAGServiceConfig.findUnique({
          where: { serviceName: service.serviceName },
        });

        if (existing) {
          results.asr.existing++;
          continue;
        }

        await db.rAGServiceConfig.create({
          data: service as any,
        });
        results.asr.initialized++;
      } catch (error) {
        results.asr.errors.push(`${service.serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Get current status
    const llmCount = await db.lLMIntegration.count();
    const ragCount = await db.rAGServiceConfig.count({ where: { serviceType: 'rag' } });
    const asrCount = await db.rAGServiceConfig.count({ where: { serviceType: 'asr' } });

    const defaultLLM = await db.lLMIntegration.findFirst({
      where: { isDefault: true, isActive: true },
    });
    const defaultRAG = await db.rAGServiceConfig.findFirst({
      where: { isDefault: true, isActive: true, serviceType: 'rag' },
    });

    return NextResponse.json({
      success: true,
      message: 'AI Configuration initialization complete',
      results,
      status: {
        llmProviders: llmCount,
        ragServices: ragCount,
        asrServices: asrCount,
        hasDefaultLLM: !!defaultLLM,
        hasDefaultRAG: !!defaultRAG,
        defaultLLM: defaultLLM?.displayName || null,
        defaultRAG: defaultRAG?.displayName || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI Config initialization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize AI configurations',
        results,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
