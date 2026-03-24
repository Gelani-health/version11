#!/usr/bin/env python3
"""
MedASR Service Stub - Port 3033
Simplified version for quick startup
"""
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="MedASR Service",
    description="Medical Automated Speech Recognition Service",
    version="1.0.0-stub",
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
    context: Optional[str] = None
    enable_medical_postprocess: bool = True

class TranscribeResponse(BaseModel):
    transcription: str
    confidence: float
    word_count: int
    processing_time_ms: float
    medical_terms_detected: List[str] = []
    segments: List[dict] = []

@app.get("/")
async def root():
    return {
        "service": "MedASR",
        "version": "1.0.0-stub",
        "port": 3033,
        "model_loaded": "False (stub mode)",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": False,
        "gpu_available": False,
        "memory_usage": None
    }

@app.get("/health/ready")
async def readiness():
    return {"status": "ready"}

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Stub transcription - returns placeholder"""
    return TranscribeResponse(
        transcription="[Stub mode - ASR service running in lightweight mode. Install full dependencies for actual transcription.]",
        confidence=0.0,
        word_count=0,
        processing_time_ms=0,
        medical_terms_detected=[],
        segments=[]
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3033"))
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     MedASR Service (Stub)                                  ║
    ║     Port: {port}                                              ║
    ║     Docs: http://localhost:{port}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port)
