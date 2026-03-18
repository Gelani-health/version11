#!/usr/bin/env python3
"""
MedASR Service - Medical Automated Speech Recognition
Google's Conformer-based ASR model for medical transcription
Port: 3033
"""

import os
import sys
import asyncio
import tempfile
import base64
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
PORT = int(os.getenv("PORT", "3033"))
HF_API_KEY = os.getenv("HF_API_KEY", "")
MODEL_NAME = os.getenv("MEDASR_MODEL", "google/medasr")

# Initialize FastAPI app
app = FastAPI(
    title="MedASR Service",
    description="Medical Automated Speech Recognition - Google's Conformer-based ASR for medical transcription",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class TranscribeRequest(BaseModel):
    audio_base64: str
    sample_rate: int = 16000
    language: str = "en"
    context: Optional[str] = None  # Medical context hint
    enable_medical_postprocess: bool = True


class TranscribeResponse(BaseModel):
    transcription: str
    confidence: float
    word_count: int
    processing_time_ms: float
    medical_terms_detected: List[str] = []
    segments: List[Dict[str, Any]] = []


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    memory_usage: Optional[str] = None


# Global model instance
class MedASREngine:
    """MedASR Engine - Wrapper for Google's Medical ASR model"""
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.tokenizer = None
        self.device = "cpu"
        self.is_loaded = False
        self.medical_terms = self._load_medical_terms()
        
    def _load_medical_terms(self) -> Dict[str, str]:
        """Load common medical term corrections"""
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
            
            # Medical conditions
            "hypertension": "hypertension",
            "diabetes mellitus": "diabetes mellitus",
            "hyperlipidemia": "hyperlipidemia",
            "coronary artery disease": "coronary artery disease",
            "chronic kidney disease": "chronic kidney disease",
            "atrial fibrillation": "atrial fibrillation",
            "congestive heart failure": "congestive heart failure",
            "chronic obstructive pulmonary disease": "chronic obstructive pulmonary disease",
            
            # Medical abbreviations
            "b i d": "BID",
            "t i d": "TID",
            "q i d": "QID",
            "p r n": "PRN",
            "q d": "QD",
            "h s": "HS",
            "p o": "PO",
            "i v": "IV",
            "i m": "IM",
            "s c": "SC",
            
            # Anatomy
            "bilateral": "bilateral",
            "unilateral": "unilateral",
            "anterior": "anterior",
            "posterior": "posterior",
            "superior": "superior",
            "inferior": "inferior",
        }
    
    async def load_model(self):
        """Load the MedASR model"""
        try:
            import torch
            from transformers import AutoProcessor, Wav2Vec2ForCTC
            
            logger.info("Loading MedASR model...")
            
            # Check for GPU
            if torch.cuda.is_available():
                self.device = "cuda"
                logger.info(f"GPU available: {torch.cuda.get_device_name(0)}")
            else:
                logger.info("Running on CPU")
            
            # Try to load MedASR, fallback to Wav2Vec2 for medical ASR
            try:
                # Attempt to load Google MedASR
                self.processor = AutoProcessor.from_pretrained(
                    MODEL_NAME,
                    token=HF_API_KEY
                )
                self.model = Wav2Vec2ForCTC.from_pretrained(
                    MODEL_NAME,
                    token=HF_API_KEY
                )
                logger.info(f"Loaded MedASR model: {MODEL_NAME}")
            except Exception as e:
                logger.warning(f"Could not load MedASR, using fallback: {e}")
                # Fallback to a medical ASR model
                fallback_model = "facebook/wav2vec2-large-960h"
                self.processor = AutoProcessor.from_pretrained(fallback_model)
                self.model = Wav2Vec2ForCTC.from_pretrained(fallback_model)
                logger.info(f"Loaded fallback model: {fallback_model}")
            
            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True
            logger.info("MedASR model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading MedASR model: {e}")
            # Continue without model - will use fallback transcription
            self.is_loaded = False
    
    def _postprocess_medical(self, text: str) -> tuple:
        """Post-process transcription with medical term corrections"""
        words = text.lower().split()
        corrected_words = []
        detected_terms = []
        
        for word in words:
            if word in self.medical_terms:
                corrected = self.medical_terms[word]
                corrected_words.append(corrected)
                if corrected != word:
                    detected_terms.append(f"{word} -> {corrected}")
            else:
                corrected_words.append(word)
        
        return " ".join(corrected_words), detected_terms
    
    async def transcribe(
        self,
        audio_data: np.ndarray,
        sample_rate: int = 16000,
        context: Optional[str] = None,
        enable_medical_postprocess: bool = True
    ) -> Dict[str, Any]:
        """Transcribe audio data"""
        start_time = datetime.now()
        
        try:
            import torch
            import librosa
            
            # Resample if needed
            if sample_rate != 16000:
                audio_data = librosa.resample(
                    audio_data, 
                    orig_sr=sample_rate, 
                    target_sr=16000
                )
            
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
            
            # Calculate confidence (average of max logits)
            probs = torch.nn.functional.softmax(logits, dim=-1)
            confidence = torch.max(probs, dim=-1).values.mean().item()
            
            # Post-process for medical terms
            medical_terms_detected = []
            if enable_medical_postprocess:
                transcription, medical_terms_detected = self._postprocess_medical(transcription)
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                "transcription": transcription.strip(),
                "confidence": round(confidence, 4),
                "word_count": len(transcription.split()),
                "processing_time_ms": round(processing_time, 2),
                "medical_terms_detected": medical_terms_detected,
                "segments": []
            }
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def transcribe_fallback(
        self,
        audio_data: np.ndarray,
        sample_rate: int = 16000
    ) -> Dict[str, Any]:
        """Fallback transcription using Web Speech API simulation"""
        # This is a placeholder for when the model isn't loaded
        # In production, you'd want to use a cloud ASR service
        return {
            "transcription": "[Model not loaded - please wait for initialization]",
            "confidence": 0.0,
            "word_count": 0,
            "processing_time_ms": 0,
            "medical_terms_detected": [],
            "segments": []
        }


