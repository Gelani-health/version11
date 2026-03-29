"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Plus,
  Search,
  Calendar,
  FileText,
  Send,
  RefreshCw,
  Printer,
  Filter,
  History,
  ChevronRight,
  ChevronDown,
  Camera,
  Timer,
  Settings,
  PenTool,
  MessageSquare,
  Radio,
  Waves,
  FileUp,
  Paperclip,
  Link2,
  Phone,
  Mic,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VoiceInputButton } from "@/components/voice-input-button";

// ============================================
// COMPREHENSIVE IMAGING CATALOG
// ============================================

const IMAGING_CATALOG = {
  xray: {
    name: "X-Ray",
    icon: ImageIcon,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    description: "Conventional radiography",
    subcategories: {
      Chest: [
        { name: "Chest X-Ray PA/Lateral", code: "CXR-PA", description: "Standard chest views", duration: "15 min", contrast: false },
        { name: "Chest X-Ray Portable", code: "CXR-PORT", description: "Bedside chest imaging", duration: "10 min", contrast: false },
        { name: "Chest X-Ray Decubitus", code: "CXR-DEC", description: "For pleural effusion", duration: "20 min", contrast: false },
      ],
      Skeletal: [
        { name: "Cervical Spine X-Ray", code: "XRAY-CS", description: "Neck/cervical vertebrae", duration: "15 min", contrast: false },
        { name: "Thoracic Spine X-Ray", code: "XRAY-TS", description: "Upper back", duration: "15 min", contrast: false },
        { name: "Lumbar Spine X-Ray", code: "XRAY-LS", description: "Lower back", duration: "15 min", contrast: false },
        { name: "Pelvis X-Ray", code: "XRAY-PELVIS", description: "Pelvic bones", duration: "15 min", contrast: false },
        { name: "Hip X-Ray", code: "XRAY-HIP", description: "Hip joint", duration: "10 min", contrast: false },
        { name: "Knee X-Ray", code: "XRAY-KNEE", description: "Knee joint AP/Lateral", duration: "10 min", contrast: false },
        { name: "Shoulder X-Ray", code: "XRAY-SHOULDER", description: "Shoulder joint", duration: "10 min", contrast: false },
        { name: "Hand/Wrist X-Ray", code: "XRAY-HAND", description: "Hand and wrist", duration: "10 min", contrast: false },
        { name: "Foot/Ankle X-Ray", code: "XRAY-FOOT", description: "Foot and ankle", duration: "10 min", contrast: false },
      ],
      Abdominal: [
        { name: "Abdominal X-Ray (KUB)", code: "XRAY-KUB", description: "Kidneys, ureters, bladder", duration: "10 min", contrast: false },
        { name: "Acute Abdomen Series", code: "XRAY-ACUTE", description: "Upright, supine, decubitus", duration: "20 min", contrast: false },
      ],
    },
  },
  ct: {
    name: "CT Scan",
    icon: Scan,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    description: "Computed tomography",
    subcategories: {
      Head: [
        { name: "CT Head (Brain)", code: "CT-HEAD", description: "Non-contrast brain imaging", duration: "15 min", contrast: false },
        { name: "CT Head with Contrast", code: "CT-HEAD-C", description: "Contrast-enhanced brain", duration: "30 min", contrast: true },
        { name: "CT Angiography Head", code: "CTA-HEAD", description: "Cerebral vessels", duration: "30 min", contrast: true },
        { name: "CT Perfusion", code: "CT-PERF", description: "Stroke assessment", duration: "20 min", contrast: true },
      ],
      Chest: [
        { name: "CT Chest", code: "CT-CHEST", description: "Non-contrast chest", duration: "20 min", contrast: false },
        { name: "CT Chest with Contrast", code: "CT-CHEST-C", description: "Contrast-enhanced chest", duration: "30 min", contrast: true },
        { name: "CT Angiography Chest", code: "CTA-CHEST", description: "Pulmonary embolism", duration: "30 min", contrast: true },
        { name: "High-Resolution CT Chest", code: "HRCT", description: "Interstitial lung disease", duration: "20 min", contrast: false },
        { name: "CT Coronary Angiography", code: "CTA-CORO", description: "Cardiac vessels", duration: "30 min", contrast: true },
      ],
      "Abdomen/Pelvis": [
        { name: "CT Abdomen", code: "CT-ABD", description: "Non-contrast abdomen", duration: "20 min", contrast: false },
        { name: "CT Abdomen/Pelvis with Contrast", code: "CT-ABD-C", description: "Contrast-enhanced", duration: "30 min", contrast: true },
        { name: "CT Urogram", code: "CT-URO", description: "Urinary tract", duration: "30 min", contrast: true },
        { name: "CT Enterography", code: "CT-ENTERO", description: "Small bowel evaluation", duration: "45 min", contrast: true },
      ],
      Spine: [
        { name: "CT Cervical Spine", code: "CT-CS", description: "Cervical vertebrae", duration: "15 min", contrast: false },
        { name: "CT Lumbar Spine", code: "CT-LS", description: "Lumbar vertebrae", duration: "15 min", contrast: false },
      ],
      Angiography: [
        { name: "CTA Aorta", code: "CTA-AORTA", description: "Aortic imaging", duration: "30 min", contrast: true },
        { name: "CTA Neck", code: "CTA-NECK", description: "Carotid vessels", duration: "30 min", contrast: true },
        { name: "CTA Extremity", code: "CTA-EXT", description: "Peripheral vessels", duration: "30 min", contrast: true },
      ],
    },
  },
  mri: {
    name: "MRI",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    description: "Magnetic resonance imaging",
    subcategories: {
      Brain: [
        { name: "MRI Brain", code: "MRI-BRAIN", description: "Standard brain imaging", duration: "45 min", contrast: false },
        { name: "MRI Brain with Contrast", code: "MRI-BRAIN-C", description: "Contrast-enhanced brain", duration: "60 min", contrast: true },
        { name: "MRI Pituitary", code: "MRI-PIT", description: "Pituitary gland", duration: "45 min", contrast: true },
        { name: "MRI Angiography Brain", code: "MRA-BRAIN", description: "Cerebral vessels", duration: "45 min", contrast: false },
        { name: "MRI Spectroscopy", code: "MRI-SPEC", description: "Metabolic imaging", duration: "60 min", contrast: false },
      ],
      Spine: [
        { name: "MRI Cervical Spine", code: "MRI-CS", description: "Neck/spinal cord", duration: "45 min", contrast: false },
        { name: "MRI Thoracic Spine", code: "MRI-TS", description: "Upper back", duration: "45 min", contrast: false },
        { name: "MRI Lumbar Spine", code: "MRI-LS", description: "Lower back", duration: "45 min", contrast: false },
        { name: "MRI Whole Spine", code: "MRI-WS", description: "Complete spinal imaging", duration: "90 min", contrast: false },
      ],
      Joints: [
        { name: "MRI Knee", code: "MRI-KNEE", description: "Knee joint", duration: "45 min", contrast: false },
        { name: "MRI Shoulder", code: "MRI-SHOULDER", description: "Shoulder joint", duration: "45 min", contrast: false },
        { name: "MRI Hip", code: "MRI-HIP", description: "Hip joint", duration: "45 min", contrast: false },
        { name: "MRI Ankle", code: "MRI-ANKLE", description: "Ankle joint", duration: "45 min", contrast: false },
        { name: "MRI Wrist", code: "MRI-WRIST", description: "Wrist joint", duration: "45 min", contrast: false },
      ],
      Cardiac: [
        { name: "Cardiac MRI", code: "MRI-CARD", description: "Heart structure/function", duration: "60 min", contrast: true },
        { name: "MRI Myocardial Viability", code: "MRI-VIAB", description: "Heart muscle assessment", duration: "60 min", contrast: true },
      ],
      Abdomen: [
        { name: "MRI Abdomen", code: "MRI-ABD", description: "Abdominal organs", duration: "45 min", contrast: true },
        { name: "MRI Liver", code: "MRI-LIVER", description: "Liver characterization", duration: "45 min", contrast: true },
        { name: "MRI Pancreas", code: "MRI-PANC", description: "Pancreatic imaging", duration: "45 min", contrast: true },
        { name: "MRI Prostate", code: "MRI-PROS", description: "Prostate evaluation", duration: "45 min", contrast: true },
      ],
    },
  },
  ultrasound: {
    name: "Ultrasound",
    icon: Waves,
    color: "text-cyan-500",
    bgColor: "bg-cyan-50",
    description: "Sonography imaging",
    subcategories: {
      Abdominal: [
        { name: "Abdominal Ultrasound", code: "US-ABD", description: "Liver, gallbladder, kidneys, spleen", duration: "30 min", contrast: false },
        { name: "Renal Ultrasound", code: "US-RENAL", description: "Kidneys and bladder", duration: "20 min", contrast: false },
        { name: "Hepatobiliary Ultrasound", code: "US-HB", description: "Liver and biliary system", duration: "30 min", contrast: false },
        { name: "Pancreatic Ultrasound", code: "US-PANC", description: "Pancreas evaluation", duration: "20 min", contrast: false },
      ],
      Cardiac: [
        { name: "Transthoracic Echocardiogram", code: "TTE", description: "Heart structure/function", duration: "30 min", contrast: false },
        { name: "Transesophageal Echocardiogram", code: "TEE", description: "Detailed heart imaging", duration: "45 min", contrast: false },
        { name: "Stress Echocardiogram", code: "STRESS-ECHO", description: "Exercise heart imaging", duration: "45 min", contrast: false },
      ],
      Obstetric: [
        { name: "Obstetric Ultrasound (1st Trimester)", code: "US-OB1", description: "Early pregnancy", duration: "30 min", contrast: false },
        { name: "Obstetric Ultrasound (2nd/3rd Trimester)", code: "US-OB2", description: "Fetal assessment", duration: "45 min", contrast: false },
        { name: "Biophysical Profile", code: "BPP", description: "Fetal well-being", duration: "30 min", contrast: false },
      ],
      Thyroid: [
        { name: "Thyroid Ultrasound", code: "US-THY", description: "Thyroid gland", duration: "20 min", contrast: false },
        { name: "Neck Ultrasound", code: "US-NECK", description: "Neck structures", duration: "20 min", contrast: false },
      ],
      Vascular: [
        { name: "Carotid Doppler", code: "US-CAR", description: "Carotid arteries", duration: "30 min", contrast: false },
        { name: "Lower Extremity Doppler", code: "US-LEDVT", description: "DVT screening", duration: "30 min", contrast: false },
        { name: "Upper Extremity Doppler", code: "US-UEDVT", description: "Arm DVT screening", duration: "30 min", contrast: false },
        { name: "Aorta Ultrasound", code: "US-AORTA", description: "Abdominal aorta", duration: "20 min", contrast: false },
        { name: "Renal Artery Doppler", code: "US-RENAL-A", description: "Renal vessels", duration: "30 min", contrast: false },
      ],
      MSK: [
        { name: "Shoulder Ultrasound", code: "US-SHOULDER", description: "Rotator cuff", duration: "20 min", contrast: false },
        { name: "Knee Ultrasound", code: "US-KNEE", description: "Knee soft tissues", duration: "20 min", contrast: false },
        { name: "Hip Ultrasound", code: "US-HIP", description: "Hip joint", duration: "20 min", contrast: false },
        { name: "Ankle/Foot Ultrasound", code: "US-ANKLE", description: "Ankle structures", duration: "20 min", contrast: false },
      ],
    },
  },
  nuclear: {
    name: "Nuclear Medicine",
    icon: Zap,
    color: "text-green-500",
    bgColor: "bg-green-50",
    description: "Radionuclide imaging",
    subcategories: {
      PET: [
        { name: "PET-CT Whole Body", code: "PET-WB", description: "Oncologic staging", duration: "60 min", contrast: false },
        { name: "PET-CT Brain", code: "PET-BRAIN", description: "Neurological imaging", duration: "45 min", contrast: false },
        { name: "PET-CT Cardiac", code: "PET-CARD", description: "Myocardial viability", duration: "60 min", contrast: false },
      ],
      Bone: [
        { name: "Bone Scan (Whole Body)", code: "BONE-WB", description: "Metastatic screening", duration: "3-4 hrs", contrast: false },
        { name: "Bone Scan (Limited)", code: "BONE-LIM", description: "Specific area", duration: "2-3 hrs", contrast: false },
        { name: "Three-Phase Bone Scan", code: "BONE-3P", description: "Infection/inflammation", duration: "3-4 hrs", contrast: false },
      ],
      Thyroid: [
        { name: "Thyroid Scan", code: "NUC-THY", description: "Thyroid function", duration: "1-2 hrs", contrast: false },
        { name: "Parathyroid Scan", code: "NUC-PARA", description: "Parathyroid localization", duration: "2-3 hrs", contrast: false },
      ],
      Other: [
        { name: "V/Q Scan", code: "VQ", description: "Pulmonary embolism", duration: "45 min", contrast: false },
        { name: "Renal Scan", code: "NUC-RENAL", description: "Kidney function", duration: "45 min", contrast: false },
        { name: "Gastric Emptying Study", code: "NUC-GES", description: "Stomach motility", duration: "4 hrs", contrast: false },
        { name: "HIDA Scan", code: "HIDA", description: "Gallbladder function", duration: "2 hrs", contrast: false },
      ],
    },
  },
  specialized: {
    name: "Specialized",
    icon: Camera,
    color: "text-rose-500",
    bgColor: "bg-rose-50",
    description: "Specialized imaging",
    subcategories: {
      Fluoroscopy: [
        { name: "Upper GI Series", code: "FL-UPI", description: "Esophagus, stomach, duodenum", duration: "30 min", contrast: true },
        { name: "Barium Swallow", code: "FL-BAR", description: "Esophageal evaluation", duration: "20 min", contrast: true },
        { name: "Small Bowel Follow-Through", code: "FL-SBFT", description: "Small intestine", duration: "2-4 hrs", contrast: true },
        { name: "Barium Enema", code: "FL-BE", description: "Colon imaging", duration: "45 min", contrast: true },
        { name: "VCUG", code: "FL-VCUG", description: "Voiding cystourethrogram", duration: "30 min", contrast: true },
      ],
      Mammography: [
        { name: "Screening Mammogram", code: "MAM-SCR", description: "Routine screening", duration: "20 min", contrast: false },
        { name: "Diagnostic Mammogram", code: "MAM-DIAG", description: "Problem evaluation", duration: "30 min", contrast: false },
        { name: "Stereotactic Biopsy", code: "MAM-BX", description: "Image-guided biopsy", duration: "60 min", contrast: false },
      ],
      DEXA: [
        { name: "DEXA Scan (Hip/Spine)", code: "DEXA", description: "Bone density", duration: "15 min", contrast: false },
        { name: "DEXA Whole Body", code: "DEXA-WB", description: "Body composition", duration: "20 min", contrast: false },
      ],
      Angiography: [
        { name: "Cerebral Angiography", code: "ANG-CER", description: "Brain vessels", duration: "1-2 hrs", contrast: true },
        { name: "Coronary Angiography", code: "ANG-COR", description: "Heart vessels", duration: "1-2 hrs", contrast: true },
        { name: "Peripheral Angiography", code: "ANG-PER", description: "Limbs vessels", duration: "1-2 hrs", contrast: true },
      ],
    },
  },
};

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
  allergies?: string[];
  chronicConditions?: string[];
}

interface ImagingResultFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  dataUrl?: string;
}

interface ImagingOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: Patient;
  orderDate: string;
  priority: string;
  status: string;
  imagingType: string;
  imagingCode: string;
  clinicalIndication?: string;
  contrast: boolean;
  specialInstructions?: string;
  orderedBy?: string;
  scheduledAt?: string;
  performedAt?: string;
  performedBy?: string;
  studyDate?: string;
  technique?: string;
  findings?: string;
  impression?: string;
  radiologist?: string;
  reportReadyAt?: string;
  resultFiles?: ImagingResultFile[];
  technicianNotes?: string;
}

interface UploadedImage {
  id: string;
  url: string;
  type: string;
  uploadedAt: string;
}

// ============================================
// STATUS CONFIGURATION - Traffic Light System
// ============================================

const IMAGING_STATUS_CONFIG = {
  ordered: { 
    label: "Ordered", 
    color: "bg-blue-100 text-blue-700 border-blue-200", 
    bgColor: "bg-blue-500",
    icon: FileText, 
    trafficLight: "blue" as const,
    description: "Imaging order placed, awaiting scheduling"
  },
  scheduled: { 
    label: "Scheduled", 
    color: "bg-purple-100 text-purple-700 border-purple-200", 
    bgColor: "bg-purple-500",
    icon: Calendar, 
    trafficLight: "amber" as const,
    description: "Appointment scheduled"
  },
  "in-progress": { 
    label: "In Progress", 
    color: "bg-amber-100 text-amber-700 border-amber-200", 
    bgColor: "bg-amber-500",
    icon: Activity, 
    trafficLight: "amber" as const,
    description: "Study in progress"
  },
  completed: { 
    label: "Completed", 
    color: "bg-cyan-100 text-cyan-700 border-cyan-200", 
    bgColor: "bg-cyan-500",
    icon: CheckCircle, 
    trafficLight: "amber" as const,
    description: "Study completed, awaiting report"
  },
  "report-ready": { 
    label: "Report Ready", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200", 
    bgColor: "bg-emerald-500",
    icon: FileText, 
    trafficLight: "green" as const,
    description: "Radiologist report available"
  },
  cancelled: { 
    label: "Cancelled", 
    color: "bg-red-100 text-red-700 border-red-200", 
    bgColor: "bg-red-500",
    icon: X, 
    trafficLight: "red" as const,
    description: "Order cancelled"
  },
};

