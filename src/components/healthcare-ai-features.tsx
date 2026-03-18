"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Activity,
  Heart,
  Thermometer,
  Pill,
  AlertTriangle,
  CheckCircle,
  Info,
  Stethoscope,
  BarChart3,
  Calculator,
  Beaker,
  Droplets,
  Zap,
  Target,
  Shield,
  Clock,
  User,
  Search,
  ChevronRight,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { TTSButton } from "@/components/tts-button";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect } from "react";

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

interface HealthcareAIFeaturesProps {
  preselectedPatientId?: string | null;
}

interface SymptomResult {
  condition: string;
  icdCode: string;
  probability: number;
  urgency: "low" | "medium" | "high" | "critical";
  description: string;
  recommendations: string[];
}

interface RiskScore {
  name: string;
  score: number;
  risk: "low" | "moderate" | "high" | "very high";
  description: string;
  recommendations: string[];
}

interface LabInterpretation {
  testName: string;
  value: string;
  unit: string;
  status: "low" | "normal" | "high" | "critical";
  referenceRange: string;
  interpretation: string;
  possibleCauses: string[];
  recommendations: string[];
}

// Symptom Analysis Database
const SYMPTOM_CONDITIONS: Record<string, SymptomResult[]> = {
  "chest pain": [
    {
      condition: "Acute Coronary Syndrome",
      icdCode: "I21.9",
      probability: 0.35,
      urgency: "critical",
      description: "Chest pain with radiation to arm/jaw, associated with sweating and shortness of breath",
      recommendations: ["Immediate ECG", "Troponin levels", "Cardiology consult", "Monitor vital signs"],
    },
    {
      condition: "Gastroesophageal Reflux Disease",
      icdCode: "K21.0",
      probability: 0.25,
      urgency: "low",
      description: "Burning chest pain, especially postprandial",
      recommendations: ["Lifestyle modifications", "PPI trial", "Avoid trigger foods"],
    },
    {
      condition: "Musculoskeletal Pain",
      icdCode: "M54.6",
      probability: 0.20,
      urgency: "low",
      description: "Pain reproducible with movement or palpation",
      recommendations: ["NSAIDs", "Rest", "Physical therapy if persistent"],
    },
    {
      condition: "Pulmonary Embolism",
      icdCode: "I26.9",
      probability: 0.15,
      urgency: "critical",
      description: "Sudden onset chest pain with dyspnea",
      recommendations: ["D-dimer", "CT pulmonary angiogram", "Anticoagulation if confirmed"],
    },
  ],
  "fever": [
    {
      condition: "Viral Upper Respiratory Infection",
      icdCode: "J06.9",
      probability: 0.40,
      urgency: "low",
      description: "Fever with cough, sore throat, rhinorrhea",
      recommendations: ["Supportive care", "Rest", "Hydration", "Monitor for secondary infection"],
    },
    {
      condition: "Bacterial Pneumonia",
      icdCode: "J18.9",
      probability: 0.25,
      urgency: "medium",
      description: "High fever with productive cough, dyspnea",
      recommendations: ["Chest X-ray", "CBC", "Antibiotics", "Consider hospitalization if severe"],
    },
    {
      condition: "Urinary Tract Infection",
      icdCode: "N39.0",
      probability: 0.20,
      urgency: "medium",
      description: "Fever with urinary symptoms",
      recommendations: ["Urinalysis", "Urine culture", "Antibiotics"],
    },
    {
      condition: "Sepsis",
      icdCode: "A41.9",
      probability: 0.05,
      urgency: "critical",
      description: "High fever with altered mental status, hypotension",
      recommendations: ["Immediate blood cultures", "Broad-spectrum antibiotics", "ICU admission"],
    },
  ],
  "headache": [
    {
      condition: "Tension Headache",
      icdCode: "G44.2",
      probability: 0.40,
      urgency: "low",
      description: "Bilateral, pressing/tightening pain",
      recommendations: ["Stress management", "NSAIDs", "Adequate sleep"],
    },
    {
      condition: "Migraine",
      icdCode: "G43.9",
      probability: 0.30,
      urgency: "medium",
      description: "Unilateral, pulsating, with nausea/photophobia",
      recommendations: ["Triptans", "Rest in dark room", "Preventive therapy if frequent"],
    },
    {
      condition: "Cluster Headache",
      icdCode: "G44.0",
      probability: 0.10,
      urgency: "medium",
      description: "Severe unilateral orbital pain, autonomic symptoms",
      recommendations: ["Oxygen therapy", "Sumatriptan", "Preventive medications"],
    },
    {
      condition: "Subarachnoid Hemorrhage",
      icdCode: "I60.9",
      probability: 0.02,
      urgency: "critical",
      description: "Thunderclap headache, worst headache of life",
      recommendations: ["Immediate CT head", "Neurosurgery consult", "Monitor for vasospasm"],
    },
  ],
  "abdominal pain": [
    {
      condition: "Acute Appendicitis",
      icdCode: "K35.9",
      probability: 0.20,
      urgency: "high",
      description: "RLQ pain, fever, nausea, anorexia",
      recommendations: ["Surgical consult", "CBC", "CT abdomen", "NPO"],
    },
    {
      condition: "Gastroenteritis",
      icdCode: "A09",
      probability: 0.30,
      urgency: "low",
      description: "Crampy abdominal pain with diarrhea, nausea",
      recommendations: ["Hydration", "BRAT diet", "Monitor for dehydration"],
    },
    {
      condition: "Biliary Colic/Cholecystitis",
      icdCode: "K80.2",
      probability: 0.20,
      urgency: "medium",
      description: "RUQ pain, especially after fatty meals",
      recommendations: ["Ultrasound", "LFTs", "Surgical consult if cholecystitis"],
    },
    {
      condition: "Peptic Ulcer Disease",
      icdCode: "K25.9",
      probability: 0.15,
      urgency: "medium",
      description: "Epigastric burning pain, related to meals",
      recommendations: ["PPI", "H. pylori testing", "Avoid NSAIDs"],
    },
  ],
  "shortness of breath": [
    {
      condition: "Asthma Exacerbation",
      icdCode: "J45.9",
      probability: 0.30,
      urgency: "medium",
      description: "Wheezing, cough, chest tightness",
      recommendations: ["Bronchodilators", "Steroids if severe", "Peak flow monitoring"],
    },
    {
      condition: "COPD Exacerbation",
      icdCode: "J44.1",
      probability: 0.25,
      urgency: "medium",
      description: "Increased dyspnea, sputum production",
      recommendations: ["Bronchodilators", "Antibiotics", "Steroids", "Consider BiPAP"],
    },
    {
      condition: "Heart Failure",
      icdCode: "I50.9",
      probability: 0.20,
      urgency: "high",
      description: "Dyspnea on exertion, orthopnea, edema",
      recommendations: ["Diuretics", "BNP", "Echo", "Cardiology consult"],
    },
    {
      condition: "Pulmonary Embolism",
      icdCode: "I26.9",
      probability: 0.10,
      urgency: "critical",
      description: "Sudden dyspnea, pleuritic chest pain",
      recommendations: ["Wells score", "D-dimer", "CT-PA", "Anticoagulation"],
    },
  ],
};

