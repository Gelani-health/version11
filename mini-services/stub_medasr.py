#!/usr/bin/env python3
"""
MedASR Service Stub - Docker Version
Port 3033
"""
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

app = FastAPI(
    title="MedASR Service",
    description="Medical Automatic Speech Recognition",
    version="1.0.0-docker",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranscribeRequest(BaseModel):
    audio_base64: str
    sample_rate: int = 16000
    language: str = "en"
    context: str = "medical"
    enable_medical_postprocess: bool = True

MEDICAL_TERMS = {
    "metformin": "Metformin",
    "lisinopril": "Lisinopril",
    "hypertension": "Hypertension",
    "diabetes": "Diabetes",
    "b i d": "BID",
    "t i d": "TID",
    "p r n": "PRN",
}

@app.get("/")
async def root():
    return {
        "service": "MedASR Service",
        "version": "1.0.0-docker",
        "port": int(os.getenv("PORT", "3033")),
        "engine": "z-ai-asr",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": True,
        "gpu_available": False,
        "memory_usage_mb": 512,
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0-docker"
    }

@app.get("/health/ready")
async def readiness():
    return {"status": "ready"}

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}

@app.post("/api/v1/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    try:
        # Simulated transcription for stub mode
        transcription = "Patient presents with symptoms of hypertension and reports taking metformin BID for diabetes management."
        
        medical_terms_detected = []
        if request.enable_medical_postprocess:
            for term, correction in MEDICAL_TERMS.items():
                if term in transcription.lower():
                    medical_terms_detected.append(f"{term} → {correction}")
        
        return {
            "success": True,
            "transcription": transcription,
            "confidence": 0.95,
            "word_count": len(transcription.split()),
            "processing_time_ms": 850.0,
            "medical_terms_detected": medical_terms_detected,
            "segments": [],
            "engine": "z-ai-asr-stub",
            "language": request.language,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/medical-terms")
async def get_medical_terms():
    return {"terms": MEDICAL_TERMS, "total": len(MEDICAL_TERMS)}

@app.get("/api/v1/supported-languages")
async def get_supported_languages():
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3033"))
    print(f"MedASR Service starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
