"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Power,
  Star,
  StarOff,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LLMIntegrationForm,
  type LLMIntegrationFormData,
} from "./llm-integration-form";
import {
  LLM_PROVIDER_PRESETS,
  getProviderIcon,
} from "@/lib/llm/provider-presets";

interface LLMIntegration {
  id: string;
  provider: string;
  displayName: string;
  baseUrl: string | null;
  username: string | null;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  notes: string | null;
  connectionStatus: string;
  lastError: string | null;
  lastUsed: string | null;
  totalRequests: number;
  createdAt: string;
  updatedAt: string;
  apiKey?: string | null;
}

interface ApiResponse {
  success: boolean;
  data?: LLMIntegration[];
  error?: string;
  message?: string;
  lastError?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function LLMIntegrationsSettings() {
  const [integrations, setIntegrations] = useState<LLMIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Partial<LLMIntegration> | undefined>();
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/llm-integrations");
      const data: ApiResponse = await response.json();

      if (data.success && data.data) {
        setIntegrations(data.data);
      } else {
        toast.error("Failed to load integrations");
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Failed to load integrations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleAddIntegration = () => {
    setEditingIntegration(undefined);
    setFormMode("add");
    setIsFormOpen(true);
  };

  const handleEditIntegration = (integration: LLMIntegration) => {
    setEditingIntegration({
      id: integration.id,
      provider: integration.provider,
      displayName: integration.displayName,
      baseUrl: integration.baseUrl || "",
      username: integration.username || "",
      model: integration.model,
      notes: integration.notes || "",
      isActive: integration.isActive,
      isDefault: integration.isDefault,
    });
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (formData: LLMIntegrationFormData) => {
    const url = "/api/llm-integrations";
    const method = formMode === "add" ? "POST" : "PUT";
    
    const body = formMode === "edit" 
      ? { id: editingIntegration?.id, ...formData }
      : formData;

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: ApiResponse = await response.json();

    if (data.success) {
      toast.success(formMode === "add" ? "Integration added successfully" : "Integration updated successfully");
      fetchIntegrations();
    } else {
      throw new Error(data.error || "Failed to save integration");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/llm-integrations?id=${id}`, {
        method: "DELETE",
      });
      const data: ApiResponse = await response.json();

      if (data.success) {
        toast.success("Integration deleted successfully");
        fetchIntegrations();
      } else {
        toast.error(data.error || "Failed to delete integration");
      }
    } catch (error) {
      console.error("Error deleting integration:", error);
      toast.error("Failed to delete integration");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const response = await fetch("/api/llm-integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message || "Connection test successful");
      } else {
        // Show detailed error message with reason
        const errorReason = data.lastError || data.message || data.error || "Connection test failed";
        toast.error(errorReason, {
          description: "Please check your configuration and try again.",
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Connection test failed", {
        description: "Unable to reach the server. Please try again.",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      const response = await fetch("/api/llm-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const data: ApiResponse = await response.json();

      if (data.success) {
        toast.success(currentStatus ? "Integration disabled" : "Integration enabled");
        fetchIntegrations();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch("/api/llm-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      });
      const data: ApiResponse = await response.json();

      if (data.success) {
        toast.success("Default provider updated");
        fetchIntegrations();
      } else {
        toast.error(data.error || "Failed to set default");
      }
    } catch (error) {
      console.error("Error setting default:", error);
      toast.error("Failed to set default");
    }
  };

  const getConnectionStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800">
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-500/10 text-gray-600 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-800">
        Disabled
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">LLM Integrations</h2>
            <p className="text-muted-foreground">
              Manage your AI provider configurations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchIntegrations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleAddIntegration}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>
        </div>

        {/* Integrations List */}
        {integrations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations configured</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add your first LLM provider to start using AI features
              </p>
              <Button onClick={handleAddIntegration}>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-280px)] pr-4">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              <AnimatePresence mode="popLayout">
                {integrations.map((integration) => (
                  <motion.div
                    key={integration.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className={`${!integration.isActive ? "opacity-60" : ""}`}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="text-2xl">
                              {getProviderIcon(integration.provider)}
                            </div>
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {integration.displayName}
                                {integration.isDefault && (
                                  <Badge variant="default" className="text-xs">
                                    <Star className="h-3 w-3 mr-1" />
                                    Default
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <span>{LLM_PROVIDER_PRESETS[integration.provider]?.name || integration.provider}</span>
                                <span className="text-muted-foreground">•</span>
                                <span>{integration.model}</span>
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(integration.isActive)}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  {getConnectionStatusIcon(integration.connectionStatus)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="capitalize">{integration.connectionStatus}</p>
                                {integration.connectionStatus === "failed" && integration.lastError && (
                                  <p className="text-red-400 text-xs mt-1 max-w-xs">{integration.lastError}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Show error message if connection failed */}
                        {integration.connectionStatus === "failed" && integration.lastError && (
                          <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">Connection Failed</p>
                              <p className="text-xs text-red-600 dark:text-red-300 mt-1">{integration.lastError}</p>
                            </div>
                          </div>
                        )}
                        {integration.notes && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {integration.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditIntegration(integration)}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit integration settings</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestConnection(integration.id)}
                                disabled={testingId === integration.id}
                              >
                                {testingId === integration.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-1" />
                                )}
                                Test
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Test connection</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(integration.id, integration.isActive)}
                                disabled={togglingId === integration.id}
                              >
                                {togglingId === integration.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Power className="h-4 w-4 mr-1" />
                                )}
                                {integration.isActive ? "Disable" : "Enable"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {integration.isActive ? "Disable integration" : "Enable integration"}
                            </TooltipContent>
                          </Tooltip>

                          {!integration.isDefault && integration.isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetDefault(integration.id)}
                                >
                                  <StarOff className="h-4 w-4 mr-1" />
                                  Set Default
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Set as default provider</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(integration.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete integration</TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Usage Stats */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span>Total Requests: {integration.totalRequests}</span>
                          {integration.lastUsed && (
                            <>
                              <span>•</span>
                              <span>
                                Last used: {new Date(integration.lastUsed).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </ScrollArea>
        )}

        {/* Form Dialog */}
        <LLMIntegrationForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialData={editingIntegration}
          onSubmit={handleFormSubmit}
          mode={formMode}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Integration</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this integration? This action cannot be undone.
                {integrations.find((i) => i.id === deleteConfirmId)?.isDefault && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    Warning: This is your default provider. Deleting it will require setting a new default.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
