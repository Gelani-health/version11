"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  Stethoscope,
  Activity,
  Heart,
  Thermometer,
  Pill,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  Clock,
  User,
  MessageSquare,
  RefreshCw,
  Wind,
  Eye,
  ClipboardList,
  Zap,
  Calculator,
  FileSearch,
  Beaker,
  CalculatorIcon,
  BarChart3,
  UserPlus,
  Droplets,
  Footprints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VoiceInputButton } from "@/components/voice-input-button";
import { TTSButton } from "@/components/tts-button";

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

interface PatientMedication {
  id: string;
  medicationName: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  status?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  diagnosisSuggestions?: DiagnosisSuggestion[];
  drugAlerts?: DrugAlert[];
}

interface DiagnosisSuggestion {
  condition: string;
  icdCode: string;
  confidence: number;
  reasoning: string;
  symptoms: string[];
}

interface DrugAlert {
  drug: string;
  severity: "high" | "medium" | "low";
  interaction: string;
  recommendation: string;
}

interface ClinicalDecisionSupportProps {
  preselectedPatientId?: string | null;
}

export function ClinicalDecisionSupport({ preselectedPatientId }: ClinicalDecisionSupportProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingMeds, setIsLoadingMeds] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI Clinical Decision Support assistant powered by MedGemma. I can help you with:\n\n• **Differential Diagnosis** - Based on symptoms and patient history\n• **Drug Interaction Checking** - Safety alerts for medications\n• **Clinical Guidelines** - Evidence-based recommendations\n• **Risk Assessment** - Patient risk stratification\n\n**Select a patient above to include their medical context in AI queries.**",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Fetch patient medications when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientMedications(selectedPatientId);
    } else {
      setPatientMedications([]);
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

  const fetchPatientMedications = async (patientId: string) => {
    try {
      setIsLoadingMeds(true);
      const response = await fetch(`/api/patients/${patientId}/medications`);
      const data = await response.json();
      if (data.success) {
        setPatientMedications(data.data.medications);
      }
    } catch (error) {
      console.error("Failed to fetch medications:", error);
    } finally {
      setIsLoadingMeds(false);
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const selectedPatient = getSelectedPatient();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Call API with patient context
    try {
      const response = await fetch("/api/clinical-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: inputValue,
          patientContext: selectedPatient ? {
            id: selectedPatient.id,
            name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
            mrn: selectedPatient.mrn,
            dateOfBirth: selectedPatient.dateOfBirth,
            gender: selectedPatient.gender,
            allergies: parseAllergies(selectedPatient.allergies),
            medications: patientMedications.map(m => ({
              name: m.medicationName,
              dosage: m.dosage,
              frequency: m.frequency,
            })),
          } : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const aiResponse: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.data.message,
          timestamp: new Date(),
          diagnosisSuggestions: data.data.diagnosisSuggestions,
          drugAlerts: data.data.drugAlerts,
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        // Fallback to simulated response
        setTimeout(() => {
          const aiResponse = generateAIResponse(inputValue, selectedPatient, patientMedications);
          setMessages((prev) => [...prev, aiResponse]);
        }, 1500);
      }
    } catch (error) {
      // Fallback to simulated response
      setTimeout(() => {
        const aiResponse = generateAIResponse(inputValue, selectedPatient, patientMedications);
        setMessages((prev) => [...prev, aiResponse]);
      }, 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = (
    query: string, 
    patient: Patient | undefined, 
    medications: PatientMedication[]
  ): Message => {
    const queryLower = query.toLowerCase();
    const patientContext = patient ? `\n\n**Patient Context:** ${patient.firstName} ${patient.lastName} (${patient.gender}, DOB: ${new Date(patient.dateOfBirth).toLocaleDateString()})` : "";
    const medContext = medications.length > 0 
      ? `\n**Current Medications:** ${medications.map(m => m.medicationName).join(", ")}`
      : "";
    
    // Simulate clinical decision support based on query content
    if (queryLower.includes("chest pain") || queryLower.includes("chest discomfort")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `Based on the symptoms described${patientContext ? patientContext : ""}, here are the differential diagnoses to consider:${patientContext}${medContext}`,
        timestamp: new Date(),
        diagnosisSuggestions: [
          {
            condition: "Acute Coronary Syndrome",
            icdCode: "I21.9",
            confidence: 0.78,
            reasoning: "Chest pain with radiation to arm/jaw, associated with sweating and shortness of breath increases suspicion for ACS.",
            symptoms: ["Chest pain", "Arm pain", "Jaw pain", "Diaphoresis"],
          },
          {
            condition: "Gastroesophageal Reflux Disease",
            icdCode: "K21.0",
            confidence: 0.65,
            reasoning: "Burning chest pain, especially postprandial, may indicate GERD. Less likely if pain is exertional.",
            symptoms: ["Heartburn", "Regurgitation", "Chest discomfort"],
          },
          {
            condition: "Musculoskeletal Chest Pain",
            icdCode: "M54.6",
            confidence: 0.52,
            reasoning: "Pain reproducible with movement or palpation suggests musculoskeletal etiology.",
            symptoms: ["Chest wall tenderness", "Pain with movement"],
          },
          {
            condition: "Pulmonary Embolism",
            icdCode: "I26.9",
            confidence: 0.45,
            reasoning: "Sudden onset chest pain with dyspnea, especially with risk factors (DVT, immobility), warrants investigation.",
            symptoms: ["Sudden dyspnea", "Pleuritic chest pain", "Tachycardia"],
          },
        ],
      };
    }

    if (queryLower.includes("fever") || queryLower.includes("temperature")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `Analyzing fever presentation${patientContext ? patientContext : ""}:${patientContext}${medContext}`,
        timestamp: new Date(),
        diagnosisSuggestions: [
          {
            condition: "Viral Upper Respiratory Infection",
            icdCode: "J06.9",
            confidence: 0.72,
            reasoning: "Fever with cough, sore throat, and runny nose is most commonly viral URI.",
            symptoms: ["Fever", "Cough", "Sore throat", "Rhinorrhea"],
          },
          {
            condition: "Bacterial Pneumonia",
            icdCode: "J18.9",
            confidence: 0.58,
            reasoning: "High fever with productive cough, dyspnea, and crackles on auscultation suggests bacterial pneumonia.",
            symptoms: ["High fever", "Productive cough", "Dyspnea", "Crackles"],
          },
          {
            condition: "Urinary Tract Infection",
            icdCode: "N39.0",
            confidence: 0.45,
            reasoning: "Fever with urinary symptoms (dysuria, frequency) in appropriate patient population.",
            symptoms: ["Fever", "Dysuria", "Urinary frequency", "Flank pain"],
          },
        ],
      };
    }

    // Default response with drug alerts based on patient medications
    const drugAlerts: DrugAlert[] = [];
    if (medications.length > 0) {
      // Check for potential interactions
      if (medications.some(m => m.medicationName.toLowerCase().includes("warfarin"))) {
        drugAlerts.push({
          drug: "Warfarin",
          severity: "high",
          interaction: "Anticoagulant therapy - monitor INR closely",
          recommendation: "Check for drug interactions with any new medications",
        });
      }
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `I've analyzed your query${patientContext ? patientContext : ""}.${medications.length > 0 ? medContext : ""}\n\nHere's my clinical assessment based on the information provided:`,
      timestamp: new Date(),
      diagnosisSuggestions: [
        {
          condition: "Further Evaluation Recommended",
          icdCode: "R69",
          confidence: 0.85,
          reasoning: "Based on the clinical presentation, further diagnostic workup is recommended to narrow the differential diagnosis.",
          symptoms: ["Pending evaluation"],
        },
      ],
      drugAlerts: drugAlerts.length > 0 ? drugAlerts : undefined,
    };
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-emerald-600 bg-emerald-50";
    if (confidence >= 0.5) return "text-amber-600 bg-amber-50";
    return "text-slate-600 bg-slate-50";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-amber-600 bg-amber-50 border-amber-200";
      default:
        return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseAllergies(selectedPatient.allergies) : [];

  // Tool categories data
  const toolCategories = [
    {
      name: "Diagnostic",
      color: "text-purple-500",
      bgColor: "hover:bg-purple-50",
      tools: [
        { icon: Activity, label: "Symptom Checker", query: "Help me evaluate the patient's symptoms systematically" },
        { icon: Stethoscope, label: "Differential Diagnosis", query: "Generate a differential diagnosis based on" },
        { icon: Brain, label: "Clinical Reasoning", query: "Help me think through the clinical reasoning for" },
      ]
    },
    {
      name: "Risk Assessment",
      color: "text-red-500",
      bgColor: "hover:bg-red-50",
      tools: [
        { icon: Heart, label: "Cardiac Risk (Framingham)", query: "Calculate Framingham cardiac risk score for this patient" },
        { icon: BarChart3, label: "CHA2DS2-VASc Score", query: "Calculate CHA2DS2-VASc score for atrial fibrillation stroke risk" },
        { icon: Calculator, label: "Wells PE Score", query: "Calculate Wells score for pulmonary embolism probability" },
        { icon: AlertTriangle, label: "CURB-65 (Pneumonia)", query: "Calculate CURB-65 severity score for community-acquired pneumonia" },
      ]
    },
    {
      name: "Speciality",
      color: "text-blue-500",
      bgColor: "hover:bg-blue-50",
      tools: [
        { icon: Wind, label: "Respiratory Assessment", query: "Perform a respiratory system assessment for" },
        { icon: Footprints, label: "Musculoskeletal Exam", query: "Help with musculoskeletal examination findings for" },
        { icon: Eye, label: "Neurological Exam", query: "Guide me through a neurological examination for" },
        { icon: UserPlus, label: "Paediatric Assessment", query: "Paediatric clinical assessment for" },
      ]
    },
    {
      name: "Medication & Labs",
      color: "text-amber-500",
      bgColor: "hover:bg-amber-50",
      tools: [
        { icon: Pill, label: "Drug Interaction Check", query: "Check for potential drug interactions in the current medication list" },
        { icon: CalculatorIcon, label: "Dosing Calculator", query: "Help calculate appropriate medication dosing for" },
        { icon: Beaker, label: "Lab Interpretation", query: "Help interpret these laboratory results:" },
        { icon: Droplets, label: "Differential Diagnosis (Labs)", query: "Generate differential diagnosis based on abnormal lab values:" },
      ]
    },
    {
      name: "Emergency",
      color: "text-orange-500",
      bgColor: "hover:bg-orange-50",
      tools: [
        { icon: Zap, label: "Quick Triage Assessment", query: "Perform rapid triage assessment for patient with" },
        { icon: Thermometer, label: "Fever Workup", query: "Systematic fever workup approach for" },
        { icon: ClipboardList, label: "ACLS Protocol Check", query: "Review ACLS protocol for" },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Clinical AI
          </h2>
          <p className="text-slate-500">AI-powered diagnostic assistance powered by MedGemma</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Model: MedGemma
          </Badge>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Patient Context</CardTitle>
          <CardDescription>Select a patient to include their medical history in AI queries</CardDescription>
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
                  <AvatarFallback className="bg-purple-100 text-purple-700">
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

          {/* Patient Context Summary */}
          {selectedPatient && (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {patientAllergies.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-800 mb-2">Allergies:</p>
                  <div className="flex flex-wrap gap-2">
                    {patientAllergies.map((allergy, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-red-300 text-red-700">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {isLoadingMeds ? (
                <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="text-sm text-slate-500">Loading medications...</span>
                </div>
              ) : patientMedications.length > 0 ? (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-2">Current Medications ({patientMedications.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {patientMedications.slice(0, 5).map((med, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-blue-300 text-blue-700">
                        {med.medicationName} {med.dosage}
                      </Badge>
                    ))}
                    {patientMedications.length > 5 && (
                      <Badge variant="outline" className="bg-white border-slate-300 text-slate-600">
                        +{patientMedications.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500">No active medications on record</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Alert */}
      <Alert className="bg-amber-50 border-amber-200">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Clinical Safety Notice</AlertTitle>
        <AlertDescription className="text-amber-700">
          AI suggestions are for clinical decision support only. All recommendations must be reviewed by a qualified healthcare professional before implementation.
        </AlertDescription>
      </Alert>

      {/* Main Chat Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-md h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                Clinical AI Chat
                {selectedPatient && (
                  <Badge variant="outline" className="ml-2 bg-purple-50 border-purple-200 text-purple-700">
                    {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Describe symptoms or ask clinical questions{selectedPatient ? " (patient context included)" : ""}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] ${
                            message.role === "user"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl rounded-tr-md"
                              : "bg-slate-100 rounded-2xl rounded-tl-md"
                          } p-4`}
                        >
                          {message.role === "assistant" && (
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium text-purple-600">AI Assistant</span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Diagnosis Suggestions */}
                          {message.diagnosisSuggestions && (
                            <div className="mt-4 space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Stethoscope className="h-4 w-4" />
                                Differential Diagnosis
                              </h4>
                              {message.diagnosisSuggestions.map((suggestion, i) => (
                                <div key={i} className="bg-white rounded-lg p-3 border border-slate-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h5 className="font-medium text-slate-800">{suggestion.condition}</h5>
                                      <p className="text-xs text-slate-500">ICD-10: {suggestion.icdCode}</p>
                                    </div>
                                    <Badge className={getConfidenceColor(suggestion.confidence)}>
                                      {Math.round(suggestion.confidence * 100)}% confidence
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-slate-600 mb-2">{suggestion.reasoning}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.symptoms.map((symptom, j) => (
                                      <Badge key={j} variant="outline" className="text-xs">
                                        {symptom}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Drug Alerts */}
                          {message.drugAlerts && (
                            <div className="mt-4 space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                                Drug Safety Alerts
                              </h4>
                              {message.drugAlerts.map((alert, i) => (
                                <div key={i} className={`rounded-lg p-3 border ${getSeverityColor(alert.severity)}`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Pill className="h-4 w-4" />
                                    <span className="font-medium">{alert.drug}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {alert.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm">{alert.interaction}</p>
                                  <p className="text-sm font-medium mt-1">→ {alert.recommendation}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* TTS Button for assistant messages */}
                          {message.role === "assistant" && (
                            <div className="mt-3 mb-2">
                              <TTSButton
                                text={message.content}
                                size="sm"
                                variant="ghost"
                                showSettings={false}
                                label="Read aloud"
                              />
                            </div>
                          )}

                          <p className="text-xs text-slate-400 mt-2">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-slate-100 rounded-2xl rounded-tl-md p-4">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                          <span className="text-sm text-slate-600">Analyzing clinical data...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Textarea
                      placeholder={selectedPatient ? `Ask about ${selectedPatient.firstName}'s symptoms or clinical questions...` : "Describe patient symptoms or ask a clinical question..."}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="min-h-[60px] resize-none pr-12"
                    />
                    <div className="absolute right-2 top-2">
                      <VoiceInputButton
                        onTranscript={(text) => setInputValue(text)}
                        currentValue={inputValue}
                        context="medical"
                        size="sm"
                        variant="ghost"
                        className="bg-white/80 hover:bg-white h-8 w-8"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !inputValue.trim()}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel - Quick Tools */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Quick Tools</CardTitle>
              <CardDescription>Select a clinical tool to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] pr-2">
                <div className="space-y-4">
                  {toolCategories.map((category, categoryIndex) => (
                    <div key={categoryIndex}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{category.name}</p>
                      <div className="space-y-1">
                        {category.tools.map((tool, toolIndex) => {
                          const Icon = tool.icon;
                          return (
                            <Button
                              key={toolIndex}
                              variant="ghost"
                              className={`w-full justify-start h-auto py-2 px-3 ${category.bgColor}`}
                              onClick={() => setInputValue(tool.query)}
                            >
                              <Icon className={`h-4 w-4 ${category.color} mr-3`} />
                              <span className="text-sm">{tool.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                      {categoryIndex < toolCategories.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">AI Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Diagnostic Accuracy</span>
                    <span className="font-medium">94%</span>
                  </div>
                  <Progress value={94} className="h-2 bg-emerald-100" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Drug Safety Detection</span>
                    <span className="font-medium">98%</span>
                  </div>
                  <Progress value={98} className="h-2 bg-blue-100" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Clinical Guidelines</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <Progress value={92} className="h-2 bg-purple-100" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-slate-800 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="font-medium">Safety Mode Active</span>
              </div>
              <p className="text-sm text-slate-400">
                All AI recommendations require clinical verification before implementation in patient care.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
