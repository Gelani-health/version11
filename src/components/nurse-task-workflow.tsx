"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Activity,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Plus,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  RotateCcw,
  Trash2,
  Edit,
  MoreVertical,
  Pill,
  Heart,
  Thermometer,
  BedDouble,
  Utensils,
  Droplets,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types
interface NurseTask {
  id: string;
  patientId: string;
  soapNoteId?: string;
  taskDescription: string;
  priority: "routine" | "urgent" | "stat";
  status: "pending" | "in-progress" | "completed" | "cancelled";
  assignedTo?: string;
  assignedBy: string;
  assignedAt: string;
  dueBy?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  assignee?: {
    employeeId: string;
    firstName: string;
    lastName: string;
  };
}

interface TaskTemplate {
  id: string;
  name: string;
  priority: "routine" | "urgent" | "stat";
}

interface NurseTaskWorkflowProps {
  patientId?: string | null;
  soapNoteId?: string | null;
  employeeId?: string;
  employeeName?: string;
}

// Task category icons
const categoryIcons: Record<string, React.ReactNode> = {
  vital_signs: <Thermometer className="h-4 w-4" />,
  medication: <Pill className="h-4 w-4" />,
  assessment: <ClipboardList className="h-4 w-4" />,
  hygiene: <BedDouble className="h-4 w-4" />,
  mobility: <Activity className="h-4 w-4" />,
  nutrition: <Utensils className="h-4 w-4" />,
  elimination: <Droplets className="h-4 w-4" />,
  documentation: <FileText className="h-4 w-4" />,
};

// Task templates organized by category
const TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  vital_signs: [
    { id: "vitals_complete", name: "Complete Vital Signs Check", priority: "routine" },
    { id: "vitals_post_med", name: "Post-Medication Vitals", priority: "routine" },
    { id: "vitals_neuro", name: "Neurological Vitals", priority: "urgent" },
    { id: "vitals_post_op", name: "Post-Operative Vitals", priority: "urgent" },
  ],
  medication: [
    { id: "med_admin", name: "Medication Administration", priority: "routine" },
    { id: "med_iv_start", name: "Start IV Line", priority: "routine" },
    { id: "med_iv_site_check", name: "IV Site Assessment", priority: "routine" },
    { id: "med_blood_transfusion", name: "Blood Transfusion Monitoring", priority: "stat" },
    { id: "med_insulin_admin", name: "Insulin Administration", priority: "urgent" },
  ],
  assessment: [
    { id: "assess_pain", name: "Pain Assessment", priority: "routine" },
    { id: "assess_skin", name: "Skin Integrity Assessment", priority: "routine" },
    { id: "assess_fall_risk", name: "Fall Risk Assessment", priority: "routine" },
    { id: "assess_swallowing", name: "Swallowing Assessment", priority: "urgent" },
    { id: "assess_mental", name: "Mental Status Assessment", priority: "routine" },
  ],
  hygiene: [
    { id: "hygiene_bed_bath", name: "Bed Bath", priority: "routine" },
    { id: "hygiene_oral_care", name: "Oral Care", priority: "routine" },
    { id: "hygiene_hair_care", name: "Hair Care", priority: "routine" },
    { id: "hygiene_perineal", name: "Perineal Care", priority: "routine" },
  ],
  mobility: [
    { id: "mobility_reposition", name: "Reposition Patient", priority: "routine" },
    { id: "mobility_transfer", name: "Patient Transfer", priority: "routine" },
    { id: "mobility_ambulate", name: "Ambulation Assistance", priority: "routine" },
    { id: "mobility_rom", name: "Range of Motion Exercises", priority: "routine" },
  ],
  nutrition: [
    { id: "nut_meal_assist", name: "Meal Assistance", priority: "routine" },
    { id: "nut_fluid_balance", name: "Fluid Balance Monitoring", priority: "routine" },
    { id: "nut_tube_feed", name: "Tube Feeding Administration", priority: "urgent" },
  ],
  elimination: [
    { id: "elim_catheter_care", name: "Catheter Care", priority: "routine" },
    { id: "elim_output_measure", name: "Measure Output", priority: "routine" },
    { id: "elim_bowel", name: "Bowel Management", priority: "routine" },
  ],
  documentation: [
    { id: "doc_chart_update", name: "Update Patient Chart", priority: "routine" },
    { id: "doc_intake_output", name: "Document Intake/Output", priority: "routine" },
  ],
};

