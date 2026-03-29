"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronDown,
  ChevronRight,
  TestTube,
  Droplets,
  Activity,
  Heart,
  Brain,
  Bone,
  Microscope,
  Save,
  X,
  RefreshCw,
  FileText,
  Printer,
  Send,
  Check,
  Filter,
  ArrowUpDown,
  Zap,
  Shield,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// COMPREHENSIVE LAB TEST CATALOG - THE POWER
// ============================================

const HAEMATOLOGY_TESTS = [
  // COMPLETE BLOOD COUNT (CBC)
  { id: 1, name: "Hemoglobin (Hb)", code: "HGB", unit: "g/dL", maleRef: "13.5-17.5", femaleRef: "12.0-16.0", section: "CBC", sample: "EDTA Blood" },
  { id: 2, name: "Hematocrit (Hct)", code: "HCT", unit: "%", maleRef: "40-54", femaleRef: "36-48", section: "CBC", sample: "EDTA Blood" },
  { id: 3, name: "Red Blood Cell Count", code: "RBC", unit: "x10⁶/µL", maleRef: "4.5-5.9", femaleRef: "4.0-5.2", section: "CBC", sample: "EDTA Blood" },
  { id: 4, name: "White Blood Cell Count", code: "WBC", unit: "x10³/µL", maleRef: "4.5-11.0", femaleRef: "4.5-11.0", section: "CBC", sample: "EDTA Blood" },
  { id: 5, name: "Platelet Count", code: "PLT", unit: "x10³/µL", maleRef: "150-400", femaleRef: "150-400", section: "CBC", sample: "EDTA Blood" },
  { id: 6, name: "MCV (Mean Corpuscular Volume)", code: "MCV", unit: "fL", maleRef: "80-100", femaleRef: "80-100", section: "CBC", sample: "EDTA Blood" },
  { id: 7, name: "MCH (Mean Corpuscular Hb)", code: "MCH", unit: "pg", maleRef: "27-33", femaleRef: "27-33", section: "CBC", sample: "EDTA Blood" },
  { id: 8, name: "MCHC (Mean Corpuscular Hb Conc)", code: "MCHC", unit: "g/dL", maleRef: "32-36", femaleRef: "32-36", section: "CBC", sample: "EDTA Blood" },
  { id: 9, name: "RDW (Red Cell Distribution Width)", code: "RDW", unit: "%", maleRef: "11.5-14.5", femaleRef: "11.5-14.5", section: "CBC", sample: "EDTA Blood" },
  
  // DIFFERENTIAL COUNT
  { id: 10, name: "Neutrophils", code: "NEUT", unit: "%", maleRef: "40-75", femaleRef: "40-75", section: "Differential", sample: "EDTA Blood" },
  { id: 11, name: "Neutrophil Count", code: "NEUT#", unit: "x10³/µL", maleRef: "1.8-7.5", femaleRef: "1.8-7.5", section: "Differential", sample: "EDTA Blood" },
  { id: 12, name: "Lymphocytes", code: "LYMPH", unit: "%", maleRef: "20-45", femaleRef: "20-45", section: "Differential", sample: "EDTA Blood" },
  { id: 13, name: "Lymphocyte Count", code: "LYMPH#", unit: "x10³/µL", maleRef: "1.0-4.0", femaleRef: "1.0-4.0", section: "Differential", sample: "EDTA Blood" },
  { id: 14, name: "Monocytes", code: "MONO", unit: "%", maleRef: "2-10", femaleRef: "2-10", section: "Differential", sample: "EDTA Blood" },
  { id: 15, name: "Monocyte Count", code: "MONO#", unit: "x10³/µL", maleRef: "0.2-0.8", femaleRef: "0.2-0.8", section: "Differential", sample: "EDTA Blood" },
  { id: 16, name: "Eosinophils", code: "EOS", unit: "%", maleRef: "0-6", femaleRef: "0-6", section: "Differential", sample: "EDTA Blood" },
  { id: 17, name: "Eosinophil Count", code: "EOS#", unit: "x10³/µL", maleRef: "0-0.5", femaleRef: "0-0.5", section: "Differential", sample: "EDTA Blood" },
  { id: 18, name: "Basophils", code: "BASO", unit: "%", maleRef: "0-2", femaleRef: "0-2", section: "Differential", sample: "EDTA Blood" },
  { id: 19, name: "Basophil Count", code: "BASO#", unit: "x10³/µL", maleRef: "0-0.2", femaleRef: "0-0.2", section: "Differential", sample: "EDTA Blood" },
  
  // COAGULATION
  { id: 20, name: "Prothrombin Time (PT)", code: "PT", unit: "seconds", maleRef: "11-13.5", femaleRef: "11-13.5", section: "Coagulation", sample: "Citrate Plasma" },
  { id: 21, name: "INR (International Normalized Ratio)", code: "INR", unit: "", maleRef: "0.9-1.2", femaleRef: "0.9-1.2", section: "Coagulation", sample: "Citrate Plasma" },
  { id: 22, name: "APTT (Activated PTT)", code: "APTT", unit: "seconds", maleRef: "25-35", femaleRef: "25-35", section: "Coagulation", sample: "Citrate Plasma" },
  { id: 23, name: "D-Dimer", code: "DDIMER", unit: "ng/mL", maleRef: "<500", femaleRef: "<500", section: "Coagulation", sample: "Citrate Plasma" },
  { id: 24, name: "Fibrinogen", code: "FIB", unit: "mg/dL", maleRef: "200-400", femaleRef: "200-400", section: "Coagulation", sample: "Citrate Plasma" },
  { id: 25, name: "Bleeding Time", code: "BT", unit: "minutes", maleRef: "1-7", femaleRef: "1-7", section: "Coagulation", sample: "Skin Puncture" },
  { id: 26, name: "Clotting Time", code: "CT", unit: "minutes", maleRef: "4-10", femaleRef: "4-10", section: "Coagulation", sample: "Whole Blood" },
  
  // SPECIAL HAEMATOLOGY
  { id: 27, name: "ESR (Erythrocyte Sedimentation Rate)", code: "ESR", unit: "mm/hr", maleRef: "0-15", femaleRef: "0-20", section: "Special", sample: "EDTA Blood" },
  { id: 28, name: "Reticulocyte Count", code: "RETIC", unit: "%", maleRef: "0.5-2.5", femaleRef: "0.5-2.5", section: "Special", sample: "EDTA Blood" },
  { id: 29, name: "Peripheral Blood Smear", code: "PBS", unit: "", maleRef: "Normal", femaleRef: "Normal", section: "Special", sample: "EDTA Blood" },
  { id: 30, name: "Blood Group", code: "BG", unit: "", maleRef: "", femaleRef: "", section: "Special", sample: "EDTA Blood" },
  { id: 31, name: "Rh Typing", code: "RH", unit: "", maleRef: "", femaleRef: "", section: "Special", sample: "EDTA Blood" },
  { id: 32, name: "Sickle Cell Test", code: "SICKLE", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Special", sample: "EDTA Blood" },
  { id: 33, name: "G6PD Screening", code: "G6PD", unit: "U/g Hb", maleRef: "4.6-13.5", femaleRef: "4.6-13.5", section: "Special", sample: "EDTA Blood" },
];

const CHEMISTRY_TESTS = [
  // RENAL FUNCTION
  { id: 101, name: "Blood Urea Nitrogen (BUN)", code: "BUN", unit: "mg/dL", maleRef: "7-20", femaleRef: "7-20", section: "Renal", sample: "Serum" },
  { id: 102, name: "Creatinine", code: "CREA", unit: "mg/dL", maleRef: "0.7-1.3", femaleRef: "0.6-1.1", section: "Renal", sample: "Serum" },
  { id: 103, name: "eGFR (Estimated GFR)", code: "eGFR", unit: "mL/min/1.73m²", maleRef: ">90", femaleRef: ">90", section: "Renal", sample: "Calculated" },
  { id: 104, name: "Uric Acid", code: "URIC", unit: "mg/dL", maleRef: "3.5-7.2", femaleRef: "2.6-6.0", section: "Renal", sample: "Serum" },
  { id: 105, name: "BUN/Creatinine Ratio", code: "BUN/CR", unit: "", maleRef: "10-20", femaleRef: "10-20", section: "Renal", sample: "Calculated" },
  
  // ELECTROLYTES
  { id: 106, name: "Sodium (Na)", code: "NA", unit: "mmol/L", maleRef: "136-145", femaleRef: "136-145", section: "Electrolytes", sample: "Serum" },
  { id: 107, name: "Potassium (K)", code: "K", unit: "mmol/L", maleRef: "3.5-5.0", femaleRef: "3.5-5.0", section: "Electrolytes", sample: "Serum" },
  { id: 108, name: "Chloride (Cl)", code: "CL", unit: "mmol/L", maleRef: "98-107", femaleRef: "98-107", section: "Electrolytes", sample: "Serum" },
  { id: 109, name: "Bicarbonate (HCO₃)", code: "HCO3", unit: "mmol/L", maleRef: "22-28", femaleRef: "22-28", section: "Electrolytes", sample: "Serum" },
  { id: 110, name: "Anion Gap", code: "AG", unit: "mmol/L", maleRef: "8-16", femaleRef: "8-16", section: "Electrolytes", sample: "Calculated" },
  
  // LIVER FUNCTION
  { id: 111, name: "ALT (SGPT)", code: "ALT", unit: "U/L", maleRef: "7-56", femaleRef: "7-56", section: "Liver", sample: "Serum" },
  { id: 112, name: "AST (SGOT)", code: "AST", unit: "U/L", maleRef: "10-40", femaleRef: "10-40", section: "Liver", sample: "Serum" },
  { id: 113, name: "Alkaline Phosphatase (ALP)", code: "ALP", unit: "U/L", maleRef: "44-147", femaleRef: "44-147", section: "Liver", sample: "Serum" },
  { id: 114, name: "Gamma GT (GGT)", code: "GGT", unit: "U/L", maleRef: "9-48", femaleRef: "7-32", section: "Liver", sample: "Serum" },
  { id: 115, name: "Total Bilirubin", code: "TBIL", unit: "mg/dL", maleRef: "0.3-1.2", femaleRef: "0.3-1.2", section: "Liver", sample: "Serum" },
  { id: 116, name: "Direct Bilirubin", code: "DBIL", unit: "mg/dL", maleRef: "0.0-0.3", femaleRef: "0.0-0.3", section: "Liver", sample: "Serum" },
  { id: 117, name: "Indirect Bilirubin", code: "IBIL", unit: "mg/dL", maleRef: "0.2-0.8", femaleRef: "0.2-0.8", section: "Liver", sample: "Calculated" },
  { id: 118, name: "Total Protein", code: "TP", unit: "g/dL", maleRef: "6.0-8.3", femaleRef: "6.0-8.3", section: "Liver", sample: "Serum" },
  { id: 119, name: "Albumin", code: "ALB", unit: "g/dL", maleRef: "3.5-5.5", femaleRef: "3.5-5.5", section: "Liver", sample: "Serum" },
  { id: 120, name: "Globulin", code: "GLOB", unit: "g/dL", maleRef: "2.0-3.5", femaleRef: "2.0-3.5", section: "Liver", sample: "Calculated" },
  { id: 121, name: "A/G Ratio", code: "AGR", unit: "", maleRef: "1.0-2.2", femaleRef: "1.0-2.2", section: "Liver", sample: "Calculated" },
  
  // CARDIAC MARKERS
  { id: 122, name: "Troponin I", code: "TROP-I", unit: "ng/mL", maleRef: "<0.04", femaleRef: "<0.04", section: "Cardiac", sample: "Serum" },
  { id: 123, name: "Troponin T", code: "TROP-T", unit: "ng/mL", maleRef: "<0.01", femaleRef: "<0.01", section: "Cardiac", sample: "Serum" },
  { id: 124, name: "CK-MB", code: "CKMB", unit: "U/L", maleRef: "0-25", femaleRef: "0-25", section: "Cardiac", sample: "Serum" },
  { id: 125, name: "CK Total (Creatine Kinase)", code: "CK", unit: "U/L", maleRef: "30-200", femaleRef: "30-150", section: "Cardiac", sample: "Serum" },
  { id: 126, name: "BNP (B-type Natriuretic Peptide)", code: "BNP", unit: "pg/mL", maleRef: "<100", femaleRef: "<100", section: "Cardiac", sample: "EDTA Plasma" },
  { id: 127, name: "LDH (Lactate Dehydrogenase)", code: "LDH", unit: "U/L", maleRef: "140-280", femaleRef: "140-280", section: "Cardiac", sample: "Serum" },
  
  // LIPID PROFILE
  { id: 128, name: "Total Cholesterol", code: "CHOL", unit: "mg/dL", maleRef: "<200", femaleRef: "<200", section: "Lipid", sample: "Serum" },
  { id: 129, name: "HDL Cholesterol", code: "HDL", unit: "mg/dL", maleRef: ">40", femaleRef: ">50", section: "Lipid", sample: "Serum" },
  { id: 130, name: "LDL Cholesterol", code: "LDL", unit: "mg/dL", maleRef: "<100", femaleRef: "<100", section: "Lipid", sample: "Calculated" },
  { id: 131, name: "VLDL Cholesterol", code: "VLDL", unit: "mg/dL", maleRef: "5-40", femaleRef: "5-40", section: "Lipid", sample: "Calculated" },
  { id: 132, name: "Triglycerides", code: "TG", unit: "mg/dL", maleRef: "<150", femaleRef: "<150", section: "Lipid", sample: "Serum" },
  { id: 133, name: "Total Chol/HDL Ratio", code: "CHOL/HDL", unit: "", maleRef: "<5.0", femaleRef: "<4.5", section: "Lipid", sample: "Calculated" },
  
  // THYROID
  { id: 134, name: "TSH (Thyroid Stimulating Hormone)", code: "TSH", unit: "mIU/L", maleRef: "0.4-4.0", femaleRef: "0.4-4.0", section: "Thyroid", sample: "Serum" },
  { id: 135, name: "Free T4 (Thyroxine)", code: "FT4", unit: "ng/dL", maleRef: "0.8-1.8", femaleRef: "0.8-1.8", section: "Thyroid", sample: "Serum" },
  { id: 136, name: "Free T3 (Triiodothyronine)", code: "FT3", unit: "pg/mL", maleRef: "2.3-4.2", femaleRef: "2.3-4.2", section: "Thyroid", sample: "Serum" },
  { id: 137, name: "Total T4", code: "TT4", unit: "µg/dL", maleRef: "4.5-12.5", femaleRef: "4.5-12.5", section: "Thyroid", sample: "Serum" },
  { id: 138, name: "Total T3", code: "TT3", unit: "ng/dL", maleRef: "80-200", femaleRef: "80-200", section: "Thyroid", sample: "Serum" },
  
  // DIABETES
  { id: 139, name: "Fasting Blood Glucose", code: "FBG", unit: "mg/dL", maleRef: "70-100", femaleRef: "70-100", section: "Diabetes", sample: "Serum" },
  { id: 140, name: "Random Blood Glucose", code: "RBG", unit: "mg/dL", maleRef: "<140", femaleRef: "<140", section: "Diabetes", sample: "Serum" },
  { id: 141, name: "HbA1c (Glycated Hemoglobin)", code: "HBA1C", unit: "%", maleRef: "4.0-5.6", femaleRef: "4.0-5.6", section: "Diabetes", sample: "EDTA Blood" },
  { id: 142, name: "Fructosamine", code: "FRUCT", unit: "µmol/L", maleRef: "200-285", femaleRef: "200-285", section: "Diabetes", sample: "Serum" },
  
  // MINERALS & VITAMINS
  { id: 143, name: "Calcium (Total)", code: "CA", unit: "mg/dL", maleRef: "8.5-10.5", femaleRef: "8.5-10.5", section: "Minerals", sample: "Serum" },
  { id: 144, name: "Calcium (Ionized)", code: "CAI", unit: "mmol/L", maleRef: "1.12-1.32", femaleRef: "1.12-1.32", section: "Minerals", sample: "Serum" },
  { id: 145, name: "Phosphorus", code: "PHOS", unit: "mg/dL", maleRef: "2.5-4.5", femaleRef: "2.5-4.5", section: "Minerals", sample: "Serum" },
  { id: 146, name: "Magnesium", code: "MG", unit: "mg/dL", maleRef: "1.7-2.2", femaleRef: "1.7-2.2", section: "Minerals", sample: "Serum" },
  { id: 147, name: "Iron", code: "FE", unit: "µg/dL", maleRef: "65-175", femaleRef: "50-170", section: "Minerals", sample: "Serum" },
  { id: 148, name: "Ferritin", code: "FERR", unit: "ng/mL", maleRef: "20-250", femaleRef: "10-120", section: "Minerals", sample: "Serum" },
  { id: 149, name: "TIBC (Total Iron Binding Capacity)", code: "TIBC", unit: "µg/dL", maleRef: "250-450", femaleRef: "250-450", section: "Minerals", sample: "Serum" },
  { id: 150, name: "Vitamin B12", code: "B12", unit: "pg/mL", maleRef: "200-900", femaleRef: "200-900", section: "Vitamins", sample: "Serum" },
  { id: 151, name: "Folate (Folic Acid)", code: "FOLATE", unit: "ng/mL", maleRef: "3-17", femaleRef: "3-17", section: "Vitamins", sample: "Serum" },
  { id: 152, name: "Vitamin D (25-OH)", code: "VITD", unit: "ng/mL", maleRef: "30-100", femaleRef: "30-100", section: "Vitamins", sample: "Serum" },
  
  // OTHER
  { id: 153, name: "Amylase", code: "AMY", unit: "U/L", maleRef: "30-110", femaleRef: "30-110", section: "Other", sample: "Serum" },
  { id: 154, name: "Lipase", code: "LIP", unit: "U/L", maleRef: "10-140", femaleRef: "10-140", section: "Other", sample: "Serum" },
  { id: 155, name: "CRP (C-Reactive Protein)", code: "CRP", unit: "mg/L", maleRef: "<10", femaleRef: "<10", section: "Other", sample: "Serum" },
];

const URINALYSIS_TESTS = [
  // PHYSICAL EXAMINATION
  { id: 201, name: "Urine Color", code: "UCOLOR", unit: "", maleRef: "Yellow", femaleRef: "Yellow", section: "Physical", sample: "Urine" },
  { id: 202, name: "Urine Appearance", code: "UAPPEAR", unit: "", maleRef: "Clear", femaleRef: "Clear", section: "Physical", sample: "Urine" },
  { id: 203, name: "Urine Specific Gravity", code: "USG", unit: "", maleRef: "1.005-1.030", femaleRef: "1.005-1.030", section: "Physical", sample: "Urine" },
  { id: 204, name: "Urine pH", code: "UPH", unit: "", maleRef: "4.6-8.0", femaleRef: "4.6-8.0", section: "Physical", sample: "Urine" },
  
  // CHEMICAL EXAMINATION
  { id: 205, name: "Urine Protein", code: "UPROT", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 206, name: "Urine Glucose", code: "UGLU", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 207, name: "Urine Ketones", code: "UKET", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 208, name: "Urine Blood", code: "UBLD", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 209, name: "Urine Bilirubin", code: "UBIL", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 210, name: "Urine Urobilinogen", code: "URO", unit: "EU/dL", maleRef: "0.2-1.0", femaleRef: "0.2-1.0", section: "Chemical", sample: "Urine" },
  { id: 211, name: "Urine Nitrite", code: "UNITR", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  { id: 212, name: "Urine Leukocyte Esterase", code: "ULEU", unit: "", maleRef: "Negative", femaleRef: "Negative", section: "Chemical", sample: "Urine" },
  
  // MICROSCOPIC
  { id: 213, name: "Urine RBC", code: "URBC", unit: "/HPF", maleRef: "0-3", femaleRef: "0-3", section: "Microscopic", sample: "Urine" },
  { id: 214, name: "Urine WBC", code: "UWBC", unit: "/HPF", maleRef: "0-5", femaleRef: "0-5", section: "Microscopic", sample: "Urine" },
  { id: 215, name: "Urine Epithelial Cells", code: "UEPI", unit: "/HPF", maleRef: "0-5", femaleRef: "0-5", section: "Microscopic", sample: "Urine" },
  { id: 216, name: "Urine Casts", code: "UCAST", unit: "/LPF", maleRef: "0-2 hyaline", femaleRef: "0-2 hyaline", section: "Microscopic", sample: "Urine" },
  { id: 217, name: "Urine Crystals", code: "UCRYST", unit: "", maleRef: "None", femaleRef: "None", section: "Microscopic", sample: "Urine" },
  { id: 218, name: "Urine Bacteria", code: "UBACT", unit: "", maleRef: "None", femaleRef: "None", section: "Microscopic", sample: "Urine" },
];

// ALL TESTS COMBINED
const ALL_TESTS = [...HAEMATOLOGY_TESTS, ...CHEMISTRY_TESTS, ...URINALYSIS_TESTS];

// LAB PANELS
const LAB_PANELS = [
  { id: "cbc", name: "Complete Blood Count (CBC)", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "RDW"] },
  { id: "cbc-diff", name: "CBC with Differential", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "NEUT", "LYMPH", "MONO", "EOS", "BASO"] },
  { id: "coag", name: "Coagulation Panel", tests: ["PT", "INR", "APTT", "FIB"] },
  { id: "bmp", name: "Basic Metabolic Panel", tests: ["NA", "K", "CL", "HCO3", "BUN", "CREA", "FBG", "CA"] },
  { id: "cmp", name: "Comprehensive Metabolic Panel", tests: ["NA", "K", "CL", "HCO3", "BUN", "CREA", "FBG", "CA", "ALB", "TP", "ALT", "AST", "ALP", "TBIL"] },
  { id: "lft", name: "Liver Function Panel", tests: ["ALT", "AST", "ALP", "GGT", "TBIL", "DBIL", "TP", "ALB"] },
  { id: "renal", name: "Renal Function Panel", tests: ["BUN", "CREA", "eGFR", "URIC", "NA", "K", "CL"] },
  { id: "lipid", name: "Lipid Profile", tests: ["CHOL", "HDL", "LDL", "TG", "VLDL", "CHOL/HDL"] },
  { id: "thyroid", name: "Thyroid Panel", tests: ["TSH", "FT4", "FT3"] },
  { id: "cardiac", name: "Cardiac Panel", tests: ["TROP-I", "CKMB", "CK", "BNP", "LDH"] },
  { id: "diabetes", name: "Diabetes Panel", tests: ["FBG", "HBA1C"] },
  { id: "iron", name: "Iron Studies", tests: ["FE", "FERR", "TIBC"] },
  { id: "electrolytes", name: "Electrolyte Panel", tests: ["NA", "K", "CL", "HCO3", "AG"] },
  { id: "urinalysis", name: "Complete Urinalysis", tests: ["UCOLOR", "UAPPEAR", "USG", "UPH", "UPROT", "UGLU", "UKET", "UBLD", "ULEU", "URBC", "UWBC"] },
];

