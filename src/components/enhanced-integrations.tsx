"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  Clock,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Activity,
  Server,
  Link2,
  Unlink,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Shield,
  Zap,
  Globe,
  FileJson,
  Calendar,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  Search,
  Filter,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Types
interface SyncStatus {
  lastSync: Date | null;
  status: "connected" | "disconnected" | "syncing" | "error";
  recordsSynced: number;
  errors: string[];
  nextSync: Date | null;
}

interface SyncModule {
  id: string;
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  direction: "inbound" | "outbound" | "bidirectional";
  lastSync: Date | null;
  recordCount: number;
  status: "synced" | "pending" | "error";
  mapping: FieldMapping[];
}

interface FieldMapping {
  localField: string;
  remoteField: string;
  transform?: string;
}

interface IntegrationConfig {
  id: string;
  name: string;
  type: "bahmni" | "odoo" | "fhir" | "custom";
  url: string;
  authType: "basic" | "api-key" | "oauth2" | "none";
  username?: string;
  password?: string;
  apiKey?: string;
  accessToken?: string;
  modules: SyncModule[];
  syncInterval: number;
  autoSync: boolean;
  status: SyncStatus;
}

export function EnhancedIntegrations() {
  const [activeTab, setActiveTab] = useState("bahmni");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState<SyncModule | null>(null);
  const [syncLogs, setSyncLogs] = useState<{ timestamp: Date; message: string; type: "info" | "success" | "error" }[]>([]);

  // Bahmni Integration State
  const [bahmniConfig, setBahmniConfig] = useState<IntegrationConfig>({
    id: "bahmni-1",
    name: "Bahmni HIS",
    type: "bahmni",
    url: "https://bahmni.example.com",
    authType: "basic",
    username: "admin",
    password: "••••••••",
    syncInterval: 5,
    autoSync: true,
    status: {
      lastSync: new Date(Date.now() - 300000),
      status: "connected",
      recordsSynced: 1247,
      errors: [],
      nextSync: new Date(Date.now() + 300000),
    },
    modules: [
      { id: "patients", name: "Patient Records", icon: Users, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 300000), recordCount: 847, status: "synced", mapping: [] },
      { id: "consultations", name: "Consultations", icon: Activity, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 600000), recordCount: 1234, status: "synced", mapping: [] },
      { id: "lab-orders", name: "Lab Orders", icon: Package, enabled: true, direction: "outbound", lastSync: new Date(Date.now() - 900000), recordCount: 567, status: "pending", mapping: [] },
      { id: "prescriptions", name: "Prescriptions", icon: CreditCard, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 1200000), recordCount: 2341, status: "synced", mapping: [] },
      { id: "appointments", name: "Appointments", icon: Calendar, enabled: true, direction: "inbound", lastSync: new Date(Date.now() - 180000), recordCount: 156, status: "synced", mapping: [] },
    ],
  });

  // Odoo Integration State
  const [odooConfig, setOdooConfig] = useState<IntegrationConfig>({
    id: "odoo-1",
    name: "Odoo ERP",
    type: "odoo",
    url: "https://company.odoo.com",
    authType: "api-key",
    apiKey: "••••••••••••",
    syncInterval: 10,
    autoSync: true,
    status: {
      lastSync: new Date(Date.now() - 600000),
      status: "connected",
      recordsSynced: 892,
      errors: [],
      nextSync: new Date(Date.now() + 600000),
    },
    modules: [
      { id: "billing", name: "Billing & Invoices", icon: CreditCard, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 600000), recordCount: 423, status: "synced", mapping: [] },
      { id: "inventory", name: "Inventory", icon: Package, enabled: true, direction: "inbound", lastSync: new Date(Date.now() - 900000), recordCount: 1289, status: "synced", mapping: [] },
      { id: "crm", name: "CRM", icon: Users, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 1200000), recordCount: 234, status: "pending", mapping: [] },
      { id: "sales", name: "Sales", icon: BarChart3, enabled: true, direction: "outbound", lastSync: new Date(Date.now() - 1800000), recordCount: 567, status: "synced", mapping: [] },
      { id: "accounting", name: "Accounting", icon: FileJson, enabled: false, direction: "outbound", lastSync: null, recordCount: 0, status: "pending", mapping: [] },
    ],
  });

  // FHIR Server State
  const [fhirConfig, setFhirConfig] = useState<IntegrationConfig>({
    id: "fhir-1",
    name: "FHIR R4 Server",
    type: "fhir",
    url: "https://fhir.example.com/r4",
    authType: "oauth2",
    accessToken: "••••••••••••",
    syncInterval: 15,
    autoSync: false,
    status: {
      lastSync: new Date(Date.now() - 3600000),
      status: "connected",
      recordsSynced: 534,
      errors: [],
      nextSync: null,
    },
    modules: [
      { id: "patient-resource", name: "Patient Resources", icon: Users, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 3600000), recordCount: 534, status: "synced", mapping: [] },
      { id: "observation", name: "Observations", icon: Activity, enabled: true, direction: "inbound", lastSync: new Date(Date.now() - 7200000), recordCount: 4521, status: "synced", mapping: [] },
      { id: "medication", name: "Medication Requests", icon: CreditCard, enabled: true, direction: "bidirectional", lastSync: new Date(Date.now() - 5400000), recordCount: 1876, status: "synced", mapping: [] },
    ],
  });

  // Sync single module
  const syncModule = useCallback(async (configId: string, moduleId: string) => {
    const addLog = (message: string, type: "info" | "success" | "error") => {
      setSyncLogs(prev => [{ timestamp: new Date(), message, type }, ...prev].slice(0, 50));
    };

    addLog(`Starting sync for ${moduleId}...`, "info");

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    addLog(`Successfully synced ${moduleId}`, "success");
    toast.success(`${moduleId} sync completed`);
  }, []);

  // Sync all modules
  const syncAll = useCallback(async (config: IntegrationConfig) => {
    const enabledModules = config.modules.filter(m => m.enabled);
    
    for (const mod of enabledModules) {
      await syncModule(config.id, mod.id);
    }

    toast.success("All modules synced successfully");
  }, [syncModule]);

  // Test connection
  const testConnection = useCallback(async (config: IntegrationConfig) => {
    toast.info(`Testing connection to ${config.name}...`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success(`Connection to ${config.name} successful`);
  }, []);

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "connected":
      case "synced":
        return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100" };
      case "syncing":
      case "pending":
        return { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-100" };
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-100" };
      default:
        return { icon: Unlink, color: "text-slate-400", bg: "bg-slate-100" };
    }
  };

  // Get direction icon
  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "inbound":
        return <ArrowLeft className="h-4 w-4" />;
      case "outbound":
        return <ArrowRight className="h-4 w-4" />;
      case "bidirectional":
        return <ArrowUpDown className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Render integration card
  const renderIntegrationCard = (config: IntegrationConfig) => {
    const statusDisplay = getStatusDisplay(config.status.status);
    const StatusIcon = statusDisplay.icon;

    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${statusDisplay.bg}`}>
                <StatusIcon className={`h-5 w-5 ${statusDisplay.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{config.name}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Globe className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{config.url}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.status.status === "connected" ? "default" : "secondary"} className={config.status.status === "connected" ? "bg-emerald-500" : ""}>
                {config.status.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => testConnection(config)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-800">{config.status.recordsSynced.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Records Synced</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-800">{config.modules.filter(m => m.enabled).length}</div>
              <div className="text-xs text-slate-500">Active Modules</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-lg font-semibold text-slate-800">{config.syncInterval}m</div>
              <div className="text-xs text-slate-500">Sync Interval</div>
            </div>
          </div>

          <Separator />

          {/* Modules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Sync Modules</span>
              <Switch checked={config.autoSync} />
            </div>
            <div className="space-y-2">
              {config.modules.map((syncMod) => {
                const moduleStatus = getStatusDisplay(syncMod.status);
                const ModuleIcon = syncMod.icon;
                const ModuleStatusIcon = moduleStatus.icon;

                return (
                  <div
                    key={syncMod.id}
                    className={`p-3 rounded-lg border ${syncMod.enabled ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ModuleIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="font-medium text-sm">{syncMod.name}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {getDirectionIcon(syncMod.direction)}
                            <span>{syncMod.direction}</span>
                            <span>•</span>
                            <span>{syncMod.recordCount.toLocaleString()} records</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={syncMod.enabled} className="scale-75" />
                        {syncMod.enabled && (
                          <Button variant="ghost" size="sm" onClick={() => syncModule(config.id, syncMod.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <ModuleStatusIcon className={`h-4 w-4 ${moduleStatus.color}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button onClick={() => syncAll(config)} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync All
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Database className="h-7 w-7 text-indigo-500" />
              Integration Hub
            </h2>
            <p className="text-slate-500 mt-1">Bi-directional sync with Bahmni HIS, Odoo ERP, and FHIR servers</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">
              <Shield className="h-3 w-3 mr-1" />
              Secure Connections
            </Badge>
            <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>
        </div>

        {/* Connection Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "Bahmni HIS", status: bahmniConfig.status.status, records: bahmniConfig.status.recordsSynced },
            { name: "Odoo ERP", status: odooConfig.status.status, records: odooConfig.status.recordsSynced },
            { name: "FHIR Server", status: fhirConfig.status.status, records: fhirConfig.status.recordsSynced },
          ].map((conn) => {
            const statusDisplay = getStatusDisplay(conn.status);
            const StatusIcon = statusDisplay.icon;
            return (
              <Card key={conn.name} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${statusDisplay.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${statusDisplay.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{conn.name}</div>
                      <div className="text-xs text-slate-500">{conn.records.toLocaleString()} records</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="bahmni">Bahmni HIS</TabsTrigger>
            <TabsTrigger value="odoo">Odoo ERP</TabsTrigger>
            <TabsTrigger value="fhir">FHIR R4</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="bahmni" className="space-y-4 mt-4">
            {renderIntegrationCard(bahmniConfig)}
          </TabsContent>

          <TabsContent value="odoo" className="space-y-4 mt-4">
            {renderIntegrationCard(odooConfig)}
          </TabsContent>

          <TabsContent value="fhir" className="space-y-4 mt-4">
            {renderIntegrationCard(fhirConfig)}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sync Activity Log</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {syncLogs.length > 0 ? (
                      syncLogs.map((log, index) => {
                        const iconMap = {
                          info: <Info className="h-4 w-4 text-blue-500" />,
                          success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
                          error: <XCircle className="h-4 w-4 text-red-500" />,
                        };
                        return (
                          <div key={index} className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                            {iconMap[log.type]}
                            <div className="flex-1">
                              <p className="text-sm text-slate-700">{log.message}</p>
                              <p className="text-xs text-slate-400">{log.timestamp.toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-64 flex items-center justify-center text-center">
                        <div>
                          <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No sync activity yet</p>
                          <p className="text-xs text-slate-400">Start a sync to see logs</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* FHIR Compliance Info */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <FileJson className="h-8 w-8 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">FHIR R4 Compliant</h3>
                  <p className="text-indigo-200 text-sm">Full HL7 FHIR R4 specification support</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">HIPAA Ready</span>
                </div>
                <p className="text-xs text-indigo-300">OAuth 2.0 / SMART on FHIR</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Dialog */}
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Integration Configuration</DialogTitle>
              <DialogDescription>Configure connection settings and sync options</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Integration Name</Label>
                  <Input placeholder="e.g., Production Bahmni" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="bahmni">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bahmni">Bahmni HIS</SelectItem>
                      <SelectItem value="odoo">Odoo ERP</SelectItem>
                      <SelectItem value="fhir">FHIR Server</SelectItem>
                      <SelectItem value="custom">Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Server URL</Label>
                <Input placeholder="https://server.example.com" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select defaultValue="basic">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="api-key">API Key</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                      <SelectItem value="none">No Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sync Interval (minutes)</Label>
                  <Input type="number" defaultValue="5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input placeholder="admin" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Sync</Label>
                  <p className="text-xs text-slate-500">Automatically sync data at regular intervals</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Real-time Sync</Label>
                  <p className="text-xs text-slate-500">Enable webhooks for instant updates</p>
                </div>
                <Switch />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancel</Button>
              <Button onClick={() => setShowConfigDialog(false)}>Save Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
