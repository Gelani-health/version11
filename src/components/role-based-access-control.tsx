"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Users,
  User,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Key,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  Clock,
  Activity,
  FileText,
  Pill,
  Database,
  Brain,
  Mic,
  BarChart3,
  Globe,
  Save,
  RefreshCw,
  MoreHorizontal,
  Copy
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Permission categories and actions
const PERMISSION_CATEGORIES = {
  patients: {
    name: "Patient Management",
    icon: Users,
    permissions: ["view", "create", "edit", "delete", "export"],
  },
  consultations: {
    name: "Consultations",
    icon: Activity,
    permissions: ["view", "create", "edit", "delete", "sign-off"],
  },
  documentation: {
    name: "Documentation",
    icon: FileText,
    permissions: ["view", "create", "edit", "delete", "sign-off", "export"],
  },
  medications: {
    name: "Medications & Prescriptions",
    icon: Pill,
    permissions: ["view", "create", "edit", "delete", "prescribe", "verify"],
  },
  drugs: {
    name: "Drug Interaction Checker",
    icon: Shield,
    permissions: ["view", "use", "configure"],
  },
  imaging: {
    name: "Medical Imaging",
    icon: Database,
    permissions: ["view", "upload", "analyze", "delete"],
  },
  ai: {
    name: "AI Features",
    icon: Brain,
    permissions: ["use-diagnosis", "use-coding", "use-summaries", "configure"],
  },
  voice: {
    name: "Voice Documentation",
    icon: Mic,
    permissions: ["use", "view-others", "manage"],
  },
  analytics: {
    name: "Analytics & Reports",
    icon: BarChart3,
    permissions: ["view", "export", "configure", "view-sensitive"],
  },
  integrations: {
    name: "System Integrations",
    icon: Globe,
    permissions: ["view", "configure", "sync", "manage"],
  },
  settings: {
    name: "System Settings",
    icon: Settings,
    permissions: ["view", "edit", "manage-users", "manage-roles"],
  },
};

// Predefined roles
const DEFAULT_ROLES = [
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access with all permissions",
    color: "bg-rose-500",
    permissions: Object.fromEntries(
      Object.keys(PERMISSION_CATEGORIES).map(cat => [
        cat,
        PERMISSION_CATEGORIES[cat as keyof typeof PERMISSION_CATEGORIES].permissions
      ])
    ),
    isSystem: true,
  },
  {
    id: "physician",
    name: "Physician",
    description: "Doctor with full clinical access",
    color: "bg-blue-500",
    permissions: {
      patients: ["view", "create", "edit", "export"],
      consultations: ["view", "create", "edit", "sign-off"],
      documentation: ["view", "create", "edit", "sign-off", "export"],
      medications: ["view", "create", "edit", "prescribe"],
      drugs: ["view", "use"],
      imaging: ["view", "upload", "analyze"],
      ai: ["use-diagnosis", "use-coding", "use-summaries"],
      voice: ["use"],
      analytics: ["view", "export"],
      integrations: ["view"],
      settings: ["view"],
    },
    isSystem: true,
  },
  {
    id: "nurse",
    name: "Nurse",
    description: "Nursing staff with patient care access",
    color: "bg-emerald-500",
    permissions: {
      patients: ["view", "create", "edit"],
      consultations: ["view", "create"],
      documentation: ["view", "create", "edit"],
      medications: ["view", "verify"],
      drugs: ["view", "use"],
      imaging: ["view"],
      ai: ["use-summaries"],
      voice: ["use"],
      analytics: ["view"],
      integrations: ["view"],
      settings: ["view"],
    },
    isSystem: true,
  },
  {
    id: "pharmacist",
    name: "Pharmacist",
    description: "Pharmacy staff with medication management access",
    color: "bg-purple-500",
    permissions: {
      patients: ["view"],
      consultations: ["view"],
      documentation: ["view"],
      medications: ["view", "edit", "verify"],
      drugs: ["view", "use", "configure"],
      imaging: ["view"],
      ai: ["use-diagnosis"],
      voice: [],
      analytics: ["view"],
      integrations: ["view", "sync"],
      settings: ["view"],
    },
    isSystem: true,
  },
  {
    id: "receptionist",
    name: "Receptionist",
    description: "Front desk staff with limited access",
    color: "bg-amber-500",
    permissions: {
      patients: ["view", "create", "edit"],
      consultations: ["view", "create"],
      documentation: ["view"],
      medications: ["view"],
      drugs: [],
      imaging: [],
      ai: [],
      voice: [],
      analytics: ["view"],
      integrations: [],
      settings: [],
    },
    isSystem: true,
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to most modules",
    color: "bg-slate-500",
    permissions: {
      patients: ["view"],
      consultations: ["view"],
      documentation: ["view"],
      medications: ["view"],
      drugs: ["view"],
      imaging: ["view"],
      ai: [],
      voice: [],
      analytics: ["view"],
      integrations: ["view"],
      settings: [],
    },
    isSystem: true,
  },
];

