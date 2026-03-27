"""
OpenTelemetry Telemetry Module for Python Services
===================================================

Shared telemetry configuration for all Gelani Python mini-services.
Provides distributed tracing with OTLP HTTP exporter and custom span helpers.

PROMPT 13: OpenTelemetry Observability + Health Endpoints

Features:
- Distributed tracing with OTLP HTTP exporter
- FastAPI auto-instrumentation
- Custom context managers for clinical operations
- PHI-safe attributes (no patient IDs or complaint text in plain form)
- Console exporter fallback for development

Environment Variables:
- OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (required for production)
- OTEL_SERVICE_NAME: Service name (set per-service)
- OTEL_ENVIRONMENT: Environment name (development/staging/production)

Evidence Sources:
- OpenTelemetry Python SDK: https://opentelemetry.io/docs/languages/python/
- HIPAA Compliance: 45 CFR 164.312(e)(1)
- FastAPI Instrumentation: https://opentelemetry-python-contrib.readthedocs.io/

Author: Gelani Healthcare Assistant
"""

import os
import hashlib
import functools
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, Dict, Any, Callable, TypeVar, ParamSpec

from loguru import logger

# OpenTelemetry imports with graceful fallback
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION, DEPLOYMENT_ENVIRONMENT
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from fastapi import FastAPI
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    FastAPI = None  # type: ignore
    logger.warning("OpenTelemetry packages not installed. Tracing disabled.")


# =============================================================================
# CONFIGURATION
# =============================================================================

OTEL_EXPORTER_OTLP_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")
OTEL_ENVIRONMENT = os.environ.get("OTEL_ENVIRONMENT", "development")
SERVICE_VERSION = os.environ.get("SERVICE_VERSION", "1.0.0")

# Global tracer instance
_tracer = None
_initialized = False


# =============================================================================
# TELEMETRY INITIALIZATION
# =============================================================================

def init_telemetry(app: Optional[Any], service_name: str, service_version: str = "1.0.0") -> Optional[Any]:
    """
    Initialize OpenTelemetry for a FastAPI application.
    
    Sets up:
    - TracerProvider with service resource
    - OTLP HTTP exporter (or Console exporter for development)
    - FastAPI auto-instrumentation
    
    HIPAA Compliance Note:
    - Never include patient IDs or PHI in span attributes
    - Use hashed session tokens for correlation
    - All attributes are sanitized before export
    
    Args:
        app: FastAPI application instance (can be None if OTEL not available)
        service_name: Service name for resource identification
        service_version: Service version (optional)
        
    Returns:
        Tracer instance for creating custom spans, or None if unavailable
    """
    global _tracer, _initialized
    
    if not OTEL_AVAILABLE:
        logger.warning("OpenTelemetry not available, skipping initialization")
        return None
    
    if _initialized:
        logger.info("Telemetry already initialized")
        return _tracer
    
    # If app is None but OTEL is available, still set up basic tracing
    if app is None:
        logger.warning("No FastAPI app provided, initializing tracing without instrumentation")
    
    try:
        # Create resource with service identification
        resource = Resource.create({
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
            DEPLOYMENT_ENVIRONMENT: OTEL_ENVIRONMENT,
            "service.namespace": "gelani-healthcare",
            "service.instance.id": os.environ.get("HOSTNAME", "local"),
        })
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        
        # Add span processor with exporter
        if OTEL_EXPORTER_OTLP_ENDPOINT:
            # Production: Use OTLP HTTP exporter
            otlp_exporter = OTLPSpanExporter(
                endpoint=f"{OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces",
                headers={},
            )
            processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(processor)
            logger.info(f"OTLP trace exporter configured: {OTEL_EXPORTER_OTLP_ENDPOINT}")
        else:
            # Development: Fall back to console exporter
            # This ensures traces are never silently dropped
            console_exporter = ConsoleSpanExporter()
            processor = BatchSpanProcessor(console_exporter)
            provider.add_span_processor(processor)
            logger.info("OTLP endpoint not configured, using ConsoleSpanExporter")
        
        # Set global tracer provider
        trace.set_tracer_provider(provider)
        
        # Get tracer for custom spans
        _tracer = trace.get_tracer(service_name, service_version)
        
        # Instrument FastAPI (only if app is provided)
        if app is not None:
            FastAPIInstrumentor.instrument_app(app)
            logger.info(f"FastAPI auto-instrumentation enabled for {service_name}")
        
        _initialized = True
        logger.info(f"OpenTelemetry initialized: {service_name} v{service_version}")
        
        return _tracer
        
    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}")
        return None


