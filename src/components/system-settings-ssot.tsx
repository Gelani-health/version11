/**
 * Comprehensive System Settings - SSOT Configuration
 * 
 * This module provides a unified settings interface for:
 * - LLM Model selection (Single Source of Truth)
 * - RAG Service configuration
 * - ERP/Integration connections (Odoo, Bahmni, etc.)
 * 
 * Medical-grade Clinical Decision Support System configuration
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings,
  Brain,
  Database,
  Link2,
  RefreshCw,
  Check,
  AlertCircle,
  Server,
  Globe,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { LLMIntegrationsSettings } from "./llm/llm-integrations-settings";
import { RAGSettings } from "./rag-settings";
import { RolePermissionManager } from "./role-permission-manager";

interface SystemStatus {
  ragServices: {
    total: number;
    connected: number;
    default: string | null;
  };
  llmProviders: {
    total: number;
    connected: number;
    default: string | null;
  };
  integrations: {
    bahmni: boolean;
    odoo: boolean;
    fhir: boolean;
  };
}

export function SystemSettingsSSOT() {
  const [status, setStatus] = useState<SystemStatus>({
    ragServices: { total: 0, connected: 0, default: null },
    llmProviders: { total: 0, connected: 0, default: null },
    integrations: { bahmni: false, odoo: false, fhir: true },
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSystemStatus = useCallback(async () => {
    try {
      // Fetch RAG services
      const ragResponse = await fetch("/api/rag-config?checkHealth=true");
      const ragData = await ragResponse.json();
      
      // Fetch LLM integrations
      const llmResponse = await fetch("/api/llm-integrations");
      const llmData = await llmResponse.json();

      setStatus({
        ragServices: {
          total: ragData.data?.length || 0,
          connected: ragData.data?.filter((s: any) => s.connectionStatus === "connected").length || 0,
          default: ragData.defaultService || null,
        },
        llmProviders: {
          total: llmData.data?.length || 0,
          connected: llmData.data?.filter((i: any) => i.connectionStatus === "connected").length || 0,
          default: llmData.data?.find((i: any) => i.isDefault)?.displayName || null,
        },
        integrations: {
          bahmni: false,
          odoo: false,
          fhir: true,
        },
      });
    } catch (error) {
      console.error("Error fetching system status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchSystemStatus();
    toast({
      title: "Refreshed",
      description: "System status updated",
    });
  };

  return (
    <div className="space-y-6">
      {/* System Overview Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                System Configuration Status
              </CardTitle>
              <CardDescription>
                Single Source of Truth (SSOT) for all AI and integration settings
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {/* RAG Status */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="font-medium">RAG Services</span>
              </div>
              <div className="text-2xl font-bold">
                {status.ragServices.connected}/{status.ragServices.total}
              </div>
              <div className="text-xs text-muted-foreground">Connected</div>
              {status.ragServices.default && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {status.ragServices.default}
                </Badge>
              )}
            </div>

            {/* LLM Status */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="font-medium">AI Models</span>
              </div>
              <div className="text-2xl font-bold">
                {status.llmProviders.total}
              </div>
              <div className="text-xs text-muted-foreground">Configured</div>
              {status.llmProviders.default && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {status.llmProviders.default}
                </Badge>
              )}
            </div>

            {/* Integrations Status */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Integrations</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    status.integrations.fhir ? "bg-green-500" : "bg-gray-400"
                  )} />
                  <span>FHIR R4</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    status.integrations.bahmni ? "bg-green-500" : "bg-gray-400"
                  )} />
                  <span>Bahmni/OpenMRS</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    status.integrations.odoo ? "bg-green-500" : "bg-gray-400"
                  )} />
                  <span>Odoo ERP</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Tabs */}
      <Tabs defaultValue="llm" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="llm" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Models
          </TabsTrigger>
          <TabsTrigger value="rag" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            RAG Services
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="llm">
          <LLMIntegrationsSettings />
        </TabsContent>

        <TabsContent value="rag">
          <RAGSettings />
        </TabsContent>

        <TabsContent value="permissions">
          <RolePermissionManager />
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                External System Integrations
              </CardTitle>
              <CardDescription>
                Configure connections to external healthcare systems and ERPs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* FHIR Integration */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Activity className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">FHIR R4 API</h4>
                      <p className="text-sm text-muted-foreground">
                        Healthcare interoperability standard
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500">Active</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>FHIR R4 endpoints are available for external system integration.</p>
                  <p className="mt-1 font-mono text-xs">Endpoints: /api/fhir/*</p>
                </div>
              </div>

              {/* Bahmni Integration */}
              <div className="p-4 border rounded-lg opacity-60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Server className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Bahmni/OpenMRS</h4>
                      <p className="text-sm text-muted-foreground">
                        Open source EMR integration
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Integration with Bahmni EMR for patient data synchronization.</p>
                </div>
              </div>

              {/* Odoo Integration */}
              <div className="p-4 border rounded-lg opacity-60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Zap className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Odoo ERP</h4>
                      <p className="text-sm text-muted-foreground">
                        Enterprise resource planning
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Connect with Odoo for billing, inventory, and patient management.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SystemSettingsSSOT;