// Sample users
const SAMPLE_USERS = [
  {
    id: "user-1",
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@gelani.com",
    role: "physician",
    department: "Internal Medicine",
    status: "active",
    lastLogin: new Date(Date.now() - 3600000),
    avatar: null,
  },
  {
    id: "user-2",
    name: "Dr. Michael Chen",
    email: "michael.chen@gelani.com",
    role: "physician",
    department: "Cardiology",
    status: "active",
    lastLogin: new Date(Date.now() - 7200000),
    avatar: null,
  },
  {
    id: "user-3",
    name: "Emily Roberts",
    email: "emily.roberts@gelani.com",
    role: "nurse",
    department: "Emergency",
    status: "active",
    lastLogin: new Date(Date.now() - 1800000),
    avatar: null,
  },
  {
    id: "user-4",
    name: "James Wilson",
    email: "james.wilson@gelani.com",
    role: "pharmacist",
    department: "Pharmacy",
    status: "active",
    lastLogin: new Date(Date.now() - 5400000),
    avatar: null,
  },
  {
    id: "user-5",
    name: "Admin User",
    email: "admin@gelani.com",
    role: "admin",
    department: "IT",
    status: "active",
    lastLogin: new Date(Date.now() - 900000),
    avatar: null,
  },
  {
    id: "user-6",
    name: "Lisa Park",
    email: "lisa.park@gelani.com",
    role: "receptionist",
    department: "Front Desk",
    status: "inactive",
    lastLogin: new Date(Date.now() - 86400000),
    avatar: null,
  },
];

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: Record<string, string[]>;
  isSystem: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  lastLogin: Date;
  avatar: string | null;
}

