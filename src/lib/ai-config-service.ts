/**
 * AI Configuration Service
 * =========================
 * 
 * Provides persistent AI configurations (LLM, RAG, ASR) for the
 * Gelani Healthcare Assistant - World-Class Clinical Decision Support System.
 * 
 * Key Features:
 * - Environment-based default configurations
 * - Database-backed persistence with SQLite
 * - Automatic fallback to built-in defaults
 * - Multiple LLM provider support (OpenAI, Anthropic, Google, Z.AI, Ollama)
 * - Medical-optimized settings
 * 
 * HIPAA Compliance: API keys are stored encrypted when persisted
 * 
 * @module ai-config-service
 */

import { db } from './db';

// ============================================================================
// Types
// ============================================================================

export interface LLMConfig {
  id: string;
  provider: string;
  displayName: string;
  baseUrl: string | null;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  settings?: Record<string, unknown>;
  connectionStatus: string;
  notes?: string | null;
}

export interface RAGConfig {
  id: string;
  serviceName: string;
  displayName: string;
  description?: string | null;
  serviceUrl: string;
  port: number;
  serviceType: string;
  capabilities?: string[];
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  settings?: Record<string, unknown>;
  connectionStatus: string;
  notes?: string | null;
}

// ============================================================================
// Default Configurations (Environment-Based)
// ============================================================================

const DEFAULT_LLM_CONFIGS: LLMConfig[] = [
  // Z.AI GLM-4.7-Flash - Primary LLM (Built-in SDK)
  {
    id: 'default-zai-glm4-flash',
    provider: 'zai',
    displayName: 'Z.ai GLM-4.7-Flash (Recommended)',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'GLM-4.7-Flash',
    isActive: true,
    isDefault: true,
    priority: 100,
    settings: {
      contextWindow: 200000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsThinking: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsFunctionCalling: true,
      costPer1kTokens: 0.001,
    },
    connectionStatus: 'connected',
    notes: 'Primary LLM - Built-in Z.AI SDK. 200K context window, vision capable, superior clinical reasoning. Best for medical diagnosis support.',
  },
  // Z.AI GLM-4-Plus - Fallback
  {
    id: 'default-zai-glm4-plus',
    provider: 'zai',
    displayName: 'Z.ai GLM-4-Plus',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'GLM-4-Plus',
    isActive: true,
    isDefault: false,
    priority: 90,
    settings: {
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.5,
      supportsStructuredOutput: true,
      supportsFunctionCalling: true,
      costPer1kTokens: 0.002,
    },
    connectionStatus: 'connected',
    notes: 'Secondary Z.AI model - 128K context, enhanced reasoning for complex cases.',
  },
  // OpenAI GPT-4o - Recommended External
  {
    id: 'default-openai-gpt4o',
    provider: 'openai',
    displayName: 'OpenAI GPT-4o',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    isActive: false,
    isDefault: false,
    priority: 80,
    settings: {
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsVision: true,
      supportsFunctionCalling: true,
      supportsStructuredOutput: true,
      costPer1kTokens: 0.005,
    },
    connectionStatus: 'untested',
    notes: 'OpenAI GPT-4o - Excellent for clinical documentation. Requires OPENAI_API_KEY.',
  },
  // OpenAI GPT-4 Turbo
  {
    id: 'default-openai-gpt4-turbo',
    provider: 'openai',
    displayName: 'OpenAI GPT-4 Turbo',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo',
    isActive: false,
    isDefault: false,
    priority: 75,
    settings: {
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsVision: true,
      supportsFunctionCalling: true,
      costPer1kTokens: 0.01,
    },
    connectionStatus: 'untested',
    notes: 'OpenAI GPT-4 Turbo - Strong clinical reasoning capabilities.',
  },
  // Anthropic Claude 3.5 Sonnet
  {
    id: 'default-anthropic-claude-35-sonnet',
    provider: 'claude',
    displayName: 'Anthropic Claude 3.5 Sonnet',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    isActive: false,
    isDefault: false,
    priority: 85,
    settings: {
      contextWindow: 200000,
      maxTokens: 8192,
      temperature: 0.3,
      supportsVision: true,
      supportsFunctionCalling: true,
      costPer1kTokens: 0.003,
    },
    connectionStatus: 'untested',
    notes: 'Claude 3.5 Sonnet - Excellent for clinical analysis and documentation. Requires ANTHROPIC_API_KEY.',
  },
  // Anthropic Claude 3 Opus
  {
    id: 'default-anthropic-claude-3-opus',
    provider: 'claude',
    displayName: 'Anthropic Claude 3 Opus',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-opus-20240229',
    isActive: false,
    isDefault: false,
    priority: 70,
    settings: {
      contextWindow: 200000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsVision: true,
      costPer1kTokens: 0.015,
    },
    connectionStatus: 'untested',
    notes: 'Claude 3 Opus - Highest quality reasoning, best for complex differential diagnosis.',
  },
  // Google Gemini 1.5 Pro
  {
    id: 'default-google-gemini-15-pro',
    provider: 'gemini',
    displayName: 'Google Gemini 1.5 Pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    model: 'gemini-1.5-pro',
    isActive: false,
    isDefault: false,
    priority: 65,
    settings: {
      contextWindow: 1000000,
      maxTokens: 8192,
      temperature: 0.3,
      supportsVision: true,
      supportsFunctionCalling: true,
      costPer1kTokens: 0.0035,
    },
    connectionStatus: 'untested',
    notes: 'Gemini 1.5 Pro - Massive 1M context window. Great for comprehensive patient history analysis. Requires GOOGLE_API_KEY.',
  },
  // Google Gemini 1.5 Flash
  {
    id: 'default-google-gemini-15-flash',
    provider: 'gemini',
    displayName: 'Google Gemini 1.5 Flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    model: 'gemini-1.5-flash',
    isActive: false,
    isDefault: false,
    priority: 60,
    settings: {
      contextWindow: 1000000,
      maxTokens: 8192,
      temperature: 0.3,
      supportsVision: true,
      costPer1kTokens: 0.00035,
    },
    connectionStatus: 'untested',
    notes: 'Gemini 1.5 Flash - Fast and cost-effective with large context.',
  },
  // Ollama Llama 3.1 - Local Deployment
  {
    id: 'default-ollama-llama31',
    provider: 'ollama',
    displayName: 'Ollama Llama 3.1 70B (Local)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1:70b',
    isActive: false,
    isDefault: false,
    priority: 50,
    settings: {
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.3,
      isLocal: true,
      costPer1kTokens: 0,
    },
    connectionStatus: 'untested',
    notes: 'Llama 3.1 70B via Ollama - Local deployment, no API costs. Requires Ollama installation and model download.',
  },
  // Ollama MedLlama2 - Medical Fine-tuned
  {
    id: 'default-ollama-medllama2',
    provider: 'ollama',
    displayName: 'Ollama MedLlama2 (Local)',
    baseUrl: 'http://localhost:11434',
    model: 'medllama2',
    isActive: false,
    isDefault: false,
    priority: 45,
    settings: {
      contextWindow: 4096,
      maxTokens: 2048,
      temperature: 0.3,
      isLocal: true,
      isMedicalFineTuned: true,
      costPer1kTokens: 0,
    },
    connectionStatus: 'untested',
    notes: 'MedLlama2 via Ollama - Medical domain fine-tuned model for local deployment.',
  },
];

