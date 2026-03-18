"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Scale,
  Ruler,
  Gauge,
  AlertTriangle,
  Clock,
  User,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// INTERFACES
// ============================================

interface VitalsData {
  id: string;
  patientId: string;
  encounterId?: string;
  temperature?: number;
  temperatureUnit?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  weightUnit?: string;
  height?: number;
  heightUnit?: string;
  bmi?: number;
  bloodGlucose?: number;
  glucoseUnit?: string;
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
  recordedAt: string | Date;
  notes?: string;
  isAmendment?: boolean;
  amendmentReason?: string;
}

interface VitalsCardProps {
  vitals: VitalsData;
  onViewHistory?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================
// STATUS COLOR MAPPING
// ============================================

const statusColors = {
  normal: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-700",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
};

const getStatusColor = (status?: string) => {
  if (!status) return statusColors.normal;
  return statusColors[status as keyof typeof statusColors] || statusColors.normal;
};

// ============================================
// PAIN FACES
// ============================================

const painFaces = ["😊", "🙂", "🙂", "😐", "😐", "😕", "😕", "😣", "😣", "😖", "😭"];

// ============================================
// VITAL ITEM COMPONENT
// ============================================

interface VitalItemProps {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  unit: string;
  status?: string;
  statusMessage?: string;
  colorClass?: string;
}

function VitalItem({ icon, label, value, unit, status, statusMessage, colorClass }: VitalItemProps) {
  const statusColor = getStatusColor(status);
  
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-all",
      statusColor.bg,
      statusColor.border
    )}>
      <div className={cn("p-2 rounded-full", statusColor.bg)}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("font-semibold", statusColor.text)}>
          {value !== undefined && value !== null && value !== "" ? (
            <>
              {value} <span className="text-xs font-normal">{unit}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
        {status && status !== "normal" && (
          <div className={cn("text-xs mt-0.5", statusColor.text)}>
            {statusMessage}
          </div>
        )}
      </div>
      {status && status !== "normal" && (
        <AlertTriangle className={cn("h-4 w-4", statusColor.text)} />
      )}
    </div>
  );
}

// ============================================
// MAIN VITALS CARD COMPONENT
// ============================================