# Initialize engine
engine = MedASREngine()


@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    asyncio.create_task(engine.load_model())


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "MedASR",
        "version": "1.0.0",
        "description": "Medical Automated Speech Recognition Service",
        "model_loaded": str(engine.is_loaded),
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    gpu_available = False
    memory_usage = None
    
    try:
        import torch
        gpu_available = torch.cuda.is_available() if engine.is_loaded else False
        if gpu_available:
            memory_usage = f"{torch.cuda.memory_allocated() / 1024**2:.1f} MB"
    except ImportError:
        pass
    
    return HealthResponse(
        status="healthy" if engine.is_loaded else "initializing",
        model_loaded=engine.is_loaded,
        gpu_available=gpu_available,
        memory_usage=memory_usage
    )


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio from base64 encoded data"""
    try:
        # Check if required libraries are available
        try:
            import librosa
        except ImportError:
            # Return fallback response if librosa not available
            return TranscribeResponse(
                transcription="[Speech recognition service requires additional setup - using browser fallback]",
                confidence=0.0,
                word_count=0,
                processing_time_ms=0,
                medical_terms_detected=[],
                segments=[]
            )
        
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
            if engine.is_loaded:
                result = await engine.transcribe(
                    audio_data,
                    sr,
                    request.context,
                    request.enable_medical_postprocess
                )
            else:
                result = await engine.transcribe_fallback(audio_data, sr)
            
            return TranscribeResponse(**result)
            
        finally:
            # Cleanup
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/file", response_model=TranscribeResponse)
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
            if engine.is_loaded:
                result = await engine.transcribe(
                    audio_data,
                    sr,
                    context,
                    enable_medical_postprocess
                )
            else:
                result = await engine.transcribe_fallback(audio_data, sr)
            
            return TranscribeResponse(**result)
            
        finally:
            # Cleanup
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"File transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/stream")
async def transcribe_stream(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Stream transcription for real-time processing"""
    # Placeholder for streaming transcription
    # This would be implemented with WebSocket in production
    return {"message": "Streaming endpoint - use WebSocket for real-time transcription"}


@app.get("/medical-terms")
async def get_medical_terms():
    """Get list of supported medical term corrections"""
    return {
        "terms": engine.medical_terms,
        "count": len(engine.medical_terms)
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
