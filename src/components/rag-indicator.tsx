"use client";

import { useEffect, useState } from "react";
import { Database, AlertCircle, ChevronDown, Check, Server } from "lucide-react";
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

export function RAGIndicator({
  showDropdown = true,
  compact = false,
  className,
  onServiceChange,
}: RAGIndicatorProps) {
  const [services, setServices] = useState<RAGService[]>([]);
  const [defaultService, setDefaultService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRAGConfig = async () => {
    try {
      const response = await fetch("/api/rag-config?checkHealth=true");
      const data = await response.json();

      if (data.success && data.data) {
        setServices(data.data);
        const def = data.data.find(
          (s: RAGService) => s.isDefault && s.isActive
        );
        const firstActive = data.data.find(
          (s: RAGService) => s.isActive
        );
        setDefaultService(def || firstActive || null);
      }
    } catch (error) {
      console.error("Error fetching RAG config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRAGConfig();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRAGConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  const setDefaultServiceHandler = async (serviceName: string) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchRAGConfig();
        onServiceChange?.(serviceName);
      }
    } catch (error) {
      console.error("Error setting default RAG service:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "untested":
        return "bg-gray-400";
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
        return "Untested";
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

  if (!defaultService) {
    return (
      <div className={cn("flex items-center gap-2 text-amber-600", className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No RAG Service Configured</span>
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

// Hook for other components to use RAG config
export function useRAGConfig() {
  const [services, setServices] = useState<RAGService[]>([]);
  const [defaultService, setDefaultService] = useState<RAGService | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/rag-config?checkHealth=true");
      const data = await response.json();

      if (data.success && data.data) {
        setServices(data.data);
        const def = data.data.find((s: RAGService) => s.isDefault && s.isActive);
        const firstActive = data.data.find((s: RAGService) => s.isActive);
        setDefaultService(def || firstActive || null);
      }
    } catch (error) {
      console.error("Error fetching RAG config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const setDefault = async (serviceName: string) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName }),
      });

      if (response.ok) {
        await fetchConfig();
      }
    } catch (error) {
      console.error("Error setting default RAG:", error);
    }
  };

  return {
    services,
    defaultService,
    isLoading,
    setDefault,
    refresh: fetchConfig,
  };
}
