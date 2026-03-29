"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Plus,
  X,
  Shield,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Bell,
  BellOff,
  User,
  Heart,
  Droplets,
  Wind,
  Bone,
  Eye,
  Syringe,
  Tablets,
  Brain,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================
// DRUG DATABASE WITH ALLERGY & CONDITION INFO
// ============================================

const DRUG_DATABASE: Record<string, {
  name: string;
  generic: string;
  class: string;
  interactions: Array<{ drug: string; severity: string; description: string; mechanism: string; action: string; monitoring: string[]; }>;
  allergyCrossReactivity?: string[];
  conditionWarnings?: Record<string, { severity: string; description: string; action: string; }>;
}> = {
  "warfarin": {
    name: "Warfarin",
    generic: "warfarin sodium",
    class: "Anticoagulant",
    interactions: [
      { drug: "aspirin", severity: "major", description: "Increased risk of bleeding. Monitor INR closely.", mechanism: "Additive anticoagulant effect", action: "Avoid combination or use lowest effective doses", monitoring: ["INR", "Signs of bleeding"] },
      { drug: "ibuprofen", severity: "major", description: "Increased risk of GI bleeding.", mechanism: "NSAID-induced gastric ulceration + anticoagulation", action: "Consider acetaminophen instead", monitoring: ["INR", "Hemoglobin"] },
      { drug: "amiodarone", severity: "major", description: "Increased warfarin effect. Reduce warfarin dose by 30-50%.", mechanism: "CYP2C9 inhibition", action: "Reduce warfarin dose, monitor INR more frequently", monitoring: ["INR twice weekly initially"] },
      { drug: "fluconazole", severity: "major", description: "Significantly increased anticoagulant effect.", mechanism: "CYP2C9/3A4 inhibition", action: "Reduce warfarin dose by 50%", monitoring: ["INR"] },
      { drug: "ciprofloxacin", severity: "moderate", description: "May increase warfarin levels.", mechanism: "CYP1A2 inhibition", action: "Monitor INR more frequently", monitoring: ["INR"] },
      { drug: "metronidazole", severity: "major", description: "Prolonged PT/INR. Reduce warfarin dose.", mechanism: "CYP2C9 inhibition", action: "Reduce dose by 25-50%", monitoring: ["INR"] },
      { drug: "omeprazole", severity: "minor", description: "Possible increase in warfarin effect.", mechanism: "Unknown", action: "Monitor INR", monitoring: ["INR"] },
      { drug: "clarithromycin", severity: "major", description: "Increased anticoagulant effect.", mechanism: "CYP3A4 inhibition", action: "Reduce warfarin dose", monitoring: ["INR"] },
      { drug: "amoxicillin", severity: "moderate", description: "May enhance anticoagulant effect.", mechanism: "Altered intestinal flora, decreased vitamin K", action: "Monitor INR", monitoring: ["INR"] },
    ],
    conditionWarnings: {
      "Liver Disease": { severity: "major", description: "Increased bleeding risk due to impaired clotting factor synthesis.", action: "Use with extreme caution; monitor INR frequently" },
      "Peptic Ulcer Disease": { severity: "major", description: "High risk of GI bleeding.", action: "Avoid if possible; use PPI if necessary" },
      "Chronic Kidney Disease": { severity: "moderate", description: "May require dose adjustment.", action: "Monitor renal function and INR" },
    }
  },
  "metformin": {
    name: "Metformin",
    generic: "metformin hydrochloride",
    class: "Antidiabetic / Biguanide",
    interactions: [
      { drug: "furosemide", severity: "moderate", description: "May increase metformin exposure and decrease renal function.", mechanism: "Competition for renal tubular secretion", action: "Monitor renal function and blood glucose", monitoring: ["Serum creatinine", "Blood glucose"] },
      { drug: "cimetidine", severity: "moderate", description: "Increased metformin levels.", mechanism: "Competition for renal tubular secretion", action: "Monitor for metformin toxicity", monitoring: ["Lactic acid", "Renal function"] },
      { drug: "contrast", severity: "major", description: "Risk of lactic acidosis with iodinated contrast.", mechanism: "Acute renal failure", action: "Discontinue metformin before and after contrast", monitoring: ["Renal function"] },
    ],
    conditionWarnings: {
      "Chronic Kidney Disease": { severity: "major", description: "Risk of lactic acidosis. Avoid if eGFR < 30.", action: "Do not use if eGFR < 30; reduce dose if eGFR 30-45" },
      "Heart Failure": { severity: "moderate", description: "Increased risk of lactic acidosis.", action: "Use with caution; monitor renal function" },
      "Liver Disease": { severity: "moderate", description: "Increased risk of lactic acidosis.", action: "Avoid in severe hepatic impairment" },
    }
  },
  "simvastatin": {
    name: "Simvastatin",
    generic: "simvastatin",
    class: "Antilipemic / HMG-CoA Reductase Inhibitor",
    interactions: [
      { drug: "clarithromycin", severity: "contraindicated", description: "CONTRAINDICATED. High risk of myopathy/rhabdomyolysis.", mechanism: "CYP3A4 inhibition increases simvastatin levels 10-fold", action: "Contraindicated - do not co-administer", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "itraconazole", severity: "contraindicated", description: "CONTRAINDICATED. Risk of rhabdomyolysis.", mechanism: "Potent CYP3A4 inhibition", action: "Contraindicated", monitoring: ["CK"] },
      { drug: "amiodarone", severity: "major", description: "Increased risk of myopathy. Do not exceed 20mg simvastatin.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 20mg daily", monitoring: ["CK", "Muscle pain"] },
      { drug: "amlodipine", severity: "moderate", description: "Increased simvastatin exposure. Max 20mg simvastatin.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 20mg daily", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "verapamil", severity: "major", description: "Increased simvastatin exposure. Max 10mg daily.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 10mg daily", monitoring: ["CK"] },
      { drug: "gemfibrozil", severity: "major", description: "Increased risk of myopathy/rhabdomyolysis.", mechanism: "OATP1B1 inhibition, glucuronidation", action: "Avoid combination; use fenofibrate instead", monitoring: ["CK", "Muscle symptoms"] },
    ],
    conditionWarnings: {
      "Liver Disease": { severity: "moderate", description: "Risk of hepatotoxicity.", action: "Monitor LFTs; avoid in active liver disease" },
      "Hypothyroidism": { severity: "moderate", description: "Increased risk of myopathy.", action: "Correct hypothyroidism before starting; monitor CK" },
    }
  },
  "amoxicillin": {
    name: "Amoxicillin",
    generic: "amoxicillin trihydrate",
    class: "Antibiotic / Penicillin",
    interactions: [
      { drug: "methotrexate", severity: "major", description: "Increased methotrexate toxicity.", mechanism: "Decreased renal clearance of methotrexate", action: "Avoid or monitor closely for methotrexate toxicity", monitoring: ["CBC", "Renal function", "LFTs"] },
      { drug: "allopurinol", severity: "moderate", description: "Increased risk of skin rash.", mechanism: "Unknown", action: "Monitor for rash", monitoring: ["Skin"] },
      { drug: "warfarin", severity: "moderate", description: "May enhance anticoagulant effect.", mechanism: "Altered intestinal flora, decreased vitamin K", action: "Monitor INR", monitoring: ["INR"] },
    ],
    allergyCrossReactivity: ["Penicillin", "Amoxicillin", "Ampicillin", "Amoxicillin/Clavulanate"],
    conditionWarnings: {
      "Chronic Kidney Disease": { severity: "moderate", description: "May require dose adjustment.", action: "Reduce dose or extend interval if eGFR < 30" },
    }
  },
  "lisinopril": {
    name: "Lisinopril",
    generic: "lisinopril",
    class: "ACE Inhibitor / Antihypertensive",
    interactions: [
      { drug: "potassium", severity: "major", description: "Risk of hyperkalemia.", mechanism: "ACE inhibition reduces aldosterone", action: "Avoid potassium supplements or monitor closely", monitoring: ["Serum potassium"] },
      { drug: "spironolactone", severity: "major", description: "Increased risk of hyperkalemia.", mechanism: "Additive potassium-sparing effect", action: "Monitor potassium frequently", monitoring: ["Serum potassium", "Renal function"] },
      { drug: "ibuprofen", severity: "moderate", description: "May reduce antihypertensive effect; risk of renal impairment.", mechanism: "Prostaglandin inhibition", action: "Monitor BP and renal function", monitoring: ["Blood pressure", "Serum creatinine"] },
      { drug: "lithium", severity: "major", description: "Increased lithium levels.", mechanism: "Reduced renal clearance", action: "Monitor lithium levels closely", monitoring: ["Serum lithium"] },
    ],
    conditionWarnings: {
      "Chronic Kidney Disease": { severity: "moderate", description: "May cause hyperkalemia and worsen renal function initially.", action: "Monitor potassium and creatinine closely" },
      "Type 2 Diabetes Mellitus": { severity: "minor", description: "May improve renal outcomes.", action: "Beneficial; monitor for hyperkalemia" },
    }
  },
  "omeprazole": {
    name: "Omeprazole",
    generic: "omeprazole magnesium",
    class: "Proton Pump Inhibitor",
    interactions: [
      { drug: "clopidogrel", severity: "major", description: "May reduce clopidogrel effectiveness.", mechanism: "CYP2C19 inhibition reduces clopidogrel activation", action: "Consider pantoprazole or H2 blocker", monitoring: ["Clinical efficacy"] },
      { drug: "methotrexate", severity: "major", description: "Increased methotrexate levels.", mechanism: "Reduced methotrexate clearance", action: "Monitor for methotrexate toxicity", monitoring: ["Methotrexate levels", "CBC", "Renal function"] },
    ],
    conditionWarnings: {
      "Osteoporosis": { severity: "moderate", description: "Long-term use associated with increased fracture risk.", action: "Use lowest effective dose; consider calcium/vitamin D" },
    }
  },
  "amlodipine": {
    name: "Amlodipine",
    generic: "amlodipine besylate",
    class: "Calcium Channel Blocker / Antihypertensive",
    interactions: [
      { drug: "simvastatin", severity: "moderate", description: "Increased simvastatin exposure. Max 20mg simvastatin.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 20mg daily", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "clarithromycin", severity: "moderate", description: "May increase amlodipine levels.", mechanism: "CYP3A4 inhibition", action: "Monitor for hypotension and edema", monitoring: ["Blood pressure"] },
    ],
    conditionWarnings: {
      "Heart Failure": { severity: "moderate", description: "May worsen heart failure in some patients.", action: "Use with caution; monitor for edema" },
    }
  },
  "metoprolol": {
    name: "Metoprolol",
    generic: "metoprolol succinate",
    class: "Beta-Blocker / Antihypertensive",
    interactions: [
      { drug: "fluoxetine", severity: "major", description: "Increased metoprolol exposure.", mechanism: "CYP2D6 inhibition", action: "Reduce metoprolol dose or use alternative", monitoring: ["Heart rate", "Blood pressure"] },
      { drug: "paroxetine", severity: "major", description: "Significantly increased metoprolol levels.", mechanism: "Potent CYP2D6 inhibition", action: "Consider alternative antidepressant or beta-blocker", monitoring: ["Heart rate", "Blood pressure"] },
    ],
    conditionWarnings: {
      "Asthma": { severity: "major", description: "May precipitate bronchospasm.", action: "Use cardioselective beta-blocker at lowest dose; monitor closely" },
      "COPD": { severity: "moderate", description: "May cause bronchospasm.", action: "Use with caution; consider cardioselective agent" },
      "Diabetes": { severity: "moderate", description: "May mask hypoglycemia symptoms.", action: "Monitor blood glucose; educate patient about altered symptoms" },
    }
  },
  "ciprofloxacin": {
    name: "Ciprofloxacin",
    generic: "ciprofloxacin hydrochloride",
    class: "Fluoroquinolone Antibiotic",
    interactions: [
      { drug: "magnesium", severity: "major", description: "Reduced ciprofloxacin absorption.", mechanism: "Chelation in GI tract", action: "Separate by 2-4 hours", monitoring: ["Antibiotic efficacy"] },
      { drug: "calcium", severity: "major", description: "Reduced ciprofloxacin absorption.", mechanism: "Chelation", action: "Separate administration", monitoring: ["Clinical response"] },
      { drug: "warfarin", severity: "moderate", description: "May enhance anticoagulant effect.", mechanism: "Altered flora, CYP inhibition", action: "Monitor INR", monitoring: ["INR"] },
      { drug: "theophylline", severity: "major", description: "Increased theophylline levels.", mechanism: "CYP1A2 inhibition", action: "Reduce theophylline dose, monitor levels", monitoring: ["Serum theophylline"] },
    ],
    conditionWarnings: {
      "Epilepsy": { severity: "major", description: "May lower seizure threshold.", action: "Avoid if possible; use with caution" },
      "Chronic Kidney Disease": { severity: "moderate", description: "May require dose adjustment.", action: "Reduce dose if eGFR < 30" },
    }
  },
  "furosemide": {
    name: "Furosemide",
    generic: "furosemide",
    class: "Loop Diuretic",
    interactions: [
      { drug: "lithium", severity: "major", description: "Increased lithium levels.", mechanism: "Reduced lithium clearance", action: "Monitor lithium levels closely", monitoring: ["Serum lithium"] },
      { drug: "digoxin", severity: "moderate", description: "Hypokalemia increases digoxin toxicity risk.", mechanism: "Diuretic-induced hypokalemia", action: "Maintain potassium >4.0 mEq/L", monitoring: ["Serum potassium", "Digoxin level"] },
      { drug: "ibuprofen", severity: "moderate", description: "Reduced diuretic efficacy.", mechanism: "Prostaglandin inhibition", action: "Monitor for fluid retention", monitoring: ["Weight", "Edema", "Renal function"] },
    ],
    conditionWarnings: {
      "Chronic Kidney Disease": { severity: "moderate", description: "May require higher doses; monitor for ototoxicity.", action: "Use with caution; monitor renal function" },
      "Diabetes": { severity: "moderate", description: "May worsen glucose control.", action: "Monitor blood glucose" },
    }
  },
  "ibuprofen": {
    name: "Ibuprofen",
    generic: "ibuprofen",
    class: "NSAID / Analgesic",
    interactions: [
      { drug: "warfarin", severity: "major", description: "Increased risk of GI bleeding.", mechanism: "NSAID-induced gastric ulceration + anticoagulation", action: "Consider acetaminophen instead", monitoring: ["INR", "Hemoglobin"] },
      { drug: "lisinopril", severity: "moderate", description: "May reduce antihypertensive effect; risk of renal impairment.", mechanism: "Prostaglandin inhibition", action: "Monitor BP and renal function", monitoring: ["Blood pressure", "Serum creatinine"] },
      { drug: "furosemide", severity: "moderate", description: "Reduced diuretic efficacy.", mechanism: "Prostaglandin inhibition", action: "Monitor for fluid retention", monitoring: ["Weight", "Edema"] },
    ],
    conditionWarnings: {
      "Peptic Ulcer Disease": { severity: "major", description: "High risk of GI bleeding and ulcer recurrence.", action: "Avoid if possible; use PPI if necessary" },
      "Chronic Kidney Disease": { severity: "major", description: "May worsen renal function.", action: "Avoid in moderate-severe CKD" },
      "Heart Failure": { severity: "major", description: "May worsen fluid retention and renal function.", action: "Avoid or use with extreme caution" },
      "Asthma": { severity: "moderate", description: "May precipitate aspirin-exacerbated respiratory disease.", action: "Use with caution; monitor for bronchospasm" },
    }
  },
  "aspirin": {
    name: "Aspirin",
    generic: "acetylsalicylic acid",
    class: "Antiplatelet / Analgesic",
    interactions: [
      { drug: "warfarin", severity: "major", description: "Increased risk of bleeding. Monitor INR closely.", mechanism: "Additive anticoagulant effect", action: "Avoid combination or use lowest effective doses", monitoring: ["INR", "Signs of bleeding"] },
      { drug: "ibuprofen", severity: "moderate", description: "May reduce antiplatelet effect of aspirin.", mechanism: "Competitive COX-1 binding", action: "Take aspirin 2 hours before ibuprofen", monitoring: ["Clinical efficacy"] },
    ],
    allergyCrossReactivity: ["Aspirin", "NSAIDs", "Ibuprofen", "Naproxen", "Diclofenac"],
    conditionWarnings: {
      "Peptic Ulcer Disease": { severity: "major", description: "High risk of GI bleeding.", action: "Use PPI for gastroprotection; consider alternative" },
      "Chronic Kidney Disease": { severity: "moderate", description: "May worsen renal function.", action: "Use with caution; monitor renal function" },
    }
  },
  "clarithromycin": {
    name: "Clarithromycin",
    generic: "clarithromycin",
    class: "Antibiotic / Macrolide",
    interactions: [
      { drug: "simvastatin", severity: "contraindicated", description: "CONTRAINDICATED. High risk of myopathy/rhabdomyolysis.", mechanism: "CYP3A4 inhibition increases simvastatin levels 10-fold", action: "Contraindicated - do not co-administer", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "warfarin", severity: "major", description: "Increased anticoagulant effect.", mechanism: "CYP3A4 inhibition", action: "Reduce warfarin dose", monitoring: ["INR"] },
      { drug: "amlodipine", severity: "moderate", description: "May increase amlodipine levels.", mechanism: "CYP3A4 inhibition", action: "Monitor for hypotension and edema", monitoring: ["Blood pressure"] },
    ],
    conditionWarnings: {
      "Chronic Kidney Disease": { severity: "moderate", description: "May require dose adjustment.", action: "Reduce dose if eGFR < 30" },
      "Long QT Syndrome": { severity: "major", description: "May prolong QT interval.", action: "Avoid in patients with known QT prolongation" },
    }
  },
};

// Allergy to drug class mapping
const ALLERGY_CLASS_MAP: Record<string, string[]> = {
  "Penicillin": ["Amoxicillin", "Ampicillin", "Amoxicillin/Clavulanate", "Penicillin", "Penicillin G", "Penicillin V"],
  "Sulfa drugs": ["Sulfamethoxazole", "Sulfonamide antibiotics", "Co-trimoxazole"],
  "Aspirin": ["Aspirin", "ASA"],
  "NSAIDs": ["Ibuprofen", "Naproxen", "Diclofenac", "Indomethacin", "Ketorolac", "Meloxicam", "Celecoxib"],
  "Latex": [], // Not drug-related
  "Codeine": ["Codeine", "Hydrocodone", "Oxycodone may cross-react"],
  "Iodine": ["Iodinated contrast", "Povidone-iodine", "Amiodarone"],
};

// Common medications for dropdown
const COMMON_MEDICATIONS = [
  // Cardiovascular
  { name: "Amlodipine", category: "Cardiovascular", dose: "5-10mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Lisinopril", category: "Cardiovascular", dose: "10-40mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Metoprolol", category: "Cardiovascular", dose: "50-200mg", frequency: "Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Atenolol", category: "Cardiovascular", dose: "50-100mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Losartan", category: "Cardiovascular", dose: "50-100mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Furosemide", category: "Cardiovascular", dose: "20-80mg", frequency: "Once/Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Spironolactone", category: "Cardiovascular", dose: "25-50mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Atorvastatin", category: "Cardiovascular", dose: "10-80mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Simvastatin", category: "Cardiovascular", dose: "10-40mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Aspirin", category: "Cardiovascular", dose: "81-325mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Warfarin", category: "Cardiovascular", dose: "2-10mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  // Diabetes
  { name: "Metformin", category: "Diabetes", dose: "500-1000mg", frequency: "Twice daily", icon: Droplets, color: "text-amber-500" },
  { name: "Glibenclamide", category: "Diabetes", dose: "2.5-10mg", frequency: "Once/Twice daily", icon: Droplets, color: "text-amber-500" },
  { name: "Glimepiride", category: "Diabetes", dose: "1-4mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Sitagliptin", category: "Diabetes", dose: "25-100mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Insulin Glargine", category: "Diabetes", dose: "10-80 units", frequency: "Once daily", icon: Syringe, color: "text-amber-500" },
  // Respiratory
  { name: "Salbutamol Inhaler", category: "Respiratory", dose: "100-200mcg", frequency: "PRN", icon: Wind, color: "text-cyan-500" },
  { name: "Budesonide Inhaler", category: "Respiratory", dose: "200-800mcg", frequency: "Twice daily", icon: Wind, color: "text-cyan-500" },
  { name: "Montelukast", category: "Respiratory", dose: "4-10mg", frequency: "Once daily", icon: Wind, color: "text-cyan-500" },
  // Gastrointestinal
  { name: "Omeprazole", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once daily", icon: Activity, color: "text-green-500" },
  { name: "Pantoprazole", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once daily", icon: Activity, color: "text-green-500" },
  // Antibiotics
  { name: "Amoxicillin", category: "Antibiotics", dose: "250-500mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  { name: "Amoxicillin/Clavulanate", category: "Antibiotics", dose: "375-625mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  { name: "Azithromycin", category: "Antibiotics", dose: "250-500mg", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Clarithromycin", category: "Antibiotics", dose: "250-500mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Ciprofloxacin", category: "Antibiotics", dose: "250-750mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Doxycycline", category: "Antibiotics", dose: "100mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Metronidazole", category: "Antibiotics", dose: "250-500mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  // Pain
  { name: "Paracetamol", category: "Pain", dose: "500-1000mg", frequency: "Four times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Ibuprofen", category: "Pain", dose: "200-400mg", frequency: "Three times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Diclofenac", category: "Pain", dose: "50mg", frequency: "Two to three times", icon: Tablets, color: "text-orange-500" },
  { name: "Tramadol", category: "Pain", dose: "50-100mg", frequency: "Four times daily", icon: Tablets, color: "text-orange-500" },
  // Neurology
  { name: "Amitriptyline", category: "Neurology", dose: "25-150mg", frequency: "Once daily", icon: Brain, color: "text-indigo-500" },
  { name: "Carbamazepine", category: "Neurology", dose: "200-400mg", frequency: "Twice daily", icon: Brain, color: "text-indigo-500" },
  { name: "Phenytoin", category: "Neurology", dose: "100-200mg", frequency: "Three times daily", icon: Brain, color: "text-indigo-500" },
  // Steroids
  { name: "Prednisolone", category: "Steroids", dose: "5-60mg", frequency: "Once daily", icon: Tablets, color: "text-yellow-500" },
  { name: "Hydrocortisone", category: "Steroids", dose: "20-100mg", frequency: "Two to four times", icon: Tablets, color: "text-yellow-500" },
];

const MEDICATION_CATEGORIES = [...new Set(COMMON_MEDICATIONS.map(m => m.category))];

const DRUG_ALIASES: Record<string, string> = {
  "coumadin": "warfarin", "glucophage": "metformin", "zocor": "simvastatin",
  "amoxil": "amoxicillin", "prinivil": "lisinopril", "zestril": "lisinopril",
  "prilosec": "omeprazole", "norvasc": "amlodipine", "lopressor": "metoprolol",
  "toprol": "metoprolol", "cipro": "ciprofloxacin", "lasix": "furosemide",
  "advil": "ibuprofen", "motrin": "ibuprofen", "asa": "aspirin",
  "tylenol": "acetaminophen", "paracetamol": "acetaminophen",
};

// ============================================
// INTERFACES
// ============================================

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
  activeMedications: Array<{ name: string; dose: string; frequency: string; }>;
}

interface DrugInteraction {
  id: string;
  type: "drug-drug" | "drug-allergy" | "drug-condition";
  drug1: string;
  drug2?: string;
  allergen?: string;
  condition?: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  mechanism: string;
  action: string;
  monitoring: string[];
}

interface MedicationEntry {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
}

interface PatientDrugCheckerProps {
  preselectedPatientId?: string | null;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PatientDrugChecker({ preselectedPatientId }: PatientDrugCheckerProps) {
  // Patient state
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Medication state
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [newDose, setNewDose] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newRoute, setNewRoute] = useState("oral");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMedicationKey, setSelectedMedicationKey] = useState("");
  const [isCustomMedication, setIsCustomMedication] = useState(false);
  const [customMedName, setCustomMedName] = useState("");

  // Results state
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [realtimeAlerts, setRealtimeAlerts] = useState(true);

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Set preselected patient
  useEffect(() => {
    if (preselectedPatientId && patients.length > 0) {
      const patient = patients.find(p => p.id === preselectedPatientId);
      if (patient) {
        setSelectedPatient(patient);
        // Add patient's active medications to list
        if (patient.activeMedications && patient.activeMedications.length > 0) {
          const existingMeds = patient.activeMedications.map((med, idx) => ({
            id: `existing-${idx}`,
            name: med.name,
            dose: med.dose || "",
            frequency: med.frequency || "",
            route: "oral",
          }));
          setMedications(existingMeds);
        }
      }
    }
  }, [preselectedPatientId, patients]);

  // Fetch patients from API
  const fetchPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const response = await fetch("/api/patients?limit=100");
      const data = await response.json();
      if (data.success) {
        const formattedPatients: PatientInfo[] = data.data.patients.map((p: any) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          mrn: p.mrn,
          dateOfBirth: p.dateOfBirth,
          gender: p.gender,
          allergies: parseJsonArray(p.allergies),
          chronicConditions: parseJsonArray(p.chronicConditions),
          activeMedications: p.medications?.filter((m: any) => m.status === 'active').map((m: any) => ({
            name: m.medicationName,
            dose: m.dosage || "",
            frequency: m.frequency || "",
          })) || [],
        }));
        setPatients(formattedPatients);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast.error("Failed to load patients");
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const parseJsonArray = (jsonStr?: string): string[] => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  // Normalize drug name
  const normalizeDrugName = (name: string): string => {
    const lower = name.toLowerCase().trim();
    return DRUG_ALIASES[lower] || lower;
  };

  // Check ALL interactions for current medications and patient
  const checkAllInteractions = useCallback(() => {
    if (!medications.length) {
      setInteractions([]);
      return;
    }

    setIsScanning(true);
    const foundInteractions: DrugInteraction[] = [];

    // 1. Check drug-drug interactions
    medications.forEach((med1, index) => {
      medications.slice(index + 1).forEach((med2) => {
        const drug1Key = normalizeDrugName(med1.name);
        const drug2Key = normalizeDrugName(med2.name);

        const drug1Data = DRUG_DATABASE[drug1Key];
        if (drug1Data?.interactions) {
          const interaction = drug1Data.interactions.find(
            i => normalizeDrugName(i.drug) === drug2Key
          );
          if (interaction) {
            foundInteractions.push({
              id: `dd-${med1.id}-${med2.id}`,
              type: "drug-drug",
              drug1: med1.name,
              drug2: med2.name,
              severity: interaction.severity as DrugInteraction["severity"],
              description: interaction.description,
              mechanism: interaction.mechanism,
              action: interaction.action,
              monitoring: interaction.monitoring,
            });
          }
        }

        const drug2Data = DRUG_DATABASE[drug2Key];
        if (drug2Data?.interactions) {
          const interaction = drug2Data.interactions.find(
            i => normalizeDrugName(i.drug) === drug1Key
          );
          if (interaction && !foundInteractions.find(i => 
            i.type === "drug-drug" && i.drug1 === med2.name && i.drug2 === med1.name)) {
            foundInteractions.push({
              id: `dd-${med2.id}-${med1.id}`,
              type: "drug-drug",
              drug1: med2.name,
              drug2: med1.name,
              severity: interaction.severity as DrugInteraction["severity"],
              description: interaction.description,
              mechanism: interaction.mechanism,
              action: interaction.action,
              monitoring: interaction.monitoring,
            });
          }
        }
      });
    });

    // 2. Check drug-allergy interactions (if patient selected)
    if (selectedPatient?.allergies?.length) {
      medications.forEach(med => {
        const drugKey = normalizeDrugName(med.name);
        const drugData = DRUG_DATABASE[drugKey];

        selectedPatient.allergies.forEach(allergy => {
          // Check direct allergy match
          const allergyLower = allergy.toLowerCase();
          
          // Check if medication is in the allergy cross-reactivity list
          if (drugData?.allergyCrossReactivity?.some(a => 
            a.toLowerCase().includes(allergyLower) || allergyLower.includes(a.toLowerCase())
          )) {
            foundInteractions.push({
              id: `da-${med.id}-${allergy}`,
              type: "drug-allergy",
              drug1: med.name,
              allergen: allergy,
              severity: "contraindicated",
              description: `Patient is allergic to ${allergy}. ${med.name} may cause cross-reaction.`,
              mechanism: "Allergic cross-reactivity",
              action: "AVOID - Select alternative medication not in the same class",
              monitoring: ["Monitor for allergic reaction if administered"],
            });
          }

          // Check allergy class mapping
          const relatedDrugs = ALLERGY_CLASS_MAP[allergy] || [];
          if (relatedDrugs.some(d => d.toLowerCase().includes(drugKey) || drugKey.includes(d.toLowerCase()))) {
            foundInteractions.push({
              id: `da-${med.id}-${allergy}-class`,
              type: "drug-allergy",
              drug1: med.name,
              allergen: allergy,
              severity: "contraindicated",
              description: `Patient has documented ${allergy} allergy. ${med.name} is contraindicated.`,
              mechanism: "Known drug allergy",
              action: "AVOID - Use alternative medication from different class",
              monitoring: ["Monitor for allergic reaction"],
            });
          }
        });
      });
    }

    // 3. Check drug-condition interactions (if patient selected)
    if (selectedPatient?.chronicConditions?.length) {
      medications.forEach(med => {
        const drugKey = normalizeDrugName(med.name);
        const drugData = DRUG_DATABASE[drugKey];

        if (drugData?.conditionWarnings) {
          selectedPatient.chronicConditions.forEach(condition => {
            // Check for matching condition warnings
            Object.entries(drugData.conditionWarnings).forEach(([condName, warning]) => {
              if (condition.toLowerCase().includes(condName.toLowerCase()) ||
                  condName.toLowerCase().includes(condition.toLowerCase())) {
                // Check if this interaction already exists
                const exists = foundInteractions.find(i => 
                  i.type === "drug-condition" && 
                  i.drug1 === med.name && 
                  i.condition === condition
                );
                if (!exists) {
                  foundInteractions.push({
                    id: `dc-${med.id}-${condition}`,
                    type: "drug-condition",
                    drug1: med.name,
                    condition: condition,
                    severity: warning.severity as DrugInteraction["severity"],
                    description: warning.description,
                    mechanism: `Patient has ${condition}`,
                    action: warning.action,
                    monitoring: ["Clinical monitoring"],
                  });
                }
              }
            });
          });
        }
      });
    }

    setInteractions(foundInteractions);

    setTimeout(() => {
      setIsScanning(false);
      if (foundInteractions.length > 0) {
        const contraindicated = foundInteractions.filter(i => i.severity === "contraindicated").length;
        const major = foundInteractions.filter(i => i.severity === "major").length;
        
        if (contraindicated > 0) {
          toast.error(`Found ${contraindicated} contraindicated interaction(s)! Review immediately.`);
        } else if (major > 0) {
          toast.warning(`Found ${foundInteractions.length} interaction(s) including ${major} major.`);
        } else {
          toast.info(`Found ${foundInteractions.length} moderate/minor interaction(s).`);
        }
      } else {
        toast.success("No interactions found");
      }
    }, 500);
  }, [medications, selectedPatient]);

  // Auto-check when medications change
  useEffect(() => {
    if (medications.length > 0 && realtimeAlerts) {
      const timer = setTimeout(() => {
        checkAllInteractions();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [medications, selectedPatient, realtimeAlerts, checkAllInteractions]);

  // Add medication
  const addMedication = () => {
    let medName = "";
    let medDose = newDose;
    let medFreq = newFrequency;

    if (isCustomMedication) {
      if (!customMedName.trim()) {
        toast.error("Please enter a medication name");
        return;
      }
      medName = customMedName.trim();
    } else {
      if (!selectedMedicationKey) {
        toast.error("Please select a medication");
        return;
      }
      const selectedMed = COMMON_MEDICATIONS.find(m => m.name === selectedMedicationKey);
      if (selectedMed) {
        medName = selectedMed.name;
        if (!medDose) medDose = selectedMed.dose;
        if (!medFreq) medFreq = selectedMed.frequency;
      }
    }

    // Pre-check for allergies before adding
    if (selectedPatient?.allergies?.length) {
      const drugKey = normalizeDrugName(medName);
      const drugData = DRUG_DATABASE[drugKey];
      
      const hasAllergy = selectedPatient.allergies.some(allergy => {
        const allergyLower = allergy.toLowerCase();
        if (drugData?.allergyCrossReactivity?.some(a => 
          a.toLowerCase().includes(allergyLower))) {
          return true;
        }
        const relatedDrugs = ALLERGY_CLASS_MAP[allergy] || [];
        return relatedDrugs.some(d => d.toLowerCase().includes(drugKey) || drugKey.includes(d.toLowerCase()));
      });

      if (hasAllergy) {
        toast.error(`⚠️ ALLERGY ALERT: ${medName} may cross-react with patient's documented allergy!`);
      }
    }

    const med: MedicationEntry = {
      id: `med-${Date.now()}`,
      name: medName,
      dose: medDose,
      frequency: medFreq,
      route: newRoute,
    };

    setMedications(prev => [...prev, med]);
    resetForm();
    toast.success(`Added ${medName}`);
  };

  const resetForm = () => {
    setNewDose("");
    setNewFrequency("");
    setNewRoute("oral");
    setSelectedCategory("");
    setSelectedMedicationKey("");
    setIsCustomMedication(false);
    setCustomMedName("");
    setShowAddDialog(false);
  };

  // Remove medication
  const removeMedication = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
    toast.info("Medication removed");
  };

  // Clear all
  const clearAll = () => {
    setMedications([]);
    setInteractions([]);
    toast.info("All medications cleared");
  };

  // Get severity styling
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "contraindicated":
        return { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", icon: XCircle };
      case "major":
        return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", icon: AlertTriangle };
      case "moderate":
        return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", icon: AlertCircle };
      default:
        return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", icon: Info };
    }
  };

  // Filter interactions
  const filteredInteractions = interactions.filter(i => {
    if (filterSeverity === "all") return true;
    return i.severity === filterSeverity;
  });

  // Filter patients for search
  const filteredPatients = patients.filter(p => {
    if (!patientSearchQuery) return true;
    const query = patientSearchQuery.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
           p.mrn.toLowerCase().includes(query);
  });

  // Severity counts
  const severityCounts = {
    contraindicated: interactions.filter(i => i.severity === "contraindicated").length,
    major: interactions.filter(i => i.severity === "major").length,
    moderate: interactions.filter(i => i.severity === "moderate").length,
    minor: interactions.filter(i => i.severity === "minor").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Pill className="h-7 w-7 text-rose-500" />
            Drug Safety Checker
          </h2>
          <p className="text-slate-500 mt-1">
            Patient-specific drug interaction & allergy analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={realtimeAlerts ? "default" : "outline"}
            size="sm"
            onClick={() => setRealtimeAlerts(!realtimeAlerts)}
          >
            {realtimeAlerts ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            Auto-check
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={checkAllInteractions}
            disabled={medications.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Check Now
          </Button>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-500" />
            Patient Selection
          </CardTitle>
          <CardDescription>
            Select a patient to check allergies, conditions, and current medications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={patientSearchOpen}
                className="w-full justify-between font-normal"
              >
                {selectedPatient ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                        {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{selectedPatient.firstName} {selectedPatient.lastName}</span>
                    <span className="text-muted-foreground">({selectedPatient.mrn})</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a patient...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Search patients..." 
                  value={patientSearchQuery}
                  onValueChange={setPatientSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No patients found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <CommandItem
                        key={patient.id}
                        value={patient.id}
                        onSelect={() => {
                          setSelectedPatient(patient);
                          setPatientSearchOpen(false);
                          setPatientSearchQuery("");
                          // Load patient's active medications
                          if (patient.activeMedications?.length) {
                            setMedications(patient.activeMedications.map((med, idx) => ({
                              id: `existing-${idx}`,
                              name: med.name,
                              dose: med.dose || "",
                              frequency: med.frequency || "",
                              route: "oral",
                            })));
                          } else {
                            setMedications([]);
                          }
                          setInteractions([]);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              MRN: {patient.mrn} • {patient.allergies.length} allergies • {patient.chronicConditions.length} conditions
                            </p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Patient Info Cards */}
          {selectedPatient && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {/* Allergies */}
              <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700">Allergies</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPatient.allergies.length > 0 ? (
                    selectedPatient.allergies.map((a, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-red-200 text-red-700 text-xs">
                        {a}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-red-600">No known allergies</span>
                  )}
                </div>
              </div>

              {/* Chronic Conditions */}
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-700">Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPatient.chronicConditions.length > 0 ? (
                    selectedPatient.chronicConditions.map((c, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-amber-200 text-amber-700 text-xs">
                        {c}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-amber-600">No chronic conditions</span>
                  )}
                </div>
              </div>

              {/* Active Medications */}
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-emerald-700">Current Meds</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPatient.activeMedications.length > 0 ? (
                    selectedPatient.activeMedications.slice(0, 4).map((m, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-emerald-200 text-emerald-700 text-xs">
                        {m.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-emerald-600">No active medications</span>
                  )}
                  {selectedPatient.activeMedications.length > 4 && (
                    <Badge variant="outline" className="bg-white text-xs">
                      +{selectedPatient.activeMedications.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Severity Summary */}
      {interactions.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: "contraindicated", label: "Contraindicated", color: "bg-red-500" },
            { key: "major", label: "Major", color: "bg-orange-500" },
            { key: "moderate", label: "Moderate", color: "bg-yellow-500" },
            { key: "minor", label: "Minor", color: "bg-blue-500" },
          ].map((severity) => (
            <Card key={severity.key} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${severity.color}`} />
                  <span className="text-sm text-slate-600">{severity.label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {severityCounts[severity.key as keyof typeof severityCounts]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Medication List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Medications to Check</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={medications.length === 0}
                >
                  Clear
                </Button>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Medication</DialogTitle>
                      <DialogDescription>
                        Select a medication to check for interactions
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={selectedCategory} onValueChange={(val) => {
                          setSelectedCategory(val);
                          setSelectedMedicationKey("");
                          setIsCustomMedication(false);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {MEDICATION_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedCategory && (
                        <div className="space-y-2">
                          <Label>Medication</Label>
                          <Select value={selectedMedicationKey} onValueChange={(val) => {
                            if (val === "other") {
                              setIsCustomMedication(true);
                              setSelectedMedicationKey("");
                            } else {
                              setIsCustomMedication(false);
                              setSelectedMedicationKey(val);
                              const med = COMMON_MEDICATIONS.find(m => m.name === val);
                              if (med) {
                                setNewDose(med.dose);
                                setNewFrequency(med.frequency);
                              }
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select medication..." />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_MEDICATIONS.filter(m => m.category === selectedCategory).map((med) => {
                                const IconComponent = med.icon;
                                return (
                                  <SelectItem key={med.name} value={med.name}>
                                    <div className="flex items-center gap-2">
                                      <IconComponent className={`h-4 w-4 ${med.color}`} />
                                      <span>{med.name}</span>
                                      <span className="text-xs text-muted-foreground">({med.dose})</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                              <SelectItem value="other">
                                <span className="text-amber-600">Other (enter manually)</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {isCustomMedication && (
                        <div className="space-y-2">
                          <Label>Medication Name</Label>
                          <Input
                            placeholder="Enter medication name..."
                            value={customMedName}
                            onChange={(e) => setCustomMedName(e.target.value)}
                          />
                        </div>
                      )}

                      {(selectedMedicationKey || isCustomMedication) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Dose</Label>
                            <Input
                              placeholder="e.g., 500mg"
                              value={newDose}
                              onChange={(e) => setNewDose(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Frequency</Label>
                            <Input
                              placeholder="e.g., Twice daily"
                              value={newFrequency}
                              onChange={(e) => setNewFrequency(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter className="mt-4">
                      <Button variant="outline" onClick={resetForm}>Cancel</Button>
                      <Button onClick={addMedication} disabled={!selectedMedicationKey && !customMedName}>
                        Add Medication
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {medications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center">
                  <Pill className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">Add medications to check interactions</p>
                  {selectedPatient?.activeMedications?.length && (
                    <p className="text-sm text-emerald-600 mt-2">
                      Patient has {selectedPatient.activeMedications.length} active medications loaded
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {medications.map((med) => (
                    <motion.div
                      key={med.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white"
                    >
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-slate-500">
                          {med.dose} • {med.frequency}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => removeMedication(med.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Interactions Results */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Interaction Results</CardTitle>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="contraindicated">Contraindicated</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isScanning ? (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
                <p className="text-slate-500">Analyzing interactions...</p>
              </div>
            ) : filteredInteractions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                {medications.length === 0 ? (
                  <>
                    <Pill className="h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">Add medications to see interactions</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-12 w-12 text-emerald-400 mb-4" />
                    <p className="text-emerald-600 font-medium">No interactions found!</p>
                    <p className="text-sm text-slate-400 mt-1">
                      All checked medications appear safe together
                      {selectedPatient && " for this patient"}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {filteredInteractions.map((interaction) => {
                    const style = getSeverityStyle(interaction.severity);
                    const IconComponent = style.icon;
                    
                    return (
                      <motion.div
                        key={interaction.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "p-4 rounded-lg border",
                          style.bg,
                          style.border
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className={cn("h-5 w-5 mt-0.5", style.text)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", style.bg, style.text, style.border)}
                              >
                                {interaction.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {interaction.type === "drug-drug" && "Drug-Drug"}
                                {interaction.type === "drug-allergy" && "⚠️ ALLERGY"}
                                {interaction.type === "drug-condition" && "CONDITION"}
                              </Badge>
                            </div>
                            
                            <p className="font-medium mt-2 text-slate-800">
                              {interaction.type === "drug-drug" && (
                                <>{interaction.drug1} + {interaction.drug2}</>
                              )}
                              {interaction.type === "drug-allergy" && (
                                <>{interaction.drug1} (Allergy: {interaction.allergen})</>
                              )}
                              {interaction.type === "drug-condition" && (
                                <>{interaction.drug1} (Condition: {interaction.condition})</>
                              )}
                            </p>
                            
                            <p className="text-sm text-slate-600 mt-1">
                              {interaction.description}
                            </p>
                            
                            <div className="mt-2 p-2 bg-white/50 rounded text-sm">
                              <p><strong>Action:</strong> {interaction.action}</p>
                              {interaction.monitoring.length > 0 && (
                                <p className="mt-1">
                                  <strong>Monitor:</strong> {interaction.monitoring.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PatientDrugChecker;