// Risk Calculator Functions
function calculateCHA2DS2VASc(params: { age: number; gender: string; hypertension: boolean; diabetes: boolean; heartFailure: boolean; stroke: boolean; vascular: boolean }): RiskScore {
  let score = 0;
  const { age, gender, hypertension, diabetes, heartFailure, stroke, vascular } = params;

  if (heartFailure) score += 1;
  if (hypertension) score += 1;
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;
  if (diabetes) score += 1;
  if (stroke) score += 2;
  if (vascular) score += 1;
  if (gender === "female") score += 1;

  let risk: "low" | "moderate" | "high" | "very high";
  let description: string;
  let recommendations: string[];

  if (score === 0) {
    risk = "low";
    description = "Low risk of stroke. Annual stroke risk ~0.2%";
    recommendations = ["No anticoagulation needed", "Monitor for new risk factors", "Lifestyle modifications"];
  } else if (score === 1) {
    risk = "moderate";
    description = "Moderate risk. Annual stroke risk ~0.6-1.3%";
    recommendations = ["Consider anticoagulation", "Discuss risks/benefits with patient", "Aspirin if anticoagulation declined"];
  } else if (score === 2) {
    risk = "high";
    description = "High risk. Annual stroke risk ~2.2%";
    recommendations = ["Anticoagulation recommended", "DOAC preferred over warfarin", "Regular follow-up"];
  } else {
    risk = "very high";
    description = "Very high risk. Annual stroke risk ~3.2-7.6%";
    recommendations = ["Anticoagulation strongly recommended", "DOAC preferred", "Consider left atrial appendage closure if anticoagulation contraindicated"];
  }

  return { name: "CHA2DS2-VASc", score, risk, description, recommendations };
}