export function VitalsCard({ vitals, onViewHistory, compact = false, className }: VitalsCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  
  const recordedAt = new Date(vitals.recordedAt);
  const hasAnyCritical = 
    vitals.bpStatus === "critical" ||
    vitals.hrStatus === "critical" ||
    vitals.rrStatus === "critical" ||
    vitals.spo2Status === "critical" ||
    vitals.tempStatus === "critical" ||
    vitals.glucoseStatus === "critical";
  
  const hasAnyWarning =
    vitals.bpStatus === "warning" ||
    vitals.hrStatus === "warning" ||
    vitals.rrStatus === "warning" ||
    vitals.spo2Status === "warning" ||
    vitals.tempStatus === "warning" ||
    vitals.glucoseStatus === "warning";

  // Format BP display
  const bpDisplay = vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
    ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
    : null;

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      hasAnyCritical && "border-red-300 border-2",
      hasAnyWarning && !hasAnyCritical && "border-yellow-300",
      className
    )}>
      {/* Critical Alert Banner */}
      {hasAnyCritical && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-red-500 text-white px-4 py-2 flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium text-sm">Critical Values Detected</span>
        </motion.div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={cn(
              "h-5 w-5",
              hasAnyCritical ? "text-red-500" : 
              hasAnyWarning ? "text-yellow-500" : "text-emerald-500"
            )} />
            <CardTitle className="text-base">Vital Signs</CardTitle>
            {vitals.isAmendment && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Amended
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewHistory}
                className="text-xs"
              >
                <History className="h-3 w-3 mr-1" />
                History
              </Button>
            )}
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-7 w-7 p-0"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {vitals.recordedByName || vitals.recordedBy}
            {vitals.recordedByRole && ` (${vitals.recordedByRole})`}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {recordedAt.toLocaleString()}
          </span>
        </CardDescription>
      </CardHeader>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CardContent className="pt-0 space-y-4">
              {/* Primary Vitals - Always shown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <VitalItem
                  icon={<Thermometer className="h-4 w-4 text-orange-500" />}
                  label="Temperature"
                  value={vitals.temperature}
                  unit={`°${vitals.temperatureUnit || "C"}`}
                  status={vitals.tempStatus}
                  statusMessage={vitals.tempStatus === "critical" ? "Fever/Hypothermia" : 
                                 vitals.tempStatus === "warning" ? "Abnormal" : undefined}
                />
                
                <VitalItem
                  icon={<Heart className="h-4 w-4 text-red-500" />}
                  label="Blood Pressure"
                  value={bpDisplay}
                  unit="mmHg"
                  status={vitals.bpStatus}
                  statusMessage={vitals.bpStatus === "critical" ? "Critical BP" : 
                                 vitals.bpStatus === "warning" ? "Elevated BP" : undefined}
                />
                
                <VitalItem
                  icon={<Activity className="h-4 w-4 text-pink-500" />}
                  label="Heart Rate"
                  value={vitals.heartRate}
                  unit="bpm"
                  status={vitals.hrStatus}
                  statusMessage={vitals.hrStatus === "critical" ? "Arrhythmia" : 
                                 vitals.hrStatus === "warning" ? "Abnormal HR" : undefined}
                />
                
                <VitalItem
                  icon={<Droplets className="h-4 w-4 text-cyan-500" />}
                  label="SpO₂"
                  value={vitals.oxygenSaturation}
                  unit="%"
                  status={vitals.spo2Status}
                  statusMessage={vitals.spo2Status === "critical" ? "Hypoxemia" : 
                                 vitals.spo2Status === "warning" ? "Low SpO₂" : undefined}
                />
              </div>

              {/* Secondary Vitals */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <VitalItem
                  icon={<Droplets className="h-4 w-4 text-blue-500" />}
                  label="Resp. Rate"
                  value={vitals.respiratoryRate}
                  unit="br/min"
                  status={vitals.rrStatus}
                  statusMessage={vitals.rrStatus === "critical" ? "Abnormal" : undefined}
                />
                
                <VitalItem
                  icon={<Droplets className="h-4 w-4 text-amber-500" />}
                  label="Glucose"
                  value={vitals.bloodGlucose}
                  unit={vitals.glucoseUnit || "mmol/L"}
                  status={vitals.glucoseStatus}
                  statusMessage={vitals.glucoseStatus === "critical" ? "Abnormal" : undefined}
                />
                
                <VitalItem
                  icon={<Scale className="h-4 w-4 text-purple-500" />}
                  label="Weight"
                  value={vitals.weight}
                  unit={vitals.weightUnit || "kg"}
                />
                
                <VitalItem
                  icon={<Gauge className="h-4 w-4 text-teal-500" />}
                  label="BMI"
                  value={vitals.bmi?.toFixed(1)}
                  unit="kg/m²"
                />
              </div>

              {/* Pain Score and Consciousness */}
              <div className="grid grid-cols-2 gap-3">
                {vitals.painScore !== undefined && vitals.painScore !== null && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                    <span className="text-3xl">{painFaces[vitals.painScore]}</span>
                    <div>
                      <div className="text-xs text-muted-foreground">Pain Score</div>
                      <div className={cn(
                        "font-semibold",
                        vitals.painScore <= 3 && "text-green-600",
                        vitals.painScore > 3 && vitals.painScore <= 6 && "text-yellow-600",
                        vitals.painScore > 6 && "text-red-600"
                      )}>
                        {vitals.painScore}/10
                      </div>
                    </div>
                  </div>
                )}
                
                {vitals.consciousnessLevel && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                    <div className={cn(
                      "p-2 rounded-full",
                      vitals.consciousnessLevel === "Alert" ? "bg-green-100" :
                      vitals.consciousnessLevel === "Verbal" ? "bg-yellow-100" :
                      vitals.consciousnessLevel === "Pain" ? "bg-orange-100" : "bg-red-100"
                    )}>
                      <Activity className={cn(
                        "h-4 w-4",
                        vitals.consciousnessLevel === "Alert" ? "text-green-600" :
                        vitals.consciousnessLevel === "Verbal" ? "text-yellow-600" :
                        vitals.consciousnessLevel === "Pain" ? "text-orange-600" : "text-red-600"
                      )} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Consciousness (AVPU)</div>
                      <div className="font-semibold">{vitals.consciousnessLevel}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {vitals.notes && (
                <div className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">
                  <span className="font-medium">Notes:</span> {vitals.notes}
                </div>
              )}

              {/* Amendment Info */}
              {vitals.isAmendment && vitals.amendmentReason && (
                <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <span className="font-medium">Amendment Reason:</span> {vitals.amendmentReason}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default VitalsCard;
