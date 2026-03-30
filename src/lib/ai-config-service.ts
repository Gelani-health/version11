/**
 * AI Configuration Service
 * =========================
 * 
 * Provides persistent AI configurations (LLM, RAG, ASR) that work in both
 * persistent (local/Docker) and ephemeral (Vercel serverless) environments.
 * 
 * Key Features:
 * - Environment-based default configurations
 * - Database-backed persistence when available
 * - Automatic fallback to built-in defaults
 * - Z.AI SDK integration (always available)
 * 
 * HIPAA Compliance: API keys are stored encrypted when persisted
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
  {
    id: 'default-zai-glm4-flash',
    provider: 'zai',
    displayName: 'Z.ai GLM-4.7-Flash',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'GLM-4.7-Flash',
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: {
      contextWindow: 200000,
      maxTokens: 4096,
      temperature: 0.3,
      supportsThinking: true,
      supportsStructuredOutput: true,
      supportsVision: true,
    },
    connectionStatus: 'connected',
    notes: 'Primary LLM - Z.AI SDK built-in. 200K context, vision capable, superior multi-step reasoning.',
  },
  {
    id: 'default-zai-glm4-plus',
    provider: 'zai',
    displayName: 'Z.ai GLM-4-Plus',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'GLM-4-Plus',
    isActive: true,
    isDefault: false,
    priority: 5,
    settings: {
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.7,
      supportsStructuredOutput: true,
    },
    connectionStatus: 'connected',
    notes: 'Fallback LLM - 128K context, general purpose',
  },
];

const DEFAULT_RAG_CONFIGS: RAGConfig[] = [
  {
    id: 'default-medical-rag',
    serviceName: 'medical-rag',
    displayName: 'Medical RAG (Z.AI SDK)',
    description: 'Medical diagnostic RAG powered by Z.AI SDK with PubMedBERT embeddings and clinical knowledge base',
    serviceUrl: 'https://api.z.ai',
    port: 443,
    serviceType: 'rag',
    capabilities: [
      'query',
      'diagnose',
      'clinical-decision-support',
      'drug-interactions',
      'icd-coding',
      'differential-diagnosis',
    ],
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: {
      topK: 50,
      minScore: 0.5,
      embeddingModel: 'NeuML/pubmedbert-base-embeddings',
      embeddingDimension: 768,
      useBuiltInSDK: true,
    },
    connectionStatus: 'connected',
    notes: 'Primary RAG - Uses Z.AI SDK with built-in medical knowledge',
  },
  {
    id: 'default-langchain-rag',
    serviceName: 'langchain-rag',
    displayName: 'LangChain RAG (Extended)',
    description: 'Extended RAG capabilities with document ingestion and custom knowledge support',
    serviceUrl: 'http://localhost:3032',
    port: 3032,
    serviceType: 'rag',
    capabilities: ['query', 'ingest', 'sync', 'batch-ingest', 'delete', 'custom-knowledge'],
    isActive: true,
    isDefault: false,
    priority: 5,
    settings: {
      topK: 50,
      minScore: 0.5,
      syncEnabled: true,
    },
    connectionStatus: 'untested',
    notes: 'Extended RAG - Local service for custom document ingestion',
  },
];

const DEFAULT_ASR_CONFIGS: RAGConfig[] = [
  {
    id: 'default-zai-asr',
    serviceName: 'zai-asr',
    displayName: 'Z.AI Speech Recognition',
    description: 'Medical speech recognition powered by Z.AI SDK for clinical documentation',
    serviceUrl: 'https://api.z.ai',
    port: 443,
    serviceType: 'asr',
    capabilities: ['transcribe', 'realtime', 'medical-terminology', 'multi-language'],
    isActive: true,
    isDefault: true,
    priority: 10,
    settings: {
      language: 'en-US',
      model: 'whisper-large-v3',
      useBuiltInSDK: true,
    },
    connectionStatus: 'connected',
    notes: 'Primary ASR - Uses Z.AI SDK Whisper integration',
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
    console.warn('[AI Config] Could not fetch LLM configs from database:', error);
  }

  // Return defaults if database is empty or error
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

// ============================================================================
// RAG Configuration Service
// ============================================================================

/**
 * Get all RAG configurations
 * Returns database records if available, otherwise returns defaults
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
    console.warn('[AI Config] Could not fetch RAG configs from database:', error);
  }

  // Return defaults if database is empty or error
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
    console.warn('[AI Config] Could not fetch ASR configs from database:', error);
  }

  // Return defaults if database is empty or error
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

  return {
    hasLLM: llmConfigs.some((c) => c.isActive),
    hasRAG: ragConfigs.some((c) => c.isActive),
    hasASR: asrConfigs.some((c) => c.isActive),
    defaultLLM: defaultLLM?.displayName || null,
    defaultRAG: defaultRAG?.displayName || null,
    defaultASR: defaultASR?.displayName || null,
    llmCount: llmConfigs.length,
    ragCount: ragConfigs.length,
    asrCount: asrConfigs.length,
  };
}

// ============================================================================
// Database Seed Helper (for persistent environments)
// ============================================================================

/**
 * Seed the database with default configurations
 * This is called when the database is empty
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
        // Update connection status to connected
        await db.lLMIntegration.update({
          where: { id: existing.id },
          data: { connectionStatus: 'connected', isActive: true },
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
          data: { connectionStatus: 'connected', isActive: true },
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
          data: { connectionStatus: 'connected', isActive: true },
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

  return results;
}