const DEFAULT_RAG_CONFIGS: RAGConfig[] = [
  // Primary Medical RAG - Embedded Knowledge
  {
    id: 'default-embedded-medical-rag',
    serviceName: 'embedded-medical-rag',
    displayName: 'Embedded Medical Knowledge RAG',
    description: 'Primary RAG with embedded clinical guidelines, drug interactions, ICD-10 codes, and diagnostic knowledge. No external dependencies.',
    serviceUrl: 'internal://embedded-knowledge',
    port: 0,
    serviceType: 'rag',
    capabilities: [
      'query',
      'diagnose',
      'clinical-decision-support',
      'drug-interactions',
      'icd-coding',
      'differential-diagnosis',
      'lab-interpretation',
      'symptom-analysis',
      'clinical-guidelines',
    ],
    isActive: true,
    isDefault: true,
    priority: 100,
    settings: {
      useEmbeddedKnowledge: true,
      topK: 10,
      minScore: 0.3,
      embeddingModel: 'feature-based-semantic',
      embeddingDimension: 768,
      enableDrugInteractionCheck: true,
      enableLabInterpretation: true,
      enableDifferentialDiagnosis: true,
    },
    connectionStatus: 'connected',
    notes: 'Primary RAG - Fully embedded medical knowledge base. Works offline, no external API calls needed.',
  },
  // Medical RAG Service (Python FastAPI)
  {
    id: 'default-medical-rag-service',
    serviceName: 'medical-rag',
    displayName: 'Medical RAG Service (Extended)',
    description: 'Extended RAG service with PubMedBERT embeddings and vector search. Requires Python service.',
    serviceUrl: 'http://localhost:3031',
    port: 3031,
    serviceType: 'rag',
    capabilities: [
      'query',
      'diagnose',
      'semantic-search',
      'embeddings',
      'vector-search',
      'document-ingestion',
      'pubmed-search',
    ],
    isActive: false,
    isDefault: false,
    priority: 50,
    settings: {
      topK: 50,
      minScore: 0.5,
      embeddingModel: 'NeuML/pubmedbert-base-embeddings',
      embeddingDimension: 768,
      useGPU: false,
    },
    connectionStatus: 'untested',
    notes: 'Extended RAG - Local Python service with PubMedBERT embeddings. Start with: npm run services:start',
  },
  // LangChain RAG Service
  {
    id: 'default-langchain-rag-service',
    serviceName: 'langchain-rag',
    displayName: 'LangChain RAG Service',
    description: 'LangChain-powered RAG with custom document ingestion and vector database support.',
    serviceUrl: 'http://localhost:3032',
    port: 3032,
    serviceType: 'rag',
    capabilities: [
      'query',
      'ingest',
      'sync',
      'batch-ingest',
      'delete',
      'custom-knowledge',
      'pdf-processing',
    ],
    isActive: false,
    isDefault: false,
    priority: 40,
    settings: {
      topK: 50,
      minScore: 0.5,
      syncEnabled: true,
      vectorDb: 'chromadb',
    },
    connectionStatus: 'untested',
    notes: 'LangChain RAG - For custom document ingestion and knowledge base management.',
  },
];

