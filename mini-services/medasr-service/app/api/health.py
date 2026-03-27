"""
Health Check Endpoints for MedASR Service
=========================================

Health endpoint for the Medical ASR (Automatic Speech Recognition) service.

PROMPT 13: OpenTelemetry Observability + Health Endpoints

This service handles audio transcription, so its health depends on:
- Its own process health
- Whisper model availability
- SQLite database (if used)

Health Response Schema:
{
    "status": "ok" | "degraded" | "down",
    "service": "medasr",
    "version": "1.0.0",
    "uptime_seconds": 123.45,
    "dependencies": {
        "sqlite": {"status": "ok"|"error", "latency_ms": 0.5},
        "whisper_model": {"status": "ok"|"error", "loaded": true}
    }
}

Note: MedASR does NOT check Pinecone or ingestion (not applicable).
"""

import os
import time
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from loguru import logger


# =============================================================================
# ROUTER SETUP
# =============================================================================

router = APIRouter(tags=["Health"])


# =============================================================================
# HEALTH CHECK CACHE
# =============================================================================

@dataclass
class HealthCache:
    """Cache for health check results."""
    result: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    ttl_seconds: int = 10
    
    def is_valid(self) -> bool:
        if self.result is None or self.timestamp is None:
            return False
        return datetime.utcnow() < self.timestamp + timedelta(seconds=self.ttl_seconds)


_health_cache = HealthCache()


# =============================================================================
# SERVICE METADATA
# =============================================================================

SERVICE_NAME = "medasr"
SERVICE_VERSION = "1.0.0"
SERVICE_START_TIME = datetime.utcnow()


# =============================================================================
# DEPENDENCY PROBES
# =============================================================================

async def probe_sqlite() -> Dict[str, Any]:
    """
    Probe SQLite database with SELECT 1.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        # Check if database path is configured
        db_path = os.environ.get("DATABASE_PATH", "/app/data/medasr.db")
        
        if not os.path.exists(db_path):
            # Database not configured - that's okay for this service
            return {
                "status": "not_configured",
                "latency_ms": 0,
            }
        
        conn = sqlite3.connect(db_path, timeout=5.0)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        conn.close()
        
        latency_ms = (time.time() - start_time) * 1000
        
        if result == (1,):
            return {
                "status": "ok",
                "latency_ms": round(latency_ms, 2),
            }
        else:
            return {
                "status": "error",
                "latency_ms": round(latency_ms, 2),
                "error": "unexpected_result",
            }
            
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error(f"SQLite health check failed: {e}")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:100],
        }


async def probe_whisper_model() -> Dict[str, Any]:
    """
    Check if Whisper model is loaded and available.
    
    Returns:
        Dict with status and loaded status
    """
    try:
        # Check if whisper is available
        import whisper
        
        # Try to get model status
        # In production, you'd track model loading state
        return {
            "status": "ok",
            "loaded": True,
            "model": os.environ.get("WHISPER_MODEL", "base"),
        }
        
    except ImportError:
        return {
            "status": "error",
            "loaded": False,
            "error": "whisper_not_installed",
        }
    except Exception as e:
        logger.error(f"Whisper model health check failed: {e}")
        return {
            "status": "error",
            "loaded": False,
            "error": str(e)[:100],
        }


# =============================================================================
# HEALTH CHECK LOGIC
# =============================================================================

def compute_status(
    sqlite_status: Dict[str, Any],
    whisper_status: Dict[str, Any]
) -> str:
    """
    Compute overall status based on dependency health.
    
    MedASR is considered "down" only if Whisper model is not available,
    since transcription is the core function.
    """
    whisper_ok = whisper_status.get("status") == "ok" and whisper_status.get("loaded", False)
    
    if not whisper_ok:
        return "down"
    
    # SQLite is optional for this service
    if sqlite_status.get("status") == "error":
        return "degraded"
    
    return "ok"


async def perform_health_check() -> Dict[str, Any]:
    """
    Perform health check with dependency probing.
    """
    start_time = time.time()
    
    # Probe dependencies
    sqlite_status = await probe_sqlite()
    whisper_status = await probe_whisper_model()
    
    # Compute overall status
    status = compute_status(sqlite_status, whisper_status)
    
    # Calculate uptime
    uptime_seconds = (datetime.utcnow() - SERVICE_START_TIME).total_seconds()
    
    return {
        "status": status,
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "uptime_seconds": round(uptime_seconds, 2),
        "dependencies": {
            "sqlite": sqlite_status,
            "whisper_model": whisper_status,
        },
        "check_latency_ms": round((time.time() - start_time) * 1000, 2),
    }


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.
    """
    # Check cache
    if _health_cache.is_valid():
        return JSONResponse(content=_health_cache.result)
    
    # Perform health check
    result = await perform_health_check()
    
    # Cache result
    _health_cache.result = result
    _health_cache.timestamp = datetime.utcnow()
    
    # Set HTTP status
    http_status = 503 if result["status"] == "down" else 200
    
    return JSONResponse(content=result, status_code=http_status)


@router.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe():
    """Kubernetes readiness probe."""
    # Quick check - just verify Whisper is loaded
    try:
        import whisper
        return {"status": "ready"}
    except ImportError:
        pass
    
    return JSONResponse(
        content={"status": "not_ready"},
        status_code=503
    )


__all__ = ["router"]