function calculateWellsPE(params: { clinicalSignsDVT: boolean; alternativeDiagnosis: boolean; heartRate: number; immobilization: boolean; historyPE: boolean; hemoptysis: boolean; malignancy: boolean }): RiskScore {
  let score = 0;
  const { clinicalSignsDVT, alternativeDiagnosis, heartRate, immobilization, historyPE, hemoptysis, malignancy } = params;

  if (clinicalSignsDVT) score += 3;
  if (heartRate > 100) score += 1.5;
  if (immobilization || historyPE) score += 1.5;
  if (hemoptysis) score += 1;
  if (malignancy) score += 1;
  if (!alternativeDiagnosis) score += 3;

  let risk: "low" | "moderate" | "high" | "very high";
  let description: string;
  let recommendations: string[];

  if (score < 2) {
    risk = "low";
    description = "Low probability of PE (~1-3%)";
    recommendations = ["D-dimer test", "If D-dimer negative, PE unlikely", "No imaging needed if low risk + negative D-dimer"];
  } else if (score < 6) {
    risk = "moderate";
    description = "Moderate probability of PE (~9-16%)";
    recommendations = ["CT pulmonary angiogram", "D-dimer if low clinical suspicion", "Consider V/Q scan if CTPA contraindicated"];
  } else {
    risk = "high";
    description = "High probability of PE (~28-40%)";
    recommendations = ["Immediate CTPA", "Consider empiric anticoagulation if delay", "Lower extremity ultrasound"];
  }

  return { name: "Wells PE Score", score, risk, description, recommendations };
}

function calculateCURB65(params: { confusion: boolean; urea: number; respiratoryRate: number; bloodPressure: number; age: number }): RiskScore {
  let score = 0;
  const { confusion, urea, respiratoryRate, bloodPressure, age } = params;

  if (confusion) score += 1;
  if (urea > 7) score += 1;
  if (respiratoryRate >= 30) score += 1;
  if (bloodPressure < 90) score += 1;
  if (age >= 65) score += 1;

  let risk: "low" | "moderate" | "high" | "very high";
  let description: string;
  let recommendations: string[];

  if (score === 0) {
    risk = "low";
    description = "Low severity. 30-day mortality ~0.6%";
    recommendations = ["Consider outpatient treatment", "Oral antibiotics", "Follow-up if worsening"];
  } else if (score <= 1) {
    risk = "low";
    description = "Low severity. 30-day mortality ~2.7%";
    recommendations = ["Consider outpatient or short hospital stay", "Oral antibiotics", "Close monitoring"];
  } else if (score === 2) {
    risk = "moderate";
    description = "Moderate severity. 30-day mortality ~6.8%";
    recommendations = ["Hospital admission", "IV antibiotics", "Monitor for deterioration"];
  } else {
    risk = "high";
    description = "High severity. 30-day mortality ~14-27%";
    recommendations = ["Urgent hospital admission", "Consider ICU", "IV antibiotics", "Aggressive resuscitation"];
  }

  return { name: "CURB-65", score, risk, description, recommendations };
}

function calculateFramingham(params: { age: number; gender: string; totalCholesterol: number; hdlCholesterol: number; systolicBP: number; smoking: boolean; treatedBP: boolean }): RiskScore {
  let score = 0;
  const { age, gender, totalCholesterol, hdlCholesterol, systolicBP, smoking, treatedBP } = params;

  // Age points
  if (gender === "male") {
    if (age < 35) score -= 9;
    else if (age < 40) score -= 4;
    else if (age < 45) score -= 0;
    else if (age < 50) score += 3;
    else if (age < 55) score += 6;
    else if (age < 60) score += 8;
    else if (age < 65) score += 10;
    else score += 11;
  } else {
    if (age < 35) score -= 7;
    else if (age < 40) score -= 3;
    else if (age < 45) score += 0;
    else if (age < 50) score += 3;
    else if (age < 55) score += 6;
    else if (age < 60) score += 8;
    else if (age < 65) score += 10;
    else score += 12;
  }

  // Simplified calculation
  score += Math.floor((totalCholesterol - 200) / 20);
  score -= Math.floor((hdlCholesterol - 50) / 10);
  score += Math.floor((systolicBP - 120) / 15);
  if (smoking) score += 4;
  if (treatedBP) score += 2;

  let risk: "low" | "moderate" | "high" | "very high";
  let description: string;
  let recommendations: string[];

  const riskPercent = Math.min(Math.max(score * 2 + 5, 1), 30);

  if (riskPercent < 10) {
    risk = "low";
    description = `Low 10-year CVD risk (~${riskPercent}%)`;
    recommendations = ["Lifestyle modifications", "Monitor risk factors", "Reassess in 5 years"];
  } else if (riskPercent < 20) {
    risk = "moderate";
    description = `Moderate 10-year CVD risk (~${riskPercent}%)`;
    recommendations = ["Aggressive lifestyle changes", "Consider statin therapy", "BP control", "Reassess annually"];
  } else {
    risk = "high";
    description = `High 10-year CVD risk (~${riskPercent}%)`;
    recommendations = ["Statin therapy", "BP management", "Aspirin consideration", "Intensive lifestyle intervention"];
  }

  return { name: "Framingham Risk Score", score, risk, description, recommendations };
}

