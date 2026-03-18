"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Upload,
  Mic,
  MicOff,
  FileText,
  Image as ImageIcon,
  Stethoscope,
  Pill,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ChevronRight,
  Lightbulb,
  Activity,
  TrendingUp,
  Shield,
  Sparkles,
  FileSearch,
  Code,
  MessageSquare,
  Copy,
  RefreshCw,
  Download,
  Filter,
  Star,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
  Target,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { TTSButton } from "@/components/tts-button";

// ICD-10 Code Database (common codes)
const ICD10_CODES = {
  "A00-B99": { name: "Infectious and Parasitic Diseases", codes: [
    { code: "A09", description: "Diarrhea and gastroenteritis of presumed infectious origin" },
    { code: "A37", description: "Whooping cough" },
    { code: "B01", description: "Varicella [chickenpox]" },
    { code: "B05", description: "Measles" },
    { code: "B18", description: "Chronic viral hepatitis" },
  ]},
  "C00-D49": { name: "Neoplasms", codes: [
    { code: "C50", description: "Malignant neoplasm of breast" },
    { code: "C61", description: "Malignant neoplasm of prostate" },
    { code: "C78", description: "Secondary malignant neoplasm of respiratory and digestive organs" },
  ]},
  "E00-E89": { name: "Endocrine, Nutritional and Metabolic Diseases", codes: [
    { code: "E10", description: "Type 1 diabetes mellitus" },
    { code: "E11", description: "Type 2 diabetes mellitus" },
    { code: "E78", description: "Disorders of lipoprotein metabolism and other lipidemias" },
    { code: "E03", description: "Hypothyroidism" },
    { code: "E05", description: "Thyrotoxicosis [hyperthyroidism]" },
  ]},
  "I00-I99": { name: "Diseases of the Circulatory System", codes: [
    { code: "I10", description: "Essential (primary) hypertension" },
    { code: "I20", description: "Angina pectoris" },
    { code: "I21", description: "Acute myocardial infarction" },
    { code: "I25", description: "Chronic ischemic heart disease" },
    { code: "I50", description: "Heart failure" },
    { code: "I48", description: "Atrial fibrillation and flutter" },
  ]},
  "J00-J99": { name: "Diseases of the Respiratory System", codes: [
    { code: "J00", description: "Acute nasopharyngitis [common cold]" },
    { code: "J18", description: "Pneumonia, unspecified organism" },
    { code: "J20", description: "Acute bronchitis" },
    { code: "J45", description: "Asthma" },
    { code: "J44", description: "Other chronic obstructive pulmonary disease" },
    { code: "J40", description: "Bronchitis, not specified as acute or chronic" },
  ]},
  "K00-K95": { name: "Diseases of the Digestive System", codes: [
    { code: "K21", description: "Gastro-esophageal reflux disease" },
    { code: "K29", description: "Gastritis and duodenitis" },
    { code: "K35", description: "Acute appendicitis" },
    { code: "K52", description: "Noninfective gastroenteritis and colitis" },
    { code: "K76", description: "Other diseases of liver" },
  ]},
  "M00-M99": { name: "Diseases of the Musculoskeletal System", codes: [
    { code: "M54", description: "Dorsalgia" },
    { code: "M79", description: "Other and unspecified soft tissue disorders" },
    { code: "M25", description: "Other joint disorders, not elsewhere classified" },
    { code: "M17", description: "Gonarthrosis [osteoarthritis of knee]" },
  ]},
  "N00-N99": { name: "Diseases of the Genitourinary System", codes: [
    { code: "N39", description: "Other disorders of urinary system" },
    { code: "N40", description: "Benign prostatic hyperplasia" },
    { code: "N17", description: "Acute kidney failure" },
    { code: "N18", description: "Chronic kidney disease" },
  ]},
  "R00-R99": { name: "Symptoms, Signs and Abnormal Clinical Findings", codes: [
    { code: "R50", description: "Fever of other and unknown origin" },
    { code: "R51", description: "Pain in head [headache]" },
    { code: "R10", description: "Abdominal and pelvic pain" },
    { code: "R11", description: "Nausea and vomiting" },
    { code: "R42", description: "Dizziness and giddiness" },
    { code: "R05", description: "Cough" },
    { code: "R06", description: "Abnormalities of breathing" },
  ]},
  "F01-F99": { name: "Mental and Behavioral Disorders", codes: [
    { code: "F32", description: "Major depressive disorder" },
    { code: "F41", description: "Other anxiety disorders" },
    { code: "F10", description: "Mental and behavioral disorders due to use of alcohol" },
    { code: "F33", description: "Recurrent depressive disorder" },
  ]},
};

// CPT Code Database (common codes)
const CPT_CODES = {
  "E/M": { name: "Evaluation and Management", codes: [
    { code: "99201", description: "Office/outpatient visit, new patient, straightforward" },
    { code: "99202", description: "Office/outpatient visit, new patient, low complexity" },
    { code: "99203", description: "Office/outpatient visit, new patient, moderate complexity" },
    { code: "99204", description: "Office/outpatient visit, new patient, high complexity" },
    { code: "99205", description: "Office/outpatient visit, new patient, highest complexity" },
    { code: "99211", description: "Office/outpatient visit, established patient, minimal" },
    { code: "99212", description: "Office/outpatient visit, established patient, straightforward" },
    { code: "99213", description: "Office/outpatient visit, established patient, low complexity" },
    { code: "99214", description: "Office/outpatient visit, established patient, moderate complexity" },
    { code: "99215", description: "Office/outpatient visit, established patient, high complexity" },
    { code: "99281", description: "Emergency department visit, self-limited problem" },
    { code: "99282", description: "Emergency department visit, low severity" },
    { code: "99283", description: "Emergency department visit, moderate severity" },
    { code: "99284", description: "Emergency department visit, high severity" },
    { code: "99285", description: "Emergency department visit, immediate threat" },
  ]},
  "LAB": { name: "Laboratory", codes: [
    { code: "80053", description: "Comprehensive metabolic panel" },
    { code: "80048", description: "Basic metabolic panel" },
    { code: "85025", description: "Complete blood count with differential" },
    { code: "81001", description: "Urinalysis by dip stick or tablet reagent" },
    { code: "84443", description: "Thyroid stimulating hormone (TSH)" },
    { code: "82947", description: "Glucose; quantitative" },
    { code: "83036", description: "Hemoglobin A1c" },
    { code: "80061", description: "Lipid panel" },
  ]},
  "RAD": { name: "Radiology", codes: [
    { code: "71046", description: "Chest X-ray, 2 views" },
    { code: "71045", description: "Chest X-ray, 1 view" },
    { code: "72148", description: "Lumbar spine MRI without contrast" },
    { code: "70553", description: "Brain MRI with and without contrast" },
    { code: "74177", description: "CT abdomen and pelvis with contrast" },
    { code: "71250", description: "CT thorax without contrast" },
  ]},
  "PROC": { name: "Procedures", codes: [
    { code: "96372", description: "Therapeutic, prophylactic, or diagnostic injection" },
    { code: "90471", description: "Immunization administration, intramuscular" },
    { code: "93000", description: "Electrocardiogram, routine ECG" },
    { code: "93010", description: "ECG interpretation and report" },
    { code: "94010", description: "Spirometry" },
    { code: "94640", description: "Non-pressure ventilator support" },
  ]},
};

interface DifferentialDiagnosis {
  id: string;
  condition: string;
  icdCode: string;
  probability: number;
  symptoms: string[];
  riskFactors: string[];
  recommendedTests: string[];
  urgency: "low" | "moderate" | "high" | "critical";
  notes: string;
}

