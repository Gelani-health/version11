/**
 * SSOT Settings API - Single Source of Truth for System Configuration
 * ================================================================
 * Central configuration management for:
 * - LLM Provider & Model Selection
 * - RAG Service Configuration
 * - ERP Integration (Odoo)
 * - Clinical AI Features
 * - Safety & Compliance Settings
 * 
 * Security:
 * - GET: Authenticated users can read settings (sensitive fields masked)
 * - PUT: Admin only (full access)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';

// Sensitive fields that should be masked in GET responses
const SENSITIVE_FIELDS = ['llmApiKey', 'erpApiKey', 'erpPassword'];

// Available LLM providers and their models
export const LLM_PROVIDERS = {
  'z-ai': {
    name: 'Z.AI (GLM)',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4', 'glm-3-turbo'],
    requiresApiKey: false,
    description: 'Z.AI GLM models - Built-in API access'
  },
  'openai': {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    requiresApiKey: true,
    description: 'OpenAI GPT models - Requires API key'
  },
  'anthropic': {
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    requiresApiKey: true,
    description: 'Anthropic Claude models - Requires API key'
  },
  'local': {
    name: 'Local/Self-Hosted',
    models: ['custom'],
    requiresApiKey: false,
    description: 'Self-hosted LLM - Requires base URL'
  }
};

// Default settings template
const DEFAULT_SETTINGS = {
  llmProvider: 'z-ai',
  llmModel: 'glm-4-flash',
  llmTemperature: 0.7,
  llmMaxTokens: 2048,
  llmTopP: 0.9,
  llmEnableStreaming: true,
  ragEnabled: true,
  ragDefaultService: 'medical-rag',
  ragTopK: 10,
  ragMinScore: 0.5,
  ragEmbeddingModel: 'all-mpnet-base-v2',
  ragEmbeddingDimension: 768,
  ragEnableHybridSearch: true,
  ragEnableReranking: true,
  ragCacheEnabled: true,
  ragCacheTTLSeconds: 3600,
  erpEnabled: false,
  erpSyncPatients: true,
  erpSyncInvoices: true,
  erpSyncPayments: true,
  erpSyncInventory: false,
  erpSyncIntervalMinutes: 30,
  erpConnectionStatus: 'disconnected',
  enableClinicalDecisionSupport: true,
  enableDrugInteractionCheck: true,
  enableImageAnalysis: true,
  enableVoiceTranscription: true,
  enableDifferentialDiagnosis: true,
  enableBayesianReasoning: true,
  enableICDCodeSuggestion: true,
  requireHumanReview: true,
  logAllInteractions: true,
  safetyAlertThreshold: 0.8,
  hipaaComplianceMode: true,
  auditRetentionDays: 2555,
  enableExperimentalFeatures: false,
  enableBetaModels: false,
};

/**
 * Mask sensitive fields in settings object
 */
function maskSensitiveFields(settings: any): any {
  const masked = { ...settings };
  for (const field of SENSITIVE_FIELDS) {
    if (masked[field]) {
      masked[field] = '••••••••••••'; // Masked value
    }
  }
  return masked;
}

/**
 * Get or create system settings
 */
async function getOrCreateSettings() {
  let settings = await db.systemSettings.findFirst();
  
  if (!settings) {
    settings = await db.systemSettings.create({
      data: DEFAULT_SETTINGS
    });
    console.log('[SSOT] Created default system settings');
  }
  
  return settings;
}

/**
 * GET - Retrieve system settings
 * Regular users get masked settings, admins get full settings
 */
