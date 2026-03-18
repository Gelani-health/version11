"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Activity,
  Brain,
  FileText,
  Pill,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

// Mock data for charts
const patientVisitsData = [
  { name: "Mon", visits: 24 },
  { name: "Tue", visits: 31 },
  { name: "Wed", visits: 28 },
  { name: "Thu", visits: 35 },
  { name: "Fri", visits: 42 },
  { name: "Sat", visits: 18 },
  { name: "Sun", visits: 12 },
];

const aiUsageData = [
  { name: "Week 1", diagnosis: 45, documentation: 32, drugCheck: 28 },
  { name: "Week 2", diagnosis: 52, documentation: 38, drugCheck: 31 },
  { name: "Week 3", diagnosis: 48, documentation: 41, drugCheck: 35 },
  { name: "Week 4", diagnosis: 61, documentation: 45, drugCheck: 42 },
];

const diagnosisCategoriesData = [
  { name: "Respiratory", value: 28, color: "#10b981" },
  { name: "Cardiovascular", value: 22, color: "#f59e0b" },
  { name: "Metabolic", value: 18, color: "#8b5cf6" },
  { name: "Musculoskeletal", value: 15, color: "#ec4899" },
  { name: "Gastrointestinal", value: 12, color: "#06b6d4" },
  { name: "Other", value: 5, color: "#94a3b8" },
];

const chartConfig = {
  visits: { label: "Patient Visits", color: "#10b981" },
  diagnosis: { label: "Diagnosis", color: "#8b5cf6" },
  documentation: { label: "Documentation", color: "#f59e0b" },
  drugCheck: { label: "Drug Check", color: "#ec4899" },
};

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("week");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-500" />
            Analytics Dashboard
          </h2>
          <p className="text-slate-500">Insights and metrics from Gelani AI Healthcare Assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Patients",
            value: "1,247",
            change: "+12%",
            trend: "up",
            icon: Users,
            color: "from-blue-500 to-cyan-500",
          },
          {
            label: "AI Consultations",
            value: "3,891",
            change: "+24%",
            trend: "up",
            icon: Brain,
            color: "from-purple-500 to-pink-500",
          },
          {
            label: "Documents Created",
            value: "2,156",
            change: "+18%",
            trend: "up",
            icon: FileText,
            color: "from-amber-500 to-orange-500",
          },
          {
            label: "Drug Alerts",
            value: "127",
            change: "-8%",
            trend: "down",
            icon: Pill,
            color: "from-rose-500 to-red-500",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          stat.trend === "up" ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patient Visits Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Patient Visits</CardTitle>
            <CardDescription>Daily patient visits this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientVisitsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="visits" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* AI Usage Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">AI Feature Usage</CardTitle>
            <CardDescription>Weekly AI feature utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="diagnosis" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="documentation" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="drugCheck" stroke="#ec4899" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Diagnosis Categories */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Diagnosis Categories</CardTitle>
            <CardDescription>Breakdown by medical specialty</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={diagnosisCategoriesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {diagnosisCategoriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-4">
              {diagnosisCategoriesData.map((item, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Performance */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">AI Performance</CardTitle>
            <CardDescription>Model accuracy metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Diagnostic Accuracy", value: 94, color: "bg-emerald-500" },
              { label: "Drug Interaction Detection", value: 98, color: "bg-blue-500" },
              { label: "Documentation Quality", value: 91, color: "bg-amber-500" },
              { label: "Voice Transcription", value: 96, color: "bg-purple-500" },
            ].map((metric, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{metric.label}</span>
                  <span className="font-medium">{metric.value}%</span>
                </div>
                <Progress value={metric.value} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { time: "10:30 AM", event: "New patient synced from Bahmni", type: "sync" },
                { time: "10:15 AM", event: "AI diagnosis suggestion reviewed", type: "ai" },
                { time: "10:00 AM", event: "Drug interaction alert generated", type: "alert" },
                { time: "09:45 AM", event: "SOAP note auto-generated", type: "doc" },
                { time: "09:30 AM", event: "Patient consultation completed", type: "consult" },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500">{activity.time}</span>
                    <p className="text-slate-700">{activity.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="border-0 shadow-md bg-slate-800 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Activity className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">System Health: Excellent</h3>
                <p className="text-slate-400">All services operational • Bahmni connected</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "API Latency", value: "45ms" },
                { label: "AI Response", value: "1.2s" },
                { label: "Uptime", value: "99.9%" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-xl font-bold text-emerald-400">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
