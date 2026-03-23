"""
Medical Diagnostic RAG Service - FastAPI Application
=====================================================

Main entry point for the medical RAG service.
Integrates PubMed/PMC, Pinecone, and GLM-4.7-Flash.

P0 Enhancements:
- PubMedBERT embeddings with warmup on startup
- Pinecone connectivity verification
- Re-embedding pipeline for existing vectors

P1 Enhancements:
- Hybrid retrieval (BM25 + Semantic search)
- Multi-query generation for improved coverage
- Query decomposition for complex queries
- Reciprocal Rank Fusion (RRF)
- Recency-weighted scoring

P2 Enhancements:
- Redis caching layer
- Query expansion with MeSH terminology
- Prometheus metrics export
- Deep health probes with circuit breaker
- Risk assessment endpoints

P3 Enhancements:
- Clinical Alert Management System (SBAR format)
- Lab Result Interpretation Engine
- Antimicrobial Stewardship Module
- Diagnostic Imaging Decision Support (ACR Appropriateness)
- Differential Diagnosis Engine
- Pediatric Clinical Decision Support
- Geriatric Assessment Module (Beers Criteria, Frailty)
"""

import asyncio
import time
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from loguru import logger

from app.core.config import get_settings, MESH_SPECIALTIES


# ===== Request/Response Models =====

class QueryRequest(BaseModel):
    """Medical diagnostic query request."""
    query: str = Field(..., description="Medical query text", min_length=3, max_length=5000)
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Patient context data")
    specialty: Optional[str] = Field(None, description="Medical specialty filter")
    top_k: int = Field(50, ge=1, le=100, description="Number of results to retrieve")
    min_score: float = Field(0.5, ge=0.0, le=1.0, description="Minimum relevance score")
    expand_query: bool = Field(True, description="Apply medical query expansion")


class ArticleIngestRequest(BaseModel):
    """Request to ingest articles from PubMed."""
    query: str = Field(..., description="PubMed search query")
    max_articles: int = Field(100, ge=1, le=10000, description="Maximum articles to ingest")
    date_from: Optional[str] = Field(None, description="Start date (YYYY/MM/DD)")
    date_to: Optional[str] = Field(None, description="End date (YYYY/MM/DD)")
    mesh_terms: Optional[List[str]] = Field(None, description="MeSH term filters")


class DiagnosticRequest(BaseModel):
    """Diagnostic recommendation request."""
    patient_symptoms: str = Field(..., description="Patient symptoms", min_length=10)
    medical_history: Optional[str] = Field(None, description="Medical history")
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = Field(None)
    current_medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    vital_signs: Optional[Dict[str, Any]] = None
    lab_results: Optional[Dict[str, Any]] = None
    specialty: Optional[str] = None
    top_k: int = Field(20, ge=5, le=50)


class SearchResult(BaseModel):
    """Individual search result."""
    id: str
    score: float
    pmid: str
    title: str
    abstract: str
    journal: Optional[str] = None
    publication_date: Optional[str] = None
    authors: List[str] = []
    mesh_terms: List[str] = []
    doi: Optional[str] = None


class QueryResponse(BaseModel):
    """Medical query response."""
    query: str
    expanded_query: Optional[str] = None
    results: List[SearchResult] = []
    total_results: int = 0
    latency_ms: float = 0.0
    metadata: Dict[str, Any] = {}


class IngestResponse(BaseModel):
    """Article ingestion response."""
    status: str
    articles_ingested: int = 0
    errors: int = 0
    message: str = ""


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    services: Dict[str, str] = {}
    timestamp: str = ""
    version: str = "1.0.0"


# ===== Application State =====

class AppState:
    """Application state container."""
    retrieval_engine = None
    diagnostic_engine = None
    scheduler = None
    cache_manager = None  # P2: Cache manager
    query_expander = None  # P2: Query expander
    health_probe = None  # P2: Health probe
    risk_service = None  # P2: Risk assessment
    hybrid_engine = None  # P1: Hybrid retrieval engine
    start_time: datetime = datetime.utcnow()


state = AppState()


# ===== Lifespan Management =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    
    # Startup
    logger.info("=" * 60)
    logger.info("Starting Medical Diagnostic RAG Service")
    logger.info("=" * 60)
    logger.info(f"Pinecone Index: {settings.PINECONE_INDEX_NAME}")
    logger.info(f"Pinecone Namespace: {settings.PINECONE_NAMESPACE}")
    logger.info(f"NCBI Email: {settings.NCBI_EMAIL}")
    logger.info(f"GLM Model: {settings.GLM_MODEL} (via Z.AI)")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    logger.info("-" * 60)
    
    # P0: Warmup embedding model on startup
    if settings.EMBEDDING_WARMUP_ON_STARTUP:
        logger.info("Warming up embedding model...")
        try:
            from app.embedding.pubmedbert_embeddings import warmup_embedding_model
            warmup_result = await warmup_embedding_model()
            if warmup_result.get("status") == "success":
                logger.info(f"Embedding model warmup complete: {warmup_result.get('model_info')}")
            else:
                logger.warning(f"Embedding model warmup failed: {warmup_result.get('error')}")
        except Exception as e:
            logger.warning(f"Embedding model warmup error (non-critical): {e}")
    
    logger.info("Service ready - components initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Medical Diagnostic RAG Service...")


# ===== Create FastAPI App =====

