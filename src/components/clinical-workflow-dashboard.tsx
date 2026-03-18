"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  FileText,
  Brain,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Activity,
  Send,
  Sparkles,
  TestTube,
  Mic,
  X,
  Lock,
  Save,
  Eye,
  History,
  Heart,
  UserCog,
  Shield,
  AlertTriangle,
  SkipForward,
  ClipboardList,
  Download,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// Import the EXISTING comprehensive SOAP template
import { SOAPNoteTemplate, type SOAPNoteData } from "@/components/soap-note-template";
import { VitalsHistoryLog } from "@/components/vitals-history-log";
import { ConsultationSessionLog } from "@/components/consultation-session-log";
import { StaffIdentityCard } from "@/components/staff-identity-card";
import { NurseVitalsCard } from "@/components/nurse-vitals-card";
import { PatientContextBanner } from "@/components/patient-context-banner";

// ============================================
// TYPES
// ============================================

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone?: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
}

interface VitalsData {
  id: string;
  temperature?: number;
  temperatureUnit?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  painScore?: number;
  recordedAt: string;
  recordedByName?: string;
  recordedByRole?: string;
  bpStatus?: string;
  hrStatus?: string;
  spo2Status?: string;
}

interface Consultation {
  id: string;
  patientId: string;
  consultationDate: string;
  consultationType: string;
  chiefComplaint?: string;
  status: string;
  aiSummaryGenerated: boolean;
  providerName?: string;
  patient?: Patient;
  vitals?: VitalsData[];
  soapNote?: {
    id: string;
    status: string;
    signedAt?: string;
    signedBy?: string;
  };
}

interface ActionLog {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  details?: string;
}

interface ClinicalWorkflowDashboardProps {
  preselectedPatientId?: string | null;
  currentStaffId?: string;
  currentStaffName?: string;
  currentStaffRole?: string;
}

// ============================================
// MANDATORY VITALS CHECK COMPONENT
// ============================================

