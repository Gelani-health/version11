/**
 * Multi-Provider LLM Configuration
 * ==================================
 * 
 * Comprehensive LLM provider configuration supporting:
 * - Multiple cloud providers (Z.AI, OpenAI, Anthropic, Google)
 * - Local LLM support (Ollama)
 * - Intelligent fallback chain
 * - Cost and performance optimization
 * - HIPAA compliance considerations
 * 
 * Provider Priority:
 * 1. Z.AI (Built-in SDK) - Always available
 * 2. OpenAI - Industry standard, high quality
 * 3. Anthropic Claude - Excellent for medical reasoning
 * 4. Google Gemini - Large context window
 * 5. Ollama (Local) - For offline/PHI-sensitive workloads
 */

// ============================================================================
// Types
// ============================================================================

export interface LLMProvider {
  id: string;
  name: string;
  provider: 'zai' | 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  models: LLMModel[];
  capabilities: {
    contextWindow: number;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsJSON: boolean;
    supportsThinking: boolean;
    supportsFunctions: boolean;
  };
  compliance: {
    hipaaEligible: boolean;
    dataResidency: string[];
    retentionDays: number;
  };
  costPerToken: {
    input: number;  // USD per 1K tokens
    output: number;
  };
  requiresApiKey: boolean;
  defaultBaseUrl: string;
}

export interface LLMModel {
  id: string;
  name: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTemperature: boolean;
  recommendedUse: string[];
  priority: number; // Higher = better for medical
}

// ============================================================================
// Provider Configurations
// ============================================================================

export const LLM_PROVIDERS: LLMProvider[] = [
  // Z.AI - Primary Provider (Built-in SDK)
  {
    id: 'zai-primary',
    name: 'Z.AI',
    provider: 'zai',
    models: [
      {
        id: 'glm-4-flash',
        name: 'GLM-4.7-Flash',
        displayName: 'Z.ai GLM-4.7-Flash',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['general', 'diagnosis', 'documentation', 'quick-response'],
        priority: 100
      },
      {
        id: 'glm-4-plus',
        name: 'GLM-4-Plus',
        displayName: 'Z.ai GLM-4-Plus',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['complex-reasoning', 'analysis', 'detailed-response'],
        priority: 90
      }
    ],
    capabilities: {
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      supportsThinking: true,
      supportsFunctions: true
    },
    compliance: {
      hipaaEligible: true,
      dataResidency: ['US', 'EU', 'APAC'],
      retentionDays: 0 // No retention
    },
    costPerToken: {
      input: 0.0001,  // Very low cost
      output: 0.0001
    },
    requiresApiKey: false, // Built-in SDK credentials
    defaultBaseUrl: 'https://api.z.ai/api/paas/v4'
  },
  
  // OpenAI - Industry Standard
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    models: [
      {
        id: 'gpt-4o',
        name: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['general', 'vision', 'reasoning'],
        priority: 95
      },
      {
        id: 'gpt-4-turbo',
        name: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['complex-reasoning', 'analysis'],
        priority: 90
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['quick-response', 'cost-effective'],
        priority: 70
      }
    ],
    capabilities: {
      contextWindow: 128000,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      supportsThinking: false,
      supportsFunctions: true
    },
    compliance: {
      hipaaEligible: true, // With BAA
      dataResidency: ['US'],
      retentionDays: 30
    },
    costPerToken: {
      input: 0.005,
      output: 0.015
    },
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  
  // Anthropic - Medical Reasoning Excellence
  {
    id: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    models: [
      {
        id: 'claude-3-opus',
        name: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['complex-reasoning', 'medical-analysis', 'diagnosis'],
        priority: 98
      },
      {
        id: 'claude-3-sonnet',
        name: 'claude-3-sonnet-20240229',
        displayName: 'Claude 3 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['general', 'balanced'],
        priority: 92
      },
      {
        id: 'claude-3-haiku',
        name: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['quick-response', 'cost-effective'],
        priority: 75
      }
    ],
    capabilities: {
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      supportsThinking: false,
      supportsFunctions: true
    },
    compliance: {
      hipaaEligible: true, // With BAA
      dataResidency: ['US'],
      retentionDays: 0
    },
    costPerToken: {
      input: 0.015,
      output: 0.075
    },
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1'
  },
  
  // Google Gemini - Large Context
  {
    id: 'google',
    name: 'Google AI',
    provider: 'google',
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        contextWindow: 1000000, // 1M tokens!
        maxOutputTokens: 8192,
        supportsTemperature: true,
        recommendedUse: ['long-context', 'document-analysis', 'research'],
        priority: 88
      },
      {
        id: 'gemini-pro',
        name: 'gemini-pro',
        displayName: 'Gemini Pro',
        contextWindow: 32760,
        maxOutputTokens: 2048,
        supportsTemperature: true,
        recommendedUse: ['general', 'quick-response'],
        priority: 70
      }
    ],
    capabilities: {
      contextWindow: 1000000,
      supportsVision: true,
      supportsStreaming: true,
      supportsJSON: true,
      supportsThinking: false,
      supportsFunctions: true
    },
    compliance: {
      hipaaEligible: true, // With BAA on Google Cloud
      dataResidency: ['US', 'EU'],
      retentionDays: 0
    },
    costPerToken: {
      input: 0.00125,
      output: 0.005
    },
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1'
  },
  
  // Ollama - Local LLM
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    provider: 'ollama',
    models: [
      {
        id: 'llama3',
        name: 'llama3',
        displayName: 'Llama 3',
        contextWindow: 8192,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['offline', 'phi-sensitive', 'privacy-first'],
        priority: 65
      },
      {
        id: 'mistral',
        name: 'mistral',
        displayName: 'Mistral',
        contextWindow: 32768,
        maxOutputTokens: 4096,
        supportsTemperature: true,
        recommendedUse: ['offline', 'efficient'],
        priority: 60
      },
      {
        id: 'medllama2',
        name: 'medllama2',
        displayName: 'MedLlama 2',
        contextWindow: 4096,
        maxOutputTokens: 2048,
        supportsTemperature: true,
        recommendedUse: ['medical-specific', 'offline'],
        priority: 70
      }
    ],
    capabilities: {
      contextWindow: 32768,
      supportsVision: false,
      supportsStreaming: true,
      supportsJSON: true,
      supportsThinking: false,
      supportsFunctions: false
    },
    compliance: {
      hipaaEligible: true, // Local = full control
      dataResidency: ['local'],
      retentionDays: 0
    },
    costPerToken: {
      input: 0, // Free - local
      output: 0
    },
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:11434'
  }
];

// ============================================================================
// Fallback Chain Configuration
// ============================================================================

export const FALLBACK_CHAIN = {
  // Default chain for general queries
  general: [
    { provider: 'zai', model: 'glm-4-flash', maxRetries: 2 },
    { provider: 'anthropic', model: 'claude-3-sonnet', maxRetries: 2 },
    { provider: 'openai', model: 'gpt-4o', maxRetries: 2 },
    { provider: 'google', model: 'gemini-1.5-pro', maxRetries: 1 }
  ],
  
  // Chain for complex medical reasoning
  medicalReasoning: [
    { provider: 'anthropic', model: 'claude-3-opus', maxRetries: 2 },
    { provider: 'zai', model: 'glm-4-plus', maxRetries: 2 },
    { provider: 'openai', model: 'gpt-4-turbo', maxRetries: 2 }
  ],
  
  // Chain for quick responses
  quickResponse: [
    { provider: 'zai', model: 'glm-4-flash', maxRetries: 1 },
    { provider: 'openai', model: 'gpt-3.5-turbo', maxRetries: 1 },
    { provider: 'anthropic', model: 'claude-3-haiku', maxRetries: 1 }
  ],
  
  // Chain for PHI-sensitive workloads (local first)
  phiSensitive: [
    { provider: 'ollama', model: 'medllama2', maxRetries: 2 },
    { provider: 'ollama', model: 'llama3', maxRetries: 2 },
    { provider: 'zai', model: 'glm-4-flash', maxRetries: 1 } // Fallback if local unavailable
  ],
  
  // Chain for document analysis (large context)
  documentAnalysis: [
    { provider: 'google', model: 'gemini-1.5-pro', maxRetries: 2 },
    { provider: 'anthropic', model: 'claude-3-opus', maxRetries: 2 },
    { provider: 'zai', model: 'glm-4-plus', maxRetries: 2 }
  ]
};

// ============================================================================
// Provider Selection Logic
// ============================================================================

export function selectOptimalProvider(
  requirements: {
    task: 'general' | 'medical-reasoning' | 'quick-response' | 'phi-sensitive' | 'document-analysis';
    contextLength: number;
    needsVision: boolean;
    needsJSON: boolean;
    prioritizeCost: boolean;
    prioritizeSpeed: boolean;
  }
): { provider: LLMProvider; model: LLMModel } {
  const chain = FALLBACK_CHAIN[requirements.task];
  
  for (const fallback of chain) {
    const provider = LLM_PROVIDERS.find(p => p.provider === fallback.provider);
    if (!provider) continue;
    
    const model = provider.models.find(m => m.name === fallback.model);
    if (!model) continue;
    
    // Check requirements
    if (requirements.needsVision && !provider.capabilities.supportsVision) continue;
    if (requirements.contextLength > model.contextWindow) continue;
    if (requirements.needsJSON && !provider.capabilities.supportsJSON) continue;
    
    return { provider, model };
  }
  
  // Default fallback to Z.AI (always available)
  const defaultProvider = LLM_PROVIDERS[0];
  return { provider: defaultProvider, model: defaultProvider.models[0] };
}

// ============================================================================
// Export Default Configuration
// ============================================================================

export const LLMConfiguration = {
  providers: LLM_PROVIDERS,
  fallbackChains: FALLBACK_CHAIN,
  selectOptimalProvider
};

export default LLMConfiguration;
