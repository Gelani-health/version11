"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Plus,
  X,
  Shield,
  Activity,
  Loader2,
  User,
  ChevronRight,
  ChevronDown,
  Trash2,
  Heart,
  Brain,
  Droplets,
  Wind,
  Bone,
  Eye,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

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

interface PatientMedication {
  id: string;
  medicationName: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status?: string;
  startDate?: string;
  endDate?: string | null;
  interactionAlerts?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  clinicalEffects: string[];
  management: string;
  references: string[];
}

// Comprehensive Medication Database by Category/Indication
const medicationDatabase = {
  cardiovascular: {
    name: "Cardiovascular",
    icon: Heart,
    color: "text-red-500",
    bgColor: "bg-red-50",
    conditions: {
      "Hypertension": [
        { name: "Amlodipine", generic: "Amlodipine Besylate", dosage: "5-10mg", frequency: "Once daily", route: "Oral" },
        { name: "Lisinopril", generic: "Lisinopril", dosage: "10-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Enalapril", generic: "Enalapril Maleate", dosage: "5-40mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Losartan", generic: "Losartan Potassium", dosage: "50-100mg", frequency: "Once daily", route: "Oral" },
        { name: "Valsartan", generic: "Valsartan", dosage: "80-320mg", frequency: "Once daily", route: "Oral" },
        { name: "Metoprolol", generic: "Metoprolol Tartrate", dosage: "50-200mg", frequency: "Twice daily", route: "Oral" },
        { name: "Atenolol", generic: "Atenolol", dosage: "50-100mg", frequency: "Once daily", route: "Oral" },
        { name: "Hydrochlorothiazide", generic: "HCTZ", dosage: "12.5-50mg", frequency: "Once daily", route: "Oral" },
        { name: "Nifedipine", generic: "Nifedipine ER", dosage: "30-90mg", frequency: "Once daily", route: "Oral" },
        { name: "Carvedilol", generic: "Carvedilol", dosage: "6.25-25mg", frequency: "Twice daily", route: "Oral" },
        { name: "Furosemide", generic: "Furosemide", dosage: "20-80mg", frequency: "Once/Twice daily", route: "Oral/IV" },
      ],
      "Heart Failure": [
        { name: "Carvedilol", generic: "Carvedilol", dosage: "3.125-25mg", frequency: "Twice daily", route: "Oral" },
        { name: "Bisoprolol", generic: "Bisoprolol", dosage: "1.25-10mg", frequency: "Once daily", route: "Oral" },
        { name: "Spironolactone", generic: "Spironolactone", dosage: "25-50mg", frequency: "Once daily", route: "Oral" },
        { name: "Digoxin", generic: "Digoxin", dosage: "0.125-0.25mg", frequency: "Once daily", route: "Oral" },
        { name: "Sacubitril/Valsartan", generic: "Entresto", dosage: "24/26-97/103mg", frequency: "Twice daily", route: "Oral" },
      ],
      "Angina": [
        { name: "Nitroglycerin SL", generic: "Nitroglycerin", dosage: "0.3-0.6mg", frequency: "PRN", route: "Sublingual" },
        { name: "Isosorbide Mononitrate", generic: "ISMN", dosage: "20-60mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Amlodipine", generic: "Amlodipine Besylate", dosage: "5-10mg", frequency: "Once daily", route: "Oral" },
      ],
      "Anticoagulation": [
        { name: "Warfarin", generic: "Warfarin Sodium", dosage: "2-10mg", frequency: "Once daily", route: "Oral" },
        { name: "Aspirin", generic: "Acetylsalicylic Acid", dosage: "81-325mg", frequency: "Once daily", route: "Oral" },
        { name: "Clopidogrel", generic: "Clopidogrel Bisulfate", dosage: "75mg", frequency: "Once daily", route: "Oral" },
        { name: "Enoxaparin", generic: "Enoxaparin Sodium", dosage: "40-1.5mg/kg", frequency: "Once/Twice daily", route: "Subcutaneous" },
        { name: "Heparin", generic: "Unfractionated Heparin", dosage: "Per protocol", frequency: "Continuous", route: "IV" },
        { name: "Rivaroxaban", generic: "Rivaroxaban", dosage: "10-20mg", frequency: "Once daily", route: "Oral" },
        { name: "Apixaban", generic: "Apixaban", dosage: "2.5-5mg", frequency: "Twice daily", route: "Oral" },
        { name: "Dabigatran", generic: "Dabigatran Etexilate", dosage: "75-150mg", frequency: "Twice daily", route: "Oral" },
      ],
      "Dyslipidemia": [
        { name: "Atorvastatin", generic: "Atorvastatin Calcium", dosage: "10-80mg", frequency: "Once daily", route: "Oral" },
        { name: "Simvastatin", generic: "Simvastatin", dosage: "10-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Rosuvastatin", generic: "Rosuvastatin Calcium", dosage: "5-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Ezetimibe", generic: "Ezetimibe", dosage: "10mg", frequency: "Once daily", route: "Oral" },
        { name: "Gemfibrozil", generic: "Gemfibrozil", dosage: "600mg", frequency: "Twice daily", route: "Oral" },
        { name: "Fenofibrate", generic: "Fenofibrate", dosage: "48-145mg", frequency: "Once daily", route: "Oral" },
      ],
    },
  },
  endocrine: {
    name: "Endocrine/Diabetes",
    icon: Droplets,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    conditions: {
      "Diabetes Mellitus Type 2": [
        { name: "Metformin", generic: "Metformin Hydrochloride", dosage: "500-1000mg", frequency: "Twice daily", route: "Oral" },
        { name: "Glibenclamide", generic: "Glyburide", dosage: "2.5-10mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Glimepiride", generic: "Glimepiride", dosage: "1-4mg", frequency: "Once daily", route: "Oral" },
        { name: "Gliclazide", generic: "Gliclazide", dosage: "40-320mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Sitagliptin", generic: "Sitagliptin", dosage: "25-100mg", frequency: "Once daily", route: "Oral" },
        { name: "Linagliptin", generic: "Linagliptin", dosage: "5mg", frequency: "Once daily", route: "Oral" },
        { name: "Empagliflozin", generic: "Empagliflozin", dosage: "10-25mg", frequency: "Once daily", route: "Oral" },
        { name: "Dapagliflozin", generic: "Dapagliflozin", dosage: "5-10mg", frequency: "Once daily", route: "Oral" },
        { name: "Pioglitazone", generic: "Pioglitazone", dosage: "15-45mg", frequency: "Once daily", route: "Oral" },
      ],
      "Diabetes Mellitus Type 1": [
        { name: "Insulin Regular", generic: "Regular Insulin", dosage: "Per sliding scale", frequency: "TID with meals", route: "Subcutaneous" },
        { name: "Insulin NPH", generic: "NPH Insulin", dosage: "Per protocol", frequency: "Twice daily", route: "Subcutaneous" },
        { name: "Insulin Glargine", generic: "Lantus", dosage: "10-80 units", frequency: "Once daily", route: "Subcutaneous" },
        { name: "Insulin Detemir", generic: "Levemir", dosage: "10-80 units", frequency: "Once/Twice daily", route: "Subcutaneous" },
        { name: "Insulin Lispro", generic: "Humalog", dosage: "Per sliding scale", frequency: "Before meals", route: "Subcutaneous" },
        { name: "Insulin Aspart", generic: "NovoLog", dosage: "Per sliding scale", frequency: "Before meals", route: "Subcutaneous" },
      ],
      "Thyroid Disorders": [
        { name: "Levothyroxine", generic: "Levothyroxine Sodium", dosage: "25-200mcg", frequency: "Once daily", route: "Oral" },
        { name: "Carbimazole", generic: "Carbimazole", dosage: "5-40mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Methimazole", generic: "Methimazole", dosage: "5-40mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Propylthiouracil", generic: "PTU", dosage: "50-300mg", frequency: "Three times daily", route: "Oral" },
      ],
    },
  },
  respiratory: {
    name: "Respiratory",
    icon: Wind,
    color: "text-cyan-500",
    bgColor: "bg-cyan-50",
    conditions: {
      "Asthma": [
        { name: "Salbutamol Inhaler", generic: "Albuterol", dosage: "100-200mcg", frequency: "PRN", route: "Inhalation" },
        { name: "Budesonide Inhaler", generic: "Budesonide", dosage: "200-800mcg", frequency: "Twice daily", route: "Inhalation" },
        { name: "Fluticasone Inhaler", generic: "Fluticasone Propionate", dosage: "88-440mcg", frequency: "Twice daily", route: "Inhalation" },
        { name: "Salmeterol/Fluticasone", generic: "Seretide/Advair", dosage: "50/100-50/500mcg", frequency: "Twice daily", route: "Inhalation" },
        { name: "Formoterol/Budesonide", generic: "Symbicort", dosage: "4.5/160-9/320mcg", frequency: "Twice daily", route: "Inhalation" },
        { name: "Montelukast", generic: "Montelukast Sodium", dosage: "4-10mg", frequency: "Once daily", route: "Oral" },
        { name: "Theophylline", generic: "Theophylline", dosage: "200-600mg", frequency: "Twice daily", route: "Oral" },
        { name: "Prednisolone", generic: "Prednisolone", dosage: "5-60mg", frequency: "Once daily", route: "Oral" },
      ],
      "COPD": [
        { name: "Tiotropium", generic: "Tiotropium Bromide", dosage: "18mcg", frequency: "Once daily", route: "Inhalation" },
        { name: "Ipratropium", generic: "Ipratropium Bromide", dosage: "20-40mcg", frequency: "3-4 times daily", route: "Inhalation" },
        { name: "Indacaterol", generic: "Indacaterol", dosage: "75-150mcg", frequency: "Once daily", route: "Inhalation" },
        { name: "Roflumilast", generic: "Roflumilast", dosage: "500mcg", frequency: "Once daily", route: "Oral" },
      ],
    },
  },
  gastrointestinal: {
    name: "Gastrointestinal",
    icon: Activity,
    color: "text-green-500",
    bgColor: "bg-green-50",
    conditions: {
      "Peptic Ulcer Disease/GERD": [
        { name: "Omeprazole", generic: "Omeprazole", dosage: "20-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Esomeprazole", generic: "Esomeprazole", dosage: "20-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Pantoprazole", generic: "Pantoprazole", dosage: "20-40mg", frequency: "Once daily", route: "Oral/IV" },
        { name: "Lansoprazole", generic: "Lansoprazole", dosage: "15-30mg", frequency: "Once daily", route: "Oral" },
        { name: "Ranitidine", generic: "Ranitidine", dosage: "150-300mg", frequency: "Once/Twice daily", route: "Oral/IV" },
        { name: "Famotidine", generic: "Famotidine", dosage: "20-40mg", frequency: "Once/Twice daily", route: "Oral/IV" },
      ],
      "H. Pylori Infection": [
        { name: "Amoxicillin", generic: "Amoxicillin", dosage: "1000mg", frequency: "Twice daily", route: "Oral" },
        { name: "Clarithromycin", generic: "Clarithromycin", dosage: "500mg", frequency: "Twice daily", route: "Oral" },
        { name: "Metronidazole", generic: "Metronidazole", dosage: "500mg", frequency: "Twice/Three times daily", route: "Oral" },
        { name: "Tetracycline", generic: "Tetracycline", dosage: "500mg", frequency: "Four times daily", route: "Oral" },
        { name: "Bismuth Subsalicylate", generic: "Bismuth", dosage: "525mg", frequency: "Four times daily", route: "Oral" },
      ],
      "Inflammatory Bowel Disease": [
        { name: "Mesalamine", generic: "Mesalamine", dosage: "1.6-4.8g", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Sulfasalazine", generic: "Sulfasalazine", dosage: "1-4g", frequency: "Divided doses", route: "Oral" },
        { name: "Azathioprine", generic: "Azathioprine", dosage: "1.5-2.5mg/kg", frequency: "Once daily", route: "Oral" },
        { name: "Infliximab", generic: "Infliximab", dosage: "5mg/kg", frequency: "Per schedule", route: "IV" },
      ],
    },
  },
  infection: {
    name: "Anti-Infectives",
    icon: Shield,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    conditions: {
      "Bacterial Infections": [
        { name: "Amoxicillin", generic: "Amoxicillin", dosage: "250-500mg", frequency: "Three times daily", route: "Oral" },
        { name: "Amoxicillin/Clavulanate", generic: "Augmentin", dosage: "375-625mg", frequency: "Three times daily", route: "Oral" },
        { name: "Cephalexin", generic: "Cephalexin", dosage: "250-500mg", frequency: "Four times daily", route: "Oral" },
        { name: "Ceftriaxone", generic: "Ceftriaxone", dosage: "1-2g", frequency: "Once/Twice daily", route: "IV/IM" },
        { name: "Cefixime", generic: "Cefixime", dosage: "200-400mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Azithromycin", generic: "Azithromycin", dosage: "250-500mg", frequency: "Once daily", route: "Oral" },
        { name: "Clarithromycin", generic: "Clarithromycin", dosage: "250-500mg", frequency: "Twice daily", route: "Oral" },
        { name: "Doxycycline", generic: "Doxycycline", dosage: "100mg", frequency: "Twice daily", route: "Oral" },
        { name: "Ciprofloxacin", generic: "Ciprofloxacin", dosage: "250-750mg", frequency: "Twice daily", route: "Oral/IV" },
        { name: "Metronidazole", generic: "Metronidazole", dosage: "250-500mg", frequency: "Three times daily", route: "Oral" },
      ],
      "Tuberculosis": [
        { name: "Isoniazid", generic: "Isoniazid", dosage: "300mg", frequency: "Once daily", route: "Oral" },
        { name: "Rifampicin", generic: "Rifampin", dosage: "600mg", frequency: "Once daily", route: "Oral" },
        { name: "Pyrazinamide", generic: "Pyrazinamide", dosage: "1.5-2g", frequency: "Once daily", route: "Oral" },
        { name: "Ethambutol", generic: "Ethambutol", dosage: "15-25mg/kg", frequency: "Once daily", route: "Oral" },
      ],
      "HIV/AIDS": [
        { name: "Tenofovir/Emtricitabine", generic: "Truvada", dosage: "200/300mg", frequency: "Once daily", route: "Oral" },
        { name: "Dolutegravir", generic: "Dolutegravir", dosage: "50mg", frequency: "Once daily", route: "Oral" },
        { name: "Efavirenz", generic: "Efavirenz", dosage: "600mg", frequency: "Once daily", route: "Oral" },
        { name: "Lamivudine", generic: "Lamivudine", dosage: "150-300mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Zidovudine", generic: "AZT", dosage: "300mg", frequency: "Twice daily", route: "Oral" },
      ],
      "Malaria": [
        { name: "Artemether/Lumefantrine", generic: "Coartem", dosage: "Per weight", frequency: "6-dose regimen", route: "Oral" },
        { name: "Chloroquine", generic: "Chloroquine Phosphate", dosage: "250-500mg", frequency: "Per schedule", route: "Oral" },
        { name: "Quinine", generic: "Quinine Sulfate", dosage: "600mg", frequency: "Three times daily", route: "Oral" },
      ],
    },
  },
  neurology: {
    name: "Neurology/Psychiatry",
    icon: Brain,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50",
    conditions: {
      "Epilepsy": [
        { name: "Phenytoin", generic: "Phenytoin Sodium", dosage: "100-200mg", frequency: "Three times daily", route: "Oral/IV" },
        { name: "Carbamazepine", generic: "Carbamazepine", dosage: "200-400mg", frequency: "Twice daily", route: "Oral" },
        { name: "Valproic Acid", generic: "Valproate", dosage: "250-500mg", frequency: "Twice daily", route: "Oral" },
        { name: "Phenobarbital", generic: "Phenobarbital", dosage: "30-120mg", frequency: "Once/Twice daily", route: "Oral/IV" },
        { name: "Levetiracetam", generic: "Keppra", dosage: "500-1500mg", frequency: "Twice daily", route: "Oral/IV" },
        { name: "Lamotrigine", generic: "Lamotrigine", dosage: "25-200mg", frequency: "Once/Twice daily", route: "Oral" },
      ],
      "Depression/Anxiety": [
        { name: "Amitriptyline", generic: "Amitriptyline", dosage: "25-150mg", frequency: "Once daily", route: "Oral" },
        { name: "Fluoxetine", generic: "Prozac", dosage: "20-60mg", frequency: "Once daily", route: "Oral" },
        { name: "Sertraline", generic: "Zoloft", dosage: "50-200mg", frequency: "Once daily", route: "Oral" },
        { name: "Citalopram", generic: "Celexa", dosage: "20-40mg", frequency: "Once daily", route: "Oral" },
        { name: "Paroxetine", generic: "Paxil", dosage: "20-50mg", frequency: "Once daily", route: "Oral" },
        { name: "Diazepam", generic: "Valium", dosage: "2-10mg", frequency: "Two to four times", route: "Oral/IV" },
        { name: "Lorazepam", generic: "Ativan", dosage: "0.5-2mg", frequency: "Two to three times", route: "Oral/IV" },
      ],
      "Psychosis": [
        { name: "Haloperidol", generic: "Haldol", dosage: "2-10mg", frequency: "Two to three times", route: "Oral/IM/IV" },
        { name: "Chlorpromazine", generic: "Thorazine", dosage: "25-200mg", frequency: "Three times daily", route: "Oral" },
        { name: "Risperidone", generic: "Risperdal", dosage: "1-6mg", frequency: "Once/Twice daily", route: "Oral" },
        { name: "Olanzapine", generic: "Zyprexa", dosage: "5-20mg", frequency: "Once daily", route: "Oral" },
        { name: "Quetiapine", generic: "Seroquel", dosage: "150-750mg", frequency: "Twice daily", route: "Oral" },
      ],
      "Parkinson's Disease": [
        { name: "Levodopa/Carbidopa", generic: "Sinemet", dosage: "100/25-250/25mg", frequency: "Three times daily", route: "Oral" },
        { name: "Pramipexole", generic: "Mirapex", dosage: "0.125-1.5mg", frequency: "Three times daily", route: "Oral" },
        { name: "Selegiline", generic: "Selegiline", dosage: "5-10mg", frequency: "Once/Twice daily", route: "Oral" },
      ],
      "Migraine": [
        { name: "Sumatriptan", generic: "Imitrex", dosage: "50-100mg", frequency: "PRN", route: "Oral/SC" },
        { name: "Propranolol", generic: "Propranolol", dosage: "40-80mg", frequency: "Twice daily", route: "Oral" },
        { name: "Topiramate", generic: "Topamax", dosage: "25-100mg", frequency: "Twice daily", route: "Oral" },
      ],
    },
  },
  pain: {
    name: "Pain Management",
    icon: Activity,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    conditions: {
      "Mild Pain": [
        { name: "Paracetamol", generic: "Acetaminophen", dosage: "500-1000mg", frequency: "Four times daily", route: "Oral" },
        { name: "Ibuprofen", generic: "Ibuprofen", dosage: "200-400mg", frequency: "Three times daily", route: "Oral" },
        { name: "Diclofenac", generic: "Diclofenac Sodium", dosage: "50mg", frequency: "Two to three times", route: "Oral" },
        { name: "Naproxen", generic: "Naproxen", dosage: "250-500mg", frequency: "Twice daily", route: "Oral" },
      ],
      "Moderate Pain": [
        { name: "Tramadol", generic: "Tramadol", dosage: "50-100mg", frequency: "Four times daily", route: "Oral" },
        { name: "Codeine", generic: "Codeine Phosphate", dosage: "15-60mg", frequency: "Four times daily", route: "Oral" },
        { name: "Codeine/Paracetamol", generic: "Co-codamol", dosage: "8/500-30/500mg", frequency: "Four times daily", route: "Oral" },
      ],
      "Severe Pain": [
        { name: "Morphine", generic: "Morphine Sulfate", dosage: "10-30mg", frequency: "Four hourly", route: "Oral/IV/IM" },
        { name: "Pethidine", generic: "Meperidine", dosage: "50-100mg", frequency: "Four hourly", route: "IM/IV" },
        { name: "Fentanyl", generic: "Fentanyl", dosage: "25-100mcg/hr", frequency: "72 hourly", route: "Transdermal" },
      ],
    },
  },
  musculoskeletal: {
    name: "Musculoskeletal",
    icon: Bone,
    color: "text-teal-500",
    bgColor: "bg-teal-50",
    conditions: {
      "Arthritis": [
        { name: "Methotrexate", generic: "Methotrexate", dosage: "7.5-25mg", frequency: "Once weekly", route: "Oral" },
        { name: "Sulfasalazine", generic: "Sulfasalazine", dosage: "1-3g", frequency: "Divided doses", route: "Oral" },
        { name: "Hydroxychloroquine", generic: "Hydroxychloroquine", dosage: "200-400mg", frequency: "Once daily", route: "Oral" },
        { name: "Leflunomide", generic: "Leflunomide", dosage: "10-20mg", frequency: "Once daily", route: "Oral" },
        { name: "Celecoxib", generic: "Celebrex", dosage: "100-200mg", frequency: "Once/Twice daily", route: "Oral" },
      ],
      "Gout": [
        { name: "Allopurinol", generic: "Allopurinol", dosage: "100-300mg", frequency: "Once daily", route: "Oral" },
        { name: "Colchicine", generic: "Colchicine", dosage: "0.5-0.6mg", frequency: "One to two times", route: "Oral" },
        { name: "Probenecid", generic: "Probenecid", dosage: "250-500mg", frequency: "Twice daily", route: "Oral" },
      ],
    },
  },
  ophthalmology: {
    name: "Ophthalmology",
    icon: Eye,
    color: "text-sky-500",
    bgColor: "bg-sky-50",
    conditions: {
      "Eye Infections": [
        { name: "Chloramphenicol Eye Drops", generic: "Chloramphenicol", dosage: "0.5%", frequency: "Every 2 hours", route: "Ophthalmic" },
        { name: "Ciprofloxacin Eye Drops", generic: "Ciprofloxacin", dosage: "0.3%", frequency: "Four times daily", route: "Ophthalmic" },
        { name: "Gentamicin Eye Drops", generic: "Gentamicin", dosage: "0.3%", frequency: "Four times daily", route: "Ophthalmic" },
        { name: "Tetracycline Eye Ointment", generic: "Tetracycline", dosage: "1%", frequency: "Two to four times", route: "Ophthalmic" },
      ],
      "Glaucoma": [
        { name: "Timolol Eye Drops", generic: "Timolol", dosage: "0.25-0.5%", frequency: "Twice daily", route: "Ophthalmic" },
        { name: "Latanoprost Eye Drops", generic: "Latanoprost", dosage: "0.005%", frequency: "Once daily", route: "Ophthalmic" },
        { name: "Acetazolamide", generic: "Acetazolamide", dosage: "250-500mg", frequency: "Two to four times", route: "Oral" },
      ],
    },
  },
  other: {
    name: "Other Medications",
    icon: Pill,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    conditions: {
      "Anemia": [
        { name: "Ferrous Sulfate", generic: "Iron", dosage: "200-325mg", frequency: "Three times daily", route: "Oral" },
        { name: "Folic Acid", generic: "Folate", dosage: "1-5mg", frequency: "Once daily", route: "Oral" },
        { name: "Vitamin B12", generic: "Cyanocobalamin", dosage: "1000mcg", frequency: "Once daily/monthly", route: "Oral/IM" },
      ],
      "Allergies": [
        { name: "Cetirizine", generic: "Zyrtec", dosage: "10mg", frequency: "Once daily", route: "Oral" },
        { name: "Loratadine", generic: "Claritin", dosage: "10mg", frequency: "Once daily", route: "Oral" },
        { name: "Chlorpheniramine", generic: "Chlorpheniramine", dosage: "4mg", frequency: "Three times daily", route: "Oral" },
        { name: "Diphenhydramine", generic: "Benadryl", dosage: "25-50mg", frequency: "Four times daily", route: "Oral/IV" },
      ],
      "Nausea/Vomiting": [
        { name: "Ondansetron", generic: "Zofran", dosage: "4-8mg", frequency: "Three times daily", route: "Oral/IV" },
        { name: "Metoclopramide", generic: "Reglan", dosage: "10mg", frequency: "Three times daily", route: "Oral/IV" },
        { name: "Prochlorperazine", generic: "Compazine", dosage: "5-10mg", frequency: "Three to four times", route: "Oral" },
      ],
    },
  },
};

// Drug interaction database
const drugInteractionDB: DrugInteraction[] = [
  {
    drug1: "Warfarin",
    drug2: "Aspirin",
    severity: "major",
    description: "Increased risk of bleeding due to additive effects on hemostasis.",
    clinicalEffects: ["Increased INR", "Bleeding risk", "Bruising"],
    management: "Monitor INR more frequently. Consider alternative analgesic. Avoid combination if possible.",
    references: ["FDA Drug Safety Communication"],
  },
  {
    drug1: "Warfarin",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs enhance anticoagulant effect of warfarin, increasing bleeding risk.",
    clinicalEffects: ["GI bleeding", "Increased INR", "Hematuria"],
    management: "Avoid concurrent use. If necessary, use lowest effective dose for shortest duration.",
    references: ["Lexicomp Drug Interactions"],
  },
  {
    drug1: "Warfarin",
    drug2: "Metformin",
    severity: "minor",
    description: "Metformin may enhance the anticoagulant effect of warfarin.",
    clinicalEffects: ["Potential increased INR"],
    management: "Monitor INR when starting or stopping metformin.",
    references: ["Drug Interaction Facts"],
  },
  {
    drug1: "Lisinopril",
    drug2: "Ibuprofen",
    severity: "moderate",
    description: "NSAIDs may reduce the antihypertensive effect of ACE inhibitors.",
    clinicalEffects: ["Reduced BP control", "Potential renal impairment"],
    management: "Monitor blood pressure. Consider alternative pain management.",
    references: ["AHFS Drug Information"],
  },
  {
    drug1: "Metformin",
    drug2: "Omeprazole",
    severity: "minor",
    description: "Proton pump inhibitors may reduce metformin efficacy.",
    clinicalEffects: ["Reduced glycemic control"],
    management: "Monitor blood glucose. Adjust metformin dose if needed.",
    references: ["Drug Interaction Facts"],
  },
  {
    drug1: "Atorvastatin",
    drug2: "Warfarin",
    severity: "moderate",
    description: "Statins may enhance the anticoagulant effect of warfarin.",
    clinicalEffects: ["Increased INR", "Bleeding risk"],
    management: "Monitor INR closely when starting or adjusting statin therapy.",
    references: ["Clinical Pharmacology"],
  },
  {
    drug1: "Metformin",
    drug2: "Lisinopril",
    severity: "minor",
    description: "ACE inhibitors may enhance the hypoglycemic effect of antidiabetic agents.",
    clinicalEffects: ["Risk of hypoglycemia"],
    management: "Monitor blood glucose. May need to adjust antidiabetic dose.",
    references: ["Lexicomp"],
  },
  {
    drug1: "Aspirin",
    drug2: "Ibuprofen",
    severity: "moderate",
    description: "Ibuprofen may diminish the cardioprotective effect of aspirin.",
    clinicalEffects: ["Reduced cardiovascular protection"],
    management: "Take ibuprofen at least 8 hours after aspirin or 30 minutes before.",
    references: ["FDA Drug Safety"],
  },
  {
    drug1: "Azithromycin",
    drug2: "Warfarin",
    severity: "moderate",
    description: "Macrolide antibiotics may enhance anticoagulant effect.",
    clinicalEffects: ["Increased INR", "Bleeding"],
    management: "Monitor INR closely during antibiotic course.",
    references: ["Drug Interaction Facts"],
  },
  {
    drug1: "Ciprofloxacin",
    drug2: "Warfarin",
    severity: "moderate",
    description: "Fluoroquinolones may enhance anticoagulant effect.",
    clinicalEffects: ["Increased INR", "Bleeding risk"],
    management: "Monitor INR. May need to reduce warfarin dose.",
    references: ["Lexicomp"],
  },
  {
    drug1: "Fluoxetine",
    drug2: "Warfarin",
    severity: "moderate",
    description: "SSRIs may enhance anticoagulant effect and increase bleeding risk.",
    clinicalEffects: ["Increased bleeding", "Elevated INR"],
    management: "Monitor INR and for signs of bleeding.",
    references: ["Clinical Pharmacology"],
  },
  {
    drug1: "Methotrexate",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs may increase methotrexate toxicity.",
    clinicalEffects: ["Bone marrow suppression", "Hepatotoxicity", "Renal failure"],
    management: "Avoid combination. If necessary, use with extreme caution and close monitoring.",
    references: ["FDA Prescribing Information"],
  },
  {
    drug1: "Carbamazepine",
    drug2: "Warfarin",
    severity: "moderate",
    description: "Carbamazepine may decrease warfarin effect.",
    clinicalEffects: ["Decreased INR", "Reduced anticoagulation"],
    management: "Monitor INR. May need to increase warfarin dose.",
    references: ["Drug Interaction Facts"],
  },
];

export function DrugInteractionChecker() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [searchMed, setSearchMed] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());
  const [customMedName, setCustomMedName] = useState("");
  const [customDosage, setCustomDosage] = useState("");
  const [customFrequency, setCustomFrequency] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const { toast } = useToast();

  // Fetch all patients
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch patient medications when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientMedications(selectedPatientId);
    } else {
      setPatientMedications([]);
      setInteractions([]);
    }
  }, [selectedPatientId]);

  const fetchPatients = async () => {
    try {
      const response = await fetch("/api/patients?limit=100");
      const data = await response.json();
      if (data.success) {
        setPatients(data.data.patients);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    }
  };

  const fetchPatientMedications = async (patientId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/patients/${patientId}/medications`);
      const data = await response.json();
      if (data.success) {
        setPatientMedications(data.data.medications);
        // Check for interactions
        checkInteractions(data.data.medications);
      }
    } catch (error) {
      console.error("Failed to fetch medications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkInteractions = (medications: PatientMedication[]) => {
    const medNames = medications.map((m) => m.medicationName.toLowerCase());
    const foundInteractions: DrugInteraction[] = [];

    for (const interaction of drugInteractionDB) {
      const drug1Match = medNames.some((m) => interaction.drug1.toLowerCase().includes(m) || m.includes(interaction.drug1.toLowerCase()));
      const drug2Match = medNames.some((m) => interaction.drug2.toLowerCase().includes(m) || m.includes(interaction.drug2.toLowerCase()));

      if (drug1Match && drug2Match) {
        foundInteractions.push(interaction);
      }
    }

    setInteractions(foundInteractions);
  };

  const addMedication = async (medName: string, dosage: string, frequency: string = "As prescribed") => {
    if (!selectedPatientId) return;

    // Check for existing medication
    const existing = patientMedications.find(
      (m) => m.medicationName.toLowerCase() === medName.toLowerCase()
    );
    
    if (existing) {
      toast({
        title: "Already Added",
        description: `${medName} is already in the medication list`,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/patients/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          medicationName: medName,
          dosage: dosage,
          frequency: frequency,
          status: "active",
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Medication Added",
          description: `${medName} added to patient's medication list`,
        });
        fetchPatientMedications(selectedPatientId);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add medication",
        variant: "destructive",
      });
    }
  };

  const addCustomMedication = async () => {
    if (!customMedName.trim()) {
      toast({
        title: "Required",
        description: "Please enter medication name",
        variant: "destructive",
      });
      return;
    }

    await addMedication(customMedName, customDosage || "As prescribed", customFrequency || "As needed");
    setCustomMedName("");
    setCustomDosage("");
    setCustomFrequency("");
    setShowCustomInput(false);
  };

  const removeMedication = async (medicationId: string) => {
    try {
      const response = await fetch(`/api/patients/medications/${medicationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Medication Removed",
          description: "Medication has been discontinued",
        });
        if (selectedPatientId) {
          fetchPatientMedications(selectedPatientId);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove medication",
        variant: "destructive",
      });
    }
  };

  const getSelectedPatient = () => {
    return patients.find((p) => p.id === selectedPatientId);
  };

  const parseJsonArray = (jsonStr?: string): string[] => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "major":
        return {
          badge: "bg-red-100 text-red-700 border-red-200",
          bg: "bg-red-50 border-red-200",
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        };
      case "moderate":
        return {
          badge: "bg-amber-100 text-amber-700 border-amber-200",
          bg: "bg-amber-50 border-amber-200",
          icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
        };
      default:
        return {
          badge: "bg-blue-100 text-blue-700 border-blue-200",
          bg: "bg-blue-50 border-blue-200",
          icon: <Info className="h-5 w-5 text-blue-500" />,
        };
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleCondition = (conditionKey: string) => {
    const newExpanded = new Set(expandedConditions);
    if (newExpanded.has(conditionKey)) {
      newExpanded.delete(conditionKey);
    } else {
      newExpanded.add(conditionKey);
    }
    setExpandedConditions(newExpanded);
  };

  const getPatientConditions = (): string[] => {
    const patient = getSelectedPatient();
    if (!patient?.chronicConditions) return [];
    return parseJsonArray(patient.chronicConditions);
  };

  // Get suggested medications based on patient conditions
  const getSuggestedMedications = () => {
    const conditions = getPatientConditions();
    const suggestions: { name: string; condition: string }[] = [];

    conditions.forEach((condition) => {
      // Find matching conditions in database
      Object.entries(medicationDatabase).forEach(([catKey, category]) => {
        Object.entries(category.conditions).forEach(([condName, meds]) => {
          if (condName.toLowerCase().includes(condition.toLowerCase()) ||
              condition.toLowerCase().includes(condName.toLowerCase())) {
            meds.slice(0, 3).forEach((med) => {
              if (!suggestions.find((s) => s.name === med.name)) {
                suggestions.push({ name: med.name, condition: condName });
              }
            });
          }
        });
      });
    });

    return suggestions;
  };

  const selectedPatient = getSelectedPatient();
  const patientAllergies = selectedPatient ? parseJsonArray(selectedPatient.allergies) : [];
  const patientConditions = getPatientConditions();
  const suggestedMeds = getSuggestedMedications();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Pill className="h-6 w-6 text-rose-500" />
            Drug Safety
          </h2>
          <p className="text-slate-500">Patient-specific medication tracking and interaction checking</p>
        </div>
        <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-700 w-fit">
          <Shield className="h-3 w-3 mr-1" />
          Real-time Analysis
        </Badge>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Select Patient</CardTitle>
          <CardDescription>Choose a patient to view and manage their medications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select a patient..." />
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
                  <AvatarFallback className="bg-rose-100 text-rose-700">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-sm text-slate-500">{selectedPatient.mrn}</p>
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

          {/* Patient Conditions & Allergies */}
          {selectedPatient && (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {patientConditions.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-2">Conditions:</p>
                  <div className="flex flex-wrap gap-2">
                    {patientConditions.map((condition, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-blue-300 text-blue-700">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {patientAllergies.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
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
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPatientId ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Patient Medications */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Current Medications</CardTitle>
                  <CardDescription>{patientMedications.length} active medications</CardDescription>
                </div>
                <Button
                  onClick={() => setIsAddingMed(!isAddingMed)}
                  size="sm"
                  className="bg-gradient-to-r from-rose-500 to-pink-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Medication
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add Medication Panel */}
              {isAddingMed && (
                <div className="mb-4 space-y-4">
                  {/* Suggested Medications based on conditions */}
                  {suggestedMeds.length > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm font-medium text-emerald-800 mb-2">
                        💡 Suggested based on patient conditions:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedMeds.map((med, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => addMedication(med.name, "")}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {med.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search all medications..."
                      value={searchMed}
                      onChange={(e) => setSearchMed(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Custom Medication Input */}
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <Label className="text-sm font-medium">Or enter a custom medication:</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Input
                        placeholder="Medication name"
                        value={customMedName}
                        onChange={(e) => setCustomMedName(e.target.value)}
                        className="col-span-3 sm:col-span-1"
                      />
                      <Input
                        placeholder="Dosage"
                        value={customDosage}
                        onChange={(e) => setCustomDosage(e.target.value)}
                        className="col-span-3 sm:col-span-1"
                      />
                      <Input
                        placeholder="Frequency"
                        value={customFrequency}
                        onChange={(e) => setCustomFrequency(e.target.value)}
                        className="col-span-3 sm:col-span-1"
                      />
                    </div>
                    <Button
                      onClick={addCustomMedication}
                      size="sm"
                      className="mt-2 bg-gradient-to-r from-rose-500 to-pink-500"
                      disabled={!customMedName.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Custom Medication
                    </Button>
                  </div>

                  {/* Medication Categories */}
                  <ScrollArea className="h-[400px] border rounded-lg">
                    <div className="p-2 space-y-2">
                      {Object.entries(medicationDatabase).map(([catKey, category]) => {
                        const Icon = category.icon;
                        const isExpanded = expandedCategories.has(catKey);
                        
                        // Filter by search
                        const matchingConditions = Object.entries(category.conditions).filter(
                          ([condName, meds]) => {
                            if (!searchMed) return true;
                            const condMatch = condName.toLowerCase().includes(searchMed.toLowerCase());
                            const medMatch = meds.some((m) =>
                              m.name.toLowerCase().includes(searchMed.toLowerCase()) ||
                              m.generic.toLowerCase().includes(searchMed.toLowerCase())
                            );
                            return condMatch || medMatch;
                          }
                        );

                        if (matchingConditions.length === 0) return null;

                        return (
                          <Collapsible
                            key={catKey}
                            open={isExpanded}
                            onOpenChange={() => toggleCategory(catKey)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 rounded-lg cursor-pointer border">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${category.bgColor}`}>
                                    <Icon className={`h-4 w-4 ${category.color}`} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{category.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {Object.keys(category.conditions).length} conditions
                                    </p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-4 pr-2 py-2 space-y-2">
                                {matchingConditions.map(([condName, meds]) => {
                                  const conditionKey = `${catKey}-${condName}`;
                                  const isCondExpanded = expandedConditions.has(conditionKey);

                                  return (
                                    <Collapsible
                                      key={conditionKey}
                                      open={isCondExpanded || !!searchMed}
                                      onOpenChange={() => toggleCondition(conditionKey)}
                                    >
                                      <CollapsibleTrigger asChild>
                                        <div className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded cursor-pointer">
                                          <p className="text-sm font-medium text-slate-700">{condName}</p>
                                          <Badge variant="outline" className="text-xs">
                                            {meds.length} meds
                                          </Badge>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="grid grid-cols-1 gap-1 py-2">
                                          {meds
                                            .filter((med) =>
                                              !searchMed ||
                                              med.name.toLowerCase().includes(searchMed.toLowerCase()) ||
                                              med.generic.toLowerCase().includes(searchMed.toLowerCase())
                                            )
                                            .map((med) => {
                                              const isAdded = patientMedications.some(
                                                (m) => m.medicationName.toLowerCase() === med.name.toLowerCase()
                                              );

                                              return (
                                                <div
                                                  key={med.name}
                                                  className={`flex items-center justify-between p-2 rounded ${
                                                    isAdded
                                                      ? "bg-emerald-50 border border-emerald-200"
                                                      : "bg-white hover:bg-slate-50 border"
                                                  }`}
                                                >
                                                  <div className="flex-1">
                                                    <p className="font-medium text-sm">{med.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                      {med.generic} • {med.dosage}
                                                    </p>
                                                  </div>
                                                  {isAdded ? (
                                                    <Badge variant="outline" className="text-xs bg-emerald-100 border-emerald-300 text-emerald-700">
                                                      <CheckCircle className="h-3 w-3 mr-1" />
                                                      Added
                                                    </Badge>
                                                  ) : (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                      onClick={() => addMedication(med.name, med.dosage, med.frequency)}
                                                    >
                                                      <Plus className="h-3 w-3 mr-1" />
                                                      Add
                                                    </Button>
                                                  )}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Current Medications List */}
              {isLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                </div>
              ) : patientMedications.length === 0 ? (
                <div className="text-center py-8">
                  <Pill className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No medications recorded</p>
                  <p className="text-sm text-slate-400">Click "Add Medication" to get started</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {patientMedications.map((med) => (
                      <motion.div
                        key={med.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-rose-100 rounded-lg">
                            <Pill className="h-4 w-4 text-rose-600" />
                          </div>
                          <div>
                            <p className="font-medium">{med.medicationName}</p>
                            <p className="text-sm text-slate-500">
                              {med.dosage} • {med.frequency}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {med.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => removeMedication(med.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Interaction Results */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Drug Interactions</CardTitle>
              <CardDescription>
                {interactions.length > 0
                  ? `${interactions.length} interaction(s) detected`
                  : "No interactions detected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-400 mb-3" />
                  <h3 className="font-medium text-emerald-600">No Interactions Found</h3>
                  <p className="text-sm text-slate-400">Current medications appear safe together</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {interactions.map((interaction, i) => {
                      const styles = getSeverityStyles(interaction.severity);
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-lg border ${styles.bg}`}
                        >
                          <div className="flex items-start gap-3">
                            {styles.icon}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">
                                  {interaction.drug1} + {interaction.drug2}
                                </h4>
                                <Badge className={styles.badge}>
                                  {interaction.severity.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-sm mb-3">{interaction.description}</p>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-slate-600 mb-1">Clinical Effects:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {interaction.clinicalEffects.map((effect, j) => (
                                      <Badge key={j} variant="outline" className="text-xs">
                                        {effect}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-600 mb-1">Management:</p>
                                  <p className="text-sm">{interaction.management}</p>
                                </div>
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
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
            <User className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="font-medium text-slate-600">Select a Patient</h3>
            <p className="text-sm text-slate-400">Choose a patient above to view and manage their medications</p>
          </CardContent>
        </Card>
      )}

      {/* Severity Legend */}
      <Card className="border-0 shadow-md bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">Interaction Severity Levels</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700 text-sm">Major</p>
                <p className="text-xs text-slate-500">Avoid combination. High risk.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700 text-sm">Moderate</p>
                <p className="text-xs text-slate-500">Monitor closely. Adjust therapy.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
              <Info className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-blue-700 text-sm">Minor</p>
                <p className="text-xs text-slate-500">Low risk. Monitor if needed.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DrugInteractionChecker;
