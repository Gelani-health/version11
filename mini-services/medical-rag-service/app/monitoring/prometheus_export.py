"""
P2: Prometheus Metrics Export for Clinical Decision Support System
==================================================================

Exports metrics in Prometheus format for monitoring:
- Request counts and latencies
- Diagnosis accuracy metrics
- Safety alert effectiveness
- Cache performance
- LLM token usage
- Retrieval precision

Endpoint: GET /metrics
"""

import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import threading

from loguru import logger


class MetricType(Enum):
    """Prometheus metric types."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricValue:
    """Single metric value with labels."""
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: Optional[float] = None


@dataclass
class Metric:
    """Prometheus metric definition."""
    name: str
    metric_type: MetricType
    description: str
    values: List[MetricValue] = field(default_factory=list)
    buckets: Optional[List[float]] = None  # For histograms


class ClinicalMetricsRegistry:
    """
    P2: Prometheus metrics registry for Clinical Decision Support System.
    
    Metrics Categories:
    1. Request Metrics - counts, latencies, errors
    2. Diagnosis Metrics - accuracy, confidence distributions
    3. Safety Metrics - alerts triggered, escalations
    4. Retrieval Metrics - precision, recall, relevance scores
    5. Cache Metrics - hit rate, evictions
    6. LLM Metrics - token usage, latency by model
    """
    
    # Metric name prefixes
    PREFIX = "gelani_cds_"
    
    def __init__(self):
        self._metrics: Dict[str, Metric] = {}
        self._lock = threading.Lock()
        self._initialized = False
        
        # Initialize default metrics
        self._init_default_metrics()
    
    def _init_default_metrics(self):
        """Initialize default CDS metrics."""
        
        # Request Metrics
        self._register_metric(
            name="http_requests_total",
            metric_type=MetricType.COUNTER,
            description="Total number of HTTP requests",
        )
        
        self._register_metric(
            name="http_request_duration_seconds",
            metric_type=MetricType.HISTOGRAM,
            description="HTTP request latency in seconds",
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        )
        
        self._register_metric(
            name="http_requests_errors_total",
            metric_type=MetricType.COUNTER,
            description="Total number of HTTP request errors",
        )
        
        # Diagnosis Metrics
        self._register_metric(
            name="diagnoses_total",
            metric_type=MetricType.COUNTER,
            description="Total number of diagnosis requests",
        )
        
        self._register_metric(
            name="diagnosis_confidence_score",
            metric_type=MetricType.HISTOGRAM,
            description="Distribution of diagnosis confidence scores",
            buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        )
        
        self._register_metric(
            name="diagnosis_latency_seconds",
            metric_type=MetricType.HISTOGRAM,
            description="Diagnosis generation latency",
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],
        )
        
        self._register_metric(
            name="diagnosis_articles_retrieved",
            metric_type=MetricType.HISTOGRAM,
            description="Number of articles retrieved per diagnosis",
            buckets=[0, 5, 10, 20, 30, 50, 100],
        )
        
        # Safety Metrics
        self._register_metric(
            name="safety_alerts_total",
            metric_type=MetricType.COUNTER,
            description="Total number of safety alerts triggered",
        )
        
        self._register_metric(
            name="safety_blocks_total",
            metric_type=MetricType.COUNTER,
            description="Total number of responses blocked by safety checks",
        )
        
        self._register_metric(
            name="emergency_escalations_total",
            metric_type=MetricType.COUNTER,
            description="Total number of emergency escalations",
        )
        
        self._register_metric(
            name="drug_interactions_detected_total",
            metric_type=MetricType.COUNTER,
            description="Total number of drug interactions detected",
        )
        
        self._register_metric(
            name="allergy_conflicts_detected_total",
            metric_type=MetricType.COUNTER,
            description="Total number of allergy conflicts detected",
        )
        
        # Retrieval Metrics
        self._register_metric(
            name="retrieval_queries_total",
            metric_type=MetricType.COUNTER,
            description="Total number of RAG retrieval queries",
        )
        
        self._register_metric(
            name="retrieval_latency_seconds",
            metric_type=MetricType.HISTOGRAM,
            description="RAG retrieval latency in seconds",
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
        )
        
        self._register_metric(
            name="retrieval_relevance_score",
            metric_type=MetricType.HISTOGRAM,
            description="Distribution of retrieval relevance scores",
            buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        )
        
        self._register_metric(
            name="fallback_chain_activations_total",
            metric_type=MetricType.COUNTER,
            description="Total number of fallback chain activations by stage",
        )
        
        # Cache Metrics
        self._register_metric(
            name="cache_hits_total",
            metric_type=MetricType.COUNTER,
            description="Total number of cache hits",
        )
        
        self._register_metric(
            name="cache_misses_total",
            metric_type=MetricType.COUNTER,
            description="Total number of cache misses",
        )
        
        self._register_metric(
            name="cache_evictions_total",
            metric_type=MetricType.COUNTER,
            description="Total number of cache evictions",
        )
        
        self._register_metric(
            name="cache_size",
            metric_type=MetricType.GAUGE,
            description="Current cache size",
        )
        
        # LLM Metrics
        self._register_metric(
            name="llm_requests_total",
            metric_type=MetricType.COUNTER,
            description="Total number of LLM API requests",
        )
        
        self._register_metric(
            name="llm_tokens_used_total",
            metric_type=MetricType.COUNTER,
            description="Total number of tokens used",
        )
        
        self._register_metric(
            name="llm_latency_seconds",
            metric_type=MetricType.HISTOGRAM,
            description="LLM API latency in seconds",
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
        )
        
        self._register_metric(
            name="llm_errors_total",
            metric_type=MetricType.COUNTER,
            description="Total number of LLM API errors",
        )
        
        # Embedding Metrics
        self._register_metric(
            name="embeddings_generated_total",
            metric_type=MetricType.COUNTER,
            description="Total number of embeddings generated",
        )
        
        self._register_metric(
            name="embedding_latency_seconds",
            metric_type=MetricType.HISTOGRAM,
            description="Embedding generation latency",
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0],
        )
        
        # System Metrics
        self._register_metric(
            name="uptime_seconds",
            metric_type=MetricType.GAUGE,
            description="Service uptime in seconds",
        )
        
        self._register_metric(
            name="active_connections",
            metric_type=MetricType.GAUGE,
            description="Number of active connections",
        )
        
        self._initialized = True
        logger.info("[Metrics] Prometheus metrics registry initialized")
    
    def _register_metric(
        self,
        name: str,
        metric_type: MetricType,
        description: str,
        buckets: Optional[List[float]] = None,
    ):
        """Register a new metric."""
        full_name = f"{self.PREFIX}{name}"
        self._metrics[full_name] = Metric(
            name=full_name,
            metric_type=metric_type,
            description=description,
            buckets=buckets,
        )
    
    def inc(self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None):
        """Increment a counter metric."""
        full_name = f"{self.PREFIX}{name}"
        
        with self._lock:
            if full_name not in self._metrics:
                logger.warning(f"[Metrics] Unknown metric: {full_name}")
                return
            
            metric = self._metrics[full_name]
            
            # Find existing value with same labels
            labels = labels or {}
            for mv in metric.values:
                if mv.labels == labels:
                    mv.value += value
                    return
            
            # Create new value
            metric.values.append(MetricValue(value=value, labels=labels))
    
    def observe(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Observe a value for histogram/summary metrics."""
        full_name = f"{self.PREFIX}{name}"
        
        with self._lock:
            if full_name not in self._metrics:
                logger.warning(f"[Metrics] Unknown metric: {full_name}")
                return
            
            metric = self._metrics[full_name]
            labels = labels or {}
            
            metric.values.append(MetricValue(
                value=value,
                labels=labels,
                timestamp=time.time(),
            ))
    
    def set(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Set a gauge metric value."""
        full_name = f"{self.PREFIX}{name}"
        
        with self._lock:
            if full_name not in self._metrics:
                logger.warning(f"[Metrics] Unknown metric: {full_name}")
                return
            
            metric = self._metrics[full_name]
            labels = labels or {}
            
            # Find existing value with same labels
            for mv in metric.values:
                if mv.labels == labels:
                    mv.value = value
                    return
            
            # Create new value
            metric.values.append(MetricValue(value=value, labels=labels))
    
    def timing(self, name: str, labels: Optional[Dict[str, str]] = None):
        """Context manager for timing operations."""
        class TimingContext:
            def __init__(ctx, registry, metric_name, lbls):
                ctx.registry = registry
                ctx.metric_name = metric_name
                ctx.labels = lbls
                ctx.start_time = None
            
            def __enter__(ctx):
                ctx.start_time = time.time()
                return ctx
            
            def __exit__(ctx, *args):
                duration = time.time() - ctx.start_time
                ctx.registry.observe(ctx.metric_name, duration, ctx.labels)
        
        return TimingContext(self, name, labels)
    
    def export(self) -> str:
        """Export metrics in Prometheus text format."""
        lines = []
        
        with self._lock:
            for name, metric in sorted(self._metrics.items()):
                # Add HELP and TYPE comments
                lines.append(f"# HELP {name} {metric.description}")
                lines.append(f"# TYPE {name} {metric.metric_type.value}")
                
                # Add metric values
                for mv in metric.values:
                    label_str = ""
                    if mv.labels:
                        label_pairs = [f'{k}="{v}"' for k, v in mv.labels.items()]
                        label_str = "{" + ", ".join(label_pairs) + "}"
                    
                    lines.append(f"{name}{label_str} {mv.value}")
                
                lines.append("")  # Empty line between metrics
        
        return "\n".join(lines)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get metrics summary as dictionary."""
        stats = {
            "metrics_count": len(self._metrics),
            "metrics": {},
        }
        
        with self._lock:
            for name, metric in self._metrics.items():
                values = [(mv.labels, mv.value) for mv in metric.values]
                stats["metrics"][name] = {
                    "type": metric.metric_type.value,
                    "description": metric.description,
                    "values_count": len(values),
                }
        
        return stats


# Singleton registry
_registry: Optional[ClinicalMetricsRegistry] = None


def get_metrics_registry() -> ClinicalMetricsRegistry:
    """Get or create metrics registry singleton."""
    global _registry
    
    if _registry is None:
        _registry = ClinicalMetricsRegistry()
    
    return _registry


# Convenience functions
def inc_counter(name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None):
    """Increment a counter metric."""
    registry = get_metrics_registry()
    registry.inc(name, value, labels)


def observe_histogram(name: str, value: float, labels: Optional[Dict[str, str]] = None):
    """Observe a value for histogram."""
    registry = get_metrics_registry()
    registry.observe(name, value, labels)


def set_gauge(name: str, value: float, labels: Optional[Dict[str, str]] = None):
    """Set a gauge metric."""
    registry = get_metrics_registry()
    registry.set(name, value, labels)


def export_prometheus_metrics() -> str:
    """Export all metrics in Prometheus format."""
    registry = get_metrics_registry()
    return registry.export()


# Decorator for timing functions
def timed(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """Decorator to time function execution."""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            registry = get_metrics_registry()
            with registry.timing(metric_name, labels):
                return await func(*args, **kwargs)
        
        def sync_wrapper(*args, **kwargs):
            registry = get_metrics_registry()
            start = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start
            registry.observe(metric_name, duration, labels)
            return result
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator
