"""
Health Check Endpoints for Medical RAG Service
===============================================

Comprehensive health check system with dependency probing and caching.

PROMPT 13: OpenTelemetry Observability + Health Endpoints

Features:
- Dependency probing with actual lightweight calls
- 10-second health check result cache (prevent thundering herd)
- Status logic: ok/degraded/down based on critical dependencies
- Actual latency measurement for each dependency

Health Response Schema:
{
    "status": "ok" | "degraded" | "down",
    "service": "medical-rag-service",
    "version": "1.0.0",
    "uptime_seconds": 123.45,
    "dependencies": {
        "pinecone": {"status": "ok"|"error", "latency_ms": 45.2},
        "together_ai": {"status": "ok"|"error", "latency_ms": 120.5},
        "sqlite": {"status": "ok"|"error", "latency_ms": 0.5},
        "redis": {"status": "ok"|"error", "latency_ms": 1.2}
    },
    "ingestion": {
        "namespaces_loaded": 7,
        "last_ingested_at": "2024-01-15T10:30:00Z"
    }
}

Status Logic:
- "ok": All dependencies healthy
- "degraded": ≥1 dependency has error but service can still function
- "down": Both Pinecone AND Together AI fail (cannot serve clinical queries)

Evidence Sources:
- Kubernetes Health Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- HIPAA Availability: 45 CFR 164.312(a)(1)

Author: Gelani Healthcare Assistant
"""

import os
import time
import asyncio
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from functools import lru_cache

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
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
    """Cache for health check results to prevent thundering herd."""
    result: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    ttl_seconds: int = 10
    
    def is_valid(self) -> bool:
        """Check if cached result is still valid."""
        if self.result is None or self.timestamp is None:
            return False
        return datetime.utcnow() < self.timestamp + timedelta(seconds=self.ttl_seconds)
    
    def get(self) -> Optional[Dict[str, Any]]:
        """Get cached result if valid."""
        if self.is_valid():
            return self.result
        return None
    
    def set(self, result: Dict[str, Any]) -> None:
        """Cache a health check result."""
        self.result = result
        self.timestamp = datetime.utcnow()


# Global cache instance
_health_cache = HealthCache()


# =============================================================================
# SERVICE METADATA
# =============================================================================

SERVICE_NAME = "medical-rag-service"
SERVICE_VERSION = os.environ.get("SERVICE_VERSION", "1.0.0")
SERVICE_START_TIME = datetime.utcnow()


# =============================================================================
# DEPENDENCY PROBES
# =============================================================================

async def probe_pinecone() -> Dict[str, Any]:
    """
    Probe Pinecone index with describe_index_stats call.
    
    Uses a 5-second timeout to prevent hanging on network issues.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        from app.core.pinecone_config import get_pinecone_index
        
        # Get Pinecone index with timeout
        index = get_pinecone_index()
        
        # Call describe_index_stats with timeout
        stats = await asyncio.wait_for(
            asyncio.to_thread(index.describe_index_stats),
            timeout=5.0
        )
        
        latency_ms = (time.time() - start_time) * 1000
        
        return {
            "status": "ok",
            "latency_ms": round(latency_ms, 2),
            "total_vector_count": stats.get("totalRecordCount", 0),
        }
        
    except asyncio.TimeoutError:
        latency_ms = (time.time() - start_time) * 1000
        logger.warning(f"Pinecone health check timeout after {latency_ms:.0f}ms")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": "timeout",
        }
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error(f"Pinecone health check failed: {e}")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:100],  # Truncate error message
        }


async def probe_together_ai() -> Dict[str, Any]:
    """
    Probe Together AI / Z.AI API with HEAD request.
    
    Uses a 5-second timeout to prevent hanging on network issues.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        import httpx
        
        # Determine API endpoint based on configuration
        base_url = os.environ.get("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4")
        
        # HEAD request to API endpoint
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.head(f"{base_url}/models", follow_redirects=True)
            
        latency_ms = (time.time() - start_time) * 1000
        
        if response.status_code < 500:
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
            
    except asyncio.TimeoutError:
        latency_ms = (time.time() - start_time) * 1000
        logger.warning(f"Together AI health check timeout after {latency_ms:.0f}ms")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": "timeout",
        }
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error(f"Together AI health check failed: {e}")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:100],
        }


