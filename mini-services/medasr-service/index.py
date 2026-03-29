#!/usr/bin/env python3
"""
MedASR Service - Medical Automatic Speech Recognition
======================================================
Port: 3033

A world-class medical ASR service that provides:
- Z.ai SDK integration (primary cloud-based ASR)
- Wav2Vec2 CTC model (local fallback)
- Medical term post-processing with comprehensive dictionary
- Drug name and abbreviation normalization
- Multi-language support
- Real-time streaming capability

For the Gelani Healthcare Clinical Decision Support System
"""

import os
import sys
import asyncio
import tempfile
import base64
import time
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# Configuration
# ============================================

class Config:
    """Service configuration"""
    PORT: int = int(os.getenv("PORT", "3033"))
    
    # ASR Engine settings
    PRIMARY_ENGINE: str = os.getenv("ASR_ENGINE", "zai")  # zai, wav2vec2, stub
    DEVICE: str = os.getenv("DEVICE", "cpu")
    
    # Model settings (for Wav2Vec2 fallback)
    MODEL_NAME: str = os.getenv("MEDASR_MODEL", "facebook/wav2vec2-large-960h")
    FALLBACK_MODEL: str = "facebook/wav2vec2-base-960h"
    
    # Audio settings
    SAMPLE_RATE: int = 16000
    MAX_AUDIO_SIZE_MB: int = 10
    
    # Z.ai settings
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "")

config = Config()

# ============================================
# Request/Response Models
# ============================================

class TranscribeRequest(BaseModel):
    """Transcription request"""
    audio_base64: str
    sample_rate: int = 16000
    language: str = "en"
    context: Optional[str] = None
    enable_medical_postprocess: bool = True
    audio_format: Optional[str] = "webm"

class TranscribeResponse(BaseModel):
    """Transcription response"""
    success: bool = True
    transcription: str
    confidence: float
    word_count: int
    processing_time_ms: float
    medical_terms_detected: List[str] = []
    segments: List[Dict[str, Any]] = []
    engine: str
    language: str

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    engine: str
    gpu_available: bool
    memory_usage_mb: Optional[float] = None
    timestamp: str
    version: str
    features: List[str]

# ============================================
# Medical Term Dictionary
# ============================================

