"""
Monitoring Module
=================

P1 Additions:
- Performance Monitor with latency alerting
"""

from app.monitoring.health_probes import DeepHealthProbe, get_health_probe
from app.monitoring.prometheus_export import export_prometheus_metrics

# P1: Performance Monitor
try:
    from app.monitoring.performance_monitor import (
        PerformanceMonitor,
        PerformanceAlert,
        get_performance_monitor,
    )
except ImportError:
    # Fallback if performance_monitor has import issues
    PerformanceMonitor = None
    PerformanceAlert = None
    get_performance_monitor = None

__all__ = [
    "DeepHealthProbe",
    "get_health_probe",
    "export_prometheus_metrics",
    "PerformanceMonitor",
    "PerformanceAlert",
    "get_performance_monitor",
]
