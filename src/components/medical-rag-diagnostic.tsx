"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Brain,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Stethoscope,
  Activity,
  Pill,
  Heart,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  BookOpen,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface DiagnosticResult {
  request_id: string;
  timestamp: string;
  summary: string;
  differential_diagnoses: Array<{
    condition: string;
    icd10_code?: string;
    probability: number;
    reasoning: string;
    supporting_evidence: string[];
    recommended_tests: string[];
  }>;
  evidence_summary: string;
  citations: Array<{
    pmid: string;
    title: string;
    authors: string[];
    journal?: string;
    publication_date?: string;
    relevance_score: number;
  }>;
  recommended_workup: string[];
  treatment_considerations: string[];
  red_flags: string[];
  follow_up: string;
  confidence_level: string;
  articles_retrieved: number;
  total_latency_ms: number;
  model_used: string;
  disclaimer: string;
}

interface MedicalRAGDiagnosticProps {
  preselectedPatientId?: string | null;
}

export function MedicalRAGDiagnostic({ preselectedPatientId }: MedicalRAGDiagnosticProps) {
  const [symptoms, setSymptoms] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("input");

  const specialties = [
    { value: "cardiology", label: "Cardiology" },
    { value: "oncology", label: "Oncology" },
    { value: "neurology", label: "Neurology" },
    { value: "pulmonology", label: "Pulmonology" },
    { value: "endocrinology", label: "Endocrinology" },
    { value: "nephrology", label: "Nephrology" },
    { value: "gastroenterology", label: "Gastroenterology" },
    { value: "infectious_disease", label: "Infectious Disease" },
    { value: "rheumatology", label: "Rheumatology" },
    { value: "psychiatry", label: "Psychiatry" },
    { value: "dermatology", label: "Dermatology" },
  ];

  const handleDiagnose = useCallback(async () => {
    if (!symptoms.trim()) {
      setError("Please enter patient symptoms");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/medical-diagnostic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_symptoms: symptoms,
          medical_history: medicalHistory || undefined,
          age: age ? parseInt(age) : undefined,
          gender: gender || undefined,
          specialty: specialty || undefined,
          top_k: 20,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [symptoms, medicalHistory, age, gender, specialty]);

  const getConfidenceColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return "text-green-600 bg-green-50 border-green-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.7) return "text-green-600";
    if (probability >= 0.4) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Medical Diagnostic RAG</h2>
              <p className="text-purple-100">
                PubMed/PMC-powered diagnostic recommendations with GLM-4.7-Flash
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="input">
            <Stethoscope className="h-4 w-4 mr-2" />
            Patient Input
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!result}>
            <Activity className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="literature" disabled={!result}>
            <BookOpen className="h-4 w-4 mr-2" />
            Literature
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Presentation</CardTitle>
              <CardDescription>
                Enter patient symptoms and clinical context for diagnostic analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Symptoms */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Chief Complaint / Symptoms *</label>
                <Textarea
                  placeholder="e.g., 45-year-old male presenting with chest pain, shortness of breath, and diaphoresis for 2 hours. Pain radiates to left arm..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="min-h-32"
                />
              </div>

              {/* Patient Demographics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Age</label>
                  <Input
                    type="number"
                    placeholder="Years"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gender</label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Specialty Focus</label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Medical History */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Medical History (Optional)</label>
                <Textarea
                  placeholder="Relevant medical history, current medications, allergies, past surgeries..."
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  className="min-h-20"
                />
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSymptoms("");
                    setMedicalHistory("");
                    setAge("");
                    setGender("");
                    setSpecialty("");
                    setResult(null);
                    setError(null);
                  }}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleDiagnose}
                  disabled={loading || !symptoms.trim()}
                  className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Diagnosis
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">39M+</p>
                    <p className="text-sm text-slate-500">PubMed Abstracts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-violet-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-violet-500" />
                  <div>
                    <p className="text-2xl font-bold">11M+</p>
                    <p className="text-sm text-slate-500">PMC Full-Text</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-indigo-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Brain className="h-8 w-8 text-indigo-500" />
                  <div>
                    <p className="text-2xl font-bold">GLM-4.7</p>
                    <p className="text-sm text-slate-500">Flash Reasoning</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          {result && (
            <>
              {/* Summary Card */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Clinical Summary</CardTitle>
                      <CardDescription>
                        Request ID: {result.request_id} • {result.articles_retrieved} articles retrieved
                      </CardDescription>
                    </div>
                    <Badge className={getConfidenceColor(result.confidence_level)}>
                      {result.confidence_level.toUpperCase()} Confidence
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-slate-700">{result.summary}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {result.total_latency_ms.toFixed(0)}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="h-4 w-4" />
                      {result.model_used}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Differential Diagnoses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Differential Diagnoses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="space-y-2">
                    {result.differential_diagnoses.map((diagnosis, index) => (
                      <AccordionItem
                        key={index}
                        value={`diagnosis-${index}`}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-slate-800">
                                {diagnosis.condition}
                              </span>
                              {diagnosis.icd10_code && (
                                <Badge variant="outline" className="text-xs">
                                  ICD-10: {diagnosis.icd10_code}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={diagnosis.probability * 100}
                                className="w-24 h-2"
                              />
                              <span className={`font-medium ${getProbabilityColor(diagnosis.probability)}`}>
                                {(diagnosis.probability * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <div>
                            <h4 className="font-medium text-sm text-slate-600 mb-2">Clinical Reasoning</h4>
                            <p className="text-slate-700">{diagnosis.reasoning}</p>
                          </div>
                          {diagnosis.supporting_evidence.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-slate-600 mb-2">Supporting Evidence</h4>
                              <ul className="list-disc list-inside text-sm text-slate-600">
                                {diagnosis.supporting_evidence.map((e, i) => (
                                  <li key={i}>{e}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {diagnosis.recommended_tests.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-slate-600 mb-2">Recommended Tests</h4>
                              <div className="flex flex-wrap gap-2">
                                {diagnosis.recommended_tests.map((test, i) => (
                                  <Badge key={i} variant="secondary">
                                    {test}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Red Flags */}
              {result.red_flags.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Red Flags</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {result.red_flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Recommended Workup */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Recommended Workup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.recommended_workup.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Treatment Considerations */}
              {result.treatment_considerations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Pill className="h-5 w-5 text-blue-500" />
                      Treatment Considerations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.treatment_considerations.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Pill className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Follow-up */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    Follow-up Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">{result.follow_up}</p>
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important Disclaimer</AlertTitle>
                <AlertDescription>{result.disclaimer}</AlertDescription>
              </Alert>
            </>
          )}
        </TabsContent>

        {/* Literature Tab */}
        <TabsContent value="literature" className="space-y-4">
          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                    Retrieved Literature ({result.citations.length} articles)
                  </CardTitle>
                  <CardDescription>
                    Evidence from PubMed/PMC supporting diagnostic recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {result.citations.map((citation, index) => (
                        <Card key={index} className="border-l-4 border-l-purple-300">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    PMID: {citation.pmid}
                                  </Badge>
                                  <span className="text-xs text-slate-400">
                                    {(citation.relevance_score * 100).toFixed(0)}% relevant
                                  </span>
                                </div>
                                <h4 className="font-medium text-slate-800 mb-1">
                                  {citation.title}
                                </h4>
                                {citation.authors.length > 0 && (
                                  <p className="text-sm text-slate-600">
                                    {citation.authors.slice(0, 3).join(", ")}
                                    {citation.authors.length > 3 && " et al."}
                                  </p>
                                )}
                                {(citation.journal || citation.publication_date) && (
                                  <p className="text-sm text-slate-500 mt-1">
                                    {citation.journal && <span>{citation.journal}</span>}
                                    {citation.journal && citation.publication_date && " • "}
                                    {citation.publication_date && <span>{citation.publication_date}</span>}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="shrink-0"
                              >
                                <a
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Evidence Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">{result.evidence_summary}</p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MedicalRAGDiagnostic;
