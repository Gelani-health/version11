"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Heart,
  Activity,
  FileText,
  Save,
  Lock,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Search,
  Sparkles,
  Clock,
  UserCog,
  Pill,
  FlaskConical,
  ArrowRightLeft,
  Send,
  ClipboardList,
  Baby,
  Shield,
  Info,
  Check,
  X,
  Edit3,
  PlusCircle,
  Mic,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VitalsCard } from "./vitals-card";
import { VoiceInputButton } from "./voice-input-button";

// ============================================
// TYPES
// ============================================

interface ICDCode {
  code: string;
  description: string;
  category?: string;
}

interface DiagnosisEntry {
  code: string;
  description: string;
  confidence?: "Likely" | "Possible" | "Rule Out";
}

interface MedicationOrder {
  drugName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  safetyChecked: boolean;
}

interface ClinicalOrder {
  orderType: "lab" | "imaging" | "procedure";
  orderName: string;
  urgency: "routine" | "urgent" | "stat";
  details?: string;
}

interface Referral {
  specialty: string;
  urgency: "routine" | "urgent";
  reason: string;
}

interface NurseTask {
  taskDescription: string;
  priority: "routine" | "urgent" | "stat";
}

interface SOAPNoteData {
  // SUBJECTIVE
  chiefComplaint: string;
  hpiOnset: string;
  hpiLocation: string;
  hpiDuration: string;
  hpiCharacter: string;
  hpiAggravating: string;
  hpiRelieving: string;
  hpiTiming: string;
  hpiSeverity: number;
  hpiNarrative: string;
  ros: Record<string, { checked: boolean; notes: string }>;
  pmhUpdate: string;
  pshUpdate: string;
  familyHistory: string;
  socialHistory: string;
  medicationsReview: string;
  allergiesConfirmed: boolean;
  obgynHistory: string;

  // OBJECTIVE
  vitalsId?: string;
  vitalsData?: any;
  generalAppearance: string;
  physicalExam: Record<string, string>;
  diagnosticResults: string;
  functionalAssessment: string;

  // ASSESSMENT
  primaryDiagnosis: DiagnosisEntry | null;
  differentials: DiagnosisEntry[];
  clinicalReasoning: string;
  problemListUpdates: string;
  riskFlags: string[];

  // PLAN
  clinicalOrders: ClinicalOrder[];
  medications: MedicationOrder[];
  referrals: Referral[];
  patientEducation: string[];
  patientEducationNotes: string;
  followUpDate: string;
  followUpMode: string;
  followUpClinician: string;
  nursingInstructions: string;
  nurseTasks: NurseTask[];
  disposition: string;
  dispositionDestination: string;
  dispositionReason: string;

  // Metadata
  status: "draft" | "signed" | "amended";
}

interface SOAPNoteTemplateProps {
  patientId: string;
  encounterId?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  patientData?: {
    name: string;
    dob: string;
    mrn: string;
    gender: string;
    allergies: string[];
    activeMedications: string[];
    chronicConditions: string[];
    recentVitals?: any;
  };
  existingNote?: Partial<SOAPNoteData>;
  mode: "create" | "edit" | "view";
  onSubmit: (data: SOAPNoteData) => Promise<void>;
  onSign: (data: SOAPNoteData) => Promise<void>;
  onAddendum?: (addendumText: string) => Promise<void>;
  onAISuggest?: (section: string, data: Partial<SOAPNoteData>) => Promise<string>;
}

// ============================================
// ROS BODY SYSTEMS - Sorted Alphabetically
// ============================================

