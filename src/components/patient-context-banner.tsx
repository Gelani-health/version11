"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Heart,
  Activity,
  Droplets,
  Phone,
  Shield,
  CreditCard,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  Contact,
  Pill,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface InsuranceInfo {
  provider: string;
  idNumber: string;
  isActive: boolean;
}

interface PatientContextData {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType?: string;
  rhFactor?: string;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
  insurance?: InsuranceInfo;
  emergencyContact?: EmergencyContact;
  consentFlags?: {
    treatment: boolean;
    dataSharing: boolean;
    research: boolean;
  };
  phone?: string;
}

interface VitalsSummary {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  recordedAt?: string;
}

interface PatientContextBannerProps {
  patient: PatientContextData | null;
  vitals?: VitalsSummary;
  defaultExpanded?: boolean;
  isSticky?: boolean;
  onEditPatient?: () => void;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================
// ALLERGY BADGE COMPONENT
// ============================================

interface AllergyBadgeProps {
  allergy: string;
  severity?: "mild" | "moderate" | "severe";
}

function AllergyBadge({ allergy, severity = "moderate" }: AllergyBadgeProps) {
  const severityConfig = {
    mild: "bg-yellow-100 text-yellow-800 border-yellow-300",
    moderate: "bg-orange-100 text-orange-800 border-orange-300",
    severe: "bg-red-100 text-red-800 border-red-300 animate-pulse",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2 py-1",
        severityConfig[severity]
      )}
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      {allergy}
    </Badge>
  );
}

// ============================================
// VITAL INDICATOR COMPONENT
// ============================================

interface VitalIndicatorProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: "normal" | "warning" | "critical";
  icon?: React.ReactNode;
}