function MandatoryVitalsCheck({
  patientId,
  encounterId,
  employeeId,
  employeeName,
  employeeRole,
  onVitalsRecorded,
  onSkip,
  existingVitals,
}: {
  patientId: string;
  encounterId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  onVitalsRecorded: () => void;
  onSkip: (reason: string) => void;
  existingVitals?: VitalsData;
}) {
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const hasVitals = existingVitals && (existingVitals.bloodPressureSystolic || existingVitals.heartRate);

  if (hasVitals) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700">Vitals:</span>
        <span className="text-xs text-emerald-600">
          BP {existingVitals.bloodPressureSystolic}/{existingVitals.bloodPressureDiastolic} • HR {existingVitals.heartRate} • SpO₂ {existingVitals.oxygenSaturation}%
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-700">Vitals Required</span>
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 px-2"
          onClick={onVitalsRecorded}
        >
          <Activity className="h-3 w-3 mr-1" />
          Record
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs text-amber-600 hover:bg-amber-100 px-2"
          onClick={() => setShowSkipDialog(true)}
        >
          Skip
        </Button>
      </div>

      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Skip Vitals Recording
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping vitals. This will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Reason for skipping vitals (e.g., Patient refused, Equipment unavailable...)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (skipReason.trim()) {
                  onSkip(skipReason);
                  setShowSkipDialog(false);
                }
              }}
              disabled={!skipReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// ACTION LOG COMPONENT
// ============================================

function ConsultationActionLog({ logs }: { logs: ActionLog[] }) {
  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Action Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[120px]">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground"> by </span>
                  <span className="text-blue-600">{log.actorName}</span>
                  <Badge variant="outline" className="ml-1 text-xs">{log.actorRole}</Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ClinicalWorkflowDashboard({
  preselectedPatientId,
  currentStaffId = "EMP001",
  currentStaffName = "Dr. Smith",
  currentStaffRole = "doctor",
}: ClinicalWorkflowDashboardProps) {
  const { toast } = useToast();
  
  // State
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewConsultationOpen, setIsNewConsultationOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<string>("active-consultation");
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  
  // Mandatory vitals state
  const [vitalsRequired, setVitalsRequired] = useState(true);
  const [vitalsSkipped, setVitalsSkipped] = useState(false);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [currentVitals, setCurrentVitals] = useState<VitalsData | null>(null);
  
  // Action logs
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  
  // AI Chat state
  const [aiChat, setAiChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Patient search
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  
  // New consultation form - simplified, just patient selection
  const [newConsultation, setNewConsultation] = useState({
    patientId: preselectedPatientId || "",
    consultationType: "outpatient",
  });

  // Filter patients
  const filteredPatients = patients.filter(patient => {
    if (!patientSearchQuery) return true;
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    return fullName.includes(patientSearchQuery.toLowerCase()) || 
           patient.mrn.toLowerCase().includes(patientSearchQuery.toLowerCase());
  });

  // Initialize
  useEffect(() => {
    if (preselectedPatientId) {
      setNewConsultation(prev => ({ ...prev, patientId: preselectedPatientId }));
      // Auto-create consultation when patient is preselected
      handleSelectPatientAndCreate(preselectedPatientId);
    }
    fetchData();
    addActionLog("Session started", currentStaffName, currentStaffRole);
  }, [preselectedPatientId]);

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [consultationsRes, patientsRes] = await Promise.all([
        fetch("/api/consultations"),
        fetch("/api/patients?limit=100"),
      ]);

      const consultationsData = await consultationsRes.json();
      const patientsData = await patientsRes.json();

      if (consultationsData.success) {
        setConsultations(consultationsData.data.consultations);
      }
      if (patientsData.success) {
        setPatients(patientsData.data.patients);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: "Error",
        description: "Failed to load consultations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add action log
  const addActionLog = (action: string, actorName: string, actorRole: string, details?: string) => {
    const newLog: ActionLog = {
      id: `log-${Date.now()}`,
      action,
      actorName,
      actorRole,
      timestamp: new Date().toISOString(),
      details,
    };
    setActionLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // Get patient name
  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";
  };

  // Get selected patient name
  const getSelectedPatientName = () => {
    const patient = patients.find(p => p.id === newConsultation.patientId);
    return patient ? `${patient.firstName} ${patient.lastName} (${patient.mrn})` : "Select a patient";
  };

  // Handle patient selection and auto-create consultation
  const handleSelectPatientAndCreate = async (patientId: string) => {
    try {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;
      
      addActionLog("Created consultation", currentStaffName, currentStaffRole, `Type: ${newConsultation.consultationType}`);
      
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          consultationType: newConsultation.consultationType,
          providerName: currentStaffName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Consultation created successfully" });
        setShowPatientSelector(false);
        setNewConsultation({ patientId: "", consultationType: "outpatient" });
        fetchData();
        
        // Auto-select the new consultation
        if (data.data) {
          handleSelectConsultation(data.data);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create consultation", variant: "destructive" });
    }
  };

  // Create consultation (kept for backward compatibility but simplified)
  const handleCreateConsultation = async () => {
    if (!newConsultation.patientId) return;
    await handleSelectPatientAndCreate(newConsultation.patientId);
  };

  // Handle SOAP submit
  const handleSOAPSubmit = async (data: SOAPNoteData) => {
    addActionLog("Saved SOAP note draft", currentStaffName, currentStaffRole);
    // API call to save draft
    try {
      await fetch("/api/soap-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: selectedConsultation?.id,
          patientId: selectedPatient?.id,
          ...data,
          createdBy: currentStaffId,
        }),
      });
    } catch (error) {
      console.error("Failed to save SOAP note:", error);
    }
  };

  // Handle SOAP sign
  const handleSOAPSign = async (data: SOAPNoteData) => {
    // Check if vitals are recorded or skipped
    if (vitalsRequired && !vitalsSkipped && !currentVitals) {
      toast({
        title: "Vitals Required",
        description: "Please record vitals or provide a reason to skip before signing",
        variant: "destructive",
      });
      return;
    }

    addActionLog("Signed SOAP note", currentStaffName, currentStaffRole, `Diagnosis: ${data.primaryDiagnosis?.code || 'N/A'}`);
    
    try {
      const response = await fetch("/api/soap-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId: selectedConsultation?.id,
          patientId: selectedPatient?.id,
          ...data,
          status: "signed",
          signedBy: currentStaffId,
          signedAt: new Date().toISOString(),
          createdBy: currentStaffId,
        }),
      });

      if (response.ok) {
        // Update consultation status
        await fetch(`/api/consultations/${selectedConsultation?.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        
        toast({ title: "Success", description: "SOAP note signed and locked" });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to sign note", variant: "destructive" });
    }
  };

  // Handle vitals recorded
  const handleVitalsRecorded = () => {
    setShowVitalsForm(true);
  };

  // Handle vitals skip
  const handleVitalsSkip = (reason: string) => {
    setVitalsSkipped(true);
    setSkipReason(reason);
    setVitalsRequired(false);
    addActionLog("Skipped vitals", currentStaffName, currentStaffRole, `Reason: ${reason}`);
    toast({ title: "Vitals Skipped", description: "Reason logged for audit trail" });
  };

  // AI Assist
  const handleAiAssist = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatInput("");
    setAiChat(prev => [...prev, { role: "user", content: userMessage }]);
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/clinical-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          patientContext: selectedConsultation ? {
            chiefComplaint: selectedConsultation.chiefComplaint,
          } : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAiChat(prev => [...prev, { role: "assistant", content: data.data.message }]);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to get AI assistance", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Select consultation
  const handleSelectConsultation = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    const patient = patients.find(p => p.id === consultation.patientId);
    setSelectedPatient(patient || null);
    
    // Check for existing vitals
    if (consultation.vitals && consultation.vitals.length > 0) {
      setCurrentVitals(consultation.vitals[0]);
      setVitalsRequired(false);
    } else {
      setCurrentVitals(null);
      setVitalsRequired(true);
      setVitalsSkipped(false);
    }
    
    // Add action log
    addActionLog("Opened consultation", currentStaffName, currentStaffRole);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-700";
      case "in-progress": return "bg-blue-100 text-blue-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  // Prepare patient data for SOAP template
  const getPatientDataForSOAP = () => {
    if (!selectedPatient) return undefined;
    return {
      name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      dob: new Date(selectedPatient.dateOfBirth).toLocaleDateString(),
      mrn: selectedPatient.mrn,
      gender: selectedPatient.gender,
      allergies: selectedPatient.allergies ? JSON.parse(selectedPatient.allergies).map((a: any) => a.name || a) : [],
      activeMedications: [],
      chronicConditions: selectedPatient.chronicConditions ? JSON.parse(selectedPatient.chronicConditions) : [],
      recentVitals: currentVitals,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header with Staff Attribution */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-blue-500" />
            Clinical Workflow Dashboard
          </h2>
          <p className="text-slate-500 flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            {currentStaffName} ({currentStaffRole}) • All actions are logged for audit
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* New Consultation Button with Patient Selector */}
          <Popover open={showPatientSelector} onOpenChange={setShowPatientSelector}>
            <PopoverTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                <Plus className="h-4 w-4 mr-2" />
                New Consultation
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Select Patient to Start Consultation</h4>
                <p className="text-xs text-muted-foreground">Choose a patient to begin SOAP documentation</p>
              </div>
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Search patients..." 
                  value={patientSearchQuery}
                  onValueChange={setPatientSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No patients found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <CommandItem
                        key={patient.id}
                        value={patient.id}
                        onSelect={() => {
                          handleSelectPatientAndCreate(patient.id);
                          setPatientSearchQuery("");
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{patient.firstName} {patient.lastName}</p>
                            <p className="text-xs text-muted-foreground">MRN: {patient.mrn}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              <div className="p-2 border-t">
                <Select
                  value={newConsultation.consultationType}
                  onValueChange={(v) => setNewConsultation(prev => ({ ...prev, consultationType: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outpatient">Outpatient</SelectItem>
                    <SelectItem value="inpatient">Inpatient</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today", value: consultations.filter((c) => 
            new Date(c.consultationDate).toDateString() === new Date().toDateString()
          ).length, icon: Calendar },
          { label: "This Week", value: consultations.filter((c) => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(c.consultationDate) > weekAgo;
          }).length, icon: Clock },
          { label: "In Progress", value: consultations.filter((c) => c.status === "in-progress").length, icon: Activity },
          { label: "Completed", value: consultations.filter((c) => c.status === "completed").length, icon: CheckCircle },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active-consultation">
            <Stethoscope className="h-4 w-4 mr-2" />
            Active Consultation
          </TabsTrigger>
          <TabsTrigger value="vitals-history">
            <Heart className="h-4 w-4 mr-2" />
            Vitals History
          </TabsTrigger>
          <TabsTrigger value="consultation-history">
            <History className="h-4 w-4 mr-2" />
            Session Log
          </TabsTrigger>
          <TabsTrigger value="audit-trail">
            <Shield className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        {/* Active Consultation Tab */}
        <TabsContent value="active-consultation" className="mt-4">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Consultation List */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Active Consultations</CardTitle>
                  <CardDescription>
                    {consultations.filter(c => c.status === "in-progress").length} in progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      </div>
                    ) : consultations.filter(c => c.status === "in-progress").length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[400px] text-center">
                        <Stethoscope className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="font-medium text-slate-600">No Active Consultations</h3>
                        <p className="text-sm text-slate-400">Start a new consultation to begin</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {consultations
                          .filter(c => c.status === "in-progress")
                          .map((consultation) => (
                            <motion.div
                              key={consultation.id}
                              whileHover={{ scale: 1.01 }}
                              className={cn(
                                "p-4 rounded-lg border cursor-pointer transition-all",
                                selectedConsultation?.id === consultation.id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              )}
                              onClick={() => handleSelectConsultation(consultation)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                      {getPatientName(consultation.patientId).split(" ").map(n => n[0]).join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm">{getPatientName(consultation.patientId)}</p>
                                    <p className="text-xs text-slate-500">
                                      {new Date(consultation.consultationDate).toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                                <Badge className={getStatusColor(consultation.status)}>
                                  {consultation.status}
                                </Badge>
                              </div>
                              {consultation.chiefComplaint && (
                                <p className="text-sm text-slate-600 line-clamp-2">{consultation.chiefComplaint}</p>
                              )}
                            </motion.div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Consultation Details */}
            <div className="lg:col-span-3">
              {selectedConsultation ? (
                <div className="space-y-4">
                  {/* Patient Context Banner - Sticky at top */}
                  <PatientContextBanner
                    patient={selectedPatient ? {
                      id: selectedPatient.id,
                      mrn: selectedPatient.mrn,
                      firstName: selectedPatient.firstName,
                      lastName: selectedPatient.lastName,
                      dateOfBirth: selectedPatient.dateOfBirth,
                      gender: selectedPatient.gender,
                      bloodType: selectedPatient.bloodType,
                      allergies: selectedPatient.allergies ? (() => {
                        try {
                          const parsed = JSON.parse(selectedPatient.allergies);
                          return Array.isArray(parsed) ? parsed.map((a: any) => a.name || a) : [];
                        } catch {
                          return selectedPatient.allergies.split(",").map((a: string) => a.trim());
                        }
                      })() : [],
                      chronicConditions: selectedPatient.chronicConditions ? (() => {
                        try {
                          const parsed = JSON.parse(selectedPatient.chronicConditions);
                          return Array.isArray(parsed) ? parsed : [];
                        } catch {
                          return selectedPatient.chronicConditions.split(",").map((c: string) => c.trim());
                        }
                      })() : [],
                      currentMedications: [],
                      phone: selectedPatient.phone,
                    } : null}
                    vitals={currentVitals ? {
                      bloodPressureSystolic: currentVitals.bloodPressureSystolic,
                      bloodPressureDiastolic: currentVitals.bloodPressureDiastolic,
                      heartRate: currentVitals.heartRate,
                      temperature: currentVitals.temperature,
                      oxygenSaturation: currentVitals.oxygenSaturation,
                      respiratoryRate: currentVitals.respiratoryRate,
                      recordedAt: currentVitals.recordedAt,
                    } : undefined}
                    defaultExpanded={false}
                    isSticky={true}
                  />

                  {/* Compact Session Bar - Staff + Vitals Combined */}
                  <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                          {currentStaffName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-700">{currentStaffName}</span>
                      <Badge variant="secondary" className="text-xs h-5">{currentStaffRole}</Badge>
                    </div>
                    <Separator orientation="vertical" className="h-5" />
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <User className="h-3.5 w-3.5" />
                      <span>{getPatientName(selectedConsultation.patientId)}</span>
                    </div>
                    <Separator orientation="vertical" className="h-5" />
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(selectedConsultation.consultationDate).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex-1" />
                    {/* Inline Vitals Status */}
                    {vitalsRequired && !vitalsSkipped && !currentVitals && (
                      <MandatoryVitalsCheck
                        patientId={selectedConsultation.patientId}
                        encounterId={selectedConsultation.id}
                        employeeId={currentStaffId}
                        employeeName={currentStaffName}
                        employeeRole={currentStaffRole}
                        onVitalsRecorded={() => setShowVitalsForm(true)}
                        onSkip={handleVitalsSkip}
                        existingVitals={currentVitals || undefined}
                      />
                    )}
                    {currentVitals && (
                      <MandatoryVitalsCheck
                        patientId={selectedConsultation.patientId}
                        encounterId={selectedConsultation.id}
                        employeeId={currentStaffId}
                        employeeName={currentStaffName}
                        employeeRole={currentStaffRole}
                        onVitalsRecorded={() => setShowVitalsForm(true)}
                        onSkip={handleVitalsSkip}
                        existingVitals={currentVitals}
                      />
                    )}
                  </div>

                  {/* Vitals Form Dialog */}
                  <Dialog open={showVitalsForm} onOpenChange={setShowVitalsForm}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Record Vitals</DialogTitle>
                        <DialogDescription>
                          {getPatientName(selectedConsultation.patientId)}
                        </DialogDescription>
                      </DialogHeader>
                      <NurseVitalsCard
                        patientId={selectedConsultation.patientId}
                        encounterId={selectedConsultation.id}
                        employeeId={currentStaffId}
                        employeeName={currentStaffName}
                        employeeRole={currentStaffRole}
                        onVitalsRecorded={(vitals) => {
                          setCurrentVitals(vitals as any);
                          setVitalsRequired(false);
                          setShowVitalsForm(false);
                          addActionLog("Recorded vitals", currentStaffName, currentStaffRole);
                          toast({ title: "Vitals Recorded", description: "Vitals saved successfully" });
                        }}
                        compact
                      />
                    </DialogContent>
                  </Dialog>

                  {/* Use the EXISTING comprehensive SOAP Template */}
                  <SOAPNoteTemplate
                    patientId={selectedConsultation.patientId}
                    encounterId={selectedConsultation.id}
                    employeeId={currentStaffId}
                    employeeName={currentStaffName}
                    employeeRole={currentStaffRole}
                    patientData={getPatientDataForSOAP()}
                    mode="create"
                    onSubmit={handleSOAPSubmit}
                    onSign={handleSOAPSign}
                    onAISuggest={async (section, data) => {
                      // AI suggestion implementation
                      const response = await fetch("/api/clinical-support", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          query: `Generate ${section} for patient with: ${data.chiefComplaint}`,
                          patientContext: data,
                        }),
                      });
                      const result = await response.json();
                      return result.data?.message || "";
                    }}
                  />

                  {/* Action Log */}
                  <ConsultationActionLog logs={actionLogs} />
                </div>
              ) : (
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
                    <Stethoscope className="h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="font-medium text-slate-600">Select a Consultation</h3>
                    <p className="text-sm text-slate-400">Choose an active consultation from the list</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Vitals History Tab */}
        <TabsContent value="vitals-history" className="mt-4">
          {selectedPatient ? (
            <VitalsHistoryLog
              patientId={selectedPatient.id}
              patientName={getPatientName(selectedPatient.id)}
            />
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                <Heart className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-600">No Patient Selected</h3>
                <p className="text-sm text-slate-400">Select a patient from Active Consultation tab</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Consultation History Tab */}
        <TabsContent value="consultation-history" className="mt-4">
          <ConsultationSessionLog
            patientId={selectedPatient?.id}
            showPatientInfo={true}
            onConsultationSelect={(consultation) => {
              handleSelectConsultation(consultation as any);
              setActiveMainTab("active-consultation");
            }}
          />
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit-trail" className="mt-4">
          <StaffIdentityCard
            employeeId={currentStaffId}
            employeeName={currentStaffName}
            employeeRole={currentStaffRole as any}
            showAuditLog={true}
            patientMrn={selectedPatient?.mrn}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ClinicalWorkflowDashboard;
