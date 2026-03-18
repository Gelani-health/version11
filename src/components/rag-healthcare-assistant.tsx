"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  Database,
  Search,
  Mic,
  BookOpen,
  Stethoscope,
  Pill,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
  Shield,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  MessageSquare,
  Lightbulb,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Target,
  Activity,
  RefreshCw,
  BookMarked,
  Settings,
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
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";
import { TTSButton, InlineTTS } from "@/components/tts-button";
import { LLMProviderSelector } from "@/components/llm-provider-selector";

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

interface KnowledgeSource {
  id: string;
  title: string;
  category: string;
  relevanceScore: number;
}

interface RAGResponse {
  response: string;
  sources: string[];
  knowledge: KnowledgeSource[];
  drugInteractions?: {
    drug1: string;
    drug2: string;
    severity: string;
    description: string;
    management: string | null;
  }[];
  symptomMapping?: {
    symptom: string;
    conditions: {
      condition: string;
      icdCode: string;
      probability: number;
      urgency: string;
    }[];
    riskFactors: string[];
  };
  metadata: {
    responseTime: number;
    knowledgeRetrieved: number;
    queryType: string;
    provider?: string;
    model?: string;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  ragResponse?: RAGResponse;
  patientContext?: {
    name: string;
    id: string;
  };
}

interface RAGHealthcareAssistantProps {
  preselectedPatientId?: string | null;
  onNavigateToSettings?: () => void;
}

export function RAGHealthcareAssistant({ preselectedPatientId, onNavigateToSettings }: RAGHealthcareAssistantProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [providerInfo, setProviderInfo] = useState<{ provider?: string; model?: string } | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `# RAG Healthcare Assistant

Welcome! I'm an AI assistant powered by **Retrieval-Augmented Generation (RAG)** with access to a comprehensive medical knowledge base.

## What I Can Help With:

📚 **Clinical Guidelines** - Evidence-based treatment protocols
💊 **Drug Interactions** - Real-time drug safety checking
🔍 **Differential Diagnosis** - Symptom-based condition mapping
📋 **Lab Interpretation** - Reference ranges and clinical significance
⚕️ **Treatment Protocols** - Step-by-step clinical workflows

## How RAG Works:

1. **Query Analysis** - I analyze your clinical question
2. **Knowledge Retrieval** - I search the medical knowledge base
3. **Context Integration** - Relevant knowledge is used to enhance my response
4. **Evidence-Based Response** - I provide answers with cited sources

**Select a patient above to include their medical context in queries.**`,
      timestamp: new Date(),
    },
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSource[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Update selected patient when preselectedPatientId changes
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

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

  const parseConditions = (conditions?: string): string[] => {
    if (!conditions) return [];
    try {
      return JSON.parse(conditions);
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
      patientContext: selectedPatient ? {
        name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        id: selectedPatient.id,
      } : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Build patient context if selected
      const patientContext = selectedPatient ? {
        id: selectedPatient.id,
        name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        age: Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
        gender: selectedPatient.gender,
        allergies: parseAllergies(selectedPatient.allergies),
        medications: [], // Would fetch from API
        conditions: parseConditions(selectedPatient.chronicConditions),
      } : undefined;

      // Call RAG API with providerId from SSOT
      const response = await fetch("/api/rag-healthcare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: inputValue,
          queryType: "text",
          patientId: selectedPatient?.id || undefined,
          providerId: selectedProviderId || undefined,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const aiResponse: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.data.response,
          timestamp: new Date(),
          ragResponse: data.data,
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("RAG query error:", error);
      toast.error("Failed to process query");
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error processing your query. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchKnowledge = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(`/api/rag-healthcare?q=${encodeURIComponent(searchQuery)}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setKnowledgeResults(data.data.results);
      }
    } catch (error) {
      console.error("Knowledge search error:", error);
      toast.error("Failed to search knowledge base");
    }
  }, [searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseAllergies(selectedPatient.allergies) : [];

  // Quick query templates
  const quickQueries = [
    { label: "Hypertension Management", query: "What are the current guidelines for managing hypertension in adults?" },
    { label: "Diabetes Protocol", query: "What is the treatment protocol for type 2 diabetes?" },
    { label: "Chest Pain DDx", query: "What are the differential diagnoses for chest pain?" },
    { label: "Drug Interaction", query: "What are the major drug interactions with warfarin?" },
    { label: "CAP Treatment", query: "What is the treatment for community-acquired pneumonia?" },
    { label: "Asthma Exacerbation", query: "How do I manage acute asthma exacerbation?" },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Database className="h-6 w-6 text-emerald-500" />
              RAG Healthcare Assistant
            </h2>
            <p className="text-slate-500">AI-powered with Retrieval-Augmented Generation for evidence-based responses</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
              <Sparkles className="h-3 w-3 mr-1" />
              RAG Enhanced
            </Badge>
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
              <BookOpen className="h-3 w-3 mr-1" />
              Knowledge Base
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
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">
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

            {selectedPatient && patientAllergies.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
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
          </CardContent>
        </Card>

        {/* AI Provider Selection - SSOT */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Provider
              {providerInfo?.model && (
                <Badge variant="outline" className="ml-2 bg-purple-50 border-purple-200 text-purple-700">
                  {providerInfo.model}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Select the AI model provider for this session</CardDescription>
          </CardHeader>
          <CardContent>
            <LLMProviderSelector
              value={selectedProviderId}
              onChange={(id) => setSelectedProviderId(id)}
              onManageClick={onNavigateToSettings}
              showManageButton={!!onNavigateToSettings}
              placeholder="Select AI Provider"
            />
          </CardContent>
        </Card>

        {/* RAG Info Alert */}
        <Alert className="bg-emerald-50 border-emerald-200">
          <Database className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">RAG Technology</AlertTitle>
          <AlertDescription className="text-emerald-700">
            Responses are enhanced with knowledge retrieval from clinical guidelines, drug databases, and medical literature. 
            All AI suggestions should be reviewed by a qualified healthcare professional.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-1">
              <FileSearch className="h-4 w-4" />
              Sources
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Chat Area */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-md h-[600px] flex flex-col">
                  <CardHeader className="border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5 text-emerald-500" />
                      RAG AI Chat
                      {selectedPatient && (
                        <Badge variant="outline" className="ml-2 bg-emerald-50 border-emerald-200 text-emerald-700">
                          {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Ask clinical questions with knowledge-enhanced responses</CardDescription>
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
                                className={`max-w-[90%] ${
                                  message.role === "user"
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl rounded-tr-md"
                                    : "bg-slate-100 rounded-2xl rounded-tl-md"
                                } p-4`}
                              >
                                {message.role === "assistant" && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <Database className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-emerald-600">RAG Assistant</span>
                                    {message.ragResponse && (
                                      <Badge variant="outline" className="text-xs">
                                        {message.ragResponse.metadata.knowledgeRetrieved} sources
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                
                                <div className="prose prose-sm max-w-none">
                                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                </div>

                                {/* Knowledge Sources */}
                                {message.ragResponse?.knowledge && message.ragResponse.knowledge.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-slate-200">
                                    <p className="text-xs font-medium text-slate-500 mb-2">Retrieved Knowledge:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {message.ragResponse.knowledge.map((k, i) => (
                                        <Badge key={i} variant="outline" className="text-xs bg-white">
                                          <BookMarked className="h-3 w-3 mr-1" />
                                          {k.title}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Drug Interactions */}
                                {message.ragResponse?.drugInteractions && message.ragResponse.drugInteractions.length > 0 && (
                                  <div className="mt-4 space-y-2">
                                    <p className="text-sm font-semibold flex items-center gap-2 text-red-600">
                                      <AlertTriangle className="h-4 w-4" />
                                      Drug Interactions Found
                                    </p>
                                    {message.ragResponse.drugInteractions.map((interaction, i) => (
                                      <div key={i} className={`p-2 rounded border ${
                                        interaction.severity === 'contraindicated' ? 'bg-red-50 border-red-200' :
                                        interaction.severity === 'major' ? 'bg-orange-50 border-orange-200' :
                                        'bg-yellow-50 border-yellow-200'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{interaction.drug1} + {interaction.drug2}</span>
                                          <Badge variant="outline" className="text-xs">{interaction.severity}</Badge>
                                        </div>
                                        <p className="text-xs mt-1">{interaction.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Symptom Mapping */}
                                {message.ragResponse?.symptomMapping && (
                                  <div className="mt-4">
                                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                                      <Target className="h-4 w-4 text-purple-500" />
                                      Differential Diagnosis for "{message.ragResponse.symptomMapping.symptom}"
                                    </p>
                                    <div className="space-y-1">
                                      {message.ragResponse.symptomMapping.conditions.slice(0, 5).map((cond, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                          <span>{cond.condition}</span>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{cond.icdCode}</Badge>
                                            <span className="text-xs text-slate-500">{Math.round(cond.probability * 100)}%</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                {message.role === "assistant" && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <TTSButton
                                      text={message.content}
                                      size="sm"
                                      variant="ghost"
                                      showSettings={false}
                                      label="Read aloud"
                                    />
                                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(message.content)}>
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                    {message.ragResponse && (
                                      <>
                                        <Button variant="ghost" size="sm">
                                          <ThumbsUp className="h-3 w-3 mr-1" />
                                          Helpful
                                        </Button>
                                        <Button variant="ghost" size="sm">
                                          <ThumbsDown className="h-3 w-3 mr-1" />
                                          Not Helpful
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}

                                <p className="text-xs text-slate-400 mt-2">
                                  {message.timestamp.toLocaleTimeString()}
                                  {message.ragResponse && ` • ${message.ragResponse.metadata.responseTime}ms`}
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
                              <div className="flex items-center gap-3">
                                <Database className="h-4 w-4 text-emerald-500 animate-pulse" />
                                <span className="text-sm text-slate-600">Searching knowledge base and generating response...</span>
                              </div>
                              <Progress value={66} className="h-1 mt-2" />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Textarea
                            placeholder={selectedPatient ? `Ask about ${selectedPatient.firstName}'s condition or clinical questions...` : "Ask a clinical question..."}
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
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Queries Panel */}
              <div className="space-y-4">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Queries</CardTitle>
                    <CardDescription>Common clinical questions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {quickQueries.map((q, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          className="w-full justify-start h-auto py-2 px-3 hover:bg-emerald-50"
                          onClick={() => setInputValue(q.query)}
                        >
                          <Lightbulb className="h-4 w-4 text-emerald-500 mr-3" />
                          <span className="text-sm">{q.label}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">RAG Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Knowledge Coverage</span>
                          <span className="font-medium">89%</span>
                        </div>
                        <Progress value={89} className="h-2 bg-emerald-100" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Avg. Retrieval Time</span>
                          <span className="font-medium">245ms</span>
                        </div>
                        <Progress value={75} className="h-2 bg-blue-100" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Response Quality</span>
                          <span className="font-medium">94%</span>
                        </div>
                        <Progress value={94} className="h-2 bg-purple-100" />
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
                      All RAG-enhanced responses require clinical verification before implementation in patient care.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Knowledge Search Tab */}
          <TabsContent value="knowledge" className="space-y-4 mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-emerald-500" />
                  Search Knowledge Base
                </CardTitle>
                <CardDescription>Directly search the medical knowledge database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Search clinical guidelines, drug interactions, symptoms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchKnowledge()}
                  />
                  <Button onClick={searchKnowledge}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {knowledgeResults.length > 0 && (
                  <div className="space-y-3">
                    {knowledgeResults.map((result, i) => (
                      <Card key={i} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{result.title}</h4>
                              <p className="text-sm text-slate-500">{result.category}</p>
                            </div>
                            <Badge variant="outline">
                              {Math.round(result.relevanceScore * 100)}% match
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4 mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-500" />
                  Knowledge Base Sources
                </CardTitle>
                <CardDescription>Information about the knowledge sources used in RAG</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { name: "Clinical Guidelines", count: 10, icon: BookOpen, color: "emerald" },
                    { name: "Drug Interactions", count: 6, icon: Pill, color: "rose" },
                    { name: "Symptom Mappings", count: 5, icon: Target, color: "purple" },
                    { name: "Lab Interpretation", count: 2, icon: Activity, color: "blue" },
                  ].map((source, i) => (
                    <Card key={i} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-${source.color}-50`}>
                            <source.icon className={`h-5 w-5 text-${source.color}-500`} />
                          </div>
                          <div>
                            <h4 className="font-medium">{source.name}</h4>
                            <p className="text-sm text-slate-500">{source.count} entries</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