function VitalIndicator({ label, value, unit, status = "normal", icon }: VitalIndicatorProps) {
  const statusColors = {
    normal: "text-emerald-600 bg-emerald-50",
    warning: "text-amber-600 bg-amber-50",
    critical: "text-red-600 bg-red-50",
  };

  return (
    <div className={cn(
      "flex flex-col items-center p-2 rounded-lg min-w-[70px]",
      statusColors[status]
    )}>
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-sm font-bold">{value}</span>
        {unit && <span className="text-xs">{unit}</span>}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PatientContextBanner({
  patient,
  vitals,
  defaultExpanded = false,
  isSticky = true,
  onEditPatient,
  className,
}: PatientContextBannerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAllAllergies, setShowAllAllergies] = useState(false);

  // Parse allergies from JSON if needed
  const parsedAllergies = useMemo(() => {
    if (!patient?.allergies) return [];
    if (typeof patient.allergies === "string") {
      try {
        const parsed = JSON.parse(patient.allergies);
        return Array.isArray(parsed) ? parsed.map((a: any) => a.name || a) : [];
      } catch {
        return patient.allergies.split(",").map((a: string) => a.trim());
      }
    }
    return patient.allergies;
  }, [patient?.allergies]);

  // Parse chronic conditions from JSON if needed
  const parsedConditions = useMemo(() => {
    if (!patient?.chronicConditions) return [];
    if (typeof patient.chronicConditions === "string") {
      try {
        const parsed = JSON.parse(patient.chronicConditions);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return patient.chronicConditions.split(",").map((c: string) => c.trim());
      }
    }
    return patient.chronicConditions;
  }, [patient?.chronicConditions]);

  // Determine vitals status
  const getVitalsStatus = () => {
    if (!vitals) return null;
    
    const status = {
      bp: "normal" as "normal" | "warning" | "critical",
      hr: "normal" as "normal" | "warning" | "critical",
      spo2: "normal" as "normal" | "warning" | "critical",
    };

    if (vitals.bloodPressureSystolic) {
      if (vitals.bloodPressureSystolic >= 180 || vitals.bloodPressureSystolic < 90) {
        status.bp = "critical";
      } else if (vitals.bloodPressureSystolic >= 140 || vitals.bloodPressureSystolic < 100) {
        status.bp = "warning";
      }
    }

    if (vitals.heartRate) {
      if (vitals.heartRate > 150 || vitals.heartRate < 50) {
        status.hr = "critical";
      } else if (vitals.heartRate > 120 || vitals.heartRate < 60) {
        status.hr = "warning";
      }
    }

    if (vitals.oxygenSaturation) {
      if (vitals.oxygenSaturation < 90) {
        status.spo2 = "critical";
      } else if (vitals.oxygenSaturation < 95) {
        status.spo2 = "warning";
      }
    }

    return status;
  };

  const vitalsStatus = getVitalsStatus();

  if (!patient) {
    return (
      <Card className={cn(
        "border-0 shadow-md",
        isSticky && "sticky top-0 z-20",
        className
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <User className="h-6 w-6" />
            <span className="text-sm">No patient selected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const age = calculateAge(patient.dateOfBirth);
  const displayAllergies = showAllAllergies ? parsedAllergies : parsedAllergies.slice(0, 3);

  return (
    <Card className={cn(
      "border-0 shadow-lg overflow-hidden",
      isSticky && "sticky top-0 z-20",
      className
    )}>
      {/* Gradient Header */}
      <div
        className={cn(
          "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white cursor-pointer",
          isExpanded ? "p-4" : "p-3"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Patient Avatar */}
            <Avatar className={cn(
              "border-2 border-white/30",
              isExpanded ? "h-12 w-12" : "h-10 w-10"
            )}>
              <AvatarFallback className="bg-white/20 text-white font-bold">
                {patient.firstName[0]}{patient.lastName[0]}
              </AvatarFallback>
            </Avatar>

            {/* Patient Quick Info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{fullName}</h3>
                {parsedAllergies.length > 0 && (
                  <Badge className="bg-red-500/90 text-white text-xs animate-pulse">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {parsedAllergies.length} Allergie{parsedAllergies.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  MRN: {patient.mrn}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  DOB: {formatDate(patient.dateOfBirth)} ({age}y)
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {patient.gender}
                </span>
                {patient.bloodType && (
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {patient.bloodType}{patient.rhFactor || ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Allergies Bar - Always visible if present */}
        {parsedAllergies.length > 0 && !isExpanded && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {displayAllergies.map((allergy: string, index: number) => (
              <Badge
                key={index}
                className="bg-white/20 text-white border border-white/30 text-xs"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {allergy}
              </Badge>
            ))}
            {parsedAllergies.length > 3 && !showAllAllergies && (
              <span className="text-xs text-white/70">
                +{parsedAllergies.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="p-0">
              {/* Vitals Summary Bar */}
              {vitals && (
                <div className="bg-slate-50 p-3 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Latest Vitals
                    </span>
                    {vitals.recordedAt && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(vitals.recordedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic && (
                      <VitalIndicator
                        label="BP"
                        value={`${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`}
                        unit="mmHg"
                        status={vitalsStatus?.bp}
                        icon={<Heart className="h-3 w-3" />}
                      />
                    )}
                    {vitals.heartRate && (
                      <VitalIndicator
                        label="HR"
                        value={vitals.heartRate}
                        unit="bpm"
                        status={vitalsStatus?.hr}
                      />
                    )}
                    {vitals.oxygenSaturation && (
                      <VitalIndicator
                        label="SpO2"
                        value={vitals.oxygenSaturation}
                        unit="%"
                        status={vitalsStatus?.spo2}
                      />
                    )}
                    {vitals.temperature && (
                      <VitalIndicator
                        label="Temp"
                        value={vitals.temperature}
                        unit="°C"
                        status="normal"
                      />
                    )}
                    {vitals.respiratoryRate && (
                      <VitalIndicator
                        label="RR"
                        value={vitals.respiratoryRate}
                        unit="/min"
                        status="normal"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Main Content Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                {/* Allergies Section */}
                {parsedAllergies.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Allergies
                      </h4>
                      <Badge variant="outline" className="text-xs border-red-200 text-red-700">
                        {parsedAllergies.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedAllergies.map((allergy: string, index: number) => (
                        <AllergyBadge
                          key={index}
                          allergy={allergy}
                          severity={index === 0 ? "severe" : "moderate"}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Chronic Conditions */}
                {parsedConditions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <Heart className="h-4 w-4 text-purple-500" />
                        Conditions
                      </h4>
                      <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
                        {parsedConditions.length}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedConditions.slice(0, 4).map((condition: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                        >
                          {condition}
                        </Badge>
                      ))}
                      {parsedConditions.length > 4 && (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          +{parsedConditions.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Insurance Status */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    Insurance
                  </h4>
                  {patient.insurance ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "text-xs",
                            patient.insurance.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {patient.insurance.isActive ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{patient.insurance.provider}</p>
                      <p className="text-xs text-slate-500">ID: {patient.insurance.idNumber}</p>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-slate-500">
                      No insurance on file
                    </Badge>
                  )}
                </div>

                {/* Emergency Contact */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Contact className="h-4 w-4 text-amber-500" />
                    Emergency Contact
                  </h4>
                  {patient.emergencyContact ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-700">{patient.emergencyContact.name}</p>
                      <p className="text-xs text-slate-500">{patient.emergencyContact.relationship}</p>
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <Phone className="h-3 w-3" />
                        {patient.emergencyContact.phone}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-slate-500">
                      No contact on file
                    </Badge>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              {patient.currentMedications && patient.currentMedications.length > 0 && (
                <>
                  <Separator />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <Pill className="h-4 w-4 text-teal-500" />
                        Current Medications
                      </h4>
                      <Badge variant="outline" className="text-xs border-teal-200 text-teal-700">
                        {patient.currentMedications.length}
                      </Badge>
                    </div>
                    <ScrollArea className="max-h-24">
                      <div className="flex flex-wrap gap-1">
                        {patient.currentMedications.map((med: string, index: number) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs bg-teal-50 text-teal-700 border-teal-200"
                          >
                            {med}
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}

              {/* Consent Flags */}
              {patient.consentFlags && (
                <>
                  <Separator />
                  <div className="p-4 bg-slate-50">
                    <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1 mb-2">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      Consent Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={cn(
                          "text-xs",
                          patient.consentFlags.treatment
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {patient.consentFlags.treatment ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Treatment Consent
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Treatment Consent
                          </>
                        )}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-xs",
                          patient.consentFlags.dataSharing
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {patient.consentFlags.dataSharing ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Data Sharing OK
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            No Data Sharing
                          </>
                        )}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-xs",
                          patient.consentFlags.research
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {patient.consentFlags.research ? (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Research OK
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            No Research
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              {/* Footer with Edit Link */}
              <div className="px-4 py-2 bg-slate-100 border-t flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  This data is read-only in consultation view
                </span>
                {onEditPatient && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={onEditPatient}
                  >
                    Edit in Patient Registry →
                  </Button>
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default PatientContextBanner;
