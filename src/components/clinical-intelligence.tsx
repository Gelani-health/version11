"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  Database,
  Search,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
  Shield,
  ChevronDown,
  ChevronUp,
  User,
  MessageSquare,
  Lightbulb,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Activity,
  RefreshCw,
  BookMarked,
  Filter,
  X,
  Stethoscope,
  Pill,
  Heart,
  ClipboardList,
  BarChart3,
  Target,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  FileText,
  Calendar,
  Droplets,
  Scan,
  TestTube,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";
import { TTSButton } from "@/components/tts-button";
import { LLMProviderSelector } from "@/components/llm-provider-selector";
import { PredictionsPanel } from "@/components/predictions-panel";
import { PreventiveCarePanel } from "@/components/preventive-care-panel";

// Types
interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies?: string;
  chronicConditions?: string;
}

interface ClinicalResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  patientSpecificAlerts: string[];
  drugInteractions: Array<{
    drugs: string[];
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
    description: string;
    recommendation: string;
  }>;
  sources: Array<{
    type: 'knowledge_base' | 'bayesian' | 'guideline';
    title: string;
    relevance: number;
  }>;
  metadata: {
    responseTime: number;
    provider: string;
    model: string;
    knowledgeRetrieved: number;
    patientContextIncluded: boolean;
    bayesianEngineUsed: boolean;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  clinicalResponse?: ClinicalResponse;
  patientContext?: {
    name: string;
    id: string;
  };
}

interface ClinicalIntelligenceProps {
  preselectedPatientId?: string | null;
  onNavigateToSettings?: () => void;
}

// Tab configuration
const TABS = [
  { id: 'consultation', label: 'AI Consultation', icon: MessageSquare },
  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
  { id: 'preventive', label: 'Preventive Care', icon: Shield },
] as const;

// Quick query templates
const QUICK_QUERIES = [
  { category: "Cardiovascular", queries: [
    { label: "Chest Pain DDx", query: "What are the differential diagnoses for acute chest pain? Include critical diagnoses not to miss." },
    { label: "AFib Management", query: "What is the management approach for new-onset atrial fibrillation?" },
    { label: "Heart Failure", query: "What are the diagnostic criteria and initial management for acute decompensated heart failure?" },
  ]},
  { category: "Respiratory", queries: [
    { label: "Dyspnea DDx", query: "What is the differential diagnosis for acute dyspnea? What tests should be ordered?" },
    { label: "PE Workup", query: "What is the diagnostic approach for suspected pulmonary embolism? Include Wells criteria." },
    { label: "Pneumonia", query: "What are the treatment guidelines for community-acquired pneumonia?" },
  ]},
  { category: "Abdominal", queries: [
    { label: "Abdominal Pain", query: "What is the differential diagnosis for acute abdominal pain? What are red flags?" },
    { label: "GI Bleed", query: "What is the management approach for upper GI bleeding? Include risk stratification." },
    { label: "Pancreatitis", query: "What are the diagnostic criteria and initial management for acute pancreatitis?" },
  ]},
  { category: "Neurological", queries: [
    { label: "Headache", query: "What are the red flags for headache that require urgent neuroimaging?" },
    { label: "Stroke", query: "What is the acute management of suspected ischemic stroke?" },
    { label: "Syncope", query: "What is the diagnostic approach to syncope? What testing is indicated?" },
  ]},
  { category: "Infectious", queries: [
    { label: "Sepsis", query: "What are the diagnostic criteria for sepsis? What is the initial management?" },
    { label: "UTI", query: "What is the treatment approach for complicated vs uncomplicated UTI?" },
    { label: "Fever of Unknown", query: "What is the workup for fever of unknown origin?" },
  ]},
];