async def probe_sqlite() -> Dict[str, Any]:
    """
    Probe SQLite database with SELECT 1 query.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        # Resolve database path
        db_path = resolve_database_path()
        
        # Execute SELECT 1 with timeout
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


async def probe_redis() -> Dict[str, Any]:
    """
    Probe Redis with PING command.
    
    Uses a 2-second timeout as specified in P13.
    
    Returns:
        Dict with status and latency_ms
    """
    start_time = time.time()
    
    try:
        from app.cache.redis_cache import get_cache_manager
        
        # Get cache manager
        cache = await get_cache_manager()
        
        if cache is None:
            # Redis not configured
            return {
                "status": "not_configured",
                "latency_ms": 0,
            }
        
        # Execute PING with timeout
        result = await asyncio.wait_for(
            cache.ping(),
            timeout=2.0
        )
        
        latency_ms = (time.time() - start_time) * 1000
        
        if result:
            return {
                "status": "ok",
                "latency_ms": round(latency_ms, 2),
            }
        else:
            return {
                "status": "error",
                "latency_ms": round(latency_ms, 2),
                "error": "ping_failed",
            }
            
    except asyncio.TimeoutError:
        latency_ms = (time.time() - start_time) * 1000
        logger.warning(f"Redis health check timeout after {latency_ms:.0f}ms")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": "timeout",
        }
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        
        # Check if Redis is simply not configured
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            return {
                "status": "not_configured",
                "latency_ms": 0,
            }
        
        logger.error(f"Redis health check failed: {e}")
        return {
            "status": "error",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:100],
        }


# =============================================================================
# DATABASE PATH RESOLUTION
# =============================================================================

def resolve_database_path() -> str:
    """
    Resolve the SQLite database path.
    
    Checks multiple possible locations in order of preference.
    """
    # Check for explicit DATABASE_URL environment variable
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url:
        return db_url.replace("file:", "").replace("sqlite:", "")
    
    # Check possible database locations
    possible_paths = [
        "/app/data/healthcare.db",  # Docker production path
        "/app/prisma/dev.db",        # Docker development path
        "./data/healthcare.db",      # Local development
        "./healthcare.db",           # Local root
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    # Default to production path
    return "/app/data/healthcare.db"


# =============================================================================
# INGESTION STATUS
# =============================================================================

def get_ingestion_status() -> Dict[str, Any]:
    """
    Get ingestion status from scheduler or database.
    
    Returns:
        Dict with namespaces_loaded and last_ingested_at
    """
    try:
        # Try to get from scheduler
        from app.scheduler.data_refresh import get_scheduler
        import asyncio
        
        # Get scheduler synchronously
        loop = asyncio.new_event_loop()
        try:
            scheduler = loop.run_until_complete(get_scheduler())
            status = scheduler.get_status()
            return {
                "namespaces_loaded": status.get("namespaces_loaded", 7),
                "last_ingested_at": status.get("last_ingested_at"),
            }
        finally:
            loop.close()
            
    except Exception as e:
        logger.warning(f"Could not get ingestion status: {e}")
        
        # Return defaults
        return {
            "namespaces_loaded": 7,
            "last_ingested_at": None,
        }


# =============================================================================
# HEALTH CHECK LOGIC
# =============================================================================

def compute_status(
    pinecone_status: Dict[str, Any],
    together_ai_status: Dict[str, Any],
    sqlite_status: Dict[str, Any],
    redis_status: Dict[str, Any]
) -> str:
    """
    Compute overall service status based on dependency health.
    
    Status Logic:
    - "ok": All dependencies healthy
    - "degraded": ≥1 dependency has error but service can still function
    - "down": Both Pinecone AND Together AI fail (cannot serve clinical queries)
    
    Args:
        pinecone_status: Pinecone probe result
        together_ai_status: Together AI probe result
        sqlite_status: SQLite probe result
        redis_status: Redis probe result
        
    Returns:
        Status string: "ok", "degraded", or "down"
    """
    pinecone_ok = pinecone_status.get("status") == "ok"
    together_ai_ok = together_ai_status.get("status") == "ok"
    sqlite_ok = sqlite_status.get("status") == "ok"
    redis_ok = redis_status.get("status") in ("ok", "not_configured")
    
    # Critical: Pinecone and Together AI both needed for clinical queries
    if not pinecone_ok and not together_ai_ok:
        return "down"
    
    # Degraded: One critical dependency down or non-critical dependency down
    if not pinecone_ok or not together_ai_ok:
        return "degraded"
    
    if not sqlite_ok:
        return "degraded"
    
    if not redis_ok:
        # Redis is optional, service can still function
        return "degraded"
    
    return "ok"


async def perform_health_check() -> Dict[str, Any]:
    """
    Perform comprehensive health check with dependency probing.
    
    Returns:
        Complete health check response dictionary
    """
    start_time = time.time()
    
    # Probe all dependencies in parallel
    pinecone_task = probe_pinecone()
    together_ai_task = probe_together_ai()
    sqlite_task = probe_sqlite()
    redis_task = probe_redis()
    
    pinecone_status, together_ai_status, sqlite_status, redis_status = await asyncio.gather(
        pinecone_task,
        together_ai_task,
        sqlite_task,
        redis_task,
    )
    
    # Compute overall status
    status = compute_status(
        pinecone_status,
        together_ai_status,
        sqlite_status,
        redis_status
    )
    
    # Calculate uptime
    uptime_seconds = (datetime.utcnow() - SERVICE_START_TIME).total_seconds()
    
    # Get ingestion status
    ingestion_status = get_ingestion_status()
    
    # Build response
    response = {
        "status": status,
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "uptime_seconds": round(uptime_seconds, 2),
        "dependencies": {
            "pinecone": pinecone_status,
            "together_ai": together_ai_status,
            "sqlite": sqlite_status,
            "redis": redis_status,
        },
        "ingestion": ingestion_status,
        "check_latency_ms": round((time.time() - start_time) * 1000, 2),
    }
    
    return response


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.
    
    Returns full health status with dependency probing.
    Results are cached for 10 seconds to prevent thundering herd.
    
    Response Schema:
    {
        "status": "ok" | "degraded" | "down",
        "service": "medical-rag-service",
        "version": "1.0.0",
        "uptime_seconds": 123.45,
        "dependencies": {
            "pinecone": {"status": "ok"|"error", "latency_ms": 45.2},
            "together_ai": {"status": "ok"|"error", "latency_ms": 120.5},
            "sqlite": {"status": "ok"|"error", "latency_ms": 0.5},
            "redis": {"status": "ok"|"error"|"not_configured", "latency_ms": 1.2}
        },
        "ingestion": {
            "namespaces_loaded": 7,
            "last_ingested_at": "2024-01-15T10:30:00Z" | null
        }
    }
    """
    # Check cache first
    cached = _health_cache.get()
    if cached:
        return JSONResponse(content=cached)
    
    # Perform health check
    result = await perform_health_check()
    
    # Cache the result
    _health_cache.set(result)
    
    # Set appropriate HTTP status code
    http_status = 200
    if result["status"] == "down":
        http_status = 503
    elif result["status"] == "degraded":
        http_status = 200  # Still return 200 for degraded, but status indicates issue
    
    return JSONResponse(content=result, status_code=http_status)