app = FastAPI(
    title="Medical Diagnostic RAG Service",
    description="""
PubMed/PMC-powered RAG system for medical diagnostics.

## Features
- **PubMed Search**: Access 39M+ PubMed abstracts
- **PMC Full-Text**: Access 11M+ PMC full-text articles
- **Semantic Search**: PubMedBERT embeddings with Pinecone
- **Diagnostic AI**: GLM-4.7-Flash powered clinical reasoning
- **HIPAA Compliant**: Audit logging and data protection

## API Endpoints
- `POST /api/v1/query` - Semantic search in medical literature
- `POST /api/v1/ingest` - Ingest articles from PubMed
- `POST /api/v1/diagnose` - Get diagnostic recommendations
- `GET /api/v1/scheduler/status` - Check data sync status
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Audit Logging Middleware =====

@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    """HIPAA-compliant audit logging."""
    start_time = time.time()
    
    log_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host if request.client else "unknown",
    }
    
    response = await call_next(request)
    
    log_data["status_code"] = response.status_code
    log_data["latency_ms"] = (time.time() - start_time) * 1000
    
    if settings.AUDIT_LOGGING:
        logger.info("API Request", extra=log_data)
    
    return response


# ===== Authentication =====

async def verify_api_key(x_api_key: str = Header(None)) -> bool:
    """Verify API key for protected endpoints."""
    if not settings.API_SECRET_KEY:
        return True
    
    if x_api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


# ===== Health Check =====

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check service health status."""
    return HealthResponse(
        status="healthy",
        services={
            "pinecone": "configured",
            "llm": "configured" if settings.ZAI_API_KEY else "not_configured",
        },
        timestamp=datetime.utcnow().isoformat(),
    )


# ===== RAG Query Endpoint =====

@app.post("/api/v1/query", response_model=QueryResponse, tags=["RAG"])
async def query_medical_literature(
    request: QueryRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Query medical literature with RAG.
    
    This endpoint:
    1. Expands the query with medical terminology
    2. Generates semantic embeddings
    3. Searches Pinecone vector database
    4. Returns relevant medical literature
    """
    start_time = time.time()
    
    try:
        from app.retrieval.rag_engine import RAGRetrievalEngine
        
        # Initialize retrieval engine
        if state.retrieval_engine is None:
            state.retrieval_engine = RAGRetrievalEngine(top_k=request.top_k)
        
        # Retrieve relevant articles
        context = await state.retrieval_engine.retrieve(
            query=request.query,
            patient_context=request.patient_context,
            specialty=request.specialty,
            top_k=request.top_k,
        )
        
        # Format results
        formatted_results = []
        for article in context.articles:
            formatted_results.append(SearchResult(
                id=article.id,
                score=article.rerank_score,
                pmid=article.pmid,
                title=article.title,
                abstract=article.abstract[:500],
                journal=article.journal,
                publication_date=article.publication_date,
                authors=article.authors[:5],
                mesh_terms=article.mesh_terms[:5],
                doi=article.doi,
            ))
        
        latency_ms = (time.time() - start_time) * 1000
        
        return QueryResponse(
            query=request.query,
            expanded_query=context.expanded_query,
            results=formatted_results,
            total_results=len(formatted_results),
            latency_ms=latency_ms,
            metadata={
                "total_tokens": context.total_tokens,
                "retrieval_latency_ms": context.retrieval_latency_ms,
            }
        )
        
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Article Ingestion Endpoint =====

@app.post("/api/v1/ingest", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_articles(
    request: ArticleIngestRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Ingest articles from PubMed into vector database.
    """
    try:
        from app.etl.pubmed_fetcher import PubMedFetcher
        from app.embedding.embedding_pipeline import PineconeIngestionPipeline
        
        # Build date range
        date_range = None
        if request.date_from and request.date_to:
            date_range = (request.date_from, request.date_to)
        
        # Fetch articles
        articles = []
        async with PubMedFetcher() as fetcher:
            search_results = await fetcher.search(
                query=request.query,
                max_results=request.max_articles,
                date_range=date_range,
                mesh_terms=request.mesh_terms,
            )
            
            async for article in fetcher.fetch_articles(search_results.pmids):
                articles.append(article.to_dict())
        
        if not articles:
            return IngestResponse(
                status="warning",
                articles_ingested=0,
                errors=0,
                message="No articles found matching criteria",
            )
        
        # Ingest into Pinecone
        pipeline = PineconeIngestionPipeline()
        stats = await pipeline.ingest_articles_batch(articles)
        
        return IngestResponse(
            status="success",
            articles_ingested=stats.get("successful_upserts", 0),
            errors=stats.get("failed_upserts", 0),
            message=f"Successfully ingested {stats.get('successful_upserts', 0)} articles",
        )
        
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        return IngestResponse(
            status="error",
            articles_ingested=0,
            errors=1,
            message=str(e),
        )


# ===== Diagnostic Endpoint =====

@app.post("/api/v1/diagnose", tags=["Diagnostic"])
async def diagnose_patient(
    request: DiagnosticRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Generate diagnostic recommendation using RAG and GLM-4.7-Flash.
    """
    try:
        from app.api.diagnostic import DiagnosticEngine, DiagnosticRequest as DiagRequest
        
        # Initialize engine
        if state.diagnostic_engine is None:
            state.diagnostic_engine = DiagnosticEngine()
        
        # Create diagnostic request
        diag_request = DiagRequest(
            patient_symptoms=request.patient_symptoms,
            medical_history=request.medical_history,
            age=request.age,
            gender=request.gender,
            current_medications=request.current_medications,
            allergies=request.allergies,
            vital_signs=request.vital_signs,
            lab_results=request.lab_results,
            specialty=request.specialty,
            top_k=request.top_k,
        )
        
        # Generate diagnosis
        response = await state.diagnostic_engine.diagnose(diag_request)
        
        return response.dict()
        
    except Exception as e:
        logger.error(f"Diagnostic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Scheduler Endpoints =====

@app.get("/api/v1/scheduler/status", tags=["Scheduler"])
async def get_scheduler_status():
    """Get data refresh scheduler status."""
    from app.scheduler.data_refresh import get_scheduler
    
    scheduler = await get_scheduler()
    return scheduler.get_status()


@app.post("/api/v1/scheduler/sync", tags=["Scheduler"])
async def trigger_sync(days: int = 7, max_articles: int = 1000):
    """Manually trigger PubMed sync."""
    from app.scheduler.data_refresh import get_scheduler
    
    scheduler = await get_scheduler()
    result = await scheduler.sync_pubmed_articles(days=days, max_articles=max_articles)
    return result.to_dict()


@app.post("/api/v1/scheduler/maintenance", tags=["Scheduler"])
async def trigger_maintenance():
    """Run full maintenance cycle."""
    from app.scheduler.data_refresh import get_scheduler
    
    scheduler = await get_scheduler()
    return await scheduler.run_maintenance()


# ===== Specialties Endpoint =====

@app.get("/api/v1/specialties", tags=["Reference"])
async def get_specialties():
    """Get available medical specialties with MeSH terms."""
    return {
        "specialties": MESH_SPECIALTIES,
        "total": len(MESH_SPECIALTIES),
    }


# ===== P1: Safety Validation Endpoints =====

@app.post("/api/v1/safety/check", tags=["Safety"])
async def safety_check(
    symptoms: str,
    current_medications: Optional[List[str]] = None,
    allergies: Optional[List[str]] = None,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P1: Run safety validation checks on patient symptoms and medications.
    
    Returns emergency triggers, drug interactions, and allergy conflicts.
    """
    from app.prompts.safety_prompts import (
        check_emergency_triggers,
        validate_drug_interaction_safety,
        validate_allergy_safety,
    )
    
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "is_safe": True,
        "warnings": [],
        "emergency": None,
        "drug_interactions": [],
        "allergy_conflicts": [],
    }
    
    # Check emergency triggers
    is_emergency, emergency_details = check_emergency_triggers(
        symptoms, {"medications": current_medications, "allergies": allergies}
    )
    if is_emergency:
        result["is_safe"] = False
        result["emergency"] = emergency_details
    
    # Check drug interactions
    if current_medications and len(current_medications) > 1:
        for i, med1 in enumerate(current_medications):
            for med2 in current_medications[i+1:]:
                interactions = validate_drug_interaction_safety(med1, [med2])
                if interactions:
                    result["drug_interactions"].extend([i.to_dict() for i in interactions])
    
    # Check allergy conflicts
    if allergies and current_medications:
        for med in current_medications:
            is_safe, warning, alternatives = validate_allergy_safety(med, allergies)
            if not is_safe:
                result["allergy_conflicts"].append({
                    "medication": med,
                    "warning": warning,
                    "alternatives": alternatives,
                })
    
    if result["drug_interactions"] or result["allergy_conflicts"]:
        result["is_safe"] = False
    
    return result


@app.get("/api/v1/safety/emergency-triggers", tags=["Safety"])
async def get_emergency_triggers():
    """P1: Get list of emergency escalation triggers."""
    from app.prompts.safety_prompts import ESCALATION_TRIGGERS
    return {
        "triggers": ESCALATION_TRIGGERS,
        "total_categories": len(ESCALATION_TRIGGERS),
    }


@app.get("/api/v1/safety/high-risk-medications", tags=["Safety"])
async def get_high_risk_medications():
    """P1: Get list of high-risk medication classes and monitoring requirements."""
    from app.prompts.safety_prompts import HIGH_RISK_MEDICATIONS
    return {
        "medications": HIGH_RISK_MEDICATIONS,
        "total_classes": len(HIGH_RISK_MEDICATIONS),
    }


@app.get("/api/v1/safety/allergy-cross-reactivity", tags=["Safety"])
async def get_allergy_cross_reactivity():
    """P1: Get allergy cross-reactivity database."""
    from app.prompts.safety_prompts import ALLERGY_CROSS_REACTIVITY
    return {
        "cross_reactivity": ALLERGY_CROSS_REACTIVITY,
        "total_allergen_classes": len(ALLERGY_CROSS_REACTIVITY),
    }


# ===== Stats Endpoints =====

@app.get("/api/v1/stats/retrieval", tags=["Monitoring"])
async def get_retrieval_stats():
    """Get retrieval engine statistics."""
    if state.retrieval_engine:
        return state.retrieval_engine.get_stats()
    return {"status": "not_initialized"}


@app.get("/api/v1/stats/diagnostic", tags=["Monitoring"])
async def get_diagnostic_stats():
    """Get diagnostic engine statistics."""
    if state.diagnostic_engine:
        return state.diagnostic_engine.get_stats()
    return {"status": "not_initialized"}


# ===== P2: Deep Health Check Endpoints =====

@app.get("/health/deep", tags=["System"])
async def deep_health_check():
    """
    P2: Comprehensive health check with dependency status.
    
    Returns detailed health status for:
    - Database connectivity
    - Pinecone index
    - LLM API
    - Embedding model
    - System resources
    - Circuit breaker status
    """
    from app.monitoring.health_probes import get_health_probe
    
    probe = get_health_probe()
    health = await probe.check_all()
    return health.to_dict()


@app.get("/health/ready", tags=["System"])
async def readiness_probe():
    """P2: Kubernetes-style readiness probe."""
    from app.monitoring.health_probes import get_health_probe
    
    probe = get_health_probe()
    is_ready = await probe.check_ready()
    
    if is_ready:
        return {"status": "ready"}
    return JSONResponse(
        status_code=503,
        content={"status": "not_ready"}
    )


@app.get("/health/live", tags=["System"])
async def liveness_probe():
    """P2: Kubernetes-style liveness probe."""
    return {"status": "alive"}


@app.get("/health/circuit-breakers", tags=["System"])
async def get_circuit_breaker_status():
    """P2: Get all circuit breaker statuses."""
    from app.monitoring.health_probes import get_health_probe
    
    probe = get_health_probe()
    return probe.get_circuit_breaker_status()


# ===== P2: Prometheus Metrics Endpoint =====

@app.get("/metrics", tags=["Monitoring"])
async def prometheus_metrics():
    """
    P2: Export metrics in Prometheus format.
    
    Scraped by Prometheus for monitoring.
    """
    from app.monitoring.prometheus_export import export_prometheus_metrics
    from fastapi.responses import PlainTextResponse
    
    metrics = export_prometheus_metrics()
    return PlainTextResponse(content=metrics, media_type="text/plain")


# ===== P2: Query Expansion Endpoint =====

@app.post("/api/v1/query/expand", tags=["RAG"])
async def expand_medical_query_endpoint(
    query: str,
    expand_mesh: bool = True,
    expand_acronyms: bool = True,
    expand_synonyms: bool = True,
):
    """
    P2: Expand a medical query with MeSH terms, synonyms, and acronym resolution.
    
    Returns expanded query with related terminology for improved retrieval.
    """
    from app.retrieval.query_expander import get_query_expander
    
    expander = get_query_expander()
    result = expander.expand(
        query,
        expand_mesh=expand_mesh,
        expand_acronyms=expand_acronyms,
        expand_synonyms=expand_synonyms,
    )
    return result.to_dict()


@app.get("/api/v1/query/mesh-suggestions", tags=["RAG"])
async def suggest_mesh_terms(query: str, limit: int = 5):
    """P2: Get MeSH term suggestions for a query."""
    from app.retrieval.query_expander import get_query_expander
    
    expander = get_query_expander()
    suggestions = expander.suggest_mesh_terms(query, limit=limit)
    return {
        "query": query,
        "suggestions": suggestions,
    }


# ===== P2: Risk Assessment Endpoints =====

@app.post("/api/v1/risk-score/{score_name}", tags=["Risk Assessment"])
async def calculate_risk_score(
    score_name: str,
    criteria: Dict[str, Any],
):
    """
    P2: Calculate a specific clinical risk score.
    
    Supported scores:
    - chads2vasc: Stroke risk in atrial fibrillation
    - hasbled: Bleeding risk with anticoagulation
    - wells_dvt: DVT probability
    - qsofa: Sepsis risk
    - curb65: Pneumonia severity
    """
    from app.api.risk_assessment import get_risk_service
    
    service = get_risk_service()
    result = await service.calculate_score(score_name, **criteria)
    return result


@app.post("/api/v1/risk-assessment", tags=["Risk Assessment"])
async def comprehensive_risk_assessment(
    patient_data: Dict[str, Any],
):
    """
    P2: Calculate all applicable risk scores for a patient.
    
    Automatically determines which risk scores are relevant based on patient data.
    """
    from app.api.risk_assessment import get_risk_service
    
    service = get_risk_service()
    result = await service.calculate_all_applicable(patient_data)
    return result


@app.get("/api/v1/risk-scores", tags=["Risk Assessment"])
async def list_available_risk_scores():
    """P2: List all available risk scoring systems."""
    from app.api.risk_assessment import get_risk_service
    
    service = get_risk_service()
    return {
        "risk_scores": service.get_available_scores(),
    }


# ===== P2: Cache Management Endpoints =====

@app.get("/api/v1/cache/stats", tags=["Cache"])
async def get_cache_stats():
    """P2: Get cache statistics."""
    from app.cache.redis_cache import get_cache_manager
    
    cache = await get_cache_manager()
    return await cache.get_stats()


@app.delete("/api/v1/cache/clear", tags=["Cache"])
async def clear_cache(
    authenticated: bool = Depends(verify_api_key),
):
    """P2: Clear all cached data."""
    from app.cache.redis_cache import get_cache_manager
    
    cache = await get_cache_manager()
    success = await cache.clear_all()
    return {
        "status": "success" if success else "error",
        "message": "Cache cleared" if success else "Failed to clear cache",
    }


@app.get("/api/v1/cache/rate-limit/{user_id}", tags=["Cache"])
async def check_rate_limit(
    user_id: str,
    endpoint: str = "default",
):
    """P2: Check rate limit status for a user."""
    from app.cache.redis_cache import get_cache_manager
    
    cache = await get_cache_manager()
    result = await cache.check_rate_limit(user_id, endpoint)
    return result


# =============================================================================
# P3: CLINICAL ALERT MANAGEMENT ENDPOINTS
# =============================================================================

@app.post("/api/v1/alerts/create", tags=["P3 - Alerts"])
async def create_clinical_alert(
    alert_type: str,
    category: str,
    severity: str,
    situation: str,
    background: str,
    assessment: str,
    recommendation: str,
    patient_id: Optional[str] = None,
    triggering_data: Optional[Dict[str, Any]] = None,
):
    """
    P3: Create a clinical alert with SBAR format.
    
    Categories: drug_interaction, allergy, dosing, lab_critical, diagnostic, safety
    Severities: info, warning, critical, blocker
    """
    from app.alerts.alert_management import get_alert_manager, AlertCategory, AlertSeverity
    
    manager = get_alert_manager()
    
    # Map strings to enums
    category_map = {c.value: c for c in AlertCategory}
    severity_map = {s.value: s for s in AlertSeverity}
    
    if category.lower() not in category_map:
        raise HTTPException(status_code=400, detail=f"Invalid category. Use: {list(category_map.keys())}")
    if severity.lower() not in severity_map:
        raise HTTPException(status_code=400, detail=f"Invalid severity. Use: {list(severity_map.keys())}")
    
    alert = await manager.create_alert(
        alert_type=alert_type,
        category=category_map[category.lower()],
        severity=severity_map[severity.lower()],
        situation=situation,
        background=background,
        assessment=assessment,
        recommendation=recommendation,
        patient_id=patient_id,
        triggering_data=triggering_data,
    )
    
    return alert.to_dict()


@app.post("/api/v1/alerts/{alert_id}/acknowledge", tags=["P3 - Alerts"])
async def acknowledge_alert(
    alert_id: str,
    acknowledged_by: str,
    notes: Optional[str] = None,
):
    """P3: Acknowledge a clinical alert."""
    from app.alerts.alert_management import get_alert_manager
    
    manager = get_alert_manager()
    alert = await manager.acknowledge_alert(alert_id, acknowledged_by, notes)
    
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert.to_dict()


@app.post("/api/v1/alerts/{alert_id}/override", tags=["P3 - Alerts"])
async def override_alert(
    alert_id: str,
    overridden_by: str,
    override_reason: str,
):
    """P3: Override a clinical alert with documentation."""
    from app.alerts.alert_management import get_alert_manager
    
    manager = get_alert_manager()
    alert, errors = await manager.override_alert(alert_id, overridden_by, override_reason)
    
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors, "alert": alert.to_dict()})
    
    return alert.to_dict()


