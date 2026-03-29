/**
 * Role & Permission Manager - Admin Configurable RBAC
 * 
 * This component provides a UI for administrators to:
 * - View all roles and their permissions
 * - Create new custom roles
 * - Modify permissions for any role
 * - Delete non-system roles
 * 
 * The permissions are stored in the database and override hardcoded defaults.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Users,
  Key,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  RefreshCw,
  Lock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface Permission {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  priority: number;
  employeeCount: number;
  permissions: Permission[];
}

interface PermissionsByCategory {
  [category: string]: Permission[];
}

interface RolesData {
  roles: Role[];
  permissions: PermissionsByCategory;
  allPermissions: Permission[];
}

export function RolePermissionManager() {
  const [data, setData] = useState<RolesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    displayName: "",
    description: "",
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    displayName: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/roles");
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        // Expand all categories by default
        setExpandedCategories(new Set(Object.keys(result.data.permissions)));
      } else {
        throw new Error(result.error || "Failed to fetch roles");
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast({
        title: "Error",
        description: "Failed to load roles and permissions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setEditForm({
      displayName: role.displayName,
      description: role.description || "",
    });
    setEditPermissions(new Set(role.permissions.map(p => p.id)));
    setIsEditing(true);
  };

  const handleCreateRole = () => {
    setCreateForm({
      name: "",
      displayName: "",
      description: "",
    });
    setEditPermissions(new Set());
    setIsCreating(true);
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editForm.displayName,
          description: editForm.description,
          permissionIds: Array.from(editPermissions),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Role "${editForm.displayName}" updated successfully`,
        });
        await fetchData();
        setIsEditing(false);
        setSelectedRole(null);
      } else {
        throw new Error(result.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save role",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewRole = async () => {
    if (!createForm.name || !createForm.displayName) {
      toast({
        title: "Validation Error",
        description: "Role name and display name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.toLowerCase().replace(/\s+/g, "_"),
          displayName: createForm.displayName,
          description: createForm.description,
          permissionIds: Array.from(editPermissions),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Role "${createForm.displayName}" created successfully`,
        });
        await fetchData();
        setIsCreating(false);
      } else {
        throw new Error(result.error || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create role",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.displayName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Role "${role.displayName}" deleted successfully`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || "Failed to delete role");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  const togglePermission = (permissionId: string) => {
    const newPermissions = new Set(editPermissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    setEditPermissions(newPermissions);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const selectAllInCategory = (category: string, permissions: Permission[]) => {
    const newPermissions = new Set(editPermissions);
    const allSelected = permissions.every(p => newPermissions.has(p.id));
    
    if (allSelected) {
      // Deselect all in category
      permissions.forEach(p => newPermissions.delete(p.id));
    } else {
      // Select all in category
      permissions.forEach(p => newPermissions.add(p.id));
    }
    setEditPermissions(newPermissions);
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Patient: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      Clinical: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      Laboratory: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      Imaging: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      Nursing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
      Admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      AI: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
    return colors[category] || "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading roles and permissions...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="h-8 w-8 mr-2" />
        <span>Failed to load roles and permissions</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Role & Permission Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure access control for all users. Changes take effect immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCreateRole}>
            <Plus className="h-4 w-4 mr-2" />
            New Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Roles ({data.roles.length})</CardTitle>
              <CardDescription>
                Click on a role to view and edit permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {data.roles.map((role) => (
                    <div
                      key={role.id}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                        selectedRole?.id === role.id && "bg-primary/10"
                      )}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{role.displayName}</span>
                            {role.isSystem && (
                              <Badge variant="outline" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                System
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {role.description || role.name}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              {role.permissions.length} permissions
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {role.employeeCount} users
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRole(role);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Permissions View */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">
                {selectedRole ? (
                  <div className="flex items-center justify-between">
                    <span>Permissions for {selectedRole.displayName}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRole(selectedRole)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {!selectedRole.isSystem && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRole(selectedRole)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  "Select a role to view permissions"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedRole ? (
                <ScrollArea className="h-[450px]">
                  <Accordion type="multiple" defaultValue={Object.keys(data.permissions)}>
                    {Object.entries(data.permissions).map(([category, permissions]) => {
                      const rolePermsInCategory = permissions.filter(p =>
                        selectedRole.permissions.some(rp => rp.id === p.id)
                      );
                      
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Badge className={getCategoryColor(category)}>
                                {category}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                ({rolePermsInCategory.length}/{permissions.length})
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              {permissions.map((permission) => {
                                const hasPermission = selectedRole.permissions.some(
                                  p => p.id === permission.id
                                );
                                
                                return (
                                  <div
                                    key={permission.id}
                                    className={cn(
                                      "p-2 rounded border text-sm",
                                      hasPermission
                                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                        : "bg-muted/30 border-muted"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {hasPermission ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className={cn(
                                        "font-medium",
                                        !hasPermission && "text-muted-foreground"
                                      )}>
                                        {permission.displayName}
                                      </span>
                                    </div>
                                    {permission.description && (
                                      <p className="text-xs text-muted-foreground mt-1 ml-6">
                                        {permission.description}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Shield className="h-12 w-12 mb-4 opacity-50" />
                  <p>Select a role from the list to view its permissions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Role: {selectedRole?.displayName}</DialogTitle>
            <DialogDescription>
              Modify the role display name, description, and permissions.
              {selectedRole?.isSystem && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ This is a system role. Some restrictions may apply.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  placeholder="e.g., Senior Doctor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Brief description of this role"
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Permissions ({editPermissions.size} selected)</Label>
              <ScrollArea className="h-[350px] border rounded-lg p-4">
                {Object.entries(data.permissions).map(([category, permissions]) => {
                  const selectedInCategory = permissions.filter(p => editPermissions.has(p.id)).length;
                  
                  return (
                    <div key={category} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getCategoryColor(category)}>{category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {selectedInCategory}/{permissions.length}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectAllInCategory(category, permissions)}
                        >
                          {selectedInCategory === permissions.length ? "Deselect All" : "Select All"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                              editPermissions.has(permission.id)
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => togglePermission(permission.id)}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center",
                              editPermissions.has(permission.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground"
                            )}>
                              {editPermissions.has(permission.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium">{permission.displayName}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions. Role names must be unique.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newName">Role Name (unique identifier)</Label>
                <Input
                  id="newName"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., senior_doctor"
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase letters and underscores only
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newDisplayName">Display Name</Label>
                <Input
                  id="newDisplayName"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  placeholder="e.g., Senior Doctor"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newDescription">Description</Label>
              <Textarea
                id="newDescription"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Describe the purpose of this role"
                rows={2}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Permissions ({editPermissions.size} selected)</Label>
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                {Object.entries(data.permissions).map(([category, permissions]) => {
                  const selectedInCategory = permissions.filter(p => editPermissions.has(p.id)).length;
                  
                  return (
                    <div key={category} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getCategoryColor(category)}>{category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {selectedInCategory}/{permissions.length}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectAllInCategory(category, permissions)}
                        >
                          {selectedInCategory === permissions.length ? "Deselect All" : "Select All"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                              editPermissions.has(permission.id)
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => togglePermission(permission.id)}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center",
                              editPermissions.has(permission.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground"
                            )}>
                              {editPermissions.has(permission.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                            <span className="text-sm font-medium">{permission.displayName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewRole} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RolePermissionManager;