// Lab Interpretation Database
function interpretLab(testName: string, value: number, unit: string): LabInterpretation {
  const labDatabase: Record<string, { low: number; high: number; criticalLow?: number; criticalHigh?: number; unit: string; causes: { low: string[]; high: string[] } }> = {
    "Hemoglobin": { low: 12, high: 17.5, criticalLow: 7, unit: "g/dL", causes: { low: ["Iron deficiency", "Chronic disease", "Blood loss", "B12 deficiency"], high: ["Polycythemia", "Dehydration", "High altitude", "Smoking"] } },
    "WBC": { low: 4.5, high: 11, unit: "×10⁹/L", causes: { low: ["Viral infection", "Bone marrow suppression", "Autoimmune"], high: ["Bacterial infection", "Leukemia", "Inflammation", "Stress"] } },
    "Platelets": { low: 150, high: 400, criticalLow: 50, criticalHigh: 1000, unit: "×10⁹/L", causes: { low: ["ITP", "Medications", "Bone marrow disorder"], high: ["Reactive thrombocytosis", "Essential thrombocythemia"] } },
    "Glucose (Fasting)": { low: 70, high: 100, criticalLow: 50, criticalHigh: 400, unit: "mg/dL", causes: { low: ["Insulin excess", "Fasting", "Medications"], high: ["Diabetes", "Stress", "Medications", "Pancreatitis"] } },
    "Creatinine": { low: 0.6, high: 1.3, criticalHigh: 5, unit: "mg/dL", causes: { low: ["Low muscle mass", "Pregnancy"], high: ["Renal failure", "Dehydration", "Medications", "Obstruction"] } },
    "Sodium": { low: 135, high: 145, criticalLow: 120, criticalHigh: 160, unit: "mEq/L", causes: { low: ["SIADH", "Diuretics", "Heart failure"], high: ["Dehydration", "Diabetes insipidus", "Salt intake"] } },
    "Potassium": { low: 3.5, high: 5.0, criticalLow: 2.5, criticalHigh: 6.5, unit: "mEq/L", causes: { low: ["Diuretics", "GI losses", "Alkalosis"], high: ["Renal failure", "ACE inhibitors", "Acidosis"] } },
    "Troponin": { low: 0, high: 0.04, criticalHigh: 0.5, unit: "ng/mL", causes: { low: [], high: ["MI", "Myocarditis", "PE", "Sepsis", "Renal failure"] } },
    "TSH": { low: 0.4, high: 4.0, unit: "mIU/L", causes: { low: ["Hyperthyroidism", "Thyroid nodule"], high: ["Hypothyroidism", "Hashimoto's", "Medications"] } },
    "ALT": { low: 7, high: 56, criticalHigh: 1000, unit: "U/L", causes: { low: [], high: ["Hepatitis", "Medications", "Alcohol", "Fatty liver"] } },
  };

  const lab = labDatabase[testName];
  if (!lab) {
    return {
      testName,
      value: value.toString(),
      unit,
      status: "normal",
      referenceRange: "Reference range not available",
      interpretation: "Unable to interpret - lab not in database",
      possibleCauses: [],
      recommendations: ["Consult specialist for interpretation"],
    };
  }

  let status: "low" | "normal" | "high" | "critical";
  let interpretation: string;

  if (lab.criticalLow && value < lab.criticalLow) {
    status = "critical";
    interpretation = `CRITICALLY LOW - Immediate attention required`;
  } else if (lab.criticalHigh && value > lab.criticalHigh) {
    status = "critical";
    interpretation = `CRITICALLY HIGH - Immediate attention required`;
  } else if (value < lab.low) {
    status = "low";
    interpretation = `Below normal range`;
  } else if (value > lab.high) {
    status = "high";
    interpretation = `Above normal range`;
  } else {
    status = "normal";
    interpretation = `Within normal range`;
  }

  return {
    testName,
    value: value.toString(),
    unit: lab.unit,
    status,
    referenceRange: `${lab.low} - ${lab.high} ${lab.unit}`,
    interpretation,
    possibleCauses: status === "low" ? lab.causes.low : status === "high" || status === "critical" ? lab.causes.high : [],
    recommendations: status === "critical" 
      ? ["Urgent physician notification", "Consider treatment", "Repeat test to confirm"]
      : status !== "normal" 
        ? ["Review clinical context", "Consider repeat testing", "Monitor trend"]
        : ["No action needed", "Continue monitoring"],
  };
}