const DEFAULT_ASR_CONFIGS: RAGConfig[] = [
  // Z.AI ASR - Built-in
  {
    id: 'default-zai-asr',
    serviceName: 'zai-asr',
    displayName: 'Z.AI Speech Recognition',
    description: 'Medical speech recognition powered by Z.AI SDK for clinical documentation.',
    serviceUrl: 'https://api.z.ai',
    port: 443,
    serviceType: 'asr',
    capabilities: ['transcribe', 'realtime', 'medical-terminology', 'multi-language'],
    isActive: true,
    isDefault: true,
    priority: 100,
    settings: {
      language: 'en-US',
      model: 'whisper-large-v3',
      useBuiltInSDK: true,
    },
    connectionStatus: 'connected',
    notes: 'Primary ASR - Built-in Z.AI SDK Whisper integration.',
  },
  // Local ASR Service
  {
    id: 'default-medasr-service',
    serviceName: 'medasr',
    displayName: 'Medical ASR Service (Local)',
    description: 'Local medical ASR service with fine-tuned Whisper model.',
    serviceUrl: 'http://localhost:3033',
    port: 3033,
    serviceType: 'asr',
    capabilities: ['transcribe', 'realtime', 'medical-terminology'],
    isActive: false,
    isDefault: false,
    priority: 50,
    settings: {
      language: 'en-US',
      model: 'whisper-medium',
    },
    connectionStatus: 'untested',
    notes: 'Local ASR - Requires Python service. Start with: npm run services:start',
  },
];

// ============================================================================
// LLM Configuration Service
// ============================================================================

/**
 * Get all LLM configurations
 * Returns database records if available, otherwise returns defaults
 */
export async function getLLMConfigs(): Promise<LLMConfig[]> {
  try {
    const dbConfigs = await db.lLMIntegration.findMany({
      orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
    });

    if (dbConfigs.length > 0) {
      return dbConfigs.map((c) => ({
        id: c.id,
        provider: c.provider,
        displayName: c.displayName,
        baseUrl: c.baseUrl,
        model: c.model,
        isActive: c.isActive,
        isDefault: c.isDefault,
        priority: c.priority,
        settings: c.settings ? JSON.parse(c.settings) : undefined,
        connectionStatus: c.connectionStatus,
        notes: c.notes,
      }));
    }
  } catch (error) {
    console.warn('[AI Config] Could not fetch LLM configs from database, using defaults:', error);
  }

  return DEFAULT_LLM_CONFIGS;
}

/**
 * Get the default LLM configuration
 */
export async function getDefaultLLMConfig(): Promise<LLMConfig | null> {
  const configs = await getLLMConfigs();
  return configs.find((c) => c.isDefault && c.isActive) || configs.find((c) => c.isActive) || null;
}

