"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  Settings,
  Star,
  AlertCircle,
  RefreshCw,
  Plus,
  Zap,
  Activity,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// Provider icons
const PROVIDER_ICONS: Record<string, string> = {
  zai: "🤖",
  openai: "🧠",
  gemini: "💎",
  claude: "🎭",
  ollama: "🦙",
  custom: "⚙️",
};

interface LLMProvider {
  id: string;
  provider: string;
  displayName: string;
  model: string;
  isDefault: boolean;
  isCurrentDefault: boolean;
}

interface LLMProviderSelectorProps {
  value?: string; // Selected provider ID
  onChange: (providerId: string) => void;
  onManageClick?: () => void;
  showManageButton?: boolean;
  showStatus?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function LLMProviderSelector({
  value,
  onChange,
  onManageClick,
  showManageButton = true,
  showStatus = true,
  className = "",
  disabled = false,
  placeholder = "Select AI Provider",
}: LLMProviderSelectorProps) {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/llm-integrations?forSelection=true");
      const data = await response.json();
      if (data.success) {
        setProviders(data.data);
        setDefaultId(data.defaultId);
        
        // If no value is set, use the default
        if (!value && data.defaultId) {
          onChange(data.defaultId);
        }
      } else {
        toast.error("Failed to load AI providers");
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
      toast.error("Failed to load AI providers");
    } finally {
      setIsLoading(false);
    }
  }, [value, onChange]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const selectedProvider = providers.find((p) => p.id === value);

  // No providers configured
  if (!isLoading && providers.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>No AI providers configured</span>
        </div>
        {showManageButton && onManageClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManageClick}
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Provider
          </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          {/* Provider Selector */}
          <div className="flex-1">
            <Select
              value={value}
              onValueChange={onChange}
              disabled={disabled || isLoading}
              open={isOpen}
              onOpenChange={setIsOpen}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                <SelectValue placeholder={isLoading ? "Loading..." : placeholder}>
                  {selectedProvider ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {PROVIDER_ICONS[selectedProvider.provider] || "🤖"}
                      </span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-sm">
                          {selectedProvider.displayName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {selectedProvider.model}
                        </span>
                      </div>
                      {selectedProvider.isCurrentDefault && (
                        <Star className="h-3 w-3 text-amber-500 ml-auto" />
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">{placeholder}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <AnimatePresence>
                  {providers.map((provider) => (
                    <SelectItem
                      key={provider.id}
                      value={provider.id}
                      className="cursor-pointer"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-lg">
                          {PROVIDER_ICONS[provider.provider] || "🤖"}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium">{provider.displayName}</span>
                          <span className="text-xs text-slate-500">
                            {provider.model}
                          </span>
                        </div>
                        {provider.isCurrentDefault && (
                          <Badge
                            variant="outline"
                            className="ml-auto text-xs bg-amber-50 border-amber-200 text-amber-700"
                          >
                            <Star className="h-2 w-2 mr-1" />
                            Default
                          </Badge>
                        )}
                      </motion.div>
                    </SelectItem>
                  ))}
                </AnimatePresence>

                {showManageButton && onManageClick && (
                  <div className="border-t mt-1 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-purple-600 hover:bg-purple-50"
                      onClick={() => {
                        setIsOpen(false);
                        onManageClick();
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Providers
                    </Button>
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchProviders}
                disabled={isLoading}
                className="h-9 w-9"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh providers</TooltipContent>
          </Tooltip>
        </div>

        {/* Status Info */}
        {showStatus && selectedProvider && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-slate-500"
          >
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              <span>
                Using <strong>{selectedProvider.displayName}</strong>
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-purple-500" />
              <span>{selectedProvider.model}</span>
            </div>
            {selectedProvider.isCurrentDefault && (
              <>
                <span className="text-slate-300">•</span>
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-50 border-amber-200 text-amber-700"
                >
                  <Star className="h-2 w-2 mr-1" />
                  Default
                </Badge>
              </>
            )}
          </motion.div>
        )}

        {/* Quick link to settings */}
        {showManageButton && onManageClick && (
          <div className="flex items-center justify-end">
            <Button
              variant="link"
              size="sm"
              onClick={onManageClick}
              className="h-auto p-0 text-xs text-slate-500 hover:text-purple-600"
            >
              <Settings className="h-3 w-3 mr-1" />
              Configure providers in Settings
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact version for inline use
export function LLMProviderSelectorCompact({
  value,
  onChange,
  className = "",
  disabled = false,
}: Omit<LLMProviderSelectorProps, "onManageClick" | "showManageButton" | "showStatus">) {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/llm-integrations?forSelection=true");
        const data = await response.json();
        if (data.success) {
          setProviders(data.data);
          if (!value && data.defaultId) {
            onChange(data.defaultId);
          }
        }
      } catch (error) {
        console.error("Error fetching providers:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProviders();
  }, [value, onChange]);

  const selectedProvider = providers.find((p) => p.id === value);

  if (providers.length === 0) {
    return (
      <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
        <AlertCircle className="h-3 w-3 mr-1" />
        No providers
      </Badge>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className={`w-auto min-w-[180px] h-8 ${className}`}>
        <SelectValue>
          {selectedProvider ? (
            <div className="flex items-center gap-1.5">
              <span>{PROVIDER_ICONS[selectedProvider.provider] || "🤖"}</span>
              <span className="text-sm">{selectedProvider.displayName}</span>
              {selectedProvider.isCurrentDefault && (
                <Star className="h-3 w-3 text-amber-500" />
              )}
            </div>
          ) : (
            "Select..."
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            <div className="flex items-center gap-2">
              <span>{PROVIDER_ICONS[provider.provider] || "🤖"}</span>
              <span>{provider.displayName}</span>
              {provider.isCurrentDefault && (
                <Star className="h-3 w-3 text-amber-500" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Hook for using LLM providers
export function useLLMProviders() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/llm-integrations?forSelection=true");
      const data = await response.json();
      if (data.success) {
        setProviders(data.data);
        setDefaultId(data.defaultId);
      } else {
        setError(data.error || "Failed to load providers");
      }
    } catch (err) {
      setError("Failed to load providers");
      console.error("Error fetching providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    providers,
    defaultId,
    isLoading,
    error,
    refetch: fetchProviders,
    getProvider: (id: string) => providers.find((p) => p.id === id),
    getDefaultProvider: () => providers.find((p) => p.id === defaultId),
  };
}
