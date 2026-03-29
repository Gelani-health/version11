"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

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

interface RoleData {
  roles: Role[];
  permissions: Record<string, Permission[]>;
  allPermissions: Permission[];
}

export function RoleManagement() {
  const { toast } = useToast();
  const [data, setData] = useState<RoleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    description: "",
    permissionIds: [] as string[],
  });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Fetch roles and permissions
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/roles");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setExpandedCategories(Object.keys(result.data.permissions));
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      toast({
        title: "Error",
        description: "Failed to load roles and permissions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Start editing a role
  const startEditing = (role: Role) => {
    setSelectedRole(role);
    setIsEditing(true);
    setIsCreating(false);
    setEditForm({
      displayName: role.displayName,
      description: role.description || "",
      permissionIds: role.permissions.map((p) => p.id),
    });
  };

  // Start creating a new role
  const startCreating = () => {
    setSelectedRole(null);
    setIsEditing(true);
    setIsCreating(true);
    setEditForm({
      displayName: "",
      description: "",
      permissionIds: [],
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedRole(null);
    setEditForm({
      displayName: "",
      description: "",
      permissionIds: [],
    });
  };

  // Toggle permission
  const togglePermission = (permissionId: string) => {
    setEditForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  // Toggle all permissions in a category
  const toggleCategory = (category: string, permissions: Permission[]) => {
    const categoryIds = permissions.map((p) => p.id);
    const allSelected = categoryIds.every((id) => editForm.permissionIds.includes(id));

    if (allSelected) {
      // Remove all from category
      setEditForm((prev) => ({
        ...prev,
        permissionIds: prev.permissionIds.filter((id) => !categoryIds.includes(id)),
      }));
    } else {
      // Add all from category
      setEditForm((prev) => ({
        ...prev,
        permissionIds: [...new Set([...prev.permissionIds, ...categoryIds])],
      }));
    }
  };

  // Save role
  const saveRole = async () => {
    if (!editForm.displayName.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = isCreating ? "/api/admin/roles" : `/api/admin/roles/${selectedRole?.id}`;
      const method = isCreating ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: isCreating ? "Role created successfully" : "Role updated successfully",
        });
        cancelEditing();
        fetchData();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save role",
        variant: "destructive",
      });
    }
  };

  // Delete role
  const deleteRole = async (role: Role) => {
    if (role.isSystem) {
      toast({
        title: "Cannot Delete",
        description: "System roles cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    if (role.employeeCount > 0) {
      toast({
        title: "Cannot Delete",
        description: `Reassign ${role.employeeCount} employees from this role first`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete the role "${role.displayName}"?`)) {
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
          description: "Role deleted successfully",
        });
        fetchData();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2">Loading roles and permissions...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertTriangle className="h-5 w-5 mr-2" />
        Failed to load roles
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Role & Permission Management</h2>
          <p className="text-sm text-slate-500">Configure access control for all users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={startCreating} className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="h-4 w-4 mr-2" />
            New Role
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Roles
              </CardTitle>
              <CardDescription>
                {data.roles.length} roles configured
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-2">
                  {data.roles.map((role) => (
                    <motion.div
                      key={role.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedRole?.id === role.id
                          ? "bg-emerald-50 border-emerald-300"
                          : "hover:bg-slate-50 border-slate-200"
                      }`}
                      onClick={() => {
                        if (!isEditing) {
                          setSelectedRole(role);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{role.displayName}</span>
                            {role.isSystem && (
                              <Badge variant="secondary" className="text-xs">
                                System
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {role.permissions.length} permissions • {role.employeeCount} employees
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(role);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRole(role);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Role Details / Editor */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isCreating ? "Create New Role" : `Edit ${selectedRole?.displayName}`}
                </CardTitle>
                <CardDescription>
                  Configure role name and permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Role Name */}
                <div className="space-y-2">
                  <Label>Role Name *</Label>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    placeholder="e.g., Clinical Supervisor"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Describe the role's responsibilities..."
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Permissions by Category */}
                <div className="space-y-4">
                  <Label>Permissions</Label>
                  <Accordion type="multiple" className="w-full" defaultValue={expandedCategories}>
                    {Object.entries(data.permissions).map(([category, permissions]) => {
                      const allSelected = permissions.every((p) =>
                        editForm.permissionIds.includes(p.id)
                      );
                      const someSelected = permissions.some((p) =>
                        editForm.permissionIds.includes(p.id)
                      );

                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center ${
                                  allSelected
                                    ? "bg-emerald-500 border-emerald-500"
                                    : someSelected
                                    ? "bg-emerald-100 border-emerald-300"
                                    : "border-slate-300"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCategory(category, permissions);
                                }}
                              >
                                {allSelected && <Check className="h-3 w-3 text-white" />}
                                {someSelected && !allSelected && (
                                  <div className="w-2 h-2 bg-emerald-500 rounded-sm" />
                                )}
                              </div>
                              <span className="font-medium">{category}</span>
                              <Badge variant="outline" className="text-xs">
                                {permissions.filter((p) => editForm.permissionIds.includes(p.id)).length}
                                /{permissions.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              {permissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                                    editForm.permissionIds.includes(permission.id)
                                      ? "bg-emerald-50 border-emerald-200"
                                      : "hover:bg-slate-50 border-slate-200"
                                  }`}
                                  onClick={() => togglePermission(permission.id)}
                                >
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                                      editForm.permissionIds.includes(permission.id)
                                        ? "bg-emerald-500 border-emerald-500"
                                        : "border-slate-300"
                                    }`}
                                  >
                                    {editForm.permissionIds.includes(permission.id) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {permission.displayName}
                                    </p>
                                    {permission.description && (
                                      <p className="text-xs text-slate-500 truncate">
                                        {permission.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={cancelEditing}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={saveRole} className="bg-emerald-500 hover:bg-emerald-600">
                    <Save className="h-4 w-4 mr-2" />
                    {isCreating ? "Create Role" : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedRole ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      {selectedRole.displayName}
                    </CardTitle>
                    <CardDescription>
                      {selectedRole.description || "No description"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => startEditing(selectedRole)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Badge variant={selectedRole.isSystem ? "default" : "secondary"}>
                    {selectedRole.isSystem ? "System Role" : "Custom Role"}
                  </Badge>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedRole.employeeCount} employees
                  </Badge>
                  <Badge variant="outline">
                    <Lock className="h-3 w-3 mr-1" />
                    {selectedRole.permissions.length} permissions
                  </Badge>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Assigned Permissions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRole.permissions.map((perm) => (
                      <Badge key={perm.id} variant="outline" className="text-xs">
                        {perm.category}: {perm.displayName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Shield className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a role to view details</p>
                <p className="text-sm">Or create a new role to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
