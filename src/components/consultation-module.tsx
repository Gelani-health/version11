"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  MessageSquare,
  Send,
  Sparkles,
  Beaker,
  TestTube,
  Mic,
  X,
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
import ReactMarkdown from "react-markdown";
import { MedicalAutocompleteTextarea } from "@/components/medical-autocomplete-textarea";
import { LabModule } from "@/components/lab-module";
import { ClinicalVoiceRecorder } from "@/components/clinical-voice-recorder";
import { MedASRInput } from "@/components/medasr-input";
import { VoiceInputButton } from "@/components/voice-input-button";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface Consultation {
  id: string;
  patientId: string;
  consultationDate: string;
  consultationType: string;
  chiefComplaint?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  plan?: string;
  status: string;
  aiSummaryGenerated: boolean;
  patient?: Patient;
}

interface ConsultationModuleProps {
  preselectedPatientId?: string | null;
}

export function ConsultationModule({ preselectedPatientId }: ConsultationModuleProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewConsultationOpen, setIsNewConsultationOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const { toast } = useToast();

  const [newConsultation, setNewConsultation] = useState({
    patientId: preselectedPatientId || "",
    consultationType: "outpatient",
    chiefComplaint: "",
    subjectiveNotes: "",
    objectiveNotes: "",
    assessment: "",
    plan: "",
  });

  // Filter patients based on search query
  const filteredPatients = patients.filter(patient => {
    if (!patientSearchQuery) return true;
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    const mrn = patient.mrn.toLowerCase();
    const query = patientSearchQuery.toLowerCase();
    return fullName.includes(query) || mrn.includes(query);
  });

  // Get selected patient name
  const getSelectedPatientName = () => {
    const patient = patients.find(p => p.id === newConsultation.patientId);
    return patient ? `${patient.firstName} ${patient.lastName} (${patient.mrn})` : "Select a patient";
  };

  // Update newConsultation when preselectedPatientId changes
  useEffect(() => {
    if (preselectedPatientId) {
      setNewConsultation(prev => ({ ...prev, patientId: preselectedPatientId }));
      setIsNewConsultationOpen(true);
    }
  }, [preselectedPatientId]);

  const [aiChat, setAiChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleCreateConsultation = async () => {
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConsultation),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Consultation created successfully",
        });
        setIsNewConsultationOpen(false);
        setNewConsultation({
          patientId: "",
          consultationType: "outpatient",
          chiefComplaint: "",
          subjectiveNotes: "",
          objectiveNotes: "",
          assessment: "",
          plan: "",
        });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create consultation",
        variant: "destructive",
      });
    }
  };

  const handleAiAssist = async () => {
    if (!selectedConsultation || !chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput("");
    setAiChat((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/clinical-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          patientContext: {
            chiefComplaint: selectedConsultation.chiefComplaint,
            symptoms: selectedConsultation.subjectiveNotes,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAiChat((prev) => [
          ...prev,
          { role: "assistant", content: data.data.message },
        ]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI assistance",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleUpdateConsultation = async (field: string, value: string) => {
    if (!selectedConsultation) return;

    try {
      const response = await fetch(`/api/consultations/${selectedConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedConsultation(data.data);
        toast({
          title: "Saved",
          description: "Consultation updated",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update consultation",
        variant: "destructive",
      });
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "in-progress":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-blue-500" />
            Consultations
          </h2>
          <p className="text-slate-500">Manage patient consultations with AI assistance</p>
        </div>
        <Dialog open={isNewConsultationOpen} onOpenChange={setIsNewConsultationOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
              <Plus className="h-4 w-4 mr-2" />
              New Consultation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Start New Consultation</DialogTitle>
              <DialogDescription>Create a new patient consultation record</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Select Patient *</Label>
                <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className={cn(
                        "truncate",
                        !newConsultation.patientId && "text-muted-foreground"
                      )}>
                        {getSelectedPatientName()}
                      </span>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] p-0" 
                    align="start"
                    sideOffset={5}
                  >
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
                                setNewConsultation({ ...newConsultation, patientId: patient.id });
                                setPatientSearchOpen(false);
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
                                  <p className="font-medium truncate">
                                    {patient.firstName} {patient.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    MRN: {patient.mrn} • {patient.gender} • DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                                  </p>
                                </div>
                                {newConsultation.patientId === patient.id && (
                                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consultation Type</Label>
                  <Select
                    value={newConsultation.consultationType}
                    onValueChange={(value) =>
                      setNewConsultation({ ...newConsultation, consultationType: value })
                    }
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Input
                    placeholder="Main reason for visit"
                    value={newConsultation.chiefComplaint}
                    onChange={(e) =>
                      setNewConsultation({ ...newConsultation, chiefComplaint: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subjective Notes</Label>
                <Textarea
                  placeholder="Patient's description of symptoms and history..."
                  className="min-h-[100px]"
                  value={newConsultation.subjectiveNotes}
                  onChange={(e) =>
                    setNewConsultation({ ...newConsultation, subjectiveNotes: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Objective Notes</Label>
                <Textarea
                  placeholder="Clinical findings, vitals, exam results..."
                  className="min-h-[100px]"
                  value={newConsultation.objectiveNotes}
                  onChange={(e) =>
                    setNewConsultation({ ...newConsultation, objectiveNotes: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewConsultationOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-500 to-cyan-500"
                onClick={handleCreateConsultation}
                disabled={!newConsultation.patientId}
              >
                Create Consultation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today", value: consultations.filter((c) => new Date(c.consultationDate).toDateString() === new Date().toDateString()).length, icon: Calendar },
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

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consultation List */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Recent Consultations</CardTitle>
              <CardDescription>{consultations.length} total consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : consultations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <Stethoscope className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="font-medium text-slate-600">No Consultations</h3>
                    <p className="text-sm text-slate-400">Create your first consultation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consultations.map((consultation) => (
                      <motion.div
                        key={consultation.id}
                        whileHover={{ scale: 1.01 }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedConsultation?.id === consultation.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                        onClick={() => setSelectedConsultation(consultation)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                {getPatientName(consultation.patientId)
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {getPatientName(consultation.patientId)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(consultation.consultationDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={getStatusColor(consultation.status)}>
                            {consultation.status}
                          </Badge>
                        </div>
                        {consultation.chiefComplaint && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {consultation.chiefComplaint}
                          </p>
                        )}
                        {consultation.aiSummaryGenerated && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
                            <Sparkles className="h-3 w-3" />
                            AI Summary Generated
                          </div>
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
        <div className="lg:col-span-2">
          {selectedConsultation ? (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Consultation Details</CardTitle>
                    <CardDescription>
                      {getPatientName(selectedConsultation.patientId)} •{" "}
                      {new Date(selectedConsultation.consultationDate).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(selectedConsultation.status)}>
                    {selectedConsultation.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="soap">
                  <TabsList className="grid w-full grid-cols-5 h-auto">
                    <TabsTrigger value="soap" className="flex flex-col sm:flex-row items-center gap-1 py-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">SOAP</span>
                    </TabsTrigger>
                    <TabsTrigger value="voice" className="flex flex-col sm:flex-row items-center gap-1 py-2 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700">
                      <Mic className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Voice</span>
                    </TabsTrigger>
                    <TabsTrigger value="lab" className="flex flex-col sm:flex-row items-center gap-1 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                      <TestTube className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Lab</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex flex-col sm:flex-row items-center gap-1 py-2">
                      <Brain className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="flex flex-col sm:flex-row items-center gap-1 py-2">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs sm:text-sm">Actions</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="soap" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-blue-600">Chief Complaint</Label>
                        <MedicalAutocompleteTextarea
                          className="mt-1"
                          placeholder="Main reason for visit... (type to see medical term suggestions)"
                          value={selectedConsultation.chiefComplaint || ""}
                          onChange={(value) =>
                            setSelectedConsultation({
                              ...selectedConsultation,
                              chiefComplaint: value,
                            })
                          }
                          onBlur={(e) =>
                            handleUpdateConsultation("chiefComplaint", e.target.value)
                          }
                          rows={2}
                        />
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-sm font-medium text-blue-600">S - Subjective</Label>
                        <MedicalAutocompleteTextarea
                          className="mt-1"
                          placeholder="Patient's description of symptoms... (type or use 🎤 voice)"
                          value={selectedConsultation.subjectiveNotes || ""}
                          onChange={(value) =>
                            setSelectedConsultation({
                              ...selectedConsultation,
                              subjectiveNotes: value,
                            })
                          }
                          onBlur={(e) =>
                            handleUpdateConsultation("subjectiveNotes", e.target.value)
                          }
                          rows={4}
                          enableVoiceInput={true}
                          voiceContext="consultation"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-emerald-600">O - Objective</Label>
                        <MedicalAutocompleteTextarea
                          className="mt-1"
                          placeholder="Clinical findings and observations... (type or use 🎤 voice)"
                          value={selectedConsultation.objectiveNotes || ""}
                          onChange={(value) =>
                            setSelectedConsultation({
                              ...selectedConsultation,
                              objectiveNotes: value,
                            })
                          }
                          onBlur={(e) =>
                            handleUpdateConsultation("objectiveNotes", e.target.value)
                          }
                          rows={4}
                          enableVoiceInput={true}
                          voiceContext="consultation"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-purple-600">A - Assessment</Label>
                        <MedicalAutocompleteTextarea
                          className="mt-1"
                          placeholder="Diagnosis and clinical impression... (type or use 🎤 voice)"
                          value={selectedConsultation.assessment || ""}
                          onChange={(value) =>
                            setSelectedConsultation({
                              ...selectedConsultation,
                              assessment: value,
                            })
                          }
                          onBlur={(e) => handleUpdateConsultation("assessment", e.target.value)}
                          rows={3}
                          enableVoiceInput={true}
                          voiceContext="medical"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-amber-600">P - Plan</Label>
                        <MedicalAutocompleteTextarea
                          className="mt-1"
                          placeholder="Treatment plan and follow-up... (type or use 🎤 voice)"
                          value={selectedConsultation.plan || ""}
                          onChange={(value) =>
                            setSelectedConsultation({
                              ...selectedConsultation,
                              plan: value,
                            })
                          }
                          onBlur={(e) => handleUpdateConsultation("plan", e.target.value)}
                          rows={3}
                          enableVoiceInput={true}
                          voiceContext="consultation"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="voice" className="mt-4">
                    <ClinicalVoiceRecorder
                      patientId={selectedConsultation.patientId}
                      consultationId={selectedConsultation.id}
                      noteType="general"
                      onTranscriptionChange={(text) => {
                        // Optionally auto-fill SOAP fields with voice transcription
                        if (selectedConsultation) {
                          setSelectedConsultation({
                            ...selectedConsultation,
                            subjectiveNotes: selectedConsultation.subjectiveNotes 
                              ? `${selectedConsultation.subjectiveNotes}\n${text}` 
                              : text
                          });
                        }
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="lab" className="mt-4">
                    <LabModule 
                      patientId={selectedConsultation.patientId}
                      patientGender={patients.find((p: Patient) => p.id === selectedConsultation.patientId)?.gender}
                      patientName={getPatientName(selectedConsultation.patientId)}
                      mode="both"
                    />
                  </TabsContent>

                  <TabsContent value="ai" className="mt-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3">
                        <div className="flex items-center gap-2 text-white">
                          <Brain className="h-5 w-5" />
                          <span className="font-medium">AI Clinical Assistant</span>
                        </div>
                      </div>
                      <ScrollArea className="h-[350px] p-4">
                        {aiChat.length === 0 ? (
                          <div className="text-center py-8">
                            <Brain className="h-12 w-12 text-purple-300 mx-auto mb-4" />
                            <p className="text-slate-500">
                              Ask clinical questions or request AI assistance with diagnosis and
                              treatment planning.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {aiChat.map((msg, i) => (
                              <div
                                key={i}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] p-3 rounded-lg ${
                                    msg.role === "user"
                                      ? "bg-blue-500 text-white"
                                      : "bg-slate-100"
                                  }`}
                                >
                                  <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            ))}
                            {isAiLoading && (
                              <div className="flex justify-start">
                                <div className="bg-slate-100 p-3 rounded-lg">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="p-4 border-t">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ask AI for clinical assistance..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAiAssist()}
                          />
                          <Button
                            onClick={handleAiAssist}
                            disabled={isAiLoading || !chatInput.trim()}
                            className="bg-gradient-to-r from-purple-500 to-pink-500"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="actions" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="h-auto py-4"
                        onClick={() => {
                          if (selectedConsultation) {
                            handleUpdateConsultation("status", "completed");
                          }
                        }}
                      >
                        <CheckCircle className="h-5 w-5 mr-2 text-emerald-500" />
                        <div className="text-left">
                          <p className="font-medium">Complete</p>
                          <p className="text-xs text-slate-500">Mark as completed</p>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4">
                        <FileText className="h-5 w-5 mr-2 text-blue-500" />
                        <div className="text-left">
                          <p className="font-medium">Generate Report</p>
                          <p className="text-xs text-slate-500">Create PDF summary</p>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4">
                        <Activity className="h-5 w-5 mr-2 text-amber-500" />
                        <div className="text-left">
                          <p className="font-medium">Add Vitals</p>
                          <p className="text-xs text-slate-500">Record vital signs</p>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4">
                        <AlertCircle className="h-5 w-5 mr-2 text-purple-500" />
                        <div className="text-left">
                          <p className="font-medium">Add Diagnosis</p>
                          <p className="text-xs text-slate-500">Record diagnosis</p>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 col-span-2 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                        <TestTube className="h-5 w-5 mr-2 text-emerald-500" />
                        <div className="text-left">
                          <p className="font-medium text-emerald-700">Lab Results</p>
                          <p className="text-xs text-emerald-600">Add laboratory test results</p>
                        </div>
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
                <Stethoscope className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-600">Select a Consultation</h3>
                <p className="text-sm text-slate-400">Choose a consultation from the list to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
