"use client";

/**
 * AI Configuration Initializer
 * =============================
 * 
 * This component automatically initializes AI configurations (LLM, RAG)
 * when the app loads. It ensures that:
 * 
 * 1. Default LLM providers are configured
 * 2. Default RAG services are configured  
 * 3. The system is always ready for AI operations
 * 
 * It runs once on app startup and re-validates periodically.
 */

import { useEffect, useState, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Brain,
  Database,
  Sparkles
} from 'lucide-react';

interface AIConfigStatus {
  initialized: boolean;
  llmProviders: number;
  ragServices: number;
  hasDefaultLLM: boolean;
  hasDefaultRAG: boolean;
  defaultLLM: string | null;
  defaultRAG: string | null;
  lastChecked: string;
}

export function AIConfigInitializer() {
  const [status, setStatus] = useState<AIConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const initializeConfig = useCallback(async (forceInit = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call the initialization endpoint
      const initResponse = await fetch('/api/initialize-ai-config', {
        method: forceInit ? 'POST' : 'GET',
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize AI configuration');
      }

      const initData = await initResponse.json();
      
      if (initData.success) {
        setStatus({
          initialized: true,
          llmProviders: initData.status?.llmProviders || 0,
          ragServices: initData.status?.ragServices || 0,
          hasDefaultLLM: initData.status?.hasDefaultLLM || false,
          hasDefaultRAG: initData.status?.hasDefaultRAG || false,
          defaultLLM: initData.status?.defaultLLM || null,
          defaultRAG: initData.status?.defaultRAG || null,
          lastChecked: new Date().toISOString(),
        });
      } else {
        throw new Error(initData.error || 'Initialization failed');
      }
    } catch (err) {
      console.error('[AI Config Initializer] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus({
        initialized: false,
        llmProviders: 0,
        ragServices: 0,
        hasDefaultLLM: false,
        hasDefaultRAG: false,
        defaultLLM: null,
        defaultRAG: null,
        lastChecked: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeConfig();
  }, [initializeConfig]);

  // Periodic check every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        initializeConfig();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [initializeConfig, isLoading]);

  const handleRetry = () => {
    setIsRetrying(true);
    initializeConfig(true);
  };

  // Loading state
  if (isLoading && !status) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <div>
            <p className="font-medium text-sm">Initializing AI Services</p>
            <p className="text-xs text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !status?.initialized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Alert variant="destructive" className="shadow-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">AI Configuration Required</AlertTitle>
          <AlertDescription className="text-xs mt-2">
            <p>LLM and RAG services need to be configured.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Initialize Now
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Success state - minimal indicator
  if (status.hasDefaultLLM && status.hasDefaultRAG) {
    return null; // All good, no UI needed
  }

  // Partial success - show status indicator
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center gap-2 text-xs">
        <Brain className="h-4 w-4 text-blue-500" />
        <div className="flex items-center gap-1">
          {status.hasDefaultLLM ? (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              LLM
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              No LLM
            </Badge>
          )}
          {status.hasDefaultRAG ? (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <Database className="h-3 w-3 mr-1" />
              RAG
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              <Sparkles className="h-3 w-3 mr-1" />
              No RAG
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Silent initializer - no UI, just ensures config
export function SilentAIConfigInitializer() {
  useEffect(() => {
    // Initialize AI config silently on app startup
    fetch('/api/initialize-ai-config')
      .then(res => res.json())
      .then(data => {
        console.log('[AI Config] Initialization result:', data);
      })
      .catch(err => {
        console.error('[AI Config] Initialization error:', err);
      });
  }, []);

  return null;
}
