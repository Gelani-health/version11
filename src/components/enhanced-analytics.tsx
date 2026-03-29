"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Stethoscope,
  Pill,
  Calendar,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Download,
  Filter,
  Eye,
  BarChart,
  LineChart,
  PieChart,
  Brain,
  Heart,
  FileText,
  Database,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Types
interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  color: string;
  trend: "up" | "down" | "neutral";
}

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

interface PatientOutcome {
  id: string;
  patientName: string;
  condition: string;
  startDate: Date;
  status: "improving" | "stable" | "declining";
  milestones: { date: Date; description: string; achieved: boolean }[];
}

export function EnhancedAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setLastUpdated] = useState<Date>(new Date());

  // Simulated real-time metrics
  const [metrics] = useState<MetricCard[]>([
    { title: "Patients Today", value: 47, change: 12, changeLabel: "vs yesterday", icon: Users, color: "emerald", trend: "up" },
    { title: "Consultations", value: 156, change: 8, changeLabel: "this week", icon: Stethoscope, color: "blue", trend: "up" },
    { title: "Avg Wait Time", value: "14m", change: -3, changeLabel: "vs last week", icon: Clock, color: "purple", trend: "down" },
    { title: "AI Accuracy", value: "94.2%", change: 2.1, changeLabel: "this month", icon: Brain, color: "rose", trend: "up" },
    { title: "Drug Alerts", value: 23, change: -15, changeLabel: "vs last week", icon: Pill, color: "orange", trend: "down" },
    { title: "Revenue", value: "$12,450", change: 18, changeLabel: "this week", icon: DollarSign, color: "teal", trend: "up" },
  ]);

  // Weekly patient visits data
  const weeklyVisits: ChartData[] = [
    { label: "Mon", value: 45 },
    { label: "Tue", value: 52 },
    { label: "Wed", value: 48 },
    { label: "Thu", value: 61 },
    { label: "Fri", value: 55 },
    { label: "Sat", value: 38 },
    { label: "Sun", value: 24 },
  ];

  // Department distribution
  const departmentData: ChartData[] = [
    { label: "General Medicine", value: 35, color: "bg-emerald-500" },
    { label: "Pediatrics", value: 22, color: "bg-blue-500" },
    { label: "Obstetrics", value: 18, color: "bg-purple-500" },
    { label: "Surgery", value: 15, color: "bg-rose-500" },
    { label: "Emergency", value: 10, color: "bg-orange-500" },
  ];

  // AI Performance metrics
  const aiMetrics = [
    { name: "Diagnosis Accuracy", value: 94.2, target: 95 },
    { name: "Drug Interaction Detection", value: 98.7, target: 99 },
    { name: "Documentation Quality", value: 91.5, target: 90 },
    { name: "Voice Recognition", value: 96.3, target: 95 },
    { name: "Code Suggestion Accuracy", value: 88.9, target: 90 },
  ];

  // Patient outcomes
  const patientOutcomes: PatientOutcome[] = [
    {
      id: "1",
      patientName: "John Doe",
      condition: "Type 2 Diabetes",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: "improving",
      milestones: [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), description: "Initial consultation", achieved: true },
        { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), description: "Medication adjusted", achieved: true },
        { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), description: "HbA1c improved", achieved: true },
        { date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), description: "Follow-up scheduled", achieved: false },
      ],
    },
    {
      id: "2",
      patientName: "Jane Smith",
      condition: "Hypertension",
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      status: "stable",
      milestones: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), description: "Diagnosis confirmed", achieved: true },
        { date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), description: "Treatment started", achieved: true },
        { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), description: "BP normalized", achieved: true },
      ],
    },
    {
      id: "3",
      patientName: "Mike Johnson",
      condition: "Chronic Back Pain",
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      status: "declining",
      milestones: [
        { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), description: "Initial assessment", achieved: true },
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), description: "Physical therapy started", achieved: true },
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), description: "MRI scheduled", achieved: false },
      ],
    },
  ];

  // Resource utilization
  const resourceUtilization = [
    { resource: "Consultation Rooms", utilized: 85, total: 12 },
    { resource: "Lab Equipment", utilized: 72, total: 8 },
    { resource: "Imaging Machines", utilized: 90, total: 4 },
    { resource: "Hospital Beds", utilized: 68, total: 50 },
    { resource: "ICU Beds", utilized: 95, total: 10 },
  ];

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdated(new Date());
    setIsRefreshing(false);
    toast.success("Analytics data refreshed");
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case "down":
        return <ArrowDown className="h-4 w-4 text-rose-500" />;
      default:
        return <Minus className="h-4 w-4 text-slate-400" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "improving":
        return "text-emerald-500 bg-emerald-100";
      case "stable":
        return "text-blue-500 bg-blue-100";
      case "declining":
        return "text-rose-500 bg-rose-100";
      default:
        return "text-slate-500 bg-slate-100";
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-cyan-500" />
              Clinical Analytics
            </h2>
            <p className="text-slate-500 mt-1">Real-time insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className={`h-5 w-5 text-${metric.color}-500`} />
                    {getTrendIcon(metric.trend)}
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{metric.value}</div>
                  <div className="text-sm text-slate-500">{metric.title}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        metric.change > 0 
                          ? "text-emerald-600 border-emerald-200" 
                          : metric.change < 0 
                            ? "text-rose-600 border-rose-200"
                            : "text-slate-600"
                      }`}
                    >
                      {metric.change > 0 ? "+" : ""}{metric.change}%
                    </Badge>
                    <span className="text-xs text-slate-400">{metric.changeLabel}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai-performance">AI Performance</TabsTrigger>
            <TabsTrigger value="outcomes">Patient Outcomes</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Weekly Visits Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-emerald-500" />
                    Weekly Patient Visits
                  </CardTitle>
                  <CardDescription>Patient visits over the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between h-48 gap-2">
                    {weeklyVisits.map((day, index) => {
                      const max = Math.max(...weeklyVisits.map(d => d.value));
                      const height = (day.value / max) * 100;
                      return (
                        <div key={day.label} className="flex-1 flex flex-col items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-lg cursor-pointer hover:from-emerald-600 hover:to-teal-500 transition-colors"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{day.value} visits</p>
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-xs text-slate-500">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Department Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-500" />
                    Department Distribution
                  </CardTitle>
                  <CardDescription>Patient distribution by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {departmentData.map((dept, index) => (
                      <div key={dept.label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${dept.color}`} />
                        <span className="flex-1 text-sm text-slate-600">{dept.label}</span>
                        <div className="w-32">
                          <Progress value={dept.value} className="h-2" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-10 text-right">{dept.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-500" />
                  Real-time Activity
                </CardTitle>
                <CardDescription>Current system activity and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-700">Active Consultations</span>
                    </div>
                    <div className="text-3xl font-bold text-emerald-700">12</div>
                    <div className="text-xs text-emerald-600 mt-1">3 in waiting</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">AI Processing</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-700">8</div>
                    <div className="text-xs text-blue-600 mt-1">4 diagnosis, 4 drug checks</div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-700">Pending Alerts</span>
                    </div>
                    <div className="text-3xl font-bold text-amber-700">5</div>
                    <div className="text-xs text-amber-600 mt-1">2 drug, 3 follow-up</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Performance Tab */}
          <TabsContent value="ai-performance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI Model Performance
                </CardTitle>
                <CardDescription>Performance metrics for AI-powered features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiMetrics.map((metric, index) => (
                    <motion.div
                      key={metric.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${metric.value >= metric.target ? "text-emerald-600" : "text-amber-600"}`}>
                            {metric.value}%
                          </span>
                          <span className="text-xs text-slate-400">target: {metric.target}%</span>
                        </div>
                      </div>
                      <Progress 
                        value={metric.value} 
                        className={`h-2 ${metric.value >= metric.target ? "bg-emerald-100" : "bg-amber-100"}`}
                      />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  All AI models operating within acceptable parameters
                </div>
              </CardFooter>
            </Card>

            {/* AI Usage Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Zap className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">1,247</div>
                      <div className="text-sm text-slate-500">AI Queries Today</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">98.5%</div>
                      <div className="text-sm text-slate-500">Uptime</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">0.8s</div>
                      <div className="text-sm text-slate-500">Avg Response</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Patient Outcomes Tab */}
          <TabsContent value="outcomes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-rose-500" />
                  Patient Outcome Tracking
                </CardTitle>
                <CardDescription>Track patient progress and treatment effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {patientOutcomes.map((outcome) => (
                      <Card key={outcome.id} className="border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="font-semibold text-slate-800">{outcome.patientName}</div>
                              <div className="text-sm text-slate-500">{outcome.condition}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                Started: {outcome.startDate.toLocaleDateString()}
                              </div>
                            </div>
                            <Badge className={getStatusColor(outcome.status)}>
                              {outcome.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            {outcome.milestones.map((milestone, index) => (
                              <div key={index} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  milestone.achieved 
                                    ? "bg-emerald-100 text-emerald-600" 
                                    : "bg-slate-100 text-slate-400"
                                }`}>
                                  {milestone.achieved ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <Clock className="h-3 w-3" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className={`text-sm ${milestone.achieved ? "text-slate-700" : "text-slate-400"}`}>
                                    {milestone.description}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  {milestone.date.toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Outcome Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Improving</div>
                      <div className="text-2xl font-bold text-emerald-600">67%</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Stable</div>
                      <div className="text-2xl font-bold text-blue-600">28%</div>
                    </div>
                    <Minus className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-rose-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Needs Attention</div>
                      <div className="text-2xl font-bold text-rose-600">5%</div>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-500" />
                  Resource Utilization
                </CardTitle>
                <CardDescription>Current utilization of hospital resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resourceUtilization.map((resource, index) => (
                    <div key={resource.resource} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">{resource.resource}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            resource.utilized >= 90 
                              ? "text-rose-600" 
                              : resource.utilized >= 70 
                                ? "text-amber-600" 
                                : "text-emerald-600"
                          }`}>
                            {resource.utilized}%
                          </span>
                          <span className="text-xs text-slate-400">
                            ({Math.round(resource.utilized * resource.total / 100)}/{resource.total})
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={resource.utilized} 
                        className={`h-2 ${
                          resource.utilized >= 90 
                            ? "bg-rose-100" 
                            : resource.utilized >= 70 
                              ? "bg-amber-100" 
                              : "bg-emerald-100"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Resource Alerts */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border border-rose-200 bg-rose-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-rose-700">High Utilization Alert</div>
                      <div className="text-sm text-rose-600 mt-1">
                        ICU Beds at 95% capacity. Consider patient discharge planning.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-700">Maintenance Scheduled</div>
                      <div className="text-sm text-amber-600 mt-1">
                        Imaging Machine #2 scheduled for maintenance tomorrow at 2:00 PM.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
