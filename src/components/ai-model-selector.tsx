"use client";

import { useEffect, useState } from "react";
import { Brain, AlertCircle, Check, Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LLMIntegration {
  id: string;
  displayName: string;
  provider: string;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
}

export function AIModelSelector() {
  const [models, setModels] = useState<LLMIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/llm-integrations");
        const data = await response.json();

        if (data.success && data.data) {
          setModels(data.data.filter((i: LLMIntegration) => i.isActive));
        }
      } catch (error) {
        console.error("Error fetching AI models:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleSetDefault = async (id: string) => {
    setSettingDefault(id);
    try {
      const response = await fetch("/api/llm-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Default model updated");
        // Update local state
        setModels((prev) =>
          prev.map((m) => ({
            ...m,
            isDefault: m.id === id,
          }))
        );
      } else {
        toast.error(data.error || "Failed to set default");
      }
    } catch (error) {
      console.error("Error setting default:", error);
      toast.error("Failed to set default model");
    } finally {
      setSettingDefault(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-slate-500">Loading AI models...</span>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No AI models configured</span>
        </div>
        <p className="text-xs text-slate-500">
          Go to LLM Providers tab to configure your AI models.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {models.map((model) => {
        const isConnected = model.connectionStatus === "connected";
        return (
          <Badge
            key={model.id}
            variant={model.isDefault ? "default" : "outline"}
            className={`cursor-pointer transition-all ${
              model.isDefault
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "hover:bg-slate-100"
            } ${!isConnected ? "opacity-60" : ""}`}
            onClick={() => {
              if (!model.isDefault && settingDefault === null) {
                handleSetDefault(model.id);
              }
            }}
          >
            {settingDefault === model.id ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : model.isDefault ? (
              <Star className="h-3 w-3 mr-1" />
            ) : (
              <Brain className="h-3 w-3 mr-1" />
            )}
            {model.displayName || model.model}
            {model.isDefault && " (Active)"}
            {isConnected && model.isDefault && (
              <Check className="h-3 w-3 ml-1" />
            )}
          </Badge>
        );
      })}
    </div>
  );
}