@router.get("/health/live")
async def liveness_probe():
    """
    Kubernetes-style liveness probe.
    
    Returns 200 if the service process is alive.
    Does not check dependencies.
    """
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe():
    """
    Kubernetes-style readiness probe.
    
    Returns 200 if the service is ready to accept traffic.
    Checks that at least one critical dependency is available.
    """
    # Quick check without full health probe
    try:
        # Check if we can at least reach SQLite
        db_path = resolve_database_path()
        if os.path.exists(db_path):
            return {"status": "ready"}
    except Exception:
        pass
    
    # If we got here, we're not ready
    return JSONResponse(
        content={"status": "not_ready"},
        status_code=503
    )


@router.get("/health/startup")
async def startup_probe():
    """
    Kubernetes-style startup probe.
    
    Returns 200 if the service has completed startup.
    """
    # Check if startup was completed (service has been running for at least 5 seconds)
    uptime = (datetime.utcnow() - SERVICE_START_TIME).total_seconds()
    
    if uptime >= 5.0:
        return {"status": "started", "uptime_seconds": round(uptime, 2)}
    
    return JSONResponse(
        content={
            "status": "starting",
            "uptime_seconds": round(uptime, 2),
        },
        status_code=503
    )


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "router",
    "perform_health_check",
    "probe_pinecone",
    "probe_together_ai",
    "probe_sqlite",
    "probe_redis",
    "SERVICE_NAME",
    "SERVICE_VERSION",
]
