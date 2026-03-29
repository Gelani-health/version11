"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Beaker,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Loader2,
  TestTube,
  Droplets,
  Activity,
  User,
  Calendar,
  FileText,
  FlaskConical,
  ClipboardList,
  Check,
  X,
  Send,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronRight,
  Printer,
  Filter,
  Zap,
  History,
  Upload,
  Image as ImageIcon,
  Microscope,
  Heart,
  Brain,
  Bone,
  Shield,
  FileUp,
  Paperclip,
  XCircle,
  Link2,
  ChevronUp,
  Phone,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VoiceInputButton } from "@/components/voice-input-button";

// ============================================
// COMPREHENSIVE LAB TEST CATALOG
// ============================================

const LAB_TEST_CATALOG = {
  haematology: {
    name: "Haematology",
    icon: Droplets,
    color: "text-red-500",
    bgColor: "bg-red-50",
    subcategories: {
      CBC: [
        { name: "Hemoglobin (Hb)", code: "HGB", unit: "g/dL", maleRange: "13.5-17.5", femaleRange: "12.0-16.0" },
        { name: "Hematocrit (Hct)", code: "HCT", unit: "%", maleRange: "40-54", femaleRange: "36-48" },
        { name: "RBC Count", code: "RBC", unit: "x10^6/µL", maleRange: "4.5-5.9", femaleRange: "4.0-5.2" },
        { name: "WBC Count", code: "WBC", unit: "x10^3/µL", maleRange: "4.5-11.0", femaleRange: "4.5-11.0" },
        { name: "Platelet Count", code: "PLT", unit: "x10^3/µL", maleRange: "150-400", femaleRange: "150-400" },
        { name: "MCV", code: "MCV", unit: "fL", maleRange: "80-100", femaleRange: "80-100" },
        { name: "MCH", code: "MCH", unit: "pg", maleRange: "27-33", femaleRange: "27-33" },
        { name: "MCHC", code: "MCHC", unit: "g/dL", maleRange: "32-36", femaleRange: "32-36" },
        { name: "RDW", code: "RDW", unit: "%", maleRange: "11.5-14.5", femaleRange: "11.5-14.5" },
      ],
      Differential: [
        { name: "Neutrophils %", code: "NEUT%", unit: "%", maleRange: "40-75", femaleRange: "40-75" },
        { name: "Lymphocytes %", code: "LYMPH%", unit: "%", maleRange: "20-45", femaleRange: "20-45" },
        { name: "Monocytes %", code: "MONO%", unit: "%", maleRange: "2-10", femaleRange: "2-10" },
        { name: "Eosinophils %", code: "EOS%", unit: "%", maleRange: "0-6", femaleRange: "0-6" },
        { name: "Basophils %", code: "BASO%", unit: "%", maleRange: "0-2", femaleRange: "0-2" },
        { name: "Neutrophil Count", code: "NEUT#", unit: "x10^3/µL", maleRange: "1.8-7.5", femaleRange: "1.8-7.5" },
        { name: "Lymphocyte Count", code: "LYMPH#", unit: "x10^3/µL", maleRange: "1.0-4.0", femaleRange: "1.0-4.0" },
      ],
      Coagulation: [
        { name: "Prothrombin Time (PT)", code: "PT", unit: "sec", maleRange: "11-13.5", femaleRange: "11-13.5" },
        { name: "INR", code: "INR", unit: "", maleRange: "0.9-1.2", femaleRange: "0.9-1.2" },
        { name: "APTT", code: "APTT", unit: "sec", maleRange: "25-35", femaleRange: "25-35" },
        { name: "D-Dimer", code: "DDIMER", unit: "ng/mL", maleRange: "<500", femaleRange: "<500" },
        { name: "Fibrinogen", code: "FIB", unit: "mg/dL", maleRange: "200-400", femaleRange: "200-400" },
      ],
      Special: [
        { name: "ESR", code: "ESR", unit: "mm/hr", maleRange: "0-15", femaleRange: "0-20" },
        { name: "Reticulocyte Count", code: "RETIC", unit: "%", maleRange: "0.5-2.5", femaleRange: "0.5-2.5" },
        { name: "Peripheral Blood Smear", code: "PBS", unit: "", maleRange: "Normal", femaleRange: "Normal" },
        { name: "Blood Group", code: "BG", unit: "", maleRange: "", femaleRange: "" },
        { name: "Rh Typing", code: "RH", unit: "", maleRange: "", femaleRange: "" },
        { name: "Sickle Cell Test", code: "SICKLE", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "G6PD Screening", code: "G6PD", unit: "U/g Hb", maleRange: "4.6-13.5", femaleRange: "4.6-13.5" },
      ],
    },
  },
  chemistry: {
    name: "Clinical Chemistry",
    icon: TestTube,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    subcategories: {
      Renal: [
        { name: "Blood Urea Nitrogen (BUN)", code: "BUN", unit: "mg/dL", maleRange: "7-20", femaleRange: "7-20" },
        { name: "Creatinine", code: "CREA", unit: "mg/dL", maleRange: "0.7-1.3", femaleRange: "0.6-1.1" },
        { name: "eGFR", code: "eGFR", unit: "mL/min", maleRange: ">90", femaleRange: ">90" },
        { name: "Uric Acid", code: "URIC", unit: "mg/dL", maleRange: "3.5-7.2", femaleRange: "2.6-6.0" },
        { name: "BUN/Creatinine Ratio", code: "BUNCR", unit: "", maleRange: "10-20", femaleRange: "10-20" },
      ],
      Electrolytes: [
        { name: "Sodium", code: "NA", unit: "mmol/L", maleRange: "136-145", femaleRange: "136-145" },
        { name: "Potassium", code: "K", unit: "mmol/L", maleRange: "3.5-5.0", femaleRange: "3.5-5.0" },
        { name: "Chloride", code: "CL", unit: "mmol/L", maleRange: "98-107", femaleRange: "98-107" },
        { name: "Bicarbonate", code: "HCO3", unit: "mmol/L", maleRange: "22-28", femaleRange: "22-28" },
        { name: "Anion Gap", code: "AG", unit: "mmol/L", maleRange: "8-16", femaleRange: "8-16" },
      ],
      Liver: [
        { name: "ALT (SGPT)", code: "ALT", unit: "U/L", maleRange: "7-56", femaleRange: "7-56" },
        { name: "AST (SGOT)", code: "AST", unit: "U/L", maleRange: "10-40", femaleRange: "10-40" },
        { name: "ALP", code: "ALP", unit: "U/L", maleRange: "44-147", femaleRange: "44-147" },
        { name: "GGT", code: "GGT", unit: "U/L", maleRange: "9-48", femaleRange: "7-32" },
        { name: "Total Bilirubin", code: "TBIL", unit: "mg/dL", maleRange: "0.3-1.2", femaleRange: "0.3-1.2" },
        { name: "Direct Bilirubin", code: "DBIL", unit: "mg/dL", maleRange: "0.0-0.3", femaleRange: "0.0-0.3" },
        { name: "Total Protein", code: "TP", unit: "g/dL", maleRange: "6.0-8.3", femaleRange: "6.0-8.3" },
        { name: "Albumin", code: "ALB", unit: "g/dL", maleRange: "3.5-5.5", femaleRange: "3.5-5.5" },
      ],
      Cardiac: [
        { name: "Troponin I", code: "TROPI", unit: "ng/mL", maleRange: "<0.04", femaleRange: "<0.04" },
        { name: "Troponin T", code: "TROPT", unit: "ng/mL", maleRange: "<0.01", femaleRange: "<0.01" },
        { name: "CK-MB", code: "CKMB", unit: "U/L", maleRange: "0-25", femaleRange: "0-25" },
        { name: "CK Total", code: "CK", unit: "U/L", maleRange: "30-200", femaleRange: "30-150" },
        { name: "BNP", code: "BNP", unit: "pg/mL", maleRange: "<100", femaleRange: "<100" },
        { name: "LDH", code: "LDH", unit: "U/L", maleRange: "140-280", femaleRange: "140-280" },
      ],
      Lipid: [
        { name: "Total Cholesterol", code: "CHOL", unit: "mg/dL", maleRange: "<200", femaleRange: "<200" },
        { name: "HDL Cholesterol", code: "HDL", unit: "mg/dL", maleRange: ">40", femaleRange: ">50" },
        { name: "LDL Cholesterol", code: "LDL", unit: "mg/dL", maleRange: "<100", femaleRange: "<100" },
        { name: "Triglycerides", code: "TG", unit: "mg/dL", maleRange: "<150", femaleRange: "<150" },
        { name: "VLDL", code: "VLDL", unit: "mg/dL", maleRange: "5-40", femaleRange: "5-40" },
      ],
      Thyroid: [
        { name: "TSH", code: "TSH", unit: "mIU/L", maleRange: "0.4-4.0", femaleRange: "0.4-4.0" },
        { name: "Free T4", code: "FT4", unit: "ng/dL", maleRange: "0.8-1.8", femaleRange: "0.8-1.8" },
        { name: "Free T3", code: "FT3", unit: "pg/mL", maleRange: "2.3-4.2", femaleRange: "2.3-4.2" },
        { name: "Total T4", code: "TT4", unit: "µg/dL", maleRange: "4.5-12.5", femaleRange: "4.5-12.5" },
        { name: "Total T3", code: "TT3", unit: "ng/dL", maleRange: "80-200", femaleRange: "80-200" },
      ],
      Diabetes: [
        { name: "Fasting Glucose", code: "FBG", unit: "mg/dL", maleRange: "70-100", femaleRange: "70-100" },
        { name: "Random Glucose", code: "RBG", unit: "mg/dL", maleRange: "<140", femaleRange: "<140" },
        { name: "HbA1c", code: "HBA1C", unit: "%", maleRange: "4.0-5.6", femaleRange: "4.0-5.6" },
        { name: "Fructosamine", code: "FRUCT", unit: "µmol/L", maleRange: "200-285", femaleRange: "200-285" },
      ],
      Minerals: [
        { name: "Calcium (Total)", code: "CA", unit: "mg/dL", maleRange: "8.5-10.5", femaleRange: "8.5-10.5" },
        { name: "Calcium (Ionized)", code: "CAI", unit: "mmol/L", maleRange: "1.12-1.32", femaleRange: "1.12-1.32" },
        { name: "Phosphorus", code: "PHOS", unit: "mg/dL", maleRange: "2.5-4.5", femaleRange: "2.5-4.5" },
        { name: "Magnesium", code: "MG", unit: "mg/dL", maleRange: "1.7-2.2", femaleRange: "1.7-2.2" },
        { name: "Iron", code: "FE", unit: "µg/dL", maleRange: "65-175", femaleRange: "50-170" },
        { name: "Ferritin", code: "FERR", unit: "ng/mL", maleRange: "20-250", femaleRange: "10-120" },
        { name: "TIBC", code: "TIBC", unit: "µg/dL", maleRange: "250-450", femaleRange: "250-450" },
      ],
      Vitamins: [
        { name: "Vitamin B12", code: "B12", unit: "pg/mL", maleRange: "200-900", femaleRange: "200-900" },
        { name: "Folate", code: "FOLATE", unit: "ng/mL", maleRange: "3-17", femaleRange: "3-17" },
        { name: "Vitamin D (25-OH)", code: "VITD", unit: "ng/mL", maleRange: "30-100", femaleRange: "30-100" },
      ],
    },
  },
  urinalysis: {
    name: "Urinalysis",
    icon: Activity,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    subcategories: {
      Physical: [
        { name: "Color", code: "UCOLOR", unit: "", maleRange: "Yellow", femaleRange: "Yellow" },
        { name: "Appearance", code: "UAPPEAR", unit: "", maleRange: "Clear", femaleRange: "Clear" },
        { name: "Specific Gravity", code: "USG", unit: "", maleRange: "1.005-1.030", femaleRange: "1.005-1.030" },
        { name: "pH", code: "UPH", unit: "", maleRange: "4.6-8.0", femaleRange: "4.6-8.0" },
      ],
      Chemical: [
        { name: "Protein", code: "UPROT", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Glucose", code: "UGLU", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Ketones", code: "UKET", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Blood", code: "UBLD", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Leukocytes", code: "ULEU", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Nitrite", code: "UNITR", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Bilirubin", code: "UBIL", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Urobilinogen", code: "URO", unit: "EU/dL", maleRange: "0.2-1.0", femaleRange: "0.2-1.0" },
      ],
      Microscopic: [
        { name: "RBC", code: "URBC", unit: "/HPF", maleRange: "0-3", femaleRange: "0-3" },
        { name: "WBC", code: "UWBC", unit: "/HPF", maleRange: "0-5", femaleRange: "0-5" },
        { name: "Epithelial Cells", code: "UEPI", unit: "/HPF", maleRange: "0-5", femaleRange: "0-5" },
        { name: "Casts", code: "UCAST", unit: "/LPF", maleRange: "0-2 hyaline", femaleRange: "0-2 hyaline" },
        { name: "Crystals", code: "UCRYST", unit: "", maleRange: "None", femaleRange: "None" },
        { name: "Bacteria", code: "UBACT", unit: "", maleRange: "None", femaleRange: "None" },
      ],
    },
  },
  immunology: {
    name: "Immunology/Serology",
    icon: Shield,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    subcategories: {
      Serology: [
        { name: "CRP", code: "CRP", unit: "mg/L", maleRange: "<10", femaleRange: "<10" },
        { name: "ESR", code: "ESR", unit: "mm/hr", maleRange: "0-15", femaleRange: "0-20" },
        { name: "Rheumatoid Factor", code: "RF", unit: "IU/mL", maleRange: "<20", femaleRange: "<20" },
        { name: "ANA", code: "ANA", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "ASO Titer", code: "ASO", unit: "IU/mL", maleRange: "<200", femaleRange: "<200" },
      ],
      Viral: [
        { name: "HIV 1/2", code: "HIV", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Hepatitis B Surface Ag", code: "HBSAG", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Hepatitis C Antibody", code: "HCVAB", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Hepatitis A IgM", code: "HAVIGM", unit: "", maleRange: "Negative", femaleRange: "Negative" },
      ],
      Other: [
        { name: "IgA", code: "IGA", unit: "mg/dL", maleRange: "70-400", femaleRange: "70-400" },
        { name: "IgG", code: "IGG", unit: "mg/dL", maleRange: "700-1600", femaleRange: "700-1600" },
        { name: "IgM", code: "IGM", unit: "mg/dL", maleRange: "40-230", femaleRange: "40-230" },
        { name: "C3 Complement", code: "C3", unit: "mg/dL", maleRange: "90-180", femaleRange: "90-180" },
        { name: "C4 Complement", code: "C4", unit: "mg/dL", maleRange: "10-40", femaleRange: "10-40" },
      ],
    },
  },
  microbiology: {
    name: "Microbiology",
    icon: Microscope,
    color: "text-green-500",
    bgColor: "bg-green-50",
    subcategories: {
      Culture: [
        { name: "Blood Culture", code: "BC", unit: "", maleRange: "No growth", femaleRange: "No growth" },
        { name: "Urine Culture", code: "UC", unit: "", maleRange: "No growth", femaleRange: "No growth" },
        { name: "Sputum Culture", code: "SC", unit: "", maleRange: "Normal flora", femaleRange: "Normal flora" },
        { name: "Wound Culture", code: "WC", unit: "", maleRange: "No growth", femaleRange: "No growth" },
        { name: "Stool Culture", code: "STC", unit: "", maleRange: "No enteric pathogens", femaleRange: "No enteric pathogens" },
      ],
      Sensitivity: [
        { name: "Antibiotic Sensitivity", code: "SENS", unit: "", maleRange: "", femaleRange: "" },
        { name: "MRSA Screen", code: "MRSA", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "VRE Screen", code: "VRE", unit: "", maleRange: "Negative", femaleRange: "Negative" },
      ],
      Stains: [
        { name: "Gram Stain", code: "GRAM", unit: "", maleRange: "", femaleRange: "" },
        { name: "AFB Stain", code: "AFB", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "KOH Prep", code: "KOH", unit: "", maleRange: "Negative", femaleRange: "Negative" },
      ],
    },
  },
  pathology: {
    name: "Pathology/Cytology",
    icon: Microscope,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    subcategories: {
      Cytology: [
        { name: "Pap Smear", code: "PAP", unit: "", maleRange: "Negative", femaleRange: "Negative" },
        { name: "Fine Needle Aspiration", code: "FNA", unit: "", maleRange: "", femaleRange: "" },
        { name: "Body Fluid Analysis", code: "BFA", unit: "", maleRange: "", femaleRange: "" },
      ],
      Histopathology: [
        { name: "Tissue Biopsy", code: "BIOPSY", unit: "", maleRange: "", femaleRange: "" },
        { name: "Skin Biopsy", code: "SKINB", unit: "", maleRange: "", femaleRange: "" },
        { name: "Lymph Node Biopsy", code: "LNB", unit: "", maleRange: "", femaleRange: "" },
      ],
    },
  },
};

// Quick Lab Panels
const LAB_PANELS = [
  { id: "cbc", name: "Complete Blood Count (CBC)", category: "haematology", subcategory: "CBC", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "RDW"] },
  { id: "cbc-diff", name: "CBC with Differential", category: "haematology", subcategory: "CBC", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "NEUT%", "LYMPH%", "MONO%", "EOS%", "BASO%"] },
  { id: "bmp", name: "Basic Metabolic Panel (BMP)", category: "chemistry", subcategory: "Electrolytes", tests: ["NA", "K", "CL", "HCO3", "BUN", "CREA", "FBG", "CA"] },
  { id: "cmp", name: "Comprehensive Metabolic Panel (CMP)", category: "chemistry", subcategory: "Renal", tests: ["NA", "K", "CL", "HCO3", "BUN", "CREA", "FBG", "CA", "ALB", "TP", "ALT", "AST", "ALP", "TBIL"] },
  { id: "lfp", name: "Liver Function Panel", category: "chemistry", subcategory: "Liver", tests: ["ALT", "AST", "ALP", "GGT", "TBIL", "DBIL", "TP", "ALB"] },
  { id: "lipid", name: "Lipid Profile", category: "chemistry", subcategory: "Lipid", tests: ["CHOL", "HDL", "LDL", "TG", "VLDL"] },
  { id: "thyroid", name: "Thyroid Panel", category: "chemistry", subcategory: "Thyroid", tests: ["TSH", "FT4", "FT3"] },
  { id: "cardiac", name: "Cardiac Panel", category: "chemistry", subcategory: "Cardiac", tests: ["TROPI", "CKMB", "CK", "BNP"] },
  { id: "renal", name: "Renal Function Panel", category: "chemistry", subcategory: "Renal", tests: ["BUN", "CREA", "eGFR", "URIC", "NA", "K", "CL"] },
  { id: "electrolytes", name: "Electrolyte Panel", category: "chemistry", subcategory: "Electrolytes", tests: ["NA", "K", "CL", "HCO3", "AG"] },
  { id: "diabetes", name: "Diabetes Panel", category: "chemistry", subcategory: "Diabetes", tests: ["FBG", "HBA1C"] },
  { id: "iron", name: "Iron Studies", category: "chemistry", subcategory: "Minerals", tests: ["FE", "FERR", "TIBC"] },
  { id: "coag", name: "Coagulation Panel", category: "haematology", subcategory: "Coagulation", tests: ["PT", "INR", "APTT", "FIB"] },
  { id: "urinalysis", name: "Complete Urinalysis", category: "urinalysis", subcategory: "Physical", tests: ["UCOLOR", "UAPPEAR", "USG", "UPH", "UPROT", "UGLU", "UKET", "UBLD", "ULEU", "URBC", "UWBC"] },
];

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

interface LabResultFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  dataUrl?: string;
}

interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: Patient;
  orderDate: string;
  priority: string;
  status: string;
  clinicalNotes?: string;
  diagnosis?: string;
  orderedBy?: string;
  sampleCollected: boolean;
  collectedAt?: string;
  collectedBy?: string;
  orderItems: LabOrderItem[];
  resultFiles?: LabResultFile[];
  overallNotes?: string;
}

interface LabOrderItem {
  id: string;
  testName: string;
  testCode?: string;
  category?: string;
  subcategory?: string;
  unit?: string;
  referenceRange?: string;
  status: string;
  resultValue?: string;
  interpretation?: string;
  resultNotes?: string;
  resultEnteredAt?: string;
  enteredBy?: string;
  resultFiles?: LabResultFile[];
}

interface SelectedTest {
  name: string;
  code: string;
  category: string;
  subcategory: string;
  unit: string;
  referenceRange: string;
}

// ============================================
// STATUS HELPERS - Traffic Light System
// ============================================

// Traffic Light Colors: Blue (Ordered), Amber (Pending/In Progress), Green (Completed)
const STATUS_CONFIG = {
  ordered: { 
    label: "Ordered", 
    color: "bg-blue-100 text-blue-700 border-blue-200", 
    bgColor: "bg-blue-500",
    icon: ClipboardList,
    trafficLight: "blue" as const,
    description: "Order placed, awaiting sample collection"
  },
  collected: { 
    label: "Collected", 
    color: "bg-purple-100 text-purple-700 border-purple-200", 
    bgColor: "bg-purple-500",
    icon: Droplets,
    trafficLight: "amber" as const,
    description: "Sample collected, awaiting processing"
  },
  "in-lab": { 
    label: "In Lab", 
    color: "bg-amber-100 text-amber-700 border-amber-200", 
    bgColor: "bg-amber-500",
    icon: FlaskConical,
    trafficLight: "amber" as const,
    description: "Sample being processed in laboratory"
  },
  completed: { 
    label: "Completed", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200", 
    bgColor: "bg-emerald-500",
    icon: CheckCircle,
    trafficLight: "green" as const,
    description: "Results available"
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

interface UnifiedLabModuleProps {
  preselectedPatientId?: string;
}

export function UnifiedLabModule({ preselectedPatientId }: UnifiedLabModuleProps) {
  const [activeTab, setActiveTab] = useState<string>("orders");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Patient selection
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Lab Order State
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [orderPriority, setOrderPriority] = useState<string>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("haematology");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Lab Orders State
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [resultNotes, setResultNotes] = useState<Record<string, string>>({});
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [resultDateTime, setResultDateTime] = useState<string>(new Date().toISOString().slice(0, 16));

  // Dialogs
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [showConfirmResults, setShowConfirmResults] = useState(false);

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

  // Fetch orders when tab changes or patient changes
  useEffect(() => {
    if (activeTab !== "orders" && activeTab !== "new-order") {
      fetchLabOrders();
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

  const fetchLabOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPatientId) params.append("patientId", selectedPatientId);
      
      const response = await fetch(`/api/lab-orders?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setLabOrders(data.data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Get all tests from catalog
  const getAllTests = useCallback(() => {
    const tests: Array<{ name: string; code: string; category: string; subcategory: string; unit: string; maleRange: string; femaleRange: string }> = [];
    Object.entries(LAB_TEST_CATALOG).forEach(([catKey, category]) => {
      Object.entries(category.subcategories).forEach(([subKey, subTests]) => {
        subTests.forEach(test => {
          tests.push({
            ...test,
            category: catKey,
            subcategory: subKey,
          });
        });
      });
    });
    return tests;
  }, []);

  // Add test to selection
  const addTest = (test: { name: string; code: string; unit: string; maleRange: string; femaleRange: string }, categoryName: string, subcategoryName: string) => {
    const exists = selectedTests.some(t => t.code === test.code);
    if (exists) {
      setSelectedTests(prev => prev.filter(t => t.code !== test.code));
    } else {
      const refRange = selectedPatient?.gender === "female" ? test.femaleRange : test.maleRange;
      setSelectedTests(prev => [...prev, {
        name: test.name,
        code: test.code,
        category: categoryName,
        subcategory: subcategoryName,
        unit: test.unit,
        referenceRange: refRange,
      }]);
    }
  };

  // Add panel
  const addPanel = (panel: typeof LAB_PANELS[0]) => {
    const categoryTests = LAB_TEST_CATALOG[panel.category as keyof typeof LAB_TEST_CATALOG]?.subcategories[panel.subcategory as keyof typeof LAB_TEST_CATALOG.haematology.subcategories] || [];
    
    let addedCount = 0;
    panel.tests.forEach(code => {
      const test = categoryTests.find(t => t.code === code) || getAllTests().find(t => t.code === code);
      if (test && !selectedTests.some(s => s.code === code)) {
        const refRange = selectedPatient?.gender === "female" ? test.femaleRange : test.maleRange;
        setSelectedTests(prev => [...prev, {
          name: test.name,
          code: test.code,
          category: panel.category,
          subcategory: panel.subcategory,
          unit: test.unit,
          referenceRange: refRange,
        }]);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast({
        title: "Panel Added",
        description: `${panel.name}: ${addedCount} tests added`,
      });
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTests([]);
    setClinicalNotes("");
    setDiagnosis("");
  };

  // Submit lab order
  const submitOrder = async () => {
    if (!selectedPatientId) {
      toast({ title: "Error", description: "Please select a patient first", variant: "destructive" });
      return;
    }
    
    if (selectedTests.length === 0) {
      toast({ title: "Error", description: "Please select at least one test", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/lab-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          priority: orderPriority,
          clinicalNotes,
          diagnosis,
          tests: selectedTests,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Order Submitted",
          description: `Lab order ${data.data.orderNumber} created successfully`,
        });
        clearSelection();
        setShowConfirmOrder(false);
        setActiveTab("pending");
        fetchLabOrders();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit lab order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Collect sample
  const collectSample = async (orderId: string) => {
    try {
      const response = await fetch("/api/lab-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action: "collectSample",
          data: { collectedBy: "Lab Tech" },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sample Collected",
          description: "Sample has been collected",
        });
        fetchLabOrders();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sample status",
        variant: "destructive",
      });
    }
  };

  // Update result value
  const updateResultValue = (itemId: string, value: string) => {
    setResultValues(prev => ({ ...prev, [itemId]: value }));
  };

  // Interpret result
  const interpretResult = (value: string, refRange: string): "normal" | "abnormal" | "critical" | "pending" => {
    if (!value || !refRange) return "pending";
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      const lowerValue = value.toLowerCase().trim();
      const lowerRef = refRange.toLowerCase();
      if (lowerRef.includes("negative") && lowerValue === "negative") return "normal";
      if (lowerRef.includes("negative") && lowerValue !== "negative") return "abnormal";
      if (lowerRef.includes("normal") && lowerValue === "normal") return "normal";
      return "pending";
    }

    if (refRange.includes("-")) {
      const [minStr, maxStr] = refRange.split("-").map(s => s.trim());
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr);
      
      if (!isNaN(min) && !isNaN(max)) {
        if (numValue < min * 0.7 || numValue > max * 1.3) return "critical";
        if (numValue < min || numValue > max) return "abnormal";
        return "normal";
      }
    } else if (refRange.startsWith("<")) {
      const threshold = parseFloat(refRange.substring(1));
      if (!isNaN(threshold)) {
        if (numValue > threshold * 1.5) return "critical";
        return numValue < threshold ? "normal" : "abnormal";
      }
    } else if (refRange.startsWith(">")) {
      const threshold = parseFloat(refRange.substring(1));
      if (!isNaN(threshold)) {
        if (numValue < threshold * 0.5) return "critical";
        return numValue > threshold ? "normal" : "abnormal";
      }
    }

    return "pending";
  };

  // Save results
  const saveResults = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);
    try {
      const updates = selectedOrder.orderItems.map(item => ({
        itemId: item.id,
        resultValue: resultValues[item.id] || "",
        interpretation: interpretResult(resultValues[item.id] || "", item.referenceRange || ""),
        resultNotes: resultNotes[item.id] || "",
      }));

      for (const update of updates) {
        if (update.resultValue) {
          await fetch("/api/lab-orders", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: update.itemId,
              action: "updateItemResult",
              data: {
                resultValue: update.resultValue,
                interpretation: update.interpretation,
                resultNotes: update.resultNotes,
                status: "completed",
                enteredBy: "Lab Tech",
                resultDateTime: resultDateTime,
              },
            }),
          });
        }
      }

      toast({
        title: "Results Saved",
        description: "Lab results have been saved successfully",
      });
      
      setShowConfirmResults(false);
      setSelectedOrder(null);
      setResultValues({});
      setResultNotes({});
      setTechnicianNotes("");
      fetchLabOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save results",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get filtered tests
  const getFilteredTests = () => {
    if (searchQuery) {
      return getAllTests().filter(test =>
        test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    const category = LAB_TEST_CATALOG[activeCategory as keyof typeof LAB_TEST_CATALOG];
    if (!category) return [];
    
    if (activeSubcategory === "all") {
      return Object.entries(category.subcategories).flatMap(([subKey, tests]) =>
        tests.map(test => ({ ...test, category: activeCategory, subcategory: subKey }))
      );
    }
    
    return (category.subcategories[activeSubcategory] || []).map(test => ({
      ...test,
      category: activeCategory,
      subcategory: activeSubcategory,
    }));
  };

  // Get interpretation badge
  const getInterpretationBadge = (interpretation: string) => {
    switch (interpretation) {
      case "normal":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Normal</Badge>;
      case "abnormal":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Abnormal</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse"><AlertCircle className="h-3 w-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ordered;
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
    if (status === "all") return labOrders;
    if (status === "pending") return labOrders.filter(o => ["ordered", "collected", "in-lab"].includes(o.status));
    return labOrders.filter(o => o.status === status);
  };

  return (
    <div className="space-y-4">
      {/* Patient Selection Header */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 text-white">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Laboratory Module</h3>
                <p className="text-sm text-white/80">Comprehensive lab test ordering and results management</p>
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

      {/* Patient Chain Flow Context - Enhanced */}
      {selectedPatient && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-l-4 border-l-emerald-500 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Patient Quick Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-emerald-200">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h4>
                      <Link2 className="h-4 w-4 text-emerald-500" />
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
            <span className="text-sm font-medium text-slate-600">Lab Order Status Pipeline</span>
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
                Completed
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {["ordered", "collected", "in-lab", "completed"].map((status, index) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              const count = labOrders.filter(o => o.status === status).length;
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
                    {index < 3 && (
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
            Pending Results
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
          {/* Quick Panels */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-600">Quick Panels:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {LAB_PANELS.map(panel => (
                  <Button
                    key={panel.id}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                    onClick={() => addPanel(panel)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {panel.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Test Selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search tests by name or code..."
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
                    {Object.entries(LAB_TEST_CATALOG).map(([key, cat]) => {
                      const Icon = cat.icon;
                      return (
                        <Button
                          key={key}
                          variant={activeCategory === key ? "default" : "outline"}
                          className={activeCategory === key ? "bg-gradient-to-r from-blue-500 to-purple-500" : ""}
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
                    {Object.keys(LAB_TEST_CATALOG[activeCategory as keyof typeof LAB_TEST_CATALOG]?.subcategories || {}).map(sub => (
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

              {/* Tests List */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-1">
                      {getFilteredTests().map(test => {
                        const isSelected = selectedTests.some(t => t.code === test.code);
                        const refRange = selectedPatient?.gender === "female" ? test.femaleRange : test.maleRange;
                        return (
                          <motion.div
                            key={test.code}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => addTest(test, test.category, test.subcategory)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "bg-blue-50 border-blue-300"
                                : "bg-white hover:bg-slate-50 border-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center",
                                isSelected ? "bg-blue-500 border-blue-500" : "border-slate-300"
                              )}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{test.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Badge variant="outline" className="text-xs">{test.code}</Badge>
                                  <span>{test.subcategory}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">{refRange || "-"}</p>
                              <p className="text-xs text-slate-400">{test.unit}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  {/* Clinical Notes with Voice */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Clinical Notes</Label>
                    <div className="relative">
                      <Textarea
                        placeholder="Reason for test, clinical history..."
                        value={clinicalNotes}
                        onChange={e => setClinicalNotes(e.target.value)}
                        rows={3}
                        className="pr-10"
                      />
                      <div className="absolute right-2 top-2">
                        <VoiceInputButton
                          onTranscript={setClinicalNotes}
                          currentValue={clinicalNotes}
                          context="lab"
                          size="sm"
                          variant="ghost"
                          showStatus={false}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Working Diagnosis</Label>
                    <Input
                      placeholder="e.g., Anemia, Diabetes screening"
                      value={diagnosis}
                      onChange={e => setDiagnosis(e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* Selected Tests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Selected Tests</Label>
                      <Badge variant="outline">{selectedTests.length} tests</Badge>
                    </div>
                    <ScrollArea className="h-[180px]">
                      {selectedTests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-8">
                          <Beaker className="h-8 w-8 mb-2" />
                          <p className="text-sm">No tests selected</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTests.map(test => (
                            <div key={test.code} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{test.name}</p>
                                <p className="text-xs text-slate-500">{test.code} • {test.subcategory}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => addTest({ code: test.code } as any, test.category, test.subcategory)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearSelection}
                      disabled={selectedTests.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500"
                      onClick={() => setShowConfirmOrder(true)}
                      disabled={selectedTests.length === 0 || isSaving || !selectedPatientId}
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

        {/* Pending Results Tab */}
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : selectedOrder ? (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Order: {selectedOrder.orderNumber}</CardTitle>
                    <CardDescription>
                      Patient: {selectedOrder.patient.firstName} {selectedOrder.patient.lastName} ({selectedOrder.patient.mrn})
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(selectedOrder.status)}
                    {getPriorityBadge(selectedOrder.priority)}
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                      <X className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Result Date/Time and File Upload */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Result Date/Time
                    </Label>
                    <Input
                      type="datetime-local"
                      value={resultDateTime}
                      onChange={e => setResultDateTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      Upload Results File
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            toast({
                              title: "File Selected",
                              description: `${file.name} ready for upload`,
                            });
                          }
                        }}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Technician Notes (Voice Enabled)
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="Click mic to dictate..."
                        value={technicianNotes}
                        onChange={e => setTechnicianNotes(e.target.value)}
                        className="pr-10"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <VoiceInputButton
                          onTranscript={setTechnicianNotes}
                          currentValue={technicianNotes}
                          context="lab"
                          size="sm"
                          variant="ghost"
                          showStatus={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Notes with Voice */}
                <div className="mb-4 space-y-2">
                  <Label className="text-sm font-medium">Overall Order Notes</Label>
                  <div className="relative">
                    <Textarea
                      placeholder="Overall notes for this lab order..."
                      value={selectedOrder.overallNotes || ""}
                      rows={2}
                      className="pr-10"
                      onChange={(e) => {
                        if (selectedOrder) {
                          setSelectedOrder({
                            ...selectedOrder,
                            overallNotes: e.target.value
                          });
                        }
                      }}
                    />
                    <div className="absolute right-2 top-2">
                      <VoiceInputButton
                        onTranscript={(text) => {
                          if (selectedOrder) {
                            setSelectedOrder({
                              ...selectedOrder,
                              overallNotes: text
                            });
                          }
                        }}
                        currentValue={selectedOrder?.overallNotes || ""}
                        context="lab"
                        size="sm"
                        variant="ghost"
                        showStatus={false}
                      />
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-[350px]">
                  <div className="space-y-3 pr-4">
                    {selectedOrder.orderItems.map(item => {
                      const currentValue = resultValues[item.id] || item.resultValue || "";
                      const interpretation = currentValue ? interpretResult(currentValue, item.referenceRange || "") : "pending";
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border",
                            interpretation === "critical" ? "bg-red-50 border-red-300" :
                            interpretation === "abnormal" ? "bg-amber-50 border-amber-300" :
                            interpretation === "normal" ? "bg-emerald-50 border-emerald-300" :
                            "bg-white border-slate-200"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{item.testName}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Badge variant="outline">{item.testCode}</Badge>
                              <span>{item.subcategory}</span>
                            </div>
                          </div>
                          <div className="text-right w-24">
                            <p className="text-sm font-medium">{item.referenceRange || "-"}</p>
                            <p className="text-xs text-slate-400">Ref Range</p>
                          </div>
                          <div className="w-32">
                            <Input
                              placeholder="Enter result"
                              value={currentValue}
                              onChange={e => updateResultValue(item.id, e.target.value)}
                            />
                          </div>
                          <div className="w-20 text-center">
                            <p className="text-xs text-slate-500">{item.unit || "-"}</p>
                          </div>
                          <div className="w-24">
                            {getInterpretationBadge(interpretation)}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-purple-500 to-indigo-500"
                    onClick={() => setShowConfirmResults(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pending Lab Orders</CardTitle>
                    <CardDescription>{getOrdersByStatus("pending").length} order(s) awaiting results</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchLabOrders}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {getOrdersByStatus("pending").length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <CheckCircle className="h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">No pending lab orders</p>
                    <p className="text-sm text-slate-400">All lab orders have been processed</p>
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
                              <AvatarFallback className="bg-purple-100 text-purple-700">
                                {order.patient.firstName[0]}{order.patient.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                                <span className="text-sm text-slate-500">({order.patient.mrn})</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-mono">{order.orderNumber}</Badge>
                                {getPriorityBadge(order.priority)}
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {order.orderItems.length} test(s) • {new Date(order.orderDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!order.sampleCollected && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => collectSample(order.id)}
                              >
                                <Droplets className="h-4 w-4 mr-1" />
                                Collect
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-purple-500 hover:bg-purple-600"
                              onClick={() => {
                                setSelectedOrder(order);
                                const values: Record<string, string> = {};
                                order.orderItems.forEach(item => {
                                  values[item.id] = item.resultValue || "";
                                });
                                setResultValues(values);
                              }}
                            >
                              <FlaskConical className="h-4 w-4 mr-1" />
                              Enter Results
                            </Button>
                          </div>
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
              <CardTitle className="text-base">Completed Lab Orders</CardTitle>
              <CardDescription>{getOrdersByStatus("completed").length} completed order(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {getOrdersByStatus("completed").length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <FileText className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No completed lab orders</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {getOrdersByStatus("completed").map(order => (
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
                            <p className="text-xs text-slate-500 mt-1">
                              {order.orderItems.length} test(s) • Completed: {new Date(order.orderDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
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
                  <CardTitle className="text-base">Lab Order History</CardTitle>
                  <CardDescription>All lab orders</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                      <SelectItem value="in-lab">In Lab</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {labOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <History className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No lab orders found</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {labOrders.map(order => (
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
                            <p className="text-xs text-slate-500 mt-1">
                              {order.orderItems.length} test(s) • {new Date(order.orderDate).toLocaleDateString()}
                            </p>
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
            <DialogTitle>Confirm Lab Order</DialogTitle>
            <DialogDescription>
              Review the order details before submitting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm"><strong>Patient:</strong> {selectedPatient?.firstName} {selectedPatient?.lastName}</p>
              <p className="text-sm"><strong>Priority:</strong> {orderPriority.toUpperCase()}</p>
              <p className="text-sm"><strong>Tests:</strong> {selectedTests.length} selected</p>
              {diagnosis && <p className="text-sm"><strong>Diagnosis:</strong> {diagnosis}</p>}
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {selectedTests.map(test => (
                  <div key={test.code} className="flex items-center justify-between text-sm">
                    <span>{test.name}</span>
                    <Badge variant="outline" className="text-xs">{test.code}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmOrder(false)}>Cancel</Button>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-purple-500"
              onClick={submitOrder} 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Results Dialog */}
      <Dialog open={showConfirmResults} onOpenChange={setShowConfirmResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Results</DialogTitle>
            <DialogDescription>
              Verify the results before saving
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm"><strong>Order:</strong> {selectedOrder?.orderNumber}</p>
              <p className="text-sm"><strong>Patient:</strong> {selectedOrder?.patient.firstName} {selectedOrder?.patient.lastName}</p>
            </div>
            <div className="space-y-2">
              {Object.entries(resultValues).filter(([_, v]) => v).length} results entered
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmResults(false)}>Cancel</Button>
            <Button 
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
              onClick={saveResults} 
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UnifiedLabModule;
