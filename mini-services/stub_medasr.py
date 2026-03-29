#!/usr/bin/env python3
"""
MedASR Service Stub - Docker Version
Port 3033

Medical Automatic Speech Recognition Service
- Supports real-time transcription via Web Speech API fallback
- Medical term post-processing
- Multi-language support
"""
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MedASR Service",
    description="Medical Automatic Speech Recognition - World-Class Clinical Dictation",
    version="2.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class TranscribeRequest(BaseModel):
    audio_base64: str
    sample_rate: int = 16000
    language: str = "en"
    context: Optional[str] = "medical"
    enable_medical_postprocess: bool = True
    audio_format: Optional[str] = "webm"

class TranscribeResponse(BaseModel):
    success: bool
    transcription: str
    confidence: float
    word_count: int
    processing_time_ms: float
    medical_terms_detected: List[str] = []
    segments: List[Dict[str, Any]] = []
    engine: str
    language: str

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    memory_usage_mb: Optional[float] = None
    timestamp: str
    version: str
    services: Dict[str, str]

# ============================================
# MEDICAL TERM DICTIONARY
# ============================================

MEDICAL_TERMS = {
    # Drug Names
    "metformin": "Metformin",
    "lisinopril": "Lisinopril",
    "atorvastatin": "Atorvastatin",
    "omeprazole": "Omeprazole",
    "amlodipine": "Amlodipine",
    "metoprolol": "Metoprolol",
    "losartan": "Losartan",
    "gabapentin": "Gabapentin",
    "hydrochlorothiazide": "Hydrochlorothiazide",
    "prednisone": "Prednisone",
    "aspirin": "Aspirin",
    "ibuprofen": "Ibuprofen",
    "acetaminophen": "Acetaminophen",
    "paracetamol": "Paracetamol",
    "amoxicillin": "Amoxicillin",
    "azithromycin": "Azithromycin",
    "ciprofloxacin": "Ciprofloxacin",
    "doxycycline": "Doxycycline",
    
    # Medical Conditions
    "hypertension": "Hypertension",
    "diabetes": "Diabetes",
    "diabetes mellitus": "Diabetes Mellitus",
    "hyperlipidemia": "Hyperlipidemia",
    "coronary artery disease": "Coronary Artery Disease",
    "chronic kidney disease": "Chronic Kidney Disease",
    "atrial fibrillation": "Atrial Fibrillation",
    "congestive heart failure": "Congestive Heart Failure",
    "chronic obstructive pulmonary disease": "Chronic Obstructive Pulmonary Disease",
    "copd": "COPD",
    "myocardial infarction": "Myocardial Infarction",
    "pneumonia": "Pneumonia",
    "bronchitis": "Bronchitis",
    "asthma": "Asthma",
    "migraine": "Migraine",
    "depression": "Depression",
    "anxiety": "Anxiety",
    
    # Medical Abbreviations
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
    "s l": "SL",
    "n g": "NG",
    "o t c": "OTC",
    
    # Anatomy Terms
    "bilateral": "bilateral",
    "unilateral": "unilateral",
    "anterior": "anterior",
    "posterior": "posterior",
    "superior": "superior",
    "inferior": "inferior",
    "lateral": "lateral",
    "medial": "medial",
    "distal": "distal",
    "proximal": "proximal",
    
    # Clinical Terms
    "fever": "fever",
    "cough": "cough",
    "headache": "headache",
    "nausea": "nausea",
    "vomiting": "vomiting",
    "diarrhea": "diarrhea",
    "constipation": "constipation",
    "fatigue": "fatigue",
    "dyspnea": "dyspnea",
    "chest pain": "chest pain",
    "abdominal pain": "abdominal pain",
    "back pain": "back pain",
}

# ============================================
# ENDPOINTS
# ============================================

@app.get("/")
async def root():
    return {
        "service": "MedASR Service",
        "description": "Medical Automatic Speech Recognition",
        "version": "2.0.0",
        "port": int(os.getenv("PORT", "3033")),
        "engine": "z-ai-asr",
        "features": [
            "real-time-transcription",
            "medical-term-detection",
            "multi-language-support",
            "confidence-scoring"
        ],
        "docs": "/docs",
        "endpoints": {
            "transcribe": "/transcribe",
            "health": "/health",
            "medical_terms": "/medical-terms",
            "languages": "/supported-languages"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        model_loaded=True,
        gpu_available=False,
        memory_usage_mb=256.0,
        timestamp=datetime.utcnow().isoformat(),
        version="2.0.0",
        services={
            "pinecone": "configured",
            "llm": "configured"
        }
    )

@app.get("/health/ready")
async def readiness():
    return {"status": "ready"}

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}

@app.post("/transcribe", response_model=TranscribeResponse)
@app.post("/api/v1/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe audio using the configured ASR engine.
    In stub mode, returns a placeholder response.
    The actual transcription is handled by Web Speech API on the client side.
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"[Transcribe] Received audio: {len(request.audio_base64)} bytes, context: {request.context}")
        
        # In stub mode, we return a signal that the client should use Web Speech API
        # The actual transcription happens in the browser
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Return empty transcription - client will use Web Speech API fallback
        return TranscribeResponse(
            success=True,
            transcription="",  # Empty - triggers Web Speech API fallback
            confidence=0.0,
            word_count=0,
            processing_time_ms=processing_time,
            medical_terms_detected=[],
            segments=[],
            engine="stub-mode-use-web-speech-api",
            language=request.language
        )
        
    except Exception as e:
        logger.error(f"[Transcribe] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/medical-terms")
@app.get("/api/v1/medical-terms")
async def get_medical_terms():
    """Get the medical term correction dictionary"""
    return {
        "success": True,
        "terms": MEDICAL_TERMS,
        "total": len(MEDICAL_TERMS),
        "categories": {
            "drugs": len([k for k in MEDICAL_TERMS if k in ["metformin", "lisinopril", "atorvastatin", "omeprazole", "amlodipine", "metoprolol", "losartan", "gabapentin", "hydrochlorothiazide", "prednisone", "aspirin", "ibuprofen", "acetaminophen", "paracetamol", "amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline"]]),
            "conditions": len([k for k in MEDICAL_TERMS if k in ["hypertension", "diabetes", "hyperlipidemia", "coronary artery disease", "chronic kidney disease", "atrial fibrillation", "congestive heart failure", "copd", "myocardial infarction", "pneumonia", "bronchitis", "asthma", "migraine", "depression", "anxiety"]]),
            "abbreviations": len([k for k in MEDICAL_TERMS if " " in k and len(k) <= 5]),
            "anatomy": len([k for k in MEDICAL_TERMS if k in ["bilateral", "unilateral", "anterior", "posterior", "superior", "inferior", "lateral", "medial", "distal", "proximal"]]),
        }
    }

@app.get("/supported-languages")
@app.get("/api/v1/supported-languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "success": True,
        "languages": [
            {"code": "en", "name": "English", "native": "English", "supported": True},
            {"code": "en-US", "name": "English (US)", "native": "English (US)", "supported": True},
            {"code": "en-GB", "name": "English (UK)", "native": "English (UK)", "supported": True},
            {"code": "es", "name": "Spanish", "native": "Español", "supported": True},
            {"code": "es-ES", "name": "Spanish (Spain)", "native": "Español (España)", "supported": True},
            {"code": "fr", "name": "French", "native": "Français", "supported": True},
            {"code": "de", "name": "German", "native": "Deutsch", "supported": True},
            {"code": "it", "name": "Italian", "native": "Italiano", "supported": True},
            {"code": "pt", "name": "Portuguese", "native": "Português", "supported": True},
            {"code": "zh", "name": "Chinese", "native": "中文", "supported": True},
            {"code": "ja", "name": "Japanese", "native": "日本語", "supported": True},
            {"code": "ko", "name": "Korean", "native": "한국어", "supported": True},
            {"code": "ar", "name": "Arabic", "native": "العربية", "supported": True},
            {"code": "hi", "name": "Hindi", "native": "हिन्दी", "supported": True},
        ],
        "default": "en-US"
    }

@app.post("/post-process")
async def post_process_text(request: dict):
    """Post-process text for medical term correction"""
    text = request.get("text", "")
    
    if not text:
        return {"success": True, "text": "", "corrections": []}
    
    corrections = []
    processed_text = text
    
    for term, correction in MEDICAL_TERMS.items():
        if term.lower() in processed_text.lower():
            # Case-insensitive replacement
            import re
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            processed_text = pattern.sub(correction, processed_text)
            corrections.append({
                "original": term,
                "corrected": correction,
                "position": text.lower().find(term.lower())
            })
    
    return {
        "success": True,
        "original_text": text,
        "processed_text": processed_text,
        "corrections": corrections,
        "correction_count": len(corrections)
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3033"))
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     MedASR Service v2.0.0                                 ║
    ║                                                            ║
    ║     Medical Automatic Speech Recognition                   ║
    ║     Port: {port}                                              ║
    ║     Docs: http://localhost:{port}/docs                       ║
    ║                                                            ║
    ║     Note: Stub mode - uses Web Speech API fallback         ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port)
