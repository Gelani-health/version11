"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Brain,
  Pill,
  Beaker,
  Mic,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Volume2,
  ExternalLink,
  Filter,
  RefreshCw,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TTSButton } from "@/components/tts-button";
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";

interface TimelineEvent {
  id: string;
  type: 'consultation' | 'ai_interaction' | 'diagnosis' | 'medication' | 'lab_result' | 'voice_note';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, unknown>;
  aiGenerated?: boolean;
  consultationId?: string;
}

interface PatientInfo {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies?: string;
  chronicConditions?: string;
}

interface PatientTimelineProps {
  preselectedPatientId?: string | null;
}

const EVENT_ICONS: Record<string, typeof Stethoscope> = {
  consultation: Stethoscope,
  ai_interaction: Brain,
  diagnosis: Activity,
  medication: Pill,
  lab_result: Beaker,
  voice_note: Mic,
};

const EVENT_COLORS: Record<string, string> = {
  consultation: "bg-blue-500",
  ai_interaction: "bg-purple-500",
  diagnosis: "bg-red-500",
  medication: "bg-emerald-500",
  lab_result: "bg-amber-500",
  voice_note: "bg-cyan-500",
};

export function PatientTimeline({ preselectedPatientId }: PatientTimelineProps) {
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [groupedByDate, setGroupedByDate] = useState<Record<string, TimelineEvent[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Fetch patients
  useEffect(() => {
    fetchPatients();
  }, []);

  // Update when preselectedPatientId changes
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  // Fetch timeline when patient changes
  useEffect(() => {
    if (selectedPatientId) {
      fetchTimeline(selectedPatientId);
    }
  }, [selectedPatientId, selectedTypes]);

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
      toast.error("Failed to load patients");
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const fetchTimeline = async (patientId: string) => {
    try {
      setIsLoadingTimeline(true);
      const params = new URLSearchParams({ patientId, limit: "50" });
      if (selectedTypes.length > 0) {
        params.set("types", selectedTypes.join(","));
      }
      
      const response = await fetch(`/api/patient-timeline?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data.events);
        setGroupedByDate(data.data.groupedByDate);
        setCounts(data.data.counts);
      }
    } catch (error) {
      console.error("Failed to fetch timeline:", error);
      toast.error("Failed to load patient timeline");
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMMM d, yyyy");
  };

  const formatTime = (dateStr: string) => {
    return format(parseISO(dateStr), "h:mm a");
  };

  const parsePatientAllergies = (allergies?: string): string[] => {
    if (!allergies) return [];
    try {
      return JSON.parse(allergies);
    } catch {
      return [];
    }
  };

  const patientAllergies = selectedPatient ? parsePatientAllergies(selectedPatient.allergies) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-500" />
            Patient Timeline
          </h2>
          <p className="text-slate-500">Comprehensive patient history with consultations, AI interactions, and clinical data</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPatient && (
            <Button variant="outline" size="sm" onClick={() => fetchTimeline(selectedPatientId)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Patient Context
          </CardTitle>
          <CardDescription>Select a patient to view their complete medical timeline</CardDescription>
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
                  <AvatarFallback className="bg-blue-100 text-blue-700">
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

          {/* Quick Stats */}
          {selectedPatient && Object.keys(counts).length > 0 && (
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-600">{counts.consultations || 0}</p>
                <p className="text-xs text-blue-500">Consultations</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-center">
                <p className="text-lg font-bold text-purple-600">{counts.aiInteractions || 0}</p>
                <p className="text-xs text-purple-500">AI Queries</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg text-center">
                <p className="text-lg font-bold text-red-600">{counts.diagnoses || 0}</p>
                <p className="text-xs text-red-500">Diagnoses</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-center">
                <p className="text-lg font-bold text-emerald-600">{counts.medications || 0}</p>
                <p className="text-xs text-emerald-500">Medications</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-center">
                <p className="text-lg font-bold text-amber-600">{counts.labResults || 0}</p>
                <p className="text-xs text-amber-500">Lab Results</p>
              </div>
              <div className="p-2 bg-cyan-50 rounded-lg text-center">
                <p className="text-lg font-bold text-cyan-600">{counts.voiceNotes || 0}</p>
                <p className="text-xs text-cyan-500">Voice Notes</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      {selectedPatient ? (
        isLoadingTimeline ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                <p className="text-slate-500">Loading patient timeline...</p>
              </div>
            </CardContent>
          </Card>
        ) : events.length > 0 ? (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Medical History</CardTitle>
              <CardDescription>
                {events.length} events recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  {Object.entries(groupedByDate).map(([date, dateEvents]) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="sticky top-0 bg-white z-10 py-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-600">
                            {formatDateHeader(date)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {dateEvents.length} events
                          </Badge>
                        </div>
                        <Separator className="mt-2" />
                      </div>

                      {/* Events for this date */}
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-slate-200">
                        {dateEvents.map((event) => {
                          const Icon = EVENT_ICONS[event.type] || FileText;
                          const colorClass = EVENT_COLORS[event.type] || "bg-slate-500";
                          const isExpanded = expandedEvents.has(event.id);

                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="relative"
                            >
                              {/* Timeline dot */}
                              <div className={`absolute -left-[22px] top-4 w-3 h-3 rounded-full ${colorClass}`} />

                              {/* Event Card */}
                              <div className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className={`p-2 rounded-lg ${colorClass} bg-opacity-20`}>
                                      <Icon className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{event.title}</span>
                                        {event.aiGenerated && (
                                          <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                                            <Brain className="h-3 w-3 mr-1" />
                                            AI
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatTime(event.date)}</span>
                                        {event.metadata?.consultationType && (
                                          <>
                                            <span>•</span>
                                            <span>{String(event.metadata.consultationType)}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {event.description && (
                                      <TTSButton
                                        text={event.description}
                                        size="sm"
                                        variant="ghost"
                                        showSettings={false}
                                      />
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleEventExpanded(event.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                  {isExpanded && event.description && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-3 pt-3 border-t border-slate-200"
                                    >
                                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                        {event.description}
                                      </p>
                                      
                                      {/* Metadata display */}
                                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {Object.entries(event.metadata).slice(0, 5).map(([key, value]) => (
                                            value !== null && value !== undefined && (
                                              <Badge key={key} variant="secondary" className="text-xs">
                                                {key}: {String(value).slice(0, 20)}
                                              </Badge>
                                            )
                                          ))}
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-md">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center">
                <History className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No events recorded for this patient</p>
                <p className="text-sm text-slate-400 mt-1">
                  Consultations, AI interactions, and clinical data will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <User className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">Select a patient to view their timeline</p>
              <p className="text-sm text-slate-400 mt-1">
                Patient history, AI interactions, and clinical data will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Consistency Notice */}
      <Card className="border-0 shadow-md bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Data Consistency</p>
              <p className="text-xs text-blue-700 mt-1">
                All patient data including consultations, AI interactions, symptoms analysis, risk scores, and lab interpretations 
                are consistently linked to this patient. This ensures continuity of care across visits and enables comprehensive 
                clinical decision support.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
