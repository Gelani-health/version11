#!/usr/bin/env python3
"""
MedASR Service - Full Implementation
====================================
Port: 3033

Medical Automatic Speech Recognition with:
- Wav2Vec2 CTC model for speech-to-text
- Medical term post-processing
- Drug name and abbreviation normalization
"""

import os
import sys
import asyncio
import tempfile
import base64
import time
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level="INFO")

# ============================================
# Configuration
# ============================================

class Config:
    """Service configuration"""
    PORT: int = int(os.getenv("PORT", "3033"))
    
    # Model settings
    PRIMARY_MODEL: str = os.getenv("MEDASR_MODEL", "facebook/wav2vec2-large-960h")
    FALLBACK_MODEL: str = "facebook/wav2vec2-base-960h"
    DEVICE: str = os.getenv("DEVICE", "cpu")
    
    # Audio settings
    SAMPLE_RATE: int = 16000
    
    # HuggingFace
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

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

class TranscribeResponse(BaseModel):
    """Transcription response"""
    transcription: str
    confidence: float
    word_count: int
    processing_time_ms: float
    medical_terms_detected: List[str] = []
    segments: List[Dict[str, Any]] = []

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_name: str
    device: str
    gpu_available: bool
    memory_usage: Optional[str] = None

# ============================================
# Medical Term Processor
# ============================================

class MedicalTermProcessor:
    """Process and correct medical terms in transcriptions"""
    
    def __init__(self):
        self.medical_terms = self._load_medical_terms()
        self.drug_names = self._load_drug_names()
        self.abbreviations = self._load_abbreviations()
    
    def _load_medical_terms(self) -> Dict[str, str]:
        """Load medical term corrections"""
        return {
            # Drug names
            "metformin": "metformin",
            "lisinopril": "lisinopril",
            "atorvastatin": "atorvastatin",
            "omeprazole": "omeprazole",
            "amlodipine": "amlodipine",
            "metoprolol": "metoprolol",
            "losartan": "losartan",
            "gabapentin": "gabapentin",
            "hydrochlorothiazide": "hydrochlorothiazide",
            "prednisone": "prednisone",
            "amoxicillin": "amoxicillin",
            "azithromycin": "azithromycin",
            "ciprofloxacin": "ciprofloxacin",
            "doxycycline": "doxycycline",
            "warfarin": "warfarin",
            "apixaban": "apixaban",
            "rivaroxaban": "rivaroxaban",
            "clopidogrel": "clopidogrel",
            "aspirin": "aspirin",
            "ibuprofen": "ibuprofen",
            "acetaminophen": "acetaminophen",
            "paracetamol": "paracetamol",
            
            # Medical conditions
            "hypertension": "hypertension",
            "diabetes mellitus": "diabetes mellitus",
            "hyperlipidemia": "hyperlipidemia",
            "coronary artery disease": "coronary artery disease",
            "chronic kidney disease": "chronic kidney disease",
            "atrial fibrillation": "atrial fibrillation",
            "congestive heart failure": "congestive heart failure",
            "chronic obstructive pulmonary disease": "chronic obstructive pulmonary disease",
            "myocardial infarction": "myocardial infarction",
            "cerebrovascular accident": "cerebrovascular accident",
            "deep vein thrombosis": "deep vein thrombosis",
            "pulmonary embolism": "pulmonary embolism",
            "pneumonia": "pneumonia",
            "sepsis": "sepsis",
            
            # Anatomy
            "bilateral": "bilateral",
            "unilateral": "unilateral",
            "anterior": "anterior",
            "posterior": "posterior",
            "superior": "superior",
            "inferior": "inferior",
            "lateral": "lateral",
            "medial": "medial",
            
            # Medical terms
            "tachycardia": "tachycardia",
            "bradycardia": "bradycardia",
            "dyspnea": "dyspnea",
            "orthopnea": "orthopnea",
            "edema": "edema",
            "cyanosis": "cyanosis",
            "jaundice": "jaundice",
            "pallor": "pallor",
            "diaphoresis": "diaphoresis",
        }
    
    def _load_drug_names(self) -> Dict[str, str]:
        """Load common drug name variations"""
        return {
            "lipitor": "atorvastatin",
            "zestril": "lisinopril",
            "prinivil": "lisinopril",
            "norvasc": "amlodipine",
            "lopressor": "metoprolol",
            "toprol": "metoprolol",
            "cozaar": "losartan",
            "neurontin": "gabapentin",
            "prilosec": "omeprazole",
            "glucophage": "metformin",
            "coumadin": "warfarin",
            "plavix": "clopidogrel",
            "eliquis": "apixaban",
            "xarelto": "rivaroxaban",
            "advil": "ibuprofen",
            "motrin": "ibuprofen",
            "tylenol": "acetaminophen",
            "z pack": "azithromycin",
            "z-pak": "azithromycin",
        }
    
    def _load_abbreviations(self) -> Dict[str, str]:
        """Load medical abbreviations"""
        return {
            "b i d": "BID",
            "b.i.d": "BID",
            "twice daily": "BID",
            "t i d": "TID",
            "t.i.d": "TID",
            "three times daily": "TID",
            "q i d": "QID",
            "q.i.d": "QID",
            "four times daily": "QID",
            "p r n": "PRN",
            "p.r.n": "PRN",
            "as needed": "PRN",
            "q d": "QD",
            "q.d": "QD",
            "once daily": "QD",
            "h s": "HS",
            "h.s": "HS",
            "at bedtime": "HS",
            "p o": "PO",
            "p.o": "PO",
            "by mouth": "PO",
            "orally": "PO",
            "i v": "IV",
            "i.v": "IV",
            "intravenous": "IV",
            "i m": "IM",
            "i.m": "IM",
            "intramuscular": "IM",
            "s c": "SC",
            "s.c": "SC",
            "subcutaneous": "SC",
            "s l": "SL",
            "s.l": "SL",
            "sublingual": "SL",
            "n p o": "NPO",
            "n.p.o": "NPO",
            "nothing by mouth": "NPO",
            "p r": "PR",
            "p.r": "PR",
            "per rectum": "PR",
            "a c": "AC",
            "a.c": "AC",
            "before meals": "AC",
            "p c": "PC",
            "p.c": "PC",
            "after meals": "PC",
            "q h s": "QHS",
            "q.h.s": "QHS",
            "every bedtime": "QHS",
            "s t a t": "STAT",
            "stat": "STAT",
            "immediately": "STAT",
        }
    
    def process(self, text: str) -> tuple:
        """Process transcription and correct medical terms"""
        words = text.lower().split()
        corrected_words = []
        detected_terms = []
        
        i = 0
        while i < len(words):
            # Check for multi-word terms
            found = False
            
            # Check 3-word combinations
            if i + 2 < len(words):
                three_word = " ".join(words[i:i+3])
                for terms_dict in [self.medical_terms, self.abbreviations]:
                    if three_word in terms_dict:
                        corrected = terms_dict[three_word]
                        corrected_words.append(corrected)
                        detected_terms.append(f"{three_word} → {corrected}")
                        i += 3
                        found = True
                        break
            
            # Check 2-word combinations
            if not found and i + 1 < len(words):
                two_word = " ".join(words[i:i+2])
                for terms_dict in [self.medical_terms, self.abbreviations]:
                    if two_word in terms_dict:
                        corrected = terms_dict[two_word]
                        corrected_words.append(corrected)
                        detected_terms.append(f"{two_word} → {corrected}")
                        i += 2
                        found = True
                        break
            
            # Check single word
            if not found:
                word = words[i]
                corrected = word
                
                # Check medical terms
                if word in self.medical_terms:
                    corrected = self.medical_terms[word]
                    if corrected != word:
                        detected_terms.append(f"{word} → {corrected}")
                # Check drug names
                elif word in self.drug_names:
                    corrected = self.drug_names[word]
                    detected_terms.append(f"{word} → {corrected}")
                # Check abbreviations
                elif word in self.abbreviations:
                    corrected = self.abbreviations[word]
                    detected_terms.append(f"{word} → {corrected}")
                
                corrected_words.append(corrected)
                i += 1
        
        return " ".join(corrected_words), detected_terms[:10]  # Limit detected terms

