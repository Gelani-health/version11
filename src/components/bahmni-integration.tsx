"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Link2,
  Activity,
  Clock,
  ArrowRightLeft,
  Users,
  FileText,
  Pill,
  Loader2,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Wallet,
  Landmark,
  Handshake,
  Receipt,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SyncStatus {
  module: string;
  status: "synced" | "syncing" | "error" | "pending";
  lastSync: string;
  recordCount: number;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

export function BahmniIntegration() {
  const [activeIntegration, setActiveIntegration] = useState<string>("bahmni");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);

  // Bahmni configuration state
  const [bahmniConfig, setBahmniConfig] = useState({
    bahmniUrl: "https://demo.bahmni.org",
    apiEndpoint: "/openmrs/ws/fhir2/R4",
    authType: "basic",
    username: "",
    password: "",
    apiKey: "",
    syncInterval: "15",
    syncEnabled: true,
  });

  // Odoo configuration state
  const [odooConfig, setOdooConfig] = useState({
    odooUrl: "https://your-company.odoo.com",
    database: "",
    authType: "api-key",
    username: "",
    password: "",
    apiKey: "",
    syncInterval: "30",
    syncEnabled: false,
  });

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState({
    bahmni: { connected: false, lastSync: null as string | null, error: null as string | null },
    odoo: { connected: false, lastSync: null as string | null, error: null as string | null },
  });

  const [bahmniSyncStatuses, setBahmniSyncStatuses] = useState<SyncStatus[]>([
    { module: "Patients", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Consultations", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Medications", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Lab Results", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Documents", status: "pending", lastSync: "Never", recordCount: 0 },
  ]);

  const [odooSyncStatuses, setOdooSyncStatuses] = useState<SyncStatus[]>([
    { module: "Payments", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Invoices", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "CRM", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Accounting", status: "pending", lastSync: "Never", recordCount: 0 },
    { module: "Sales", status: "pending", lastSync: "Never", recordCount: 0 },
  ]);

  // Fetch integration status on mount
  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetch("/api/integrations");
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus({
          bahmni: {
            connected: data.data.bahmni.connected,
            lastSync: data.data.bahmni.lastSync,
            error: data.data.bahmni.lastError,
          },
          odoo: {
            connected: data.data.odoo.connected,
            lastSync: data.data.odoo.lastSync,
            error: data.data.odoo.lastError,
          },
        });

        // Update config if exists
        if (data.data.bahmni.configured && data.data.bahmniConfig) {
          setBahmniConfig(prev => ({ ...prev, ...data.data.bahmniConfig }));
        }
        if (data.data.odoo.configured && data.data.odooConfig) {
          setOdooConfig(prev => ({ ...prev, ...data.data.odooConfig }));
        }
      }
    } catch (error) {
      console.error("Error fetching integration status:", error);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const config = activeIntegration === "bahmni" 
        ? { bahmniUrl: bahmniConfig.bahmniUrl, apiEndpoint: bahmniConfig.apiEndpoint, ...bahmniConfig }
        : { odooUrl: odooConfig.odooUrl, ...odooConfig };

      const response = await fetch("/api/integrations/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationType: activeIntegration,
          config,
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        setConnectionStatus(prev => ({
          ...prev,
          [activeIntegration]: { connected: true, lastSync: null, error: null },
        }));
      } else {
        setConnectionStatus(prev => ({
          ...prev,
          [activeIntegration]: { connected: false, lastSync: null, error: result.error },
        }));
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to test connection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);

    try {
      const config = activeIntegration === "bahmni" ? bahmniConfig : odooConfig;

      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationType: activeIntegration,
          config,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({
          success: true,
          message: "Configuration saved successfully",
        });
      } else {
        setTestResult({
          success: false,
          message: "Failed to save configuration",
          error: result.error,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to save configuration",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationType: activeIntegration,
          module: "all",
        }),
      });

      const result = await response.json();
      setSyncResult(result);

      if (result.success) {
        // Refresh status
        fetchIntegrationStatus();
      }
    } catch (error) {
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`/api/integrations?type=${activeIntegration}`, {
        method: "DELETE",
      });

      setConnectionStatus(prev => ({
        ...prev,
        [activeIntegration]: { connected: false, lastSync: null, error: null },
      }));

      setTestResult({
        success: true,
        message: "Disconnected successfully",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to disconnect",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "synced":
        return { color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle };
      case "syncing":
        return { color: "text-blue-600", bg: "bg-blue-100", icon: Loader2 };
      case "error":
        return { color: "text-red-600", bg: "bg-red-100", icon: XCircle };
      default:
        return { color: "text-amber-600", bg: "bg-amber-100", icon: Clock };
    }
  };

  const isActiveConnected = activeIntegration === "bahmni" 
    ? connectionStatus.bahmni.connected 
    : connectionStatus.odoo.connected;

  const syncStatuses = activeIntegration === "bahmni" ? bahmniSyncStatuses : odooSyncStatuses;
  const activeConfig = activeIntegration === "bahmni" ? bahmniConfig : odooConfig;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Link2 className="h-6 w-6 text-indigo-500" />
            Integration Modules
          </h2>
          <p className="text-slate-500">Connect and sync with external healthcare and business systems via API</p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Bahmni Card */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Card 
            className={`cursor-pointer border-0 shadow-md transition-all ${
              activeIntegration === "bahmni" ? "ring-2 ring-emerald-500 ring-offset-2" : ""
            }`}
            onClick={() => setActiveIntegration("bahmni")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-100">
                    <Database className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Bahmni HIS</h3>
                      {connectionStatus.bahmni.connected ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Hospital Information System - FHIR R4</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus.bahmni.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                }`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Patients</Badge>
                <Badge variant="outline" className="text-xs">Consultations</Badge>
                <Badge variant="outline" className="text-xs">Medications</Badge>
                <Badge variant="outline" className="text-xs">Lab Results</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Odoo Card */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Card 
            className={`cursor-pointer border-0 shadow-md transition-all ${
              activeIntegration === "odoo" ? "ring-2 ring-purple-500 ring-offset-2" : ""
            }`}
            onClick={() => setActiveIntegration("odoo")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-100">
                    <Landmark className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Odoo ERP</h3>
                      {connectionStatus.odoo.connected ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Business Management - Payments, CRM, Accounting</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus.odoo.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                }`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Payments</Badge>
                <Badge variant="outline" className="text-xs">Invoices</Badge>
                <Badge variant="outline" className="text-xs">CRM</Badge>
                <Badge variant="outline" className="text-xs">Accounting</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <Alert className={testResult.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle className={testResult.success ? "text-emerald-800" : "text-red-800"}>
            {testResult.success ? "Success" : "Error"}
          </AlertTitle>
          <AlertDescription className={testResult.success ? "text-emerald-700" : "text-red-700"}>
            {testResult.message}
            {testResult.details && (
              <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-auto">
                {JSON.stringify(testResult.details, null, 2)}
              </pre>
            )}
            {testResult.error && (
              <p className="mt-1 text-xs font-mono">{testResult.error}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Result */}
      {syncResult && (
        <Alert className={syncResult.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
          {syncResult.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle className={syncResult.success ? "text-emerald-800" : "text-red-800"}>
            Sync {syncResult.success ? "Complete" : "Failed"}
          </AlertTitle>
          <AlertDescription>
            {syncResult.success && syncResult.data && (
              <div className="text-sm">
                <p>Records synced: {syncResult.data.recordsSynced}</p>
                <p>Duration: {syncResult.data.duration}ms</p>
              </div>
            )}
            {syncResult.error && <p className="text-xs font-mono">{syncResult.error}</p>}
          </AlertDescription>
        </Alert>
      )}

      {/* Active Integration Status Card */}
      <Card className={`border-0 shadow-md ${isActiveConnected ? "bg-emerald-50" : "bg-slate-50"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${activeIntegration === "bahmni" ? "bg-emerald-100" : "bg-purple-100"}`}>
                {activeIntegration === "bahmni" ? (
                  <Database className="h-8 w-8 text-emerald-600" />
                ) : (
                  <Landmark className="h-8 w-8 text-purple-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {isActiveConnected 
                    ? `Connected to ${activeIntegration === "bahmni" ? "Bahmni HIS" : "Odoo ERP"}` 
                    : `${activeIntegration === "bahmni" ? "Bahmni HIS" : "Odoo ERP"} - Connection Required`}
                </h3>
                <p className="text-sm text-slate-500">
                  {activeIntegration === "bahmni" ? bahmniConfig.bahmniUrl : odooConfig.odooUrl}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActiveConnected && (
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              )}
              <Button
                onClick={handleSync}
                disabled={!isActiveConnected || isSyncing}
                className={activeIntegration === "bahmni" 
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                  : "bg-gradient-to-r from-purple-500 to-indigo-500"
                }
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6 mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Connection Settings</CardTitle>
              <CardDescription>
                Configure {activeIntegration === "bahmni" ? "Bahmni HIS" : "Odoo ERP"} server connection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Server URL */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">Server URL</Label>
                  <Input
                    id="serverUrl"
                    value={activeIntegration === "bahmni" ? bahmniConfig.bahmniUrl : odooConfig.odooUrl}
                    onChange={(e) => activeIntegration === "bahmni" 
                      ? setBahmniConfig({ ...bahmniConfig, bahmniUrl: e.target.value })
                      : setOdooConfig({ ...odooConfig, odooUrl: e.target.value })
                    }
                    placeholder={activeIntegration === "bahmni" 
                      ? "https://demo.bahmni.org" 
                      : "https://your-company.odoo.com"
                    }
                  />
                </div>
                {activeIntegration === "bahmni" ? (
                  <div className="space-y-2">
                    <Label htmlFor="apiEndpoint">FHIR API Endpoint</Label>
                    <Input
                      id="apiEndpoint"
                      value={bahmniConfig.apiEndpoint}
                      onChange={(e) => setBahmniConfig({ ...bahmniConfig, apiEndpoint: e.target.value })}
                      placeholder="/openmrs/ws/fhir2/R4"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      value={odooConfig.database}
                      onChange={(e) => setOdooConfig({ ...odooConfig, database: e.target.value })}
                      placeholder="your_database_name"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Authentication */}
              <div>
                <h4 className="font-medium mb-4">Authentication</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Authentication Type</Label>
                    <Select
                      value={activeIntegration === "bahmni" ? bahmniConfig.authType : odooConfig.authType}
                      onValueChange={(value) => activeIntegration === "bahmni"
                        ? setBahmniConfig({ ...bahmniConfig, authType: value })
                        : setOdooConfig({ ...odooConfig, authType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic Auth (Username/Password)</SelectItem>
                        <SelectItem value="api-key">API Key / Token</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sync Interval</Label>
                    <Select
                      value={activeIntegration === "bahmni" ? bahmniConfig.syncInterval : odooConfig.syncInterval}
                      onValueChange={(value) => activeIntegration === "bahmni"
                        ? setBahmniConfig({ ...bahmniConfig, syncInterval: value })
                        : setOdooConfig({ ...odooConfig, syncInterval: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(activeIntegration === "bahmni" ? bahmniConfig.authType : odooConfig.authType) === "basic" ? (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={activeIntegration === "bahmni" ? bahmniConfig.username : odooConfig.username}
                        onChange={(e) => activeIntegration === "bahmni"
                          ? setBahmniConfig({ ...bahmniConfig, username: e.target.value })
                          : setOdooConfig({ ...odooConfig, username: e.target.value })
                        }
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={activeIntegration === "bahmni" ? bahmniConfig.password : odooConfig.password}
                        onChange={(e) => activeIntegration === "bahmni"
                          ? setBahmniConfig({ ...bahmniConfig, password: e.target.value })
                          : setOdooConfig({ ...odooConfig, password: e.target.value })
                        }
                        placeholder="Enter password"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="apiKey">API Key / Token</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={activeIntegration === "bahmni" ? bahmniConfig.apiKey : odooConfig.apiKey}
                      onChange={(e) => activeIntegration === "bahmni"
                        ? setBahmniConfig({ ...bahmniConfig, apiKey: e.target.value })
                        : setOdooConfig({ ...odooConfig, apiKey: e.target.value })
                      }
                      placeholder="Enter your API key"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto Sync</h4>
                  <p className="text-sm text-slate-500">Automatically sync data at regular intervals</p>
                </div>
                <Switch
                  checked={activeIntegration === "bahmni" ? bahmniConfig.syncEnabled : odooConfig.syncEnabled}
                  onCheckedChange={(checked) => activeIntegration === "bahmni"
                    ? setBahmniConfig({ ...bahmniConfig, syncEnabled: checked })
                    : setOdooConfig({ ...odooConfig, syncEnabled: checked })
                  }
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button 
                  onClick={handleSaveConfig} 
                  disabled={isSaving}
                  className={activeIntegration === "bahmni" 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                    : "bg-gradient-to-r from-purple-500 to-indigo-500"
                  }
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connection Instructions */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                How to Connect
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeIntegration === "bahmni" ? (
                <div className="space-y-3 text-sm text-slate-600">
                  <p><strong>For Bahmni HIS:</strong></p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Enter your Bahmni server URL (e.g., https://your-bahmni.org)</li>
                    <li>The FHIR endpoint is typically <code className="bg-slate-100 px-1 rounded">/openmrs/ws/fhir2/R4</code></li>
                    <li>Use Basic Auth with your Bahmni/OpenMRS username and password</li>
                    <li>Click "Test Connection" to verify connectivity</li>
                    <li>If successful, click "Save Configuration" to store credentials</li>
                  </ol>
                  <p className="text-xs text-slate-500 mt-4">
                    Note: Ensure your Bahmni server has FHIR R4 module enabled and allows CORS requests from this application.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-600">
                  <p><strong>For Odoo ERP:</strong></p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Enter your Odoo server URL (e.g., https://your-company.odoo.com)</li>
                    <li>Enter your Odoo database name</li>
                    <li>Use your Odoo username and password (or API key)</li>
                    <li>Click "Test Connection" to verify connectivity</li>
                    <li>If successful, click "Save Configuration" to store credentials</li>
                  </ol>
                  <p className="text-xs text-slate-500 mt-4">
                    Note: Ensure XML-RPC/JSON-RPC is enabled on your Odoo instance. For Odoo Online, you may need to enable API access in settings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Status Tab */}
        <TabsContent value="sync" className="space-y-6 mt-6">
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { label: "Total Records", value: isActiveConnected ? "Loading..." : "0", icon: Database },
              { label: "Last Sync", value: connectionStatus[activeIntegration].lastSync || "Never", icon: Clock },
              { label: "Sync Errors", value: connectionStatus[activeIntegration].error ? "1" : "0", icon: AlertTriangle },
              { label: "Auto Sync", value: activeConfig.syncEnabled ? `Every ${activeConfig.syncInterval} min` : "Disabled", icon: Activity },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i} className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${activeIntegration === "bahmni" ? "bg-emerald-100" : "bg-purple-100"}`}>
                        <Icon className={`h-5 w-5 ${activeIntegration === "bahmni" ? "text-emerald-600" : "text-purple-600"}`} />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{stat.label}</p>
                        <p className="text-lg font-semibold">{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Module Sync Status</CardTitle>
              <CardDescription>Status of each module integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncStatuses.map((item, i) => {
                  const styles = getStatusStyles(item.status);
                  const StatusIcon = styles.icon;
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${styles.bg}`}>
                          <StatusIcon className={`h-5 w-5 ${styles.color} ${item.status === "syncing" ? "animate-spin" : ""}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">{item.module}</h4>
                          <p className="text-sm text-slate-500">
                            {item.recordCount.toLocaleString()} records • Last sync: {item.lastSync}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={styles.bg}>
                        {item.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6 mt-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">{activeIntegration === "bahmni" ? "Bahmni HIS" : "Odoo ERP"} Features</CardTitle>
              <CardDescription>Available integration features and capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              {activeIntegration === "bahmni" ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "Patient Management", icon: Users, description: "Patient demographics and records" },
                    { name: "Clinical Data", icon: FileText, description: "Consultations and diagnoses" },
                    { name: "Medications", icon: Pill, description: "Prescriptions and drug orders" },
                    { name: "Lab Results", icon: Activity, description: "Laboratory test results" },
                  ].map((feature, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-emerald-100">
                          <feature.icon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <h4 className="font-medium">{feature.name}</h4>
                      </div>
                      <p className="text-sm text-slate-500">{feature.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "Payment Processing", icon: CreditCard, description: "Process patient payments" },
                    { name: "CRM", icon: Handshake, description: "Customer relationship management" },
                    { name: "Accounting", icon: BarChart3, description: "Full company accounting" },
                    { name: "Invoicing", icon: Receipt, description: "Generate and manage invoices" },
                    { name: "Sales", icon: ShoppingCart, description: "Sales orders and tracking" },
                    { name: "Banking", icon: Wallet, description: "Bank reconciliation" },
                  ].map((feature, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-purple-100">
                          <feature.icon className="h-5 w-5 text-purple-600" />
                        </div>
                        <h4 className="font-medium">{feature.name}</h4>
                      </div>
                      <p className="text-sm text-slate-500">{feature.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Info */}
          {activeIntegration === "bahmni" && (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">FHIR Resource Mapping</CardTitle>
                <CardDescription>How data maps between AI Healthcare and Bahmni FHIR resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { aiModule: "Patient", fhirResource: "Patient", description: "Patient demographics" },
                    { aiModule: "Consultation", fhirResource: "Encounter", description: "Clinical encounters" },
                    { aiModule: "Diagnosis", fhirResource: "Condition", description: "Conditions and diagnoses" },
                    { aiModule: "Medication", fhirResource: "MedicationRequest", description: "Prescriptions" },
                  ].map((mapping, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="flex-1 text-right">
                        <Badge variant="outline" className="text-sm">{mapping.aiModule}</Badge>
                      </div>
                      <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                      <div className="flex-1">
                        <Badge className="bg-emerald-100 text-emerald-700">{mapping.fhirResource}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 flex-1">{mapping.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