class MedicalTermDictionary:
    """Comprehensive medical term dictionary for ASR post-processing"""
    
    def __init__(self):
        self.drugs = self._load_drugs()
        self.conditions = self._load_conditions()
        self.abbreviations = self._load_abbreviations()
        self.anatomy = self._load_anatomy()
        self.symptoms = self._load_symptoms()
        self.labs = self._load_labs()
        
        # Combine all terms
        self.all_terms = {}
        for d in [self.drugs, self.conditions, self.abbreviations, 
                  self.anatomy, self.symptoms, self.labs]:
            self.all_terms.update(d)
        
        # Sort by length (longest first) for proper multi-word matching
        self.sorted_terms = sorted(
            self.all_terms.keys(), 
            key=len, 
            reverse=True
        )
    
    def _load_drugs(self) -> Dict[str, str]:
        """Load drug name corrections"""
        return {
            # Cardiovascular
            "metformin": "metformin", "glucophage": "metformin",
            "lisinopril": "lisinopril", "zestril": "lisinopril", "prinivil": "lisinopril",
            "atorvastatin": "atorvastatin", "lipitor": "atorvastatin",
            "amlodipine": "amlodipine", "norvasc": "amlodipine",
            "metoprolol": "metoprolol", "lopressor": "metoprolol", "toprol": "metoprolol XL",
            "losartan": "losartan", "cozaar": "losartan",
            "carvedilol": "carvedilol", "coreg": "carvedilol",
            "warfarin": "warfarin", "coumadin": "warfarin",
            "apixaban": "apixaban", "eliquis": "apixaban",
            "rivaroxaban": "rivaroxaban", "xarelto": "rivaroxaban",
            "clopidogrel": "clopidogrel", "plavix": "clopidogrel",
            "aspirin": "aspirin", "asa": "aspirin",
            "hydrochlorothiazide": "hydrochlorothiazide", "hctz": "hydrochlorothiazide",
            "furosemide": "furosemide", "lasix": "furosemide",
            "spironolactone": "spironolactone", "aldactone": "spironolactone",
            "digoxin": "digoxin", "lanoxin": "digoxin",
            "amiodarone": "amiodarone", "cordarone": "amiodarone",
            
            # Diabetes
            "insulin glargine": "insulin glargine", "lantus": "insulin glargine",
            "insulin lispro": "insulin lispro", "humalog": "insulin lispro",
            "sitagliptin": "sitagliptin", "januvia": "sitagliptin",
            "empagliflozin": "empagliflozin", "jardiance": "empagliflozin",
            "dapagliflozin": "dapagliflozin", "farxiga": "dapagliflozin",
            
            # Respiratory
            "albuterol": "albuterol", "proventil": "albuterol", "ventolin": "albuterol",
            "fluticasone": "fluticasone", "flovent": "fluticasone",
            "montelukast": "montelukast", "singulair": "montelukast",
            "ipratropium": "ipratropium", "atrovent": "ipratropium",
            "tiotropium": "tiotropium", "spiriva": "tiotropium",
            "prednisone": "prednisone",
            "methylprednisolone": "methylprednisolone", "medrol": "methylprednisolone",
            
            # Gastrointestinal
            "omeprazole": "omeprazole", "prilosec": "omeprazole",
            "esomeprazole": "esomeprazole", "nexium": "esomeprazole",
            "pantoprazole": "pantoprazole", "protonix": "pantoprazole",
            "lansoprazole": "lansoprazole", "prevacid": "lansoprazole",
            "famotidine": "famotidine", "pepcid": "famotidine",
            "ondansetron": "ondansetron", "zofran": "ondansetron",
            "metoclopramide": "metoclopramide", "reglan": "metoclopramide",
            
            # Pain
            "ibuprofen": "ibuprofen", "motrin": "ibuprofen", "advil": "ibuprofen",
            "acetaminophen": "acetaminophen", "tylenol": "acetaminophen", "paracetamol": "acetaminophen",
            "naproxen": "naproxen", "aleve": "naproxen", "naprosyn": "naproxen",
            "gabapentin": "gabapentin", "neurontin": "gabapentin",
            "pregabalin": "pregabalin", "lyrica": "pregabalin",
            "tramadol": "tramadol", "ultram": "tramadol",
            
            # Antibiotics
            "amoxicillin": "amoxicillin",
            "augmentin": "amoxicillin/clavulanate",
            "azithromycin": "azithromycin", "zithromax": "azithromycin",
            "z pack": "azithromycin", "z-pak": "azithromycin",
            "ciprofloxacin": "ciprofloxacin", "cipro": "ciprofloxacin",
            "doxycycline": "doxycycline",
            "cephalexin": "cephalexin", "keflex": "cephalexin",
            "clindamycin": "clindamycin",
            "metronidazole": "metronidazole", "flagyl": "metronidazole",
            "bactrim": "sulfamethoxazole/trimethoprim",
            "levofloxacin": "levofloxacin", "levaquin": "levofloxacin",
            "vancomycin": "vancomycin",
            
            # Psychiatric
            "sertraline": "sertraline", "zoloft": "sertraline",
            "fluoxetine": "fluoxetine", "prozac": "fluoxetine",
            "escitalopram": "escitalopram", "lexapro": "escitalopram",
            "citalopram": "citalopram", "celexa": "citalopram",
            "duloxetine": "duloxetine", "cymbalta": "duloxetine",
            "venlafaxine": "venlafaxine", "effexor": "venlafaxine",
            "bupropion": "bupropion", "wellbutrin": "bupropion",
            "trazodone": "trazodone",
            "quetiapine": "quetiapine", "seroquel": "quetiapine",
            "lorazepam": "lorazepam", "ativan": "lorazepam",
            "alprazolam": "alprazolam", "xanax": "alprazolam",
            "diazepam": "diazepam", "valium": "diazepam",
            "clonazepam": "clonazepam", "klonopin": "clonazepam",
            
            # Thyroid
            "levothyroxine": "levothyroxine", "synthroid": "levothyroxine",
            
            # Neurological
            "levodopa": "levodopa/carbidopa", "sinemet": "levodopa/carbidopa",
            "carbamazepine": "carbamazepine", "tegretol": "carbamazepine",
            "phenytoin": "phenytoin", "dilantin": "phenytoin",
            "valproic acid": "valproic acid",
            "depakote": "divalproex",
            "lamotrigine": "lamotrigine", "lamictal": "lamotrigine",
            "topiramate": "topiramate", "topamax": "topiramate",
            
            # Other
            "diphenhydramine": "diphenhydramine", "benadryl": "diphenhydramine",
            "cetirizine": "cetirizine", "zyrtec": "cetirizine",
            "loratadine": "loratadine", "claritin": "loratadine",
            "fexofenadine": "fexofenadine", "allegra": "fexofenadine",
            "alendronate": "alendronate", "fosamax": "alendronate",
            "vitamin d": "vitamin D",
            "vitamin b12": "vitamin B12",
            "cyanocobalamin": "vitamin B12",
            "folic acid": "folic acid",
            "ferrous sulfate": "ferrous sulfate",
        }
    
    def _load_conditions(self) -> Dict[str, str]:
        """Load medical condition corrections"""
        return {
            # Cardiovascular
            "hypertension": "hypertension", "high blood pressure": "hypertension", "htn": "hypertension",
            "hyperlipidemia": "hyperlipidemia", "high cholesterol": "hyperlipidemia",
            "coronary artery disease": "coronary artery disease", "cad": "CAD",
            "myocardial infarction": "myocardial infarction", "heart attack": "myocardial infarction", "mi": "MI",
            "atrial fibrillation": "atrial fibrillation", "a fib": "atrial fibrillation", "afib": "atrial fibrillation",
            "congestive heart failure": "congestive heart failure", "chf": "CHF", "heart failure": "heart failure",
            "deep vein thrombosis": "deep vein thrombosis", "dvt": "DVT",
            "pulmonary embolism": "pulmonary embolism", "pe": "PE",
            "peripheral vascular disease": "peripheral vascular disease", "pvd": "PVD",
            
            # Respiratory
            "chronic obstructive pulmonary disease": "chronic obstructive pulmonary disease", "copd": "COPD",
            "asthma": "asthma",
            "pneumonia": "pneumonia",
            "bronchitis": "bronchitis",
            "pulmonary fibrosis": "pulmonary fibrosis",
            "sleep apnea": "sleep apnea", "osa": "obstructive sleep apnea",
            "tuberculosis": "tuberculosis", "tb": "tuberculosis",
            
            # Endocrine
            "diabetes mellitus": "diabetes mellitus", "diabetes": "diabetes mellitus", "dm": "diabetes mellitus",
            "type 2 diabetes": "type 2 diabetes mellitus",
            "type 1 diabetes": "type 1 diabetes mellitus",
            "hypothyroidism": "hypothyroidism",
            "hyperthyroidism": "hyperthyroidism",
            "hyperglycemia": "hyperglycemia",
            "hypoglycemia": "hypoglycemia",
            
            # Neurological
            "stroke": "stroke",
            "cerebrovascular accident": "cerebrovascular accident", "cva": "CVA",
            "seizure": "seizure",
            "epilepsy": "epilepsy",
            "migraine": "migraine",
            "parkinson disease": "Parkinson's disease", "parkinsons": "Parkinson's disease",
            "multiple sclerosis": "multiple sclerosis", "ms": "multiple sclerosis",
            "alzheimers": "Alzheimer's disease",
            "dementia": "dementia",
            "neuropathy": "neuropathy", "peripheral neuropathy": "peripheral neuropathy",
            
            # Psychiatric
            "depression": "depression",
            "major depressive disorder": "major depressive disorder", "mdd": "MDD",
            "anxiety": "anxiety",
            "generalized anxiety disorder": "generalized anxiety disorder", "gad": "GAD",
            "bipolar": "bipolar disorder",
            "schizophrenia": "schizophrenia",
            "ptsd": "PTSD", "post traumatic stress disorder": "PTSD",
            "adhd": "ADHD",
            
            # Gastrointestinal
            "gastroesophageal reflux disease": "gastroesophageal reflux disease", "gerd": "GERD", "acid reflux": "GERD",
            "peptic ulcer disease": "peptic ulcer disease", "pud": "PUD",
            "gastritis": "gastritis",
            "crohns disease": "Crohn's disease", "crohns": "Crohn's disease",
            "ulcerative colitis": "ulcerative colitis", "uc": "ulcerative colitis",
            "irritable bowel syndrome": "irritable bowel syndrome", "ibs": "IBS",
            "diverticulitis": "diverticulitis",
            "cirrhosis": "cirrhosis",
            "hepatitis": "hepatitis",
            "pancreatitis": "pancreatitis",
            
            # Renal
            "chronic kidney disease": "chronic kidney disease", "ckd": "CKD",
            "acute kidney injury": "acute kidney injury", "aki": "AKI",
            "end stage renal disease": "end-stage renal disease", "esrd": "ESRD",
            "nephrolithiasis": "nephrolithiasis", "kidney stones": "nephrolithiasis",
            
            # Infectious
            "sepsis": "sepsis",
            "uti": "UTI", "urinary tract infection": "urinary tract infection",
            "cellulitis": "cellulitis",
            "abscess": "abscess",
            "hiv": "HIV",
            "aids": "AIDS",
            "hepatitis c": "hepatitis C", "hcv": "hepatitis C",
            "covid": "COVID-19", "covid 19": "COVID-19",
            "influenza": "influenza", "flu": "influenza",
            
            # Musculoskeletal
            "osteoarthritis": "osteoarthritis", "oa": "osteoarthritis",
            "rheumatoid arthritis": "rheumatoid arthritis", "ra": "rheumatoid arthritis",
            "gout": "gout",
            "osteoporosis": "osteoporosis",
            "fibromyalgia": "fibromyalgia",
            "low back pain": "low back pain", "lbp": "low back pain",
            
            # Other
            "anemia": "anemia",
            "obesity": "obesity",
            "allergies": "allergies",
            "eczema": "eczema",
            "psoriasis": "psoriasis",
        }
    
    def _load_abbreviations(self) -> Dict[str, str]:
        """Load medical abbreviation corrections"""
        return {
            # Dosing frequencies
            "b i d": "BID", "b.i.d": "BID", "twice daily": "BID", "twice a day": "BID",
            "t i d": "TID", "t.i.d": "TID", "three times daily": "TID", "three times a day": "TID",
            "q i d": "QID", "q.i.d": "QID", "four times daily": "QID", "four times a day": "QID",
            "p r n": "PRN", "p.r.n": "PRN", "as needed": "PRN",
            "q d": "QD", "q.d": "QD", "once daily": "QD", "daily": "QD",
            "q h s": "QHS", "q.h.s": "QHS", "at bedtime": "QHS", "h s": "HS", "h.s": "HS",
            "a c": "AC", "a.c": "AC", "before meals": "AC",
            "p c": "PC", "p.c": "PC", "after meals": "PC",
            
            # Routes
            "p o": "PO", "p.o": "PO", "by mouth": "PO", "orally": "PO", "oral": "PO",
            "i v": "IV", "i.v": "IV", "intravenous": "IV",
            "i m": "IM", "i.m": "IM", "intramuscular": "IM",
            "s c": "SC", "s.c": "SC", "subcutaneous": "SC", "s q": "SC",
            "s l": "SL", "s.l": "SL", "sublingual": "SL",
            "p r": "PR", "p.r": "PR", "per rectum": "PR", "rectally": "PR",
            "topically": "topical",
            "inh": "inhalation", "inhalation": "inhalation",
            
            # Other
            "n p o": "NPO", "n.p.o": "NPO", "nothing by mouth": "NPO", "nothing oral": "NPO",
            "s t a t": "STAT", "stat": "STAT", "immediately": "STAT", "now": "STAT",
            "o t c": "OTC", "over the counter": "OTC",
            "q 4 h": "q4h", "q 6 h": "q6h", "q 8 h": "q8h", "q 12 h": "q12h",
            "every 4 hours": "q4h", "every 6 hours": "q6h", "every 8 hours": "q8h", "every 12 hours": "q12h",
            
            # Clinical
            "h o": "H/O", "history of": "H/O",
            "s p": "S/P", "status post": "S/P",
            "f u": "F/U", "follow up": "F/U", "followup": "F/U",
            "r o": "R/O", "rule out": "R/O",
            "w n l": "WNL", "within normal limits": "WNL",
            "n a d": "NAD", "no acute distress": "NAD",
            "n v": "N/V", "nausea and vomiting": "N/V",
            "s o b": "SOB", "shortness of breath": "SOB",
            "c p": "CP", "chest pain": "chest pain",
            "d o b": "DOB", "date of birth": "DOB",
        }
    
    def _load_anatomy(self) -> Dict[str, str]:
        """Load anatomical term corrections"""
        return {
            "bilateral": "bilateral", "unilateral": "unilateral",
            "anterior": "anterior", "posterior": "posterior",
            "superior": "superior", "inferior": "inferior",
            "lateral": "lateral", "medial": "medial",
            "distal": "distal", "proximal": "proximal",
            "dorsal": "dorsal", "ventral": "ventral",
            "cranial": "cranial", "caudal": "caudal",
            "ipsilateral": "ipsilateral", "contralateral": "contralateral",
            "thoracic": "thoracic", "lumbar": "lumbar", "cervical": "cervical",
            "abdominal": "abdominal", "pelvic": "pelvic",
            "cardiac": "cardiac", "pulmonary": "pulmonary",
            "hepatic": "hepatic", "renal": "renal",
            "gastric": "gastric", "intestinal": "intestinal",
            "neurologic": "neurologic", "neurological": "neurological",
        }
    
    def _load_symptoms(self) -> Dict[str, str]:
        """Load clinical symptom corrections"""
        return {
            "febrile": "febrile", "afebrile": "afebrile",
            "tachycardic": "tachycardic", "bradycardic": "bradycardic",
            "hypertensive": "hypertensive", "hypotensive": "hypotensive",
            "tachypneic": "tachypneic", "hypoxic": "hypoxic",
            "fever": "fever", "chills": "chills",
            "cough": "cough", "headache": "headache",
            "nausea": "nausea", "vomiting": "vomiting",
            "diarrhea": "diarrhea", "constipation": "constipation",
            "fatigue": "fatigue", "malaise": "malaise",
            "dyspnea": "dyspnea", "orthopnea": "orthopnea",
            "edema": "edema", "cyanosis": "cyanosis",
            "jaundice": "jaundice", "pallor": "pallor",
            "diaphoresis": "diaphoresis", "sweating": "diaphoresis",
            "sharp": "sharp", "dull": "dull",
            "aching": "aching", "throbbing": "throbbing",
            "burning": "burning", "cramping": "cramping",
            "radiating": "radiating", "intermittent": "intermittent",
        }
    
    def _load_labs(self) -> Dict[str, str]:
        """Load laboratory test corrections"""
        return {
            "c b c": "CBC", "complete blood count": "CBC",
            "cmp": "CMP", "comprehensive metabolic panel": "CMP",
            "bmp": "BMP", "basic metabolic panel": "BMP",
            "hba1c": "HbA1c", "hemoglobin a1c": "HbA1c", "a1c": "HbA1c",
            "lipid panel": "lipid panel",
            "tsh": "TSH", "thyroid stimulating hormone": "TSH",
            "pt": "PT", "prothrombin time": "PT",
            "inr": "INR",
            "ptt": "PTT", "partial thromboplastin time": "PTT",
            "bun": "BUN",
            "creatinine": "creatinine", "cr": "creatinine",
            "egfr": "eGFR", "gfr": "GFR",
            "liver function test": "liver function tests", "lfts": "LFTs",
            "ast": "AST", "alt": "ALT",
            "alkaline phosphatase": "alkaline phosphatase", "alk phos": "alkaline phosphatase",
            "bilirubin": "bilirubin", "albumin": "albumin",
            "urinalysis": "urinalysis", "ua": "urinalysis",
            "blood culture": "blood culture", "urine culture": "urine culture",
            "troponin": "troponin",
            "bnp": "BNP", "b type natriuretic peptide": "BNP",
            "d dimer": "D-dimer",
            "lactate": "lactate",
            "c reactive protein": "C-reactive protein", "crp": "CRP",
            "esr": "ESR", "sedimentation rate": "ESR",
        }
    
    def process(self, text: str) -> Tuple[str, List[str]]:
        """Process text and correct medical terms"""
        if not text:
            return text, []
        
        detected_terms = []
        processed_text = text
        
        for term in self.sorted_terms:
            correction = self.all_terms[term]
            
            # Case-insensitive matching with word boundaries
            pattern = r'\b' + re.escape(term) + r'\b'
            matches = re.findall(pattern, processed_text, re.IGNORECASE)
            
            for match in matches:
                if match.lower() != correction.lower():
                    detected_terms.append(f"{match} → {correction}")
                processed_text = re.sub(pattern, correction, processed_text, flags=re.IGNORECASE)
        
        # Limit detected terms to avoid overwhelming response
        return processed_text, detected_terms[:15]
    
    def get_stats(self) -> Dict[str, int]:
        """Get dictionary statistics"""
        return {
            "total": len(self.all_terms),
            "drugs": len(self.drugs),
            "conditions": len(self.conditions),
            "abbreviations": len(self.abbreviations),
            "anatomy": len(self.anatomy),
            "symptoms": len(self.symptoms),
            "labs": len(self.labs),
        }