@app.get("/api/v1/alerts/patient/{patient_id}", tags=["P3 - Alerts"])
async def get_patient_alerts(patient_id: str, active_only: bool = True):
    """P3: Get all alerts for a patient."""
    from app.alerts.alert_management import get_alert_manager
    
    manager = get_alert_manager()
    alerts = manager.get_patient_alerts(patient_id, active_only)
    return {"alerts": [a.to_dict() for a in alerts], "total": len(alerts)}


@app.get("/api/v1/alerts/analytics", tags=["P3 - Alerts"])
async def get_alert_analytics():
    """P3: Get alert analytics and effectiveness metrics."""
    from app.alerts.alert_management import get_alert_manager
    
    manager = get_alert_manager()
    return manager.get_alert_analytics()


# =============================================================================
# P3: LAB INTERPRETATION ENDPOINTS
# =============================================================================

@app.post("/api/v1/labs/interpret", tags=["P3 - Labs"])
async def interpret_lab_result(
    test_code: str,
    value: float,
    age: int,
    gender: str,
    is_pregnant: bool = False,
    current_medications: Optional[List[str]] = None,
):
    """
    P3: Interpret a single laboratory result with clinical context.
    
    Provides reference ranges, abnormality classification, and clinical significance.
    """
    from app.labs.lab_interpretation import get_lab_engine
    
    engine = get_lab_engine()
    interpretation = engine.interpret_result(
        test_code=test_code,
        value=value,
        age=age,
        gender=gender,
        is_pregnant=is_pregnant,
        current_medications=current_medications,
    )
    
    return interpretation.to_dict()


@app.post("/api/v1/labs/interpret-panel", tags=["P3 - Labs"])
async def interpret_lab_panel(
    results: Dict[str, float],
    age: int,
    gender: str,
    is_pregnant: bool = False,
    current_medications: Optional[List[str]] = None,
):
    """
    P3: Interpret a panel of lab results with cross-analysis.
    
    Detects patterns and calculates derived values (e.g., eGFR).
    """
    from app.labs.lab_interpretation import get_lab_engine
    
    engine = get_lab_engine()
    interpretation = engine.interpret_panel(
        results=results,
        age=age,
        gender=gender,
        is_pregnant=is_pregnant,
        current_medications=current_medications,
    )
    
    return interpretation


@app.get("/api/v1/labs/reference-ranges/{test_code}", tags=["P3 - Labs"])
async def get_reference_ranges(test_code: str):
    """P3: Get all reference ranges for a lab test."""
    from app.labs.lab_interpretation import get_lab_engine, REFERENCE_RANGES
    
    test_upper = test_code.upper()
    if test_upper not in REFERENCE_RANGES:
        return {"error": f"Unknown test: {test_code}", "available_tests": list(REFERENCE_RANGES.keys())[:20]}
    
    ranges = REFERENCE_RANGES[test_upper]
    return {
        "test_code": test_upper,
        "reference_ranges": [
            {
                "age_range": f"{r.age_min or 0}-{r.age_max or '∞'} years",
                "gender": r.gender or "all",
                "normal_range": f"{r.low_normal}-{r.high_normal} {r.unit}",
                "critical_values": f"{r.critical_low}-{r.critical_high}" if r.critical_low else "Not defined",
            }
            for r in ranges
        ],
    }


# =============================================================================
# P3: ANTIMICROBIAL STEWARDSHIP ENDPOINTS
# =============================================================================

@app.post("/api/v1/antimicrobial/recommend", tags=["P3 - Antimicrobial"])
async def get_antimicrobial_recommendation(
    infection_type: str,
    severity: str = "moderate",
    allergies: Optional[List[str]] = None,
    renal_function: Optional[float] = None,
    current_medications: Optional[List[str]] = None,
    pregnancy: bool = False,
):
    """
    P3: Get empiric antimicrobial recommendations.
    
    Infection types: CAP_OUTPATIENT_HEALTHY, CAP_OUTPATIENT_COMORBID, CAP_INPATIENT,
    UTI_UNCOMPLICATED, PYELONEPHRITIS_OUTPATIENT, CELLULITIS_NONPURULENT, etc.
    """
    from app.antimicrobial.stewardship_engine import get_stewardship_engine, Severity
    
    engine = get_stewardship_engine()
    
    severity_enum = Severity.MODERATE
    if severity.lower() == "mild":
        severity_enum = Severity.MILD
    elif severity.lower() == "severe":
        severity_enum = Severity.SEVERE
    elif severity.lower() == "critical":
        severity_enum = Severity.CRITICAL
    
    result = await engine.get_empiric_recommendation(
        infection_type=infection_type,
        severity=severity_enum,
        allergies=allergies,
        renal_function=renal_function,
        current_medications=current_medications,
        pregnancy=pregnancy,
    )
    
    return result


@app.post("/api/v1/antimicrobial/iv-to-po", tags=["P3 - Antimicrobial"])
async def check_iv_to_po_conversion(
    drug_name: str,
    patient_status: Dict[str, Any],
):
    """
    P3: Check if IV-to-PO conversion is appropriate.
    
    Patient status should include: hemodynamically_stable, tolerating_oral, gi_obstruction
    """
    from app.antimicrobial.stewardship_engine import get_stewardship_engine
    
    engine = get_stewardship_engine()
    result = await engine.check_iv_to_po_conversion(drug_name, patient_status)
    
    return result


@app.post("/api/v1/antimicrobial/organism-directed", tags=["P3 - Antimicrobial"])
async def get_organism_directed_therapy(
    organism: str,
    susceptibilities: Dict[str, str],
    infection_site: Optional[str] = None,
):
    """
    P3: Get culture-directed therapy recommendations.
    
    Susceptibilities: Dict mapping antibiotic to S/I/R
    """
    from app.antimicrobial.stewardship_engine import get_stewardship_engine
    
    engine = get_stewardship_engine()
    result = await engine.get_organism_directed_therapy(
        organism=organism,
        susceptibilities=susceptibilities,
        infection_site=infection_site,
    )
    
    return result


# =============================================================================
# P3: IMAGING DECISION SUPPORT ENDPOINTS
# =============================================================================

@app.post("/api/v1/imaging/recommend", tags=["P3 - Imaging"])
async def get_imaging_recommendation(
    clinical_scenario: str,
    patient_data: Optional[Dict[str, Any]] = None,
):
    """
    P3: Get imaging recommendations based on ACR Appropriateness Criteria.
    
    Clinical scenarios: HEADACHE_ACUTE_SUDDEN_SEVERE, CHEST_PAIN_ACUTE_CARDIAC_SUSPECTED,
    ABDOMINAL_PAIN_ACUTE_RIGHT_LOWER_QUADRANT, LOW_BACK_PAIN_ACUTE_NO_RED_FLAGS, etc.
    
    Patient data can include: age, pregnant, eGFR, allergies, medications, conditions
    """
    from app.imaging.imaging_decision_support import get_imaging_support
    
    support = get_imaging_support()
    result = await support.get_imaging_recommendation(clinical_scenario, patient_data)
    
    return result


@app.post("/api/v1/imaging/pregnancy-assessment", tags=["P3 - Imaging"])
async def assess_pregnancy_imaging(
    clinical_scenario: str,
    gestational_age_weeks: Optional[int] = None,
):
    """P3: Assess imaging options for pregnant patient."""
    from app.imaging.imaging_decision_support import get_imaging_support
    
    support = get_imaging_support()
    result = await support.assess_pregnancy_imaging(clinical_scenario, gestational_age_weeks)
    
    return result


# =============================================================================
# P3: DIFFERENTIAL DIAGNOSIS ENDPOINTS
# =============================================================================

@app.post("/api/v1/differential-diagnosis", tags=["P3 - Diagnosis"])
async def generate_differential_diagnosis(
    chief_complaint: str,
    presentation_type: str,
    patient_data: Optional[Dict[str, Any]] = None,
    additional_symptoms: Optional[List[str]] = None,
):
    """
    P3: Generate differential diagnoses based on clinical presentation.
    
    Chief complaints: CHEST_PAIN, ABDOMINAL_PAIN, DYSPNEA, FEVER, HEADACHE
    
    Presentation types vary by complaint:
    - CHEST_PAIN: acute_severe, pleuritic
    - ABDOMINAL_PAIN: right_lower_quadrant, right_upper_quadrant, epigastric
    - DYSPNEA: acute, chronic_progressive
    - HEADACHE: thunderclap, chronic_recurrent
    """
    from app.differential.differential_diagnosis import get_ddx_engine
    
    engine = get_ddx_engine()
    result = await engine.generate_differential(
        chief_complaint=chief_complaint,
        presentation_type=presentation_type,
        patient_data=patient_data,
        additional_symptoms=additional_symptoms,
    )
    
    return result


# =============================================================================
# P3: PEDIATRIC SUPPORT ENDPOINTS
# =============================================================================

@app.post("/api/v1/pediatric/dosing", tags=["P3 - Pediatric"])
async def calculate_pediatric_dose(
    medication: str,
    weight_kg: float,
    indication: Optional[str] = None,
    age_months: Optional[int] = None,
):
    """
    P3: Calculate weight-based dose for pediatric patient.
    
    Medications: ACETAMINOPHEN, IBUPROFEN, AMOXICILLIN, AZITHROMYCIN, etc.
    """
    from app.pediatric.pediatric_support import get_pediatric_support
    
    support = get_pediatric_support()
    result = await support.calculate_dose(
        medication=medication,
        weight_kg=weight_kg,
        indication=indication,
        age_months=age_months,
    )
    
    return result


@app.post("/api/v1/pediatric/vitals", tags=["P3 - Pediatric"])
async def assess_pediatric_vitals(
    age_months: int,
    heart_rate: int,
    respiratory_rate: int,
    systolic_bp: int,
    diastolic_bp: int,
    temperature: float,
):
    """P3: Assess pediatric vital signs against age-appropriate normal ranges."""
    from app.pediatric.pediatric_support import get_pediatric_support
    
    support = get_pediatric_support()
    result = await support.assess_vital_signs(
        age_months=age_months,
        heart_rate=heart_rate,
        respiratory_rate=respiratory_rate,
        systolic_bp=systolic_bp,
        diastolic_bp=diastolic_bp,
        temperature=temperature,
    )
    
    return result


@app.post("/api/v1/pediatric/pews", tags=["P3 - Pediatric"])
async def calculate_pews_score(
    age_months: int,
    behavior: str,
    cardiovascular: str,
    respiratory: str,
):
    """
    P3: Calculate Pediatric Early Warning Score (PEWS).
    
    Behavior: normal, sleeping, irritable, lethargic, reduced_response
    Cardiovascular: normal, pale, gray, mottled
    Respiratory: normal, 10_above_normal, 20_above_normal, retractions, o2_required
    """
    from app.pediatric.pediatric_support import get_pediatric_support
    
    support = get_pediatric_support()
    result = await support.calculate_pews(
        age_months=age_months,
        behavior=behavior,
        cardiovascular=cardiovascular,
        respiratory=respiratory,
    )
    
    return result


@app.get("/api/v1/pediatric/milestones/{age_months}", tags=["P3 - Pediatric"])
async def check_developmental_milestones(age_months: int):
    """P3: Get expected developmental milestones for age."""
    from app.pediatric.pediatric_support import get_pediatric_support
    
    support = get_pediatric_support()
    result = await support.check_developmental_milestones(age_months)
    
    return result


# =============================================================================
# P3: GERIATRIC SUPPORT ENDPOINTS
# =============================================================================

@app.post("/api/v1/geriatric/beers-review", tags=["P3 - Geriatric"])
async def review_medications_beers(
    medications: List[str],
    age: int,
    conditions: Optional[List[str]] = None,
    creatinine_clearance: Optional[float] = None,
):
    """
    P3: Review medications against Beers Criteria for older adults.
    
    Identifies potentially inappropriate medications for patients 65+.
    """
    from app.geriatric.geriatric_support import get_geriatric_support
    
    support = get_geriatric_support()
    result = await support.review_medications_beers(
        medications=medications,
        age=age,
        conditions=conditions,
        creatinine_clearance=creatinine_clearance,
    )
    
    return result


@app.post("/api/v1/geriatric/anticholinergic-burden", tags=["P3 - Geriatric"])
async def calculate_anticholinergic_burden(medications: List[str]):
    """
    P3: Calculate total anticholinergic burden score.
    
    Higher scores correlate with cognitive impairment, falls, delirium risk.
    """
    from app.geriatric.geriatric_support import get_geriatric_support
    
    support = get_geriatric_support()
    result = await support.calculate_anticholinergic_burden(medications)
    
    return result


@app.post("/api/v1/geriatric/falls-risk", tags=["P3 - Geriatric"])
async def assess_falls_risk(
    medications: List[str],
    conditions: List[str],
    functional_status: Optional[Dict[str, bool]] = None,
    history_of_falls: bool = False,
    use_of_assistive_device: bool = False,
):
    """
    P3: Comprehensive falls risk assessment for older adults.
    
    Functional status can include: impaired_gait, impaired_balance, muscle_weakness
    """
    from app.geriatric.geriatric_support import get_geriatric_support
    
    support = get_geriatric_support()
    result = await support.assess_falls_risk(
        medications=medications,
        conditions=conditions,
        functional_status=functional_status,
        history_of_falls=history_of_falls,
        use_of_assistive_device=use_of_assistive_device,
    )
    
    return result


@app.post("/api/v1/geriatric/frailty", tags=["P3 - Geriatric"])
async def assess_frailty(
    fatigue: bool,
    resistance_difficulty: bool,
    ambulation_difficulty: bool,
    illness_count: int,
    weight_loss_percent: float,
):
    """
    P3: Assess frailty using FRAIL scale.
    
    Returns frailty status: Robust (0), Pre-frail (1-2), Frail (3-5)
    """
    from app.geriatric.geriatric_support import get_geriatric_support
    
    support = get_geriatric_support()
    result = await support.assess_frailty(
        fatigue=fatigue,
        resistance_difficulty=resistance_difficulty,
        ambulation_difficulty=ambulation_difficulty,
        illness_count=illness_count,
        weight_loss_percent=weight_loss_percent,
    )
    
    return result


# =============================================================================
# P3: QUALITY ASSURANCE ENDPOINTS
# =============================================================================

class QualityValidationRequest(BaseModel):
    """Request for quality validation."""
    response_text: str = Field(..., description="AI-generated response to validate")
    source_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Source documents")
    response_type: str = Field("diagnostic", description="Type of response")
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Optional patient context")


