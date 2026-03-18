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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// VITALS VALIDATION & STATUS CALCULATION
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
  
  // Critical hypertension or hypotension
  if (systolic >= 180 || diastolic >= 120) {
    return { isValid: true, status: "critical", message: "Hypertensive Crisis" };
  }
  if (systolic < 90 || diastolic < 60) {
    return { isValid: true, status: "critical", message: "Hypotension" };
  }
  
  // Warning zone
  if (systolic >= 140 || diastolic >= 90) {
    return { isValid: true, status: "warning", message: "Hypertension Stage 1-2" };
  }
  if (systolic >= 130 && systolic < 140) {
    return { isValid: true, status: "warning", message: "Elevated BP" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateHeartRate = (hr: number | null): VitalsValidation => {
  if (!hr) return { isValid: true, status: "normal" };
  
  if (hr < 20 || hr > 300) {
    return { isValid: false, status: "critical", message: "Value out of physiological range" };
  }
  
  if (hr < 50 || hr > 120) {
    return { isValid: true, status: "warning", message: hr < 50 ? "Bradycardia" : "Tachycardia" };
  }
  if (hr < 40 || hr > 150) {
    return { isValid: true, status: "critical", message: hr < 40 ? "Severe Bradycardia" : "Severe Tachycardia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const validateRespiratoryRate = (rr: number | null): VitalsValidation => {
  if (!rr) return { isValid: true, status: "normal" };
  
  if (rr < 4 || rr > 80) {
    return { isValid: false, status: "critical", message: "Value out of physiological range" };
  }
  
  if (rr < 10 || rr > 24) {
    return { isValid: true, status: "warning", message: rr < 10 ? "Bradypnea" : "Tachypnea" };
  }
  if (rr < 8 || rr > 30) {
    return { isValid: true, status: "critical", message: rr < 8 ? "Severe Bradypnea" : "Severe Tachypnea" };
  }
  
  return { isValid: true, status: "normal", message: "Normal (12-20)" };
};

const validateSpO2 = (spo2: number | null): VitalsValidation => {
  if (!spo2) return { isValid: true, status: "normal" };
  
  if (spo2 < 50 || spo2 > 100) {
    return { isValid: false, status: "critical", message: "Value out of range" };
  }
  
  if (spo2 < 90) {
    return { isValid: true, status: "critical", message: "Hypoxemia - Requires immediate attention" };
  }
  if (spo2 < 94) {
    return { isValid: true, status: "warning", message: "Mild Hypoxemia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal (95-100%)" };
};

const validateTemperature = (temp: number | null, unit: string): VitalsValidation => {
  if (!temp) return { isValid: true, status: "normal" };
  
  const tempC = unit === "F" ? (temp - 32) * 5/9 : temp;
  
  if (tempC < 25 || tempC > 45) {
    return { isValid: false, status: "critical", message: "Value out of physiological range" };
  }
  
  if (tempC >= 39) {
    return { isValid: true, status: "critical", message: "High Fever" };
  }
  if (tempC >= 38) {
    return { isValid: true, status: "warning", message: "Fever" };
  }
  if (tempC < 36) {
    return { isValid: true, status: "warning", message: "Hypothermia" };
  }
  if (tempC < 35) {
    return { isValid: true, status: "critical", message: "Severe Hypothermia" };
  }
  
  return { isValid: true, status: "normal", message: "Normal (36.1-37.2°C)" };
};

const validateGlucose = (glucose: number | null, unit: string, type: string): VitalsValidation => {
  if (!glucose) return { isValid: true, status: "normal" };
  
  // Convert to mmol/L for comparison
  const glucoseMmol = unit === "mg/dL" ? glucose / 18 : glucose;
  
  if (glucoseMmol < 1 || glucoseMmol > 50) {
    return { isValid: false, status: "critical", message: "Value out of physiological range" };
  }
  
  const isFasting = type === "fasting";
  
  if (isFasting) {
    if (glucoseMmol < 3.9) {
      return { isValid: true, status: "warning", message: "Low fasting glucose" };
    }
    if (glucoseMmol >= 7) {
      return { isValid: true, status: "critical", message: "High fasting glucose - Diabetes range" };
    }
    if (glucoseMmol >= 5.6) {
      return { isValid: true, status: "warning", message: "Impaired fasting glucose" };
    }
  } else {
    if (glucoseMmol < 3.9) {
      return { isValid: true, status: "warning", message: "Low glucose" };
    }
    if (glucoseMmol >= 11.1) {
      return { isValid: true, status: "critical", message: "High glucose - Diabetes range" };
    }
    if (glucoseMmol >= 7.8) {
      return { isValid: true, status: "warning", message: "Impaired glucose tolerance" };
    }
  }
  
  return { isValid: true, status: "normal", message: "Normal" };
};

const calculateBMI = (weight: number | null, height: number | null, weightUnit: string, heightUnit: string): number | null => {
  if (!weight || !height) return null;
  
  // Convert to kg and meters
  const weightKg = weightUnit === "lbs" ? weight * 0.453592 : weight;
  const heightM = heightUnit === "in" ? height * 0.0254 : height / 100;
  
  if (heightM <= 0) return null;
  
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
};

// ============================================
// PAIN SCALE FACES
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
// INTERFACES
// ============================================

interface VitalsFormData {
  temperature: string;
  temperatureUnit: "C" | "F";
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weight: string;
  weightUnit: "kg" | "lbs";
  height: string;
  heightUnit: "cm" | "in";
  bmi: number | null;
  bloodGlucose: string;
  glucoseUnit: "mmol/L" | "mg/dL";
  glucoseType: "fasting" | "random";
  painScore: number;
  consciousnessLevel: "Alert" | "Verbal" | "Pain" | "Unresponsive";
  notes: string;
}

interface VitalsEntryFormProps {
  patientId: string;
  encounterId?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  onSubmit: (data: VitalsFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<VitalsFormData>;
  isAmendment?: boolean;
  amendmentReason?: string;
}

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({ status, message }: { status: string; message?: string }) {
  const colors = {
    normal: "bg-green-100 text-green-700 border-green-300",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-300",
    critical: "bg-red-100 text-red-700 border-red-300",
  };
  
  const icons = {
    normal: <Check className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    critical: <AlertTriangle className="h-3 w-3" />,
  };
  
  return (
    <Badge variant="outline" className={cn("ml-2 text-xs", colors[status as keyof typeof colors])}>
      {icons[status as keyof typeof icons]}
      <span className="ml-1">{message || status}</span>
    </Badge>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VitalsEntryForm({
  patientId,
  encounterId,
  employeeId,
  employeeName,
  employeeRole,
  onSubmit,
  onCancel,
  initialData,
  isAmendment = false,
  amendmentReason,
}: VitalsEntryFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amendmentReasonText, setAmendmentReasonText] = useState(amendmentReason || "");
  
  const [formData, setFormData] = useState<VitalsFormData>({
    temperature: "",
    temperatureUnit: "C",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    weightUnit: "kg",
    height: "",
    heightUnit: "cm",
    bmi: null,
    bloodGlucose: "",
    glucoseUnit: "mmol/L",
    glucoseType: "random",
    painScore: 0,
    consciousnessLevel: "Alert",
    notes: "",
    ...initialData,
  });

  // Validation states
  const [validations, setValidations] = useState({
    bp: { isValid: true, status: "normal" as const, message: "" },
    hr: { isValid: true, status: "normal" as const, message: "" },
    rr: { isValid: true, status: "normal" as const, message: "" },
    spo2: { isValid: true, status: "normal" as const, message: "" },
    temp: { isValid: true, status: "normal" as const, message: "" },
    glucose: { isValid: true, status: "normal" as const, message: "" },
  });

  // Calculate BMI on weight/height change
  useEffect(() => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    const bmi = calculateBMI(weight || null, height || null, formData.weightUnit, formData.heightUnit);
    setFormData(prev => ({ ...prev, bmi }));
  }, [formData.weight, formData.height, formData.weightUnit, formData.heightUnit]);

  // Validate on change
  useEffect(() => {
    const sbp = parseInt(formData.bloodPressureSystolic);
    const dbp = parseInt(formData.bloodPressureDiastolic);
    const hr = parseInt(formData.heartRate);
    const rr = parseInt(formData.respiratoryRate);
    const spo2 = parseFloat(formData.oxygenSaturation);
    const temp = parseFloat(formData.temperature);
    const glucose = parseFloat(formData.bloodGlucose);

    setValidations({
      bp: validateBloodPressure(sbp || null, dbp || null),
      hr: validateHeartRate(hr || null),
      rr: validateRespiratoryRate(rr || null),
      spo2: validateSpO2(spo2 || null),
      temp: validateTemperature(temp || null, formData.temperatureUnit),
      glucose: validateGlucose(glucose || null, formData.glucoseUnit, formData.glucoseType),
    });
  }, [
    formData.bloodPressureSystolic,
    formData.bloodPressureDiastolic,
    formData.heartRate,
    formData.respiratoryRate,
    formData.oxygenSaturation,
    formData.temperature,
    formData.temperatureUnit,
    formData.bloodGlucose,
    formData.glucoseUnit,
    formData.glucoseType,
  ]);

  // Check for any critical values
  const hasCriticalValues = Object.values(validations).some(v => v.status === "critical");

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.bloodPressureSystolic && !formData.heartRate && !formData.temperature) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one vital sign measurement",
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
        description: `Please correct the following: ${invalidFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (isAmendment && !amendmentReasonText.trim()) {
      toast({
        title: "Amendment Reason Required",
        description: "Please provide a reason for the amendment",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...formData,
        amendmentReason: isAmendment ? amendmentReasonText : undefined,
      });
      toast({
        title: "Success",
        description: isAmendment ? "Vitals amendment recorded" : "Vitals recorded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record vitals",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof VitalsFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600" />
          {isAmendment ? "Amend Vitals" : "Vitals Entry"}
        </CardTitle>
        <CardDescription>
          Record patient vital signs • Required fields marked with *
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amendment Reason */}
        {isAmendment && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <Label className="text-orange-700">Amendment Reason *</Label>
            <Textarea
              value={amendmentReasonText}
              onChange={(e) => setAmendmentReasonText(e.target.value)}
              placeholder="Reason for vitals amendment..."
              className="mt-2"
              rows={2}
            />
          </div>
        )}

        {/* Critical Alert Banner */}
        {hasCriticalValues && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Critical Values Detected</h4>
              <p className="text-sm text-red-700 mt-1">
                One or more vital signs are outside normal range. Immediate attention may be required.
              </p>
            </div>
          </motion.div>
        )}

        {/* Recording Info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">
          <span className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Recorded by: <strong>{employeeName}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Info className="h-4 w-4" />
            Role: <strong>{employeeRole}</strong>
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw className="h-4 w-4" />
            {new Date().toLocaleString()}
          </span>
        </div>

        {/* Vital Signs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Temperature */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-500" />
              Temperature
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => updateField("temperature", e.target.value)}
                placeholder="36.5"
                className={cn(
                  "flex-1",
                  validations.temp.status === "critical" && "border-red-300",
                  validations.temp.status === "warning" && "border-yellow-300"
                )}
              />
              <Select
                value={formData.temperatureUnit}
                onValueChange={(v) => updateField("temperatureUnit", v)}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">°C</SelectItem>
                  <SelectItem value="F">°F</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.temperature && (
              <StatusBadge status={validations.temp.status} message={validations.temp.message} />
            )}
          </div>

          {/* Blood Pressure */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Blood Pressure *
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={formData.bloodPressureSystolic}
                onChange={(e) => updateField("bloodPressureSystolic", e.target.value)}
                placeholder="120"
                className={cn(
                  "w-24",
                  validations.bp.status === "critical" && "border-red-300",
                  validations.bp.status === "warning" && "border-yellow-300"
                )}
              />
              <span className="text-muted-foreground">/</span>
              <Input
                type="number"
                value={formData.bloodPressureDiastolic}
                onChange={(e) => updateField("bloodPressureDiastolic", e.target.value)}
                placeholder="80"
                className={cn(
                  "w-24",
                  validations.bp.status === "critical" && "border-red-300",
                  validations.bp.status === "warning" && "border-yellow-300"
                )}
              />
              <span className="text-sm text-muted-foreground">mmHg</span>
            </div>
            {(formData.bloodPressureSystolic || formData.bloodPressureDiastolic) && (
              <StatusBadge status={validations.bp.status} message={validations.bp.message} />
            )}
          </div>

          {/* Heart Rate */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-pink-500" />
              Heart Rate
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={formData.heartRate}
                onChange={(e) => updateField("heartRate", e.target.value)}
                placeholder="72"
                className={cn(
                  "flex-1",
                  validations.hr.status === "critical" && "border-red-300",
                  validations.hr.status === "warning" && "border-yellow-300"
                )}
              />
              <span className="text-sm text-muted-foreground">bpm</span>
            </div>
            {formData.heartRate && (
              <StatusBadge status={validations.hr.status} message={validations.hr.message} />
            )}
          </div>

          {/* Respiratory Rate */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              Respiratory Rate
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={formData.respiratoryRate}
                onChange={(e) => updateField("respiratoryRate", e.target.value)}
                placeholder="16"
                className={cn(
                  "flex-1",
                  validations.rr.status === "critical" && "border-red-300",
                  validations.rr.status === "warning" && "border-yellow-300"
                )}
              />
              <span className="text-sm text-muted-foreground">breaths/min</span>
            </div>
            {formData.respiratoryRate && (
              <StatusBadge status={validations.rr.status} message={validations.rr.message} />
            )}
          </div>

          {/* Oxygen Saturation */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-cyan-500" />
              SpO₂
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.1"
                min="50"
                max="100"
                value={formData.oxygenSaturation}
                onChange={(e) => updateField("oxygenSaturation", e.target.value)}
                placeholder="98"
                className={cn(
                  "flex-1",
                  validations.spo2.status === "critical" && "border-red-300",
                  validations.spo2.status === "warning" && "border-yellow-300"
                )}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {formData.oxygenSaturation && (
              <StatusBadge status={validations.spo2.status} message={validations.spo2.message} />
            )}
          </div>

          {/* Weight */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple-500" />
              Weight
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => updateField("weight", e.target.value)}
                placeholder="70"
                className="flex-1"
              />
              <Select
                value={formData.weightUnit}
                onValueChange={(v) => updateField("weightUnit", v)}
              >
                <SelectTrigger className="w-20">
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
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-indigo-500" />
              Height
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) => updateField("height", e.target.value)}
                placeholder="170"
                className="flex-1"
              />
              <Select
                value={formData.heightUnit}
                onValueChange={(v) => updateField("heightUnit", v)}
              >
                <SelectTrigger className="w-20">
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
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-teal-500" />
              BMI (Auto-calculated)
            </Label>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex-1 px-3 py-2 border rounded-md bg-slate-50",
                formData.bmi && formData.bmi >= 30 && "border-red-300",
                formData.bmi && formData.bmi >= 25 && formData.bmi < 30 && "border-yellow-300"
              )}>
                {formData.bmi ? formData.bmi.toFixed(1) : "—"}
              </div>
              <span className="text-sm text-muted-foreground">kg/m²</span>
            </div>
            {formData.bmi && (
              <p className="text-xs text-muted-foreground">
                {formData.bmi < 18.5 ? "Underweight" : 
                 formData.bmi < 25 ? "Normal" :
                 formData.bmi < 30 ? "Overweight" : "Obese"}
              </p>
            )}
          </div>

          {/* Blood Glucose */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-amber-500" />
              Blood Glucose
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                value={formData.bloodGlucose}
                onChange={(e) => updateField("bloodGlucose", e.target.value)}
                placeholder="5.5"
                className={cn(
                  "flex-1",
                  validations.glucose.status === "critical" && "border-red-300",
                  validations.glucose.status === "warning" && "border-yellow-300"
                )}
              />
              <Select
                value={formData.glucoseUnit}
                onValueChange={(v) => updateField("glucoseUnit", v)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mmol/L">mmol/L</SelectItem>
                  <SelectItem value="mg/dL">mg/dL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select
              value={formData.glucoseType}
              onValueChange={(v) => updateField("glucoseType", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fasting">Fasting</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
            {formData.bloodGlucose && (
              <StatusBadge status={validations.glucose.status} message={validations.glucose.message} />
            )}
          </div>

          {/* Consciousness Level */}
          <div className="space-y-3">
            <Label>Level of Consciousness (AVPU)</Label>
            <Select
              value={formData.consciousnessLevel}
              onValueChange={(v) => updateField("consciousnessLevel", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Alert">Alert</SelectItem>
                <SelectItem value="Verbal">Responds to Verbal</SelectItem>
                <SelectItem value="Pain">Responds to Pain</SelectItem>
                <SelectItem value="Unresponsive">Unresponsive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Pain Scale */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Pain Score</Label>
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {painScaleFaces[formData.painScore].emoji}
            </div>
            <div className="flex-1">
              <Slider
                value={[formData.painScore]}
                onValueChange={([value]) => updateField("painScore", value)}
                max={10}
                step={1}
                className={cn(
                  formData.painScore <= 3 && "[&_[role=slider]]:bg-green-500",
                  formData.painScore > 3 && formData.painScore <= 6 && "[&_[role=slider]]:bg-yellow-500",
                  formData.painScore > 6 && "[&_[role=slider]]:bg-red-500"
                )}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0 - No Pain</span>
                <span>5 - Moderate</span>
                <span>10 - Worst</span>
              </div>
            </div>
            <div className="text-center min-w-[60px]">
              <div className={cn(
                "text-2xl font-bold",
                formData.painScore <= 3 && "text-green-600",
                formData.painScore > 3 && formData.painScore <= 6 && "text-yellow-600",
                formData.painScore > 6 && "text-red-600"
              )}>
                {formData.painScore}/10
              </div>
              <div className="text-xs text-muted-foreground">
                {painScaleFaces[formData.painScore].label}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Notes */}
        <div className="space-y-2">
          <Label>Additional Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Any additional observations or context..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : isAmendment ? "Record Amendment" : "Record Vitals"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default VitalsEntryForm;
