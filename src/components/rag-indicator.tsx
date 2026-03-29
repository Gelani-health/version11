"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, AlertCircle, ChevronDown, Check, Server, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RAGService {
  id: string;
  serviceName: string;
  displayName: string;
  description?: string;
  port: number;
  serviceType: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  connectionStatus: string;
  responseTimeMs?: number;
  lastHealthCheck?: string;
}

interface RAGIndicatorProps {
  showDropdown?: boolean;
  compact?: boolean;
  className?: string;
  onServiceChange?: (serviceName: string) => void;
}

// Static fallback services for when API is unavailable
const FALLBACK_SERVICES: RAGService[] = [
  {
    id: 'fallback-medical-rag',
    serviceName: 'medical-rag',
    displayName: 'Medical RAG',
    description: 'PubMed/PMC-powered medical diagnostic RAG',
    port: 3031,
    serviceType: 'rag',
    isActive: true,
    isDefault: true,
    priority: 10,
    connectionStatus: 'untested',
  },
  {
    id: 'fallback-langchain-rag',
    serviceName: 'langchain-rag',
    displayName: 'LangChain RAG',
    description: 'READ/WRITE LangChain RAG with Smart Sync',
    port: 3032,
    serviceType: 'rag',
    isActive: true,
    isDefault: false,
    priority: 5,
    connectionStatus: 'untested',
  },
  {
    id: 'fallback-medasr',
    serviceName: 'medasr',
    displayName: 'MedASR',
    description: 'Medical Speech Recognition Service',
    port: 3033,
    serviceType: 'asr',
    isActive: true,
    isDefault: false,
    priority: 3,
    connectionStatus: 'untested',
  },
];

/**
 * RAG Indicator Component
 * 
 * Displays the status of RAG (Retrieval-Augmented Generation) services.
 * 
 * Security Notes:
 * - GET requests to /api/rag-config are PUBLIC (no auth required)
 * - This allows the UI to display RAG status even for unauthenticated users
 * - POST/PUT/DELETE operations require admin authentication
 * 
 * Error Handling:
 * - Falls back to static services if API fails
 * - Automatic retry with exponential backoff for transient failures
 * - 401 errors should NOT occur for GET requests (public endpoint)
 */
