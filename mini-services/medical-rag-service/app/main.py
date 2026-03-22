"""
Medical Diagnostic RAG Service - FastAPI Application
=====================================================

Main entry point for the medical RAG service.
Integrates PubMed/PMC, Pinecone, and GLM-4.7-Flash.
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
    logger.info(f"NCBI Email: {settings.NCBI_EMAIL}")
    logger.info(f"GLM Model: {settings.GLM_MODEL} (via Together AI)")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    logger.info("-" * 60)
    logger.info("Service ready - components will initialize on demand")
    
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
