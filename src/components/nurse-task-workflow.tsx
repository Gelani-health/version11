'use client';

/**
 * Nurse Task Workflow Engine Component
 * =====================================
 *
 * Comprehensive nursing task management interface with:
 * - Task board (Kanban-style)
 * - Task list view
 * - Task creation and assignment
 * - Status workflow transitions
 * - Priority visualization
 * - Real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Filter,
  Search,
  MoreVertical,
  Play,
  Pause,
  XCircle,
  ChevronRight,
  ClipboardList,
  Activity,
  Pill,
  Bandage,
  Stethoscope,
  FileText,
  Syringe,
  Heart,
  Brain,
  Lungs,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// Types
interface NurseTask {
  id: string;
  patientId: string;
  soapNoteId?: string;
  taskDescription: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  assignedBy: string;
  assignedTo?: string;
  assignedAt: Date;
  dueBy?: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  };
  assignee?: {
    employeeId: string;
    firstName: string;
    lastName: string;
  };
  assigner?: {
    employeeId: string;
    firstName: string;
    lastName: string;
  };
}

interface TaskType {
  id: string;
  name: string;
  category: string;
  defaultPriority: string;
  estimatedMinutes: number;
}

interface TaskStats {
  totalPending: number;
  totalInProgress: number;
  totalOverdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  monitoring: <Activity className="h-4 w-4" />,
  medication: <Pill className="h-4 w-4" />,
  wound_care: <Bandage className="h-4 w-4" />,
  patient_care: <Heart className="h-4 w-4" />,
  specimen: <Syringe className="h-4 w-4" />,
  respiratory: <Lungs className="h-4 w-4" />,
  education: <Brain className="h-4 w-4" />,
  documentation: <FileText className="h-4 w-4" />,
};

// Priority colors
const priorityColors = {
  stat: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  urgent: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  routine: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
};

// Status colors
const statusColors = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export default function NurseTaskWorkflow() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<NurseTask[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    totalPending: 0,
    totalInProgress: 0,
    totalOverdue: 0,
    byStatus: {},
    byPriority: {},
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<NurseTask | null>(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    patientId: '',
    taskDescription: '',
    taskType: '',
    priority: 'routine' as 'routine' | 'urgent' | 'stat',
    assignedTo: '',
    dueBy: '',
    notes: '',
  });

  // Completion form state
  const [completionNotes, setCompletionNotes] = useState('');

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterPriority !== 'all') params.append('priority', filterPriority);

      const response = await fetch(`/api/nurse-tasks?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
        setTaskTypes(data.taskTypes || []);
        setStats(data.statistics || stats);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, toast, stats]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks by search
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.taskDescription.toLowerCase().includes(query) ||
      task.patient?.firstName?.toLowerCase().includes(query) ||
      task.patient?.lastName?.toLowerCase().includes(query) ||
      task.patient?.mrn?.toLowerCase().includes(query)
    );
  });

  // Group tasks by status for board view
  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    'in-progress': filteredTasks.filter(t => t.status === 'in-progress'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
    cancelled: filteredTasks.filter(t => t.status === 'cancelled'),
  };

  // Create task
  const handleCreateTask = async () => {
    try {
      const response = await fetch('/api/nurse-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          assignedBy: 'current-user', // In production, get from auth
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Task created successfully',
        });
        setIsCreateDialogOpen(false);
        setNewTask({
          patientId: '',
          taskDescription: '',
          taskType: '',
          priority: 'routine',
          assignedTo: '',
          dueBy: '',
          notes: '',
        });
        fetchTasks();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create task',
        variant: 'destructive',
      });
    }
  };

  // Update task status
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/nurse-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          updates: { status: newStatus },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Task marked as ${newStatus}`,
        });
        fetchTasks();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    }
  };

  // Complete task
  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    try {
      const response = await fetch('/api/nurse-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          updates: { status: 'completed' },
          completedBy: 'current-user',
          completionNotes,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Task completed successfully',
        });
        setIsCompleteDialogOpen(false);
        setSelectedTask(null);
        setCompletionNotes('');
        fetchTasks();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };

  // Check if task is overdue
  const isOverdue = (task: NurseTask) => {
    if (!task.dueBy || task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueBy) < new Date();
  };

  // Format time
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Task Card Component
  const TaskCard = ({ task }: { task: NurseTask }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${
        isOverdue(task) ? 'border-red-300 dark:border-red-800' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{task.taskDescription}</p>
          {task.patient && (
            <p className="text-xs text-muted-foreground mt-1">
              {task.patient.firstName} {task.patient.lastName}
              {task.patient.mrn && ` (${task.patient.mrn})`}
            </p>
          )}
        </div>
        <Badge className={priorityColors[task.priority]} variant="outline">
          {task.priority.toUpperCase()}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {task.dueBy ? formatTime(task.dueBy) : 'No due time'}
        </span>
        {isOverdue(task) && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">
            OVERDUE
          </Badge>
        )}
      </div>

      {task.assignee && (
        <div className="flex items-center gap-2 mt-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">
              {task.assignee.firstName[0]}{task.assignee.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {task.assignee.firstName} {task.assignee.lastName}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 mt-3">
        {task.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => handleUpdateStatus(task.id, 'in-progress')}
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}
        {task.status === 'in-progress' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => {
              setSelectedTask(task);
              setIsCompleteDialogOpen(true);
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleUpdateStatus(task.id, 'cancelled')}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );

  // Column Component for Board View
  const TaskColumn = ({ 
    title, 
    status, 
    tasks, 
    icon 
  }: { 
    title: string; 
    status: string; 
    tasks: NurseTask[]; 
    icon: React.ReactNode;
  }) => (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="space-y-2 pr-2">
          <AnimatePresence mode="popLayout">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tasks
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Nurse Task Engine
          </h2>
          <p className="text-muted-foreground">
            Manage nursing workflow tasks and assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchTasks}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.totalPending}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.totalInProgress}</p>
              </div>
              <Play className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500">{stats.totalOverdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{tasks.filter(t => 
                  new Date(t.assignedAt).toDateString() === new Date().toDateString()
                ).length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="stat">STAT</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="routine">Routine</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'board' | 'list')}>
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Task Board/List */}
      {viewMode === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <TaskColumn
            title="Pending"
            status="pending"
            tasks={tasksByStatus.pending}
            icon={<Clock className="h-5 w-5 text-gray-400" />}
          />
          <TaskColumn
            title="In Progress"
            status="in-progress"
            tasks={tasksByStatus['in-progress']}
            icon={<Play className="h-5 w-5 text-yellow-500" />}
          />
          <TaskColumn
            title="Completed"
            status="completed"
            tasks={tasksByStatus.completed}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          />
          <TaskColumn
            title="Cancelled"
            status="cancelled"
            tasks={tasksByStatus.cancelled}
            icon={<XCircle className="h-5 w-5 text-red-400" />}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                  <tr>
                    <th className="text-left p-3 font-medium">Task</th>
                    <th className="text-left p-3 font-medium">Patient</th>
                    <th className="text-left p-3 font-medium">Priority</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Assigned To</th>
                    <th className="text-left p-3 font-medium">Due</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm">{task.taskDescription}</p>
                          {task.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {task.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {task.patient && (
                          <span>
                            {task.patient.firstName} {task.patient.lastName}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={priorityColors[task.priority]} variant="outline">
                          {task.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={statusColors[task.status]}>
                          {task.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span>{task.assignee.firstName} {task.assignee.lastName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {task.dueBy ? (
                          <span className={isOverdue(task) ? 'text-red-500' : ''}>
                            {formatTime(task.dueBy)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {task.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(task.id, 'in-progress')}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {task.status === 'in-progress' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedTask(task);
                                setIsCompleteDialogOpen(true);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Assign a new nursing task to be completed
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Task Type</label>
              <Select 
                value={newTask.taskType} 
                onValueChange={(value) => {
                  const taskType = taskTypes.find(t => t.id === value);
                  setNewTask(prev => ({
                    ...prev,
                    taskType: value,
                    priority: taskType?.defaultPriority as any || prev.priority,
                    taskDescription: taskType?.name || prev.taskDescription,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        {categoryIcons[type.category]}
                        <span>{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({type.estimatedMinutes} min)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newTask.taskDescription}
                onChange={(e) => setNewTask(prev => ({ ...prev, taskDescription: e.target.value }))}
                placeholder="Task description..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value: any) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="stat">STAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due By</label>
                <Input
                  type="datetime-local"
                  value={newTask.dueBy}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueBy: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Patient ID</label>
              <Input
                value={newTask.patientId}
                onChange={(e) => setNewTask(prev => ({ ...prev, patientId: e.target.value }))}
                placeholder="Enter patient ID"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Input
                value={newTask.assignedTo}
                onChange={(e) => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="Employee ID (optional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newTask.notes}
                onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              Add completion notes for this task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTask && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="font-medium">{selectedTask.taskDescription}</p>
                {selectedTask.patient && (
                  <p className="text-sm text-muted-foreground">
                    Patient: {selectedTask.patient.firstName} {selectedTask.patient.lastName}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Completion Notes</label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Document task completion details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteTask}>Mark Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
