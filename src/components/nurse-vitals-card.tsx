"use client";

import { useState, useEffect } from "react";
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
  Check,
  Info,
  RefreshCw,
  Save,
  Plus,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Edit,
  History,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// TRAFFIC LIGHT STATUS COMPONENT
// ============================================

function TrafficLightStatus({ status, size = "md" }: { status?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  };

  const getColor = () => {
    switch (status) {
      case "critical":
        return "bg-red-500 shadow-red-500/50 animate-pulse";
      case "warning":
        return "bg-yellow-500 shadow-yellow-500/50";
      case "normal":
        return "bg-green-500 shadow-green-500/50";
      default:
        return "bg-slate-300";
    }
  };

  return (
    <div className={cn(sizeClasses[size], "rounded-full shadow-lg", getColor())} />
  );
}

// ============================================
// VITALS VALIDATION
// ============================================

interface VitalsValidation {
  isValid: boolean;
  status: "normal" | "warning" | "critical";
  message?: string;
}

const validateBloodPressure = (systolic: number | null, diastolic: number | null): VitalsValidation => {
  if (!systolic || !diastolic) return { isValid: true, status: "normal" };
  
  if (systolic < 40 || systolic > 300 || diastolic < 20 || diastolic > 200) {
    return { isValid: false, status: "critical", message: "Values out of physiological range" };
  }
  
  if (systolic >= 180 || diastolic >= 120) {
    return { isValid: true, status: "critical", message: "Hypertensive Crisis" };
  }
  if (systolic < 90 || diastolic < 60) {
    return { isValid: true, status: "critical", message: "Hypotension" };
  }
  
  if (systolic >= 140 || diastolic >= 90) {
    return { isValid: true, status: "warning", message: "Hypertension" };
  }
  if (systolic >= 130 && systolic < 140) {
    return { isValid: true, status: "warning", message: "Elevated BP" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateHeartRate = (hr: number | null): VitalsValidation => {
  if (!hr) return { isValid: true, status: "normal" };
  
  if (hr < 20 || hr > 300) {
    return { isValid: false, status: "critical", message: "Out of range" };
  }
  
  if (hr < 50 || hr > 120) {
    return { isValid: true, status: "warning", message: hr < 50 ? "Bradycardia" : "Tachycardia" };
  }
  if (hr < 40 || hr > 150) {
    return { isValid: true, status: "critical", message: hr < 40 ? "Severe Bradycardia" : "Severe Tachycardia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateSpO2 = (spo2: number | null): VitalsValidation => {
  if (!spo2) return { isValid: true, status: "normal" };
  
  if (spo2 < 50 || spo2 > 100) {
    return { isValid: false, status: "critical", message: "Invalid value" };
  }
  
  if (spo2 < 90) {
    return { isValid: true, status: "critical", message: "Hypoxemia" };
  }
  if (spo2 < 94) {
    return { isValid: true, status: "warning", message: "Mild Hypoxemia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateTemperature = (temp: number | null, unit: string): VitalsValidation => {
  if (!temp) return { isValid: true, status: "normal" };
  
  const tempC = unit === "F" ? (temp - 32) * 5/9 : temp;
  
  if (tempC >= 39) {
    return { isValid: true, status: "critical", message: "High Fever" };
  }
  if (tempC >= 38) {
    return { isValid: true, status: "warning", message: "Fever" };
  }
  if (tempC < 36) {
    return { isValid: true, status: "warning", message: "Hypothermia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateRespiratoryRate = (rr: number | null): VitalsValidation => {
  if (!rr) return { isValid: true, status: "normal" };
  
  if (rr < 10 || rr > 24) {
    return { isValid: true, status: "warning", message: rr < 10 ? "Bradypnea" : "Tachypnea" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

// ============================================
// PAIN SCALE
// ============================================

const painScaleFaces = [
  { score: 0, emoji: "😊", label: "No Pain" },
  { score: 1, emoji: "🙂", label: "Minimal" },
  { score: 2, emoji: "🙂", label: "Mild" },
  { score: 3, emoji: "😐", label: "Mild" },
  { score: 4, emoji: "😐", label: "Moderate" },
  { score: 5, emoji: "😕", label: "Moderate" },
  { score: 6, emoji: "😕", label: "Moderate" },
  { score: 7, emoji: "😣", label: "Severe" },
  { score: 8, emoji: "😣", label: "Severe" },
  { score: 9, emoji: "😖", label: "Very Severe" },
  { score: 10, emoji: "😭", label: "Worst Pain" },
];

// ============================================
// TYPES
// ============================================

interface VitalsData {
  id?: string;
  temperature?: number;
  temperatureUnit: "C" | "F";
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  weightUnit: "kg" | "lbs";
  height?: number;
  heightUnit: "cm" | "in";
  bmi?: number;
  bloodGlucose?: number;
  glucoseUnit: "mmol/L" | "mg/dL";
  glucoseType: "fasting" | "random";
  painScore: number;
  consciousnessLevel: "Alert" | "Verbal" | "Pain" | "Unresponsive";
  notes?: string;
  
  // Status flags
  bpStatus?: string;
  hrStatus?: string;
  rrStatus?: string;
  spo2Status?: string;
  tempStatus?: string;
  
  // Attribution
  recordedBy?: string;
  recordedByName?: string;
  recordedByRole?: string;
  recordedAt?: string;
}

interface NurseVitalsCardProps {
  patientId: string;
  encounterId?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  existingVitals?: VitalsData;
  onVitalsRecorded?: (vitals: VitalsData) => void;
  compact?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function NurseVitalsCard({
  patientId,
  encounterId,
  employeeId,
  employeeName,
  employeeRole,
  existingVitals,
  onVitalsRecorded,
  compact = false,
}: NurseVitalsCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const [vitals, setVitals] = useState<VitalsData>({
    temperature: undefined,
    temperatureUnit: "C",
    bloodPressureSystolic: undefined,
    bloodPressureDiastolic: undefined,
    heartRate: undefined,
    respiratoryRate: undefined,
    oxygenSaturation: undefined,
    weight: undefined,
    weightUnit: "kg",
    height: undefined,
    heightUnit: "cm",
    bmi: undefined,
    bloodGlucose: undefined,
    glucoseUnit: "mmol/L",
    glucoseType: "random",
    painScore: 0,
    consciousnessLevel: "Alert",
    notes: "",
    ...existingVitals,
  });

  // Validation states
  const [validations, setValidations] = useState<{
    bp: { isValid: boolean; status: "normal" | "warning" | "critical"; message?: string };
    hr: { isValid: boolean; status: "normal" | "warning" | "critical"; message?: string };
    rr: { isValid: boolean; status: "normal" | "warning" | "critical"; message?: string };
    spo2: { isValid: boolean; status: "normal" | "warning" | "critical"; message?: string };
    temp: { isValid: boolean; status: "normal" | "warning" | "critical"; message?: string };
  }>({
    bp: { isValid: true, status: "normal", message: "" },
    hr: { isValid: true, status: "normal", message: "" },
    rr: { isValid: true, status: "normal", message: "" },
    spo2: { isValid: true, status: "normal", message: "" },
    temp: { isValid: true, status: "normal", message: "" },
  });

  // Calculate BMI
  useEffect(() => {
    if (vitals.weight && vitals.height) {
      const weightKg = vitals.weightUnit === "lbs" ? vitals.weight * 0.453592 : vitals.weight;
      const heightM = vitals.heightUnit === "in" ? vitals.height * 0.0254 : vitals.height / 100;
      if (heightM > 0) {
        const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
        setVitals(prev => ({ ...prev, bmi }));
      }
    }
  }, [vitals.weight, vitals.height, vitals.weightUnit, vitals.heightUnit]);

  // Validate on change
  useEffect(() => {
    setValidations({
      bp: validateBloodPressure(vitals.bloodPressureSystolic || null, vitals.bloodPressureDiastolic || null),
      hr: validateHeartRate(vitals.heartRate || null),
      rr: validateRespiratoryRate(vitals.respiratoryRate || null),
      spo2: validateSpO2(vitals.oxygenSaturation || null),
      temp: validateTemperature(vitals.temperature || null, vitals.temperatureUnit),
    });
  }, [
    vitals.bloodPressureSystolic,
    vitals.bloodPressureDiastolic,
    vitals.heartRate,
    vitals.respiratoryRate,
    vitals.oxygenSaturation,
    vitals.temperature,
    vitals.temperatureUnit,
  ]);

  // Check for critical values
  const hasCriticalValues = Object.values(validations).some(v => v.status === "critical");
  const hasWarningValues = Object.values(validations).some(v => v.status === "warning");

  const updateVitals = (field: keyof VitalsData, value: any) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate at least one vital is entered
    if (!vitals.bloodPressureSystolic && !vitals.heartRate && !vitals.temperature) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one vital sign",
        variant: "destructive",
      });
      return;
    }

    // Check for invalid values
    const invalidFields = Object.entries(validations)
      .filter(([_, v]) => !v.isValid)
      .map(([k]) => k);
    
    if (invalidFields.length > 0) {
      toast({
        title: "Invalid Values",
        description: `Please correct: ${invalidFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setShowConfirmation(true);
  };

  const confirmSave = async () => {
    try {
      setIsSaving(true);
      
      const payload = {
        patientId,
        encounterId,
        ...vitals,
        recordedBy: employeeId,
        recordedByName: employeeName,
        recordedByRole: employeeRole,
        // Include calculated status flags
        bpStatus: validations.bp.status,
        hrStatus: validations.hr.status,
        rrStatus: validations.rr.status,
        spo2Status: validations.spo2.status,
        tempStatus: validations.temp.status,
      };

      const response = await fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Vitals recorded successfully",
        });
        setShowConfirmation(false);
        onVitalsRecorded?.(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record vitals",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compact view summary
  const renderCompactSummary = () => (
    <div 
      className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 rounded-lg"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Activity className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <div className="font-medium text-sm">Vitals Check</div>
          <div className="text-xs text-muted-foreground">
            {vitals.bloodPressureSystolic ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg` : ""}
            {vitals.heartRate ? ` • HR ${vitals.heartRate}` : ""}
            {vitals.temperature ? ` • ${vitals.temperature}°${vitals.temperatureUnit}` : ""}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {hasCriticalValues && <TrafficLightStatus status="critical" />}
          {hasWarningValues && !hasCriticalValues && <TrafficLightStatus status="warning" />}
          {!hasCriticalValues && !hasWarningValues && vitals.bloodPressureSystolic && (
            <TrafficLightStatus status="normal" />
          )}
        </div>
        
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );

  return (
    <Card className={cn("w-full", hasCriticalValues && "border-red-300 ring-2 ring-red-200")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">Nurse Vitals Check</CardTitle>
              <CardDescription>
                Record patient vital signs with validation
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status Lights */}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
              <TrafficLightStatus status="normal" size="sm" />
              <TrafficLightStatus status="warning" size="sm" />
              <TrafficLightStatus status="critical" size="sm" />
            </div>
            
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? "Collapse" : "Expand"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Critical Alert */}
      {hasCriticalValues && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-6 pb-3"
        >
          <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Critical Values Detected</h4>
              <p className="text-sm text-red-700 mt-1">
                Immediate attention may be required. Review the highlighted values below.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CardContent className="space-y-3">
              {/* Staff Attribution - Compact */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-slate-50 p-1.5 rounded">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <strong>{employeeName}</strong>
                </span>
                <Badge variant="outline" className="text-xs h-5">{employeeRole}</Badge>
                <span className="flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {/* Vitals Grid - Responsive 2/3/4 columns */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {/* Temperature */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Thermometer className="h-3 w-3 text-orange-500" />
                    Temp
                    <TrafficLightStatus status={validations.temp.status} size="sm" />
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={vitals.temperature || ""}
                      onChange={(e) => updateVitals("temperature", e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="36.5"
                      className={cn(
                        "h-8 text-sm w-full max-w-[70px]",
                        validations.temp.status === "critical" && "border-red-300 bg-red-50",
                        validations.temp.status === "warning" && "border-yellow-300 bg-yellow-50"
                      )}
                    />
                    <Select
                      value={vitals.temperatureUnit}
                      onValueChange={(v) => updateVitals("temperatureUnit", v as "C" | "F")}
                    >
                      <SelectTrigger className="w-12 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="C">°C</SelectItem>
                        <SelectItem value="F">°F</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Blood Pressure */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Heart className="h-3 w-3 text-red-500" />
                    BP
                    <TrafficLightStatus status={validations.bp.status} size="sm" />
                  </Label>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      value={vitals.bloodPressureSystolic || ""}
                      onChange={(e) => updateVitals("bloodPressureSystolic", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="120"
                      className={cn(
                        "h-8 text-sm w-full max-w-[55px]",
                        validations.bp.status === "critical" && "border-red-300 bg-red-50",
                        validations.bp.status === "warning" && "border-yellow-300 bg-yellow-50"
                      )}
                    />
                    <span className="text-muted-foreground text-sm">/</span>
                    <Input
                      type="number"
                      value={vitals.bloodPressureDiastolic || ""}
                      onChange={(e) => updateVitals("bloodPressureDiastolic", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="80"
                      className={cn(
                        "h-8 text-sm w-full max-w-[55px]",
                        validations.bp.status === "critical" && "border-red-300 bg-red-50",
                        validations.bp.status === "warning" && "border-yellow-300 bg-yellow-50"
                      )}
                    />
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Activity className="h-3 w-3 text-pink-500" />
                    HR
                    <TrafficLightStatus status={validations.hr.status} size="sm" />
                  </Label>
                  <Input
                    type="number"
                    value={vitals.heartRate || ""}
                    onChange={(e) => updateVitals("heartRate", e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="72"
                    className={cn(
                      "h-8 text-sm",
                      validations.hr.status === "critical" && "border-red-300 bg-red-50",
                      validations.hr.status === "warning" && "border-yellow-300 bg-yellow-50"
                    )}
                  />
                </div>

                {/* Respiratory Rate */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Droplets className="h-3 w-3 text-blue-500" />
                    RR
                    <TrafficLightStatus status={validations.rr.status} size="sm" />
                  </Label>
                  <Input
                    type="number"
                    value={vitals.respiratoryRate || ""}
                    onChange={(e) => updateVitals("respiratoryRate", e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="16"
                    className={cn(
                      "h-8 text-sm",
                      validations.rr.status === "critical" && "border-red-300 bg-red-50",
                      validations.rr.status === "warning" && "border-yellow-300 bg-yellow-50"
                    )}
                  />
                </div>

                {/* SpO2 */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Droplets className="h-3 w-3 text-cyan-500" />
                    SpO₂
                    <TrafficLightStatus status={validations.spo2.status} size="sm" />
                  </Label>
                  <Input
                    type="number"
                    value={vitals.oxygenSaturation || ""}
                    onChange={(e) => updateVitals("oxygenSaturation", e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="98"
                    min="50"
                    max="100"
                    className={cn(
                      "h-8 text-sm",
                      validations.spo2.status === "critical" && "border-red-300 bg-red-50",
                      validations.spo2.status === "warning" && "border-yellow-300 bg-yellow-50"
                    )}
                  />
                </div>

                {/* Consciousness Level */}
                <div className="space-y-1">
                  <Label className="text-xs">AVPU</Label>
                  <Select
                    value={vitals.consciousnessLevel}
                    onValueChange={(v) => updateVitals("consciousnessLevel", v as any)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alert">Alert</SelectItem>
                      <SelectItem value="Verbal">Verbal</SelectItem>
                      <SelectItem value="Pain">Pain</SelectItem>
                      <SelectItem value="Unresponsive">Unresponsive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Weight */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Scale className="h-3 w-3 text-purple-500" />
                    Weight
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={vitals.weight || ""}
                      onChange={(e) => updateVitals("weight", e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="70"
                      className="h-8 text-sm w-full max-w-[70px]"
                    />
                    <Select
                      value={vitals.weightUnit}
                      onValueChange={(v) => updateVitals("weightUnit", v as "kg" | "lbs")}
                    >
                      <SelectTrigger className="w-12 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Ruler className="h-3 w-3 text-indigo-500" />
                    Height
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={vitals.height || ""}
                      onChange={(e) => updateVitals("height", e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="170"
                      className="h-8 text-sm w-full max-w-[70px]"
                    />
                    <Select
                      value={vitals.heightUnit}
                      onValueChange={(v) => updateVitals("heightUnit", v as "cm" | "in")}
                    >
                      <SelectTrigger className="w-12 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cm">cm</SelectItem>
                        <SelectItem value="in">in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* BMI (Auto-calculated) */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Gauge className="h-3 w-3 text-teal-500" />
                    BMI
                  </Label>
                  <div className={cn(
                    "flex h-8 items-center px-2 border rounded-md bg-slate-50 text-sm",
                    vitals.bmi && vitals.bmi >= 30 && "border-red-300",
                    vitals.bmi && vitals.bmi >= 25 && vitals.bmi < 30 && "border-yellow-300"
                  )}>
                    {vitals.bmi ? vitals.bmi.toFixed(1) : "—"}
                    {vitals.bmi && (
                      <span className="ml-1 text-xs text-muted-foreground truncate">
                        {vitals.bmi < 18.5 ? "Under" : 
                         vitals.bmi < 25 ? "Normal" :
                         vitals.bmi < 30 ? "Over" : "Obese"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Pain Scale - Compact */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Pain Score</Label>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {painScaleFaces[vitals.painScore].emoji}
                  </div>
                  <div className="flex-1">
                    <Slider
                      value={[vitals.painScore]}
                      onValueChange={([value]) => updateVitals("painScore", value)}
                      max={10}
                      step={1}
                      className={cn(
                        vitals.painScore <= 3 && "[&_[role=slider]]:bg-green-500",
                        vitals.painScore > 3 && vitals.painScore <= 6 && "[&_[role=slider]]:bg-yellow-500",
                        vitals.painScore > 6 && "[&_[role=slider]]:bg-red-500"
                      )}
                    />
                  </div>
                  <div className="text-center min-w-[50px]">
                    <div className={cn(
                      "text-lg font-bold",
                      vitals.painScore <= 3 && "text-green-600",
                      vitals.painScore > 3 && vitals.painScore <= 6 && "text-yellow-600",
                      vitals.painScore > 6 && "text-red-600"
                    )}>
                      {vitals.painScore}/10
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={vitals.notes || ""}
                  onChange={(e) => updateVitals("notes", e.target.value)}
                  placeholder="Additional observations..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? "Saving..." : "Record Vitals"}
                </Button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {compact && !isExpanded && (
        <CardContent className="pt-0">
          {renderCompactSummary()}
        </CardContent>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Vitals Recording</DialogTitle>
            <DialogDescription>
              Please confirm the vitals data is accurate before recording.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {hasCriticalValues && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Critical Values Present</p>
                  <p className="text-sm text-red-700">This will trigger an alert to the care team.</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {vitals.bloodPressureSystolic && (
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">BP:</span>{" "}
                  <strong>{vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic} mmHg</strong>
                </div>
              )}
              {vitals.heartRate && (
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">HR:</span>{" "}
                  <strong>{vitals.heartRate} bpm</strong>
                </div>
              )}
              {vitals.temperature && (
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">Temp:</span>{" "}
                  <strong>{vitals.temperature}°{vitals.temperatureUnit}</strong>
                </div>
              )}
              {vitals.oxygenSaturation && (
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-muted-foreground">SpO₂:</span>{" "}
                  <strong>{vitals.oxygenSaturation}%</strong>
                </div>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              Recorded by: {employeeName} ({employeeRole}) at {new Date().toLocaleString()}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default NurseVitalsCard;