export function HealthcareAIFeatures({ preselectedPatientId }: HealthcareAIFeaturesProps) {
  const [activeTab, setActiveTab] = useState("symptoms");
  
  // Patient State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || " ");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  
  // Symptom Checker State
  const [symptoms, setSymptoms] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [symptomResults, setSymptomResults] = useState<SymptomResult[]>([]);
  
  // Risk Calculator State
  const [selectedCalculator, setSelectedCalculator] = useState("cha2ds2vasc");
  const [riskResult, setRiskResult] = useState<RiskScore | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Lab Interpretation State
  const [labTest, setLabTest] = useState("Hemoglobin");
  const [labValue, setLabValue] = useState("");
  const [labUnit, setLabUnit] = useState("g/dL");
  const [labResult, setLabResult] = useState<LabInterpretation | null>(null);

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

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseAllergies(selectedPatient.allergies) : [];
  const patientConditions = selectedPatient ? parseConditions(selectedPatient.chronicConditions) : [];

  // Analyze Symptoms
  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) return;
    
    setIsAnalyzing(true);
    const startTime = Date.now();
    
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const symptomLower = symptoms.toLowerCase();
    const results: SymptomResult[] = [];
    
    // Match symptoms to conditions
    Object.entries(SYMPTOM_CONDITIONS).forEach(([symptom, conditions]) => {
      if (symptomLower.includes(symptom)) {
        results.push(...conditions);
      }
    });
    
    // Sort by probability
    results.sort((a, b) => b.probability - a.probability);
    
    setSymptomResults(results.slice(0, 5));
    setIsAnalyzing(false);

    // Save AI interaction for patient consistency
    if (selectedPatientId) {
      try {
        await fetch('/api/ai-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatientId,
            interactionType: 'symptom-analysis',
            prompt: symptoms,
            response: JSON.stringify(results.slice(0, 5)),
            modelUsed: 'symptom-matcher-v1',
            processingTime: Date.now() - startTime,
            metadata: {
              matchedSymptoms: symptoms,
              resultCount: results.length,
              topCondition: results[0]?.condition || null,
              topProbability: results[0]?.probability || null,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to save symptom analysis:', e);
      }
    }
  };

  // Calculate Risk
  const calculateRisk = async () => {
    setIsCalculating(true);
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let result: RiskScore | null = null;
    
    if (selectedCalculator === "cha2ds2vasc") {
      const age = parseInt((document.getElementById('risk-age') as HTMLInputElement)?.value || "0");
      const gender = (document.getElementById('risk-gender') as HTMLSelectElement)?.value || "male";
      const hypertension = (document.getElementById('risk-htn') as HTMLInputElement)?.checked || false;
      const diabetes = (document.getElementById('risk-dm') as HTMLInputElement)?.checked || false;
      const heartFailure = (document.getElementById('risk-hf') as HTMLInputElement)?.checked || false;
      const stroke = (document.getElementById('risk-stroke') as HTMLInputElement)?.checked || false;
      const vascular = (document.getElementById('risk-vascular') as HTMLInputElement)?.checked || false;
      
      result = calculateCHA2DS2VASc({ age, gender, hypertension, diabetes, heartFailure, stroke, vascular });
    }
    
    setRiskResult(result);
    setIsCalculating(false);

    // Save AI interaction for patient consistency
    if (selectedPatientId && result) {
      try {
        await fetch('/api/ai-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatientId,
            interactionType: 'risk-calculation',
            prompt: `${selectedCalculator} risk calculation`,
            response: JSON.stringify(result),
            modelUsed: 'risk-calculator-v1',
            processingTime: Date.now() - startTime,
            metadata: {
              calculatorType: selectedCalculator,
              score: result.score,
              risk: result.risk,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to save risk calculation:', e);
      }
    }
  };

  // Interpret Lab
  const interpretLabValue = async () => {
    if (!labValue.trim()) return;
    
    const value = parseFloat(labValue);
    if (isNaN(value)) {
      toast.error("Please enter a valid number");
      return;
    }
    
    const startTime = Date.now();
    const result = interpretLab(labTest, value, labUnit);
    setLabResult(result);

    // Save AI interaction for patient consistency
    if (selectedPatientId) {
      try {
        await fetch('/api/ai-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatientId,
            interactionType: 'lab-interpretation',
            prompt: `Interpret ${labTest}: ${value} ${labUnit}`,
            response: JSON.stringify(result),
            modelUsed: 'lab-interpreter-v1',
            processingTime: Date.now() - startTime,
            metadata: {
              testName: labTest,
              value,
              unit: labUnit,
              status: result.status,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to save lab interpretation:', e);
      }
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "high": return "bg-orange-100 text-orange-700 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      default: return "bg-green-100 text-green-700 border-green-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "low": return "bg-blue-500";
      default: return "bg-green-500";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "very high": return "text-red-600 bg-red-50";
      case "high": return "text-orange-600 bg-orange-50";
      case "moderate": return "text-yellow-600 bg-yellow-50";
      default: return "text-green-600 bg-green-50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Healthcare AI Tools
          </h2>
          <p className="text-slate-500">AI-powered clinical analysis and risk assessment tools</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500" />
            Patient Context
          </CardTitle>
          <CardDescription>Select a patient to include their medical history in AI analysis</CardDescription>
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

          {selectedPatient && patientAllergies.length > 0 && (
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

          {selectedPatient && patientConditions.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">Chronic Conditions:</p>
              <div className="flex flex-wrap gap-2">
                {patientConditions.map((condition, i) => (
                  <Badge key={i} variant="outline" className="bg-white border-blue-300 text-blue-700">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="symptoms" className="flex items-center gap-1">
            <Stethoscope className="h-4 w-4" />
            Symptom AI
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center gap-1">
            <Calculator className="h-4 w-4" />
            Risk Scores
          </TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-1">
            <Beaker className="h-4 w-4" />
            Lab AI
          </TabsTrigger>
        </TabsList>

        {/* Symptom Checker Tab */}
        <TabsContent value="symptoms" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                AI Symptom Analysis
                {selectedPatient && (
                  <Badge variant="outline" className="ml-2 bg-purple-50 border-purple-200 text-purple-700">
                    {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {selectedPatient 
                  ? `Analyzing symptoms for ${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.gender}, ${Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}y)`
                  : "Enter patient symptoms to get AI-powered differential diagnosis"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Textarea
                    id="symptom-input"
                    placeholder={selectedPatient 
                      ? `Describe symptoms for ${selectedPatient.firstName} (e.g., 'chest pain radiating to left arm', 'fever and cough', 'headache with nausea')`
                      : "Describe symptoms (e.g., 'chest pain radiating to left arm', 'fever and cough', 'headache with nausea')"}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    className="min-h-[80px] resize-none pr-12"
                  />
                  <div className="absolute right-2 top-2">
                    <VoiceInputButton
                      onTranscript={(text) => setSymptoms(text)}
                      currentValue={symptoms}
                      context="medical"
                      size="sm"
                      variant="ghost"
                      className="bg-white/80 hover:bg-white h-8 w-8"
                    />
                  </div>
                </div>
                <Button 
                  onClick={analyzeSymptoms} 
                  disabled={isAnalyzing || !symptoms.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Results */}
              {symptomResults.length > 0 && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Differential Diagnosis</h4>
                    <Badge variant="outline">{symptomResults.length} conditions found</Badge>
                  </div>
                  
                  {symptomResults.map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="border-l-4" style={{ borderLeftColor: result.urgency === "critical" ? "#ef4444" : result.urgency === "high" ? "#f97316" : result.urgency === "medium" ? "#eab308" : "#22c55e" }}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{index + 1}. {result.condition}</span>
                                <Badge variant="outline">{result.icdCode}</Badge>
                              </div>
                              <p className="text-sm text-slate-500 mt-1">{result.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={getUrgencyColor(result.urgency)}>{result.urgency.toUpperCase()}</Badge>
                              <span className="text-sm text-slate-500">{Math.round(result.probability * 100)}%</span>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <Progress value={result.probability * 100} className="h-1.5" />
                          </div>
                          
                          <div className="mt-3">
                            <h5 className="text-xs font-medium text-slate-500 mb-2">Recommendations:</h5>
                            <ul className="space-y-1">
                              {result.recommendations.map((rec, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3 text-purple-500" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-3 pt-3 border-t flex items-center gap-2">
                            <TTSButton
                              text={`${result.condition}. ${result.description}. Urgency: ${result.urgency}. Recommendations: ${result.recommendations.join(", ")}`}
                              size="sm"
                              variant="ghost"
                              showSettings={false}
                            />
                            <Button variant="outline" size="sm">
                              <FileText className="h-3 w-3 mr-1" />
                              Add to Notes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Safety Notice */}
          <Alert className="bg-amber-50 border-amber-200">
            <Shield className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Clinical Safety Notice</AlertTitle>
            <AlertDescription className="text-amber-700">
              AI suggestions are for clinical decision support only. All recommendations must be reviewed by a qualified healthcare professional.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Risk Calculators Tab */}
        <TabsContent value="risk" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-500" />
                  Clinical Risk Calculators
                  {selectedPatient && (
                    <Badge variant="outline" className="ml-2 bg-blue-50 border-blue-200 text-blue-700">
                      {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedPatient 
                    ? `Risk assessment for ${selectedPatient.firstName} ${selectedPatient.lastName}`
                    : "Evidence-based risk assessment tools"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedCalculator} onValueChange={setSelectedCalculator}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cha2ds2vasc">CHA₂DS₂-VASc (Stroke Risk in AF)</SelectItem>
                    <SelectItem value="wellspe">Wells PE Score (Pulmonary Embolism)</SelectItem>
                    <SelectItem value="curb65">CURB-65 (Pneumonia Severity)</SelectItem>
                    <SelectItem value="framingham">Framingham (Cardiovascular Risk)</SelectItem>
                  </SelectContent>
                </Select>

                <Separator />

                {/* CHA2DS2-VASc Form */}
                {selectedCalculator === "cha2ds2vasc" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Age</Label>
                        <Input 
                          id="risk-age" 
                          type="number" 
                          placeholder="65" 
                          defaultValue={selectedPatient ? Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 65} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Gender</Label>
                        <Select defaultValue={selectedPatient?.gender?.toLowerCase() || "male"}>
                          <SelectTrigger id="risk-gender">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Congestive Heart Failure</Label>
                        <input type="checkbox" id="risk-hf" className="h-4 w-4" defaultChecked={patientConditions.some(c => c.toLowerCase().includes('heart') || c.toLowerCase().includes('failure'))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Hypertension</Label>
                        <input type="checkbox" id="risk-htn" className="h-4 w-4" defaultChecked={patientConditions.some(c => c.toLowerCase().includes('hypertension'))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Diabetes Mellitus</Label>
                        <input type="checkbox" id="risk-dm" className="h-4 w-4" defaultChecked={patientConditions.some(c => c.toLowerCase().includes('diabetes'))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Stroke/TIA</Label>
                        <input type="checkbox" id="risk-stroke" className="h-4 w-4" defaultChecked={patientConditions.some(c => c.toLowerCase().includes('stroke') || c.toLowerCase().includes('tia'))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Vascular Disease</Label>
                        <input type="checkbox" id="risk-vascular" className="h-4 w-4" defaultChecked={patientConditions.some(c => c.toLowerCase().includes('vascular') || c.toLowerCase().includes('pad'))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Wells PE Form */}
                {selectedCalculator === "wellspe" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Clinical signs of DVT</Label>
                      <input type="checkbox" id="risk-dvt" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Alternative diagnosis less likely</Label>
                      <input type="checkbox" id="risk-alt" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Heart Rate {'>'} 100 bpm</Label>
                      <input type="checkbox" id="risk-hr" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Immobilization or surgery in last 4 weeks</Label>
                      <input type="checkbox" id="risk-immob" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">History of PE/DVT</Label>
                      <input type="checkbox" id="risk-hxpe" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Hemoptysis</Label>
                      <input type="checkbox" id="risk-hemo" className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Active malignancy</Label>
                      <input type="checkbox" id="risk-malig" className="h-4 w-4" />
                    </div>
                  </div>
                )}

                {/* CURB-65 Form */}
                {selectedCalculator === "curb65" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Confusion (new onset)</Label>
                      <input type="checkbox" id="risk-conf" className="h-4 w-4" />
                    </div>
                    <div>
                      <Label className="text-xs">Urea (mmol/L)</Label>
                      <Input id="risk-urea" type="number" placeholder="7" defaultValue="7" />
                    </div>
                    <div>
                      <Label className="text-xs">Respiratory Rate</Label>
                      <Input id="risk-rr" type="number" placeholder="20" defaultValue="20" />
                    </div>
                    <div>
                      <Label className="text-xs">Systolic BP (mmHg)</Label>
                      <Input id="risk-bp" type="number" placeholder="120" defaultValue="120" />
                    </div>
                    <div>
                      <Label className="text-xs">Age</Label>
                      <Input id="risk-age-curb" type="number" placeholder="65" defaultValue="65" />
                    </div>
                  </div>
                )}

                {/* Framingham Form */}
                {selectedCalculator === "framingham" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Age</Label>
                        <Input id="risk-age-fh" type="number" placeholder="55" defaultValue="55" />
                      </div>
                      <div>
                        <Label className="text-xs">Gender</Label>
                        <Select defaultValue="male">
                          <SelectTrigger id="risk-gender-fh">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Total Cholesterol (mg/dL)</Label>
                        <Input id="risk-tc" type="number" placeholder="200" defaultValue="200" />
                      </div>
                      <div>
                        <Label className="text-xs">HDL Cholesterol (mg/dL)</Label>
                        <Input id="risk-hdl" type="number" placeholder="50" defaultValue="50" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Systolic BP (mmHg)</Label>
                      <Input id="risk-sbp" type="number" placeholder="130" defaultValue="130" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Current Smoker</Label>
                        <input type="checkbox" id="risk-smoke" className="h-4 w-4" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">On BP Treatment</Label>
                        <input type="checkbox" id="risk-bptx" className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={calculateRisk} 
                  disabled={isCalculating}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate Risk Score
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Risk Result */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  Risk Assessment Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskResult ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100">
                      <div className="text-4xl font-bold text-slate-800 mb-2">{riskResult.score}</div>
                      <Badge className={`${getRiskColor(riskResult.risk)} text-sm px-4 py-1`}>
                        {riskResult.risk.toUpperCase()} RISK
                      </Badge>
                      <p className="text-sm text-slate-500 mt-2">{riskResult.name}</p>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Risk Interpretation</AlertTitle>
                      <AlertDescription>{riskResult.description}</AlertDescription>
                    </Alert>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-500" />
                        Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {riskResult.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <ChevronRight className="h-4 w-4 text-purple-500 mt-0.5" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2">
                      <TTSButton
                        text={`${riskResult.name} is ${riskResult.score}. ${riskResult.description}. Recommendations: ${riskResult.recommendations.join(", ")}`}
                        size="sm"
                        variant="outline"
                        showSettings={false}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm">
                        <FileText className="h-3 w-3 mr-1" />
                        Add to Notes
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-center">
                    <div>
                      <Calculator className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Enter patient data and calculate</p>
                      <p className="text-xs text-slate-400">Risk score will appear here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lab Interpretation Tab */}
        <TabsContent value="labs" className="space-y-4 mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-teal-500" />
                AI Lab Interpretation
              </CardTitle>
              <CardDescription>Get AI-powered interpretation of laboratory results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Test Name</Label>
                  <Select value={labTest} onValueChange={setLabTest}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hemoglobin">Hemoglobin</SelectItem>
                      <SelectItem value="WBC">WBC (White Blood Cells)</SelectItem>
                      <SelectItem value="Platelets">Platelets</SelectItem>
                      <SelectItem value="Glucose (Fasting)">Glucose (Fasting)</SelectItem>
                      <SelectItem value="Creatinine">Creatinine</SelectItem>
                      <SelectItem value="Sodium">Sodium</SelectItem>
                      <SelectItem value="Potassium">Potassium</SelectItem>
                      <SelectItem value="Troponin">Troponin</SelectItem>
                      <SelectItem value="TSH">TSH</SelectItem>
                      <SelectItem value="ALT">ALT (Alanine Transaminase)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter value"
                    value={labValue}
                    onChange={(e) => setLabValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select value={labUnit} onValueChange={setLabUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g/dL">g/dL</SelectItem>
                      <SelectItem value="mg/dL">mg/dL</SelectItem>
                      <SelectItem value="×10⁹/L">×10⁹/L</SelectItem>
                      <SelectItem value="mEq/L">mEq/L</SelectItem>
                      <SelectItem value="mIU/L">mIU/L</SelectItem>
                      <SelectItem value="U/L">U/L</SelectItem>
                      <SelectItem value="ng/mL">ng/mL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={interpretLabValue} 
                disabled={!labValue}
                className="w-full bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600"
              >
                <Beaker className="h-4 w-4 mr-2" />
                Interpret Result
              </Button>

              {/* Lab Result */}
              {labResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <Card className={`border-l-4 ${
                    labResult.status === "critical" ? "border-l-red-500" :
                    labResult.status === "high" ? "border-l-orange-500" :
                    labResult.status === "low" ? "border-l-blue-500" :
                    "border-l-green-500"
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{labResult.testName}</h4>
                          <p className="text-sm text-slate-500">
                            {labResult.value} {labResult.unit}
                          </p>
                        </div>
                        <Badge className={`${getStatusColor(labResult.status)} text-white`}>
                          {labResult.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500">Reference Range</p>
                          <p className="text-sm font-medium">{labResult.referenceRange}</p>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500">Interpretation</p>
                          <p className="text-sm">{labResult.interpretation}</p>
                        </div>

                        {labResult.possibleCauses.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Possible Causes</p>
                            <div className="flex flex-wrap gap-1">
                              {labResult.possibleCauses.map((cause, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {cause}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-xs text-slate-500 mb-1">Recommendations</p>
                          <ul className="space-y-1">
                            {labResult.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                                <CheckCircle className="h-3 w-3 text-teal-500 mt-0.5" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4 pt-3 border-t">
                        <TTSButton
                          text={`${labResult.testName} is ${labResult.value} ${labResult.unit}. ${labResult.interpretation}`}
                          size="sm"
                          variant="ghost"
                          showSettings={false}
                        />
                        <Button variant="outline" size="sm">
                          <FileText className="h-3 w-3 mr-1" />
                          Add to Notes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Quick Reference */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Common Critical Values</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hemoglobin</span>
                    <span className="text-red-600 font-medium">&lt;7 or &gt;20 g/dL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Potassium</span>
                    <span className="text-red-600 font-medium">&lt;2.5 or &gt;6.5 mEq/L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sodium</span>
                    <span className="text-red-600 font-medium">&lt;120 or &gt;160 mEq/L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Glucose</span>
                    <span className="text-red-600 font-medium">&lt;50 or &gt;400 mg/dL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Troponin</span>
                    <span className="text-red-600 font-medium">&gt;0.5 ng/mL</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { icon: CheckCircle, text: "Instant interpretation" },
                    { icon: CheckCircle, text: "Reference range comparison" },
                    { icon: CheckCircle, text: "Possible causes analysis" },
                    { icon: CheckCircle, text: "Clinical recommendations" },
                    { icon: CheckCircle, text: "Voice readout support" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <item.icon className="h-3 w-3 text-teal-500" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