const PRIORITY_CONFIG = {
  routine: { label: "Routine", color: "bg-slate-100 text-slate-600", bgColor: "bg-slate-500" },
  urgent: { label: "Urgent", color: "bg-amber-100 text-amber-700", bgColor: "bg-amber-500" },
  stat: { label: "STAT", color: "bg-red-100 text-red-700 animate-pulse", bgColor: "bg-red-500" },
};

// ============================================
// MAIN COMPONENT
// ============================================

interface UnifiedImagingModuleProps {
  preselectedPatientId?: string;
}

export function UnifiedImagingModule({ preselectedPatientId }: UnifiedImagingModuleProps) {
  const [activeTab, setActiveTab] = useState<string>("new-order");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Patient selection
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Order state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("xray");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("all");
  const [selectedImaging, setSelectedImaging] = useState<{ name: string; code: string; category: string; subcategory: string; contrast: boolean } | null>(null);
  const [orderPriority, setOrderPriority] = useState<string>("routine");
  const [clinicalIndication, setClinicalIndication] = useState("");
  const [useContrast, setUseContrast] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Imaging orders
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ImagingOrder | null>(null);

  // Technician view
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [studyDateTime, setStudyDateTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [technique, setTechnique] = useState("");

  // Radiologist view
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");

  // Dialogs
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [showSaveReport, setShowSaveReport] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Set preselected patient
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  // Fetch orders when tab changes
  useEffect(() => {
    if (activeTab !== "new-order") {
      fetchImagingOrders();
    }
  }, [activeTab, selectedPatientId]);

  const fetchPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const response = await fetch("/api/patients?limit=100");
      const data = await response.json();
      if (data.success) {
        setPatients(data.data.patients);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const fetchImagingOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPatientId) params.append("patientId", selectedPatientId);
      
      // For now, simulate with mock data
      setImagingOrders([]);
    } catch (error) {
      console.error("Error fetching imaging orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Get all imaging types
  const getAllImagingTypes = useCallback(() => {
    const types: Array<{ name: string; code: string; category: string; subcategory: string; contrast: boolean; duration: string }> = [];
    Object.entries(IMAGING_CATALOG).forEach(([catKey, category]) => {
      Object.entries(category.subcategories).forEach(([subKey, subTypes]) => {
        subTypes.forEach(type => {
          types.push({
            name: type.name,
            code: type.code,
            category: catKey,
            subcategory: subKey,
            contrast: type.contrast,
            duration: type.duration,
          });
        });
      });
    });
    return types;
  }, []);

  // Get filtered imaging types
  const getFilteredImagingTypes = () => {
    if (searchQuery) {
      return getAllImagingTypes().filter(type =>
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    const category = IMAGING_CATALOG[activeCategory as keyof typeof IMAGING_CATALOG];
    if (!category) return [];
    
    if (activeSubcategory === "all") {
      return Object.entries(category.subcategories).flatMap(([subKey, types]) =>
        types.map(type => ({
          name: type.name,
          code: type.code,
          category: activeCategory,
          subcategory: subKey,
          contrast: type.contrast,
          duration: type.duration,
        }))
      );
    }
    
    return (category.subcategories[activeSubcategory] || []).map(type => ({
      name: type.name,
      code: type.code,
      category: activeCategory,
      subcategory: activeSubcategory,
      contrast: type.contrast,
      duration: type.duration,
    }));
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newImage: UploadedImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: e.target?.result as string,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          };
          setUploadedImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Remove uploaded image
  const removeImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Submit imaging order
  const submitOrder = async () => {
    if (!selectedPatientId || !selectedImaging) {
      toast({ title: "Error", description: "Please select a patient and imaging type", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // Simulate API call
      const orderNumber = `IMG-${Date.now().toString().slice(-6)}`;
      
      toast({
        title: "Order Submitted",
        description: `Imaging order ${orderNumber} created successfully`,
      });

      setSelectedImaging(null);
      setClinicalIndication("");
      setSpecialInstructions("");
      setUseContrast(false);
      setShowConfirmOrder(false);
      setActiveTab("pending");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit imaging order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Complete study (technician)
  const completeStudy = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);
    try {
      toast({
        title: "Study Completed",
        description: "Imaging study has been marked as completed",
      });
      setSelectedOrder(null);
      setUploadedImages([]);
      setTechnique("");
      fetchImagingOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete study",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save report (radiologist)
  const saveReport = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);
    try {
      toast({
        title: "Report Saved",
        description: "Radiology report has been saved successfully",
      });
      setShowSaveReport(false);
      setSelectedOrder(null);
      setFindings("");
      setImpression("");
      fetchImagingOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save report",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config = IMAGING_STATUS_CONFIG[status as keyof typeof IMAGING_STATUS_CONFIG] || IMAGING_STATUS_CONFIG.ordered;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.routine;
    return <Badge variant="outline" className={config.color}>{config.label.toUpperCase()}</Badge>;
  };

  // Filter orders by status
  const getOrdersByStatus = (status: string) => {
    if (status === "all") return imagingOrders;
    if (status === "pending") return imagingOrders.filter(o => ["ordered", "scheduled", "in-progress"].includes(o.status));
    return imagingOrders.filter(o => o.status === status);
  };

  return (
    <div className="space-y-4">
      {/* Patient Selection Header */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Scan className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Imaging Module</h3>
                <p className="text-sm text-white/80">Comprehensive radiology ordering and reporting</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                disabled={isLoadingPatients}
              >
                <SelectTrigger className="w-[280px] bg-white/20 border-white/30 text-white placeholder:text-white/60">
                  <SelectValue placeholder={isLoadingPatients ? "Loading..." : "Select patient..."} />
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
                <div className="hidden lg:flex items-center gap-3 px-3 py-2 bg-white/10 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-white/30 text-white text-xs">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-white/70">{selectedPatient.gender} • {selectedPatient.mrn}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Alert */}
      <Alert className="bg-cyan-50 border-cyan-200">
        <Eye className="h-4 w-4 text-cyan-600" />
        <AlertTitle className="text-cyan-800">AI-Assisted Imaging Analysis</AlertTitle>
        <AlertDescription className="text-cyan-700">
          All imaging interpretations must be verified by a qualified radiologist before clinical use.
        </AlertDescription>
      </Alert>

      {/* Patient Chain Flow Context - Enhanced */}
      {selectedPatient && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-l-4 border-l-cyan-500 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Patient Quick Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-cyan-200">
                    <AvatarFallback className="bg-cyan-100 text-cyan-700 font-semibold">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h4>
                      <Link2 className="h-4 w-4 text-cyan-500" />
                      <Badge variant="outline" className="text-xs font-mono">{selectedPatient.mrn}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedPatient.gender}
                      </span>
                      {selectedPatient.bloodType && (
                        <span className="flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-red-500" />
                          {selectedPatient.bloodType}
                        </span>
                      )}
                      {selectedPatient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedPatient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Allergies & Conditions */}
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-xs font-medium text-red-700">
                        Allergies: {selectedPatient.allergies.slice(0, 2).join(", ")}
                        {selectedPatient.allergies.length > 2 && ` +${selectedPatient.allergies.length - 2}`}
                      </span>
                    </div>
                  )}
                  {selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg">
                      <Heart className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-medium text-purple-700">
                        {selectedPatient.chronicConditions.slice(0, 2).join(", ")}
                        {selectedPatient.chronicConditions.length > 2 && ` +${selectedPatient.chronicConditions.length - 2}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Status Pipeline - Traffic Light Visibility */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Imaging Order Status Pipeline</span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Ordered
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                In Progress
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Report Ready
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {["ordered", "scheduled", "in-progress", "completed", "report-ready"].map((status, index) => {
              const config = IMAGING_STATUS_CONFIG[status as keyof typeof IMAGING_STATUS_CONFIG];
              const count = imagingOrders.filter(o => o.status === status).length;
              const isActive = count > 0;
              const Icon = config.icon;
              
              return (
                <div key={status} className="flex-1">
                  <div className={cn(
                    "relative flex flex-col items-center p-3 rounded-lg border-2 transition-all",
                    isActive 
                      ? `border-current ${config.trafficLight === 'blue' ? 'border-blue-400 bg-blue-50' : config.trafficLight === 'amber' ? 'border-amber-400 bg-amber-50' : 'border-emerald-400 bg-emerald-50'}`
                      : "border-slate-200 bg-slate-50"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                      isActive ? config.bgColor : "bg-slate-200"
                    )}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      isActive ? "text-slate-700" : "text-slate-400"
                    )}>
                      {config.label}
                    </span>
                    <Badge variant={isActive ? "default" : "outline"} className={cn(
                      "mt-1 text-xs",
                      isActive ? config.color : "text-slate-400"
                    )}>
                      {count}
                    </Badge>
                    {index < 4 && (
                      <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="new-order" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* New Order Tab */}
        <TabsContent value="new-order" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Imaging Type Selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search imaging types..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Category & Subcategory Tabs */}
              {!searchQuery && (
                <div className="space-y-2">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.entries(IMAGING_CATALOG).map(([key, cat]) => {
                      const Icon = cat.icon;
                      return (
                        <Button
                          key={key}
                          variant={activeCategory === key ? "default" : "outline"}
                          className={activeCategory === key ? "bg-gradient-to-r from-cyan-500 to-blue-500" : ""}
                          onClick={() => { setActiveCategory(key); setActiveSubcategory("all"); }}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {cat.name}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={activeSubcategory === "all" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveSubcategory("all")}
                    >
                      All
                    </Button>
                    {Object.keys(IMAGING_CATALOG[activeCategory as keyof typeof IMAGING_CATALOG]?.subcategories || {}).map(sub => (
                      <Button
                        key={sub}
                        variant={activeSubcategory === sub ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setActiveSubcategory(sub)}
                      >
                        {sub}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Imaging Types List */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-1">
                      {getFilteredImagingTypes().map(type => {
                        const isSelected = selectedImaging?.code === type.code;
                        return (
                          <motion.div
                            key={type.code}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedImaging(isSelected ? null : type)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "bg-cyan-50 border-cyan-300"
                                : "bg-white hover:bg-slate-50 border-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center",
                                isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-300"
                              )}>
                                {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{type.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Badge variant="outline" className="text-xs">{type.code}</Badge>
                                  <span>{type.subcategory}</span>
                                  {type.contrast && (
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">Contrast</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">{type.duration}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Order Details */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected Imaging */}
                  {selectedImaging && (
                    <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                      <p className="font-medium text-sm">{selectedImaging.name}</p>
                      <p className="text-xs text-slate-500">{selectedImaging.code}</p>
                    </div>
                  )}

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Priority</Label>
                    <Select value={orderPriority} onValueChange={setOrderPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="stat">STAT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contrast Option */}
                  {selectedImaging && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <Label className="text-sm font-medium">Use Contrast</Label>
                      <Button
                        variant={useContrast ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUseContrast(!useContrast)}
                        className={useContrast ? "bg-amber-500" : ""}
                      >
                        {useContrast ? "Yes" : "No"}
                      </Button>
                    </div>
                  )}

                  {/* Clinical Indication with Voice */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Clinical Indication</Label>
                    <div className="relative">
                      <Textarea
                        placeholder="Reason for imaging, relevant history..."
                        value={clinicalIndication}
                        onChange={e => setClinicalIndication(e.target.value)}
                        rows={3}
                        className="pr-10"
                      />
                      <div className="absolute right-2 top-2">
                        <VoiceInputButton
                          onTranscript={setClinicalIndication}
                          currentValue={clinicalIndication}
                          context="consultation"
                          size="sm"
                          variant="ghost"
                          showStatus={false}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Special Instructions</Label>
                    <div className="relative">
                      <Textarea
                        placeholder="Any special requirements..."
                        value={specialInstructions}
                        onChange={e => setSpecialInstructions(e.target.value)}
                        rows={2}
                        className="pr-10"
                      />
                      <div className="absolute right-2 top-2">
                        <VoiceInputButton
                          onTranscript={setSpecialInstructions}
                          currentValue={specialInstructions}
                          context="consultation"
                          size="sm"
                          variant="ghost"
                          showStatus={false}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedImaging(null);
                        setClinicalIndication("");
                        setSpecialInstructions("");
                        setUseContrast(false);
                      }}
                      disabled={!selectedImaging}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                      onClick={() => setShowConfirmOrder(true)}
                      disabled={!selectedImaging || isSaving || !selectedPatientId}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : selectedOrder ? (
            // Technician/Radiologist View
            <div className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Order: {selectedOrder.orderNumber}</CardTitle>
                      <CardDescription>
                        {selectedOrder.imagingType} - Patient: {selectedOrder.patient.firstName} {selectedOrder.patient.lastName}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(selectedOrder.status)}
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                        <X className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Image Upload / Viewing */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-cyan-500" />
                      Study Images
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Upload Area */}
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadedImages.length === 0 ? (
                        <>
                          <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">Click to upload DICOM, JPEG, PNG</p>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {uploadedImages.map(img => (
                            <div key={img.id} className="relative group">
                              <img src={img.url} alt="Study" className="w-full h-24 object-cover rounded" />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex items-center justify-center h-24 border-2 border-dashed rounded">
                            <Plus className="h-6 w-6 text-slate-400" />
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.dcm"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Study Date/Time */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Study Date/Time</Label>
                      <Input
                        type="datetime-local"
                        value={studyDateTime}
                        onChange={e => setStudyDateTime(e.target.value)}
                      />
                    </div>

                    {/* Technique */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Technique</Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Imaging technique used..."
                          value={technique}
                          onChange={e => setTechnique(e.target.value)}
                          rows={2}
                          className="pr-10"
                        />
                        <div className="absolute right-2 top-2">
                          <VoiceInputButton
                            onTranscript={setTechnique}
                            currentValue={technique}
                            context="consultation"
                            size="sm"
                            variant="ghost"
                            showStatus={false}
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      onClick={completeStudy}
                      disabled={uploadedImages.length === 0 || isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Complete Study
                    </Button>
                  </CardContent>
                </Card>

                {/* Reporting Section */}
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PenTool className="h-5 w-5 text-purple-500" />
                      Radiology Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Findings */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Findings</Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Detailed description of findings..."
                          value={findings}
                          onChange={e => setFindings(e.target.value)}
                          rows={6}
                          className="pr-10"
                        />
                        <div className="absolute right-2 top-2">
                          <VoiceInputButton
                            onTranscript={setFindings}
                            currentValue={findings}
                            context="consultation"
                            size="sm"
                            variant="ghost"
                            showStatus={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Impression */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Impression</Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Summary and diagnosis..."
                          value={impression}
                          onChange={e => setImpression(e.target.value)}
                          rows={3}
                          className="pr-10"
                        />
                        <div className="absolute right-2 top-2">
                          <VoiceInputButton
                            onTranscript={setImpression}
                            currentValue={impression}
                            context="consultation"
                            size="sm"
                            variant="ghost"
                            showStatus={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/* AI Analysis Button */}
                    <Button variant="outline" className="w-full" disabled={!uploadedImages.length}>
                      <Brain className="h-4 w-4 mr-2" />
                      AI Analysis
                    </Button>

                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      onClick={() => setShowSaveReport(true)}
                      disabled={(!findings && !impression) || isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Report
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            // Pending Orders List
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pending Studies</CardTitle>
                    <CardDescription>Studies awaiting completion</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchImagingOrders}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {getOrdersByStatus("pending").length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <CheckCircle className="h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">No pending imaging studies</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {getOrdersByStatus("pending").map(order => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarFallback className="bg-cyan-100 text-cyan-700">
                                {order.patient.firstName[0]}{order.patient.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-mono">{order.orderNumber}</Badge>
                                {getPriorityBadge(order.priority)}
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{order.imagingType}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-cyan-500 hover:bg-cyan-600"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Scan className="h-4 w-4 mr-1" />
                            Process
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed" className="mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Completed Studies</CardTitle>
              <CardDescription>Studies with reports ready</CardDescription>
            </CardHeader>
            <CardContent>
              {getOrdersByStatus("completed").length === 0 && getOrdersByStatus("report-ready").length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <FileText className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No completed studies</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {[...getOrdersByStatus("completed"), ...getOrdersByStatus("report-ready")].map(order => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback className="bg-emerald-100 text-emerald-700">
                              {order.patient.firstName[0]}{order.patient.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-mono">{order.orderNumber}</Badge>
                              {getStatusBadge(order.status)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{order.imagingType}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Imaging History</CardTitle>
                  <CardDescription>All imaging orders</CardDescription>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {imagingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <History className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No imaging orders found</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {imagingOrders.map(order => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback className="bg-slate-100 text-slate-600">
                              {order.patient.firstName[0]}{order.patient.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-mono">{order.orderNumber}</Badge>
                              {getPriorityBadge(order.priority)}
                              {getStatusBadge(order.status)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{order.imagingType}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Order Dialog */}
      <Dialog open={showConfirmOrder} onOpenChange={setShowConfirmOrder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Imaging Order</DialogTitle>
            <DialogDescription>Review before submitting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm"><strong>Patient:</strong> {selectedPatient?.firstName} {selectedPatient?.lastName}</p>
              <p className="text-sm"><strong>Study:</strong> {selectedImaging?.name}</p>
              <p className="text-sm"><strong>Priority:</strong> {orderPriority.toUpperCase()}</p>
              <p className="text-sm"><strong>Contrast:</strong> {useContrast ? "Yes" : "No"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmOrder(false)}>Cancel</Button>
            <Button 
              className="bg-gradient-to-r from-cyan-500 to-blue-500"
              onClick={submitOrder} 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Report Dialog */}
      <Dialog open={showSaveReport} onOpenChange={setShowSaveReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
            <DialogDescription>Confirm report details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm"><strong>Order:</strong> {selectedOrder?.orderNumber}</p>
              <p className="text-sm"><strong>Patient:</strong> {selectedOrder?.patient.firstName} {selectedOrder?.patient.lastName}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveReport(false)}>Cancel</Button>
            <Button 
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
              onClick={saveReport} 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UnifiedImagingModule;