@app.post("/api/v1/quality/validate", tags=["P3 - Quality"])
async def validate_response_quality(
    request: QualityValidationRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P3: Validate quality of AI-generated clinical response.

    Performs comprehensive validation including:
    - Citation verification
    - Faithfulness scoring
    - Completeness checking
    - Hallucination detection
    - Clinical accuracy validation
    """
    from app.quality.response_validator import get_qa_engine

    engine = get_qa_engine()
    result = await engine.validate_response(
        response_text=request.response_text,
        source_documents=request.source_documents,
        response_type=request.response_type,
        patient_context=request.patient_context,
    )

    return result.to_dict()


@app.get("/api/v1/quality/stats", tags=["P3 - Quality"])
async def get_quality_stats():
    """P3: Get quality assurance statistics."""
    from app.quality.response_validator import get_qa_engine

    engine = get_qa_engine()
    return engine.get_stats()


@app.post("/api/v1/quality/faithfulness", tags=["P3 - Quality"])
async def calculate_faithfulness(
    response_text: str,
    source_documents: List[Dict[str, Any]],
):
    """
    P3: Calculate faithfulness score for a response.

    Measures how well the response is grounded in source documents.
    """
    from app.quality.response_validator import get_qa_engine

    engine = get_qa_engine()
    result = await engine._calculate_faithfulness(response_text, source_documents)

    return result.to_dict()


@app.post("/api/v1/quality/completeness", tags=["P3 - Quality"])
async def check_completeness(
    response_text: str,
    response_type: str = "diagnostic",
):
    """
    P3: Check completeness of clinical response.

    Verifies all required clinical elements are present based on response type.
    """
    from app.quality.response_validator import get_qa_engine

    engine = get_qa_engine()
    result = engine._check_completeness(response_text, response_type)

    return result.to_dict()


# =============================================================================
# P3: EMBEDDING OPTIMIZATION ENDPOINTS
# =============================================================================

@app.post("/api/v1/embeddings/generate", tags=["P3 - Embeddings"])
async def generate_embedding(
    text: str,
    use_cache: bool = True,
):
    """
    P3: Generate optimized embedding for text.

    Uses multi-level caching for performance.
    """
    from app.embedding.embedding_optimizer import get_embedding_optimizer

    optimizer = get_embedding_optimizer()
    result = await optimizer.embed(text, use_cache=use_cache)

    return result.to_dict()


@app.post("/api/v1/embeddings/batch", tags=["P3 - Embeddings"])
async def generate_embeddings_batch(
    texts: List[str],
    use_cache: bool = True,
    adaptive_batch: bool = True,
):
    """
    P3: Generate embeddings for multiple texts with intelligent batching.
    """
    from app.embedding.embedding_optimizer import get_embedding_optimizer

    optimizer = get_embedding_optimizer()
    result = await optimizer.embed_batch(
        texts=texts,
        use_cache=use_cache,
        adaptive_batch=adaptive_batch,
    )

    return result.to_dict()


@app.get("/api/v1/embeddings/stats", tags=["P3 - Embeddings"])
async def get_embedding_stats():
    """P3: Get embedding optimizer statistics."""
    from app.embedding.embedding_optimizer import get_embedding_optimizer

    optimizer = get_embedding_optimizer()
    return optimizer.get_stats()


@app.delete("/api/v1/embeddings/cache", tags=["P3 - Embeddings"])
async def clear_embedding_cache(
    authenticated: bool = Depends(verify_api_key),
):
    """P3: Clear the embedding cache."""
    from app.embedding.embedding_optimizer import get_embedding_optimizer

    optimizer = get_embedding_optimizer()
    await optimizer.clear_cache()

    return {"status": "success", "message": "Embedding cache cleared"}


# =============================================================================
# P0: PUBMEDBERT EMBEDDING STATUS ENDPOINTS
# =============================================================================

@app.get("/api/v1/embeddings/model-status", tags=["P0 - Embeddings"])
async def get_embedding_model_status():
    """
    P0: Get PubMedBERT embedding model status.

    Returns model information including:
    - Model name and dimension
    - Device (CPU/GPU)
    - Warmup status
    - Statistics
    """
    from app.embedding.pubmedbert_embeddings import get_pubmedbert_service

    try:
        service = await get_pubmedbert_service()
        return {
            "status": "ready",
            "model_info": service.get_model_info(),
            "stats": service.get_stats(),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


@app.post("/api/v1/embeddings/warmup", tags=["P0 - Embeddings"])
async def warmup_embedding_model_endpoint(
    authenticated: bool = Depends(verify_api_key),
):
    """
    P0: Manually trigger embedding model warmup.

    Useful for pre-loading the model after deployment.
    """
    from app.embedding.pubmedbert_embeddings import warmup_embedding_model

    result = await warmup_embedding_model()
    return result


@app.get("/api/v1/embeddings/test", tags=["P0 - Embeddings"])
async def test_embedding_generation(text: str = "patient has diabetes mellitus type 2"):
    """
    P0: Test embedding generation with sample text.

    Returns embedding result for verification.
    """
    from app.embedding.pubmedbert_embeddings import get_pubmedbert_service

    try:
        service = await get_pubmedbert_service()
        result = await service.embed(text)

        return {
            "status": "success",
            "text": text,
            "embedding_dimension": result.dimension,
            "model": result.model,
            "cached": result.cached,
            "generation_time_ms": round(result.generation_time_ms, 2),
            "embedding_preview": result.embedding[:10],  # First 10 values
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


# =============================================================================
# P1: HYBRID RETRIEVAL ENDPOINTS
# =============================================================================

class HybridQueryRequest(BaseModel):
    """Hybrid retrieval query request."""
    query: str = Field(..., description="Medical query text", min_length=3, max_length=5000)
    top_k: int = Field(50, ge=1, le=100, description="Number of results to retrieve")
    min_score: float = Field(0.3, ge=0.0, le=1.0, description="Minimum relevance score")
    enable_expansion: bool = Field(True, description="Enable query expansion")
    use_multi_query: bool = Field(True, description="Enable multi-query generation")
    decompose_complex: bool = Field(True, description="Decompose complex queries")


class HybridQueryResponse(BaseModel):
    """Hybrid retrieval query response."""
    query: str
    expanded_query: Optional[str] = None
    query_variations: List[str] = []
    results: List[Dict[str, Any]] = []
    total_results: int = 0
    latency_ms: float = 0.0
    bm25_docs_count: int = 0
    semantic_docs_count: int = 0
    metadata: Dict[str, Any] = {}


@app.post("/api/v1/hybrid-query", response_model=HybridQueryResponse, tags=["P1 - Hybrid Retrieval"])
async def hybrid_query_medical_literature(
    request: HybridQueryRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P1: Hybrid retrieval combining BM25 + Semantic search with RRF fusion.

    Features:
    - BM25 keyword search with medical synonym support
    - Semantic search with PubMedBERT embeddings
    - Reciprocal Rank Fusion (RRF) for combining results
    - Recency-weighted scoring
    - Multi-query generation for improved coverage
    - Query decomposition for complex queries

    Architecture:
    - Medical RAG (Port 3031): PRIMARY diagnostic engine
    - LangChain RAG (Port 3032): SECONDARY with fallback chain
    """
    start_time = time.time()

    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine
        from app.retrieval.multi_query import get_multi_query_generator
        from app.retrieval.query_decomposition import get_query_decomposer
        from app.embedding.pubmedbert_embeddings import get_pubmedbert_service

        # Get hybrid engine
        hybrid_engine = get_hybrid_engine()
        if not hybrid_engine._initialized:
            await hybrid_engine.initialize()

        # Generate query variations if enabled
        query_variations = []
        if request.use_multi_query:
            multi_query_gen = get_multi_query_generator()
            mq_result = multi_query_gen.generate(request.query, num_variations=3)
            query_variations = mq_result.all_queries

        # Decompose complex query if enabled
        sub_queries = []
        if request.decompose_complex:
            decomposer = get_query_decomposer()
            decomp_result = decomposer.decompose(request.query)
            if decomp_result.is_complex:
                sub_queries = [sq.query for sq in decomp_result.sub_queries]

        # Generate query embedding
        embedder = await get_pubmedbert_service()
        embedding_result = await embedder.embed(request.query)
        query_embedding = embedding_result.embedding

        # Perform hybrid search
        result = await hybrid_engine.hybrid_search(
            query=request.query,
            query_embedding=query_embedding,
            top_k=request.top_k,
            min_score=request.min_score,
            enable_expansion=request.enable_expansion,
        )

        # Format results
        formatted_results = [r.to_dict() for r in result.results]

        latency_ms = (time.time() - start_time) * 1000

        return HybridQueryResponse(
            query=request.query,
            expanded_query=result.expanded_query,
            query_variations=query_variations,
            results=formatted_results,
            total_results=len(formatted_results),
            latency_ms=latency_ms,
            bm25_docs_count=result.bm25_docs_count,
            semantic_docs_count=result.semantic_docs_count,
            metadata={
                "bm25_latency_ms": result.bm25_latency_ms,
                "semantic_latency_ms": result.semantic_latency_ms,
                "fusion_latency_ms": result.fusion_latency_ms,
                "sub_queries": sub_queries,
            }
        )

    except Exception as e:
        logger.error(f"Hybrid query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/hybrid/stats", tags=["P1 - Hybrid Retrieval"])
async def get_hybrid_retrieval_stats():
    """P1: Get hybrid retrieval engine statistics including BM25 index info."""
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        return engine.get_stats()

    except Exception as e:
        logger.error(f"Failed to get hybrid stats: {e}")
        return {"status": "error", "error": str(e)}


@app.post("/api/v1/hybrid/index-document", tags=["P1 - Hybrid Retrieval"])
async def add_document_to_bm25(
    doc_id: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P1: Add a document to the BM25 index.

    Args:
        doc_id: Unique document identifier
        content: Document text content
        metadata: Optional metadata dictionary
    """
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        engine.bm25.add_document(doc_id, content, metadata or {})

        return {
            "status": "success",
            "doc_id": doc_id,
            "total_documents": engine.bm25.total_docs,
        }

    except Exception as e:
        logger.error(f"Failed to add document to BM25: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/hybrid/index-document/{doc_id}", tags=["P1 - Hybrid Retrieval"])
async def remove_document_from_bm25(
    doc_id: str,
    authenticated: bool = Depends(verify_api_key),
):
    """P1: Remove a document from the BM25 index."""
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        engine.bm25.remove_document(doc_id)

        return {
            "status": "success",
            "doc_id": doc_id,
            "total_documents": engine.bm25.total_docs,
        }

    except Exception as e:
        logger.error(f"Failed to remove document from BM25: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/hybrid/sync-from-pinecone", tags=["P1 - Hybrid Retrieval"])
async def sync_bm25_from_pinecone(
    max_docs: int = 10000,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P1: Sync BM25 index from Pinecone vectors.

    This populates the BM25 index with documents from the vector database.
    Used for cross-pipeline sync with LangChain RAG (Port 3032).

    Args:
        max_docs: Maximum number of documents to sync
    """
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        if not engine._initialized:
            await engine.initialize()

        result = await engine.sync_bm25_from_pinecone(max_docs=max_docs)

        return result

    except Exception as e:
        logger.error(f"BM25 sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/hybrid/clear-index", tags=["P1 - Hybrid Retrieval"])
async def clear_bm25_index(
    authenticated: bool = Depends(verify_api_key),
):
    """P1: Clear the entire BM25 index."""
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        result = engine.clear_bm25_index()

        return result

    except Exception as e:
        logger.error(f"Failed to clear BM25 index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/recency-score", tags=["P1 - Hybrid Retrieval"])
async def calculate_recency_score(
    publication_date: str,
    publication_type: str = "general",
):
    """
    P1: Calculate recency score for a publication.

    Args:
        publication_date: Publication date (YYYY-MM-DD)
        publication_type: Type of publication for decay rate
            - guidelines: 2-year decay
            - clinical_trials: 1-year decay
            - case_reports: 5-year decay
            - general: 3-year decay (default)
    """
    try:
        from app.retrieval.hybrid_retrieval import get_hybrid_engine

        engine = get_hybrid_engine()
        score = engine._calculate_recency_score(publication_date, publication_type)

        return {
            "publication_date": publication_date,
            "publication_type": publication_type,
            "recency_score": round(score, 4),
        }

    except Exception as e:
        logger.error(f"Failed to calculate recency score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/multi-query", tags=["P1 - Hybrid Retrieval"])
async def generate_multi_query(
    query: str,
    num_variations: int = 3,
):
    """
    P1: Generate multiple query variations for improved retrieval coverage.

    Strategies:
    - Synonym expansion (medical synonyms)
    - Abbreviation expansion (medical abbreviations)
    - Query simplification (remove stop words)
    - Key term extraction
    """
    try:
        from app.retrieval.multi_query import get_multi_query_generator

        generator = get_multi_query_generator()
        result = generator.generate(query, num_variations=num_variations)

        return result.to_dict()

    except Exception as e:
        logger.error(f"Multi-query generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/query-decompose", tags=["P1 - Hybrid Retrieval"])
async def decompose_query(query: str):
    """
    P1: Decompose a complex medical query into simpler sub-queries.

    Strategies:
    - Connective-based: Split by 'and', 'vs', 'or'
    - Pattern-based: Match known complex query patterns
    - Symptom-based: Split symptom lists
    """
    try:
        from app.retrieval.query_decomposition import get_query_decomposer

        decomposer = get_query_decomposer()
        result = decomposer.decompose(query)

        return result.to_dict()

    except Exception as e:
        logger.error(f"Query decomposition failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# P0: RE-EMBEDDING PIPELINE ENDPOINTS
# =============================================================================

@app.get("/api/v1/reembedding/status", tags=["P0 - Reembedding"])
async def get_reembedding_status():
    """
    P0: Get Pinecone index status and re-embedding requirements.

    Returns:
    - Vector count
    - Estimated migration time
    - Model information
    """
    from app.embedding.reembed_pipeline import estimate_migration_time

    try:
        estimate = await estimate_migration_time()

        return {
            "index_name": settings.PINECONE_INDEX_NAME,
            "namespace": settings.PINECONE_NAMESPACE,
            "current_model": settings.EMBEDDING_MODEL,
            "embedding_dimension": settings.EMBEDDING_DIMENSION,
            **estimate,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


@app.post("/api/v1/reembedding/start", tags=["P0 - Reembedding"])
async def start_reembedding(
    batch_size: int = 100,
    dry_run: bool = False,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P0: Start re-embedding migration for existing vectors.

    Args:
        batch_size: Number of vectors per batch
        dry_run: If True, don't actually update vectors

    WARNING: This operation can take significant time for large indexes.
    """
    from app.embedding.reembed_pipeline import run_reembedding

    try:
        result = await run_reembedding(batch_size=batch_size, dry_run=dry_run)
        return result
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


# =============================================================================
# P2: CLINICAL GUIDELINE INTEGRATION ENDPOINTS
# =============================================================================

@app.get("/api/v1/guidelines", tags=["P2 - Guidelines"])
async def list_clinical_guidelines(
    domain: Optional[str] = None,
    source: Optional[str] = None,
):
    """
    P2: List available clinical practice guidelines.
    
    Supports filtering by:
    - domain: cardiovascular, oncology, infectious_disease, etc.
    - source: AHA/ACC, ESC, NCCN, IDSA, etc.
    """
    from app.guidelines.clinical_guidelines import (
        get_guideline_engine, ClinicalDomain, GuidelineSource
    )
    
    engine = get_guideline_engine()
    
    domain_enum = None
    if domain:
        try:
            domain_enum = ClinicalDomain(domain.lower())
        except ValueError:
            pass
    
    source_enum = None
    if source:
        try:
            source_enum = GuidelineSource(source)
        except ValueError:
            pass
    
    guidelines = engine.list_guidelines(domain=domain_enum, source=source_enum)
    
    return {
        "guidelines": [g.to_dict() for g in guidelines],
        "total": len(guidelines),
    }


@app.get("/api/v1/guidelines/{guideline_id}", tags=["P2 - Guidelines"])
async def get_clinical_guideline(guideline_id: str):
    """P2: Get a specific clinical guideline by ID."""
    from app.guidelines.clinical_guidelines import get_guideline_engine
    
    engine = get_guideline_engine()
    guideline = engine.get_guideline_by_id(guideline_id)
    
    if guideline is None:
        raise HTTPException(status_code=404, detail="Guideline not found")
    
    return guideline.to_dict()


@app.post("/api/v1/guidelines/search", tags=["P2 - Guidelines"])
async def search_clinical_guidelines(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    icd10_codes: Optional[List[str]] = None,
    top_k: int = 5,
):
    """
    P2: Search for relevant clinical guidelines.
    
    Returns guidelines with patient-specific applicability scores and
    relevant recommendations.
    """
    from app.guidelines.clinical_guidelines import (
        get_guideline_engine, ClinicalDomain
    )
    
    engine = get_guideline_engine()
    
    results = engine.search_guidelines(
        query=query,
        patient_context=patient_context,
        icd10_codes=icd10_codes,
        top_k=top_k,
    )
    
    return {
        "query": query,
        "results": [r.to_dict() for r in results],
        "total": len(results),
    }


@app.post("/api/v1/guidelines/recommendations", tags=["P2 - Guidelines"])
async def get_guideline_recommendations(
    condition: str,
    patient_context: Optional[Dict[str, Any]] = None,
):
    """
    P2: Get evidence-based recommendations for a specific condition.
    
    Returns recommendations from relevant guidelines with applicability scores.
    """
    from app.guidelines.clinical_guidelines import get_guideline_engine
    
    engine = get_guideline_engine()
    recommendations = engine.get_recommendations_for_condition(
        condition=condition,
        patient_context=patient_context,
    )
    
    return {
        "condition": condition,
        "recommendations": recommendations,
        "total": len(recommendations),
    }


@app.post("/api/v1/guidelines/conflicts", tags=["P2 - Guidelines"])
async def check_guideline_conflicts(
    patient_context: Dict[str, Any],
):
    """
    P2: Check for conflicts between applicable guidelines.
    
    Analyzes patient conditions and medications against guideline
    recommendations to identify potential conflicts.
    """
    from app.guidelines.clinical_guidelines import get_guideline_engine
    
    engine = get_guideline_engine()
    conflicts = engine.check_guideline_conflicts(patient_context)
    
    return {
        "conflicts": conflicts,
        "total": len(conflicts),
    }


@app.get("/api/v1/guidelines/stats", tags=["P2 - Guidelines"])
async def get_guideline_stats():
    """P2: Get clinical guideline engine statistics."""
    from app.guidelines.clinical_guidelines import get_guideline_engine
    
    engine = get_guideline_engine()
    return engine.get_stats()


# =============================================================================
# P2: UMLS/SNOMED TERMINOLOGY ENDPOINTS
# =============================================================================

@app.get("/api/v1/terminology/lookup", tags=["P2 - Terminology"])
async def lookup_medical_concept(
    query: str,
    system: Optional[str] = None,
):
    """
    P2: Look up a medical concept by name or code.
    
    Supports lookup by:
    - Concept name (e.g., "myocardial infarction")
    - Synonym (e.g., "heart attack")
    - Code with system (e.g., ICD10CM=I21.9)
    
    Returns UMLS concept with SNOMED CT, ICD-10, RxNorm, MeSH mappings.
    """
    from app.terminology.umls_snomed import (
        get_terminology_engine, TerminologySystem
    )
    
    engine = get_terminology_engine()
    
    system_enum = None
    if system:
        try:
            system_enum = TerminologySystem(system.upper())
        except ValueError:
            pass
    
    concept = engine.lookup_concept(query, system_enum)
    
    if concept is None:
        return {
            "query": query,
            "found": False,
            "concept": None,
        }
    
    return {
        "query": query,
        "found": True,
        "concept": concept.to_dict(),
    }


@app.get("/api/v1/terminology/search", tags=["P2 - Terminology"])
async def search_medical_concepts(
    query: str,
    semantic_type: Optional[str] = None,
    top_k: int = 10,
):
    """
    P2: Search for medical concepts matching a query.
    
    Optional filtering by semantic type:
    - disease, symptom, drug, procedure, anatomy, lab_test
    """
    from app.terminology.umls_snomed import (
        get_terminology_engine, SemanticType
    )
    
    engine = get_terminology_engine()
    
    type_enum = None
    if semantic_type:
        type_map = {
            "disease": SemanticType.DISEASE_SYNDROME,
            "symptom": SemanticType.SIGN_SYMPTOM,
            "drug": SemanticType.PHARMACOLOGIC_SUBSTANCE,
            "procedure": SemanticType.THERAPEUTIC_PREVENTIVE_PROCEDURE,
            "anatomy": SemanticType.BODY_PART_ORGAN_ORGAN_COMPONENT,
            "lab_test": SemanticType.LABORATORY_PROCEDURE,
        }
        type_enum = type_map.get(semantic_type.lower())
    
    concepts = engine.search_concepts(query, type_enum, top_k)
    
    return {
        "query": query,
        "concepts": [c.to_dict() for c in concepts],
        "total": len(concepts),
    }


@app.post("/api/v1/terminology/extract", tags=["P2 - Terminology"])
async def extract_medical_entities_endpoint(
    text: str,
    semantic_types: Optional[List[str]] = None,
):
    """
    P2: Extract medical entities from clinical text.
    
    Returns recognized entities with:
    - Concept information (CUI, name, codes)
    - Position in text
    - Context snippet
    - Confidence score
    """
    from app.terminology.umls_snomed import (
        get_terminology_engine, SemanticType
    )
    
    engine = get_terminology_engine()
    
    types_enums = None
    if semantic_types:
        type_map = {
            "disease": SemanticType.DISEASE_SYNDROME,
            "symptom": SemanticType.SIGN_SYMPTOM,
            "drug": SemanticType.PHARMACOLOGIC_SUBSTANCE,
            "procedure": SemanticType.THERAPEUTIC_PREVENTIVE_PROCEDURE,
        }
        types_enums = [type_map.get(t.lower()) for t in semantic_types if t.lower() in type_map]
    
    entities = engine.extract_entities(text, types_enums)
    
    return {
        "text": text[:500] + "..." if len(text) > 500 else text,
        "entities": [e.to_dict() for e in entities],
        "total": len(entities),
    }


@app.get("/api/v1/terminology/map", tags=["P2 - Terminology"])
async def map_medical_code(
    source_system: str,
    source_code: str,
    target_system: str,
):
    """
    P2: Map a code from one terminology system to another.
    
    Supported systems: SNOMEDCT, ICD10CM, ICD10PCS, RXNORM, MESH, LOINC
    
    Example: Map ICD10CM I21.9 to SNOMEDCT
    """
    from app.terminology.umls_snomed import (
        get_terminology_engine, TerminologySystem
    )
    
    engine = get_terminology_engine()
    
    try:
        source_enum = TerminologySystem(source_system.upper())
        target_enum = TerminologySystem(target_system.upper())
    except ValueError as e:
        return {
            "error": f"Invalid terminology system: {str(e)}",
            "valid_systems": [s.value for s in TerminologySystem],
        }
    
    mapping = engine.map_code(source_enum, source_code, target_enum)
    
    if mapping is None:
        return {
            "found": False,
            "source_system": source_system,
            "source_code": source_code,
            "target_system": target_system,
        }
    
    return {
        "found": True,
        "mapping": mapping.to_dict(),
    }


@app.get("/api/v1/terminology/stats", tags=["P2 - Terminology"])
async def get_terminology_stats():
    """P2: Get terminology engine statistics."""
    from app.terminology.umls_snomed import get_terminology_engine
    
    engine = get_terminology_engine()
    return engine.get_stats()


# =============================================================================
# P2: KNOWLEDGE GRAPH ENDPOINTS
# =============================================================================

@app.get("/api/v1/knowledge-graph/node/{node_id}", tags=["P2 - Knowledge Graph"])
async def get_knowledge_node(node_id: str):
    """P2: Get a node from the knowledge graph by ID."""
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    node = kg.get_node(node_id)
    
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    
    return node.to_dict()


@app.get("/api/v1/knowledge-graph/search", tags=["P2 - Knowledge Graph"])
async def search_knowledge_nodes(
    query: str,
    node_type: Optional[str] = None,
    top_k: int = 10,
):
    """
    P2: Search for nodes in the knowledge graph.
    
    Node types: disease, symptom, drug, procedure, anatomy, lab_test
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph, NodeType
    
    kg = get_knowledge_graph()
    
    type_enum = None
    if node_type:
        type_map = {
            "disease": NodeType.DISEASE,
            "symptom": NodeType.SYMPTOM,
            "drug": NodeType.DRUG,
            "procedure": NodeType.PROCEDURE,
            "anatomy": NodeType.ANATOMY,
            "lab_test": NodeType.LAB_TEST,
        }
        type_enum = type_map.get(node_type.lower())
    
    nodes = kg.search_nodes(query, [type_enum] if type_enum else None, top_k)
    
    return {
        "query": query,
        "nodes": [n.to_dict() for n in nodes],
        "total": len(nodes),
    }


@app.get("/api/v1/knowledge-graph/path", tags=["P2 - Knowledge Graph"])
async def find_knowledge_path(
    source: str,
    target: str,
    max_depth: int = 5,
):
    """
    P2: Find the shortest path between two concepts in the knowledge graph.
    
    Useful for:
    - Understanding disease-symptom relationships
    - Discovering treatment pathways
    - Finding connections between drugs and diseases
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    
    # Try to find nodes by name if IDs don't work
    source_node = kg.get_node(source) or kg.find_node_by_name(source)
    target_node = kg.get_node(target) or kg.find_node_by_name(target)
    
    if source_node is None:
        return {"error": f"Source node not found: {source}"}
    if target_node is None:
        return {"error": f"Target node not found: {target}"}
    
    path = kg.find_path(source_node.id, target_node.id, max_depth)
    
    if path is None:
        return {
            "found": False,
            "source": source_node.name,
            "target": target_node.name,
            "message": "No path found within max depth",
        }
    
    return {
        "found": True,
        "path": path.to_dict(),
    }


@app.get("/api/v1/knowledge-graph/subgraph", tags=["P2 - Knowledge Graph"])
async def extract_knowledge_subgraph(
    center: str,
    depth: int = 2,
    node_types: Optional[str] = None,
):
    """
    P2: Extract a subgraph centered on a concept.
    
    Returns all nodes and edges within specified depth of center node.
    
    Example: Get all diseases, symptoms, and treatments related to "diabetes"
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph, NodeType
    
    kg = get_knowledge_graph()
    
    # Find center node
    center_node = kg.get_node(center) or kg.find_node_by_name(center)
    
    if center_node is None:
        return {"error": f"Center node not found: {center}"}
    
    # Parse node types
    type_enums = None
    if node_types:
        type_map = {
            "disease": NodeType.DISEASE,
            "symptom": NodeType.SYMPTOM,
            "drug": NodeType.DRUG,
            "procedure": NodeType.PROCEDURE,
            "anatomy": NodeType.ANATOMY,
        }
        types = [t.strip() for t in node_types.split(",")]
        type_enums = [type_map[t] for t in types if t in type_map]
    
    subgraph = kg.extract_subgraph(center_node.id, depth, type_enums)
    
    return subgraph.to_dict()


@app.get("/api/v1/knowledge-graph/treatments/{disease}", tags=["P2 - Knowledge Graph"])
async def get_disease_treatments(disease: str):
    """
    P2: Get all treatments for a disease from the knowledge graph.
    
    Returns drugs and procedures that treat or prevent the disease.
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    treatments = kg.get_treatments_for_disease(disease)
    
    return {
        "disease": disease,
        "treatments": [
            {
                "treatment": node.to_dict(),
                "relationship": edge.to_dict(),
            }
            for node, edge in treatments
        ],
        "total": len(treatments),
    }


@app.get("/api/v1/knowledge-graph/symptoms/{symptom}/diseases", tags=["P2 - Knowledge Graph"])
async def get_diseases_by_symptom(symptom: str):
    """
    P2: Get all diseases that can cause a symptom.
    
    Useful for differential diagnosis.
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    diseases = kg.get_diseases_for_symptom(symptom)
    
    return {
        "symptom": symptom,
        "diseases": [
            {
                "disease": node.to_dict(),
                "relationship": edge.to_dict(),
            }
            for node, edge in diseases
        ],
        "total": len(diseases),
    }


@app.get("/api/v1/knowledge-graph/drug-interactions/{drug}", tags=["P2 - Knowledge Graph"])
async def get_drug_interactions_kg(drug: str, drug2: Optional[str] = None):
    """
    P2: Get drug-drug interactions from the knowledge graph.
    
    Optionally filter by a second drug to check specific interaction.
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    interactions = kg.get_drug_interactions(drug)
    
    if drug2:
        drug2_lower = drug2.lower()
        interactions = [
            (node, edge) for node, edge in interactions
            if drug2_lower in node.name.lower()
        ]
    
    return {
        "drug": drug,
        "interactions": [
            {
                "interacting_drug": node.to_dict(),
                "interaction": edge.to_dict(),
            }
            for node, edge in interactions
        ],
        "total": len(interactions),
    }


@app.get("/api/v1/knowledge-graph/comorbidities/{disease}", tags=["P2 - Knowledge Graph"])
async def get_disease_comorbidities(disease: str):
    """
    P2: Get comorbidities and related diseases.
    
    Returns diseases that:
    - Predispose to this disease
    - Are caused by this disease
    - Co-occur with this disease
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    comorbidities = kg.get_comorbidities(disease)
    
    return {
        "disease": disease,
        "comorbidities": [
            {
                "related_disease": node.to_dict(),
                "relationship": edge.to_dict(),
            }
            for node, edge in comorbidities
        ],
        "total": len(comorbidities),
    }


@app.get("/api/v1/knowledge-graph/centrality", tags=["P2 - Knowledge Graph"])
async def get_central_concepts(
    node_type: Optional[str] = None,
    top_k: int = 10,
):
    """
    P2: Get the most central concepts in the knowledge graph.
    
    Centrality measures how connected a concept is - useful for
    identifying key medical concepts.
    """
    from app.knowledge.knowledge_graph import get_knowledge_graph, NodeType
    
    kg = get_knowledge_graph()
    
    type_enum = None
    if node_type:
        type_map = {
            "disease": NodeType.DISEASE,
            "symptom": NodeType.SYMPTOM,
            "drug": NodeType.DRUG,
        }
        type_enum = type_map.get(node_type.lower())
    
    central_nodes = kg.get_most_central_nodes(type_enum, top_k)
    
    return {
        "node_type": node_type or "all",
        "central_concepts": [
            {
                "node": node.to_dict(),
                "centrality": round(score, 4),
            }
            for node, score in central_nodes
        ],
    }


@app.get("/api/v1/knowledge-graph/stats", tags=["P2 - Knowledge Graph"])
async def get_knowledge_graph_stats():
    """P2: Get knowledge graph statistics."""
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    kg = get_knowledge_graph()
    return kg.get_stats()


# =============================================================================
# P2: INTEGRATED CLINICAL DECISION SUPPORT
# =============================================================================

@app.post("/api/v1/p2/query", tags=["P2 - Clinical Intelligence"])
async def p2_clinical_intelligence_query(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    include_guidelines: bool = True,
    include_terminology: bool = True,
    include_knowledge_graph: bool = True,
):
    """
    P2: Unified clinical intelligence query combining all P2 components.
    
    This endpoint integrates:
    - Clinical Guidelines: Evidence-based recommendations from AHA/ACC, ESC, NCCN, etc.
    - UMLS/SNOMED Terminology: Medical concept normalization and cross-mapping
    - Knowledge Graph: Disease-symptom-treatment relationships
    
    Returns comprehensive clinical insights with:
    - Terminology matches (CUIs, ICD-10, SNOMED CT codes)
    - Guideline recommendations with applicability scores
    - Knowledge graph insights (treatments, comorbidities, drug interactions)
    - Combined clinical summary
    """
    from app.p2_integration import get_p2_service, ClinicalContext
    
    try:
        service = get_p2_service()
        
        # Convert patient_context to ClinicalContext if provided
        ctx = None
        if patient_context:
            ctx = ClinicalContext(
                conditions=patient_context.get("conditions", []),
                current_medications=patient_context.get("medications", []),
                medication_allergies=patient_context.get("allergies", []),
                age=patient_context.get("age"),
                gender=patient_context.get("gender"),
                chief_complaint=patient_context.get("chief_complaint"),
                presenting_symptoms=patient_context.get("symptoms", []),
            )
        
        result = await service.query_clinical_intelligence(
            query=query,
            patient_context=ctx,
            include_guidelines=include_guidelines,
            include_terminology=include_terminology,
            include_knowledge_graph=include_knowledge_graph,
        )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"P2 query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/p2/normalize", tags=["P2 - Clinical Intelligence"])
async def p2_normalize_term(term: str):
    """
    P2: Normalize a medical term to standard UMLS/SNOMED terminology.
    
    Returns the canonical concept with:
    - CUI (Concept Unique Identifier)
    - Preferred name
    - Semantic types
    - Cross-mapped codes (ICD-10, SNOMED CT, RxNorm, MeSH)
    """
    from app.p2_integration import get_p2_service
    
    try:
        service = get_p2_service()
        result = await service.normalize_term(term)
        
        if result is None:
            return {"found": False, "term": term}
        
        return {"found": True, "term": term, "concept": result}
    
    except Exception as e:
        logger.error(f"P2 normalize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/p2/drug-interactions", tags=["P2 - Clinical Intelligence"])
async def p2_check_drug_interactions(medications: List[str]):
    """
    P2: Check for drug-drug interactions using the knowledge graph.
    
    Args:
        medications: List of medication names to check
    
    Returns:
        List of potential interactions with confidence scores
    """
    from app.p2_integration import get_p2_service
    
    try:
        service = get_p2_service()
        interactions = await service.get_drug_interactions(medications)
        
        return {
            "medications": medications,
            "interactions": interactions,
            "total": len(interactions),
        }
    
    except Exception as e:
        logger.error(f"P2 drug interaction check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/p2/clinical-pathway", tags=["P2 - Clinical Intelligence"])
async def p2_get_clinical_pathway(
    condition: str,
    patient_context: Optional[Dict[str, Any]] = None,
):
    """
    P2: Get clinical pathway for a condition.
    
    Combines:
    - Guideline-based recommendations
    - Knowledge graph treatment relationships
    - Diagnostic steps
    
    Returns a structured clinical pathway.
    """
    from app.p2_integration import get_p2_service, ClinicalContext
    
    try:
        service = get_p2_service()
        
        ctx = None
        if patient_context:
            ctx = ClinicalContext(
                conditions=patient_context.get("conditions", []),
                current_medications=patient_context.get("medications", []),
                age=patient_context.get("age"),
                gender=patient_context.get("gender"),
            )
        
        result = await service.get_clinical_pathway(condition, ctx)
        
        return result
    
    except Exception as e:
        logger.error(f"P2 clinical pathway error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/p2/stats", tags=["P2 - Clinical Intelligence"])
async def p2_get_stats():
    """P2: Get P2 integration service statistics."""
    from app.p2_integration import get_p2_service
    
    try:
        service = get_p2_service()
        return service.get_stats()
    
    except Exception as e:
        logger.error(f"P2 stats error: {e}")
        return {"status": "error", "error": str(e)}


@app.post("/api/v1/clinical-support/comprehensive", tags=["P2 - Clinical Support"])
async def comprehensive_clinical_support(
    patient_context: Dict[str, Any],
):
    """
    P2: Comprehensive clinical decision support.
    
    Integrates:
    - Clinical guidelines search
    - Terminology normalization
    - Knowledge graph relationships
    - Drug interaction checking
    - Comorbidity analysis
    
    Returns unified clinical insights.
    """
    from app.guidelines.clinical_guidelines import get_guideline_engine
    from app.terminology.umls_snomed import get_terminology_engine
    from app.knowledge.knowledge_graph import get_knowledge_graph
    
    # Initialize engines
    guideline_engine = get_guideline_engine()
    terminology_engine = get_terminology_engine()
    knowledge_graph = get_knowledge_graph()
    
    conditions = patient_context.get("conditions", [])
    medications = patient_context.get("medications", [])
    symptoms = patient_context.get("symptoms", [])
    
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "patient_summary": {
            "conditions": conditions,
            "medications": medications,
            "symptoms": symptoms,
        },
        "guidelines": [],
        "terminology": [],
        "knowledge_graph": {},
        "recommendations": [],
    }
    
    # 1. Search guidelines for each condition
    for condition in conditions:
        guideline_results = guideline_engine.search_guidelines(
            query=condition,
            patient_context=patient_context,
            top_k=3,
        )
        for g in guideline_results:
            result["guidelines"].append(g.to_dict())
    
    # 2. Normalize terminology for conditions and medications
    for condition in conditions:
        concept = terminology_engine.lookup_concept(condition)
        if concept:
            result["terminology"].append({
                "term": condition,
                "normalized": concept.to_dict(),
            })
    
    # 3. Knowledge graph analysis
    for condition in conditions:
        treatments = knowledge_graph.get_treatments_for_disease(condition)
        if treatments:
            result["knowledge_graph"][condition] = {
                "treatments": [node.name for node, _ in treatments[:5]],
            }
    
    # 4. Drug interaction check
    if len(medications) > 1:
        interactions = []
        for med in medications[:5]:
            drug_interactions = knowledge_graph.get_drug_interactions(med)
            for node, edge in drug_interactions:
                if node.name in medications or node.name.lower() in [m.lower() for m in medications]:
                    interactions.append({
                        "drug1": med,
                        "drug2": node.name,
                        "confidence": edge.confidence,
                    })
        if interactions:
            result["knowledge_graph"]["drug_interactions"] = interactions
    
    return result


# =============================================================================
# P3: MULTI-MODAL CLINICAL INTELLIGENCE ENDPOINTS
# =============================================================================

@app.post("/api/v1/multimodal/analyze", tags=["P3 - Multi-Modal"])
async def analyze_multimodal_clinical_input(
    inputs: List[Dict[str, Any]],
    patient_context: Optional[Dict[str, Any]] = None,
    enable_cross_modal: bool = True,
):
    """
    P3: Analyze multiple clinical inputs with multi-modal AI.
    
    Supports:
    - Radiology images (X-Ray, CT, MRI, Ultrasound)
    - Dermatology images (skin lesions)
    - Pathology images (histopathology)
    - Medical videos (procedures, endoscopy, gait analysis)
    - Audio recordings (heart sounds, lung sounds, speech)
    
    Each input should have:
    - input_type: radiology_image, dermatology_image, pathology_image, 
                  endoscopy_video, procedure_video, gait_video,
                  heart_sound, lung_sound, patient_speech
    - data: base64 encoded file content
    - metadata: optional modality-specific metadata
    """
    from app.multimodal import get_multimodal_service, ClinicalInput, ClinicalInputType
    import base64
    
    try:
        service = get_multimodal_service()
        
        # Convert inputs
        clinical_inputs = []
        for inp in inputs:
            input_type_str = inp.get("input_type", "general")
            
            # Map input type string to enum
            try:
                input_type = ClinicalInputType(input_type_str)
            except ValueError:
                input_type = ClinicalInputType.RADIOLOGY_IMAGE
            
            # Decode base64 data
            data_str = inp.get("data", "")
            if data_str.startswith("data:"):
                # Remove data URL prefix
                data_str = data_str.split(",", 1)[1] if "," in data_str else data_str
            data = base64.b64decode(data_str)
            
            clinical_inputs.append(ClinicalInput(
                input_type=input_type,
                data=data,
                metadata=inp.get("metadata"),
                clinical_context=inp.get("clinical_context"),
            ))
        
        result = await service.analyze_clinical_input(
            inputs=clinical_inputs,
            patient_context=patient_context,
            enable_cross_modal=enable_cross_modal,
        )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"Multi-modal analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# P3: MULTI-MODAL REQUEST MODELS
# =============================================================================

class MultiModalImageRequest(BaseModel):
    """Request for medical image analysis."""
    image_data: str = Field(..., description="Base64 encoded image data")
    modality: str = Field("general", description="Image modality: xray, ct, mri, ultrasound, mammogram, dermatology, pathology")
    anatomical_region: str = Field("general", description="Anatomical region: chest, abdomen, head, etc.")
    patient_context: Optional[Dict[str, Any]] = None


class MultiModalVideoRequest(BaseModel):
    """Request for medical video analysis."""
    video_data: str = Field(..., description="Base64 encoded video data")
    video_type: str = Field("general", description="Video type: procedure, surgical, gait_analysis, endoscopy, rehabilitation")
    patient_context: Optional[Dict[str, Any]] = None


class MultiModalAudioRequest(BaseModel):
    """Request for medical audio analysis."""
    audio_data: str = Field(..., description="Base64 encoded audio data")
    audio_type: str = Field("general", description="Audio type: heart_sounds, lung_sounds, speech, breathing, cough")
    patient_context: Optional[Dict[str, Any]] = None


class MultiModalDermatologyRequest(BaseModel):
    """Request for dermatology image analysis."""
    image_data: str = Field(..., description="Base64 encoded skin lesion image")
    body_location: Optional[str] = None
    patient_context: Optional[Dict[str, Any]] = None


@app.post("/api/v1/multimodal/image", tags=["P3 - Multi-Modal"])
async def analyze_medical_image(request: MultiModalImageRequest):
    """
    P3: Analyze a medical image.
    
    Supported modalities:
    - xray: X-Ray images
    - ct: CT scans
    - mri: MRI scans
    - ultrasound: Ultrasound images
    - mammogram: Mammography
    - dermatology: Skin lesion images
    - pathology: Histopathology slides
    - endoscopy: Endoscopic images
    - fundoscopy: Fundoscopic images
    
    Returns comprehensive analysis with findings, impression, and recommendations.
    """
    from app.multimodal import get_multimodal_service
    import base64
    
    try:
        service = get_multimodal_service()
        
        # Decode base64
        image_data = request.image_data
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1] if "," in image_data else image_data
        image_bytes = base64.b64decode(image_data)
        
        result = await service.analyze_radiology(
            image_data=image_bytes,
            modality=request.modality,
            anatomical_region=request.anatomical_region,
            patient_context=request.patient_context,
        )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/multimodal/video", tags=["P3 - Multi-Modal"])
async def analyze_medical_video(request: MultiModalVideoRequest):
    """
    P3: Analyze a medical video.
    
    Supported video types:
    - procedure: Medical procedures
    - surgical: Surgical operations
    - gait_analysis: Patient walking/movement assessment
    - endoscopy: Endoscopic procedures
    - rehabilitation: Physical therapy exercises
    - teleconsultation: Video consultations
    - ultrasound_video: Echocardiograms, etc.
    
    Returns comprehensive analysis with findings, key frames, and recommendations.
    """
    from app.multimodal import get_multimodal_service
    import base64
    
    try:
        service = get_multimodal_service()
        
        # Decode base64
        video_data = request.video_data
        if video_data.startswith("data:"):
            video_data = video_data.split(",", 1)[1] if "," in video_data else video_data
        video_bytes = base64.b64decode(video_data)
        
        result = await service.analyze_medical_video(
            video_data=video_bytes,
            video_type=request.video_type,
            patient_context=request.patient_context,
        )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"Video analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/multimodal/audio", tags=["P3 - Multi-Modal"])
async def analyze_medical_audio(request: MultiModalAudioRequest):
    """
    P3: Analyze medical audio recording.
    
    Supported audio types:
    - heart_sounds: Cardiac auscultation
    - lung_sounds: Pulmonary auscultation
    - bowel_sounds: Abdominal auscultation
    - speech: Patient speech analysis
    - breathing: Respiratory patterns
    - cough: Cough analysis
    - voice_biomarker: Voice health indicators
    
    Returns analysis with findings, interpretation, and recommendations.
    """
    from app.multimodal import get_multimodal_service
    import base64
    
    try:
        service = get_multimodal_service()
        
        # Decode base64
        audio_data = request.audio_data
        if audio_data.startswith("data:"):
            audio_data = audio_data.split(",", 1)[1] if "," in audio_data else audio_data
        audio_bytes = base64.b64decode(audio_data)
        
        # Route to appropriate analyzer
        if request.audio_type == "heart_sounds":
            result = await service.analyze_heart_sounds(
                audio_data=audio_bytes,
                patient_context=request.patient_context,
            )
        elif request.audio_type == "lung_sounds":
            result = await service.analyze_lung_sounds(
                audio_data=audio_bytes,
                patient_context=request.patient_context,
            )
        else:
            result = await service._orchestrator.analyze_single_audio(
                audio_data=audio_bytes,
                audio_type=request.audio_type,
                context=request.patient_context,
            )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/multimodal/dermatology", tags=["P3 - Multi-Modal"])
async def analyze_dermatology_image(request: MultiModalDermatologyRequest):
    """
    P3: Analyze dermatology/skin lesion image.
    
    Provides:
    - Lesion description (size, shape, color, borders)
    - ABCDE assessment
    - Differential diagnosis
    - Risk stratification
    - Management recommendations
    """
    from app.multimodal import get_multimodal_service
    import base64
    
    try:
        service = get_multimodal_service()
        
        # Decode base64
        image_data = request.image_data
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1] if "," in image_data else image_data
        image_bytes = base64.b64decode(image_data)
        
        result = await service.analyze_dermatology(
            image_data=image_bytes,
            body_location=request.body_location,
            patient_context=request.patient_context,
        )
        
        return result.to_dict()
    
    except Exception as e:
        logger.error(f"Dermatology analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/multimodal/stats", tags=["P3 - Multi-Modal"])
