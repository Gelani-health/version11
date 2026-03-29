"""
P2: Deep Health Probes for Clinical Decision Support System
===========================================================

Implements comprehensive health monitoring:
- Database connectivity check
- Pinecone index health
- LLM API latency check
- Embedding model status
- Memory/CPU usage
- Circuit breaker pattern
- Graceful degradation
"""

import asyncio
import time
import sys
import os
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import threading

from loguru import logger

# Import settings
try:
    from app.core.config import get_settings
except ImportError:
    def get_settings():
        class MockSettings:
            PINECONE_API_KEY = ""
            PINECONE_INDEX_NAME = "medical-diagnostic-rag"
            ZAI_API_KEY = ""
        return MockSettings()


class HealthStatus(Enum):
    """Health check status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class HealthCheckResult:
    """Result of a single health check."""
    name: str
    status: HealthStatus
    latency_ms: float = 0.0
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "latency_ms": round(self.latency_ms, 2),
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp,
        }


@dataclass
class SystemHealth:
    """Overall system health status."""
    status: HealthStatus
    checks: List[HealthCheckResult] = field(default_factory=list)
    uptime_seconds: float = 0.0
    version: str = "1.0.0"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "uptime_seconds": round(self.uptime_seconds, 2),
            "version": self.version,
            "checks": [c.to_dict() for c in self.checks],
            "timestamp": datetime.utcnow().isoformat(),
        }


class CircuitBreaker:
    """
    Circuit breaker for graceful degradation.
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failing, reject requests immediately
    - HALF_OPEN: Testing if recovered
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_requests: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._lock = threading.Lock()
    
    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        with self._lock:
            # Check if we should transition from OPEN to HALF_OPEN
            if self._state == CircuitState.OPEN and self._last_failure_time:
                elapsed = datetime.utcnow() - self._last_failure_time
                if elapsed.total_seconds() >= self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
            
            return self._state
    
    def should_allow_request(self) -> bool:
        """Check if request should be allowed."""
        state = self.state
        
        if state == CircuitState.CLOSED:
            return True
        
        if state == CircuitState.HALF_OPEN:
            # Allow limited requests in half-open state
            with self._lock:
                if self._success_count < self.half_open_requests:
                    return True
            return False
        
        return False  # OPEN state
    
    def record_success(self):
        """Record successful request."""
        with self._lock:
            self._failure_count = 0
            
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.half_open_requests:
                    self._state = CircuitState.CLOSED
                    self._success_count = 0
    
    def record_failure(self):
        """Record failed request."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = datetime.utcnow()
            
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
    
    def reset(self):
        """Reset circuit breaker."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._last_failure_time = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
        }


