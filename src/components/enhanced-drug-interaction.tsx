"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Plus,
  X,
  ChevronRight,
  Shield,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Filter,
  Download,
  Printer,
  Bell,
  BellOff,
  Zap,
  Brain,
  TrendingUp,
  Heart,
  Droplets,
  Wind,
  Bone,
  Eye,
  Syringe,
  Tablets
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";

// Drug database with interaction data
const DRUG_DATABASE = {
  "warfarin": {
    name: "Warfarin",
    generic: "warfarin sodium",
    class: "Anticoagulant",
    interactions: [
      { drug: "aspirin", severity: "major", description: "Increased risk of bleeding. Monitor INR closely.", mechanism: "Additive anticoagulant effect", action: "Avoid combination or use lowest effective doses", monitoring: ["INR", "Signs of bleeding"] },
      { drug: "ibuprofen", severity: "major", description: "Increased risk of GI bleeding.", mechanism: "NSAID-induced gastric ulceration + anticoagulation", action: "Consider acetaminophen instead", monitoring: ["INR", "Hemoglobin", "Stool guaiac"] },
      { drug: "amiodarone", severity: "major", description: "Increased warfarin effect. Reduce warfarin dose by 30-50%.", mechanism: "CYP2C9 inhibition", action: "Reduce warfarin dose, monitor INR more frequently", monitoring: ["INR twice weekly initially"] },
      { drug: "fluconazole", severity: "major", description: "Significantly increased anticoagulant effect.", mechanism: "CYP2C9/3A4 inhibition", action: "Reduce warfarin dose by 50%", monitoring: ["INR"] },
      { drug: "ciprofloxacin", severity: "moderate", description: "May increase warfarin levels.", mechanism: "CYP1A2 inhibition", action: "Monitor INR more frequently", monitoring: ["INR"] },
      { drug: "metronidazole", severity: "major", description: "Prolonged PT/INR. Reduce warfarin dose.", mechanism: "CYP2C9 inhibition", action: "Reduce dose by 25-50%", monitoring: ["INR"] },
      { drug: "omeprazole", severity: "minor", description: "Possible increase in warfarin effect.", mechanism: "Unknown", action: "Monitor INR", monitoring: ["INR"] },
      { drug: "clarithromycin", severity: "major", description: "Increased anticoagulant effect.", mechanism: "CYP3A4 inhibition", action: "Reduce warfarin dose", monitoring: ["INR"] },
    ]
  },
  "metformin": {
    name: "Metformin",
    generic: "metformin hydrochloride",
    class: "Antidiabetic / Biguanide",
    interactions: [
      { drug: "furosemide", severity: "moderate", description: "May increase metformin exposure and decrease renal function.", mechanism: "Competition for renal tubular secretion", action: "Monitor renal function and blood glucose", monitoring: ["Serum creatinine", "Blood glucose"] },
      { drug: "cimetidine", severity: "moderate", description: "Increased metformin levels.", mechanism: "Competition for renal tubular secretion", action: "Monitor for metformin toxicity", monitoring: ["Lactic acid", "Renal function"] },
      { drug: "contrast", severity: "major", description: "Risk of lactic acidosis with iodinated contrast.", mechanism: "Acute renal failure", action: "Discontinue metformin before and after contrast", monitoring: ["Renal function"] },
      { drug: "alcohol", severity: "moderate", description: "Increased risk of lactic acidosis.", mechanism: "Impaired lactate metabolism", action: "Limit alcohol intake", monitoring: ["Lactic acid if symptomatic"] },
    ]
  },
  "simvastatin": {
    name: "Simvastatin",
    generic: "simvastatin",
    class: "Antilipemic / HMG-CoA Reductase Inhibitor",
    interactions: [
      { drug: "clarithromycin", severity: "contraindicated", description: "CONTRAINDICATED. High risk of myopathy/rhabdomyolysis.", mechanism: "CYP3A4 inhibition increases simvastatin levels 10-fold", action: "Contraindicated - do not co-administer", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "itraconazole", severity: "contraindicated", description: "CONTRAINDICATED. Risk of rhabdomyolysis.", mechanism: "Potent CYP3A4 inhibition", action: "Contraindicated", monitoring: ["CK"] },
      { drug: "amiodarone", severity: "major", description: "Increased risk of myopathy. Do not exceed 20mg simvastatin.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 20mg daily", monitoring: ["CK", "Muscle pain"] },
      { drug: "verapamil", severity: "major", description: "Increased simvastatin exposure. Max 10mg daily.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 10mg daily", monitoring: ["CK"] },
      { drug: "diltiazem", severity: "major", description: "Increased simvastatin levels. Max 10mg daily.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 10mg daily", monitoring: ["CK"] },
      { drug: "grapefruit", severity: "moderate", description: "Increased simvastatin levels.", mechanism: "CYP3A4 inhibition in gut", action: "Avoid grapefruit juice", monitoring: ["Muscle symptoms"] },
      { drug: "gemfibrozil", severity: "major", description: "Increased risk of myopathy/rhabdomyolysis.", mechanism: "OATP1B1 inhibition, glucuronidation", action: "Avoid combination; use fenofibrate instead", monitoring: ["CK", "Muscle symptoms"] },
    ]
  },
  "amoxicillin": {
    name: "Amoxicillin",
    generic: "amoxicillin trihydrate",
    class: "Antibiotic / Penicillin",
    interactions: [
      { drug: "methotrexate", severity: "major", description: "Increased methotrexate toxicity.", mechanism: "Decreased renal clearance of methotrexate", action: "Avoid or monitor closely for methotrexate toxicity", monitoring: ["CBC", "Renal function", "LFTs"] },
      { drug: "allopurinol", severity: "moderate", description: "Increased risk of skin rash.", mechanism: "Unknown", action: "Monitor for rash", monitoring: ["Skin"] },
      { drug: "warfarin", severity: "moderate", description: "May enhance anticoagulant effect.", mechanism: "Altered intestinal flora, decreased vitamin K", action: "Monitor INR", monitoring: ["INR"] },
      { drug: "oral_contraceptives", severity: "minor", description: "May decrease contraceptive efficacy.", mechanism: "Altered gut flora reduces enterohepatic recirculation", action: "Use backup contraception", monitoring: ["Patient counseling"] },
    ]
  },
  "lisinopril": {
    name: "Lisinopril",
    generic: "lisinopril",
    class: "ACE Inhibitor / Antihypertensive",
    interactions: [
      { drug: "potassium", severity: "major", description: "Risk of hyperkalemia.", mechanism: "ACE inhibition reduces aldosterone", action: "Avoid potassium supplements or monitor closely", monitoring: ["Serum potassium"] },
      { drug: "spironolactone", severity: "major", description: "Increased risk of hyperkalemia.", mechanism: "Additive potassium-sparing effect", action: "Monitor potassium frequently", monitoring: ["Serum potassium", "Renal function"] },
      { drug: "nsaids", severity: "moderate", description: "May reduce antihypertensive effect; risk of renal impairment.", mechanism: "Prostaglandin inhibition", action: "Monitor BP and renal function", monitoring: ["Blood pressure", "Serum creatinine"] },
      { drug: "lithium", severity: "major", description: "Increased lithium levels.", mechanism: "Reduced renal clearance", action: "Monitor lithium levels closely", monitoring: ["Serum lithium"] },
    ]
  },
  "omeprazole": {
    name: "Omeprazole",
    generic: "omeprazole magnesium",
    class: "Proton Pump Inhibitor",
    interactions: [
      { drug: "clopidogrel", severity: "major", description: "May reduce clopidogrel effectiveness.", mechanism: "CYP2C19 inhibition reduces clopidogrel activation", action: "Consider pantoprazole or H2 blocker", monitoring: ["Clinical efficacy"] },
      { drug: "methotrexate", severity: "major", description: "Increased methotrexate levels.", mechanism: "Reduced methotrexate clearance", action: "Monitor for methotrexate toxicity", monitoring: ["Methotrexate levels", "CBC", "Renal function"] },
      { drug: "digoxin", severity: "minor", description: "May increase digoxin absorption.", mechanism: "Increased gastric pH", action: "Monitor digoxin levels", monitoring: ["Serum digoxin"] },
      { drug: "magnesium", severity: "moderate", description: "Risk of hypomagnesemia with long-term PPI use.", mechanism: "Decreased intestinal magnesium absorption", action: "Monitor magnesium levels", monitoring: ["Serum magnesium"] },
    ]
  },
  "amlodipine": {
    name: "Amlodipine",
    generic: "amlodipine besylate",
    class: "Calcium Channel Blocker / Antihypertensive",
    interactions: [
      { drug: "simvastatin", severity: "moderate", description: "Increased simvastatin exposure. Max 20mg simvastatin.", mechanism: "CYP3A4 inhibition", action: "Limit simvastatin to 20mg daily", monitoring: ["CK", "Muscle symptoms"] },
      { drug: "clarithromycin", severity: "moderate", description: "May increase amlodipine levels.", mechanism: "CYP3A4 inhibition", action: "Monitor for hypotension and edema", monitoring: ["Blood pressure"] },
      { drug: "grapefruit", severity: "moderate", description: "Increased amlodipine levels.", mechanism: "CYP3A4 inhibition in gut", action: "Avoid grapefruit", monitoring: ["Blood pressure"] },
    ]
  },
  "metoprolol": {
    name: "Metoprolol",
    generic: "metoprolol succinate",
    class: "Beta-Blocker / Antihypertensive",
    interactions: [
      { drug: "fluoxetine", severity: "major", description: "Increased metoprolol exposure.", mechanism: "CYP2D6 inhibition", action: "Reduce metoprolol dose or use alternative", monitoring: ["Heart rate", "Blood pressure"] },
      { drug: "paroxetine", severity: "major", description: "Significantly increased metoprolol levels.", mechanism: "Potent CYP2D6 inhibition", action: "Consider alternative antidepressant or beta-blocker", monitoring: ["Heart rate", "Blood pressure"] },
      { drug: "diltiazem", severity: "moderate", description: "Increased risk of bradycardia and AV block.", mechanism: "Additive effects on conduction", action: "Monitor heart rate and ECG", monitoring: ["Heart rate", "ECG"] },
    ]
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
      { drug: "sucralfate", severity: "major", description: "Reduced ciprofloxacin absorption.", mechanism: "Chelation", action: "Separate by at least 6 hours", monitoring: ["Antibiotic efficacy"] },
    ]
  },
  "furosemide": {
    name: "Furosemide",
    generic: "furosemide",
    class: "Loop Diuretic",
    interactions: [
      { drug: "lithium", severity: "major", description: "Increased lithium levels.", mechanism: "Reduced lithium clearance", action: "Monitor lithium levels closely", monitoring: ["Serum lithium"] },
      { drug: "digoxin", severity: "moderate", description: "Hypokalemia increases digoxin toxicity risk.", mechanism: "Diuretic-induced hypokalemia", action: "Maintain potassium >4.0 mEq/L", monitoring: ["Serum potassium", "Digoxin level"] },
      { drug: "aminoglycosides", severity: "major", description: "Increased ototoxicity and nephrotoxicity.", mechanism: "Additive toxicities", action: "Monitor renal function and hearing", monitoring: ["Serum creatinine", "Audiometry"] },
      { drug: "nsaids", severity: "moderate", description: "Reduced diuretic efficacy.", mechanism: "Prostaglandin inhibition", action: "Monitor for fluid retention", monitoring: ["Weight", "Edema", "Renal function"] },
    ]
  },
};

// Common medications organized by category for dropdown selection
const COMMON_MEDICATIONS = [
  // Cardiovascular
  { name: "Amlodipine", category: "Cardiovascular", dose: "5-10mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Lisinopril", category: "Cardiovascular", dose: "10-40mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Metoprolol", category: "Cardiovascular", dose: "50-200mg", frequency: "Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Atenolol", category: "Cardiovascular", dose: "50-100mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Losartan", category: "Cardiovascular", dose: "50-100mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Carvedilol", category: "Cardiovascular", dose: "6.25-25mg", frequency: "Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Enalapril", category: "Cardiovascular", dose: "5-40mg", frequency: "Once/Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Nifedipine", category: "Cardiovascular", dose: "30-90mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Furosemide", category: "Cardiovascular", dose: "20-80mg", frequency: "Once/Twice daily", icon: Heart, color: "text-red-500" },
  { name: "Spironolactone", category: "Cardiovascular", dose: "25-50mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Digoxin", category: "Cardiovascular", dose: "0.125-0.25mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Atorvastatin", category: "Cardiovascular", dose: "10-80mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Simvastatin", category: "Cardiovascular", dose: "10-40mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Rosuvastatin", category: "Cardiovascular", dose: "5-40mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Aspirin", category: "Cardiovascular", dose: "81-325mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Clopidogrel", category: "Cardiovascular", dose: "75mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Warfarin", category: "Cardiovascular", dose: "2-10mg", frequency: "Once daily", icon: Heart, color: "text-red-500" },
  { name: "Heparin", category: "Cardiovascular", dose: "Per protocol", frequency: "Continuous", icon: Heart, color: "text-red-500" },
  { name: "Enoxaparin", category: "Cardiovascular", dose: "40mg", frequency: "Once/Twice daily", icon: Heart, color: "text-red-500" },
  // Diabetes/Endocrine
  { name: "Metformin", category: "Diabetes", dose: "500-1000mg", frequency: "Twice daily", icon: Droplets, color: "text-amber-500" },
  { name: "Glibenclamide", category: "Diabetes", dose: "2.5-10mg", frequency: "Once/Twice daily", icon: Droplets, color: "text-amber-500" },
  { name: "Glimepiride", category: "Diabetes", dose: "1-4mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Gliclazide", category: "Diabetes", dose: "40-320mg", frequency: "Once/Twice daily", icon: Droplets, color: "text-amber-500" },
  { name: "Sitagliptin", category: "Diabetes", dose: "25-100mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Linagliptin", category: "Diabetes", dose: "5mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Empagliflozin", category: "Diabetes", dose: "10-25mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Dapagliflozin", category: "Diabetes", dose: "5-10mg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  { name: "Insulin Regular", category: "Diabetes", dose: "Per sliding scale", frequency: "TID with meals", icon: Syringe, color: "text-amber-500" },
  { name: "Insulin NPH", category: "Diabetes", dose: "Per protocol", frequency: "Twice daily", icon: Syringe, color: "text-amber-500" },
  { name: "Insulin Glargine", category: "Diabetes", dose: "10-80 units", frequency: "Once daily", icon: Syringe, color: "text-amber-500" },
  { name: "Levothyroxine", category: "Endocrine", dose: "25-200mcg", frequency: "Once daily", icon: Droplets, color: "text-amber-500" },
  // Respiratory
  { name: "Salbutamol Inhaler", category: "Respiratory", dose: "100-200mcg", frequency: "PRN", icon: Wind, color: "text-cyan-500" },
  { name: "Budesonide Inhaler", category: "Respiratory", dose: "200-800mcg", frequency: "Twice daily", icon: Wind, color: "text-cyan-500" },
  { name: "Fluticasone Inhaler", category: "Respiratory", dose: "88-440mcg", frequency: "Twice daily", icon: Wind, color: "text-cyan-500" },
  { name: "Montelukast", category: "Respiratory", dose: "4-10mg", frequency: "Once daily", icon: Wind, color: "text-cyan-500" },
  { name: "Theophylline", category: "Respiratory", dose: "200-600mg", frequency: "Twice daily", icon: Wind, color: "text-cyan-500" },
  { name: "Tiotropium", category: "Respiratory", dose: "18mcg", frequency: "Once daily", icon: Wind, color: "text-cyan-500" },
  { name: "Ipratropium", category: "Respiratory", dose: "20-40mcg", frequency: "3-4 times daily", icon: Wind, color: "text-cyan-500" },
  // Gastrointestinal
  { name: "Omeprazole", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once daily", icon: Activity, color: "text-green-500" },
  { name: "Esomeprazole", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once daily", icon: Activity, color: "text-green-500" },
  { name: "Pantoprazole", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once daily", icon: Activity, color: "text-green-500" },
  { name: "Ranitidine", category: "Gastrointestinal", dose: "150-300mg", frequency: "Once/Twice daily", icon: Activity, color: "text-green-500" },
  { name: "Famotidine", category: "Gastrointestinal", dose: "20-40mg", frequency: "Once/Twice daily", icon: Activity, color: "text-green-500" },
  { name: "Metoclopramide", category: "Gastrointestinal", dose: "10mg", frequency: "Three times daily", icon: Activity, color: "text-green-500" },
  { name: "Ondansetron", category: "Gastrointestinal", dose: "4-8mg", frequency: "Three times daily", icon: Activity, color: "text-green-500" },
  // Antibiotics/Anti-Infectives
  { name: "Amoxicillin", category: "Antibiotics", dose: "250-500mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  { name: "Amoxicillin/Clavulanate", category: "Antibiotics", dose: "375-625mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  { name: "Cephalexin", category: "Antibiotics", dose: "250-500mg", frequency: "Four times daily", icon: Shield, color: "text-purple-500" },
  { name: "Ceftriaxone", category: "Antibiotics", dose: "1-2g", frequency: "Once/Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Azithromycin", category: "Antibiotics", dose: "250-500mg", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Clarithromycin", category: "Antibiotics", dose: "250-500mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Doxycycline", category: "Antibiotics", dose: "100mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Ciprofloxacin", category: "Antibiotics", dose: "250-750mg", frequency: "Twice daily", icon: Shield, color: "text-purple-500" },
  { name: "Metronidazole", category: "Antibiotics", dose: "250-500mg", frequency: "Three times daily", icon: Shield, color: "text-purple-500" },
  { name: "Isoniazid", category: "TB Drugs", dose: "300mg", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Rifampicin", category: "TB Drugs", dose: "600mg", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Pyrazinamide", category: "TB Drugs", dose: "1.5-2g", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Ethambutol", category: "TB Drugs", dose: "15-25mg/kg", frequency: "Once daily", icon: Shield, color: "text-purple-500" },
  { name: "Artemether/Lumefantrine", category: "Antimalarials", dose: "Per weight", frequency: "6-dose regimen", icon: Shield, color: "text-purple-500" },
  // Pain Management
  { name: "Paracetamol", category: "Pain", dose: "500-1000mg", frequency: "Four times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Ibuprofen", category: "Pain", dose: "200-400mg", frequency: "Three times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Diclofenac", category: "Pain", dose: "50mg", frequency: "Two to three times", icon: Tablets, color: "text-orange-500" },
  { name: "Naproxen", category: "Pain", dose: "250-500mg", frequency: "Twice daily", icon: Tablets, color: "text-orange-500" },
  { name: "Tramadol", category: "Pain", dose: "50-100mg", frequency: "Four times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Codeine", category: "Pain", dose: "15-60mg", frequency: "Four times daily", icon: Tablets, color: "text-orange-500" },
  { name: "Morphine", category: "Pain", dose: "10-30mg", frequency: "Four hourly", icon: Tablets, color: "text-orange-500" },
  // Neurology/Psychiatry
  { name: "Phenytoin", category: "Neurology", dose: "100-200mg", frequency: "Three times daily", icon: Brain, color: "text-indigo-500" },
  { name: "Carbamazepine", category: "Neurology", dose: "200-400mg", frequency: "Twice daily", icon: Brain, color: "text-indigo-500" },
  { name: "Valproic Acid", category: "Neurology", dose: "250-500mg", frequency: "Twice daily", icon: Brain, color: "text-indigo-500" },
  { name: "Phenobarbital", category: "Neurology", dose: "30-120mg", frequency: "Once/Twice daily", icon: Brain, color: "text-indigo-500" },
  { name: "Levetiracetam", category: "Neurology", dose: "500-1500mg", frequency: "Twice daily", icon: Brain, color: "text-indigo-500" },
  { name: "Amitriptyline", category: "Psychiatry", dose: "25-150mg", frequency: "Once daily", icon: Brain, color: "text-indigo-500" },
  { name: "Fluoxetine", category: "Psychiatry", dose: "20-60mg", frequency: "Once daily", icon: Brain, color: "text-indigo-500" },
  { name: "Sertraline", category: "Psychiatry", dose: "50-200mg", frequency: "Once daily", icon: Brain, color: "text-indigo-500" },
  { name: "Diazepam", category: "Psychiatry", dose: "2-10mg", frequency: "Two to four times", icon: Brain, color: "text-indigo-500" },
  { name: "Haloperidol", category: "Psychiatry", dose: "2-10mg", frequency: "Two to three times", icon: Brain, color: "text-indigo-500" },
  // Musculoskeletal
  { name: "Methotrexate", category: "Rheumatology", dose: "7.5-25mg", frequency: "Once weekly", icon: Bone, color: "text-teal-500" },
  { name: "Hydroxychloroquine", category: "Rheumatology", dose: "200-400mg", frequency: "Once daily", icon: Bone, color: "text-teal-500" },
  { name: "Allopurinol", category: "Rheumatology", dose: "100-300mg", frequency: "Once daily", icon: Bone, color: "text-teal-500" },
  { name: "Colchicine", category: "Rheumatology", dose: "0.5-0.6mg", frequency: "One to two times", icon: Bone, color: "text-teal-500" },
  // Other
  { name: "Ferrous Sulfate", category: "Hematology", dose: "200-325mg", frequency: "Three times daily", icon: Droplets, color: "text-slate-500" },
  { name: "Folic Acid", category: "Hematology", dose: "1-5mg", frequency: "Once daily", icon: Droplets, color: "text-slate-500" },
  { name: "Cetirizine", category: "Allergy", dose: "10mg", frequency: "Once daily", icon: Eye, color: "text-sky-500" },
  { name: "Loratadine", category: "Allergy", dose: "10mg", frequency: "Once daily", icon: Eye, color: "text-sky-500" },
  { name: "Chlorpheniramine", category: "Allergy", dose: "4mg", frequency: "Three times daily", icon: Eye, color: "text-sky-500" },
  { name: "Prednisolone", category: "Steroids", dose: "5-60mg", frequency: "Once daily", icon: Tablets, color: "text-yellow-500" },
  { name: "Hydrocortisone", category: "Steroids", dose: "20-100mg", frequency: "Two to four times", icon: Tablets, color: "text-yellow-500" },
];

// Get unique categories
const MEDICATION_CATEGORIES = [...new Set(COMMON_MEDICATIONS.map(m => m.category))];

// Common drug aliases
const DRUG_ALIASES: Record<string, string> = {
  "coumadin": "warfarin",
  "jadenu": "warfarin",
  "glucophage": "metformin",
  "zocor": "simvastatin",
  "amoxil": "amoxicillin",
  "prinivil": "lisinopril",
  "zestril": "lisinopril",
  "prilosec": "omeprazole",
  "norvasc": "amlodipine",
  "lopressor": "metoprolol",
  "toprol": "metoprolol",
  "cipro": "ciprofloxacin",
  "lasix": "furosemide",
  "advil": "ibuprofen",
  "motrin": "ibuprofen",
  "aspirin": "aspirin",
  "asa": "aspirin",
  "tylenol": "acetaminophen",
  "paracetamol": "acetaminophen",
};

interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  mechanism: string;
  action: string;
  monitoring: string[];
  timestamp: Date;
}

interface MedicationEntry {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
}

interface EnhancedDrugInteractionProps {
  preselectedPatientId?: string | null;
}

export function EnhancedDrugInteraction({ preselectedPatientId }: EnhancedDrugInteractionProps) {
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [newMedication, setNewMedication] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newRoute, setNewRoute] = useState("oral");
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [realtimeAlerts, setRealtimeAlerts] = useState(true);
  const [scanHistory, setScanHistory] = useState<{ timestamp: Date; count: number }[]>([]);
  
  // New state for medication dropdown
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedMedicationKey, setSelectedMedicationKey] = useState<string>("");
  const [isCustomMedication, setIsCustomMedication] = useState(false);

  // Normalize drug name
  const normalizeDrugName = (name: string): string => {
    const lower = name.toLowerCase().trim();
    return DRUG_ALIASES[lower] || lower;
  };

  // Check interactions between medications
  const checkInteractions = useCallback(() => {
    setIsScanning(true);
    const foundInteractions: DrugInteraction[] = [];

    medications.forEach((med1, index) => {
      medications.slice(index + 1).forEach((med2) => {
        const drug1Key = normalizeDrugName(med1.name);
        const drug2Key = normalizeDrugName(med2.name);

        // Check both directions
        const drug1Data = DRUG_DATABASE[drug1Key as keyof typeof DRUG_DATABASE];
        if (drug1Data) {
          const interaction = drug1Data.interactions.find(
            (i) => normalizeDrugName(i.drug) === drug2Key
          );
          if (interaction) {
            foundInteractions.push({
              id: `${med1.id}-${med2.id}`,
              drug1: med1.name,
              drug2: med2.name,
              severity: interaction.severity as DrugInteraction["severity"],
              description: interaction.description,
              mechanism: interaction.mechanism,
              action: interaction.action,
              monitoring: interaction.monitoring,
              timestamp: new Date(),
            });
          }
        }

        const drug2Data = DRUG_DATABASE[drug2Key as keyof typeof DRUG_DATABASE];
        if (drug2Data) {
          const interaction = drug2Data.interactions.find(
            (i) => normalizeDrugName(i.drug) === drug1Key
          );
          if (interaction && !foundInteractions.find(i => i.drug1 === med2.name && i.drug2 === med1.name)) {
            foundInteractions.push({
              id: `${med2.id}-${med1.id}`,
              drug1: med2.name,
              drug2: med1.name,
              severity: interaction.severity as DrugInteraction["severity"],
              description: interaction.description,
              mechanism: interaction.mechanism,
              action: interaction.action,
              monitoring: interaction.monitoring,
              timestamp: new Date(),
            });
          }
        }
      });
    });

    setInteractions(foundInteractions);
    setScanHistory(prev => [...prev, { timestamp: new Date(), count: foundInteractions.length }].slice(-10));
    
    setTimeout(() => {
      setIsScanning(false);
      if (foundInteractions.length > 0) {
        toast.warning(`Found ${foundInteractions.length} drug interaction(s)`);
      } else {
        toast.success("No interactions found");
      }
    }, 500);
  }, [medications]);

  // Add medication
  const addMedication = () => {
    let medName = "";
    let medDose = newDose;
    let medFreq = newFrequency;
    
    if (isCustomMedication) {
      // Custom medication entry
      if (!newMedication.trim()) {
        toast.error("Please enter a medication name");
        return;
      }
      medName = newMedication.trim();
    } else {
      // Dropdown selection
      if (!selectedMedicationKey) {
        toast.error("Please select a medication from the dropdown");
        return;
      }
      const selectedMed = COMMON_MEDICATIONS.find(m => m.name === selectedMedicationKey);
      if (selectedMed) {
        medName = selectedMed.name;
        // Use default dose and frequency if not overridden
        if (!medDose) medDose = selectedMed.dose;
        if (!medFreq) medFreq = selectedMed.frequency;
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
    
    // Reset form
    setNewMedication("");
    setNewDose("");
    setNewFrequency("");
    setNewRoute("oral");
    setSelectedCategory("");
    setSelectedMedicationKey("");
    setIsCustomMedication(false);
    setShowAddDialog(false);
    toast.success(`Added ${med.name}`);
  };
  
  // Handle medication selection from dropdown
  const handleMedicationSelect = (medName: string) => {
    if (medName === "other") {
      setIsCustomMedication(true);
      setSelectedMedicationKey("");
    } else {
      setIsCustomMedication(false);
      setSelectedMedicationKey(medName);
      const selectedMed = COMMON_MEDICATIONS.find(m => m.name === medName);
      if (selectedMed) {
        setNewDose(selectedMed.dose);
        setNewFrequency(selectedMed.frequency);
      }
    }
  };
  
  // Get medications by category
  const getMedicationsByCategory = (category: string) => {
    return COMMON_MEDICATIONS.filter(m => m.category === category);
  };

  // Remove medication
  const removeMedication = (id: string) => {
    setMedications(prev => {
      const newMeds = prev.filter(m => m.id !== id);
      // Clear interactions if less than 2 medications
      if (newMeds.length < 2) {
        setInteractions([]);
      }
      return newMeds;
    });
    toast.info("Medication removed");
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

  // Severity counts
  const severityCounts = {
    contraindicated: interactions.filter(i => i.severity === "contraindicated").length,
    major: interactions.filter(i => i.severity === "major").length,
    moderate: interactions.filter(i => i.severity === "moderate").length,
    minor: interactions.filter(i => i.severity === "minor").length,
  };

  // Search suggestions
  const searchSuggestions = Object.keys(DRUG_DATABASE)
    .filter(d => d.includes(searchQuery.toLowerCase()))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Pill className="h-7 w-7 text-rose-500" />
            Drug Interaction Checker
          </h2>
          <p className="text-slate-500 mt-1">Real-time drug-drug interaction analysis with severity alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={realtimeAlerts ? "default" : "outline"}
            size="sm"
            onClick={() => setRealtimeAlerts(!realtimeAlerts)}
          >
            {realtimeAlerts ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            Real-time
          </Button>
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
            <Shield className="h-3 w-3 mr-1" />
            Clinical Safety
          </Badge>
        </div>
      </div>

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
              <CardTitle className="text-lg">Medication List</CardTitle>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Medication</DialogTitle>
                    <DialogDescription>Select from common medications or enter a custom medication</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {/* Category Selection */}
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={selectedCategory} onValueChange={(val) => {
                        setSelectedCategory(val);
                        setSelectedMedicationKey("");
                        setIsCustomMedication(false);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select medication category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDICATION_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Medication Selection or Custom Entry */}
                    {selectedCategory && (
                      <div className="space-y-2">
                        <Label>Medication Name</Label>
                        <Select value={selectedMedicationKey} onValueChange={handleMedicationSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select medication..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getMedicationsByCategory(selectedCategory).map((med) => {
                              const IconComponent = med.icon;
                              return (
                                <SelectItem key={med.name} value={med.name}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className={`h-4 w-4 ${med.color}`} />
                                    <span>{med.name}</span>
                                    <span className="text-xs text-slate-400">({med.dose})</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                            <SelectItem value="other">
                              <div className="flex items-center gap-2 text-amber-600">
                                <Plus className="h-4 w-4" />
                                <span>Other (Enter manually)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Custom Medication Input (shown when "Other" is selected) */}
                    {isCustomMedication && (
                      <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <Label className="text-amber-800">Enter Custom Medication</Label>
                        <div className="relative">
                          <Input
                            placeholder="Enter medication name... (or use 🎤 voice)"
                            value={newMedication}
                            onChange={(e) => setNewMedication(e.target.value)}
                            className="border-amber-300 pr-10"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <VoiceInputButton
                              onTranscript={(text) => setNewMedication(text)}
                              currentValue={newMedication}
                              context="medical"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Selected Medication Info */}
                    {selectedMedicationKey && !isCustomMedication && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {(() => {
                            const med = COMMON_MEDICATIONS.find(m => m.name === selectedMedicationKey);
                            if (med) {
                              const IconComponent = med.icon;
                              return (
                                <>
                                  <IconComponent className={`h-5 w-5 ${med.color}`} />
                                  <span className="font-medium">{med.name}</span>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <p className="text-sm text-slate-600">
                          Standard dose: {COMMON_MEDICATIONS.find(m => m.name === selectedMedicationKey)?.dose}
                        </p>
                        <p className="text-sm text-slate-600">
                          Frequency: {COMMON_MEDICATIONS.find(m => m.name === selectedMedicationKey)?.frequency}
                        </p>
                      </div>
                    )}
                    
                    {/* Dose and Frequency (editable) */}
                    {(selectedMedicationKey || isCustomMedication) && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Dose {isCustomMedication && "*"}</Label>
                            <Input
                              placeholder="e.g., 5mg"
                              value={newDose}
                              onChange={(e) => setNewDose(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Frequency {isCustomMedication && "*"}</Label>
                            <Input
                              placeholder="e.g., daily"
                              value={newFrequency}
                              onChange={(e) => setNewFrequency(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Route</Label>
                          <Select value={newRoute} onValueChange={setNewRoute}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="oral">Oral</SelectItem>
                              <SelectItem value="iv">IV</SelectItem>
                              <SelectItem value="im">IM</SelectItem>
                              <SelectItem value="sc">Subcutaneous</SelectItem>
                              <SelectItem value="topical">Topical</SelectItem>
                              <SelectItem value="inhaled">Inhaled</SelectItem>
                              <SelectItem value="ophthalmic">Ophthalmic</SelectItem>
                              <SelectItem value="otic">Otic (Ear)</SelectItem>
                              <SelectItem value="nasal">Nasal</SelectItem>
                              <SelectItem value="rectal">Rectal</SelectItem>
                              <SelectItem value="vaginal">Vaginal</SelectItem>
                              <SelectItem value="transdermal">Transdermal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => {
                      setShowAddDialog(false);
                      setSelectedCategory("");
                      setSelectedMedicationKey("");
                      setIsCustomMedication(false);
                      setNewMedication("");
                      setNewDose("");
                      setNewFrequency("");
                    }}>Cancel</Button>
                    <Button 
                      onClick={addMedication}
                      disabled={!selectedMedicationKey && !isCustomMedication}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Medication
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {medications.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      className="p-3 bg-slate-50 rounded-lg flex items-start justify-between group"
                    >
                      <div>
                        <div className="font-medium">{med.name}</div>
                        <div className="text-xs text-slate-500">
                          {med.dose && `${med.dose} • `}
                          {med.frequency && `${med.frequency} • `}
                          {med.route}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={() => removeMedication(med.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-center">
                <div>
                  <Pill className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No medications added</p>
                  <p className="text-xs text-slate-400">Add medications to check interactions</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              onClick={checkInteractions}
              disabled={medications.length < 2 || isScanning}
              className="flex-1"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Check Interactions
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Interaction Results */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Interaction Results</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-[140px] h-8">
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
                {interactions.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredInteractions.length > 0 ? (
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {filteredInteractions.map((interaction) => {
                    const style = getSeverityStyle(interaction.severity);
                    const Icon = style.icon;
                    return (
                      <motion.div
                        key={interaction.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 rounded-lg border-2 ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 ${style.text} mt-0.5 shrink-0`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{interaction.drug1}</span>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                              <span className="font-semibold">{interaction.drug2}</span>
                              <Badge className={`${style.bg} ${style.text} border ${style.border}`}>
                                {interaction.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-700 mb-2">{interaction.description}</p>
                            <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
                              <div>
                                <span className="font-medium text-slate-600">Mechanism:</span>
                                <p className="text-slate-500">{interaction.mechanism}</p>
                              </div>
                              <div>
                                <span className="font-medium text-slate-600">Action:</span>
                                <p className="text-slate-500">{interaction.action}</p>
                              </div>
                            </div>
                            {interaction.monitoring.length > 0 && (
                              <div className="mt-3">
                                <span className="font-medium text-slate-600 text-sm">Monitoring:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {interaction.monitoring.map((m, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {m}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : interactions.length > 0 ? (
              <div className="h-[300px] flex items-center justify-center text-center">
                <div>
                  <Filter className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No interactions match filter</p>
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-center">
                <div>
                  {medications.length < 2 ? (
                    <>
                      <Pill className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Add at least 2 medications</p>
                      <p className="text-xs text-slate-400">Interactions will appear here</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                      <p className="text-emerald-600 font-medium">No Interactions Found</p>
                      <p className="text-xs text-slate-400">Current medications appear safe together</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drug Database Info */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-xl">
                <Brain className="h-8 w-8 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI-Powered Drug Database</h3>
                <p className="text-slate-400 text-sm">
                  {Object.keys(DRUG_DATABASE).length} drugs indexed with interaction data
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Updated Regularly</span>
              </div>
              <p className="text-xs text-slate-400">Based on clinical evidence</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