const rosSystems = [
  { key: "cardiovascular", label: "Cardiovascular", icon: "❤️", items: ["Chest pain", "Palpitations", "Shortness of breath", "Leg swelling", "Orthopnea"] },
  { key: "constitutional", label: "Constitutional", icon: "🌡️", items: ["Fever", "Chills", "Fatigue", "Weight loss", "Weight gain", "Appetite changes"] },
  { key: "endocrine", label: "Endocrine", icon: "⚗️", items: ["Polydipsia", "Polyuria", "Polyphagia", "Heat/cold intolerance", "Sweating"] },
  { key: "gastrointestinal", label: "Gastrointestinal", icon: "🫃", items: ["Nausea", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Blood in stool"] },
  { key: "genitourinary", label: "Genitourinary", icon: "🚻", items: ["Dysuria", "Frequency", "Hematuria", "Incontinence", "Flank pain"] },
  { key: "hematologic", label: "Hematologic/Lymphatic", icon: "🩸", items: ["Easy bruising", "Bleeding", "Lymphadenopathy", "Anemia symptoms"] },
  { key: "heent", label: "HEENT", icon: "👁️", items: ["Headache", "Visual changes", "Hearing changes", "Nasal congestion", "Sore throat", "Ear pain"] },
  { key: "musculoskeletal", label: "Musculoskeletal", icon: "🦴", items: ["Joint pain", "Muscle pain", "Back pain", "Swelling", "Stiffness", "Weakness"] },
  { key: "neurological", label: "Neurological", icon: "🧠", items: ["Headache", "Dizziness", "Syncope", "Numbness", "Tingling", "Weakness", "Seizures"] },
  { key: "psychiatric", label: "Psychiatric", icon: "🧠", items: ["Depression", "Anxiety", "Sleep disturbances", "Memory problems", "Mood changes"] },
  { key: "respiratory", label: "Respiratory", icon: "🫁", items: ["Cough", "Shortness of breath", "Wheezing", "Sputum", "Hemoptysis"] },
  { key: "skin", label: "Skin", icon: "🤚", items: ["Rash", "Itching", "Lesions", "Color changes", "Wounds"] },
];

// ============================================
// PATIENT EDUCATION TOPICS - Sorted Alphabetically
// ============================================

const educationTopics = [
  { id: "diet", label: "Dietary Recommendations" },
  { id: "disease", label: "Disease Education" },
  { id: "exercise", label: "Exercise/Activity" },
  { id: "followup", label: "Follow-up Instructions" },
  { id: "lifestyle", label: "Lifestyle Modifications" },
  { id: "medications", label: "Medication Instructions" },
  { id: "redflags", label: "Warning Signs/Red Flags" },
  { id: "return", label: "Return Precautions" },
];

// ============================================
// COMMON ICD-10 CODES (Sample) - Sorted Alphabetically by Description
// ============================================

const commonICDCodes: ICDCode[] = [
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { code: "K29.70", description: "Gastritis, unspecified, without bleeding", category: "GI" },
  { code: "K21.0", description: "Gastro-esophageal reflux disease with esophagitis", category: "GI" },
  { code: "R51", description: "Headache", category: "Neurological" },
  { code: "I10", description: "Essential (primary) hypertension", category: "Cardiovascular" },
  { code: "F32.9", description: "Major depressive disorder, unspecified", category: "Psychiatric" },
  { code: "G43.909", description: "Migraine, unspecified, not intractable", category: "Neurological" },
  { code: "M54.5", description: "Low back pain", category: "Musculoskeletal" },
  { code: "F41.9", description: "Anxiety disorder, unspecified", category: "Psychiatric" },
  { code: "J18.9", description: "Pneumonia, unspecified organism", category: "Respiratory" },
  { code: "R05", description: "Cough", category: "Respiratory" },
  { code: "L30.9", description: "Dermatitis, unspecified", category: "Skin" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications", category: "Endocrine" },
  { code: "A09", description: "Infectious gastroenteritis and colitis, unspecified", category: "Infectious" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  { code: "R50.9", description: "Fever, unspecified", category: "Constitutional" },
  { code: "N39.0", description: "Urinary tract infection, site not specified", category: "GU" },
  { code: "M79.3", description: "Panniculitis, unspecified", category: "Musculoskeletal" },
].sort((a, b) => a.description.localeCompare(b.description));

// ============================================
// RISK FLAGS
// ============================================

const riskFlagOptions = [
  { id: "sepsis", label: "Sepsis Risk", color: "red" },
  { id: "dvt", label: "DVT Risk", color: "orange" },
  { id: "falls", label: "Falls Risk", color: "yellow" },
  { id: "aspiration", label: "Aspiration Risk", color: "red" },
  { id: "bleeding", label: "Bleeding Risk", color: "red" },
  { id: "cardiac", label: "Cardiac Risk", color: "red" },
  { id: "stroke", label: "Stroke Risk", color: "red" },
  { id: "readmission", label: "Readmission Risk", color: "yellow" },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function SOAPNoteTemplate({
  patientId,
  encounterId,
  employeeId,
  employeeName,
  employeeRole,
  patientData,
  existingNote,
  mode,
  onSubmit,
  onSign,
  onAddendum,
  onAISuggest,
}: SOAPNoteTemplateProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<string>("subjective");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showAddendumDialog, setShowAddendumDialog] = useState(false);
  const [addendumText, setAddendumText] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [icdSearchOpen, setIcdSearchOpen] = useState(false);
  const [icdSearchTerm, setIcdSearchTerm] = useState("");
  const [icdSearchResults, setIcdSearchResults] = useState<ICDCode[]>([]);
  const [selectingDiagnosisFor, setSelectingDiagnosisFor] = useState<"primary" | number | null>(null);

  // Initialize form data
  const [formData, setFormData] = useState<SOAPNoteData>({
    chiefComplaint: "",
    hpiOnset: "",
    hpiLocation: "",
    hpiDuration: "",
    hpiCharacter: "",
    hpiAggravating: "",
    hpiRelieving: "",
    hpiTiming: "",
    hpiSeverity: 0,
    hpiNarrative: "",
    ros: {},
    pmhUpdate: patientData?.chronicConditions?.join(", ") || "",
    pshUpdate: "",
    familyHistory: "",
    socialHistory: "",
    medicationsReview: patientData?.activeMedications?.join(", ") || "",
    allergiesConfirmed: false,
    obgynHistory: "",
    vitalsId: "",
    vitalsData: patientData?.recentVitals,
    generalAppearance: "",
    physicalExam: {},
    diagnosticResults: "",
    functionalAssessment: "",
    primaryDiagnosis: null,
    differentials: [],
    clinicalReasoning: "",
    problemListUpdates: "",
    riskFlags: [],
    clinicalOrders: [],
    medications: [],
    referrals: [],
    patientEducation: [],
    patientEducationNotes: "",
    followUpDate: "",
    followUpMode: "",
    followUpClinician: "",
    nursingInstructions: "",
    nurseTasks: [],
    disposition: "",
    dispositionDestination: "",
    dispositionReason: "",
    status: "draft",
    ...existingNote,
  });

  // Auto-save every 60 seconds
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (formData.status === "draft" && mode !== "view") {
        handleSave(true);
      }
    }, 60000);
    return () => clearInterval(autoSave);
  }, [formData]);

  // ICD Search - Sort results alphabetically by description
  useEffect(() => {
    if (icdSearchTerm) {
      const results = commonICDCodes.filter(
        c => c.code.toLowerCase().includes(icdSearchTerm.toLowerCase()) ||
             c.description.toLowerCase().includes(icdSearchTerm.toLowerCase())
      ).sort((a, b) => a.description.localeCompare(b.description));
      setIcdSearchResults(results);
    } else {
      setIcdSearchResults(commonICDCodes);
    }
  }, [icdSearchTerm]);

  const updateField = (field: keyof SOAPNoteData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (isAutoSave = false) => {
    if (mode === "view") return;
    
    try {
      if (!isAutoSave) setIsSubmitting(true);
      await onSubmit(formData);
      setLastSaved(new Date());
      if (!isAutoSave) {
        toast({ title: "Saved", description: "SOAP note saved as draft" });
      }
    } catch (error) {
      if (!isAutoSave) {
        toast({ title: "Error", description: "Failed to save", variant: "destructive" });
      }
    } finally {
      if (!isAutoSave) setIsSubmitting(false);
    }
  };

  const handleSign = async () => {
    // Validate required fields
    if (!formData.chiefComplaint) {
      toast({ title: "Validation Error", description: "Chief Complaint is required", variant: "destructive" });
      return;
    }
    if (!formData.primaryDiagnosis) {
      toast({ title: "Validation Error", description: "Primary diagnosis is required", variant: "destructive" });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onSign({ ...formData, status: "signed" });
      setShowSignDialog(false);
      toast({ title: "Signed", description: "SOAP note signed and locked" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to sign note", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddendum = async () => {
    if (!addendumText.trim()) {
      toast({ title: "Error", description: "Addendum text is required", variant: "destructive" });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onAddendum?.(addendumText);
      setShowAddendumDialog(false);
      setAddendumText("");
      toast({ title: "Addendum Added", description: "Addendum has been recorded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add addendum", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAISuggest = async (section: string) => {
    if (!onAISuggest) return;
    
    try {
      toast({ title: "AI Assist", description: "Generating suggestions..." });
      const suggestion = await onAISuggest(section, formData);
      updateField(section as keyof SOAPNoteData, suggestion);
      toast({ title: "AI Suggestion Ready", description: "Please review and confirm the suggestion" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to get AI suggestions", variant: "destructive" });
    }
  };

  const selectICDCode = (code: ICDCode) => {
    const diagnosis: DiagnosisEntry = {
      code: code.code,
      description: code.description,
    };
    
    if (selectingDiagnosisFor === "primary") {
      updateField("primaryDiagnosis", diagnosis);
    } else if (typeof selectingDiagnosisFor === "number") {
      const newDifferentials = [...formData.differentials];
      newDifferentials[selectingDiagnosisFor] = diagnosis;
      updateField("differentials", newDifferentials);
    }
    
    setIcdSearchOpen(false);
    setSelectingDiagnosisFor(null);
  };

  const addDifferential = () => {
    if (formData.differentials.length < 5) {
      updateField("differentials", [...formData.differentials, { code: "", description: "", confidence: "Possible" }]);
    }
  };

  const addMedication = () => {
    updateField("medications", [...formData.medications, { drugName: "", dosage: "", frequency: "", safetyChecked: false }]);
  };

  const addClinicalOrder = () => {
    updateField("clinicalOrders", [...formData.clinicalOrders, { orderType: "lab", orderName: "", urgency: "routine" }]);
  };

  const addNurseTask = () => {
    updateField("nurseTasks", [...formData.nurseTasks, { taskDescription: "", priority: "routine" }]);
  };

  // Role-based access
  const isDoctor = employeeRole === "doctor" || employeeRole === "physician" || employeeRole === "specialist";
  const isNurse = employeeRole === "nurse";
  const canEditAssessmentPlan = isDoctor;
  const canSign = isDoctor;

  const isReadOnly = mode === "view" || formData.status === "signed";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Clinical SOAP Note</CardTitle>
                <CardDescription>
                  {isReadOnly ? "Read-only view" : mode === "edit" ? "Edit mode" : "New consultation"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <Badge variant={formData.status === "signed" ? "default" : "secondary"}>
                {formData.status}
              </Badge>
            </div>
          </div>
          
          {/* Recording info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg mt-3">
            <span className="flex items-center gap-1">
              <UserCog className="h-4 w-4" />
              Author: <strong>{employeeName}</strong> ({employeeRole})
            </span>
            {patientData && (
              <>
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Patient: <strong>{patientData.name}</strong>
                </span>
                <span>MRN: {patientData.mrn}</span>
                <span>DOB: {patientData.dob}</span>
              </>
            )}
          </div>
          
          {/* Allergies Alert */}
          {patientData?.allergies && patientData.allergies.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <span className="font-medium text-red-800">Allergies: </span>
                <span className="text-red-700">{patientData.allergies.join(", ")}</span>
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allergies-confirmed"
                    checked={formData.allergiesConfirmed}
                    onCheckedChange={(c) => updateField("allergiesConfirmed", c)}
                  />
                  <Label htmlFor="allergies-confirmed" className="text-sm">
                    Confirmed
                  </Label>
                </div>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Main Form */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="subjective">
            <User className="h-4 w-4 mr-2" />
            Subjective (S)
          </TabsTrigger>
          <TabsTrigger value="objective">
            <Activity className="h-4 w-4 mr-2" />
            Objective (O)
          </TabsTrigger>
          <TabsTrigger value="assessment" disabled={!canEditAssessmentPlan}>
            <Heart className="h-4 w-4 mr-2" />
            Assessment (A)
          </TabsTrigger>
          <TabsTrigger value="plan" disabled={!canEditAssessmentPlan}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Plan (P)
          </TabsTrigger>
        </TabsList>

        {/* SUBJECTIVE SECTION */}
        <TabsContent value="subjective" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Chief Complaint & History</CardTitle>
                {!isReadOnly && onAISuggest && (
                  <Button variant="outline" size="sm" onClick={() => handleAISuggest("hpiNarrative")}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Assist
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chief Complaint */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Chief Complaint (CC) *</Label>
                  {!isReadOnly && (
                    <VoiceInputButton
                      onTranscript={(text) => updateField("chiefComplaint", text)}
                      currentValue={formData.chiefComplaint}
                      context="medical"
                      size="sm"
                      variant="ghost"
                    />
                  )}
                </div>
                <Textarea
                  value={formData.chiefComplaint}
                  onChange={(e) => updateField("chiefComplaint", e.target.value)}
                  placeholder="Patient's primary reason for visit (use patient's own words where possible)"
                  disabled={isReadOnly}
                  rows={2}
                />
              </div>

              <Separator />

              {/* HPI - OLDCARTS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">History of Present Illness (HPI) - OLDCARTS</Label>
                  {!isReadOnly && onAISuggest && (
                    <Button variant="ghost" size="sm" onClick={() => handleAISuggest("hpiNarrative")}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Draft
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Onset</Label>
                    <Input
                      value={formData.hpiOnset}
                      onChange={(e) => updateField("hpiOnset", e.target.value)}
                      placeholder="When did it start?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={formData.hpiLocation}
                      onChange={(e) => updateField("hpiLocation", e.target.value)}
                      placeholder="Where is the symptom?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      value={formData.hpiDuration}
                      onChange={(e) => updateField("hpiDuration", e.target.value)}
                      placeholder="How long does it last?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Character</Label>
                    <Input
                      value={formData.hpiCharacter}
                      onChange={(e) => updateField("hpiCharacter", e.target.value)}
                      placeholder="What does it feel like?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Aggravating Factors</Label>
                    <Input
                      value={formData.hpiAggravating}
                      onChange={(e) => updateField("hpiAggravating", e.target.value)}
                      placeholder="What makes it worse?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Relieving Factors</Label>
                    <Input
                      value={formData.hpiRelieving}
                      onChange={(e) => updateField("hpiRelieving", e.target.value)}
                      placeholder="What makes it better?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timing</Label>
                    <Input
                      value={formData.hpiTiming}
                      onChange={(e) => updateField("hpiTiming", e.target.value)}
                      placeholder="Constant or intermittent?"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Severity (0-10)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[formData.hpiSeverity]}
                        onValueChange={([v]) => updateField("hpiSeverity", v)}
                        max={10}
                        disabled={isReadOnly}
                        className="flex-1"
                      />
                      <span className="font-bold text-lg w-8">{formData.hpiSeverity}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>HPI Narrative</Label>
                  <Textarea
                    value={formData.hpiNarrative}
                    onChange={(e) => updateField("hpiNarrative", e.target.value)}
                    placeholder="Comprehensive narrative of the present illness..."
                    disabled={isReadOnly}
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review of Systems */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Review of Systems (ROS)</CardTitle>
              <CardDescription>Click on body systems to expand and document findings</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {rosSystems.map((system) => (
                  <AccordionItem key={system.key} value={system.key}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span>{system.icon}</span>
                        <span>{system.label}</span>
                        {formData.ros[system.key]?.checked && (
                          <Badge variant="secondary" className="ml-2">Abnormal</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {system.items.map((item) => (
                            <Badge
                              key={item}
                              variant="outline"
                              className={cn(
                                "cursor-pointer",
                                formData.ros[system.key]?.notes?.includes(item) && "bg-blue-100"
                              )}
                              onClick={() => {
                                if (isReadOnly) return;
                                const currentNotes = formData.ros[system.key]?.notes || "";
                                const newNotes = currentNotes.includes(item)
                                  ? currentNotes.replace(item + ", ", "").replace(item, "")
                                  : currentNotes + (currentNotes ? ", " : "") + item;
                                updateField("ros", {
                                  ...formData.ros,
                                  [system.key]: { checked: !!newNotes, notes: newNotes }
                                });
                              }}
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                        <Textarea
                          value={formData.ros[system.key]?.notes || ""}
                          onChange={(e) => updateField("ros", {
                            ...formData.ros,
                            [system.key]: { checked: !!e.target.value, notes: e.target.value }
                          })}
                          placeholder="Additional notes for this system..."
                          disabled={isReadOnly}
                          rows={2}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Medical/Social History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Medical, Surgical & Social History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Past Medical History (PMHx)</Label>
                    {!isReadOnly && (
                      <VoiceInputButton
                        onTranscript={(text) => updateField("pmhUpdate", text)}
                        currentValue={formData.pmhUpdate}
                        context="medical"
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                  <Textarea
                    value={formData.pmhUpdate}
                    onChange={(e) => updateField("pmhUpdate", e.target.value)}
                    placeholder="Chronic conditions, hospitalizations..."
                    disabled={isReadOnly}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Past Surgical History (PSHx)</Label>
                    {!isReadOnly && (
                      <VoiceInputButton
                        onTranscript={(text) => updateField("pshUpdate", text)}
                        currentValue={formData.pshUpdate}
                        context="medical"
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                  <Textarea
                    value={formData.pshUpdate}
                    onChange={(e) => updateField("pshUpdate", e.target.value)}
                    placeholder="Previous surgeries..."
                    disabled={isReadOnly}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Family History (FHx)</Label>
                    {!isReadOnly && (
                      <VoiceInputButton
                        onTranscript={(text) => updateField("familyHistory", text)}
                        currentValue={formData.familyHistory}
                        context="medical"
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                  <Textarea
                    value={formData.familyHistory}
                    onChange={(e) => updateField("familyHistory", e.target.value)}
                    placeholder="Hereditary conditions relevant to presenting complaint..."
                    disabled={isReadOnly}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Social History (SHx)</Label>
                    {!isReadOnly && (
                      <VoiceInputButton
                        onTranscript={(text) => updateField("socialHistory", text)}
                        currentValue={formData.socialHistory}
                        context="medical"
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                  <Textarea
                    value={formData.socialHistory}
                    onChange={(e) => updateField("socialHistory", e.target.value)}
                    placeholder="Smoking, alcohol, drugs, occupation, living situation..."
                    disabled={isReadOnly}
                    rows={3}
                  />
                </div>
              </div>
              
              {/* OB/GYN for female patients */}
              {patientData?.gender?.toLowerCase() === "female" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Baby className="h-4 w-4" />
                      OB/GYN History
                    </Label>
                    {!isReadOnly && (
                      <VoiceInputButton
                        onTranscript={(text) => updateField("obgynHistory", text)}
                        currentValue={formData.obgynHistory}
                        context="medical"
                        size="sm"
                        variant="ghost"
                      />
                    )}
                  </div>
                  <Textarea
                    value={formData.obgynHistory}
                    onChange={(e) => updateField("obgynHistory", e.target.value)}
                    placeholder="Gravidity, parity, LMP, contraceptive use, pap smear history..."
                    disabled={isReadOnly}
                    rows={2}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OBJECTIVE SECTION */}
        <TabsContent value="objective" className="space-y-4 mt-4">
          {/* Vitals Card */}
          {formData.vitalsData ? (
            <VitalsCard vitals={formData.vitalsData} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No vitals recorded for this encounter</p>
                {(isNurse || isDoctor) && (
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Record Vitals
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* General Appearance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">General Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.generalAppearance}
                onChange={(e) => updateField("generalAppearance", e.target.value)}
                placeholder="e.g., Alert, oriented x3, no acute distress, well-nourished, well-developed..."
                disabled={isReadOnly}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Physical Examination */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Physical Examination</CardTitle>
              <CardDescription>Document findings by body system</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {rosSystems.slice(0, 12).map((system) => (
                  <AccordionItem key={`pe-${system.key}`} value={`pe-${system.key}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span>{system.icon}</span>
                        <span>{system.label}</span>
                        {formData.physicalExam[system.key] && (
                          <Badge variant="secondary" className="ml-2">Documented</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={formData.physicalExam[system.key] || ""}
                        onChange={(e) => updateField("physicalExam", {
                          ...formData.physicalExam,
                          [system.key]: e.target.value
                        })}
                        placeholder={`Examination findings for ${system.label.toLowerCase()}...`}
                        disabled={isReadOnly}
                        rows={3}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Diagnostic Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Diagnostic Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.diagnosticResults}
                onChange={(e) => updateField("diagnosticResults", e.target.value)}
                placeholder="Lab results, imaging findings, ECG results... Include status (Pending/Final/Reviewed)"
                disabled={isReadOnly}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Functional Assessment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Functional Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.functionalAssessment}
                onChange={(e) => updateField("functionalAssessment", e.target.value)}
                placeholder="Mobility, ADL status, functional limitations..."
                disabled={isReadOnly}
                rows={2}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSESSMENT SECTION */}
        <TabsContent value="assessment" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Primary Diagnosis</CardTitle>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => { setIcdSearchOpen(true); setSelectingDiagnosisFor("primary"); }}>
                    <Search className="h-4 w-4 mr-1" />
                    Search ICD
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {formData.primaryDiagnosis ? (
                <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="p-2 bg-green-100 rounded">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-green-700">{formData.primaryDiagnosis.code}</div>
                    <div className="text-green-800">{formData.primaryDiagnosis.description}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No primary diagnosis selected
                </div>
              )}
            </CardContent>
          </Card>

          {/* Differential Diagnoses */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Differential Diagnoses</CardTitle>
                {!isReadOnly && formData.differentials.length < 5 && (
                  <Button variant="outline" size="sm" onClick={addDifferential}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Differential
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.differentials.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No differential diagnoses recorded
                </div>
              ) : (
                formData.differentials.map((diff, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      {diff.code ? (
                        <>
                          <div className="font-mono font-medium">{diff.code}</div>
                          <div className="text-sm text-muted-foreground">{diff.description}</div>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setIcdSearchOpen(true); setSelectingDiagnosisFor(index); }}
                        >
                          <Search className="h-4 w-4 mr-1" />
                          Search ICD
                        </Button>
                      )}
                    </div>
                    <Select
                      value={diff.confidence}
                      onValueChange={(v) => {
                        const newDiffs = [...formData.differentials];
                        newDiffs[index] = { ...newDiffs[index], confidence: v as any };
                        updateField("differentials", newDiffs);
                      }}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Likely">Likely</SelectItem>
                        <SelectItem value="Possible">Possible</SelectItem>
                        <SelectItem value="Rule Out">Rule Out</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => updateField("differentials", formData.differentials.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Clinical Reasoning */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Clinical Reasoning</CardTitle>
                {!isReadOnly && onAISuggest && (
                  <Button variant="outline" size="sm" onClick={() => handleAISuggest("clinicalReasoning")}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Draft from S+O
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.clinicalReasoning}
                onChange={(e) => updateField("clinicalReasoning", e.target.value)}
                placeholder="Summarize clinical reasoning and decision-making process..."
                disabled={isReadOnly}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Risk Stratification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Risk Stratification</CardTitle>
              <CardDescription>Confirm or dismiss suggested risk flags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {riskFlagOptions.map((flag) => (
                  <Badge
                    key={flag.id}
                    variant={formData.riskFlags.includes(flag.id) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer",
                      flag.color === "red" && formData.riskFlags.includes(flag.id) && "bg-red-500",
                      flag.color === "orange" && formData.riskFlags.includes(flag.id) && "bg-orange-500",
                      flag.color === "yellow" && formData.riskFlags.includes(flag.id) && "bg-yellow-500"
                    )}
                    onClick={() => {
                      if (isReadOnly) return;
                      const newFlags = formData.riskFlags.includes(flag.id)
                        ? formData.riskFlags.filter(f => f !== flag.id)
                        : [...formData.riskFlags, flag.id];
                      updateField("riskFlags", newFlags);
                    }}
                  >
                    {flag.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Problem List Updates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Problem List Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.problemListUpdates}
                onChange={(e) => updateField("problemListUpdates", e.target.value)}
                placeholder="Updates to patient's problem list..."
                disabled={isReadOnly}
                rows={2}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLAN SECTION */}
        <TabsContent value="plan" className="space-y-4 mt-4">
          {/* Clinical Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Investigations Ordered
                </CardTitle>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={addClinicalOrder}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Order
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.clinicalOrders.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No investigations ordered
                </div>
              ) : (
                formData.clinicalOrders.map((order, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Select
                      value={order.orderType}
                      onValueChange={(v) => {
                        const newOrders = [...formData.clinicalOrders];
                        newOrders[index] = { ...newOrders[index], orderType: v as any };
                        updateField("clinicalOrders", newOrders);
                      }}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lab">Lab</SelectItem>
                        <SelectItem value="imaging">Imaging</SelectItem>
                        <SelectItem value="procedure">Procedure</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={order.orderName}
                        onChange={(e) => {
                          const newOrders = [...formData.clinicalOrders];
                          newOrders[index] = { ...newOrders[index], orderName: e.target.value };
                          updateField("clinicalOrders", newOrders);
                        }}
                        placeholder="Order name..."
                        disabled={isReadOnly}
                      />
                      <Input
                        value={order.details || ""}
                        onChange={(e) => {
                          const newOrders = [...formData.clinicalOrders];
                          newOrders[index] = { ...newOrders[index], details: e.target.value };
                          updateField("clinicalOrders", newOrders);
                        }}
                        placeholder="Additional details..."
                        disabled={isReadOnly}
                      />
                    </div>
                    <Select
                      value={order.urgency}
                      onValueChange={(v) => {
                        const newOrders = [...formData.clinicalOrders];
                        newOrders[index] = { ...newOrders[index], urgency: v as any };
                        updateField("clinicalOrders", newOrders);
                      }}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="stat">STAT</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => updateField("clinicalOrders", formData.clinicalOrders.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Medications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Medications Prescribed
                </CardTitle>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={addMedication}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Medication
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.medications.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No medications prescribed
                </div>
              ) : (
                formData.medications.map((med, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <Input
                          value={med.drugName}
                          onChange={(e) => {
                            const newMeds = [...formData.medications];
                            newMeds[index] = { ...newMeds[index], drugName: e.target.value };
                            updateField("medications", newMeds);
                          }}
                          placeholder="Drug name"
                          disabled={isReadOnly}
                        />
                        <Input
                          value={med.dosage}
                          onChange={(e) => {
                            const newMeds = [...formData.medications];
                            newMeds[index] = { ...newMeds[index], dosage: e.target.value };
                            updateField("medications", newMeds);
                          }}
                          placeholder="Dosage"
                          disabled={isReadOnly}
                        />
                        <Input
                          value={med.frequency}
                          onChange={(e) => {
                            const newMeds = [...formData.medications];
                            newMeds[index] = { ...newMeds[index], frequency: e.target.value };
                            updateField("medications", newMeds);
                          }}
                          placeholder="Frequency"
                          disabled={isReadOnly}
                        />
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          onClick={() => updateField("medications", formData.medications.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={med.instructions || ""}
                      onChange={(e) => {
                        const newMeds = [...formData.medications];
                        newMeds[index] = { ...newMeds[index], instructions: e.target.value };
                        updateField("medications", newMeds);
                      }}
                      placeholder="Special instructions..."
                      disabled={isReadOnly}
                    />
                    {/* Safety Check Indicator */}
                    <div className="flex items-center gap-2 text-sm">
                      {med.safetyChecked ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Safety Checked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pending Safety Check
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Referrals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Input
                    value={formData.referrals[0]?.specialty || ""}
                    onChange={(e) => updateField("referrals", [{ 
                      specialty: e.target.value, 
                      urgency: formData.referrals[0]?.urgency || "routine",
                      reason: formData.referrals[0]?.reason || ""
                    }])}
                    placeholder="e.g., Cardiology"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select
                    value={formData.referrals[0]?.urgency || "routine"}
                    onValueChange={(v) => updateField("referrals", [{ 
                      specialty: formData.referrals[0]?.specialty || "",
                      urgency: v,
                      reason: formData.referrals[0]?.reason || ""
                    }])}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={formData.referrals[0]?.reason || ""}
                    onChange={(e) => updateField("referrals", [{ 
                      specialty: formData.referrals[0]?.specialty || "",
                      urgency: formData.referrals[0]?.urgency || "routine",
                      reason: e.target.value
                    }])}
                    placeholder="Reason for referral"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patient Education */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Patient Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {educationTopics.map((topic) => (
                  <div key={topic.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`edu-${topic.id}`}
                      checked={formData.patientEducation.includes(topic.id)}
                      onCheckedChange={(checked) => {
                        const newEdu = checked
                          ? [...formData.patientEducation, topic.id]
                          : formData.patientEducation.filter(e => e !== topic.id);
                        updateField("patientEducation", newEdu);
                      }}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={`edu-${topic.id}`} className="cursor-pointer text-sm">
                      {topic.label}
                    </Label>
                  </div>
                ))}
              </div>
              <Textarea
                value={formData.patientEducationNotes}
                onChange={(e) => updateField("patientEducationNotes", e.target.value)}
                placeholder="Additional education notes..."
                disabled={isReadOnly}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Follow-up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Follow-up Date</Label>
                  <Input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => updateField("followUpDate", e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select
                    value={formData.followUpMode}
                    onValueChange={(v) => updateField("followUpMode", v)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">In-Person</SelectItem>
                      <SelectItem value="telehealth">Telehealth</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsible Clinician</Label>
                  <Input
                    value={formData.followUpClinician}
                    onChange={(e) => updateField("followUpClinician", e.target.value)}
                    placeholder="Dr. Name"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nursing Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Nursing / Care Team Instructions</CardTitle>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={addNurseTask}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={formData.nursingInstructions}
                onChange={(e) => updateField("nursingInstructions", e.target.value)}
                placeholder="General nursing instructions..."
                disabled={isReadOnly}
                rows={2}
              />
              
              {formData.nurseTasks.length > 0 && (
                <div className="space-y-2">
                  <Label>Assigned Tasks</Label>
                  {formData.nurseTasks.map((task, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={task.taskDescription}
                        onChange={(e) => {
                          const newTasks = [...formData.nurseTasks];
                          newTasks[index] = { ...newTasks[index], taskDescription: e.target.value };
                          updateField("nurseTasks", newTasks);
                        }}
                        placeholder="Task description"
                        disabled={isReadOnly}
                        className="flex-1"
                      />
                      <Select
                        value={task.priority}
                        onValueChange={(v) => {
                          const newTasks = [...formData.nurseTasks];
                          newTasks[index] = { ...newTasks[index], priority: v as any };
                          updateField("nurseTasks", newTasks);
                        }}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="routine">Routine</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="stat">STAT</SelectItem>
                        </SelectContent>
                      </Select>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          onClick={() => updateField("nurseTasks", formData.nurseTasks.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disposition */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Disposition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Disposition</Label>
                  <Select
                    value={formData.disposition}
                    onValueChange={(v) => updateField("disposition", v)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discharge">Discharge</SelectItem>
                      <SelectItem value="admit">Admit</SelectItem>
                      <SelectItem value="observation">Observation</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input
                    value={formData.dispositionDestination}
                    onChange={(e) => updateField("dispositionDestination", e.target.value)}
                    placeholder="e.g., Ward, ICU, Home"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <Textarea
                value={formData.dispositionReason}
                onChange={(e) => updateField("dispositionReason", e.target.value)}
                placeholder="Reason for disposition decision..."
                disabled={isReadOnly}
                rows={2}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {!isReadOnly && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <Info className="h-4 w-4 inline mr-1" />
                {formData.status === "draft" ? "Draft will be auto-saved every 60 seconds" : "This note is locked"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(false)} disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                {canSign && (
                  <Button onClick={() => setShowSignDialog(true)} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                    <Lock className="h-4 w-4 mr-2" />
                    Sign & Lock
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Addendum Button for Signed Notes */}
      {formData.status === "signed" && onAddendum && (
        <Card>
          <CardContent className="pt-4">
            <Button variant="outline" onClick={() => setShowAddendumDialog(true)} className="w-full">
              <Edit3 className="h-4 w-4 mr-2" />
              Add Addendum
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign & Lock SOAP Note</DialogTitle>
            <DialogDescription>
              Once signed, this note will be locked and cannot be modified. Any changes will require an addendum.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <p><strong>Author:</strong> {employeeName}</p>
              <p><strong>Role:</strong> {employeeRole}</p>
              <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">
                This action is permanent and will be recorded in the audit log.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSign} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              <Lock className="h-4 w-4 mr-2" />
              Sign & Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Addendum Dialog */}
      <Dialog open={showAddendumDialog} onOpenChange={setShowAddendumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Addendum</DialogTitle>
            <DialogDescription>
              Add a signed addendum to this SOAP note. The original note will not be modified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Textarea
              value={addendumText}
              onChange={(e) => setAddendumText(e.target.value)}
              placeholder="Enter addendum text..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddendumDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddendum} disabled={isSubmitting}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Addendum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ICD Search Dialog */}
      <Dialog open={icdSearchOpen} onOpenChange={setIcdSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search ICD Codes</DialogTitle>
            <DialogDescription>
              Search for diagnosis codes by code or description
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={icdSearchTerm}
                onChange={(e) => setIcdSearchTerm(e.target.value)}
                placeholder="Search ICD-10 codes..."
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {icdSearchResults.map((code) => (
                  <div
                    key={code.code}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                    onClick={() => selectICDCode(code)}
                  >
                    <div>
                      <span className="font-mono font-medium">{code.code}</span>
                      <span className="ml-2 text-muted-foreground">{code.description}</span>
                    </div>
                    <Badge variant="outline">{code.category}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SOAPNoteTemplate;