class DeepHealthProbe:
    """
    P2: Comprehensive health monitoring for Clinical Decision Support System.
    
    Health Checks:
    1. Database Connectivity
    2. Pinecone Index Health
    3. LLM API Latency
    4. Embedding Model Status
    5. Memory/CPU Usage
    6. Cache Status
    
    Features:
    - Circuit breaker pattern
    - Graceful degradation
    - Configurable timeouts
    - Detailed diagnostics
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.start_time = datetime.utcnow()
        
        # Circuit breakers for each dependency
        self.circuit_breakers = {
            "database": CircuitBreaker("database", failure_threshold=3, recovery_timeout=30),
            "pinecone": CircuitBreaker("pinecone", failure_threshold=5, recovery_timeout=60),
            "llm": CircuitBreaker("llm", failure_threshold=5, recovery_timeout=120),
            "embedding": CircuitBreaker("embedding", failure_threshold=3, recovery_timeout=30),
        }
        
        # Health check timeouts
        self.check_timeouts = {
            "database": 5.0,
            "pinecone": 10.0,
            "llm": 30.0,
            "embedding": 10.0,
            "memory": 1.0,
        }
    
    async def check_all(self) -> SystemHealth:
        """Run all health checks."""
        checks = []
        
        # Run checks concurrently
        results = await asyncio.gather(
            self.check_database(),
            self.check_pinecone(),
            self.check_llm_api(),
            self.check_embedding_model(),
            self.check_system_resources(),
            return_exceptions=True,
        )
        
        for result in results:
            if isinstance(result, HealthCheckResult):
                checks.append(result)
            elif isinstance(result, Exception):
                checks.append(HealthCheckResult(
                    name="unknown",
                    status=HealthStatus.UNKNOWN,
                    message=f"Health check error: {str(result)}",
                ))
        
        # Determine overall status
        overall_status = self._calculate_overall_status(checks)
        
        uptime = (datetime.utcnow() - self.start_time).total_seconds()
        
        return SystemHealth(
            status=overall_status,
            checks=checks,
            uptime_seconds=uptime,
        )
    
    def _calculate_overall_status(self, checks: List[HealthCheckResult]) -> HealthStatus:
        """Calculate overall health status from individual checks."""
        if not checks:
            return HealthStatus.UNKNOWN
        
        statuses = [c.status for c in checks]
        
        # If any critical component is unhealthy, system is unhealthy
        if any(s == HealthStatus.UNHEALTHY for s in statuses):
            return HealthStatus.UNHEALTHY
        
        # If any component is degraded, system is degraded
        if any(s == HealthStatus.DEGRADED for s in statuses):
            return HealthStatus.DEGRADED
        
        # If all checks are healthy
        if all(s == HealthStatus.HEALTHY for s in statuses):
            return HealthStatus.HEALTHY
        
        return HealthStatus.UNKNOWN
    
    async def check_database(self) -> HealthCheckResult:
        """Check database connectivity."""
        start_time = time.time()
        name = "database"
        
        # Check circuit breaker
        if not self.circuit_breakers[name].should_allow_request():
            return HealthCheckResult(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message="Circuit breaker OPEN - database unavailable",
                details=self.circuit_breakers[name].to_dict(),
            )
        
        try:
            # Try to import and check Prisma/SQLite
            import sqlite3
            
            # Check if database file exists
            db_path = "/home/z/my-project/db/custom.db"
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                conn.close()
                
                latency = (time.time() - start_time) * 1000
                self.circuit_breakers[name].record_success()
                
                return HealthCheckResult(
                    name=name,
                    status=HealthStatus.HEALTHY,
                    latency_ms=latency,
                    message="Database connection successful",
                    details={"path": db_path},
                )
            else:
                self.circuit_breakers[name].record_failure()
                return HealthCheckResult(
                    name=name,
                    status=HealthStatus.DEGRADED,
                    message="Database file not found - using memory fallback",
                )
                
        except Exception as e:
            self.circuit_breakers[name].record_failure()
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.UNHEALTHY,
                latency_ms=latency,
                message=f"Database check failed: {str(e)}",
                details={"error": str(e)},
            )
    
    async def check_pinecone(self) -> HealthCheckResult:
        """Check Pinecone index health."""
        start_time = time.time()
        name = "pinecone"
        
        # Check circuit breaker
        if not self.circuit_breakers[name].should_allow_request():
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                message="Circuit breaker OPEN - using fallback retrieval",
                details=self.circuit_breakers[name].to_dict(),
            )
        
        try:
            # Check if API key is configured
            if not self.settings.PINECONE_API_KEY:
                return HealthCheckResult(
                    name=name,
                    status=HealthStatus.DEGRADED,
                    message="Pinecone API key not configured",
                )
            
            # Try to connect to Pinecone
            from pinecone import Pinecone
            
            pc = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            index = pc.Index(self.settings.PINECONE_INDEX_NAME)
            
            # Get index stats
            stats = index.describe_index_stats()
            
            latency = (time.time() - start_time) * 1000
            self.circuit_breakers[name].record_success()
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.HEALTHY,
                latency_ms=latency,
                message="Pinecone index accessible",
                details={
                    "index_name": self.settings.PINECONE_INDEX_NAME,
                    "total_vectors": stats.get("total_vector_count", 0),
                    "dimension": stats.get("dimension", 768),
                },
            )
            
        except ImportError:
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                message="Pinecone package not installed",
            )
        except Exception as e:
            self.circuit_breakers[name].record_failure()
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                latency_ms=latency,
                message=f"Pinecone check failed: {str(e)}",
                details={"error": str(e)},
            )
    
    async def check_llm_api(self) -> HealthCheckResult:
        """Check LLM API availability."""
        start_time = time.time()
        name = "llm"
        
        # Check circuit breaker
        if not self.circuit_breakers[name].should_allow_request():
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                message="Circuit breaker OPEN - LLM unavailable",
                details=self.circuit_breakers[name].to_dict(),
            )
        
        try:
            import httpx
            
            # Check Z.AI API availability
            if self.settings.ZAI_API_KEY:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        "https://open.bigmodel.cn/api/paas/v4/models",
                        headers={"Authorization": f"Bearer {self.settings.ZAI_API_KEY}"},
                    )
                    
                    latency = (time.time() - start_time) * 1000
                    self.circuit_breakers[name].record_success()
                    
                    if response.status_code == 200:
                        return HealthCheckResult(
                            name=name,
                            status=HealthStatus.HEALTHY,
                            latency_ms=latency,
                            message="LLM API accessible",
                            details={"provider": "Z.AI"},
                        )
                    else:
                        return HealthCheckResult(
                            name=name,
                            status=HealthStatus.DEGRADED,
                            latency_ms=latency,
                            message=f"LLM API returned status {response.status_code}",
                        )
            else:
                return HealthCheckResult(
                    name=name,
                    status=HealthStatus.DEGRADED,
                    message="LLM API key not configured",
                )
                
        except Exception as e:
            self.circuit_breakers[name].record_failure()
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                latency_ms=latency,
                message=f"LLM API check failed: {str(e)}",
                details={"error": str(e)},
            )
    
    async def check_embedding_model(self) -> HealthCheckResult:
        """Check embedding model status."""
        start_time = time.time()
        name = "embedding"
        
        # Check circuit breaker
        if not self.circuit_breakers[name].should_allow_request():
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                message="Circuit breaker OPEN - embeddings unavailable",
                details=self.circuit_breakers[name].to_dict(),
            )
        
        try:
            from sentence_transformers import SentenceTransformer
            
            # Check if model can be loaded (lazy check)
            model_name = "all-mpnet-base-v2"
            
            # Simple test - model should load quickly if cached
            model = SentenceTransformer(model_name)
            
            latency = (time.time() - start_time) * 1000
            self.circuit_breakers[name].record_success()
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.HEALTHY,
                latency_ms=latency,
                message="Embedding model ready",
                details={"model": model_name, "dimension": 768},
            )
            
        except ImportError:
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                message="Sentence transformers not installed",
            )
        except Exception as e:
            self.circuit_breakers[name].record_failure()
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.DEGRADED,
                latency_ms=latency,
                message=f"Embedding model check failed: {str(e)}",
                details={"error": str(e)},
            )
    
    async def check_system_resources(self) -> HealthCheckResult:
        """Check system memory and CPU usage."""
        start_time = time.time()
        
        try:
            import psutil
            
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Get CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Get disk usage
            disk = psutil.disk_usage("/")
            disk_percent = disk.percent
            
            # Determine status based on resource usage
            status = HealthStatus.HEALTHY
            messages = []
            
            if memory_percent > 90:
                status = HealthStatus.UNHEALTHY
                messages.append("Critical memory usage")
            elif memory_percent > 80:
                status = HealthStatus.DEGRADED
                messages.append("High memory usage")
            
            if cpu_percent > 90:
                status = HealthStatus.UNHEALTHY
                messages.append("Critical CPU usage")
            elif cpu_percent > 80:
                if status == HealthStatus.HEALTHY:
                    status = HealthStatus.DEGRADED
                messages.append("High CPU usage")
            
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name="system_resources",
                status=status,
                latency_ms=latency,
                message="; ".join(messages) if messages else "System resources normal",
                details={
                    "memory_percent": round(memory_percent, 1),
                    "memory_available_gb": round(memory.available / (1024**3), 2),
                    "cpu_percent": round(cpu_percent, 1),
                    "disk_percent": round(disk_percent, 1),
                },
            )
            
        except ImportError:
            # psutil not available, return basic status
            return HealthCheckResult(
                name="system_resources",
                status=HealthStatus.UNKNOWN,
                message="psutil not available for resource monitoring",
            )
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                name="system_resources",
                status=HealthStatus.UNKNOWN,
                latency_ms=latency,
                message=f"Resource check failed: {str(e)}",
            )
    
    async def check_ready(self) -> bool:
        """Check if service is ready to accept requests."""
        health = await self.check_all()
        return health.status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED]
    
    async def check_live(self) -> bool:
        """Check if service is alive (liveness probe)."""
        # Simple liveness check - service is running
        return True
    
    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get all circuit breaker statuses."""
        return {
            name: cb.to_dict()
            for name, cb in self.circuit_breakers.items()
        }
    
    def reset_circuit_breaker(self, name: str) -> bool:
        """Reset a specific circuit breaker."""
        if name in self.circuit_breakers:
            self.circuit_breakers[name].reset()
            return True
        return False


# Singleton instance
_health_probe: Optional[DeepHealthProbe] = None


def get_health_probe() -> DeepHealthProbe:
    """Get or create health probe singleton."""
    global _health_probe
    
    if _health_probe is None:
        _health_probe = DeepHealthProbe()
    
    return _health_probe


async def run_health_checks() -> SystemHealth:
    """Convenience function to run all health checks."""
    probe = get_health_probe()
    return await probe.check_all()
