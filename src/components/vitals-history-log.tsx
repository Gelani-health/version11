"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  AlertTriangle,
  Check,
  ChevronDown,
  User,
  Download,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ============================================
// TYPES
// ============================================

interface VitalsRecord {
  id: string;
  patientId: string;
  encounterId?: string;
  
  temperature?: number;
  temperatureUnit: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  weightUnit: string;
  height?: number;
  heightUnit: string;
  bmi?: number;
  bloodGlucose?: number;
  glucoseUnit: string;
  glucoseType?: string;
  painScore?: number;
  consciousnessLevel?: string;
  
  bpStatus?: string;
  hrStatus?: string;
  rrStatus?: string;
  spo2Status?: string;
  tempStatus?: string;
  glucoseStatus?: string;
  
  recordedBy: string;
  recordedByName?: string;
  recordedByRole?: string;
  recordedAt: string;
  
  isAmendment?: boolean;
  amendmentReason?: string;
  notes?: string;
}

interface VitalsHistoryLogProps {
  patientId: string;
  patientName?: string;
}

// ============================================
// STATUS HELPERS
// ============================================

const getStatusColor = (status?: string) => {
  switch (status) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-300";
    case "warning":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "normal":
      return "bg-green-100 text-green-700 border-green-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case "critical":
      return <AlertTriangle className="h-3 w-3" />;
    case "warning":
      return <TrendingUp className="h-3 w-3" />;
    case "normal":
      return <Check className="h-3 w-3" />;
    default:
      return <Minus className="h-3 w-3" />;
  }
};

// ============================================
// CHART COLORS
// ============================================

const chartColors = {
  systolic: "#ef4444",
  diastolic: "#f97316",
  heartRate: "#ec4899",
  spo2: "#06b6d4",
  temperature: "#f59e0b",
  respiratoryRate: "#8b5cf6",
};

// ============================================
// MAIN COMPONENT
// ============================================