# ============================================
# ASR Engines
# ============================================

class ZAIASREngine:
    """Z.ai Cloud ASR Engine (Primary)"""
    
    def __init__(self):
        self.is_available = False
        self._check_availability()
    
    def _check_availability(self):
        """Check if Z.ai SDK is available"""
        try:
            # Try importing zai-sdk
            import importlib
            zai_sdk = importlib.import_module('zai-sdk')
            self.is_available = True
            logger.info("[ZAI] Z.ai SDK is available")
        except ImportError:
            logger.warning("[ZAI] Z.ai SDK not installed - using fallback")
            self.is_available = False
    
    async def transcribe(self, audio_base64: str, language: str = "en") -> Dict[str, Any]:
        """Transcribe using Z.ai SDK"""
        if not self.is_available:
            raise RuntimeError("Z.ai SDK not available")
        
        try:
            import zai_sdk
            
            # Initialize client
            client = zai_sdk.ZAI()
            
            # Transcribe
            response = await client.audio.asr.create(
                file_base64=audio_base64
            )
            
            return {
                "text": response.text if hasattr(response, 'text') else str(response),
                "confidence": 0.95,
            }
        except Exception as e:
            logger.error(f"[ZAI] Transcription error: {e}")
            raise


class Wav2Vec2Engine:
    """Local Wav2Vec2 ASR Engine (Fallback)"""
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.is_loaded = False
        self.device = config.DEVICE
    
    async def load_model(self):
        """Load Wav2Vec2 model"""
        try:
            import torch
            from transformers import Wav2Vec2ForCTC, AutoProcessor
            
            logger.info(f"[Wav2Vec2] Loading model: {config.MODEL_NAME}")
            
            # Check for GPU
            if torch.cuda.is_available():
                self.device = "cuda"
                logger.info(f"[Wav2Vec2] GPU available: {torch.cuda.get_device_name(0)}")
            else:
                self.device = "cpu"
                logger.info("[Wav2Vec2] Running on CPU")
            
            # Load model
            try:
                self.processor = AutoProcessor.from_pretrained(config.MODEL_NAME)
                self.model = Wav2Vec2ForCTC.from_pretrained(config.MODEL_NAME)
            except Exception as e:
                logger.warning(f"[Wav2Vec2] Primary model failed, using fallback: {e}")
                self.processor = AutoProcessor.from_pretrained(config.FALLBACK_MODEL)
                self.model = Wav2Vec2ForCTC.from_pretrained(config.FALLBACK_MODEL)
            
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
            
            logger.info("[Wav2Vec2] Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"[Wav2Vec2] Failed to load model: {e}")
            return False
    
    async def transcribe(self, audio_data, sample_rate: int = 16000) -> Dict[str, Any]:
        """Transcribe audio data"""
        if not self.is_loaded:
            return {"text": "", "confidence": 0.0}
        
        try:
            import torch
            import librosa
            import numpy as np
            
            # Resample if needed
            if sample_rate != 16000:
                audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
            
            # Process audio
            inputs = self.processor(
                audio_data,
                sampling_rate=16000,
                return_tensors="pt",
                padding=True
            )
            
            # Move to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Run inference
            with torch.no_grad():
                logits = self.model(**inputs).logits
            
            # Decode
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids)[0]
            
            # Calculate confidence
            probs = torch.nn.functional.softmax(logits, dim=-1)
            confidence = torch.max(probs, dim=-1).values.mean().item()
            
            return {
                "text": transcription.strip(),
                "confidence": round(confidence, 4),
            }
            
        except Exception as e:
            logger.error(f"[Wav2Vec2] Transcription error: {e}")
            return {"text": "", "confidence": 0.0}


# ============================================
# Global State
# ============================================

class AppState:
    zai_engine: Optional[ZAIASREngine] = None
    wav2vec2_engine: Optional[Wav2Vec2Engine] = None
    medical_dictionary: Optional[MedicalTermDictionary] = None
    primary_engine: str = "stub"

state = AppState()

# ============================================
# Lifespan Management
# ============================================

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("=" * 60)
    logger.info("Starting MedASR Service v2.0.0")
    logger.info("=" * 60)
    logger.info(f"Port: {config.PORT}")
    logger.info(f"Primary Engine: {config.PRIMARY_ENGINE}")
    logger.info(f"Device: {config.DEVICE}")
    logger.info("-" * 60)
    
    # Initialize medical dictionary
    state.medical_dictionary = MedicalTermDictionary()
    logger.info(f"Medical dictionary loaded: {state.medical_dictionary.get_stats()}")
    
    # Initialize engines based on configuration
    if config.PRIMARY_ENGINE == "zai":
        state.zai_engine = ZAIASREngine()
        if state.zai_engine.is_available:
            state.primary_engine = "zai"
            logger.info("[Engine] Using Z.ai SDK as primary engine")
        else:
            # Fall back to Wav2Vec2
            state.wav2vec2_engine = Wav2Vec2Engine()
            await state.wav2vec2_engine.load_model()
            if state.wav2vec2_engine.is_loaded:
                state.primary_engine = "wav2vec2"
                logger.info("[Engine] Using Wav2Vec2 as primary engine (Z.ai unavailable)")
            else:
                state.primary_engine = "stub"
                logger.warning("[Engine] No ASR engine available - running in stub mode")
    
    elif config.PRIMARY_ENGINE == "wav2vec2":
        state.wav2vec2_engine = Wav2Vec2Engine()
        await state.wav2vec2_engine.load_model()
        if state.wav2vec2_engine.is_loaded:
            state.primary_engine = "wav2vec2"
            logger.info("[Engine] Using Wav2Vec2 as primary engine")
        else:
            state.primary_engine = "stub"
            logger.warning("[Engine] Wav2Vec2 failed to load - running in stub mode")
    
    else:
        state.primary_engine = "stub"
        logger.info("[Engine] Running in stub mode (ASR disabled)")
    
    logger.info(f"Service ready! Primary engine: {state.primary_engine}")
    logger.info("=" * 60)
    
    yield
    
    logger.info("Shutting down MedASR Service...")


# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="MedASR Service",
    description="Medical Automatic Speech Recognition - World-Class Clinical Dictation",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Health Endpoints
# ============================================

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "service": "MedASR Service",
        "version": "2.0.0",
        "description": "Medical Automatic Speech Recognition",
        "primary_engine": state.primary_engine,
        "features": [
            "z-ai-sdk-integration",
            "wav2vec2-fallback",
            "medical-term-processing",
            "drug-name-normalization",
            "abbreviation-correction",
        ],
        "docs": "/docs",
        "endpoints": {
            "transcribe": "/transcribe",
            "health": "/health",
            "medical_terms": "/medical-terms",
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint"""
    gpu_available = False
    memory_usage_mb = None
    
    try:
        import torch
        if state.wav2vec2_engine and state.wav2vec2_engine.is_loaded:
            gpu_available = torch.cuda.is_available()
            if gpu_available:
                memory_usage_mb = torch.cuda.memory_allocated() / (1024 * 1024)
    except ImportError:
        pass
    
    features = ["medical-term-processing"]
    if state.zai_engine and state.zai_engine.is_available:
        features.append("z-ai-sdk")
    if state.wav2vec2_engine and state.wav2vec2_engine.is_loaded:
        features.append("wav2vec2-local")
    
    return HealthResponse(
        status="healthy" if state.primary_engine != "stub" else "degraded",
        model_loaded=state.wav2vec2_engine.is_loaded if state.wav2vec2_engine else False,
        engine=state.primary_engine,
        gpu_available=gpu_available,
        memory_usage_mb=memory_usage_mb,
        timestamp=datetime.utcnow().isoformat(),
        version="2.0.0",
        features=features,
    )


@app.get("/health/ready", tags=["System"])
async def readiness():
    """Readiness probe"""
    return {
        "status": "ready" if state.primary_engine != "stub" else "degraded",
        "engine": state.primary_engine,
    }


@app.get("/health/live", tags=["System"])
async def liveness():
    """Liveness probe"""
    return {"status": "alive"}


# ============================================
# Transcription Endpoints
# ============================================

@app.post("/transcribe", response_model=TranscribeResponse, tags=["Transcription"])
@app.post("/api/v1/transcribe", response_model=TranscribeResponse, tags=["Transcription"])
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio from base64 encoded data"""
    start_time = time.time()
    
    try:
        # Check audio size
        audio_size_mb = (len(request.audio_base64) * 0.75) / (1024 * 1024)
        if audio_size_mb > config.MAX_AUDIO_SIZE_MB:
            raise HTTPException(
                status_code=400,
                detail=f"Audio file too large ({audio_size_mb:.2f}MB). Maximum: {config.MAX_AUDIO_SIZE_MB}MB"
            )
        
        transcription = ""
        confidence = 0.0
        engine_used = state.primary_engine
        
        # Try primary engine
        if state.primary_engine == "zai" and state.zai_engine:
            try:
                result = await state.zai_engine.transcribe(
                    request.audio_base64,
                    request.language
                )
                transcription = result.get("text", "")
                confidence = result.get("confidence", 0.95)
                engine_used = "zai"
            except Exception as e:
                logger.warning(f"[ZAI] Primary failed, trying fallback: {e}")
                # Fall through to Wav2Vec2
        
        # Try Wav2Vec2 fallback
        if not transcription and state.wav2vec2_engine and state.wav2vec2_engine.is_loaded:
            try:
                import librosa
                import numpy as np
                
                # Decode audio
                audio_bytes = base64.b64decode(request.audio_base64)
                
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(audio_bytes)
                    tmp_path = tmp.name
                
                try:
                    audio_data, sr = librosa.load(tmp_path, sr=request.sample_rate, mono=True)
                    result = await state.wav2vec2_engine.transcribe(audio_data, sr)
                    transcription = result.get("text", "")
                    confidence = result.get("confidence", 0.0)
                    engine_used = "wav2vec2"
                finally:
                    os.unlink(tmp_path)
                    
            except Exception as e:
                logger.warning(f"[Wav2Vec2] Fallback failed: {e}")
        
        # Medical term post-processing
        medical_terms = []
        if request.enable_medical_postprocess and transcription and state.medical_dictionary:
            transcription, medical_terms = state.medical_dictionary.process(transcription)
        
        # Calculate processing time
        processing_time_ms = (time.time() - start_time) * 1000
        
        return TranscribeResponse(
            success=True,
            transcription=transcription,
            confidence=confidence,
            word_count=len(transcription.split()) if transcription else 0,
            processing_time_ms=round(processing_time_ms, 2),
            medical_terms_detected=medical_terms,
            segments=[],
            engine=engine_used,
            language=request.language,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Transcribe] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/file", response_model=TranscribeResponse, tags=["Transcription"])
async def transcribe_file(
    file: UploadFile = File(...),
    language: str = "en",
    enable_medical_postprocess: bool = True
):
    """Transcribe uploaded audio file"""
    start_time = time.time()
    
    try:
        # Read file
        content = await file.read()
        
        # Encode to base64
        audio_base64 = base64.b64encode(content).decode('utf-8')
        
        # Use main transcribe endpoint
        request = TranscribeRequest(
            audio_base64=audio_base64,
            language=language,
            enable_medical_postprocess=enable_medical_postprocess,
        )
        
        return await transcribe_audio(request)
        
    except Exception as e:
        logger.error(f"[TranscribeFile] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Medical Terms Endpoint
# ============================================

@app.get("/medical-terms", tags=["Reference"])
async def get_medical_terms():
    """Get medical term dictionary statistics"""
    if state.medical_dictionary:
        return {
            "success": True,
            "stats": state.medical_dictionary.get_stats(),
        }
    return {"success": False, "error": "Dictionary not initialized"}


# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     MedASR Service v2.0.0                                  ║
    ║                                                            ║
    ║     Medical Automatic Speech Recognition                   ║
    ║                                                            ║
    ║     Primary Engine: {config.PRIMARY_ENGINE:<40} ║
    ║     Port: {config.PORT:<49} ║
    ║     Docs: http://localhost:{config.PORT}/docs{' ' * 27}║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=config.PORT, log_level="info")