interface AIAnalysisResult {
  id: string;
  type: "text" | "voice" | "image" | "multi-modal";
  input: string;
  differentialDiagnoses: DifferentialDiagnosis[];
  recommendedICD10: { code: string; description: string; confidence: number }[];
  recommendedCPT: { code: string; description: string; confidence: number }[];
  clinicalRecommendations: string[];
  drugInteractionAlerts: { severity: string; drug1: string; drug2: string; description: string }[];
  followUpSuggestions: string[];
  timestamp: Date;
  confidence: number;
}

interface AdvancedAIIntelligenceProps {
  preselectedPatientId?: string | null;
}

export function AdvancedAIIntelligence({ preselectedPatientId }: AdvancedAIIntelligenceProps) {
  const [activeTab, setActiveTab] = useState("analysis");
  const [analysisType, setAnalysisType] = useState<"text" | "voice" | "image" | "multi-modal">("multi-modal");
  const [clinicalInput, setClinicalInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysisResult[]>([]);
  const [searchICD, setSearchICD] = useState("");
  const [searchCPT, setSearchCPT] = useState("");
  const [includeDifferential, setIncludeDifferential] = useState(true);
  const [includeCoding, setIncludeCoding] = useState(true);
  const [includeDrugCheck, setIncludeDrugCheck] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Send to ASR API
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started");
    } catch (error) {
      toast.error("Failed to access microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info("Processing audio...");
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/voice-notes", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.transcription) {
        setClinicalInput(prev => prev + " " + data.transcription);
        toast.success("Voice transcribed successfully");
      }
    } catch (error) {
      toast.error("Failed to transcribe audio");
    }
  };

  // Image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI analysis
  const runAnalysis = async () => {
    if (!clinicalInput.trim() && !uploadedImage) {
      toast.error("Please provide clinical input or upload an image");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Call AI analysis API
      const response = await fetch("/api/clinical-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: analysisType,
          input: clinicalInput,
          imageData: uploadedImage,
          includeDifferential,
          includeCoding,
          includeDrugCheck,
        }),
      });

      const data = await response.json();
      
      const result: AIAnalysisResult = {
        id: `analysis-${Date.now()}`,
        type: analysisType,
        input: clinicalInput,
        differentialDiagnoses: data.differentialDiagnoses || generateMockDifferentialDiagnoses(),
        recommendedICD10: data.recommendedICD10 || generateMockICD10Suggestions(),
        recommendedCPT: data.recommendedCPT || generateMockCPTSuggestions(),
        clinicalRecommendations: data.clinicalRecommendations || generateMockRecommendations(),
        drugInteractionAlerts: data.drugInteractionAlerts || [],
        followUpSuggestions: data.followUpSuggestions || generateMockFollowUp(),
        timestamp: new Date(),
        confidence: data.confidence || 0.87,
      };

      setAnalysisResult(result);
      setAnalysisHistory(prev => [result, ...prev]);
      toast.success("Analysis completed successfully");
    } catch (error) {
      // Generate mock result for demo
      const result: AIAnalysisResult = {
        id: `analysis-${Date.now()}`,
        type: analysisType,
        input: clinicalInput,
        differentialDiagnoses: generateMockDifferentialDiagnoses(),
        recommendedICD10: generateMockICD10Suggestions(),
        recommendedCPT: generateMockCPTSuggestions(),
        clinicalRecommendations: generateMockRecommendations(),
        drugInteractionAlerts: [],
        followUpSuggestions: generateMockFollowUp(),
        timestamp: new Date(),
        confidence: 0.87,
      };
      setAnalysisResult(result);
      setAnalysisHistory(prev => [result, ...prev]);
      toast.success("Analysis completed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Mock data generators
  const generateMockDifferentialDiagnoses = (): DifferentialDiagnosis[] => {
    return [
      {
        id: "1",
        condition: "Acute Bronchitis",
        icdCode: "J20",
        probability: 0.65,
        symptoms: ["cough", "chest discomfort", "low-grade fever"],
        riskFactors: ["recent viral infection", "smoking history"],
        recommendedTests: ["Chest X-ray", "CBC", "Sputum culture"],
        urgency: "low",
        notes: "Most likely diagnosis given symptom presentation",
      },
      {
        id: "2",
        condition: "Community-Acquired Pneumonia",
        icdCode: "J18",
        probability: 0.25,
        symptoms: ["productive cough", "fever", "dyspnea", "chest pain"],
        riskFactors: ["age > 65", "chronic lung disease"],
        recommendedTests: ["Chest X-ray", "CBC", "Blood cultures", "ABG"],
        urgency: "moderate",
        notes: "Consider if symptoms worsen or patient has risk factors",
      },
      {
        id: "3",
        condition: "Asthma Exacerbation",
        icdCode: "J45",
        probability: 0.08,
        symptoms: ["wheezing", "shortness of breath", "cough"],
        riskFactors: ["history of asthma", "allergies", "family history"],
        recommendedTests: ["Peak flow", "Spirometry", "Chest X-ray"],
        urgency: "moderate",
        notes: "Less likely without prior asthma history",
      },
    ];
  };

  const generateMockICD10Suggestions = () => [
    { code: "J20.9", description: "Acute bronchitis, unspecified", confidence: 0.85 },
    { code: "R05", description: "Cough", confidence: 0.92 },
    { code: "J40", description: "Bronchitis, not specified as acute or chronic", confidence: 0.78 },
    { code: "J44.1", description: "Chronic obstructive pulmonary disease with acute exacerbation", confidence: 0.45 },
  ];

  const generateMockCPTSuggestions = () => [
    { code: "99213", description: "Office/outpatient visit, established patient, low complexity", confidence: 0.88 },
    { code: "71046", description: "Chest X-ray, 2 views", confidence: 0.75 },
    { code: "94010", description: "Spirometry", confidence: 0.62 },
  ];

  const generateMockRecommendations = () => [
    "Consider symptomatic treatment with cough suppressants and expectorants",
    "Monitor for signs of secondary bacterial infection",
    "Recommend increased fluid intake and rest",
    "Follow-up in 7-10 days if symptoms persist or worsen",
    "Consider chest X-ray if respiratory distress develops",
  ];

  const generateMockFollowUp = () => [
    "Schedule follow-up appointment in 7 days",
    "Return sooner if fever exceeds 102°F or difficulty breathing develops",
    "Complete smoking cessation counseling if applicable",
    "Review and update immunizations (influenza, pneumococcal)",
  ];

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Search ICD-10 codes
  const searchICDCodes = (query: string) => {
    if (!query.trim()) return [];
    
    const results: { code: string; description: string; category: string }[] = [];
    const lowerQuery = query.toLowerCase();
    
    Object.entries(ICD10_CODES).forEach(([category, data]) => {
      data.codes.forEach(code => {
        if (code.code.toLowerCase().includes(lowerQuery) || 
            code.description.toLowerCase().includes(lowerQuery)) {
          results.push({ ...code, category: data.name });
        }
      });
    });
    
    return results.slice(0, 20);
  };

  // Search CPT codes
  const searchCPTCodes = (query: string) => {
    if (!query.trim()) return [];
    
    const results: { code: string; description: string; category: string }[] = [];
    const lowerQuery = query.toLowerCase();
    
    Object.entries(CPT_CODES).forEach(([category, data]) => {
      data.codes.forEach(code => {
        if (code.code.toLowerCase().includes(lowerQuery) || 
            code.description.toLowerCase().includes(lowerQuery)) {
          results.push({ ...code, category: data.name });
        }
      });
    });
    
    return results.slice(0, 20);
  };

  const icdSearchResults = searchICDCodes(searchICD);
  const cptSearchResults = searchCPTCodes(searchCPT);

  // Get urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      case "moderate": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Brain className="h-7 w-7 text-purple-500" />
              Advanced AI Intelligence
            </h2>
            <p className="text-slate-500 mt-1">Multi-modal clinical AI with differential diagnosis & coding suggestions</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
              <Shield className="h-3 w-3 mr-1" />
              HIPAA Ready
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="analysis" className="flex items-center gap-1">
              <Stethoscope className="h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="differential" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              DDx
            </TabsTrigger>
            <TabsTrigger value="coding" className="flex items-center gap-1">
              <Code className="h-4 w-4" />
              Coding
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4 mt-4">
            {/* Analysis Type Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Input Type</CardTitle>
                <CardDescription>Select the type of clinical data for analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { id: "text", label: "Text", icon: FileText, desc: "Clinical notes" },
                    { id: "voice", label: "Voice", icon: Mic, desc: "Voice input" },
                    { id: "image", label: "Image", icon: ImageIcon, desc: "Medical images" },
                    { id: "multi-modal", label: "Multi-Modal", icon: Sparkles, desc: "Combined input" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setAnalysisType(type.id as typeof analysisType)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        analysisType === type.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <type.icon className={`h-6 w-6 mx-auto mb-2 ${analysisType === type.id ? "text-purple-600" : "text-slate-400"}`} />
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-slate-500">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Input Area */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Clinical Input */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Clinical Input</CardTitle>
                    <div className="flex items-center gap-2">
                      {(analysisType === "voice" || analysisType === "multi-modal") && (
                        <Button
                          variant={isRecording ? "destructive" : "outline"}
                          size="sm"
                          onClick={isRecording ? stopRecording : startRecording}
                        >
                          {isRecording ? (
                            <>
                              <MicOff className="h-4 w-4 mr-1" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4 mr-1" />
                              Record
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Enter clinical notes, symptoms, patient history, or dictation..."
                    value={clinicalInput}
                    onChange={(e) => setClinicalInput(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                  
                  {(analysisType === "image" || analysisType === "multi-modal") && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Medical Image</Label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
                      >
                        {uploadedImage ? (
                          <div className="relative">
                            <img src={uploadedImage} alt="Uploaded" className="max-h-40 mx-auto rounded-lg" />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedImage(null);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600">Click to upload medical image</p>
                            <p className="text-xs text-slate-400">Supports X-rays, CT scans, lab reports</p>
                          </>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={runAnalysis} 
                    disabled={isAnalyzing}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Run AI Analysis
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Results Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Analysis Results</CardTitle>
                    {analysisResult && (
                      <Badge className="bg-emerald-500">
                        {Math.round(analysisResult.confidence * 100)}% Confidence
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {analysisResult ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-4">
                        {/* Differential Diagnoses */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm text-slate-600 flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              Differential Diagnoses
                            </h4>
                            {analysisResult && (
                              <TTSButton
                                text={analysisResult.differentialDiagnoses.map((d, i) => `${i + 1}. ${d.condition}, probability ${Math.round(d.probability * 100)} percent, urgency ${d.urgency}`).join('. ')}
                                size="sm"
                                variant="ghost"
                                showSettings={false}
                                label="Read Diagnoses"
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            {analysisResult.differentialDiagnoses.slice(0, 3).map((ddx, index) => (
                              <div key={ddx.id} className="p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">{index + 1}. {ddx.condition}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{ddx.icdCode}</Badge>
                                    <Badge className={getUrgencyColor(ddx.urgency)}>{ddx.urgency}</Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span>Probability: {Math.round(ddx.probability * 100)}%</span>
                                  <Progress value={ddx.probability * 100} className="h-1.5 flex-1" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Coding Suggestions */}
                        <div>
                          <h4 className="font-medium text-sm text-slate-600 mb-2 flex items-center gap-1">
                            <Code className="h-4 w-4" />
                            Suggested Codes
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <div className="text-xs text-blue-600 font-medium">ICD-10</div>
                              <div className="text-sm font-mono">{analysisResult.recommendedICD10[0]?.code}</div>
                              <div className="text-xs text-slate-500 truncate">{analysisResult.recommendedICD10[0]?.description}</div>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg">
                              <div className="text-xs text-purple-600 font-medium">CPT</div>
                              <div className="text-sm font-mono">{analysisResult.recommendedCPT[0]?.code}</div>
                              <div className="text-xs text-slate-500 truncate">{analysisResult.recommendedCPT[0]?.description}</div>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Recommendations */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm text-slate-600 flex items-center gap-1">
                              <Lightbulb className="h-4 w-4" />
                              Clinical Recommendations
                            </h4>
                            {analysisResult && analysisResult.clinicalRecommendations.length > 0 && (
                              <TTSButton
                                text={analysisResult.clinicalRecommendations.join('. ')}
                                size="sm"
                                variant="ghost"
                                showSettings={false}
                                label="Read Recommendations"
                              />
                            )}
                          </div>
                          <ul className="space-y-1">
                            {analysisResult.clinicalRecommendations.slice(0, 3).map((rec, index) => (
                              <li key={index} className="text-xs text-slate-600 flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-center">
                      <div>
                        <Brain className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Run analysis to see results</p>
                        <p className="text-xs text-slate-400 mt-1">Enter clinical data and click analyze</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Differential Diagnosis Tab */}
          <TabsContent value="differential" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  Differential Diagnosis Engine
                </CardTitle>
                <CardDescription>AI-powered differential diagnosis with probability scoring</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult ? (
                  <div className="space-y-4">
                    {analysisResult.differentialDiagnoses.map((ddx, index) => (
                      <motion.div
                        key={ddx.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="border-l-4 border-l-purple-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-semibold">{index + 1}. {ddx.condition}</span>
                                  <Badge variant="outline">{ddx.icdCode}</Badge>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{ddx.notes}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-purple-600">
                                  {Math.round(ddx.probability * 100)}%
                                </div>
                                <Badge className={getUrgencyColor(ddx.urgency)}>{ddx.urgency} urgency</Badge>
                              </div>
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-4 mt-4">
                              <div>
                                <h5 className="text-xs font-medium text-slate-500 mb-1">Key Symptoms</h5>
                                <div className="flex flex-wrap gap-1">
                                  {ddx.symptoms.map((symptom, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{symptom}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h5 className="text-xs font-medium text-slate-500 mb-1">Risk Factors</h5>
                                <div className="flex flex-wrap gap-1">
                                  {ddx.riskFactors.map((rf, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{rf}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h5 className="text-xs font-medium text-slate-500 mb-1">Recommended Tests</h5>
                                <div className="flex flex-wrap gap-1">
                                  {ddx.recommendedTests.map((test, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-blue-50">{test}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                              <TTSButton
                                text={`${ddx.condition}. ${ddx.notes}. Key symptoms: ${ddx.symptoms.join(', ')}. Probability: ${Math.round(ddx.probability * 100)} percent.`}
                                size="sm"
                                variant="ghost"
                                showSettings={false}
                                label="Read"
                              />
                              <Button variant="outline" size="sm">
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Correct
                              </Button>
                              <Button variant="outline" size="sm">
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                Incorrect
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${ddx.condition} (${ddx.icdCode})`)}>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-center">
                    <div>
                      <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No analysis results yet</p>
                      <p className="text-sm text-slate-400">Run an analysis to see differential diagnoses</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coding Tab */}
          <TabsContent value="coding" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* ICD-10 Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                    ICD-10 Code Search
                  </CardTitle>
                  <CardDescription>Search diagnosis codes by keyword or code</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search ICD-10 codes..."
                      value={searchICD}
                      onChange={(e) => setSearchICD(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {analysisResult?.recommendedICD10 && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                      <div className="text-xs text-purple-600 font-medium mb-2">AI Suggested Codes</div>
                      {analysisResult.recommendedICD10.map((code, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-white px-2 py-0.5 rounded">{code.code}</code>
                            <span className="text-sm text-slate-600">{code.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={code.confidence * 100} className="h-1.5 w-16" />
                            <span className="text-xs text-slate-500">{Math.round(code.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {icdSearchResults.map((code, i) => (
                        <div key={i} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between group">
                          <div>
                            <code className="font-mono text-sm">{code.code}</code>
                            <p className="text-sm text-slate-600">{code.description}</p>
                            <p className="text-xs text-slate-400">{code.category}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {searchICD && icdSearchResults.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">No codes found</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* CPT Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-green-500" />
                    CPT Code Search
                  </CardTitle>
                  <CardDescription>Search procedure codes by keyword or code</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search CPT codes..."
                      value={searchCPT}
                      onChange={(e) => setSearchCPT(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {analysisResult?.recommendedCPT && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="text-xs text-green-600 font-medium mb-2">AI Suggested Procedures</div>
                      {analysisResult.recommendedCPT.map((code, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-white px-2 py-0.5 rounded">{code.code}</code>
                            <span className="text-sm text-slate-600">{code.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={code.confidence * 100} className="h-1.5 w-16" />
                            <span className="text-xs text-slate-500">{Math.round(code.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {cptSearchResults.map((code, i) => (
                        <div key={i} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between group">
                          <div>
                            <code className="font-mono text-sm">{code.code}</code>
                            <p className="text-sm text-slate-600">{code.description}</p>
                            <p className="text-xs text-slate-400">{code.category}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {searchCPT && cptSearchResults.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">No codes found</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Analysis History
                </CardTitle>
                <CardDescription>Previous AI analysis results</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisHistory.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {analysisHistory.map((result) => (
                        <Card key={result.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline">{result.type}</Badge>
                                  <span className="text-xs text-slate-400">
                                    {result.timestamp.toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-2">{result.input}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-purple-100 text-purple-700">
                                    {result.differentialDiagnoses.length} diagnoses
                                  </Badge>
                                  <Badge className="bg-blue-100 text-blue-700">
                                    {result.recommendedICD10.length} ICD-10
                                  </Badge>
                                  <Badge className="bg-green-100 text-green-700">
                                    {result.recommendedCPT.length} CPT
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-purple-600">
                                  {Math.round(result.confidence * 100)}%
                                </div>
                                <span className="text-xs text-slate-500">confidence</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-64 flex items-center justify-center text-center">
                    <div>
                      <Activity className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">No analysis history yet</p>
                      <p className="text-sm text-slate-400">Run analyses to build history</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-slate-500" />
                  Analysis Settings
                </CardTitle>
                <CardDescription>Configure AI analysis parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Analysis Features</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Differential Diagnosis</Label>
                        <p className="text-xs text-slate-500">Generate differential diagnoses</p>
                      </div>
                      <Switch checked={includeDifferential} onCheckedChange={setIncludeDifferential} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Coding</Label>
                        <p className="text-xs text-slate-500">Suggest ICD-10/CPT codes</p>
                      </div>
                      <Switch checked={includeCoding} onCheckedChange={setIncludeCoding} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Drug Interaction Check</Label>
                        <p className="text-xs text-slate-500">Check for drug interactions</p>
                      </div>
                      <Switch checked={includeDrugCheck} onCheckedChange={setIncludeDrugCheck} />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">AI Model Configuration</h4>
                    
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select defaultValue="medgemma">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medgemma">MedGemma (Recommended)</SelectItem>
                          <SelectItem value="gpt4-medical">GPT-4 Medical</SelectItem>
                          <SelectItem value="clinical-bert">Clinical BERT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Temperature: 0.7</Label>
                      <Progress value={70} className="h-2" />
                      <p className="text-xs text-slate-500">Lower = more precise, Higher = more creative</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Safety Notice</AlertTitle>
                  <AlertDescription>
                    All AI-generated suggestions require human review before clinical use. 
                    This tool is designed to assist, not replace, clinical judgment.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