export function VitalsHistoryLog({ patientId, patientName }: VitalsHistoryLogProps) {
  const [vitalsRecords, setVitalsRecords] = useState<VitalsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "14d" | "30d" | "90d" | "all">("30d");
  const [selectedMetric, setSelectedMetric] = useState<"bp" | "hr" | "spo2" | "temp" | "rr">("bp");
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    fetchVitalsHistory();
  }, [patientId, dateRange]);

  const fetchVitalsHistory = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date filter
      let startDate: Date | null = null;
      const now = new Date();
      switch (dateRange) {
        case "7d":
          startDate = subDays(now, 7);
          break;
        case "14d":
          startDate = subWeeks(now, 2);
          break;
        case "30d":
          startDate = subDays(now, 30);
          break;
        case "90d":
          startDate = subMonths(now, 3);
          break;
        case "all":
          startDate = null;
          break;
      }

      const params = new URLSearchParams({
        patientId,
        ...(startDate && { startDate: startDate.toISOString() }),
        limit: "100",
      });

      const response = await fetch(`/api/vitals?${params}`);
      const data = await response.json();

      if (data.success) {
        setVitalsRecords(data.data.vitals || []);
      }
    } catch (error) {
      console.error("Failed to fetch vitals history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare chart data
  const getChartData = () => {
    return vitalsRecords
      .filter(v => v.bloodPressureSystolic || v.heartRate || v.oxygenSaturation || v.temperature || v.respiratoryRate)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map(v => ({
        date: format(new Date(v.recordedAt), "MMM dd"),
        time: format(new Date(v.recordedAt), "HH:mm"),
        fullDate: format(new Date(v.recordedAt), "MMM dd, yyyy HH:mm"),
        systolic: v.bloodPressureSystolic,
        diastolic: v.bloodPressureDiastolic,
        heartRate: v.heartRate,
        spo2: v.oxygenSaturation,
        temperature: v.temperature,
        respiratoryRate: v.respiratoryRate,
        status: v.bpStatus || v.hrStatus || "normal",
      }));
  };

  const chartData = getChartData();

  // Get latest vitals
  const latestVitals = vitalsRecords[0];

  // Calculate trends
  const calculateTrend = (metric: "systolic" | "heartRate" | "spo2" | "temperature") => {
    if (chartData.length < 2) return "stable";
    const recent = chartData.slice(-3);
    const older = chartData.slice(-6, -3);
    
    if (older.length === 0) return "stable";
    
    const recentAvg = recent.reduce((sum, v) => sum + (v[metric] || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + (v[metric] || 0), 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    if (Math.abs(diff) < 2) return "stable";
    return diff > 0 ? "up" : "down";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-blue-500" />;
      default:
        return <Minus className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Vitals History Log
            </CardTitle>
            <CardDescription>
              {patientName ? `${patientName} • ` : ""}{vitalsRecords.length} records
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Date Range Filter */}
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="14d">Last 14 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchVitalsHistory}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        {latestVitals && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* BP */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-red-50 to-orange-50">
              <div className="flex items-center justify-between mb-1">
                <Heart className="h-4 w-4 text-red-500" />
                {getTrendIcon(calculateTrend("systolic"))}
              </div>
              <div className="text-lg font-bold text-red-700">
                {latestVitals.bloodPressureSystolic || "—"}/{latestVitals.bloodPressureDiastolic || "—"}
              </div>
              <div className="text-xs text-muted-foreground">BP (mmHg)</div>
              {latestVitals.bpStatus && (
                <Badge variant="outline" className={cn("mt-1 text-xs", getStatusColor(latestVitals.bpStatus))}>
                  {getStatusIcon(latestVitals.bpStatus)}
                  <span className="ml-1 capitalize">{latestVitals.bpStatus}</span>
                </Badge>
              )}
            </div>

            {/* HR */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-pink-50 to-rose-50">
              <div className="flex items-center justify-between mb-1">
                <Activity className="h-4 w-4 text-pink-500" />
                {getTrendIcon(calculateTrend("heartRate"))}
              </div>
              <div className="text-lg font-bold text-pink-700">
                {latestVitals.heartRate || "—"}
              </div>
              <div className="text-xs text-muted-foreground">HR (bpm)</div>
              {latestVitals.hrStatus && (
                <Badge variant="outline" className={cn("mt-1 text-xs", getStatusColor(latestVitals.hrStatus))}>
                  {getStatusIcon(latestVitals.hrStatus)}
                  <span className="ml-1 capitalize">{latestVitals.hrStatus}</span>
                </Badge>
              )}
            </div>

            {/* SpO2 */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-cyan-50 to-blue-50">
              <div className="flex items-center justify-between mb-1">
                <Droplets className="h-4 w-4 text-cyan-500" />
                {getTrendIcon(calculateTrend("spo2"))}
              </div>
              <div className="text-lg font-bold text-cyan-700">
                {latestVitals.oxygenSaturation || "—"}%
              </div>
              <div className="text-xs text-muted-foreground">SpO₂</div>
              {latestVitals.spo2Status && (
                <Badge variant="outline" className={cn("mt-1 text-xs", getStatusColor(latestVitals.spo2Status))}>
                  {getStatusIcon(latestVitals.spo2Status)}
                  <span className="ml-1 capitalize">{latestVitals.spo2Status}</span>
                </Badge>
              )}
            </div>

            {/* Temp */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-amber-50 to-yellow-50">
              <div className="flex items-center justify-between mb-1">
                <Thermometer className="h-4 w-4 text-amber-500" />
                {getTrendIcon(calculateTrend("temperature"))}
              </div>
              <div className="text-lg font-bold text-amber-700">
                {latestVitals.temperature || "—"}°{latestVitals.temperatureUnit}
              </div>
              <div className="text-xs text-muted-foreground">Temp</div>
              {latestVitals.tempStatus && (
                <Badge variant="outline" className={cn("mt-1 text-xs", getStatusColor(latestVitals.tempStatus))}>
                  {getStatusIcon(latestVitals.tempStatus)}
                  <span className="ml-1 capitalize">{latestVitals.tempStatus}</span>
                </Badge>
              )}
            </div>

            {/* RR */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-violet-50 to-purple-50">
              <div className="flex items-center justify-between mb-1">
                <Droplets className="h-4 w-4 text-violet-500" />
              </div>
              <div className="text-lg font-bold text-violet-700">
                {latestVitals.respiratoryRate || "—"}
              </div>
              <div className="text-xs text-muted-foreground">RR (/min)</div>
              {latestVitals.rrStatus && (
                <Badge variant="outline" className={cn("mt-1 text-xs", getStatusColor(latestVitals.rrStatus))}>
                  {getStatusIcon(latestVitals.rrStatus)}
                  <span className="ml-1 capitalize">{latestVitals.rrStatus}</span>
                </Badge>
              )}
            </div>

            {/* BMI */}
            <div className="p-3 rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="flex items-center justify-between mb-1">
                <Scale className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-emerald-700">
                {latestVitals.bmi?.toFixed(1) || "—"}
              </div>
              <div className="text-xs text-muted-foreground">BMI (kg/m²)</div>
              {latestVitals.weight && (
                <div className="text-xs text-muted-foreground mt-1">
                  {latestVitals.weight} {latestVitals.weightUnit}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {showChart && chartData.length > 0 && (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Trend Chart</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bp">Blood Pressure</SelectItem>
                      <SelectItem value="hr">Heart Rate</SelectItem>
                      <SelectItem value="spo2">SpO₂</SelectItem>
                      <SelectItem value="temp">Temperature</SelectItem>
                      <SelectItem value="rr">Resp. Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setShowChart(false)}>
                    Hide
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    
                    {selectedMetric === "bp" && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="systolic"
                          stroke={chartColors.systolic}
                          strokeWidth={2}
                          dot={{ fill: chartColors.systolic, r: 4 }}
                          name="Systolic"
                        />
                        <Line
                          type="monotone"
                          dataKey="diastolic"
                          stroke={chartColors.diastolic}
                          strokeWidth={2}
                          dot={{ fill: chartColors.diastolic, r: 4 }}
                          name="Diastolic"
                        />
                        <ReferenceLine y={120} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Normal SBP", fontSize: 10 }} />
                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" />
                      </>
                    )}
                    
                    {selectedMetric === "hr" && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="heartRate"
                          stroke={chartColors.heartRate}
                          strokeWidth={2}
                          dot={{ fill: chartColors.heartRate, r: 4 }}
                          name="Heart Rate"
                        />
                        <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="5 5" />
                        <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="5 5" />
                      </>
                    )}
                    
                    {selectedMetric === "spo2" && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="spo2"
                          stroke={chartColors.spo2}
                          strokeWidth={2}
                          dot={{ fill: chartColors.spo2, r: 4 }}
                          name="SpO₂"
                        />
                        <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Normal", fontSize: 10 }} />
                        <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Critical", fontSize: 10 }} />
                      </>
                    )}
                    
                    {selectedMetric === "temp" && (
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        stroke={chartColors.temperature}
                        strokeWidth={2}
                        dot={{ fill: chartColors.temperature, r: 4 }}
                        name="Temperature"
                      />
                    )}
                    
                    {selectedMetric === "rr" && (
                      <Line
                        type="monotone"
                        dataKey="respiratoryRate"
                        stroke={chartColors.respiratoryRate}
                        strokeWidth={2}
                        dot={{ fill: chartColors.respiratoryRate, r: 4 }}
                        name="Resp. Rate"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {!showChart && chartData.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowChart(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Show Trend Chart
          </Button>
        )}

        <Separator />

        {/* Vitals Records List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Record History</h4>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : vitalsRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No vitals records found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {vitalsRecords.map((record, index) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-3 rounded-lg border transition-all hover:shadow-md",
                      record.isAmendment && "border-orange-300 bg-orange-50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(record.recordedAt), "MMM dd, yyyy HH:mm")}
                        </span>
                        {record.isAmendment && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Amendment
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {record.recordedByName || record.recordedBy}
                        {record.recordedByRole && (
                          <Badge variant="secondary" className="text-xs">
                            {record.recordedByRole}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                      {record.bloodPressureSystolic && (
                        <div className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-500" />
                          <span className="font-medium">{record.bloodPressureSystolic}/{record.bloodPressureDiastolic}</span>
                          <span className="text-muted-foreground">mmHg</span>
                          {record.bpStatus && (
                            <span className={cn("w-2 h-2 rounded-full", 
                              record.bpStatus === "critical" && "bg-red-500",
                              record.bpStatus === "warning" && "bg-yellow-500",
                              record.bpStatus === "normal" && "bg-green-500"
                            )} />
                          )}
                        </div>
                      )}
                      
                      {record.heartRate && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-pink-500" />
                          <span className="font-medium">{record.heartRate}</span>
                          <span className="text-muted-foreground">bpm</span>
                        </div>
                      )}
                      
                      {record.oxygenSaturation && (
                        <div className="flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-cyan-500" />
                          <span className="font-medium">{record.oxygenSaturation}%</span>
                        </div>
                      )}
                      
                      {record.temperature && (
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-3 w-3 text-amber-500" />
                          <span className="font-medium">{record.temperature}°{record.temperatureUnit}</span>
                        </div>
                      )}
                      
                      {record.respiratoryRate && (
                        <div className="flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-violet-500" />
                          <span className="font-medium">{record.respiratoryRate}</span>
                          <span className="text-muted-foreground">/min</span>
                        </div>
                      )}
                      
                      {record.painScore !== undefined && record.painScore !== null && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Pain:</span>
                          <span className={cn(
                            "px-1 rounded",
                            record.painScore <= 3 && "text-green-600",
                            record.painScore > 3 && record.painScore <= 6 && "text-yellow-600",
                            record.painScore > 6 && "text-red-600"
                          )}>
                            {record.painScore}/10
                          </span>
                        </div>
                      )}
                    </div>

                    {record.notes && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        Note: {record.notes}
                      </div>
                    )}

                    {record.amendmentReason && (
                      <div className="mt-2 text-xs text-orange-600">
                        Amendment Reason: {record.amendmentReason}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default VitalsHistoryLog;