async def get_multimodal_stats():
    """P3: Get multi-modal service statistics."""
    from app.multimodal import get_multimodal_service
    
    try:
        service = get_multimodal_service()
        return service.get_stats()
    
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return {"status": "error", "error": str(e)}


@app.get("/api/v1/multimodal/supported-types", tags=["P3 - Multi-Modal"])
async def get_supported_multimodal_types():
    """P3: Get all supported input types, modalities, and regions."""
    from app.multimodal.image_analyzer import ImageModality, AnatomicalRegion
    from app.multimodal.video_analyzer import VideoType
    from app.multimodal.audio_analyzer import AudioType
    from app.multimodal.service import ClinicalInputType
    
    return {
        "input_types": [it.value for it in ClinicalInputType],
        "image_modalities": [m.value for m in ImageModality],
        "anatomical_regions": [r.value for r in AnatomicalRegion],
        "video_types": [vt.value for vt in VideoType],
        "audio_types": [at.value for at in AudioType],
    }


# ===== Error Handlers =====

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred",
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


# ===== Main Entry Point =====

if __name__ == "__main__":
    settings = get_settings()
    
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     Medical Diagnostic RAG Service                         ║
    ║                                                            ║
    ║     PubMed/PMC + Pinecone + GLM-4.7-Flash                  ║
    ║                                                            ║
    ║     Port: {settings.PORT}                                              ║
    ║     Docs: http://localhost:{settings.PORT}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
