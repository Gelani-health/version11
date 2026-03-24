#!/usr/bin/env python3
"""
LangChain RAG Service Stub - Port 3032
Simplified version for quick startup
"""
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="LangChain RAG Service",
    description="READ/WRITE enabled service with Smart Sync",
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
        "service": "LangChain RAG Service",
        "version": "1.0.0-stub",
        "port": 3032,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mode": "READ_WRITE",
        "namespace": "pubmed",
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
    port = int(os.getenv("PORT", "3032"))
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     LangChain RAG Service (Stub)                           ║
    ║     Port: {port}                                              ║
    ║     Docs: http://localhost:{port}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port)
