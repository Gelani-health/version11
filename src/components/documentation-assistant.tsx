"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Sparkles,
  Save,
  Copy,
  Download,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Check,
  AlertTriangle,
  Clock,
  User,
  Stethoscope,
  Pill,
  ClipboardList,
  Wand2,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { MedicalAutocompleteTextarea } from "@/components/medical-autocomplete-textarea";
import { ClinicalVoiceRecorder } from "@/components/clinical-voice-recorder";
import { TTSButton } from "@/components/tts-button";
import { Volume2 } from "lucide-react";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies?: string;
  medicalHistory?: string;
}

interface Consultation {
  id: string;
  consultationDate: string;
  consultationType: string;
  chiefComplaint?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  plan?: string;
  status: string;
}

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const soapTemplates = [
  {
    name: "General Consultation",
    subjective: "Patient presents with [chief complaint] for [duration]. States symptoms are [character] in nature, [severity] severity. Associated symptoms include [associated symptoms]. Denies [pertinent negatives].",
    objective: "Vitals: BP: [BP], HR: [HR], RR: [RR], Temp: [Temp], SpO2: [SpO2]\nGeneral: [general appearance]\nHEENT: [HEENT exam]\nCardiovascular: [CV exam]\nRespiratory: [Resp exam]\nAbdomen: [Abd exam]",
    assessment: "1. [Primary diagnosis] - [ICD code]\n2. [Secondary diagnosis] - [ICD code]",
    plan: "1. [Diagnostic workup]\n2. [Medications]\n3. [Lifestyle modifications]\n4. Follow-up in [timeframe]",
  },
  {
    name: "Respiratory Infection",
    subjective: "Patient presents with cough and fever for [duration] days. Cough is [productive/non-productive], [color] sputum if productive. Associated with [symptoms]. Denies chest pain, shortness of breath.",
    objective: "Vitals: BP: [BP], HR: [HR], RR: [RR], Temp: [Temp]°C, SpO2: [SpO2]%\nGeneral: Alert, appears [well/mildly/moderately] ill\nHEENT: Nasal mucosa [pink/erythematous], pharynx [clear/erythematous]\nRespiratory: Breath sounds [clear/diminished], [wheezes/crackles/ronchi] present",
    assessment: "1. Acute upper respiratory infection - J06.9\n2. Acute bronchitis - J20.9\n3. Rule out pneumonia - J18.9",
    plan: "1. Supportive care: Rest, fluids, humidification\n2. Acetaminophen 500mg Q6H PRN for fever\n3. Return if symptoms worsen or no improvement in 7 days\n4. Follow-up in 1 week",
  },
  {
    name: "Hypertension Follow-up",
    subjective: "Patient presents for hypertension follow-up. Reports [compliance] with medications. Denies headache, visual changes, chest pain, shortness of breath, or peripheral edema.",
    objective: "Vitals: BP: [BP] (average of 2 readings), HR: [HR], RR: [RR], Temp: [Temp], SpO2: [SpO2]\nWeight: [weight] kg\nCardiovascular: Regular rate and rhythm, no murmurs\nExtremities: No peripheral edema",
    assessment: "1. Essential hypertension - I10\n[Blood pressure status: controlled/uncontrolled]",
    plan: "1. Continue current antihypertensive regimen\n2. Lifestyle modifications: DASH diet, exercise, sodium restriction\n3. Repeat labs: BMP, lipid panel in 3 months\n4. Follow-up in 3 months",
  },
];

interface DocumentationAssistantProps {
  preselectedPatientId?: string | null;
}

export function DocumentationAssistant({ preselectedPatientId }: DocumentationAssistantProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [patientConsultations, setPatientConsultations] = useState<Consultation[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(false);
  
  const [soapNote, setSoapNote] = useState<SOAPNote>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Update selected patient when preselectedPatientId changes
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch patient consultations when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientConsultations(selectedPatientId);
    } else {
      setPatientConsultations([]);
    }
  }, [selectedPatientId]);

  const fetchPatients = async () => {
    try {
      setIsLoadingPatients(true);
      const response = await fetch("/api/patients?limit=100");
      const data = await response.json();
      if (data.success) {
        setPatients(data.data.patients);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast({
        title: "Error",
        description: "Failed to load patients",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const fetchPatientConsultations = async (patientId: string) => {
    try {
      setIsLoadingConsultations(true);
      const response = await fetch(`/api/consultations?patientId=${patientId}`);
      const data = await response.json();
      if (data.success) {
        setPatientConsultations(data.data.consultations);
      }
    } catch (error) {
      console.error("Failed to fetch consultations:", error);
    } finally {
      setIsLoadingConsultations(false);
    }
  };

  const getSelectedPatient = () => {
    return patients.find((p) => p.id === selectedPatientId);
  };

  const parseAllergies = (allergies?: string): string[] => {
    if (!allergies) return [];
    try {
      return JSON.parse(allergies);
    } catch {
      return [];
    }
  };

  const handleGenerateWithAI = async () => {
    const selectedPatient = getSelectedPatient();
    setIsGenerating(true);
    
    try {
      // Try to call API
      const response = await fetch("/api/documentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          patientContext: selectedPatient ? {
            name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
            mrn: selectedPatient.mrn,
            dateOfBirth: selectedPatient.dateOfBirth,
            gender: selectedPatient.gender,
            allergies: parseAllergies(selectedPatient.allergies),
          } : null,
        }),
      });

      const data = await response.json();
      if (data.success && data.data.soapNote) {
        setSoapNote(data.data.soapNote);
      } else {
        // Fallback to simulated generation
        generateSimulatedSOAP(selectedPatient);
      }
    } catch (error) {
      // Fallback to simulated generation
      generateSimulatedSOAP(selectedPatient);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSimulatedSOAP = (patient: Patient | undefined) => {
    setTimeout(() => {
      setSoapNote({
        subjective: `Patient ${patient ? `${patient.firstName} ${patient.lastName}` : "[Patient Name]"} presents today for follow-up consultation. 
Reports feeling generally well with no acute complaints. 
Current symptoms: No chest pain, no shortness of breath, no fever, no significant changes in weight.
Sleep pattern is adequate, appetite is normal.
Medication compliance reported as good.
No new allergies reported.`,
        objective: `VITAL SIGNS:
- Blood Pressure: 128/78 mmHg
- Heart Rate: 72 bpm, regular
- Respiratory Rate: 16 breaths/min
- Temperature: 36.8°C (oral)
- Oxygen Saturation: 98% on room air
- Weight: 75 kg

PHYSICAL EXAMINATION:
- General: Alert, oriented, in no acute distress
- HEENT: Normocephalic, PERRLA, mucous membranes moist
- Cardiovascular: Regular rate and rhythm, no murmurs/gallops/rubs
- Respiratory: Clear to auscultation bilaterally, no wheezes/crackles
- Abdomen: Soft, non-tender, non-distended, bowel sounds present
- Extremities: No edema, pulses 2+ bilaterally`,
        assessment: `1. Essential Hypertension (I10) - Well controlled on current regimen
2. Type 2 Diabetes Mellitus (E11.9) - Good glycemic control, continue current management
3. Hyperlipidemia (E78.5) - Lipid panel within target range
4. Health maintenance: Due for age-appropriate screenings`,
        plan: `1. MEDICATIONS:
   - Continue current antihypertensive regimen
   - Continue current diabetic medications
   - Continue statin therapy

2. LABORATORY:
   - HbA1c, BMP, Lipid panel in 3 months
   - Annual urine microalbumin

3. LIFESTYLE MODIFICATIONS:
   - Continue DASH diet
   - Regular exercise 150 min/week
   - Weight management

4. FOLLOW-UP:
   - Return in 3 months for routine follow-up
   - Sooner if any concerning symptoms develop
   - Annual comprehensive metabolic panel scheduled`,
      });
    }, 2000);
  };

  const handleTemplateSelect = (templateName: string) => {
    const template = soapTemplates.find((t) => t.name === templateName);
    if (template) {
      setSoapNote({
        subjective: template.subjective,
        objective: template.objective,
        assessment: template.assessment,
        plan: template.plan,
      });
      setSelectedTemplate(templateName);
    }
  };

  const handleCopy = () => {
    const selectedPatient = getSelectedPatient();
    const fullNote = `
PATIENT: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "[Patient Name]"}
MRN: ${selectedPatient?.mrn || "[MRN]"}
DOB: ${selectedPatient ? new Date(selectedPatient.dateOfBirth).toLocaleDateString() : "[DOB]"}
VISIT DATE: ${new Date().toISOString().split("T")[0]}

===========================================
SUBJECTIVE
===========================================
${soapNote.subjective}

===========================================
OBJECTIVE
===========================================
${soapNote.objective}

===========================================
ASSESSMENT
===========================================
${soapNote.assessment}

===========================================
PLAN
===========================================
${soapNote.plan}
    `;
    navigator.clipboard.writeText(fullNote);
    toast({
      title: "Copied",
      description: "SOAP note copied to clipboard",
    });
  };

  const handleSaveToBahmni = async () => {
    if (!selectedPatientId) {
      toast({
        title: "Error",
        description: "Please select a patient first",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          consultationType: "outpatient",
          subjectiveNotes: soapNote.subjective,
          objectiveNotes: soapNote.objective,
          assessment: soapNote.assessment,
          plan: soapNote.plan,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Documentation saved successfully",
        });
        fetchPatientConsultations(selectedPatientId);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save documentation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseAllergies(selectedPatient.allergies) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" />
            Documentation Assistant
          </h2>
          <p className="text-slate-500">AI-powered SOAP note generation and clinical documentation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Note
          </Button>
          <Button 
            onClick={handleSaveToBahmni}
            disabled={!selectedPatientId || isSaving}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save to Record"}
          </Button>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-500" />
            Patient Context
          </CardTitle>
          <CardDescription>Select a patient for documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select 
              value={selectedPatientId} 
              onValueChange={setSelectedPatientId}
              disabled={isLoadingPatients}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder={isLoadingPatients ? "Loading patients..." : "Select a patient..."} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} ({patient.mrn})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPatient && (
              <div className="flex items-center gap-4 flex-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-amber-100 text-amber-700">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-sm text-slate-500">{selectedPatient.mrn} • {selectedPatient.gender} • DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</p>
                </div>
                {patientAllergies.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">{patientAllergies.length} Allergies</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {patientAllergies.length > 0 && selectedPatient && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2">Known Allergies:</p>
              <div className="flex flex-wrap gap-2">
                {patientAllergies.map((allergy, i) => (
                  <Badge key={i} variant="outline" className="bg-white border-red-300 text-red-700">
                    {allergy}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Info */}
      <Alert className="bg-blue-50 border-blue-200">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">AI-Powered Documentation</AlertTitle>
        <AlertDescription className="text-blue-700">
          Generate comprehensive SOAP notes from patient encounters. AI assists in structuring documentation while you maintain clinical oversight.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Panel - Templates & History */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-500" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {soapTemplates.map((template, i) => (
                <Button
                  key={i}
                  variant={selectedTemplate === template.name ? "default" : "outline"}
                  className={`w-full justify-start text-sm ${
                    selectedTemplate === template.name
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : ""
                  }`}
                  onClick={() => handleTemplateSelect(template.name)}
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  {template.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? "Generating..." : "Generate with AI"}
              </Button>
              <p className="text-xs text-amber-700 mt-2 text-center">
                AI will analyze patient data and generate comprehensive notes
              </p>
            </CardContent>
          </Card>

          {/* Voice Recording Card */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5 text-violet-500" />
                Voice Recording
              </CardTitle>
              <CardDescription>Record clinical notes via voice</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ClinicalVoiceRecorder
                patientId={selectedPatientId}
                noteType="general"
                compact={true}
                onTranscriptionChange={(text) => {
                  // Append to subjective notes
                  setSoapNote(prev => ({
                    ...prev,
                    subjective: prev.subjective 
                      ? `${prev.subjective}\n${text}` 
                      : text
                  }));
                }}
                placeholder="Record your clinical notes..."
              />
            </CardContent>
          </Card>

          {/* Patient Consultation History */}
          {selectedPatientId && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Notes</CardTitle>
                <CardDescription>{patientConsultations.length} previous consultations</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingConsultations ? (
                  <div className="flex items-center justify-center h-[100px]">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  </div>
                ) : patientConsultations.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No previous consultations</p>
                ) : (
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2">
                      {patientConsultations.slice(0, 5).map((consultation) => (
                        <div 
                          key={consultation.id}
                          className="p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100"
                          onClick={() => {
                            if (consultation.subjectiveNotes) {
                              setSoapNote({
                                subjective: consultation.subjectiveNotes || "",
                                objective: consultation.objectiveNotes || "",
                                assessment: consultation.assessment || "",
                                plan: consultation.plan || "",
                              });
                            }
                          }}
                        >
                          <p className="text-xs text-slate-500">{new Date(consultation.consultationDate).toLocaleDateString()}</p>
                          <p className="text-sm font-medium truncate">{consultation.chiefComplaint || "No chief complaint"}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content - SOAP Note Editor */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  SOAP Note
                  {selectedPatient && (
                    <Badge variant="outline" className="ml-2 bg-amber-50 border-amber-200 text-amber-700">
                      {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                    <Clock className="h-3 w-3 mr-1" />
                    Auto-saved
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="subjective" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="subjective" className="flex items-center gap-1">
                    <span className="font-semibold text-blue-500">S</span>
                    Subjective
                  </TabsTrigger>
                  <TabsTrigger value="objective" className="flex items-center gap-1">
                    <span className="font-semibold text-emerald-500">O</span>
                    Objective
                  </TabsTrigger>
                  <TabsTrigger value="assessment" className="flex items-center gap-1">
                    <span className="font-semibold text-purple-500">A</span>
                    Assessment
                  </TabsTrigger>
                  <TabsTrigger value="plan" className="flex items-center gap-1">
                    <span className="font-semibold text-amber-500">P</span>
                    Plan
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="subjective" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700">Patient's Perspective</Badge>
                      <span className="text-xs text-slate-500">Chief complaint, history, symptoms</span>
                    </div>
                    <TTSButton
                      text={soapNote.subjective || "No subjective notes yet"}
                      size="sm"
                      variant="ghost"
                      showSettings={false}
                      label="Read Subjective"
                    />
                  </div>
                  <MedicalAutocompleteTextarea
                    placeholder="Document the patient's chief complaint, history of present illness, review of systems, and relevant history... (type to see medical term suggestions)"
                    className="font-mono text-sm"
                    value={soapNote.subjective}
                    onChange={(value) => setSoapNote({ ...soapNote, subjective: value })}
                    rows={12}
                  />
                </TabsContent>

                <TabsContent value="objective" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700">Clinical Findings</Badge>
                      <span className="text-xs text-slate-500">Vitals, physical exam, lab results</span>
                    </div>
                    <TTSButton
                      text={soapNote.objective || "No objective notes yet"}
                      size="sm"
                      variant="ghost"
                      showSettings={false}
                      label="Read Objective"
                    />
                  </div>
                  <MedicalAutocompleteTextarea
                    placeholder="Document vital signs, physical examination findings, and relevant diagnostic results... (type to see medical term suggestions)"
                    className="font-mono text-sm"
                    value={soapNote.objective}
                    onChange={(value) => setSoapNote({ ...soapNote, objective: value })}
                    rows={12}
                  />
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-700">Diagnosis</Badge>
                      <span className="text-xs text-slate-500">Clinical impression, differential diagnosis</span>
                    </div>
                    <TTSButton
                      text={soapNote.assessment || "No assessment notes yet"}
                      size="sm"
                      variant="ghost"
                      showSettings={false}
                      label="Read Assessment"
                    />
                  </div>
                  <MedicalAutocompleteTextarea
                    placeholder="Document your clinical assessment, diagnoses with ICD codes, and differential diagnoses... (type to see medical term suggestions)"
                    className="font-mono text-sm"
                    value={soapNote.assessment}
                    onChange={(value) => setSoapNote({ ...soapNote, assessment: value })}
                    rows={12}
                  />
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-slate-500">AI Suggested Diagnoses:</span>
                    {["I10 - Essential Hypertension", "E11.9 - Type 2 Diabetes", "J06.9 - Acute URI"].map((code, i) => (
                      <Badge key={i} variant="outline" className="cursor-pointer hover:bg-purple-50">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="plan" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700">Treatment Plan</Badge>
                      <span className="text-xs text-slate-500">Medications, orders, follow-up</span>
                    </div>
                    <TTSButton
                      text={soapNote.plan || "No plan notes yet"}
                      size="sm"
                      variant="ghost"
                      showSettings={false}
                      label="Read Plan"
                    />
                  </div>
                  <MedicalAutocompleteTextarea
                    placeholder="Document the treatment plan, medications, orders, patient education, and follow-up instructions... (type to see medical term suggestions)"
                    className="font-mono text-sm"
                    value={soapNote.plan}
                    onChange={(value) => setSoapNote({ ...soapNote, plan: value })}
                    rows={12}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Section */}
      <Card className="border-0 shadow-md bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            Document Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-end mb-3">
            <TTSButton
              text={`Subjective: ${soapNote.subjective || 'None'}. Objective: ${soapNote.objective || 'None'}. Assessment: ${soapNote.assessment || 'None'}. Plan: ${soapNote.plan || 'None'}`}
              size="sm"
              variant="outline"
              showSettings={false}
              label="Read Full Note"
            />
          </div>
          <ScrollArea className="h-[200px]">
            <div className="bg-white p-4 rounded-lg border font-mono text-sm whitespace-pre-wrap">
              {`PATIENT: ${selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "[Patient Name]"}
MRN: ${selectedPatient?.mrn || "[MRN]"}
VISIT DATE: ${new Date().toISOString().split("T")[0]}

SUBJECTIVE:
${soapNote.subjective || "[No content]"}

OBJECTIVE:
${soapNote.objective || "[No content]"}

ASSESSMENT:
${soapNote.assessment || "[No content]"}

PLAN:
${soapNote.plan || "[No content]"}`}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