export async function GET(request: NextRequest) {
  try {
    const settings = await getOrCreateSettings();
    
    // Try to get user from auth (optional for this endpoint)
    let user: AuthenticatedUser | null = null;
    try {
      const auth = await import('@/lib/auth-middleware');
      const authResult = await auth.authenticateRequest(request);
      if (authResult.authenticated) {
        user = authResult.user || null;
      }
    } catch {
      // No auth - return masked settings
    }
    
    // Mask sensitive fields for non-admins
    const responseData = user?.role === 'admin' ? settings : maskSensitiveFields(settings);
    
    return NextResponse.json({
      success: true,
      data: responseData,
      providers: LLM_PROVIDERS,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SSOT] Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update system settings (Admin only)
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const currentSettings = await getOrCreateSettings();
    
    // Track changes for audit
    const changes: Array<{ key: string; oldValue: any; newValue: any }> = [];
    
    // Build update object with only allowed fields
    const allowedFields = [
      // LLM Settings
      'llmProvider', 'llmModel', 'llmSecondaryModel', 'llmApiKey', 'llmBaseUrl',
      'llmTemperature', 'llmMaxTokens', 'llmTopP', 'llmEnableStreaming',
      // RAG Settings
      'ragEnabled', 'ragDefaultService', 'ragTopK', 'ragMinScore',
      'ragEmbeddingModel', 'ragEmbeddingDimension', 'ragEnableHybridSearch',
      'ragEnableReranking', 'ragCacheEnabled', 'ragCacheTTLSeconds',
      // ERP Settings
      'erpEnabled', 'erpProvider', 'erpUrl', 'erpDatabase', 'erpApiKey',
      'erpUsername', 'erpPassword', 'erpSyncPatients', 'erpSyncInvoices',
      'erpSyncPayments', 'erpSyncInventory', 'erpSyncIntervalMinutes',
      // Clinical Features
      'enableClinicalDecisionSupport', 'enableDrugInteractionCheck',
      'enableImageAnalysis', 'enableVoiceTranscription', 'enableDifferentialDiagnosis',
      'enableBayesianReasoning', 'enableICDCodeSuggestion',
      // Safety & Compliance
      'requireHumanReview', 'logAllInteractions', 'safetyAlertThreshold',
      'hipaaComplianceMode', 'auditRetentionDays',
      // Feature Flags
      'enableExperimentalFeatures', 'enableBetaModels',
    ];
    
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (field in body) {
        const oldValue = (currentSettings as any)[field];
        const newValue = body[field];
        
        if (oldValue !== newValue) {
          changes.push({ key: field, oldValue, newValue });
          updateData[field] = newValue;
        }
      }
    }
    
    // Validate LLM provider/model combination
    if (updateData.llmProvider || updateData.llmModel) {
      const provider = updateData.llmProvider || currentSettings.llmProvider;
      const model = updateData.llmModel || currentSettings.llmModel;
      const providerConfig = LLM_PROVIDERS[provider as keyof typeof LLM_PROVIDERS];
      
      if (!providerConfig) {
        return NextResponse.json(
          { success: false, error: `Invalid LLM provider: ${provider}` },
          { status: 400 }
        );
      }
      
      if (!providerConfig.models.includes(model)) {
        return NextResponse.json(
          { success: false, error: `Model ${model} not available for provider ${provider}` },
          { status: 400 }
        );
      }
    }
    
    // Update settings
    const updatedSettings = await db.systemSettings.update({
      where: { id: currentSettings.id },
      data: updateData
    });
    
    // Log changes for audit
    for (const change of changes) {
      await db.settingsHistory.create({
        data: {
          settingKey: change.key,
          oldValue: String(change.oldValue ?? ''),
          newValue: String(change.newValue ?? ''),
          changedBy: user.employeeId,
          changedByName: user.name,
          changeReason: body.changeReason || 'Settings update via API'
        }
      });
    }
    
    console.log(`[SSOT] Settings updated by ${user.employeeId}: ${changes.length} changes`);
    
    return NextResponse.json({
      success: true,
      data: updatedSettings,
      changes: changes.map(c => c.key),
      message: `Updated ${changes.length} settings`
    });
  } catch (error) {
    console.error('[SSOT] Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

/**
 * POST - Test ERP Connection (Admin only)
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { testType } = body;
    
    if (testType === 'erp') {
      // Test ERP/Odoo connection
      const settings = await getOrCreateSettings();
      
      if (!settings.erpUrl) {
        return NextResponse.json({
          success: false,
          error: 'ERP URL not configured'
        });
      }
      
      try {
        const startTime = Date.now();
        const response = await fetch(`${settings.erpUrl}/web/database/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          // Update connection status
          await db.systemSettings.update({
            where: { id: settings.id },
            data: {
              erpConnectionStatus: 'connected',
              erpLastSync: new Date()
            }
          });
          
          return NextResponse.json({
            success: true,
            status: 'connected',
            responseTime,
            message: 'ERP connection successful'
          });
        } else {
          await db.systemSettings.update({
            where: { id: settings.id },
            data: {
              erpConnectionStatus: 'failed',
              erpLastError: `HTTP ${response.status}`
            }
          });
          
          return NextResponse.json({
            success: false,
            status: 'failed',
            error: `ERP returned HTTP ${response.status}`
          });
        }
      } catch (err: any) {
        await db.systemSettings.update({
          where: { id: settings.id },
          data: {
            erpConnectionStatus: 'failed',
            erpLastError: err.message
          }
        });
        
        return NextResponse.json({
          success: false,
          status: 'failed',
          error: err.message
        });
      }
    }
    
    if (testType === 'llm') {
      // Test LLM connection by making a simple completion
      const zai = await import('z-ai-web-dev-sdk').then(m => m.default.create());
      
      try {
        const startTime = Date.now();
        const response = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Connection successful" in exactly 2 words.' }
          ],
          max_tokens: 10
        });
        const responseTime = Date.now() - startTime;
        
        return NextResponse.json({
          success: true,
          status: 'connected',
          responseTime,
          model: response.model || 'glm-4-flash',
          message: 'LLM connection successful'
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          status: 'failed',
          error: err.message
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Unknown test type. Use "erp" or "llm".'
    }, { status: 400 });
  } catch (error) {
    console.error('[SSOT] Error testing connection:', error);
    return NextResponse.json(
      { success: false, error: 'Connection test failed' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });
