"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  Clock,
  Activity,
  FileText,
  Eye,
  Edit,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  UserCog,
  Building2,
  Calendar,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getRoleDisplayName,
  getRoleBadgeColor,
  type UserRole,
  type Permission,
  getRolePermissions,
} from "@/lib/rbac-middleware";

// ============================================
// TYPES
// ============================================

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment?: string;
  
  actionType: "create" | "read" | "update" | "delete" | "sign" | "amend" | "export";
  resourceType: string;
  resourceId?: string;
  patientMrn?: string;
  
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

interface StaffIdentityCardProps {
  employeeId?: string;
  employeeName?: string;
  employeeRole?: UserRole;
  department?: string;
  showAuditLog?: boolean;
  patientMrn?: string;
}

// ============================================
// ACTION TYPE CONFIG
// ============================================

const getActionConfig = (action: string) => {
  switch (action) {
    case "create":
      return {
        color: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle className="h-3 w-3" />,
        label: "Created",
      };
    case "read":
      return {
        color: "bg-blue-100 text-blue-700 border-blue-200",
        icon: <Eye className="h-3 w-3" />,
        label: "Viewed",
      };
    case "update":
      return {
        color: "bg-amber-100 text-amber-700 border-amber-200",
        icon: <Edit className="h-3 w-3" />,
        label: "Updated",
      };
    case "delete":
      return {
        color: "bg-red-100 text-red-700 border-red-200",
        icon: <AlertTriangle className="h-3 w-3" />,
        label: "Deleted",
      };
    case "sign":
      return {
        color: "bg-purple-100 text-purple-700 border-purple-200",
        icon: <Lock className="h-3 w-3" />,
        label: "Signed",
      };
    case "amend":
      return {
        color: "bg-orange-100 text-orange-700 border-orange-200",
        icon: <Edit className="h-3 w-3" />,
        label: "Amended",
      };
    case "export":
      return {
        color: "bg-cyan-100 text-cyan-700 border-cyan-200",
        icon: <Download className="h-3 w-3" />,
        label: "Exported",
      };
    default:
      return {
        color: "bg-slate-100 text-slate-700 border-slate-200",
        icon: <Activity className="h-3 w-3" />,
        label: action,
      };
  }
};

const getResourceIcon = (resource: string) => {
  switch (resource) {
    case "patient":
      return <User className="h-4 w-4" />;
    case "soap_note":
      return <FileText className="h-4 w-4" />;
    case "vitals":
      return <Activity className="h-4 w-4" />;
    case "prescription":
      return <FileText className="h-4 w-4" />;
    case "clinical_order":
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

export function StaffIdentityCard({
  employeeId,
  employeeName,
  employeeRole,
  department,
  showAuditLog = true,
  patientMrn,
}: StaffIdentityCardProps) {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  useEffect(() => {
    if (showAuditLog) {
      fetchAuditLogs();
    }
  }, [showAuditLog, patientMrn, employeeId]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        ...(patientMrn && { patientMrn }),
        ...(employeeId && { actorId: employeeId }),
        limit: "100",
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setAuditLogs(data.data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = actionFilter === "all" || log.actionType === actionFilter;
    const matchesResource = resourceFilter === "all" || log.resourceType === resourceFilter;
    return matchesAction && matchesResource;
  });

  // Group by date
  const groupedLogs = filteredLogs.reduce((groups, log) => {
    const date = format(parseISO(log.timestamp), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, AuditLogEntry[]>);

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // Get permissions for role
  const permissions = employeeRole ? getRolePermissions(employeeRole) : [];

  return (
    <div className="space-y-4">
      {/* Staff Identity Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
              <UserCog className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Staff Identity & Attribution</CardTitle>
              <CardDescription>
                Current session user and access privileges
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className={cn(
                  "text-lg font-bold",
                  employeeRole ? getRoleBadgeColor(employeeRole) : "bg-slate-100 text-slate-700"
                )}>
                  {employeeName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "??"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{employeeName || "Unknown User"}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className={employeeRole ? getRoleBadgeColor(employeeRole) : ""}>
                    {employeeRole ? getRoleDisplayName(employeeRole) : "Unknown Role"}
                  </Badge>
                  {department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {department}
                    </span>
                  )}
                </div>
                {employeeId && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Employee ID: {employeeId}
                  </div>
                )}
              </div>
            </div>

            {/* Permissions Summary */}
            {permissions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {permissions.slice(0, 5).map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-xs">
                    {perm.split(":")[0]}
                  </Badge>
                ))}
                {permissions.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{permissions.length - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Session Info */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Session Started</div>
                <div className="font-medium">{format(new Date(), "MMM dd, HH:mm")}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Authentication</div>
                <div className="font-medium flex items-center gap-1">
                  <Shield className="h-3 w-3 text-green-500" />
                  Verified
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Access Level</div>
                <div className="font-medium capitalize">{employeeRole || "Standard"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Can Sign Notes</div>
                <div className="font-medium">
                  {employeeRole && ["doctor", "specialist", "admin"].includes(employeeRole) ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> No
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      {showAuditLog && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base">Audit Trail</CardTitle>
                  <CardDescription>
                    Immutable record of all actions • {filteredLogs.length} entries
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Created</SelectItem>
                    <SelectItem value="read">Viewed</SelectItem>
                    <SelectItem value="update">Updated</SelectItem>
                    <SelectItem value="sign">Signed</SelectItem>
                    <SelectItem value="amend">Amended</SelectItem>
                    <SelectItem value="export">Exported</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={resourceFilter} onValueChange={setResourceFilter}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="soap_note">SOAP Note</SelectItem>
                    <SelectItem value="vitals">Vitals</SelectItem>
                    <SelectItem value="prescription">Prescription</SelectItem>
                    <SelectItem value="clinical_order">Orders</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAuditLogs}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No audit entries found</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-6 pr-4">
                  {sortedDates.map((date) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white py-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {isToday(parseISO(date)) && "Today"}
                          {isYesterday(parseISO(date)) && "Yesterday"}
                          {!isToday(parseISO(date)) && !isYesterday(parseISO(date)) && format(parseISO(date), "EEEE, MMMM dd, yyyy")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {groupedLogs[date].length}
                        </Badge>
                      </div>

                      {/* Log Entries */}
                      <div className="space-y-2">
                        {groupedLogs[date].map((log) => {
                          const actionConfig = getActionConfig(log.actionType);
                          const isExpanded = expandedLog === log.id;

                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={cn(
                                "p-3 border rounded-lg bg-white transition-all cursor-pointer",
                                isExpanded && "ring-2 ring-blue-200"
                              )}
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  {/* Action Icon */}
                                  <div className={cn("p-2 rounded-lg", actionConfig.color)}>
                                    {actionConfig.icon}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={cn("text-xs", actionConfig.color)}>
                                        {actionConfig.label}
                                      </Badge>
                                      <span className="text-sm capitalize">
                                        {log.resourceType.replace("_", " ")}
                                      </span>
                                    </div>

                                    {/* Actor Info */}
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-xs">
                                          {log.actorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{log.actorName}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {log.actorRole}
                                      </Badge>
                                    </div>

                                    {/* Field Changed */}
                                    {log.fieldChanged && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Field: <span className="font-mono">{log.fieldChanged}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Time */}
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-mono">
                                    {format(parseISO(log.timestamp), "HH:mm:ss")}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Details */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-3 pt-3 border-t"
                                  >
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <div className="text-xs text-muted-foreground">Resource ID</div>
                                        <div className="font-mono text-xs">{log.resourceId || "—"}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Patient MRN</div>
                                        <div className="font-mono text-xs">{log.patientMrn || "—"}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">IP Address</div>
                                        <div className="font-mono text-xs">{log.ipAddress || "—"}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Department</div>
                                        <div className="text-xs">{log.actorDepartment || "—"}</div>
                                      </div>
                                    </div>

                                    {/* Value Changes */}
                                    {(log.oldValue || log.newValue) && (
                                      <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
                                        {log.oldValue && (
                                          <div className="text-red-600">
                                            <span className="font-medium">Old:</span> {log.oldValue}
                                          </div>
                                        )}
                                        {log.newValue && (
                                          <div className="text-green-600 mt-1">
                                            <span className="font-medium">New:</span> {log.newValue}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StaffIdentityCard;