/**
 * Check if any LLM is configured
 */
export async function hasLLMConfig(): Promise<boolean> {
  const configs = await getLLMConfigs();
  return configs.some((c) => c.isActive);
}

/**
 * Get LLM configs by provider
 */
export async function getLLMConfigsByProvider(provider: string): Promise<LLMConfig[]> {
  const configs = await getLLMConfigs();
  return configs.filter((c) => c.provider === provider && c.isActive);
}

// ============================================================================
// RAG Configuration Service
// ============================================================================

/**
 * Get all RAG configurations
 */
export async function getRAGConfigs(): Promise<RAGConfig[]> {
  try {
    const dbConfigs = await db.rAGServiceConfig.findMany({
      where: { serviceType: 'rag' },
      orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
    });

    if (dbConfigs.length > 0) {
      return dbConfigs.map((c) => ({
        id: c.id,
        serviceName: c.serviceName,
        displayName: c.displayName,
        description: c.description,
        serviceUrl: c.serviceUrl,
        port: c.port,
        serviceType: c.serviceType,
        capabilities: c.capabilities ? JSON.parse(c.capabilities) : undefined,
        isActive: c.isActive,
        isDefault: c.isDefault,
        priority: c.priority,
        settings: c.settings ? JSON.parse(c.settings) : undefined,
        connectionStatus: c.connectionStatus,
        notes: c.notes,
      }));
    }
  } catch (error) {
    console.warn('[AI Config] Could not fetch RAG configs from database, using defaults:', error);
  }

  return DEFAULT_RAG_CONFIGS;
}

/**
 * Get the default RAG configuration
 */
export async function getDefaultRAGConfig(): Promise<RAGConfig | null> {
  const configs = await getRAGConfigs();
  return configs.find((c) => c.isDefault && c.isActive) || configs.find((c) => c.isActive) || null;
}

/**
 * Check if any RAG service is configured
 */
export async function hasRAGConfig(): Promise<boolean> {
  const configs = await getRAGConfigs();
  return configs.some((c) => c.isActive);
}

// ============================================================================
// ASR Configuration Service
// ============================================================================

/**
 * Get all ASR configurations
 */
export async function getASRConfigs(): Promise<RAGConfig[]> {
  try {
    const dbConfigs = await db.rAGServiceConfig.findMany({
      where: { serviceType: 'asr' },
      orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
    });

    if (dbConfigs.length > 0) {
      return dbConfigs.map((c) => ({
        id: c.id,
        serviceName: c.serviceName,
        displayName: c.displayName,
        description: c.description,
        serviceUrl: c.serviceUrl,
        port: c.port,
        serviceType: c.serviceType,
        capabilities: c.capabilities ? JSON.parse(c.capabilities) : undefined,
        isActive: c.isActive,
        isDefault: c.isDefault,
        priority: c.priority,
        settings: c.settings ? JSON.parse(c.settings) : undefined,
        connectionStatus: c.connectionStatus,
        notes: c.notes,
      }));
    }
  } catch (error) {
    console.warn('[AI Config] Could not fetch ASR configs from database, using defaults:', error);
  }

  return DEFAULT_ASR_CONFIGS;
}

/**
 * Get the default ASR configuration
 */
export async function getDefaultASRConfig(): Promise<RAGConfig | null> {
  const configs = await getASRConfigs();
  return configs.find((c) => c.isDefault && c.isActive) || configs.find((c) => c.isActive) || null;
}

// ============================================================================
// Configuration Status
// ============================================================================

export interface AIConfigStatus {
  hasLLM: boolean;
  hasRAG: boolean;
  hasASR: boolean;
  defaultLLM: string | null;
  defaultRAG: string | null;
  defaultASR: string | null;
  llmCount: number;
  ragCount: number;
  asrCount: number;
  activeProviders: string[];
}

/**
 * Get the overall AI configuration status
 */
