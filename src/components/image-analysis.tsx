"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  ZoomIn,
  RotateCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  FileImage,
  Scan,
  Brain,
  Stethoscope,
  Activity,
  X,
  User,
  Clock,
  Save,
  Zap,
  Heart,
  Bone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TTSButton } from "@/components/tts-button";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface PatientImage {
  id: string;
  imageUrl: string;
  imageType: string;
  analysisResult?: string;
  uploadedAt: string;
}

interface AnalysisResult {
  id: string;
  type: string;
  findings: Finding[];
  impression: string;
  confidence: number;
  recommendations: string[];
  technicalQuality?: string;
  detailedAnalysis?: {
    systematicReview?: string;
    abnormalFindings?: string;
    normalFindings?: string;
    differentialConsiderations?: string;
  };
  teachingPoints?: string[];
  clinicalCorrelation?: string;
  followUp?: string;
}

interface RejectionResult {
  isMedicalImage: false;
  reason: string;
}

interface AnalysisError {
  message: string;
}

interface Finding {
  description: string;
  location: string;
  confidence: number;
  severity: "normal" | "abnormal" | "critical";
}

const sampleAnalyses: Record<string, AnalysisResult> = {
  "chest-xray": {
    id: "1",
    type: "Chest X-Ray",
    findings: [
      { description: "Cardiac silhouette within normal limits", location: "Cardiac", confidence: 0.92, severity: "normal" },
      { description: "Lungs are clear bilaterally", location: "Pulmonary", confidence: 0.88, severity: "normal" },
      { description: "No pleural effusion identified", location: "Pleural", confidence: 0.94, severity: "normal" },
      { description: "Bony structures appear intact", location: "Musculoskeletal", confidence: 0.90, severity: "normal" },
    ],
    impression: "No acute cardiopulmonary abnormality identified. Cardiac silhouette and pulmonary vascularity within normal limits.",
    confidence: 0.91,
    recommendations: [
      "Clinical correlation recommended",
      "Consider comparison with prior studies if available",
      "Follow-up imaging as clinically indicated",
    ],
  },
  "ct-scan": {
    id: "2",
    type: "CT Scan Analysis",
    findings: [
      { description: "Small hypodense lesion in right lobe", location: "Liver", confidence: 0.78, severity: "abnormal" },
      { description: "No evidence of portal hypertension", location: "Hepatic", confidence: 0.85, severity: "normal" },
      { description: "Spleen size within normal limits", location: "Splenic", confidence: 0.92, severity: "normal" },
    ],
    impression: "Small hepatic lesion noted. Recommend further characterization with contrast-enhanced imaging.",
    confidence: 0.82,
    recommendations: [
      "Consider contrast-enhanced CT or MRI for further evaluation",
      "Liver function tests recommended",
      "Follow-up in 3 months if benign etiology confirmed",
    ],
  },
  "mri-brain": {
    id: "3",
    type: "MRI Brain",
    findings: [
      { description: "Normal brain parenchymal signal intensity", location: "Cerebral", confidence: 0.94, severity: "normal" },
      { description: "Ventricles and sulci are normal in size", location: "Ventricular", confidence: 0.91, severity: "normal" },
      { description: "No focal mass lesion identified", location: "Brain", confidence: 0.93, severity: "normal" },
      { description: "Normal flow voids in major vessels", location: "Vascular", confidence: 0.89, severity: "normal" },
    ],
    impression: "Unremarkable MRI of the brain. No acute intracranial abnormality.",
    confidence: 0.92,
    recommendations: [
      "Clinical correlation with neurological symptoms",
      "Consider follow-up if symptoms persist",
    ],
  },
  "mri-spine": {
    id: "4",
    type: "MRI Spine",
    findings: [
      { description: "Normal vertebral body height and alignment", location: "Spine", confidence: 0.93, severity: "normal" },
      { description: "Intervertebral discs are well-hydrated", location: "Discs", confidence: 0.87, severity: "normal" },
      { description: "No spinal canal stenosis", location: "Spinal Canal", confidence: 0.91, severity: "normal" },
      { description: "Normal signal intensity in spinal cord", location: "Spinal Cord", confidence: 0.94, severity: "normal" },
    ],
    impression: "Normal MRI of the spine. No significant disc herniation or canal stenosis.",
    confidence: 0.91,
    recommendations: [
      "Consider conservative management if symptomatic",
      "Physical therapy evaluation may be beneficial",
    ],
  },
  "ultrasound-abdominal": {
    id: "5",
    type: "Abdominal Ultrasound",
    findings: [
      { description: "Liver normal in size and echogenicity", location: "Liver", confidence: 0.91, severity: "normal" },
      { description: "Gallbladder is unremarkable without stones", location: "Gallbladder", confidence: 0.94, severity: "normal" },
      { description: "Common bile duct is normal caliber", location: "Biliary", confidence: 0.89, severity: "normal" },
      { description: "Kidneys are normal in size and echotexture", location: "Renal", confidence: 0.92, severity: "normal" },
      { description: "No free fluid in abdomen", location: "Peritoneal", confidence: 0.95, severity: "normal" },
    ],
    impression: "Unremarkable abdominal ultrasound. No focal hepatic, biliary, or renal abnormality.",
    confidence: 0.92,
    recommendations: [
      "Clinical correlation recommended",
      "Consider further evaluation if symptoms persist",
    ],
  },
  "ultrasound-cardiac": {
    id: "6",
    type: "Echocardiogram",
    findings: [
      { description: "Normal left ventricular size and function", location: "Cardiac", confidence: 0.93, severity: "normal" },
      { description: "Ejection fraction estimated at 60-65%", location: "LV Function", confidence: 0.88, severity: "normal" },
      { description: "Valves appear structurally normal", location: "Valves", confidence: 0.91, severity: "normal" },
      { description: "No pericardial effusion", location: "Pericardial", confidence: 0.96, severity: "normal" },
      { description: "Normal right ventricular function", location: "RV Function", confidence: 0.89, severity: "normal" },
    ],
    impression: "Normal echocardiogram with preserved biventricular function. No valvular or pericardial abnormality.",
    confidence: 0.91,
    recommendations: [
      "Routine follow-up as clinically indicated",
      "Consider stress echo if symptoms suggest ischemia",
    ],
  },
  "ultrasound-obstetric": {
    id: "7",
    type: "Obstetric Ultrasound",
    findings: [
      { description: "Single viable intrauterine pregnancy", location: "Uterus", confidence: 0.98, severity: "normal" },
      { description: "Cardiac activity present, heart rate normal", location: "Fetal", confidence: 0.97, severity: "normal" },
      { description: "Amniotic fluid volume adequate", location: "Amniotic", confidence: 0.92, severity: "normal" },
      { description: "Placenta anterior, clear of os", location: "Placental", confidence: 0.94, severity: "normal" },
    ],
    impression: "Normal intrauterine pregnancy with appropriate fetal growth and activity.",
    confidence: 0.95,
    recommendations: [
      "Continue routine prenatal care",
      "Follow-up ultrasound per obstetric guidelines",
    ],
  },
  "mammogram": {
    id: "8",
    type: "Mammogram",
    findings: [
      { description: "Bilateral screening mammogram performed", location: "Bilateral Breasts", confidence: 0.94, severity: "normal" },
      { description: "No suspicious masses or calcifications", location: "Breast Tissue", confidence: 0.92, severity: "normal" },
      { description: "No architectural distortion identified", location: "Breast Architecture", confidence: 0.90, severity: "normal" },
      { description: "Axillary lymph nodes appear normal", location: "Axilla", confidence: 0.91, severity: "normal" },
    ],
    impression: "BIRADS Category 1: Negative. No evidence of malignancy.",
    confidence: 0.93,
    recommendations: [
      "Continue annual screening mammography",
      "Clinical breast exam recommended",
    ],
  },
  "pet-ct": {
    id: "9",
    type: "PET-CT Scan",
    findings: [
      { description: "No abnormal FDG uptake identified", location: "Whole Body", confidence: 0.92, severity: "normal" },
      { description: "Physiologic uptake in brain and heart", location: "Brain/Cardiac", confidence: 0.95, severity: "normal" },
      { description: "No metabolically active lymph nodes", location: "Lymphatic", confidence: 0.91, severity: "normal" },
      { description: "No suspicious osseous lesions", location: "Skeletal", confidence: 0.89, severity: "normal" },
    ],
    impression: "No evidence of metabolically active disease. Unremarkable whole-body PET-CT.",
    confidence: 0.92,
    recommendations: [
      "Correlate with clinical findings",
      "Follow-up imaging per oncology protocol if applicable",
    ],
  },
  "dexa": {
    id: "10",
    type: "DEXA Scan",
    findings: [
      { description: "Lumbar spine T-score: -1.2", location: "Lumbar Spine", confidence: 0.95, severity: "abnormal" },
      { description: "Left hip T-score: -0.8", location: "Hip", confidence: 0.94, severity: "normal" },
      { description: "Femoral neck T-score: -1.0", location: "Femoral Neck", confidence: 0.93, severity: "abnormal" },
    ],
    impression: "Osteopenia at lumbar spine. Bone mineral density reduced but not in osteoporotic range.",
    confidence: 0.94,
    recommendations: [
      "Consider calcium and vitamin D supplementation",
      "Weight-bearing exercise encouraged",
      "Repeat DEXA in 2 years",
      "Consider FRAX assessment for fracture risk",
    ],
  },
  "angiography": {
    id: "11",
    type: "CT Angiography",
    findings: [
      { description: "Coronary arteries are patent without stenosis", location: "Coronary", confidence: 0.93, severity: "normal" },
      { description: "No significant plaque burden identified", location: "Vessels", confidence: 0.91, severity: "normal" },
      { description: "Normal cardiac chamber sizes", location: "Cardiac", confidence: 0.92, severity: "normal" },
      { description: "Pulmonary arteries are clear", location: "Pulmonary", confidence: 0.94, severity: "normal" },
    ],
    impression: "Normal coronary CT angiogram. No significant coronary artery disease.",
    confidence: 0.93,
    recommendations: [
      "Risk factor modification as indicated",
      "Follow-up per cardiology recommendations",
    ],
  },
  "fluoroscopy": {
    id: "12",
    type: "Fluoroscopy",
    findings: [
      { description: "Normal barium transit through esophagus", location: "Esophageal", confidence: 0.91, severity: "normal" },
      { description: "No evidence of reflux or stricture", location: "EG Junction", confidence: 0.89, severity: "normal" },
      { description: "Stomach and duodenum appear normal", location: "Upper GI", confidence: 0.92, severity: "normal" },
    ],
    impression: "Normal upper GI series. No evidence of structural abnormality or obstruction.",
    confidence: 0.91,
    recommendations: [
      "Clinical correlation with symptoms",
      "Consider endoscopy if symptoms persist",
    ],
  },
};

// Comprehensive imaging types with categories
const IMAGING_TYPES = [
  // X-Ray
  { id: "chest-xray", name: "Chest X-Ray", category: "X-Ray", description: "PA/Lateral views, chest pathology", status: "Active", icon: ImageIcon },
  { id: "xray-extremity", name: "Extremity X-Ray", category: "X-Ray", description: "Upper/lower limb imaging", status: "Active", icon: ImageIcon },
  { id: "xray-spine", name: "Spine X-Ray", category: "X-Ray", description: "Cervical, thoracic, lumbar", status: "Active", icon: ImageIcon },
  { id: "xray-abdominal", name: "Abdominal X-Ray", category: "X-Ray", description: "KUB, acute abdomen", status: "Active", icon: ImageIcon },
  
  // CT Scan
  { id: "ct-scan", name: "CT Abdomen/Pelvis", category: "CT Scan", description: "Contrast/non-contrast", status: "Active", icon: Scan },
  { id: "ct-chest", name: "CT Chest", category: "CT Scan", description: "Lung nodule, PE protocol", status: "Active", icon: Scan },
  { id: "ct-head", name: "CT Head/Brain", category: "CT Scan", description: "Stroke, trauma evaluation", status: "Active", icon: Scan },
  { id: "ct-spine", name: "CT Spine", category: "CT Scan", description: "Fracture, stenosis eval", status: "Active", icon: Scan },
  { id: "ct-angiography", name: "CT Angiography", category: "CT Scan", description: "Vascular imaging", status: "Active", icon: Scan },
  
  // MRI
  { id: "mri-brain", name: "MRI Brain", category: "MRI", description: "Neurological evaluation", status: "Active", icon: Brain },
  { id: "mri-spine", name: "MRI Spine", category: "MRI", description: "Disc disease, stenosis", status: "Active", icon: Brain },
  { id: "mri-knee", name: "MRI Knee", category: "MRI", description: "Ligament, meniscus eval", status: "Active", icon: Brain },
  { id: "mri-shoulder", name: "MRI Shoulder", category: "MRI", description: "Rotator cuff, labrum", status: "Active", icon: Brain },
  { id: "mri-cardiac", name: "Cardiac MRI", category: "MRI", description: "Cardiac function, structure", status: "Active", icon: Brain },
  { id: "mri-prostate", name: "MRI Prostate", category: "MRI", description: "Prostate cancer staging", status: "Active", icon: Brain },
  { id: "mri-liver", name: "MRI Liver", category: "MRI", description: "Hepatic lesion characterization", status: "Active", icon: Brain },
  
  // Ultrasound
  { id: "ultrasound-abdominal", name: "Abdominal Ultrasound", category: "Ultrasound", description: "Liver, GB, kidneys, spleen", status: "Active", icon: Activity },
  { id: "ultrasound-cardiac", name: "Echocardiogram", category: "Ultrasound", description: "Cardiac structure, function", status: "Active", icon: Heart },
  { id: "ultrasound-obstetric", name: "Obstetric Ultrasound", category: "Ultrasound", description: "Fetal assessment", status: "Active", icon: Heart },
  { id: "ultrasound-thyroid", name: "Thyroid Ultrasound", category: "Ultrasound", description: "Thyroid nodule evaluation", status: "Active", icon: Activity },
  { id: "ultrasound-vascular", name: "Vascular Doppler", category: "Ultrasound", description: "DVT, carotid, arterial", status: "Active", icon: Activity },
  { id: "ultrasound-musculoskeletal", name: "MSK Ultrasound", category: "Ultrasound", description: "Joints, tendons, muscles", status: "Active", icon: Activity },
  { id: "ultrasound-breast", name: "Breast Ultrasound", category: "Ultrasound", description: "Breast mass evaluation", status: "Active", icon: Activity },
  
  // Nuclear Medicine
  { id: "pet-ct", name: "PET-CT", category: "Nuclear Medicine", description: "Oncologic staging", status: "Active", icon: Zap },
  { id: "bone-scan", name: "Bone Scan", category: "Nuclear Medicine", description: "Metastatic screening", status: "Active", icon: Zap },
  { id: "thyroid-scan", name: "Thyroid Scan", category: "Nuclear Medicine", description: "Thyroid function imaging", status: "Active", icon: Zap },
  { id: "ventilation-perfusion", name: "V/Q Scan", category: "Nuclear Medicine", description: "Pulmonary embolism", status: "Active", icon: Zap },
  
  // Specialized
  { id: "mammogram", name: "Mammogram", category: "Specialized", description: "Breast cancer screening", status: "Active", icon: Scan },
  { id: "dexa", name: "DEXA Scan", category: "Specialized", description: "Bone density", status: "Active", icon: Bone },
  { id: "angiography", name: "Angiography", category: "Specialized", description: "Cardiac/vascular imaging", status: "Active", icon: Scan },
  { id: "fluoroscopy", name: "Fluoroscopy", category: "Specialized", description: "Dynamic imaging studies", status: "Active", icon: Scan },
];