# ============================================
# ASR Engine
# ============================================

class ASREngine:
    """Speech recognition engine"""
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.is_loaded = False
        self.model_name = ""
        self.device = config.DEVICE
        self.medical_processor = MedicalTermProcessor()
    
    async def load_model(self):
        """Load ASR model"""
        try:
            logger.info(f"Loading ASR model: {config.PRIMARY_MODEL}")
            
            import torch
            from transformers import Wav2Vec2ForCTC, AutoProcessor
            
            # Check for GPU
            if torch.cuda.is_available():
                self.device = "cuda"
                logger.info(f"GPU available: {torch.cuda.get_device_name(0)}")
            else:
                self.device = "cpu"
                logger.info("Running on CPU")
            
            # Try loading primary model
            try:
                self.processor = AutoProcessor.from_pretrained(config.PRIMARY_MODEL)
                self.model = Wav2Vec2ForCTC.from_pretrained(config.PRIMARY_MODEL)
                self.model_name = config.PRIMARY_MODEL
            except Exception as e:
                logger.warning(f"Primary model failed, using fallback: {e}")
                self.processor = AutoProcessor.from_pretrained(config.FALLBACK_MODEL)
                self.model = Wav2Vec2ForCTC.from_pretrained(config.FALLBACK_MODEL)
                self.model_name = config.FALLBACK_MODEL
            
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
            
            logger.info(f"ASR model loaded successfully: {self.model_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load ASR model: {e}")
            return False
    
    async def transcribe(self, audio_data, sample_rate: int = 16000, 
                        enable_medical_postprocess: bool = True) -> Dict[str, Any]:
        """Transcribe audio data"""
        start_time = time.time()
        
        if not self.is_loaded:
            return {
                "transcription": "[ASR model not loaded]",
                "confidence": 0.0,
                "word_count": 0,
                "processing_time_ms": 0,
                "medical_terms_detected": [],
                "segments": []
            }
        
        try:
            import torch
            import librosa
            import numpy as np
            
            # Ensure correct sample rate
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
            
            # Medical post-processing
            medical_terms = []
            if enable_medical_postprocess:
                transcription, medical_terms = self.medical_processor.process(transcription)
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000
            
            return {
                "transcription": transcription.strip(),
                "confidence": round(confidence, 4),
                "word_count": len(transcription.split()),
                "processing_time_ms": round(processing_time, 2),
                "medical_terms_detected": medical_terms,
                "segments": []
            }
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return {
                "transcription": f"[Error: {str(e)}]",
                "confidence": 0.0,
                "word_count": 0,
                "processing_time_ms": 0,
                "medical_terms_detected": [],
                "segments": []
            }

# ============================================
# Global State
# ============================================

class AppState:
    asr_engine: Optional[ASREngine] = None
    model_loaded: bool = False

state = AppState()

# ============================================
# Lifespan Management
# ============================================

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("=" * 60)
    logger.info("Starting MedASR Service (Full)")
    logger.info("=" * 60)
    logger.info(f"Port: {config.PORT}")
    logger.info(f"Primary Model: {config.PRIMARY_MODEL}")
    logger.info(f"Device: {config.DEVICE}")
    logger.info("-" * 60)
    
    # Initialize ASR engine
    state.asr_engine = ASREngine()
    state.model_loaded = await state.asr_engine.load_model()
    
    logger.info(f"Model loaded: {state.model_loaded}")
    logger.info("Service ready!")
    
    yield
    
    logger.info("Shutting down MedASR Service...")

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="MedASR Service",
    description="Medical Automatic Speech Recognition with Wav2Vec2",
    version="2.0.0-full",
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
        "service": "MedASR",
        "version": "2.0.0-full",
        "description": "Medical Automatic Speech Recognition Service",
        "model_loaded": state.model_loaded,
        "model_name": state.asr_engine.model_name if state.asr_engine else None,
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check"""
    gpu_available = False
    memory_usage = None
    
    try:
        import torch
        gpu_available = torch.cuda.is_available() if state.model_loaded else False
        if gpu_available:
            memory_usage = f"{torch.cuda.memory_allocated() / 1024**2:.1f} MB"
    except:
        pass
    
    return HealthResponse(
        status="healthy" if state.model_loaded else "initializing",
        model_loaded=state.model_loaded,
        model_name=state.asr_engine.model_name if state.asr_engine else "not_loaded",
        device=state.asr_engine.device if state.asr_engine else "unknown",
        gpu_available=gpu_available,
        memory_usage=memory_usage
    )

@app.get("/health/ready", tags=["System"])
async def readiness():
    """Readiness probe"""
    return {"status": "ready" if state.model_loaded else "initializing"}

@app.get("/health/live", tags=["System"])
async def liveness():
    """Liveness probe"""
    return {"status": "alive"}

# ============================================
# Transcription Endpoints
# ============================================

@app.post("/transcribe", response_model=TranscribeResponse, tags=["Transcription"])
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio from base64 encoded data"""
    try:
        import librosa
        import numpy as np
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio_base64)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            # Load audio
            audio_data, sr = librosa.load(tmp_path, sr=request.sample_rate, mono=True)
            
            # Transcribe
            result = await state.asr_engine.transcribe(
                audio_data,
                sr,
                request.enable_medical_postprocess
            )
            
            return TranscribeResponse(**result)
            
        finally:
            # Cleanup
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe/file", response_model=TranscribeResponse, tags=["Transcription"])
async def transcribe_file(
    file: UploadFile = File(...),
    context: Optional[str] = None,
    enable_medical_postprocess: bool = True
):
    """Transcribe audio file"""
    try:
        import librosa
        
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Load audio
            audio_data, sr = librosa.load(tmp_path, sr=16000, mono=True)
            
            # Transcribe
            result = await state.asr_engine.transcribe(
                audio_data,
                sr,
                enable_medical_postprocess
            )
            
            return TranscribeResponse(**result)
            
        finally:
            # Cleanup
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"File transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Medical Terms Endpoint
# ============================================

@app.get("/medical-terms", tags=["Reference"])
async def get_medical_terms():
    """Get list of supported medical term corrections"""
    processor = MedicalTermProcessor()
    return {
        "medical_terms": processor.medical_terms,
        "drug_names": processor.drug_names,
        "abbreviations": processor.abbreviations,
        "total_terms": len(processor.medical_terms) + len(processor.drug_names) + len(processor.abbreviations)
    }

# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     MedASR Service (Full)                                  ║
    ║                                                            ║
    ║     Wav2Vec2 CTC + Medical Term Processing                 ║
    ║                                                            ║
    ║     Port: {config.PORT}                                              ║
    ║     Docs: http://localhost:{config.PORT}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=config.PORT, log_level="info")