// ============================================
// INTERFACES
// ============================================

interface LabResultEntry {
  id: string;
  testId: number;
  testName: string;
  testCode: string;
  section: string;
  sample: string;
  unit: string;
  referenceRange: string;
  resultValue: string;
  interpretation: "normal" | "abnormal" | "critical" | "pending";
  notes: string;
}

interface LabResultsInputProps {
  patientId: string;
  consultationId?: string;
  patientGender?: string;
  onResultsSaved?: () => void;
}

// ============================================
// MAIN COMPONENT - THE POWER
// ============================================

export function LabResultsInput({ 
  patientId, 
  consultationId, 
  patientGender = "male",
  onResultsSaved 
}: LabResultsInputProps) {
  const [labResults, setLabResults] = useState<LabResultEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"haematology" | "chemistry" | "urinalysis">("haematology");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const { toast } = useToast();

  // Get tests for current category
  const getCategoryTests = () => {
    switch (activeCategory) {
      case "haematology": return HAEMATOLOGY_TESTS;
      case "chemistry": return CHEMISTRY_TESTS;
      case "urinalysis": return URINALYSIS_TESTS;
      default: return [];
    }
  };

  // Get unique sections for current category
  const getSections = () => {
    const tests = getCategoryTests();
    return [...new Set(tests.map(t => t.section))];
  };

  // Get filtered tests
  const getFilteredTests = () => {
    let tests = getCategoryTests();
    
    if (searchQuery) {
      tests = ALL_TESTS.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeSection !== "all") {
      tests = tests.filter(t => t.section === activeSection);
    }
    
    return tests;
  };

  // Add test to results
  const addTest = (test: typeof HAEMATOLOGY_TESTS[0]) => {
    const exists = labResults.find(r => r.testId === test.id);
    if (exists) {
      toast({
        title: "Already Added",
        description: `${test.name} is already in the list`,
        variant: "destructive",
      });
      return;
    }

    const refRange = patientGender === "female" ? test.femaleRef : test.maleRef;
    
    const newEntry: LabResultEntry = {
      id: `temp-${Date.now()}-${test.id}`,
      testId: test.id,
      testName: test.name,
      testCode: test.code,
      section: test.section,
      sample: test.sample,
      unit: test.unit,
      referenceRange: refRange,
      resultValue: "",
      interpretation: "pending",
      notes: "",
    };

    setLabResults(prev => [...prev, newEntry]);
    
    toast({
      title: "Test Added",
      description: `${test.name} added to results`,
    });
  };

  // Add entire panel
  const addPanel = (panel: typeof LAB_PANELS[0]) => {
    let addedCount = 0;
    
    panel.tests.forEach(code => {
      const test = ALL_TESTS.find(t => t.code === code);
      if (test && !labResults.find(r => r.testId === test.id)) {
        const refRange = patientGender === "female" ? test.femaleRef : test.maleRef;
        
        const newEntry: LabResultEntry = {
          id: `temp-${Date.now()}-${test.id}-${Math.random().toString(36).substr(2, 5)}`,
          testId: test.id,
          testName: test.name,
          testCode: test.code,
          section: test.section,
          sample: test.sample,
          unit: test.unit,
          referenceRange: refRange,
          resultValue: "",
          interpretation: "pending",
          notes: "",
        };
        
        setLabResults(prev => [...prev, newEntry]);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast({
        title: "Panel Added",
        description: `${panel.name}: ${addedCount} tests added`,
      });
    } else {
      toast({
        title: "Already Added",
        description: "All tests from this panel are already in the list",
        variant: "destructive",
      });
    }
  };

  // Update result value
  const updateResultValue = (id: string, value: string) => {
    setLabResults(prev => prev.map(r => {
      if (r.id === id) {
        const interpretation = interpretResult(value, r.referenceRange);
        return { ...r, resultValue: value, interpretation };
      }
      return r;
    }));
  };

  // Interpret result
  const interpretResult = (value: string, refRange: string): "normal" | "abnormal" | "critical" | "pending" => {
    if (!value || !refRange) return "pending";
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      // Handle qualitative results
      const lowerValue = value.toLowerCase().trim();
      const lowerRef = refRange.toLowerCase();
      if (lowerRef.includes("negative") && lowerValue === "negative") return "normal";
      if (lowerRef.includes("negative") && lowerValue !== "negative") return "abnormal";
      if (lowerRef.includes("normal") && lowerValue === "normal") return "normal";
      return "pending";
    }

    // Parse range
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

  // Remove single result
  const removeResult = (id: string) => {
    setLabResults(prev => prev.filter(r => r.id !== id));
    toast({
      title: "Removed",
      description: "Test removed from list",
    });
  };

  // Clear empty results
  const clearEmptyResults = () => {
    const emptyCount = labResults.filter(r => !r.resultValue).length;
    if (emptyCount === 0) {
      toast({
        title: "No Empty Results",
        description: "All tests have values entered",
      });
      return;
    }
    
    setLabResults(prev => prev.filter(r => r.resultValue));
    toast({
      title: "Cleared Empty Results",
      description: `${emptyCount} empty test(s) removed`,
    });
  };

  // Clear all results
  const clearAllResults = () => {
    setLabResults([]);
    setClinicalNotes("");
    setShowConfirmClear(false);
    toast({
      title: "Cleared All",
      description: "All lab results have been cleared",
    });
  };

  // Save results
  const saveResults = async () => {
    const emptyResults = labResults.filter(r => !r.resultValue);
    if (emptyResults.length > 0) {
      toast({
        title: "Missing Values",
        description: `${emptyResults.length} test(s) have no result value`,
        variant: "destructive",
      });
      setShowConfirmSave(false);
      return;
    }

    setIsSaving(true);
    try {
      // Save each result
      const savePromises = labResults.map(result => 
        fetch("/api/lab-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            consultationId,
            testName: result.testName,
            testCode: result.testCode,
            category: activeCategory,
            resultValue: result.resultValue,
            unit: result.unit,
            referenceRange: result.referenceRange,
            interpretation: result.interpretation,
            orderedDate: new Date().toISOString(),
            resultDate: new Date().toISOString(),
          }),
        })
      );

      await Promise.all(savePromises);

      toast({
        title: "Success!",
        description: `${labResults.length} lab results saved successfully`,
      });

      setLabResults([]);
      setClinicalNotes("");
      setShowConfirmSave(false);
      onResultsSaved?.();
      
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save lab results",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Statistics
  const stats = {
    total: labResults.length,
    normal: labResults.filter(r => r.interpretation === "normal").length,
    abnormal: labResults.filter(r => r.interpretation === "abnormal").length,
    critical: labResults.filter(r => r.interpretation === "critical").length,
    pending: labResults.filter(r => r.interpretation === "pending").length,
    empty: labResults.filter(r => !r.resultValue).length,
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

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
            <Beaker className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Laboratory Results Entry</h3>
            <p className="text-sm text-slate-500">Select tests, enter values, and save results</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-slate-50">{stats.total} tests</Badge>
          {stats.normal > 0 && <Badge className="bg-emerald-100 text-emerald-700">{stats.normal} Normal</Badge>}
          {stats.abnormal > 0 && <Badge className="bg-amber-100 text-amber-700">{stats.abnormal} Abnormal</Badge>}
          {stats.critical > 0 && <Badge className="bg-red-100 text-red-700 animate-pulse">{stats.critical} Critical</Badge>}
          {stats.empty > 0 && <Badge className="bg-slate-100 text-slate-600">{stats.empty} Empty</Badge>}
        </div>
      </div>

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
                className="h-8 text-xs bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                onClick={() => addPanel(panel)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {panel.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Test Selection Panel */}
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

          {/* Category Tabs */}
          <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v as any); setActiveSection("all"); }}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="haematology" className="text-xs">
                <Droplets className="h-3 w-3 mr-1" />
                Haematology
              </TabsTrigger>
              <TabsTrigger value="chemistry" className="text-xs">
                <TestTube className="h-3 w-3 mr-1" />
                Chemistry
              </TabsTrigger>
              <TabsTrigger value="urinalysis" className="text-xs">
                <Activity className="h-3 w-3 mr-1" />
                Urinalysis
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Section Filter */}
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={activeSection === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveSection("all")}
            >
              All
            </Button>
            {getSections().map(section => (
              <Button
                key={section}
                variant={activeSection === section ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setActiveSection(section)}
              >
                {section}
              </Button>
            ))}
          </div>

          {/* Tests List */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2 space-y-1">
                  {getFilteredTests().map(test => {
                    const isAdded = labResults.some(r => r.testId === test.id);
                    const refRange = patientGender === "female" ? test.femaleRef : test.maleRef;
                    
                    return (
                      <motion.div
                        key={test.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => !isAdded && addTest(test)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                          isAdded
                            ? "bg-emerald-50 border-emerald-300 cursor-default"
                            : "bg-white hover:bg-slate-50 hover:border-emerald-300"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isAdded ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                          )}>
                            {isAdded && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{test.name}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Badge variant="outline" className="text-[10px] px-1">{test.code}</Badge>
                              <span className="truncate">{test.section}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs font-medium">{refRange || "-"}</p>
                          <p className="text-[10px] text-slate-400">{test.unit}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Results Entry Panel */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results Entry</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearEmptyResults}
                    disabled={stats.empty === 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Clear Empty
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmClear(true)}
                    disabled={labResults.length === 0}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {labResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[450px] text-center">
                  <div className="p-4 bg-slate-50 rounded-full mb-4">
                    <TestTube className="h-12 w-12 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">No tests selected</p>
                  <p className="text-sm text-slate-400 mt-1">Select tests from the panel on the left</p>
                </div>
              ) : (
                <>
                  {/* Results Table */}
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2 pr-2">
                      <AnimatePresence>
                        {labResults.map((result) => (
                          <motion.div
                            key={result.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              result.interpretation === "critical" ? "bg-red-50 border-red-300" :
                              result.interpretation === "abnormal" ? "bg-amber-50 border-amber-300" :
                              result.interpretation === "normal" ? "bg-emerald-50 border-emerald-300" :
                              "bg-white border-slate-200"
                            )}
                          >
                            {/* Test Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{result.testName}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Badge variant="outline" className="text-[10px] px-1">{result.testCode}</Badge>
                                <span>{result.section}</span>
                              </div>
                            </div>
                            
                            {/* Reference */}
                            <div className="text-right w-20 flex-shrink-0">
                              <p className="text-xs font-medium">{result.referenceRange || "-"}</p>
                              <p className="text-[10px] text-slate-400">Ref</p>
                            </div>
                            
                            {/* Result Input */}
                            <div className="w-24 flex-shrink-0">
                              <Input
                                placeholder="Value"
                                value={result.resultValue}
                                onChange={e => updateResultValue(result.id, e.target.value)}
                                className={cn(
                                  "h-9 text-center font-medium",
                                  result.interpretation === "critical" && "border-red-400 focus-visible:ring-red-400",
                                  result.interpretation === "abnormal" && "border-amber-400 focus-visible:ring-amber-400",
                                  result.interpretation === "normal" && "border-emerald-400 focus-visible:ring-emerald-400"
                                )}
                              />
                            </div>
                            
                            {/* Unit */}
                            <div className="w-16 flex-shrink-0">
                              <p className="text-xs text-center text-slate-600">{result.unit || "-"}</p>
                            </div>
                            
                            {/* Interpretation */}
                            <div className="flex-shrink-0">
                              {getInterpretationBadge(result.interpretation)}
                            </div>
                            
                            {/* Remove */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => removeResult(result.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>

                  <Separator className="my-4" />

                  {/* Notes & Actions */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Clinical Notes</Label>
                      <Textarea
                        placeholder="Additional notes or comments..."
                        value={clinicalNotes}
                        onChange={e => setClinicalNotes(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        {stats.empty > 0 ? (
                          <span className="text-amber-600">⚠️ {stats.empty} test(s) missing values</span>
                        ) : stats.total > 0 ? (
                          <span className="text-emerald-600">✓ All tests have values</span>
                        ) : null}
                      </p>
                      
                      <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        onClick={() => setShowConfirmSave(true)}
                        disabled={isSaving || labResults.length === 0 || stats.empty > 0}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Results
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm Clear Dialog */}
      <Dialog open={showConfirmClear} onOpenChange={setShowConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Clear All Results?
            </DialogTitle>
            <DialogDescription>
              This will remove all {labResults.length} test(s) from the list. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmClear(false)}>Cancel</Button>
            <Button variant="destructive" onClick={clearAllResults}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Save Dialog */}
      <Dialog open={showConfirmSave} onOpenChange={setShowConfirmSave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-emerald-500" />
              Save Lab Results?
            </DialogTitle>
            <DialogDescription>
              You are about to save {labResults.length} lab result(s) for this patient.
              {stats.critical > 0 && (
                <Alert className="mt-3 bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-700">Critical Values Detected!</AlertTitle>
                  <AlertDescription className="text-red-600">
                    {stats.critical} critical value(s) found. Please verify before saving.
                  </AlertDescription>
                </Alert>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmSave(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
              onClick={saveResults}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LabResultsInput;