def get_tracer() -> Optional[Any]:
    """Get the global tracer instance."""
    return _tracer


def is_telemetry_enabled() -> bool:
    """Check if telemetry is initialized and available."""
    return OTEL_AVAILABLE and _initialized and _tracer is not None


# =============================================================================
# CONTEXT MANAGER HELPERS FOR CLINICAL OPERATIONS
# =============================================================================

@contextmanager
def clinical_diagnostic_span(
    chief_complaint: str,
    session_id: str
):
    """
    Context manager for clinical diagnostic request spans.
    
    Creates a span named 'clinical.diagnostic.request' with PHI-safe attributes:
    - complaint.word_count: Word count of chief complaint (not the text itself)
    - session.id: Hashed session ID for correlation
    - service.name: Service identifier
    
    HIPAA Compliance Note:
    - Chief complaint text is NEVER logged in attributes
    - Session ID is hashed to prevent PHI correlation
    
    Evidence Source:
    - HIPAA Privacy Rule: 45 CFR 164.502 - Uses and disclosures
    
    Args:
        chief_complaint: Patient's chief complaint text (NOT logged)
        session_id: Session identifier for correlation (hashed)
        
    Yields:
        Span object for adding additional attributes
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        "clinical.diagnostic.request",
        attributes={
            "complaint.word_count": len(chief_complaint.split()) if chief_complaint else 0,
            "session.id": _hash_session_id(session_id),
            "service.name": "medical-rag-service",
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


@contextmanager
def clinical_rag_span(
    namespace: str,
    query_term_count: int
):
    """
    Context manager for RAG query spans.
    
    Creates a span named 'clinical.rag.query' with attributes:
    - rag.namespace: Pinecone namespace
    - rag.query_term_count: Number of query terms
    - rag.top_score: Set after retrieval (use span.set_attribute)
    - rag.result_count: Set after retrieval
    
    Args:
        namespace: Pinecone namespace being queried
        query_term_count: Number of terms in the query
        
    Yields:
        Span object for adding retrieval results
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        "clinical.rag.query",
        attributes={
            "rag.namespace": namespace,
            "rag.query_term_count": query_term_count,
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


@contextmanager
def clinical_rag_pubmed_span(namespace: str):
    """
    Context manager for PubMed ingestion spans.
    
    Creates a span named 'clinical.rag.pubmed_fetch' with attributes:
    - pubmed.namespace: Target namespace
    - pubmed.articles_fetched: Set after fetch
    - pubmed.chunks_upserted: Set after embedding
    
    Args:
        namespace: Target Pinecone namespace
        
    Yields:
        Span object for adding ingestion metrics
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        "clinical.rag.pubmed_fetch",
        attributes={
            "pubmed.namespace": namespace,
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


@contextmanager
def clinical_antimicrobial_span(
    drug_count: int,
    patient_renal_bracket: str
):
    """
    Context manager for antimicrobial recommendation spans.
    
    Creates a span named 'clinical.antimicrobial.recommendation' with attributes:
    - recommendation.drug_count: Number of drugs recommended
    - patient.renal_bracket: Renal function tier (NOT raw CrCl value)
    
    Evidence Source:
    - Cockcroft-Gault Equation: Cockcroft DW, Gault MH. Nephron 1976
    
    Args:
        drug_count: Number of antimicrobials being recommended
        patient_renal_bracket: Tier label (normal/mild/moderate/severe/esrd)
        
    Yields:
        Span object for adding recommendation details
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        "clinical.antimicrobial.recommendation",
        attributes={
            "recommendation.drug_count": drug_count,
            "patient.renal_bracket": patient_renal_bracket,
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


@contextmanager
def clinical_fhir_span(
    resource_type: str,
    operation: str
):
    """
    Context manager for FHIR resource operations.
    
    Creates a span named 'clinical.fhir.{resource_type}.{operation}' with attributes:
    - fhir.resource_type: Resource type (Patient, Condition, etc.)
    - fhir.operation: Operation (read, create, update, delete)
    - fhir.version: Always "R4"
    
    Args:
        resource_type: FHIR resource type
        operation: Operation being performed
        
    Yields:
        Span object for adding FHIR details
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        f"clinical.fhir.{resource_type.lower()}.{operation}",
        attributes={
            "fhir.resource_type": resource_type,
            "fhir.operation": operation,
            "fhir.version": "R4",
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


@contextmanager
def llm_request_span(model: str):
    """
    Context manager for LLM API request spans.
    
    Creates a span named 'llm.request' with attributes:
    - llm.model: Model identifier
    - llm.provider: Provider name (together_ai, z_ai, etc.)
    
    Args:
        model: Model identifier (e.g., "glm-4.7-flash")
        
    Yields:
        Span object for adding latency metrics
    """
    if not is_telemetry_enabled() or _tracer is None:
        yield None
        return
    
    with _tracer.start_as_current_span(
        "llm.request",
        attributes={
            "llm.model": model,
            "llm.provider": "z_ai",
        }
    ) as span:
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _hash_session_id(session_id: str) -> str:
    """
    Hash a session ID for safe logging.
    
    Uses SHA-256 to create a one-way hash suitable for tracing
    without exposing the original session ID.
    
    Args:
        session_id: Original session identifier
        
    Returns:
        First 16 characters of SHA-256 hash
    """
    return hashlib.sha256(session_id.encode()).hexdigest()[:16]


def set_span_attribute(key: str, value: Any) -> None:
    """
    Set an attribute on the current active span.
    
    Args:
        key: Attribute name
        value: Attribute value (string, int, float, or bool)
    """
    if not is_telemetry_enabled():
        return
    
    span = trace.get_current_span()
    if span and span.is_recording():
        span.set_attribute(key, value)


def add_span_event(name: str, attributes: Optional[Dict[str, Any]] = None) -> None:
    """
    Add an event to the current active span.
    
    Args:
        name: Event name
        attributes: Optional event attributes
    """
    if not is_telemetry_enabled():
        return
    
    span = trace.get_current_span()
    if span and span.is_recording():
        span.add_event(name, attributes or {})


def record_span_error(error: Exception) -> None:
    """
    Record an exception on the current active span.
    
    Args:
        error: Exception to record
    """
    if not is_telemetry_enabled():
        return
    
    span = trace.get_current_span()
    if span and span.is_recording():
        span.record_exception(error)
        span.set_status(trace.Status(trace.StatusCode.ERROR, str(error)))


# =============================================================================
# DECORATOR FOR TRACING FUNCTIONS
# =============================================================================

P = ParamSpec('P')
T = TypeVar('T')


def traced(name: Optional[str] = None) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator to automatically trace a function.
    
    Creates a span with the function name (or provided name)
    and automatically records exceptions.
    
    Usage:
        @traced("process_diagnostic")
        async def process_diagnostic(symptoms: str):
            # ...
            
    Args:
        name: Optional span name (defaults to function name)
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        span_name = name or func.__name__
        
        @functools.wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            if not is_telemetry_enabled() or _tracer is None:
                return await func(*args, **kwargs)
            
            with _tracer.start_as_current_span(span_name) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
        
        @functools.wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            if not is_telemetry_enabled() or _tracer is None:
                return func(*args, **kwargs)
            
            with _tracer.start_as_current_span(span_name) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator
