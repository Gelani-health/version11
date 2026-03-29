"""
Health Check Endpoints for LangChain RAG Service
=================================================

Health endpoint for the proxy service that forwards requests to
the Medical RAG Service.

PROMPT 13: OpenTelemetry Observability + Health Endpoints

This service is a thin HTTP proxy, so its health depends on:
- Its own process health
- Connectivity to the upstream Medical RAG Service

Health Response Schema:
{
    "status": "ok" | "degraded" | "down",
    "service": "langchain-rag-proxy",
    "version": "2.0.0",
    "uptime_seconds": 123.45,
    "mode": "PROXY",
    "target_url": "http://localhost:3031",
    "dependencies": {
        "upstream": {"status": "ok"|"error", "latency_ms": 45.2}
    }
}
"""

import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from loguru import logger
import httpx


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

SERVICE_NAME = "langchain-rag-proxy"
SERVICE_VERSION = "2.0.0"
SERVICE_START_TIME = datetime.utcnow()
MEDICAL_RAG_URL = os.environ.get("MEDICAL_RAG_URL", "http://localhost:3031")


# =============================================================================
# DEPENDENCY PROBES
# =============================================================================

async def probe_upstream() -> Dict[str, Any]:
    """
    Probe the upstream Medical RAG Service.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{MEDICAL_RAG_URL}/health")
            
        latency_ms = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            return {
                "status": "ok",
                "latency_ms": round(latency_ms, 2),
                "status_code": response.status_code,
            }
        else:
            return {
                "status": "error",
                "latency_ms": round(latency_ms, 2),
                "status_code": response.status_code,
            }
            
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error(f"Upstream health check failed: {e}")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:100],
        }


# =============================================================================
# HEALTH CHECK LOGIC
# =============================================================================

def compute_status(upstream_status: Dict[str, Any]) -> str:
    """
    Compute overall status based on upstream health.
    """
    if upstream_status.get("status") == "ok":
        return "ok"
    return "degraded"


async def perform_health_check() -> Dict[str, Any]:
    """
    Perform health check with upstream probing.
    """
    start_time = time.time()
    
    # Probe upstream
    upstream_status = await probe_upstream()
    
    # Compute overall status
    status = compute_status(upstream_status)
    
    # Calculate uptime
    uptime_seconds = (datetime.utcnow() - SERVICE_START_TIME).total_seconds()
    
    return {
        "status": status,
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "uptime_seconds": round(uptime_seconds, 2),
        "mode": "PROXY",
        "target_url": MEDICAL_RAG_URL,
        "dependencies": {
            "upstream": upstream_status,
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
    # Quick check - just verify we can reach upstream
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{MEDICAL_RAG_URL}/health/live")
            if response.status_code == 200:
                return {"status": "ready"}
    except Exception:
        pass
    
    return JSONResponse(
        content={"status": "not_ready"},
        status_code=503
    )


__all__ = ["router"]