export function RAGIndicator({
  showDropdown = true,
  compact = false,
  className,
  onServiceChange,
}: RAGIndicatorProps) {
  const [services, setServices] = useState<RAGService[]>(FALLBACK_SERVICES);
  const [defaultService, setDefaultService] = useState<RAGService | null>(FALLBACK_SERVICES[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Fetch RAG configuration with retry logic and fallback
   * GET /api/rag-config is a PUBLIC endpoint (no auth required)
   */
  const fetchRAGConfig = useCallback(async (isRetry = false) => {
    try {
      if (isRetry) {
        setIsRetrying(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/api/rag-config?checkHealth=true", {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
        },
        // Add cache control to prevent stale responses
        cache: 'no-store',
      });
      
      // Handle specific HTTP status codes
      if (response.status === 401) {
        // 401 should NOT happen for GET on public endpoint
        // This indicates a server configuration issue
        console.error('[RAG Indicator] Unexpected 401 on public endpoint - check middleware configuration');
        throw new Error('Authentication error - server configuration issue');
      }
      
      if (response.status === 403) {
        throw new Error('Access forbidden');
      }
      
      if (response.status === 404) {
        throw new Error('RAG configuration endpoint not found');
      }
      
      if (response.status >= 500) {
        // Server error - use fallback services
        console.warn('[RAG Indicator] Server error, using fallback services');
        setServices(FALLBACK_SERVICES);
        setDefaultService(FALLBACK_SERVICES[0]);
        setError('Server temporarily unavailable - showing cached services');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
        // Filter only active services and ensure they have valid data
        const activeServices = data.data.filter((s: RAGService) => s && s.isActive);
        
        if (activeServices.length > 0) {
          setServices(activeServices);
          
          // Find default service
          const def = activeServices.find(
            (s: RAGService) => s.isDefault && s.isActive
          );
          const firstActive = activeServices.find(
            (s: RAGService) => s.isActive
          );
          setDefaultService(def || firstActive || null);
        } else {
          // No active services - use fallback
          setServices(FALLBACK_SERVICES);
          setDefaultService(FALLBACK_SERVICES[0]);
        }
        
        // Reset retry count on success
        setRetryCount(0);
        setError(null);
      } else {
        // No services configured - use fallback
        setServices(FALLBACK_SERVICES);
        setDefaultService(FALLBACK_SERVICES[0]);
      }
    } catch (err) {
      console.error("[RAG Indicator] Error fetching RAG config:", err);
      const errorMessage = err instanceof Error ? err.message : "Connection failed";
      
      // Use fallback services on error
      setServices(FALLBACK_SERVICES);
      setDefaultService(FALLBACK_SERVICES[0]);
      
      // Only show error if it's not a transient issue
      if (!errorMessage.includes('fetch') && !errorMessage.includes('network')) {
        setError(errorMessage);
      } else {
        setError('Using cached service configuration');
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, []);

  /**
   * Retry with exponential backoff
   */
  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: 1s, 2s, 4s, 8s (max)
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 8000);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await fetchRAGConfig(true);
  }, [fetchRAGConfig, retryCount]);

  useEffect(() => {
    fetchRAGConfig();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRAGConfig, 30000);
    return () => clearInterval(interval);
  }, [fetchRAGConfig]);

  /**
   * Set default RAG service (requires admin auth)
   */
  const setDefaultServiceHandler = async (serviceName: string) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'same-origin',
        body: JSON.stringify({ serviceName }),
      });

      const data = await response.json();
      
      if (response.status === 401) {
        console.error('[RAG Indicator] 401 - Admin authentication required to change default service');
        return;
      }
      
      if (response.status === 403) {
        console.error('[RAG Indicator] 403 - Admin role required');
        return;
      }
      
      if (data.success) {
        await fetchRAGConfig();
        onServiceChange?.(serviceName);
      }
    } catch (error) {
      console.error("[RAG Indicator] Error setting default RAG service:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "untested":
        return "bg-amber-400";
      default:
        return "bg-amber-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "failed":
        return "Disconnected";
      case "untested":
        return "Checking...";
      default:
        return "Unknown";
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Database className="h-4 w-4 animate-pulse text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading RAG...</span>
      </div>
    );
  }

  if (error && services.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 text-red-500" title={error}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">RAG Error</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRetry}
          disabled={isRetrying}
          className="h-6 px-2"
        >
          <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
        </Button>
      </div>
    );
  }

  if (!defaultService) {
    // This shouldn't happen now with fallbacks, but just in case
    return (
      <div className={cn("flex items-center gap-2 text-amber-600", className)}>
        <Database className="h-4 w-4" />
        <span className="text-sm">RAG Service</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRetry}
          disabled={isRetrying}
          className="h-6 px-2"
        >
          <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
        </Button>
      </div>
    );
  }

  // Compact mode - just show a small badge
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{defaultService.displayName}</span>
        <span
          className={cn("w-2 h-2 rounded-full", getStatusColor(defaultService.connectionStatus))}
          title={`${defaultService.displayName} - ${getStatusLabel(defaultService.connectionStatus)}`}
        />
      </div>
    );
  }

  // Non-dropdown mode - just show status
  if (!showDropdown) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50", className)}>
        <Database className="h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{defaultService.displayName}</span>
          {!compact && (
            <span className="text-xs text-muted-foreground">Port {defaultService.port}</span>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span
            className={cn("w-2.5 h-2.5 rounded-full", getStatusColor(defaultService.connectionStatus))}
          />
          <span className="text-xs text-muted-foreground">
            {getStatusLabel(defaultService.connectionStatus)}
          </span>
        </div>
        {defaultService.responseTimeMs && (
          <Badge variant="outline" className="text-xs">
            {defaultService.responseTimeMs}ms
          </Badge>
        )}
      </div>
    );
  }

  // Full dropdown mode
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("flex items-center gap-2", className)}
        >
          <Database className="h-4 w-4 text-primary" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{defaultService.displayName}</span>
          </div>
          <span
            className={cn("w-2.5 h-2.5 rounded-full ml-1", getStatusColor(defaultService.connectionStatus))}
          />
          <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          RAG Services
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {services.map((service) => (
          <DropdownMenuItem
            key={service.id}
            className="flex items-start gap-2 p-3"
            onClick={() => service.isActive && setDefaultServiceHandler(service.serviceName)}
            disabled={!service.isActive}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{service.displayName}</span>
                {service.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Port {service.port}</span>
                <span
                  className={cn("w-2 h-2 rounded-full", getStatusColor(service.connectionStatus))}
                />
                <span className="text-xs text-muted-foreground">
                  {getStatusLabel(service.connectionStatus)}
                </span>
                {service.responseTimeMs && (
                  <span className="text-xs text-muted-foreground">
                    ({service.responseTimeMs}ms)
                  </span>
                )}
              </div>
              {service.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {service.description}
                </p>
              )}
            </div>
            {service.isDefault && (
              <Check className="h-4 w-4 text-primary mt-1" />
            )}
          </DropdownMenuItem>
        ))}
        {services.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No RAG services configured
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook for other components to use RAG config
 * 
 * Provides programmatic access to RAG configuration.
 * GET /api/rag-config is PUBLIC - no auth required.
 */
export function useRAGConfig() {
  const [services, setServices] = useState<RAGService[]>([]);
  const [defaultService, setDefaultService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/rag-config?checkHealth=true", {
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success && data.data) {
        setServices(data.data);
        const def = data.data.find((s: RAGService) => s.isDefault && s.isActive);
        const firstActive = data.data.find((s: RAGService) => s.isActive);
        setDefaultService(def || firstActive || null);
      }
    } catch (err) {
      console.error("[useRAGConfig] Error fetching RAG config:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch RAG config');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const setDefault = async (serviceName: string) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'same-origin',
        body: JSON.stringify({ serviceName }),
      });

      if (response.ok) {
        await fetchConfig();
      }
    } catch (error) {
      console.error("[useRAGConfig] Error setting default RAG:", error);
    }
  };

  return {
    services,
    defaultService,
    isLoading,
    error,
    setDefault,
    refresh: fetchConfig,
  };
}