// Get unique categories
const IMAGING_CATEGORIES = [...new Set(IMAGING_TYPES.map(t => t.category))];

export function ImageAnalysis() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patientImages, setPatientImages] = useState<PatientImage[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedType, setSelectedType] = useState<string>("chest-xray");
  const [selectedCategory, setSelectedCategory] = useState<string>("X-Ray");
  const [isSaving, setIsSaving] = useState(false);
  const [rejectionResult, setRejectionResult] = useState<RejectionResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Get imaging types by category
  const getImagingTypesByCategory = (category: string) => {
    return IMAGING_TYPES.filter(t => t.category === category);
  };

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch patient images when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientImages(selectedPatientId);
    } else {
      setPatientImages([]);
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

  const fetchPatientImages = async (patientId: string) => {
    try {
      setIsLoadingImages(true);
      // In a real app, this would fetch from an API
      // For now, we'll simulate with empty array
      setPatientImages([]);
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const getSelectedPatient = () => {
    return patients.find((p) => p.id === selectedPatientId);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset previous analysis state
      setAnalysisResult(null);
      setRejectionResult(null);
      setAnalysisError(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setRejectionResult(null);
    setAnalysisError(null);
    
    try {
      const response = await fetch("/api/image-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: uploadedImage,
          imageType: selectedType,
          patientId: selectedPatientId,
          clinicalContext: selectedPatient 
            ? `Patient: ${selectedPatient.firstName} ${selectedPatient.lastName}, DOB: ${new Date(selectedPatient.dateOfBirth).toLocaleDateString()}, Gender: ${selectedPatient.gender}` 
            : undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Check if this is a rejection (non-medical image)
        if (data.isMedicalImage === false) {
          setRejectionResult({
            isMedicalImage: false,
            reason: data.rejectionReason || data.error || "Image was rejected",
          });
          toast({
            title: "Image Rejected",
            description: "The uploaded image is not a valid medical scan.",
            variant: "destructive",
          });
        } else {
          // Other error
          setAnalysisError(data.error || "Failed to analyze image");
          toast({
            title: "Analysis Error",
            description: data.error || "Failed to analyze image",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Successful analysis
      if (data.data) {
        setAnalysisResult({
          id: Date.now().toString(),
          type: data.data.type || selectedType,
          findings: data.data.findings || [],
          impression: data.data.impression || "Analysis completed",
          confidence: data.data.confidence || 0.85,
          recommendations: data.data.recommendations || [],
          technicalQuality: data.data.technicalQuality,
          detailedAnalysis: data.data.detailedAnalysis,
          teachingPoints: data.data.teachingPoints,
          clinicalCorrelation: data.data.clinicalCorrelation,
          followUp: data.data.followUp,
        });
        
        toast({
          title: "Analysis Complete",
          description: "Expert analysis has been completed successfully.",
        });
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisError("Failed to connect to analysis service. Please try again.");
      toast({
        title: "Connection Error",
        description: "Failed to connect to analysis service.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToRecord = async () => {
    if (!selectedPatientId || !uploadedImage || !analysisResult) {
      toast({
        title: "Error",
        description: "Please select a patient and analyze an image first",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // In a real app, this would save to the database
      toast({
        title: "Success",
        description: "Image and analysis saved to patient record",
      });
      // Add to local list
      const newImage: PatientImage = {
        id: Date.now().toString(),
        imageUrl: uploadedImage,
        imageType: selectedType,
        analysisResult: analysisResult.impression,
        uploadedAt: new Date().toISOString(),
      };
      setPatientImages([newImage, ...patientImages]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save to patient record",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return { badge: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-4 w-4 text-red-500" /> };
      case "abnormal":
        return { badge: "bg-amber-100 text-amber-700", icon: <Info className="h-4 w-4 text-amber-500" /> };
      default:
        return { badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> };
    }
  };

  const selectedPatient = getSelectedPatient();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scan className="h-6 w-6 text-cyan-500" />
            Medical Imaging
          </h2>
          <p className="text-slate-500">AI-powered radiology image interpretation</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-cyan-50 border-cyan-200 text-cyan-700">
            <Brain className="h-3 w-3 mr-1" />
            MedGemma Vision
          </Badge>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-cyan-500" />
            Patient Context
          </CardTitle>
          <CardDescription>Select a patient to link imaging results</CardDescription>
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
                  <AvatarFallback className="bg-cyan-100 text-cyan-700">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-sm text-slate-500">{selectedPatient.mrn} • {selectedPatient.gender} • DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</p>
                </div>
                {patientImages.length > 0 && (
                  <Badge variant="outline" className="bg-cyan-50 border-cyan-200 text-cyan-700">
                    {patientImages.length} Images
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Safety Alert */}
      <Alert className="bg-cyan-50 border-cyan-200">
        <Eye className="h-4 w-4 text-cyan-600" />
        <AlertTitle className="text-cyan-800">AI-Assisted Image Analysis</AlertTitle>
        <AlertDescription className="text-cyan-700">
          This tool provides AI-assisted preliminary analysis. All results must be verified by a qualified radiologist before clinical use.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Image Upload & Preview */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Upload Image</CardTitle>
            <CardDescription>Supported formats: DICOM, PNG, JPEG</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Tabs */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Imaging Category</Label>
              <div className="flex flex-wrap gap-2">
                {IMAGING_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category);
                      const firstType = getImagingTypesByCategory(category)[0];
                      if (firstType) setSelectedType(firstType.id);
                    }}
                    className={selectedCategory === category ? "bg-gradient-to-r from-cyan-500 to-blue-500" : ""}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Imaging Type Selection within Category */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Imaging Type</Label>
              <ScrollArea className="h-[120px]">
                <div className="grid grid-cols-2 gap-2 pr-4">
                  {getImagingTypesByCategory(selectedCategory).map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <Button
                        key={type.id}
                        variant={selectedType === type.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedType(type.id)}
                        className={`justify-start h-auto py-2 px-3 ${
                          selectedType === type.id ? "bg-gradient-to-r from-cyan-500 to-blue-500" : ""
                        }`}
                      >
                        <IconComponent className="h-4 w-4 mr-2 flex-shrink-0" />
                        <div className="text-left">
                          <div className="text-xs font-medium">{type.name}</div>
                          <div className="text-[10px] opacity-70">{type.description}</div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div
              className={`
                relative border-2 border-dashed rounded-xl overflow-hidden
                ${uploadedImage ? "border-cyan-300" : "border-slate-200"}
                min-h-[300px] flex items-center justify-center
                bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadedImage ? (
                <div className="relative w-full h-full">
                  <img
                    src={uploadedImage}
                    alt="Uploaded medical image"
                    className="w-full h-[300px] object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedImage(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center p-8">
                  <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="font-medium text-slate-600 mb-1">Drop image here or click to upload</h3>
                  <p className="text-sm text-slate-400">Supports DICOM, PNG, JPEG up to 50MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.dcm"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={!uploadedImage || isAnalyzing}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Scan className="h-4 w-4 mr-2" />
                )}
                {isAnalyzing ? "Analyzing..." : "Analyze Image"}
              </Button>
              {analysisResult && selectedPatientId && (
                <Button
                  variant="outline"
                  onClick={handleSaveToRecord}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save to Record
                </Button>
              )}
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing image...</span>
                  <span>AI Analysis in progress</span>
                </div>
                <Progress value={66} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">
              Analysis Results
              {selectedPatient && (
                <Badge variant="outline" className="ml-2 bg-cyan-50 border-cyan-200 text-cyan-700">
                  {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {analysisResult ? `Confidence: ${Math.round(analysisResult.confidence * 100)}%` : "Upload and analyze an image"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Rejection Message */}
            {rejectionResult && (
              <Alert className="mb-4 bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Image Rejected - Not a Medical Scan</AlertTitle>
                <AlertDescription className="text-red-700 mt-2">
                  {rejectionResult.reason}
                </AlertDescription>
                <div className="mt-3 p-3 bg-red-100 rounded-lg text-sm text-red-800">
                  <p className="font-medium mb-1">Accepted Medical Image Types:</p>
                  <ul className="list-disc list-inside text-xs space-y-1 text-red-700">
                    <li>X-Ray images (Chest, Skeletal, Abdominal)</li>
                    <li>CT Scans (Head, Chest, Abdomen, Spine)</li>
                    <li>MRI Scans (Brain, Spine, Joints)</li>
                    <li>Ultrasound images (Abdominal, Cardiac, Obstetric)</li>
                    <li>PET-CT, Nuclear Medicine scans</li>
                    <li>Mammograms, DEXA scans, Angiography</li>
                  </ul>
                </div>
              </Alert>
            )}
            
            {/* Error Message */}
            {analysisError && !rejectionResult && (
              <Alert className="mb-4 bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Analysis Error</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {analysisError}
                </AlertDescription>
              </Alert>
            )}
            
            {!analysisResult && !rejectionResult && !analysisError ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center">
                <FileImage className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-600">No Analysis Yet</h3>
                <p className="text-sm text-slate-400">Upload a medical image and click analyze</p>
                <p className="text-xs text-slate-400 mt-2">Non-medical images will be rejected</p>
              </div>
            ) : analysisResult ? (
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-4">
                  {/* Technical Quality */}
                  {analysisResult.technicalQuality && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Image Quality Assessment</span>
                      </div>
                      <p className="text-sm text-slate-600">{analysisResult.technicalQuality}</p>
                    </div>
                  )}
                  
                  {/* Findings */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-500" />
                        Radiological Findings
                      </h4>
                      {analysisResult && analysisResult.findings.length > 0 && (
                        <TTSButton
                          text={analysisResult.findings.map(f => `${f.description} in ${f.location}`).join('. ')}
                          size="sm"
                          variant="ghost"
                          showSettings={false}
                          label="Read Findings"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      {analysisResult.findings.map((finding, i) => {
                        const styles = getSeverityStyles(finding.severity);
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            {styles.icon}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">{finding.description}</p>
                                <Badge className={styles.badge}>
                                  {Math.round(finding.confidence * 100)}%
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500">{finding.location}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Impression */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-purple-500" />
                        Clinical Impression
                      </h4>
                      {analysisResult && (
                        <TTSButton
                          text={analysisResult.impression}
                          size="sm"
                          variant="ghost"
                          showSettings={false}
                          label="Read Impression"
                        />
                      )}
                    </div>
                    <p className="text-sm text-slate-700 bg-purple-50 p-3 rounded-lg">
                      {analysisResult.impression}
                    </p>
                  </div>
                  
                  {/* Teaching Points */}
                  {analysisResult.teachingPoints && analysisResult.teachingPoints.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4 text-cyan-500" />
                          Teaching Points
                        </h4>
                        <div className="bg-cyan-50 p-3 rounded-lg space-y-2">
                          {analysisResult.teachingPoints.map((point, i) => (
                            <p key={i} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="text-cyan-500 font-bold">•</span>
                              {point}
                            </p>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Recommendations */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Recommendations</h4>
                      {analysisResult && analysisResult.recommendations.length > 0 && (
                        <TTSButton
                          text={analysisResult.recommendations.join('. ')}
                          size="sm"
                          variant="ghost"
                          showSettings={false}
                          label="Read Recommendations"
                        />
                      )}
                    </div>
                    <ul className="space-y-1">
                      {analysisResult.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Disclaimer */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <strong>EXPERT ANALYSIS DISCLAIMER:</strong> This AI-assisted analysis is provided for educational and preliminary review purposes only. All findings must be verified by a board-certified radiologist. Clinical decisions should not be made solely based on this analysis.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Patient Imaging History */}
      {selectedPatientId && patientImages.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Patient Imaging History</CardTitle>
            <CardDescription>Previous imaging studies for {selectedPatient?.firstName} {selectedPatient?.lastName}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="grid sm:grid-cols-3 gap-4">
                {patientImages.map((image) => (
                  <div key={image.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{image.imageType}</Badge>
                      <span className="text-xs text-slate-500">{new Date(image.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{image.analysisResult}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Image Types Reference */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Supported Imaging Technologies</CardTitle>
          <CardDescription>Click to select imaging type for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={(val) => {
            setSelectedCategory(val);
            const firstType = getImagingTypesByCategory(val)[0];
            if (firstType) setSelectedType(firstType.id);
          }}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {IMAGING_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs px-3 py-1">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {IMAGING_CATEGORIES.map((category) => (
              <TabsContent key={category} value={category}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getImagingTypesByCategory(category).map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <motion.div
                        key={type.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedType === type.id 
                            ? "bg-cyan-50 border-cyan-300 shadow-sm" 
                            : "bg-slate-50 border-slate-200 hover:border-cyan-200"
                        }`}
                        onClick={() => setSelectedType(type.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            selectedType === type.id ? "bg-cyan-100" : "bg-slate-100"
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              selectedType === type.id ? "text-cyan-600" : "text-slate-500"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-slate-700 truncate">{type.name}</h4>
                            <p className="text-xs text-slate-500 truncate">{type.description}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              type.status === "Active"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-slate-100 border-slate-200 text-slate-500"
                            }`}
                          >
                            {type.status}
                          </Badge>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
