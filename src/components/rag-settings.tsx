"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Server,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Settings,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface RAGService {
  id: string;
  serviceName: string;
  displayName: string;
  description?: string;
  serviceUrl: string;
  port: number;
  healthEndpoint: string;
  serviceType: string;
  capabilities?: string;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  settings?: string;
  connectionStatus: string;
  responseTimeMs?: number;
  lastHealthCheck?: string;
  lastError?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  notes?: string;
}

interface RAGSettingsProps {
  onServiceChange?: (serviceName: string) => void;
}

export function RAGSettings({ onServiceChange }: RAGSettingsProps) {
  const [services, setServices] = useState<RAGService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<RAGService | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/rag-config?checkHealth=true");
      const data = await response.json();

      if (data.success && data.data) {
        setServices(data.data);
      }
    } catch (error) {
      console.error("Error fetching RAG services:", error);
      toast({
        title: "Error",
        description: "Failed to fetch RAG services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchServices();
  };

  const setDefaultService = async (serviceName: string) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: `Default RAG service set to ${serviceName}`,
        });
        await fetchServices();
        onServiceChange?.(serviceName);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default service",
        variant: "destructive",
      });
    }
  };

  const toggleServiceActive = async (serviceName: string, isActive: boolean) => {
    const service = services.find((s) => s.serviceName === serviceName);
    if (!service) return;

    try {
      const response = await fetch("/api/rag-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...service,
          capabilities: service.capabilities ? JSON.parse(service.capabilities) : [],
          settings: service.settings ? JSON.parse(service.settings) : {},
          isActive,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Service ${isActive ? "enabled" : "disabled"}`,
        });
        await fetchServices();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
    }
  };

  const saveService = async (service: Partial<RAGService>) => {
    try {
      const response = await fetch("/api/rag-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...service,
          capabilities: service.capabilities,
          settings: service.settings,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: `Service ${service.serviceName} saved`,
        });
        setIsDialogOpen(false);
        setEditingService(null);
        await fetchServices();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const deleteService = async (serviceName: string) => {
    try {
      const response = await fetch(`/api/rag-config?serviceName=${serviceName}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Service ${serviceName} deleted`,
        });
        await fetchServices();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            RAG Services
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              RAG Services Configuration
            </CardTitle>
            <CardDescription>
              Manage RAG (Retrieval-Augmented Generation) services for medical knowledge retrieval
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditingService(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <RAGServiceDialog
                service={editingService}
                onSave={saveService}
                onClose={() => setIsDialogOpen(false)}
              />
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No RAG services configured</p>
            <p className="text-sm">Click "Add Service" to add a RAG service</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className={cn(
                  "border rounded-lg p-4 transition-colors",
                  service.isDefault && "border-primary bg-primary/5",
                  !service.isActive && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{service.displayName}</h4>
                        {service.isDefault && (
                          <Badge variant="default" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {!service.isActive && (
                          <Badge variant="outline" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              getStatusColor(service.connectionStatus)
                            )}
                          />
                          <span className="text-xs text-muted-foreground">
                            {getStatusLabel(service.connectionStatus)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Port {service.port}
                        </span>
                        {service.responseTimeMs && (
                          <Badge variant="outline" className="text-xs">
                            {service.responseTimeMs}ms
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!service.isDefault && service.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultService(service.serviceName)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Switch
                      checked={service.isActive}
                      onCheckedChange={(checked) =>
                        toggleServiceActive(service.serviceName, checked)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setExpandedService(
                          expandedService === service.id ? null : service.id
                        )
                      }
                    >
                      {expandedService === service.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedService === service.id && (
                  <>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Service Name</Label>
                        <p className="font-mono">{service.serviceName}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">URL</Label>
                        <p className="font-mono truncate">{service.serviceUrl}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Total Requests</Label>
                        <p>{service.totalRequests}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Success Rate</Label>
                        <p>
                          {service.totalRequests > 0
                            ? Math.round(
                                (service.successfulRequests / service.totalRequests) * 100
                              )
                            : 0}
                          %
                        </p>
                      </div>
                    </div>

                    {service.lastError && (
                      <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-600 dark:text-red-400">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Last Error: {service.lastError}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete RAG Service</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {service.displayName}? This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteService(service.serviceName)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingService(service);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Dialog for adding/editing RAG service
function RAGServiceDialog({
  service,
  onSave,
  onClose,
}: {
  service: RAGService | null;
  onSave: (service: Partial<RAGService>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<RAGService>>({
    serviceName: "",
    displayName: "",
    description: "",
    serviceUrl: "http://localhost:3031",
    port: 3031,
    healthEndpoint: "/health",
    serviceType: "rag",
    isActive: true,
    isDefault: false,
    priority: 0,
    notes: "",
    ...service,
  });

  const handleUrlChange = (url: string) => {
    let port = 80;
    try {
      const parsed = new URL(url);
      port = parseInt(parsed.port) || (parsed.protocol === "https:" ? 443 : 80);
    } catch {}
    setFormData({ ...formData, serviceUrl: url, port });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <DialogContent className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{service ? "Edit RAG Service" : "Add RAG Service"}</DialogTitle>
          <DialogDescription>
            Configure a RAG (Retrieval-Augmented Generation) service
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serviceName">Service Name *</Label>
              <Input
                id="serviceName"
                value={formData.serviceName}
                onChange={(e) =>
                  setFormData({ ...formData, serviceName: e.target.value })
                }
                placeholder="medical-rag"
                disabled={!!service}
                required
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="Medical RAG"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of the service"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serviceUrl">Service URL *</Label>
              <Input
                id="serviceUrl"
                value={formData.serviceUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="http://localhost:3031"
                required
              />
            </div>
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) || 0 })
                }
                placeholder="3031"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="healthEndpoint">Health Endpoint</Label>
              <Input
                id="healthEndpoint"
                value={formData.healthEndpoint}
                onChange={(e) =>
                  setFormData({ ...formData, healthEndpoint: e.target.value })
                }
                placeholder="/health"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
              <Label htmlFor="isDefault">Default</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Service</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default RAGSettings;