export function RoleBasedAccessControl() {
  const [activeTab, setActiveTab] = useState("users");
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [users, setUsers] = useState<User[]>(SAMPLE_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Check if user has permission
  const hasPermission = (userRole: string, category: string, permission: string): boolean => {
    const role = roles.find(r => r.id === userRole);
    if (!role) return false;
    return role.permissions[category]?.includes(permission) || false;
  };

  // Get role by ID
  const getRole = (roleId: string): Role | undefined => {
    return roles.find(r => r.id === roleId);
  };

  // Add new user
  const addUser = (user: Partial<User>) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: user.name || "",
      email: user.email || "",
      role: user.role || "viewer",
      department: user.department || "",
      status: "active",
      lastLogin: new Date(),
      avatar: null,
    };
    setUsers(prev => [...prev, newUser]);
    toast.success("User created successfully");
    setShowUserDialog(false);
  };

  // Update user
  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, ...updates } : u))
    );
    toast.success("User updated successfully");
  };

  // Delete user
  const deleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    toast.success("User deleted successfully");
  };

  // Add new role
  const addRole = (role: Partial<Role>) => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: role.name || "",
      description: role.description || "",
      color: role.color || "bg-slate-500",
      permissions: role.permissions || {},
      isSystem: false,
    };
    setRoles(prev => [...prev, newRole]);
    toast.success("Role created successfully");
    setShowRoleDialog(false);
  };

  // Update role permissions
  const updateRolePermission = (roleId: string, category: string, permission: string, enabled: boolean) => {
    setRoles(prev =>
      prev.map(role => {
        if (role.id !== roleId) return role;
        
        const currentPerms = role.permissions[category] || [];
        const newPerms = enabled
          ? [...currentPerms, permission]
          : currentPerms.filter(p => p !== permission);
        
        return {
          ...role,
          permissions: {
            ...role.permissions,
            [category]: newPerms,
          },
        };
      })
    );
  };

  // Filter users
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRole(user.role)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "inactive":
        return "bg-slate-100 text-slate-700";
      case "suspended":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="h-7 w-7 text-indigo-500" />
              Role-Based Access Control
            </h2>
            <p className="text-slate-500 mt-1">Manage users, roles, and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">
              <Lock className="h-3 w-3 mr-1" />
              Secure
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{users.length}</div>
                  <div className="text-sm text-slate-500">Total Users</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{users.filter(u => u.status === "active").length}</div>
                  <div className="text-sm text-slate-500">Active Users</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Key className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{roles.length}</div>
                  <div className="text-sm text-slate-500">Roles Defined</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Activity className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{Object.keys(PERMISSION_CATEGORIES).length}</div>
                  <div className="text-sm text-slate-500">Permission Areas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>User Management</CardTitle>
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user account</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Dr. John Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" placeholder="john.doe@gelani.com" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map(role => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Department</Label>
                            <Input placeholder="Cardiology" />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
                        <Button onClick={() => addUser({ name: "New User", email: "new@gelani.com", role: "viewer", department: "General" })}>Create User</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => {
                      const role = getRole(user.role);
                      return (
                        <div
                          key={user.id}
                          className="p-4 bg-slate-50 rounded-lg flex items-center justify-between group hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar || ""} />
                              <AvatarFallback className={role?.color + " text-white"}>
                                {user.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-slate-500">{user.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={role?.color + " text-white"}>
                              {role?.name}
                            </Badge>
                            <Badge className={getStatusColor(user.status)}>
                              {user.status}
                            </Badge>
                            <span className="text-xs text-slate-400 hidden md:block">
                              {user.department}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => updateUser(user.id, { status: user.status === "active" ? "inactive" : "active" })}>
                                {user.status === "active" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteUser(user.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Role Management</CardTitle>
                  <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Role
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Role</DialogTitle>
                        <DialogDescription>Define a new role with custom permissions</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Role Name</Label>
                          <Input placeholder="e.g., Lab Technician" />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea placeholder="Describe the role and its access level..." />
                        </div>
                      </div>
                      <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
                        <Button onClick={() => addRole({ name: "Custom Role", description: "Custom role", color: "bg-slate-500" })}>Create Role</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map((role) => (
                    <Card key={role.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRole(role)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg ${role.color} flex items-center justify-center`}>
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{role.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <span className="text-xs text-slate-400">
                            {Object.values(role.permissions).flat().length} permissions
                          </span>
                          <span className="text-xs text-slate-400">
                            {users.filter(u => u.role === role.id).length} users
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-indigo-500" />
                  Permission Matrix
                </CardTitle>
                <CardDescription>Configure permissions for each role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(PERMISSION_CATEGORIES).map(([categoryId, category]) => {
                    const CategoryIcon = category.icon;
                    const isExpanded = expandedCategories.includes(categoryId);
                    
                    return (
                      <div key={categoryId} className="border rounded-lg">
                        <button
                          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                          onClick={() => toggleCategory(categoryId)}
                        >
                          <div className="flex items-center gap-3">
                            <CategoryIcon className="h-5 w-5 text-slate-500" />
                            <span className="font-medium">{category.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {category.permissions.length} actions
                            </Badge>
                          </div>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4 pt-0">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2 font-medium">Permission</th>
                                    {roles.slice(0, 4).map(role => (
                                      <th key={role.id} className="text-center p-2 font-medium">
                                        <Badge className={role.color + " text-white text-xs"}>
                                          {role.name}
                                        </Badge>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {category.permissions.map(perm => (
                                    <tr key={perm} className="border-b last:border-0">
                                      <td className="p-2 text-slate-600 capitalize">{perm.replace("-", " ")}</td>
                                      {roles.slice(0, 4).map(role => (
                                        <td key={role.id} className="text-center p-2">
                                          {role.permissions[categoryId]?.includes(perm) ? (
                                            <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                                          ) : (
                                            <XCircle className="h-5 w-5 text-slate-300 mx-auto" />
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Security Notice */}
        <Alert className="bg-indigo-50 border-indigo-200">
          <Shield className="h-4 w-4 text-indigo-500" />
          <AlertTitle className="text-indigo-700">Security Best Practices</AlertTitle>
          <AlertDescription className="text-indigo-600">
            Follow the principle of least privilege. Grant users only the minimum permissions needed for their role.
            Regularly audit user access and remove inactive accounts.
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}
