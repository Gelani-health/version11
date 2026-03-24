#!/usr/bin/env python3
"""
Medical RAG Service Stub - Port 3031
Simplified version for quick startup
"""
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="Medical Diagnostic RAG Service",
    description="PubMed/PMC-powered RAG system for medical diagnostics",
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

@app.get("/")
async def root():
    return {
        "service": "Medical RAG Service",
        "version": "1.0.0-stub",
        "port": 3031,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "pinecone": "configured",
            "llm": "configured",
        },
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0-stub"
    }

@app.get("/health/ready")
async def readiness():
    return {"status": "ready"}

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3031"))
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     Medical Diagnostic RAG Service (Stub)                  ║
    ║     Port: {port}                                              ║
    ║     Docs: http://localhost:{port}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port)
