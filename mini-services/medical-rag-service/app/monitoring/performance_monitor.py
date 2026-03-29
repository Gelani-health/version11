"""
P1: Query Performance Monitoring with Latency Alerting
======================================================

Real-time performance monitoring for clinical decision support queries.
Includes latency tracking, alerting on threshold violations, and trend analysis.

Features:
- Latency tracking per endpoint
- Configurable alerting thresholds
- Statistical analysis (p50, p95, p99)
- Alert notifications via multiple channels
- Performance trend visualization data
"""

import asyncio
import time
import statistics
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict, deque
import json

# Handle both relative and absolute imports
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class MetricType(str, Enum):
    """Types of metrics tracked."""
    LATENCY = "latency"
    THROUGHPUT = "throughput"
    ERROR_RATE = "error_rate"
    CACHE_HIT_RATE = "cache_hit_rate"
    QUERY_COUNT = "query_count"


@dataclass
class PerformanceMetric:
    """Individual performance metric."""
    metric_type: MetricType
    value: float
    endpoint: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric_type": self.metric_type.value,
            "value": self.value,
            "endpoint": self.endpoint,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class PerformanceAlert:
    """Performance alert triggered by threshold violation."""
    alert_id: str
    severity: AlertSeverity
    metric_type: MetricType
    endpoint: str
    current_value: float
    threshold: float
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "severity": self.severity.value,
            "metric_type": self.metric_type.value,
            "endpoint": self.endpoint,
            "current_value": self.current_value,
            "threshold": self.threshold,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "acknowledged": self.acknowledged,
            "acknowledged_by": self.acknowledged_by,
        }


@dataclass
class EndpointStats:
    """Statistics for a single endpoint."""
    endpoint: str
    total_requests: int = 0
    total_errors: int = 0
    total_latency_ms: float = 0.0
    latencies: deque = field(default_factory=lambda: deque(maxlen=1000))
    errors: deque = field(default_factory=lambda: deque(maxlen=100))
    last_request_time: Optional[datetime] = None

    @property
    def avg_latency_ms(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_latency_ms / self.total_requests

    @property
    def error_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_errors / self.total_requests

    def p50_latency(self) -> float:
        if not self.latencies:
            return 0.0
        return statistics.median(list(self.latencies))

    def p95_latency(self) -> float:
        if len(self.latencies) < 20:
            return 0.0
        sorted_latencies = sorted(self.latencies)
        index = int(len(sorted_latencies) * 0.95)
        return sorted_latencies[index]

    def p99_latency(self) -> float:
        if len(self.latencies) < 100:
            return 0.0
        sorted_latencies = sorted(self.latencies)
        index = int(len(sorted_latencies) * 0.99)
        return sorted_latencies[index]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "endpoint": self.endpoint,
            "total_requests": self.total_requests,
            "total_errors": self.total_errors,
            "error_rate": f"{self.error_rate:.2%}",
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "p50_latency_ms": round(self.p50_latency(), 2),
            "p95_latency_ms": round(self.p95_latency(), 2),
            "p99_latency_ms": round(self.p99_latency(), 2),
            "last_request_time": self.last_request_time.isoformat() if self.last_request_time else None,
        }