export function ClinicalIntelligence({ preselectedPatientId, onNavigateToSettings }: ClinicalIntelligenceProps) {
  // State
  const [activeTab, setActiveTab] = useState<'consultation' | 'predictions' | 'preventive'>('consultation');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `# Clinical Intelligence Assistant

Welcome to the **Unified Clinical Decision Support System**. I combine:

- **50+ Chief Complaints** with evidence-based pre-test probabilities
- **251 Conditional Likelihood Ratios** for Bayesian reasoning
- **RAG-Enhanced Knowledge** from clinical guidelines
- **Patient Context Integration** for personalized recommendations

## How to Use:

1. **Select a Patient** - Include their medical history in queries
2. **Ask Clinical Questions** - Diagnosis, treatment, drug interactions
3. **Review Bayesian Analysis** - Probabilistic diagnostic support
4. **Get Recommendations** - Tests, referrals, medications

## Quick Actions:
- Type a clinical question
- Use quick queries on the right
- Include patient context for personalized analysis

**Note:** All recommendations require clinical verification. This is an assistive tool, not a replacement for clinical judgment.`,
      timestamp: new Date(),
    },
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch patients
  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  const fetchPatients = async () => {
    try {
      setIsLoadingPatients(true);
      const response = await fetch("/api/patients?limit=200");
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

  const getSelectedPatient = () => {
    return patients.find((p) => p.id === selectedPatientId);
  };

  const parseAllergies = (allergies?: string): string[] => {
    if (!allergies) return [];
    try {
      return JSON.parse(allergies);
    } catch {
      return allergies.split(',').map(a => a.trim()).filter(Boolean);
    }
  };

  const parseConditions = (conditions?: string): string[] => {
    if (!conditions) return [];
    try {
      return JSON.parse(conditions);
    } catch {
      return conditions.split(',').map(c => c.trim()).filter(Boolean);
    }
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(p => {
    if (!patientSearch) return true;
    const search = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search) ||
      p.mrn.toLowerCase().includes(search)
    );
  });

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const selectedPatient = getSelectedPatient();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
      patientContext: selectedPatient ? {
        name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        id: selectedPatient.id,
      } : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/clinical-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: inputValue,
          patientId: selectedPatient?.id || undefined,
          providerId: selectedProviderId || undefined,
          includeBayesian: true,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const aiResponse: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.data.answer,
          timestamp: new Date(),
          clinicalResponse: data.data,
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Clinical Intelligence error:", error);
      toast.error("Failed to process clinical query");
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error processing your clinical query. Please verify API configuration or try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick query handler
  const handleQuickQuery = (query: string) => {
    setInputValue(query);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseAllergies(selectedPatient.allergies) : [];
  const patientConditions = selectedPatient ? parseConditions(selectedPatient.chronicConditions) : [];

  // Render severity badge
  const SeverityBadge = ({ severity }: { severity: string }) => {
    const colors = {
      contraindicated: "bg-red-100 text-red-700 border-red-300",
      major: "bg-orange-100 text-orange-700 border-orange-300",
      moderate: "bg-yellow-100 text-yellow-700 border-yellow-300",
      minor: "bg-blue-100 text-blue-700 border-blue-300",
    };
    return (
      <Badge variant="outline" className={colors[severity as keyof typeof colors] || colors.minor}>
        {severity}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-500" />
              Clinical Intelligence
            </h2>
            <p className="text-slate-500">Unified RAG + Bayesian Clinical Decision Support</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
              <Sparkles className="h-3 w-3 mr-1" />
              Bayesian
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
              <Database className="h-3 w-3 mr-1" />
              RAG
            </Badge>
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
              <Shield className="h-3 w-3 mr-1" />
              Evidence-Based
            </Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={isActive ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : ''}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'predictions' && (
          <PredictionsPanel patientId={selectedPatientId || null} />
        )}

        {activeTab === 'preventive' && (
          <PreventiveCarePanel patientId={selectedPatientId || null} />
        )}

        {activeTab === 'consultation' && (
        <>

        {/* Patient Selection with Grid */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  Patient Context
                </CardTitle>
                <CardDescription>Select a patient to include their complete medical history</CardDescription>
              </div>
              {selectedPatient && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatientId("")}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search and Select */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or MRN..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select 
                  value={selectedPatientId} 
                  onValueChange={setSelectedPatientId}
                  disabled={isLoadingPatients}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder={isLoadingPatients ? "Loading..." : "Select patient"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPatients.slice(0, 50).map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName} ({patient.mrn})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Patient Card */}
              {selectedPatient && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                          {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="font-semibold text-lg">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                          <p className="text-sm text-slate-600">MRN: {selectedPatient.mrn}</p>
                          <p className="text-sm text-slate-600">
                            {Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} y/o {selectedPatient.gender}
                          </p>
                        </div>
                        
                        {patientAllergies.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Allergies ({patientAllergies.length})
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {patientAllergies.slice(0, 3).map((a, i) => (
                                <Badge key={i} variant="outline" className="bg-red-50 border-red-200 text-red-700 text-xs">
                                  {a}
                                </Badge>
                              ))}
                              {patientAllergies.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{patientAllergies.length - 3} more</Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {patientConditions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              Conditions ({patientConditions.length})
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {patientConditions.slice(0, 3).map((c, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {c}
                                </Badge>
                              ))}
                              {patientConditions.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{patientConditions.length - 3} more</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Provider Selection */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LLMProviderSelector
              value={selectedProviderId}
              onChange={(id) => setSelectedProviderId(id)}
              onManageClick={onNavigateToSettings}
              showManageButton={!!onNavigateToSettings}
              placeholder="Select AI Provider (uses default if not selected)"
            />
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="border-0 shadow-md h-[700px] flex flex-col">
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    Clinical Consultation
                    {selectedPatient && (
                      <Badge variant="outline" className="ml-2 bg-blue-50 border-blue-200 text-blue-700">
                        {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                      </Badge>
                    )}
                  </CardTitle>
                  {messages.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setMessages([messages[0]])}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
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
                            className={`max-w-[95%] ${
                              message.role === "user"
                                ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl rounded-tr-md"
                                : "bg-slate-50 rounded-2xl rounded-tl-md border"
                            } p-4`}
                          >
                            {message.role === "assistant" && (
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="h-5 w-5 text-purple-500" />
                                <span className="text-sm font-semibold text-purple-700">Clinical Intelligence</span>
                                {message.clinicalResponse && (
                                  <>
                                    <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                      {message.clinicalResponse.confidence}% confidence
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {message.clinicalResponse.metadata.knowledgeRetrieved} sources
                                    </Badge>
                                  </>
                                )}
                              </div>
                            )}
                            
                            {/* Main Content */}
                            <div className="prose prose-sm max-w-none">
                              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                            </div>

                            {/* Patient Alerts */}
                            {message.clinicalResponse?.patientSpecificAlerts && message.clinicalResponse.patientSpecificAlerts.length > 0 && (
                              <div className="mt-4 pt-3 border-t">
                                <div className="flex items-center gap-2 text-red-700 mb-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-sm font-semibold">Patient-Specific Alerts</span>
                                </div>
                                <div className="space-y-1">
                                  {message.clinicalResponse.patientSpecificAlerts.map((alert, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                      {alert}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Drug Interactions */}
                            {message.clinicalResponse?.drugInteractions && message.clinicalResponse.drugInteractions.length > 0 && (
                              <div className="mt-4 pt-3 border-t">
                                <div className="flex items-center gap-2 text-orange-700 mb-2">
                                  <Pill className="h-4 w-4" />
                                  <span className="text-sm font-semibold">Drug Interactions</span>
                                </div>
                                <div className="space-y-2">
                                  {message.clinicalResponse.drugInteractions.map((interaction, i) => (
                                    <div key={i} className={`p-3 rounded-lg border ${
                                      interaction.severity === 'contraindicated' ? 'bg-red-50 border-red-300' :
                                      interaction.severity === 'major' ? 'bg-orange-50 border-orange-300' :
                                      interaction.severity === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                                      'bg-blue-50 border-blue-300'
                                    }`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium">{interaction.drugs.join(' + ')}</span>
                                        <SeverityBadge severity={interaction.severity} />
                                      </div>
                                      <p className="text-sm text-slate-600">{interaction.description}</p>
                                      <p className="text-xs text-slate-500 mt-1 italic">{interaction.recommendation}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Sources */}
                            {message.clinicalResponse?.sources && message.clinicalResponse.sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookMarked className="h-4 w-4 text-slate-500" />
                                  <span className="text-sm font-medium text-slate-600">Evidence Sources</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {message.clinicalResponse.sources.slice(0, 5).map((source, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {source.title}
                                      <span className="ml-1 text-slate-400">({Math.round(source.relevance * 100)}%)</span>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            {message.role === "assistant" && (
                              <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                                <TTSButton
                                  text={message.content}
                                  size="sm"
                                  variant="ghost"
                                  showSettings={false}
                                  label="Listen"
                                />
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(message.content)}>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  Helpful
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <ThumbsDown className="h-3 w-3 mr-1" />
                                  Not Helpful
                                </Button>
                              </div>
                            )}

                            {/* Timestamp */}
                            <p className="text-xs text-slate-400 mt-2">
                              {message.timestamp.toLocaleTimeString()}
                              {message.clinicalResponse && ` • ${message.clinicalResponse.metadata.responseTime}ms`}
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
                        <div className="bg-slate-50 rounded-2xl rounded-tl-md border p-4 max-w-md">
                          <div className="flex items-center gap-3">
                            <Brain className="h-5 w-5 text-purple-500 animate-pulse" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Analyzing clinical query...</p>
                              <p className="text-xs text-slate-500">Searching knowledge base • Bayesian reasoning • Patient context</p>
                            </div>
                          </div>
                          <Progress value={66} className="h-1 mt-3" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Input Area */}
                <div className="p-4 border-t bg-slate-50">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Textarea
                        placeholder={selectedPatient 
                          ? `Ask about ${selectedPatient.firstName}'s condition, differential diagnosis, treatment options...`
                          : "Ask a clinical question - differential diagnosis, treatment guidelines, drug interactions..."
                        }
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        className="min-h-[80px] resize-none pr-12"
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
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 h-auto px-6"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Queries Panel */}
          <div className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  Quick Queries
                </CardTitle>
                <CardDescription>Common clinical questions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[550px]">
                  <div className="space-y-4">
                    {QUICK_QUERIES.map((category, i) => (
                      <div key={i}>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          {category.category === "Cardiovascular" && <Heart className="h-4 w-4 text-red-500" />}
                          {category.category === "Respiratory" && <Activity className="h-4 w-4 text-blue-500" />}
                          {category.category === "Abdominal" && <Stethoscope className="h-4 w-4 text-purple-500" />}
                          {category.category === "Neurological" && <Brain className="h-4 w-4 text-indigo-500" />}
                          {category.category === "Infectious" && <Zap className="h-4 w-4 text-orange-500" />}
                          {category.category}
                        </h4>
                        <div className="space-y-1">
                          {category.queries.map((q, j) => (
                            <Button
                              key={j}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start h-auto py-2 px-3 hover:bg-purple-50 text-left"
                              onClick={() => handleQuickQuery(q.query)}
                            >
                              <ArrowRight className="h-3 w-3 text-purple-400 mr-2 flex-shrink-0" />
                              <span className="text-xs">{q.label}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="border-0 shadow-md bg-slate-800 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <span className="font-medium">Clinical Safety</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Bayesian probabilistic reasoning</li>
                  <li>• Evidence-based knowledge retrieval</li>
                  <li>• Patient context integration</li>
                  <li>• Drug interaction alerts</li>
                </ul>
                <Separator className="my-3 bg-slate-700" />
                <p className="text-xs text-slate-400">
                  All recommendations require clinical verification before implementation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        </>
        )}
      </div>
    </TooltipProvider>
  );
}
