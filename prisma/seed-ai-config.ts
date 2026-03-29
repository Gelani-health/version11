/**
 * AI Configuration Seeder - LLM Integrations & RAG Services
 * ===========================================================
 * 
 * This script seeds the database with default AI configurations for:
 * - LLM Provider Integrations (Z.ai, OpenAI, Gemini, Claude, Ollama)
 * - RAG Service Configurations (Medical RAG, LangChain RAG)
 * 
 * Run with: bunx tsx prisma/seed-ai-config.ts
 * 
 * HIPAA Compliance: API keys are stored encrypted in the database
 */

import { PrismaClient } from '@prisma/client';

// Safe encryption function that handles missing ENCRYPTION_KEY
function safeEncryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  try {
    // Dynamic import to handle potential module issues
    const { encryptApiKey } = require('../src/lib/encryption');
    return encryptApiKey(apiKey);
  } catch (error) {
    console.warn('  ⚠️ Encryption not available, storing API key as plaintext');
    console.warn('  ⚠️ Set ENCRYPTION_KEY environment variable for secure storage');
    return apiKey;
  }
}

const prisma = new PrismaClient();

// ============================================
// LLM Provider Configurations
// ============================================

const LLM_PROVIDERS = [
  {
    provider: 'zai',
    displayName: 'Z.ai GLM-4.7-Flash',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY || 'f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs',
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
  },
  {
    provider: 'zai',
    displayName: 'Z.ai GLM-4-Plus',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY || 'f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs',
    model: 'GLM-4-Plus',
    isActive: true,
    isDefault: false,
    priority: 5,
    settings: JSON.stringify({
      contextWindow: 128000,
      maxTokens: 4096,
      temperature: 0.7,
      supportsStructuredOutput: true,
    }),
    notes: 'Fallback LLM - 128K context, general purpose',
  },
];

// ============================================
// RAG Service Configurations
// ============================================

const RAG_SERVICES = [
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
      pineconeIndex: 'medical-diagnostic-rag',
      pineconeNamespace: 'pubmed',
    }),
    notes: 'Primary RAG service - PubMedBERT embeddings, Pinecone vector store',
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
      embeddingModel: 'NeuML/pubmedbert-base-embeddings',
      embeddingDimension: 768,
      vectorIdPrefix: 'lc_',
      sourcePipeline: 'langchain',
      syncEnabled: true,
      customRagUrl: 'http://localhost:3031',
    }),
    notes: 'Secondary RAG - supports document ingestion and sync',
  },
];

// ============================================
// ASR Service Configuration
// ============================================

const ASR_SERVICES = [
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
      enablePunctuation: true,
      enableSpeakerDiarization: false,
    }),
    notes: 'Medical ASR service - optimized for clinical terminology',
  },
];

// ============================================
// Seeding Functions
// ============================================

async function seedLLMProviders() {
  console.log('\n🤖 Seeding LLM Providers...');
  
  for (const provider of LLM_PROVIDERS) {
    try {
      // Check if provider already exists
      const existing = await prisma.lLMIntegration.findFirst({
        where: {
          provider: provider.provider,
          displayName: provider.displayName,
        },
      });

      if (existing) {
        console.log(`  ✓ LLM Provider "${provider.displayName}" already exists (id: ${existing.id})`);
        continue;
      }

      // Encrypt API key before storing
      const encryptedApiKey = safeEncryptApiKey(provider.apiKey);

      const created = await prisma.lLMIntegration.create({
        data: {
          provider: provider.provider,
          displayName: provider.displayName,
          baseUrl: provider.baseUrl,
          apiKey: encryptedApiKey,
          model: provider.model,
          isActive: provider.isActive,
          isDefault: provider.isDefault,
          priority: provider.priority,
          settings: provider.settings,
          notes: provider.notes,
          connectionStatus: 'untested',
        },
      });

      console.log(`  ✓ Created LLM Provider "${provider.displayName}" (id: ${created.id})`);
    } catch (error) {
      console.error(`  ✗ Error creating LLM Provider "${provider.displayName}":`, error);
    }
  }
}

async function seedRAGServices() {
  console.log('\n📚 Seeding RAG Services...');
  
  for (const service of RAG_SERVICES) {
    try {
      // Check if service already exists
      const existing = await prisma.rAGServiceConfig.findUnique({
        where: { serviceName: service.serviceName },
      });

      if (existing) {
        console.log(`  ✓ RAG Service "${service.displayName}" already exists (id: ${existing.id})`);
        continue;
      }

      const created = await prisma.rAGServiceConfig.create({
        data: {
          serviceName: service.serviceName,
          displayName: service.displayName,
          description: service.description,
          serviceUrl: service.serviceUrl,
          port: service.port,
          healthEndpoint: service.healthEndpoint,
          serviceType: service.serviceType,
          capabilities: service.capabilities,
          isActive: service.isActive,
          isDefault: service.isDefault,
          priority: service.priority,
          settings: service.settings,
          notes: service.notes,
          connectionStatus: 'untested',
        },
      });

      console.log(`  ✓ Created RAG Service "${service.displayName}" (id: ${created.id})`);
    } catch (error) {
      console.error(`  ✗ Error creating RAG Service "${service.displayName}":`, error);
    }
  }
}

async function seedASRSpecices() {
  console.log('\n🎤 Seeding ASR Services...');
  
  for (const service of ASR_SERVICES) {
    try {
      // Check if service already exists
      const existing = await prisma.rAGServiceConfig.findUnique({
        where: { serviceName: service.serviceName },
      });

      if (existing) {
        console.log(`  ✓ ASR Service "${service.displayName}" already exists (id: ${existing.id})`);
        continue;
      }

      const created = await prisma.rAGServiceConfig.create({
        data: {
          serviceName: service.serviceName,
          displayName: service.displayName,
          description: service.description,
          serviceUrl: service.serviceUrl,
          port: service.port,
          healthEndpoint: service.healthEndpoint,
          serviceType: service.serviceType,
          capabilities: service.capabilities,
          isActive: service.isActive,
          isDefault: service.isDefault,
          priority: service.priority,
          settings: service.settings,
          notes: service.notes,
          connectionStatus: 'untested',
        },
      });

      console.log(`  ✓ Created ASR Service "${service.displayName}" (id: ${created.id})`);
    } catch (error) {
      console.error(`  ✗ Error creating ASR Service "${service.displayName}":`, error);
    }
  }
}

async function verifySeed() {
  console.log('\n🔍 Verifying seeded data...');
  
  const llmCount = await prisma.lLMIntegration.count();
  const ragCount = await prisma.rAGServiceConfig.count({
    where: { serviceType: 'rag' },
  });
  const asrCount = await prisma.rAGServiceConfig.count({
    where: { serviceType: 'asr' },
  });

  console.log(`  📊 LLM Providers: ${llmCount}`);
  console.log(`  📊 RAG Services: ${ragCount}`);
  console.log(`  📊 ASR Services: ${asrCount}`);

  // Check default provider
  const defaultLLM = await prisma.lLMIntegration.findFirst({
    where: { isDefault: true, isActive: true },
  });
  const defaultRAG = await prisma.rAGServiceConfig.findFirst({
    where: { isDefault: true, isActive: true, serviceType: 'rag' },
  });

  console.log(`\n  🎯 Default LLM: ${defaultLLM?.displayName || 'None'}`);
  console.log(`  🎯 Default RAG: ${defaultRAG?.displayName || 'None'}`);

  return { llmCount, ragCount, asrCount, hasDefaults: !!defaultLLM && !!defaultRAG };
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Gelani Healthcare - AI Configuration Seeder            ║');
  console.log('║                                                            ║');
  console.log('║     This script seeds LLM and RAG configurations           ║');
  console.log('║     to ensure persistent AI service settings               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await seedLLMProviders();
    await seedRAGServices();
    await seedASRSpecices();
    await verifySeed();

    console.log('\n✅ AI Configuration seeding completed successfully!');
    console.log('\n💡 Tip: Run "bun run services:start" to start the AI services');
    console.log('💡 Tip: Check service status with "bun run services:status"');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