class PerformanceMonitor:
    """
    P1: Real-time performance monitoring with alerting.

    Monitors query latency, error rates, and throughput across all endpoints.
    Triggers alerts when thresholds are exceeded.

    Usage:
        monitor = PerformanceMonitor()

        # Track a query
        with monitor.track_request("/api/v1/query"):
            # ... handle request ...

        # Get stats
        stats = monitor.get_endpoint_stats("/api/v1/query")
    """

    # Default latency thresholds (in milliseconds)
    DEFAULT_THRESHOLDS = {
        "latency_warning": 500,  # ms
        "latency_critical": 1000,  # ms
        "latency_emergency": 2000,  # ms
        "error_rate_warning": 0.05,  # 5%
        "error_rate_critical": 0.10,  # 10%
        "error_rate_emergency": 0.25,  # 25%
    }

    # Critical endpoints requiring stricter monitoring
    CRITICAL_ENDPOINTS = [
        "/api/v1/diagnose",
        "/api/v1/safety/check",
        "/api/v1/alerts/create",
    ]

    def __init__(
        self,
        thresholds: Optional[Dict[str, float]] = None,
        alert_handlers: Optional[List[Callable]] = None,
    ):
        self.thresholds = {**self.DEFAULT_THRESHOLDS, **(thresholds or {})}
        self.alert_handlers = alert_handlers or []

        # Storage
        self._endpoint_stats: Dict[str, EndpointStats] = defaultdict(
            lambda: EndpointStats(endpoint="unknown")
        )
        self._alerts: deque = deque(maxlen=1000)
        self._active_alerts: Dict[str, PerformanceAlert] = {}

        # Alert counters
        self._alert_counter = 0

        # Start background monitoring task
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """Start the performance monitor."""
        if self._running:
            return

        self._running = True
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("[PerformanceMonitor] Started monitoring")

    async def stop(self):
        """Stop the performance monitor."""
        self._running = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info("[PerformanceMonitor] Stopped monitoring")

    def track_request(self, endpoint: str) -> "RequestTracker":
        """
        Context manager for tracking request performance.

        Usage:
            with monitor.track_request("/api/v1/query") as tracker:
                # ... handle request ...
                tracker.set_metadata({"query_length": 100})
        """
        return RequestTracker(self, endpoint)

    def record_latency(
        self,
        endpoint: str,
        latency_ms: float,
        error: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Record a latency measurement for an endpoint."""
        stats = self._endpoint_stats[endpoint]
        stats.endpoint = endpoint
        stats.total_requests += 1
        stats.total_latency_ms += latency_ms
        stats.latencies.append(latency_ms)
        stats.last_request_time = datetime.utcnow()

        if error:
            stats.total_errors += 1
            stats.errors.append({
                "timestamp": datetime.utcnow().isoformat(),
                "latency_ms": latency_ms,
                "metadata": metadata or {},
            })

        # Check thresholds
        self._check_thresholds(endpoint, latency_ms, stats.error_rate)

    def _check_thresholds(
        self,
        endpoint: str,
        latency_ms: float,
        error_rate: float,
    ):
        """Check if metrics exceed thresholds and trigger alerts."""
        # Stricter thresholds for critical endpoints
        multiplier = 0.5 if endpoint in self.CRITICAL_ENDPOINTS else 1.0

        # Check latency thresholds
        if latency_ms >= self.thresholds["latency_emergency"] * multiplier:
            self._create_alert(
                severity=AlertSeverity.EMERGENCY,
                metric_type=MetricType.LATENCY,
                endpoint=endpoint,
                current_value=latency_ms,
                threshold=self.thresholds["latency_emergency"] * multiplier,
                message=f"EMERGENCY: {endpoint} latency {latency_ms:.0f}ms exceeds emergency threshold",
            )
        elif latency_ms >= self.thresholds["latency_critical"] * multiplier:
            self._create_alert(
                severity=AlertSeverity.CRITICAL,
                metric_type=MetricType.LATENCY,
                endpoint=endpoint,
                current_value=latency_ms,
                threshold=self.thresholds["latency_critical"] * multiplier,
                message=f"CRITICAL: {endpoint} latency {latency_ms:.0f}ms exceeds critical threshold",
            )
        elif latency_ms >= self.thresholds["latency_warning"] * multiplier:
            self._create_alert(
                severity=AlertSeverity.WARNING,
                metric_type=MetricType.LATENCY,
                endpoint=endpoint,
                current_value=latency_ms,
                threshold=self.thresholds["latency_warning"] * multiplier,
                message=f"WARNING: {endpoint} latency {latency_ms:.0f}ms exceeds warning threshold",
            )

        # Check error rate thresholds (only if enough samples)
        stats = self._endpoint_stats[endpoint]
        if stats.total_requests >= 10:
            if error_rate >= self.thresholds["error_rate_emergency"]:
                self._create_alert(
                    severity=AlertSeverity.EMERGENCY,
                    metric_type=MetricType.ERROR_RATE,
                    endpoint=endpoint,
                    current_value=error_rate,
                    threshold=self.thresholds["error_rate_emergency"],
                    message=f"EMERGENCY: {endpoint} error rate {error_rate:.1%} exceeds emergency threshold",
                )
            elif error_rate >= self.thresholds["error_rate_critical"]:
                self._create_alert(
                    severity=AlertSeverity.CRITICAL,
                    metric_type=MetricType.ERROR_RATE,
                    endpoint=endpoint,
                    current_value=error_rate,
                    threshold=self.thresholds["error_rate_critical"],
                    message=f"CRITICAL: {endpoint} error rate {error_rate:.1%} exceeds critical threshold",
                )
            elif error_rate >= self.thresholds["error_rate_warning"]:
                self._create_alert(
                    severity=AlertSeverity.WARNING,
                    metric_type=MetricType.ERROR_RATE,
                    endpoint=endpoint,
                    current_value=error_rate,
                    threshold=self.thresholds["error_rate_warning"],
                    message=f"WARNING: {endpoint} error rate {error_rate:.1%} exceeds warning threshold",
                )

    def _create_alert(
        self,
        severity: AlertSeverity,
        metric_type: MetricType,
        endpoint: str,
        current_value: float,
        threshold: float,
        message: str,
    ) -> PerformanceAlert:
        """Create and dispatch a performance alert."""
        self._alert_counter += 1
        alert_id = f"perf_alert_{self._alert_counter}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        alert = PerformanceAlert(
            alert_id=alert_id,
            severity=severity,
            metric_type=metric_type,
            endpoint=endpoint,
            current_value=current_value,
            threshold=threshold,
            message=message,
        )

        self._alerts.append(alert)

        # Store active alerts for critical/emergency
        if severity in [AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY]:
            self._active_alerts[alert_id] = alert

        # Log alert
        if severity == AlertSeverity.EMERGENCY:
            logger.error(f"[PerformanceMonitor] {message}")
        elif severity == AlertSeverity.CRITICAL:
            logger.error(f"[PerformanceMonitor] {message}")
        elif severity == AlertSeverity.WARNING:
            logger.warning(f"[PerformanceMonitor] {message}")
        else:
            logger.info(f"[PerformanceMonitor] {message}")

        # Dispatch to handlers
        for handler in self.alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"[PerformanceMonitor] Alert handler error: {e}")

        return alert

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> Optional[PerformanceAlert]:
        """Acknowledge an active alert."""
        if alert_id in self._active_alerts:
            alert = self._active_alerts[alert_id]
            alert.acknowledged = True
            alert.acknowledged_by = acknowledged_by
            del self._active_alerts[alert_id]
            logger.info(f"[PerformanceMonitor] Alert {alert_id} acknowledged by {acknowledged_by}")
            return alert
        return None

    def get_endpoint_stats(self, endpoint: str) -> Dict[str, Any]:
        """Get statistics for a specific endpoint."""
        if endpoint in self._endpoint_stats:
            return self._endpoint_stats[endpoint].to_dict()
        return {"endpoint": endpoint, "error": "No data available"}

    def get_all_stats(self) -> Dict[str, Any]:
        """Get statistics for all endpoints."""
        return {
            "endpoints": {
                endpoint: stats.to_dict()
                for endpoint, stats in self._endpoint_stats.items()
            },
            "total_endpoints": len(self._endpoint_stats),
            "thresholds": self.thresholds,
            "critical_endpoints": self.CRITICAL_ENDPOINTS,
        }

    def get_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get recent alerts, optionally filtered by severity."""
        alerts = list(self._alerts)

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        return [a.to_dict() for a in alerts[-limit:]]

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get all active (unacknowledged) alerts."""
        return [a.to_dict() for a in self._active_alerts.values()]

    def get_latency_trends(
        self,
        endpoint: str,
        minutes: int = 60,
    ) -> Dict[str, Any]:
        """Get latency trends for an endpoint over time."""
        stats = self._endpoint_stats.get(endpoint)
        if not stats:
            return {"error": "No data for endpoint"}

        latencies = list(stats.latencies)
        if not latencies:
            return {"error": "No latency data available"}

        # Calculate percentiles for trend analysis
        return {
            "endpoint": endpoint,
            "period_minutes": minutes,
            "sample_count": len(latencies),
            "min_latency_ms": round(min(latencies), 2),
            "max_latency_ms": round(max(latencies), 2),
            "avg_latency_ms": round(statistics.mean(latencies), 2),
            "std_dev_ms": round(statistics.stdev(latencies), 2) if len(latencies) > 1 else 0,
            "p50_latency_ms": round(statistics.median(latencies), 2),
            "p95_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2) if len(latencies) >= 20 else 0,
            "p99_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.99)], 2) if len(latencies) >= 100 else 0,
        }

    async def _monitoring_loop(self):
        """Background monitoring task."""
        while self._running:
            try:
                # Generate periodic health reports
                await self._generate_health_report()
                await asyncio.sleep(60)  # Check every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[PerformanceMonitor] Monitoring loop error: {e}")
                await asyncio.sleep(5)

    async def _generate_health_report(self):
        """Generate periodic health report."""
        all_stats = self.get_all_stats()
        active_alerts = self.get_active_alerts()

        # Log summary
        total_requests = sum(
            s["total_requests"]
            for s in all_stats["endpoints"].values()
        )

        if total_requests > 0:
            logger.info(
                f"[PerformanceMonitor] Health Report: "
                f"{total_requests} total requests, "
                f"{len(active_alerts)} active alerts, "
                f"{len(all_stats['endpoints'])} endpoints monitored"
            )


class RequestTracker:
    """Context manager for tracking individual requests."""

    def __init__(self, monitor: PerformanceMonitor, endpoint: str):
        self.monitor = monitor
        self.endpoint = endpoint
        self.start_time: Optional[float] = None
        self.metadata: Dict[str, Any] = {}
        self._error = False

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        latency_ms = (time.time() - self.start_time) * 1000 if self.start_time else 0
        self._error = exc_type is not None
        self.monitor.record_latency(
            self.endpoint,
            latency_ms,
            error=self._error,
            metadata=self.metadata,
        )
        return False  # Don't suppress exceptions

    def set_metadata(self, metadata: Dict[str, Any]):
        """Add metadata to the request tracking."""
        self.metadata.update(metadata)

    def mark_error(self):
        """Mark the request as errored."""
        self._error = True


# Singleton instance
_performance_monitor: Optional[PerformanceMonitor] = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get the performance monitor singleton."""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitor()
    return _performance_monitor


async def start_performance_monitoring():
    """Start the performance monitoring system."""
    monitor = get_performance_monitor()
    await monitor.start()
    return monitor
