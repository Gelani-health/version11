"use client";

import { useEffect, useState } from "react";
import { Brain, AlertCircle } from "lucide-react";

interface LLMIntegration {
  id: string;
  displayName: string;
  provider: string;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
}

export function AIModelFooter() {
  const [defaultModel, setDefaultModel] = useState<LLMIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDefaultModel = async () => {
      try {
        const response = await fetch("/api/llm-integrations");
        const data = await response.json();

        if (data.success && data.data) {
          // Find the default model, or the first active model
          const defaultInt = data.data.find(
            (i: LLMIntegration) => i.isDefault && i.isActive
          );
          const firstActive = data.data.find(
            (i: LLMIntegration) => i.isActive
          );
          setDefaultModel(defaultInt || firstActive || null);
        }
      } catch (error) {
        console.error("Error fetching AI model:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaultModel();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Brain className="h-3 w-3 animate-pulse" />
        <span>Loading AI Model...</span>
      </div>
    );
  }

  if (!defaultModel) {
    return (
      <div className="flex items-center gap-2 text-amber-600">
        <AlertCircle className="h-3 w-3" />
        <span>No AI Model Configured</span>
      </div>
    );
  }

  const isConnected = defaultModel.connectionStatus === "connected";

  return (
    <div className="flex items-center gap-2">
      <Brain className="h-3 w-3" />
      <span>AI Model: {defaultModel.displayName || defaultModel.model}</span>
      <span
        className={`w-2 h-2 rounded-full ${
          isConnected ? "bg-emerald-500" : "bg-amber-500"
        }`}
        title={isConnected ? "Connected" : "Not connected"}
      />
    </div>
  );
}