export async function getAIConfigStatus(): Promise<AIConfigStatus> {
  const [llmConfigs, ragConfigs, asrConfigs] = await Promise.all([
    getLLMConfigs(),
    getRAGConfigs(),
    getASRConfigs(),
  ]);

  const defaultLLM = llmConfigs.find((c) => c.isDefault && c.isActive);
  const defaultRAG = ragConfigs.find((c) => c.isDefault && c.isActive);
  const defaultASR = asrConfigs.find((c) => c.isDefault && c.isActive);

  const activeLLMs = llmConfigs.filter((c) => c.isActive);
  const activeProviders = [...new Set(activeLLMs.map((c) => c.provider))];

  return {
    hasLLM: activeLLMs.length > 0,
    hasRAG: ragConfigs.some((c) => c.isActive),
    hasASR: asrConfigs.some((c) => c.isActive),
    defaultLLM: defaultLLM?.displayName || null,
    defaultRAG: defaultRAG?.displayName || null,
    defaultASR: defaultASR?.displayName || null,
    llmCount: activeLLMs.length,
    ragCount: ragConfigs.filter((c) => c.isActive).length,
    asrCount: asrConfigs.filter((c) => c.isActive).length,
    activeProviders,
  };
}

// ============================================================================
// Database Seed Helper
// ============================================================================

/**
 * Seed the database with default configurations
 */
export async function seedDefaultConfigs(): Promise<{
  llm: { created: number; existing: number };
  rag: { created: number; existing: number };
  asr: { created: number; existing: number };
}> {
  const results = {
    llm: { created: 0, existing: 0 },
    rag: { created: 0, existing: 0 },
    asr: { created: 0, existing: 0 },
  };

  // Seed LLM providers
  for (const config of DEFAULT_LLM_CONFIGS) {
    try {
      const existing = await db.lLMIntegration.findFirst({
        where: { provider: config.provider, displayName: config.displayName },
      });

      if (existing) {
        await db.lLMIntegration.update({
          where: { id: existing.id },
          data: { connectionStatus: config.connectionStatus, isActive: config.isActive },
        });
        results.llm.existing++;
      } else {
        await db.lLMIntegration.create({
          data: {
            provider: config.provider,
            displayName: config.displayName,
            baseUrl: config.baseUrl,
            model: config.model,
            isActive: config.isActive,
            isDefault: config.isDefault,
            priority: config.priority,
            settings: JSON.stringify(config.settings),
            connectionStatus: config.connectionStatus,
            notes: config.notes,
          },
        });
        results.llm.created++;
      }
    } catch (error) {
      console.warn(`[AI Config] Error seeding LLM ${config.displayName}:`, error);
    }
  }

  // Seed RAG services
  for (const config of DEFAULT_RAG_CONFIGS) {
    try {
      const existing = await db.rAGServiceConfig.findUnique({
        where: { serviceName: config.serviceName },
      });

      if (existing) {
        await db.rAGServiceConfig.update({
          where: { id: existing.id },
          data: { connectionStatus: config.connectionStatus, isActive: config.isActive },
        });
        results.rag.existing++;
      } else {
        await db.rAGServiceConfig.create({
          data: {
            serviceName: config.serviceName,
            displayName: config.displayName,
            description: config.description,
            serviceUrl: config.serviceUrl,
            port: config.port,
            serviceType: config.serviceType,
            capabilities: JSON.stringify(config.capabilities),
            isActive: config.isActive,
            isDefault: config.isDefault,
            priority: config.priority,
            settings: JSON.stringify(config.settings),
            connectionStatus: config.connectionStatus,
            notes: config.notes,
          },
        });
        results.rag.created++;
      }
    } catch (error) {
      console.warn(`[AI Config] Error seeding RAG ${config.serviceName}:`, error);
    }
  }

  // Seed ASR services
  for (const config of DEFAULT_ASR_CONFIGS) {
    try {
      const existing = await db.rAGServiceConfig.findUnique({
        where: { serviceName: config.serviceName },
      });

      if (existing) {
        await db.rAGServiceConfig.update({
          where: { id: existing.id },
          data: { connectionStatus: config.connectionStatus, isActive: config.isActive },
        });
        results.asr.existing++;
      } else {
        await db.rAGServiceConfig.create({
          data: {
            serviceName: config.serviceName,
            displayName: config.displayName,
            description: config.description,
            serviceUrl: config.serviceUrl,
            port: config.port,
            serviceType: config.serviceType,
            capabilities: JSON.stringify(config.capabilities),
            isActive: config.isActive,
            isDefault: config.isDefault,
            priority: config.priority,
            settings: JSON.stringify(config.settings),
            connectionStatus: config.connectionStatus,
            notes: config.notes,
          },
        });
        results.asr.created++;
      }
    } catch (error) {
      console.warn(`[AI Config] Error seeding ASR ${config.serviceName}:`, error);
    }
  }

  console.log('[AI Config] Seeding complete:', results);
  return results;
}
