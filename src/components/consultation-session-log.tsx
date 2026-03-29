"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  FileText,
  ChevronRight,
  ChevronDown,
  Activity,
  CheckCircle,
  AlertCircle,
  Lock,
  Edit,
  Eye,
  MessageSquare,
  Brain,
  Filter,
  Search,
  RefreshCw,
  UserCog,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ============================================
// TYPES
// ============================================

interface ConsultationRecord {
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
  providerName?: string;
  department?: string;
  aiSummaryGenerated: boolean;
  
  // SOAP Note data
  soapNote?: {
    id: string;
    status: string;
    signedAt?: string;
    signedBy?: string;
    primaryDiagnosisCode?: string;
    primaryDiagnosisDesc?: string;
    createdBy: string;
    createdAt: string;
  };
  
  // Vitals data
  vitals?: {
    id: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    recordedAt: string;
    recordedByName?: string;
  };
  
  patient?: {
    firstName: string;
    lastName: string;
    mrn?: string;
    dateOfBirth: string;
    gender: string;
  };
}

interface ConsultationSessionLogProps {
  patientId?: string;
  limit?: number;
  showPatientInfo?: boolean;
  onConsultationSelect?: (consultation: ConsultationRecord) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusConfig = (status: string) => {
  switch (status) {
    case "completed":
      return {
        color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: <CheckCircle className="h-3 w-3" />,
        label: "Completed"
      };
    case "in-progress":
      return {
        color: "bg-blue-100 text-blue-700 border-blue-200",
        icon: <Activity className="h-3 w-3 animate-pulse" />,
        label: "In Progress"
      };
    case "cancelled":
      return {
        color: "bg-slate-100 text-slate-700 border-slate-200",
        icon: <AlertCircle className="h-3 w-3" />,
        label: "Cancelled"
      };
    default:
      return {
        color: "bg-slate-100 text-slate-700 border-slate-200",
        icon: <Activity className="h-3 w-3" />,
        label: status
      };
  }
};

const getConsultationTypeConfig = (type: string) => {
  switch (type) {
    case "outpatient":
      return { color: "bg-blue-50 text-blue-700", label: "Outpatient", icon: "🏥" };
    case "inpatient":
      return { color: "bg-purple-50 text-purple-700", label: "Inpatient", icon: "🛏️" };
    case "emergency":
      return { color: "bg-red-50 text-red-700", label: "Emergency", icon: "🚨" };
    case "follow-up":
      return { color: "bg-green-50 text-green-700", label: "Follow-up", icon: "📋" };
    default:
      return { color: "bg-slate-50 text-slate-700", label: type, icon: "📝" };
  }
};

const getSOAPNoteStatusConfig = (status: string) => {
  switch (status) {
    case "signed":
      return { color: "text-emerald-600", icon: <Lock className="h-3 w-3" />, label: "Signed & Locked" };
    case "amended":
      return { color: "text-orange-600", icon: <Edit className="h-3 w-3" />, label: "Amended" };
    case "draft":
    default:
      return { color: "text-slate-600", icon: <Edit className="h-3 w-3" />, label: "Draft" };
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

export function ConsultationSessionLog({
  patientId,
  limit = 50,
  showPatientInfo = true,
  onConsultationSelect
}: ConsultationSessionLogProps) {
  const { toast } = useToast();
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchConsultations();
  }, [patientId, limit]);

  const fetchConsultations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(patientId && { patientId }),
      });

      const response = await fetch(`/api/consultations?${params}`);
      const data = await response.json();

      if (data.success) {
        setConsultations(data.data.consultations || []);
      }
    } catch (error) {
      console.error("Failed to fetch consultations:", error);
      toast({
        title: "Error",
        description: "Failed to load consultation history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter consultations
  const filteredConsultations = consultations.filter(c => {
    const matchesSearch = !searchTerm || 
      c.chiefComplaint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.assessment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesType = typeFilter === "all" || c.consultationType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Group by date
  const groupedConsultations = filteredConsultations.reduce((groups, c) => {
    const date = format(parseISO(c.consultationDate), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(c);
    return groups;
  }, {} as Record<string, ConsultationRecord[]>);

  const sortedDates = Object.keys(groupedConsultations).sort((a, b) => b.localeCompare(a));

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-600" />
              Consultation Session Log
            </CardTitle>
            <CardDescription>
              {filteredConsultations.length} consultations • Click to expand details
            </CardDescription>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConsultations}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by complaint, provider, diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="outpatient">Outpatient</SelectItem>
              <SelectItem value="inpatient">Inpatient</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Consultations List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredConsultations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No consultations found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-6 pr-4">
              {sortedDates.map((date) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {isToday(parseISO(date)) && "Today"}
                      {isYesterday(parseISO(date)) && "Yesterday"}
                      {!isToday(parseISO(date)) && !isYesterday(parseISO(date)) && format(parseISO(date), "EEEE, MMMM dd, yyyy")}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {groupedConsultations[date].length} session{groupedConsultations[date].length !== 1 && "s"}
                    </Badge>
                  </div>

                  {/* Consultations for this date */}
                  <div className="space-y-2">
                    {groupedConsultations[date].map((consultation) => {
                      const statusConfig = getStatusConfig(consultation.status);
                      const typeConfig = getConsultationTypeConfig(consultation.consultationType);
                      const soapStatus = consultation.soapNote ? getSOAPNoteStatusConfig(consultation.soapNote.status) : null;

                      return (
                        <motion.div
                          key={consultation.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "border rounded-lg overflow-hidden transition-all",
                            expandedId === consultation.id 
                              ? "ring-2 ring-blue-500 ring-offset-2" 
                              : "hover:shadow-md"
                          )}
                        >
                          {/* Header - Always Visible */}
                          <div
                            className="p-4 cursor-pointer bg-white hover:bg-slate-50"
                            onClick={() => setExpandedId(expandedId === consultation.id ? null : consultation.id)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                {/* Type Icon */}
                                <div className={cn("p-2 rounded-lg", typeConfig.color)}>
                                  <span className="text-lg">{typeConfig.icon}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  {/* Patient Name (if showPatientInfo) */}
                                  {showPatientInfo && consultation.patient && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                          {consultation.patient.firstName[0]}{consultation.patient.lastName[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium text-sm">
                                        {consultation.patient.firstName} {consultation.patient.lastName}
                                      </span>
                                      {consultation.patient.mrn && (
                                        <span className="text-xs text-muted-foreground">
                                          MRN: {consultation.patient.mrn}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Chief Complaint */}
                                  <div className="font-medium text-sm line-clamp-1">
                                    {consultation.chiefComplaint || "No chief complaint documented"}
                                  </div>

                                  {/* Time and Provider */}
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(parseISO(consultation.consultationDate), "HH:mm")}
                                    </span>
                                    {consultation.providerName && (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {consultation.providerName}
                                      </span>
                                    )}
                                    {consultation.department && (
                                      <span className="flex items-center gap-1">
                                        <Building2 className="h-3 w-3" />
                                        {consultation.department}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                {/* Status Badge */}
                                <Badge variant="outline" className={cn("flex items-center gap-1", statusConfig.color)}>
                                  {statusConfig.icon}
                                  <span>{statusConfig.label}</span>
                                </Badge>

                                {/* SOAP Note Status */}
                                {consultation.soapNote && (
                                  <div className={cn("flex items-center gap-1 text-xs", soapStatus?.color)}>
                                    {soapStatus?.icon}
                                    <span>{soapStatus?.label}</span>
                                  </div>
                                )}

                                {/* AI Generated */}
                                {consultation.aiSummaryGenerated && (
                                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                                    <Brain className="h-3 w-3 mr-1" />
                                    AI Summary
                                  </Badge>
                                )}

                                {/* Expand Icon */}
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    expandedId === consultation.id && "rotate-90"
                                  )}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {expandedId === consultation.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Separator />
                                <div className="p-4 bg-slate-50 space-y-4">
                                  {/* Quick Stats */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {consultation.vitals && (
                                      <>
                                        {consultation.vitals.bloodPressureSystolic && (
                                          <div className="p-2 bg-white rounded border text-center">
                                            <div className="text-lg font-bold text-red-600">
                                              {consultation.vitals.bloodPressureSystolic}/{consultation.vitals.bloodPressureDiastolic}
                                            </div>
                                            <div className="text-xs text-muted-foreground">BP (mmHg)</div>
                                          </div>
                                        )}
                                        {consultation.vitals.heartRate && (
                                          <div className="p-2 bg-white rounded border text-center">
                                            <div className="text-lg font-bold text-pink-600">
                                              {consultation.vitals.heartRate}
                                            </div>
                                            <div className="text-xs text-muted-foreground">HR (bpm)</div>
                                          </div>
                                        )}
                                        {consultation.vitals.temperature && (
                                          <div className="p-2 bg-white rounded border text-center">
                                            <div className="text-lg font-bold text-amber-600">
                                              {consultation.vitals.temperature}°C
                                            </div>
                                            <div className="text-xs text-muted-foreground">Temp</div>
                                          </div>
                                        )}
                                        {consultation.vitals.oxygenSaturation && (
                                          <div className="p-2 bg-white rounded border text-center">
                                            <div className="text-lg font-bold text-cyan-600">
                                              {consultation.vitals.oxygenSaturation}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">SpO₂</div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    
                                    {consultation.soapNote?.primaryDiagnosisCode && (
                                      <div className="p-2 bg-white rounded border">
                                        <div className="text-xs text-muted-foreground mb-1">Primary Diagnosis</div>
                                        <div className="font-mono text-sm text-green-700">
                                          {consultation.soapNote.primaryDiagnosisCode}
                                        </div>
                                        <div className="text-xs text-slate-600 truncate">
                                          {consultation.soapNote.primaryDiagnosisDesc}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* SOAP Summary */}
                                  <Accordion type="multiple" className="w-full">
                                    <AccordionItem value="soap" className="border rounded-lg px-2">
                                      <AccordionTrigger className="hover:no-underline">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-blue-600" />
                                          <span>SOAP Notes</span>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="space-y-3 text-sm">
                                          {consultation.chiefComplaint && (
                                            <div>
                                              <span className="font-medium text-blue-600">Chief Complaint: </span>
                                              {consultation.chiefComplaint}
                                            </div>
                                          )}
                                          
                                          {consultation.subjectiveNotes && (
                                            <div>
                                              <span className="font-medium text-blue-600">Subjective: </span>
                                              <p className="text-slate-600 mt-1">{consultation.subjectiveNotes}</p>
                                            </div>
                                          )}
                                          
                                          {consultation.objectiveNotes && (
                                            <div>
                                              <span className="font-medium text-emerald-600">Objective: </span>
                                              <p className="text-slate-600 mt-1">{consultation.objectiveNotes}</p>
                                            </div>
                                          )}
                                          
                                          {consultation.assessment && (
                                            <div>
                                              <span className="font-medium text-purple-600">Assessment: </span>
                                              <p className="text-slate-600 mt-1">{consultation.assessment}</p>
                                            </div>
                                          )}
                                          
                                          {consultation.plan && (
                                            <div>
                                              <span className="font-medium text-amber-600">Plan: </span>
                                              <p className="text-slate-600 mt-1">{consultation.plan}</p>
                                            </div>
                                          )}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>

                                  {/* Staff Attribution */}
                                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-white p-2 rounded border">
                                    <div className="flex items-center gap-4">
                                      <span className="flex items-center gap-1">
                                        <UserCog className="h-3 w-3" />
                                        Created: {format(parseISO(consultation.soapNote?.createdAt || consultation.consultationDate), "MMM dd, HH:mm")}
                                      </span>
                                      {consultation.soapNote?.signedAt && (
                                        <span className="flex items-center gap-1">
                                          <Lock className="h-3 w-3" />
                                          Signed: {format(parseISO(consultation.soapNote.signedAt), "MMM dd, HH:mm")}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {onConsultationSelect && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onConsultationSelect(consultation);
                                        }}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View Full
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default ConsultationSessionLog;
