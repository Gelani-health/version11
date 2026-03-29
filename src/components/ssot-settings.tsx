"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Brain,
  Database,
  Globe,
  Shield,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Zap,
  Server,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// Types
interface SystemSettings {
  // LLM
  llmProvider: string;
  llmModel: string;
  llmSecondaryModel?: string;
  llmTemperature: number;
  llmMaxTokens: number;
  llmTopP: number;
  llmEnableStreaming: boolean;
  // RAG
  ragEnabled: boolean;
  ragDefaultService: string;
  ragTopK: number;
  ragMinScore: number;
  ragEmbeddingModel: string;
  ragEmbeddingDimension: number;
  ragEnableHybridSearch: boolean;
  ragEnableReranking: boolean;
  ragCacheEnabled: boolean;
  ragCacheTTLSeconds: number;
  // ERP
  erpEnabled: boolean;
  erpProvider?: string;
  erpUrl?: string;
  erpDatabase?: string;
  erpUsername?: string;
  erpSyncPatients: boolean;
  erpSyncInvoices: boolean;
  erpSyncPayments: boolean;
  erpSyncInventory: boolean;
  erpSyncIntervalMinutes: number;
  erpConnectionStatus: string;
  erpLastError?: string;
  // Clinical AI
  enableClinicalDecisionSupport: boolean;
  enableDrugInteractionCheck: boolean;
  enableImageAnalysis: boolean;
  enableVoiceTranscription: boolean;
  enableDifferentialDiagnosis: boolean;
  enableBayesianReasoning: boolean;
  enableICDCodeSuggestion: boolean;
  // Safety
  requireHumanReview: boolean;
  logAllInteractions: boolean;
  safetyAlertThreshold: number;
  hipaaComplianceMode: boolean;
  auditRetentionDays: number;
  // Features
  enableExperimentalFeatures: boolean;
  enableBetaModels: boolean;
}

interface LLMProvider {
  name: string;
  models: string[];
  requiresApiKey: boolean;
  description: string;
}

interface SettingsResponse {
  success: boolean;
  data: SystemSettings;
  providers: Record<string, LLMProvider>;
}