const priorityColors = {
  stat: "bg-red-100 text-red-700 border-red-200",
  urgent: "bg-amber-100 text-amber-700 border-amber-200",
  routine: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusColors = {
  pending: "bg-slate-100 text-slate-700",
  "in-progress": "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export function NurseTaskWorkflow({
  patientId,
  soapNoteId,
  employeeId = "demo-nurse",
  employeeName = "Nurse Demo",
}: NurseTaskWorkflowProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<NurseTask[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [newTaskNotes, setNewTaskNotes] = useState("");

  useEffect(() => {
    if (patientId) {
      fetchTasks();
    }
  }, [patientId, statusFilter]);

  const fetchTasks = async () => {
    if (!patientId) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ patientId });
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      const response = await fetch(`/api/nurse-tasks?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data.tasks || []);
        setStats(data.data.stats || {});
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTask = async (template: TaskTemplate, notes: string) => {
    if (!patientId) return;

    try {
      const response = await fetch("/api/nurse-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          soapNoteId,
          taskDescription: template.name,
          priority: template.priority,
          notes,
          assignedBy: employeeId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Task Created",
          description: `Task "${template.name}" has been added`,
        });
        fetchTasks();
        setShowAddDialog(false);
        setSelectedTemplate(null);
        setNewTaskNotes("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await fetch("/api/nurse-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          status,
          completedBy: employeeId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Task Updated",
          description: `Task marked as ${status}`,
        });
        fetchTasks();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/nurse-tasks?taskId=${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({ title: "Task Deleted" });
        fetchTasks();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.taskDescription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTask = (task: NurseTask) => (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "rounded-lg border p-4 transition-all",
        task.priority === "stat" && "border-red-300 bg-red-50",
        task.priority === "urgent" && "border-amber-300 bg-amber-50",
        task.status === "completed" && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn(
              "font-medium",
              task.status === "completed" && "line-through text-slate-500"
            )}>
              {task.taskDescription}
            </h4>
            <Badge className={priorityColors[task.priority]}>
              {task.priority.toUpperCase()}
            </Badge>
            <Badge className={statusColors[task.status]}>
              {task.status.replace("-", " ")}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(task.assignedAt).toLocaleTimeString()}
            </span>
            {task.dueBy && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {new Date(task.dueBy).toLocaleString()}
              </span>
            )}
            {task.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignee.firstName} {task.assignee.lastName}
              </span>
            )}
          </div>
          
          {task.notes && (
            <p className="text-sm text-slate-600 mt-2 italic">{task.notes}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {task.status === "pending" && (
              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "in-progress")}>
                <Activity className="h-4 w-4 mr-2" />
                Start Task
              </DropdownMenuItem>
            )}
            {task.status === "in-progress" && (
              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "completed")}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete
              </DropdownMenuItem>
            )}
            {task.status !== "completed" && task.status !== "cancelled" && (
              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "cancelled")}>
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel
              </DropdownMenuItem>
            )}
            {task.status === "completed" && (
              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, "pending")}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-purple-500" />
            Nursing Tasks
          </h2>
          <p className="text-slate-500">Workflow management for patient care tasks</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          disabled={!patientId}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      {!patientId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Select a Patient</h3>
            <p className="text-sm text-slate-500">
              Select a patient to manage their nursing tasks
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-slate-800">
                  {stats.pending || 0}
                </div>
                <p className="text-sm text-slate-500">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-blue-600">
                  {stats["in-progress"] || 0}
                </div>
                <p className="text-sm text-slate-500">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-emerald-600">
                  {stats.completed || 0}
                </div>
                <p className="text-sm text-slate-500">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-slate-800">
                  {tasks.length}
                </div>
                <p className="text-sm text-slate-500">Total Tasks</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchTasks}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>

          {/* Task List */}
          <ScrollArea className="h-[500px] pr-4">
            <AnimatePresence>
              {filteredTasks.length > 0 ? (
                <div className="space-y-3">
                  {filteredTasks.map(renderTask)}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-slate-600">
                      {searchQuery ? "No tasks match your search" : "No tasks for this patient"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </AnimatePresence>
          </ScrollArea>
        </>
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Nursing Task</DialogTitle>
            <DialogDescription>
              Select from 28 standardized nursing tasks organized by category
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="vital_signs" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              {Object.keys(TASK_TEMPLATES).map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs">
                  {categoryIcons[category]}
                  <span className="ml-1 hidden md:inline">
                    {category.replace("_", " ")}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(TASK_TEMPLATES).map(([category, templates]) => (
              <TabsContent key={category} value={category} className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedTemplate?.id === template.id && "ring-2 ring-purple-500"
                      )}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{template.name}</span>
                          <Badge className={priorityColors[template.priority]}>
                            {template.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {selectedTemplate && (
            <div className="mt-4 space-y-3">
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Optional notes for this task..."
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTemplate && createTask(selectedTemplate, newTaskNotes)}
              disabled={!selectedTemplate}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default NurseTaskWorkflow;