export function SSOTSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [providers, setProviders] = useState<Record<string, LLMProvider>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [testingERP, setTestingERP] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("llm");

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings");
      const data: SettingsResponse = await response.json();

      if (data.success) {
        setSettings(data.data);
        setProviders(data.providers || {});
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Settings Saved",
          description: `Updated ${data.changes?.length || 0} settings`,
        });
        setHasChanges(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testLLMConnection = async () => {
    try {
      setTestingLLM(true);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testType: "llm" }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "LLM Connection Successful",
          description: `Response time: ${data.responseTime}ms`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "LLM Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingLLM(false);
    }
  };

  const testERPConnection = async () => {
    try {
      setTestingERP(true);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testType: "erp" }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "ERP Connection Successful",
          description: `Connected to ${settings?.erpUrl}`,
        });
        // Refresh settings to get updated connection status
        fetchSettings();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "ERP Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingERP(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "disconnected":
        return "bg-slate-400";
      default:
        return "bg-amber-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load settings
      </div>
    );
  }

  const currentProvider = providers[settings.llmProvider];
  const currentModels = currentProvider?.models || [];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with Save Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">System Configuration</h2>
            <p className="text-sm text-slate-500">Single Source of Truth for all system settings</p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                Unsaved Changes
              </Badge>
            )}
            <Button
              onClick={saveSettings}
              disabled={!hasChanges || isSaving}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LLM Model
            </TabsTrigger>
            <TabsTrigger value="rag" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              RAG Config
            </TabsTrigger>
            <TabsTrigger value="erp" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              ERP Integration
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              AI Features
            </TabsTrigger>
          </TabsList>

          {/* LLM Settings Tab */}
          <TabsContent value="llm" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  LLM Provider & Model Selection
                </CardTitle>
                <CardDescription>
                  Choose the AI model that powers all clinical decision support features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">AI Provider</Label>
                  <Select
                    value={settings.llmProvider}
                    onValueChange={(value) => {
                      updateSetting("llmProvider", value);
                      // Set default model for provider
                      const providerModels = providers[value]?.models || [];
                      if (providerModels.length > 0) {
                        updateSetting("llmModel", providerModels[0]);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(providers).map(([key, provider]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            <span className="text-xs text-slate-500">
                              ({provider.models.length} models)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentProvider && (
                    <p className="text-sm text-slate-500">{currentProvider.description}</p>
                  )}
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Model</Label>
                  <Select
                    value={settings.llmModel}
                    onValueChange={(value) => updateSetting("llmModel", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          <div className="flex items-center gap-2">
                            {model === settings.llmModel && (
                              <Check className="h-4 w-4 text-emerald-500" />
                            )}
                            <span>{model}</span>
                            {model === "glm-4-flash" && (
                              <Badge variant="secondary" className="text-xs">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm text-slate-500">{settings.llmTemperature}</span>
                    </div>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.llmTemperature}
                      onChange={(e) => updateSetting("llmTemperature", parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Lower = more precise, Higher = more creative
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Tokens</Label>
                      <span className="text-sm text-slate-500">{settings.llmMaxTokens}</span>
                    </div>
                    <Input
                      type="number"
                      value={settings.llmMaxTokens}
                      onChange={(e) => updateSetting("llmMaxTokens", parseInt(e.target.value))}
                      min={256}
                      max={8192}
                    />
                    <p className="text-xs text-slate-500">
                      Maximum response length
                    </p>
                  </div>
                </div>

                {/* Streaming Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Enable Streaming</Label>
                    <p className="text-sm text-slate-500">
                      Stream responses for faster perceived performance
                    </p>
                  </div>
                  <Switch
                    checked={settings.llmEnableStreaming}
                    onCheckedChange={(checked) => updateSetting("llmEnableStreaming", checked)}
                  />
                </div>

                {/* Test Connection */}
                <Button
                  variant="outline"
                  onClick={testLLMConnection}
                  disabled={testingLLM}
                  className="w-full"
                >
                  {testingLLM ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing LLM Connection...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test LLM Connection
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RAG Settings Tab */}
          <TabsContent value="rag" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  RAG Configuration
                </CardTitle>
                <CardDescription>
                  Configure Retrieval-Augmented Generation settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* RAG Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Enable RAG</Label>
                    <p className="text-sm text-slate-500">
                      Use RAG for enhanced clinical decision support
                    </p>
                  </div>
                  <Switch
                    checked={settings.ragEnabled}
                    onCheckedChange={(checked) => updateSetting("ragEnabled", checked)}
                  />
                </div>

                {settings.ragEnabled && (
                  <>
                    {/* Default RAG Service */}
                    <div className="space-y-2">
                      <Label className="font-medium">Default RAG Service</Label>
                      <Select
                        value={settings.ragDefaultService}
                        onValueChange={(value) => updateSetting("ragDefaultService", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select RAG service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medical-rag">Medical RAG (PubMed/PMC)</SelectItem>
                          <SelectItem value="langchain-rag">LangChain RAG (Knowledge Base)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Retrieval Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Top K Results</Label>
                        <Input
                          type="number"
                          value={settings.ragTopK}
                          onChange={(e) => updateSetting("ragTopK", parseInt(e.target.value))}
                          min={1}
                          max={100}
                        />
                        <p className="text-xs text-slate-500">
                          Number of documents to retrieve
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Minimum Score</Label>
                        <Input
                          type="number"
                          value={settings.ragMinScore}
                          onChange={(e) => updateSetting("ragMinScore", parseFloat(e.target.value))}
                          min={0}
                          max={1}
                          step={0.1}
                        />
                        <p className="text-xs text-slate-500">
                          Minimum relevance score (0-1)
                        </p>
                      </div>
                    </div>

                    {/* RAG Features */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-slate-700">RAG Features</h4>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <Label>Hybrid Search</Label>
                          <p className="text-xs text-slate-500">Combine semantic + keyword search</p>
                        </div>
                        <Switch
                          checked={settings.ragEnableHybridSearch}
                          onCheckedChange={(checked) => updateSetting("ragEnableHybridSearch", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <Label>Reranking</Label>
                          <p className="text-xs text-slate-500">Re-rank results for better relevance</p>
                        </div>
                        <Switch
                          checked={settings.ragEnableReranking}
                          onCheckedChange={(checked) => updateSetting("ragEnableReranking", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <Label>Cache Results</Label>
                          <p className="text-xs text-slate-500">Cache queries for faster responses</p>
                        </div>
                        <Switch
                          checked={settings.ragCacheEnabled}
                          onCheckedChange={(checked) => updateSetting("ragCacheEnabled", checked)}
                        />
                      </div>

                      {settings.ragCacheEnabled && (
                        <div className="space-y-2 ml-4">
                          <Label>Cache TTL (seconds)</Label>
                          <Input
                            type="number"
                            value={settings.ragCacheTTLSeconds}
                            onChange={(e) => updateSetting("ragCacheTTLSeconds", parseInt(e.target.value))}
                            min={60}
                            max={86400}
                          />
                        </div>
                      )}
                    </div>

                    {/* Embedding Settings */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Embedding Model</Label>
                        <Input
                          value={settings.ragEmbeddingModel}
                          onChange={(e) => updateSetting("ragEmbeddingModel", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Embedding Dimension</Label>
                        <Input
                          type="number"
                          value={settings.ragEmbeddingDimension}
                          onChange={(e) => updateSetting("ragEmbeddingDimension", parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ERP Integration Tab */}
          <TabsContent value="erp" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-500" />
                  ERP Integration (Odoo)
                </CardTitle>
                <CardDescription>
                  Connect to ERP systems for patient, billing, and inventory sync
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ERP Enable Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Enable ERP Integration</Label>
                    <p className="text-sm text-slate-500">
                      Connect to Odoo or other ERP systems
                    </p>
                  </div>
                  <Switch
                    checked={settings.erpEnabled}
                    onCheckedChange={(checked) => updateSetting("erpEnabled", checked)}
                  />
                </div>

                {settings.erpEnabled && (
                  <>
                    {/* Connection Status */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(settings.erpConnectionStatus)}`} />
                      <span className="font-medium capitalize">{settings.erpConnectionStatus}</span>
                      {settings.erpLastError && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{settings.erpLastError}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* ERP Provider */}
                    <div className="space-y-2">
                      <Label>ERP Provider</Label>
                      <Select
                        value={settings.erpProvider || ""}
                        onValueChange={(value) => updateSetting("erpProvider", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select ERP provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="odoo">Odoo</SelectItem>
                          <SelectItem value="sap">SAP</SelectItem>
                          <SelectItem value="dynamics">Microsoft Dynamics</SelectItem>
                          <SelectItem value="custom">Custom ERP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Connection Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ERP URL</Label>
                        <Input
                          placeholder="https://erp.example.com"
                          value={settings.erpUrl || ""}
                          onChange={(e) => updateSetting("erpUrl", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Database Name</Label>
                        <Input
                          placeholder="production"
                          value={settings.erpDatabase || ""}
                          onChange={(e) => updateSetting("erpDatabase", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        placeholder="api_user"
                        value={settings.erpUsername || ""}
                        onChange={(e) => updateSetting("erpUsername", e.target.value)}
                      />
                    </div>

                    {/* Sync Settings */}
                    <Separator />
                    <h4 className="font-medium">Sync Settings</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Sync Patients</Label>
                        <Switch
                          checked={settings.erpSyncPatients}
                          onCheckedChange={(checked) => updateSetting("erpSyncPatients", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Sync Invoices</Label>
                        <Switch
                          checked={settings.erpSyncInvoices}
                          onCheckedChange={(checked) => updateSetting("erpSyncInvoices", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Sync Payments</Label>
                        <Switch
                          checked={settings.erpSyncPayments}
                          onCheckedChange={(checked) => updateSetting("erpSyncPayments", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <Label>Sync Inventory</Label>
                        <Switch
                          checked={settings.erpSyncInventory}
                          onCheckedChange={(checked) => updateSetting("erpSyncInventory", checked)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Sync Interval (minutes)</Label>
                      <Input
                        type="number"
                        value={settings.erpSyncIntervalMinutes}
                        onChange={(e) => updateSetting("erpSyncIntervalMinutes", parseInt(e.target.value))}
                        min={5}
                        max={1440}
                      />
                    </div>

                    {/* Test ERP Connection */}
                    <Button
                      variant="outline"
                      onClick={testERPConnection}
                      disabled={testingERP || !settings.erpUrl}
                      className="w-full"
                    >
                      {testingERP ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing ERP Connection...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4 mr-2" />
                          Test ERP Connection
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Features Tab */}
          <TabsContent value="features" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  AI Features Configuration
                </CardTitle>
                <CardDescription>
                  Enable or disable AI-powered clinical features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Clinical AI Features */}
                {[
                  { key: "enableClinicalDecisionSupport", label: "Clinical Decision Support", desc: "AI-powered diagnosis suggestions and clinical reasoning" },
                  { key: "enableDrugInteractionCheck", label: "Drug Interaction Checker", desc: "Real-time drug-drug and drug-allergy interaction alerts" },
                  { key: "enableImageAnalysis", label: "Medical Image Analysis", desc: "AI analysis of X-rays, CT scans, and other medical images" },
                  { key: "enableVoiceTranscription", label: "Voice Transcription", desc: "Convert speech to text for clinical documentation" },
                  { key: "enableDifferentialDiagnosis", label: "Differential Diagnosis", desc: "Generate and rank differential diagnoses" },
                  { key: "enableBayesianReasoning", label: "Bayesian Reasoning", desc: "Probabilistic clinical reasoning engine" },
                  { key: "enableICDCodeSuggestion", label: "ICD Code Suggestion", desc: "Auto-suggest ICD-10 codes from clinical notes" },
                ].map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <Label className="font-medium">{feature.label}</Label>
                      <p className="text-sm text-slate-500">{feature.desc}</p>
                    </div>
                    <Switch
                      checked={settings[feature.key as keyof SystemSettings] as boolean}
                      onCheckedChange={(checked) =>
                        updateSetting(feature.key as keyof SystemSettings, checked)
                      }
                    />
                  </div>
                ))}

                <Separator />

                {/* Safety Settings */}
                <h4 className="font-medium text-slate-700">Safety & Compliance</h4>
                
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <Label className="font-medium text-amber-800">Require Human Review</Label>
                    <p className="text-sm text-amber-700">All AI suggestions must be reviewed by healthcare professional</p>
                  </div>
                  <Switch
                    checked={settings.requireHumanReview}
                    onCheckedChange={(checked) => updateSetting("requireHumanReview", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">HIPAA Compliance Mode</Label>
                    <p className="text-sm text-slate-500">Enforce strict audit logging and data handling</p>
                  </div>
                  <Switch
                    checked={settings.hipaaComplianceMode}
                    onCheckedChange={(checked) => updateSetting("hipaaComplianceMode", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Log All AI Interactions</Label>
                    <p className="text-sm text-slate-500">Record all AI requests and responses for audit</p>
                  </div>
                  <Switch
                    checked={settings.logAllInteractions}
                    onCheckedChange={(checked) => updateSetting("logAllInteractions", checked)}
                  />
                </div>

                <Separator />

                {/* Feature Flags */}
                <h4 className="font-medium text-slate-700">Feature Flags</h4>
                
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <Label className="font-medium text-purple-800">Experimental Features</Label>
                    <p className="text-sm text-purple-700">Enable beta and experimental AI features</p>
                  </div>
                  <Switch
                    checked={settings.enableExperimentalFeatures}
                    onCheckedChange={(checked) => updateSetting("enableExperimentalFeatures", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
