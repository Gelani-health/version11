"""
LangChain RAG Service - FastAPI Application
============================================

READ/WRITE enabled service with Smart Sync.
Shares Pinecone namespace with Custom RAG.

Key Features:
- Vector ID prefixing (lc_) for uniqueness
- source_pipeline metadata tagging
- Smart Sync API endpoints
- Full READ/WRITE capabilities
"""

import asyncio
import time
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
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
    source_filter: Optional[str] = Field(None, description="Filter by source: 'langchain', 'custom_rag', or None")


class IngestRequest(BaseModel):
    """Request to ingest an article."""
    pmid: str = Field(..., description="PubMed ID")
    title: str = Field(..., description="Article title")
    abstract: str = Field(..., description="Article abstract")
    journal: Optional[str] = None
    publication_date: Optional[str] = None
    authors: Optional[List[str]] = None
    mesh_terms: Optional[List[str]] = None
    doi: Optional[str] = None
    pmc_id: Optional[str] = None


class BatchIngestRequest(BaseModel):
    """Request to batch ingest articles."""
    articles: List[IngestRequest] = Field(..., description="Articles to ingest")


class SearchResult(BaseModel):
    """Individual search result."""
    id: str
    score: float
    pmid: str
    title: str
    abstract: str
    journal: Optional[str] = None
    publication_date: Optional[str] = None
    source_pipeline: str = "langchain"


class QueryResponse(BaseModel):
    """Medical query response with Fallback Chain support."""
    query: str
    results: List[SearchResult] = []
    total_results: int = 0
    latency_ms: float = 0.0
    langchain_results: int = 0
    custom_rag_results: int = 0
    # Fallback Chain fields
    fallback_stage: str = "primary"
    confidence: str = "high"
    fallback_attempts: int = 0
    max_score: float = 0.0
    query_count_warning: str = ""
    metadata: Dict[str, Any] = {}


class IngestResponse(BaseModel):
    """Article ingestion response."""
    status: str
    pmid: str = ""
    vectors: int = 0
    source_pipeline: str = "langchain"
    vector_id_prefix: str = "lc_"
    message: str = ""


class SyncStatusResponse(BaseModel):
    """Sync status response."""
    langchain_vectors: int = 0
    custom_rag_vectors: int = 0
    total_vectors: int = 0
    last_sync: Optional[str] = None
    sync_enabled: bool = True
    namespace: str = "pubmed"


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str = "langchain-rag-service"
    mode: str = "READ_WRITE"
    services: Dict[str, str] = {}
    timestamp: str = ""
    version: str = "1.0.0"


# ===== Application State =====

class AppState:
    """Application state container."""
    retrieval_engine = None
    ingestion_pipeline = None
    sync_manager = None
    llm = None
    start_time: datetime = datetime.utcnow()


state = AppState()


# ===== Lifespan Management =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler with comprehensive startup."""
    settings = get_settings()

    # ===== STARTUP SEQUENCE =====

    # Step 1: Print startup banner
    print(_get_startup_banner(settings))

    # Step 2: Initialize components
    logger.info("[LangChain RAG] Initializing components...")

    # Step 3: Validate configuration
    _validate_config(settings)

    # Step 4: Log service configuration
    _log_configuration(settings)

    # Step 5: Service ready
    logger.info("[LangChain RAG] ✅ Service ready - components will initialize on demand")

    yield

    # ===== SHUTDOWN =====
    logger.info("[LangChain RAG] Shutting down...")

    # Log final stats
    if state.retrieval_engine:
        logger.info(f"[LangChain RAG] Retrieval stats: {state.retrieval_engine.get_stats()}")

    if state.ingestion_pipeline:
        logger.info(f"[LangChain RAG] Ingestion stats: {state.ingestion_pipeline.get_stats()}")

    logger.info("[LangChain RAG] Shutdown complete")


def _get_startup_banner(settings) -> str:
    """Generate comprehensive startup banner."""
    return f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███    ███  █████  ██ ███    ███    ████████ ███████  █████   ██████      ║
║   ████  ████ ██   ██ ██ ████  ████       ██    ██      ██   ██ ██    ██     ║
║   ██ ████ ██ ███████ ██ ██ ████ ██       ██    █████   ███████ ██    ██     ║
║   ██  ██  ██ ██   ██ ██ ██  ██  ██       ██    ██      ██   ██ ██    ██     ║
║   ██      ██ ██   ██ ██ ██      ██       ██    ███████ ██   ██  ██████      ║
║                                                                              ║
║   ████████ ██████   █████  ██████  ████████                                 ║
║      ██    ██   ██ ██   ██ ██   ██ ██                                        ║
║      ██    ██████  ███████ ██████  ██████                                    ║
║      ██    ██      ██   ██ ██   ██ ██                                        ║
║      ██    ██      ██   ██ ██   ██ ████████                                 ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   📊 SERVICE CONFIGURATION                                                   ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Port:                 {settings.PORT:<10}                                          ║
║   Mode:                 {settings.SERVICE_MODE:<10}   ✅ READ/WRITE ENABLED       ║
║   Service:              {settings.SERVICE_NAME:<20}                              ║
║                                                                              ║
║   🗄️  PINECONE CONFIGURATION                                                 ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Index:                {settings.PINECONE_INDEX_NAME:<30}                  ║
║   Namespace:            {settings.PINECONE_NAMESPACE:<10}   (SHARED with Custom RAG)       ║
║   Dimension:            {settings.EMBEDDING_DIMENSION:<10}                              ║
║                                                                              ║
║   🔑 VECTOR ID STRATEGY                                                     ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Prefix:               {settings.VECTOR_ID_PREFIX:<10}   (e.g., lc_pmid_123_chunk_0)      ║
║   Source Pipeline:      {settings.SOURCE_PIPELINE:<10}                              ║
║   Conflict Avoidance:   ✅ ENABLED                                            ║
║                                                                              ║
║   🤖 EMBEDDING MODEL                                                        ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Model:                {settings.EMBEDDING_MODEL:<30}                     ║
║   Device:               {settings.EMBEDDING_DEVICE:<10}                              ║
║   Batch Size:           {settings.EMBEDDING_BATCH_SIZE:<10}                              ║
║                                                                              ║
║   🧠 LLM CONFIGURATION                                                      ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Provider:             Z.AI Direct                                          ║
║   Model:                {settings.GLM_MODEL:<20}                         ║
║   Max Tokens:           {settings.GLM_MAX_TOKENS:<10}                              ║
║   Temperature:          {settings.GLM_TEMPERATURE:<10}                              ║
║                                                                              ║
║   🔄 SMART SYNC                                                             ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Enabled:              {'✅ YES' if settings.SYNC_ENABLED else '❌ NO':<10}                              ║
║   Custom RAG URL:       {settings.CUSTOM_RAG_URL:<30}                     ║
║   Batch Size:           {settings.SYNC_BATCH_SIZE:<10}                              ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   📡 API ENDPOINTS                                                          ║
║   ────────────────────────────────────────────────────────────────────────   ║
║   Health:     GET  /health                                                   ║
║   Query:      POST /api/v1/query                                             ║
║   Ingest:     POST /api/v1/ingest          (WRITE)                           ║
║   Batch:      POST /api/v1/ingest/batch    (WRITE)                           ║
║   Delete:     DELETE /api/v1/vectors/{{pmid}} (WRITE)                        ║
║   Sync:       GET  /api/v1/sync/status                                       ║
║   Import:     POST /api/v1/sync/import                                       ║
║   Clear:      DELETE /api/v1/sync/clear                                      ║
║   Stats:      GET  /api/v1/stats                                             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""


def _validate_config(settings):
    """Validate critical configuration."""
    issues = []

    if settings.EMBEDDING_DIMENSION != 768:
        issues.append(f"EMBEDDING_DIMENSION must be 768 (got {settings.EMBEDDING_DIMENSION})")

    if settings.VECTOR_ID_PREFIX != "lc_":
        issues.append(f"VECTOR_ID_PREFIX should be 'lc_' (got '{settings.VECTOR_ID_PREFIX}')")

    if issues:
        for issue in issues:
            logger.warning(f"[LangChain RAG] ⚠️  Configuration issue: {issue}")
    else:
        logger.info("[LangChain RAG] ✅ Configuration validated")


def _log_configuration(settings):
    """Log service configuration details."""
    logger.info(f"[LangChain RAG] Pinecone Index: {settings.PINECONE_INDEX_NAME}")
    logger.info(f"[LangChain RAG] Namespace: {settings.PINECONE_NAMESPACE} (shared)")
    logger.info(f"[LangChain RAG] Vector ID Prefix: {settings.VECTOR_ID_PREFIX}")
    logger.info(f"[LangChain RAG] Source Pipeline: {settings.SOURCE_PIPELINE}")
    logger.info(f"[LangChain RAG] Service Mode: {settings.SERVICE_MODE}")


# ===== Create FastAPI App =====

settings = get_settings()

app = FastAPI(
    title="LangChain RAG Service",
    description="""
LangChain-based RAG service for medical diagnostics with READ/WRITE support.

## Features
- **Shared Namespace**: Uses same Pinecone namespace as Custom RAG
- **Vector ID Prefixing**: All vectors prefixed with `lc_` to avoid conflicts
- **Source Tracking**: Metadata includes `source_pipeline: langchain`
- **Smart Sync**: Synchronize between pipelines
- **Full CRUD**: READ and WRITE operations supported

## Vector ID Format
- LangChain: `lc_pmid_{pmid}_chunk_{index}`
- Custom RAG: `pmid_{pmid}_chunk_{index}`

## API Endpoints
- `POST /api/v1/query` - Semantic search
- `POST /api/v1/ingest` - Ingest single article
- `POST /api/v1/ingest/batch` - Batch ingest articles
- `DELETE /api/v1/vectors/{pmid}` - Delete vectors by PMID
- `GET /api/v1/sync/status` - Check sync status
- `POST /api/v1/sync/import` - Import from Custom RAG
- `DELETE /api/v1/sync/clear` - Clear LangChain vectors
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
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
        service="langchain-rag-service",
        mode="READ_WRITE",
        services={
            "pinecone": "configured",
            "llm": "configured" if settings.ZAI_API_KEY else "not_configured",
            "sync": "enabled" if settings.SYNC_ENABLED else "disabled",
        },
        timestamp=datetime.utcnow().isoformat(),
    )


# ===== Query Endpoint =====

@app.post("/api/v1/query", response_model=QueryResponse, tags=["RAG"])
async def query_medical_literature(
    request: QueryRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Query medical literature with RAG and Fallback Chain.

    Query Processing Flow:
    1. Cache Check → Multi-Query Retrieval → Cross-Encoder Re-Ranking
    2. Threshold Check: max_score >= 0.60?
    3. If FAIL: Activate Fallback Chain
       - Fallback 1: Lower Threshold (0.40)
       - Fallback 2: Simplified Query
       - Fallback 3: Direct LLM (No RAG)

    Returns results from both LangChain and Custom RAG pipelines,
    identified by `source_pipeline` metadata.
    """
    start_time = time.time()

    try:
        from app.retrieval.rag_engine import LangChainRetrievalEngine

        # Initialize retrieval engine
        if state.retrieval_engine is None:
            state.retrieval_engine = LangChainRetrievalEngine(top_k=request.top_k)

        # Retrieve with fallback chain
        result = await state.retrieval_engine.retrieve(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            specialty=request.specialty,
            source_filter=request.source_filter,
            user_id=request.patient_context.get("user_id", "default") if request.patient_context else "default",
        )

        # Format results
        formatted_results = []
        for doc in result.documents:
            formatted_results.append(SearchResult(
                id=doc.id,
                score=doc.score,
                pmid=doc.pmid,
                title=doc.title,
                abstract=doc.abstract[:500],
                journal=doc.journal,
                publication_date=doc.publication_date,
                source_pipeline=doc.source_pipeline,
            ))

        latency_ms = (time.time() - start_time) * 1000

        return QueryResponse(
            query=request.query,
            results=formatted_results,
            total_results=len(formatted_results),
            latency_ms=latency_ms,
            langchain_results=result.langchain_results,
            custom_rag_results=result.custom_rag_results,
            fallback_stage=result.fallback_stage,
            confidence=result.confidence,
            fallback_attempts=result.fallback_attempts,
            max_score=result.max_score,
            metadata={
                "source_filter": request.source_filter,
                "specialty": request.specialty,
            }
        )

    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Ingestion Endpoints (WRITE) =====

@app.post("/api/v1/ingest", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_article(
    request: IngestRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Ingest a single article into Pinecone.

    Creates vectors with:
    - ID: lc_pmid_{pmid}_chunk_{index}
    - Metadata: source_pipeline='langchain'
    """
    try:
        from app.embedding.embedding_pipeline import LangChainIngestionPipeline

        # Initialize pipeline
        if state.ingestion_pipeline is None:
            state.ingestion_pipeline = LangChainIngestionPipeline()

        # Convert request to article dict
        article = {
            "pmid": request.pmid,
            "title": request.title,
            "abstract": request.abstract,
            "journal": request.journal,
            "publication_date": request.publication_date,
            "authors": request.authors or [],
            "mesh_terms": request.mesh_terms or [],
            "doi": request.doi,
            "pmc_id": request.pmc_id,
        }

        # Ingest
        result = await state.ingestion_pipeline.ingest_article(article)

        return IngestResponse(
            status="success",
            pmid=request.pmid,
            vectors=result.get("vectors", 0),
            source_pipeline="langchain",
            vector_id_prefix="lc_",
            message=f"Ingested article with {result.get('vectors', 0)} vectors",
        )

    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        return IngestResponse(
            status="error",
            pmid=request.pmid,
            message=str(e),
        )


@app.post("/api/v1/ingest/batch", tags=["Ingestion"])
async def batch_ingest_articles(
    request: BatchIngestRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Batch ingest articles into Pinecone.

    All vectors will have:
    - ID: lc_pmid_{pmid}_chunk_{index}
    - Metadata: source_pipeline='langchain'
    """
    try:
        from app.embedding.embedding_pipeline import LangChainIngestionPipeline

        # Initialize pipeline
        if state.ingestion_pipeline is None:
            state.ingestion_pipeline = LangChainIngestionPipeline()

        # Convert requests to article dicts
        articles = [
            {
                "pmid": article.pmid,
                "title": article.title,
                "abstract": article.abstract,
                "journal": article.journal,
                "publication_date": article.publication_date,
                "authors": article.authors or [],
                "mesh_terms": article.mesh_terms or [],
                "doi": article.doi,
                "pmc_id": article.pmc_id,
            }
            for article in request.articles
        ]

        # Batch ingest
        result = await state.ingestion_pipeline.ingest_articles_batch(articles)

        return {
            "status": "success",
            "source_pipeline": "langchain",
            "vector_id_prefix": "lc_",
            **result,
        }

    except Exception as e:
        logger.error(f"Batch ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/vectors/{pmid}", tags=["Ingestion"])
async def delete_vectors_by_pmid(
    pmid: str,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Delete all LangChain vectors for a given PMID.

    Only deletes vectors with `lc_` prefix.
    """
    try:
        from app.embedding.embedding_pipeline import LangChainIngestionPipeline

        # Initialize pipeline
        if state.ingestion_pipeline is None:
            state.ingestion_pipeline = LangChainIngestionPipeline()

        result = await state.ingestion_pipeline.delete_vectors_by_pmid(pmid)

        return {
            "status": "success",
            "pmid": pmid,
            "source_pipeline": "langchain",
            "message": f"Deleted LangChain vectors for PMID: {pmid}",
            **result,
        }

    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Smart Sync Endpoints =====

@app.get("/api/v1/sync/status", response_model=SyncStatusResponse, tags=["Sync"])
async def get_sync_status():
    """
    Get sync status between LangChain and Custom RAG pipelines.

    Returns counts of vectors from each pipeline.
    """
    try:
        from app.sync.smart_sync import SmartSyncManager

        # Initialize sync manager
        if state.sync_manager is None:
            state.sync_manager = SmartSyncManager()

        status = await state.sync_manager.get_sync_status()

        return SyncStatusResponse(
            langchain_vectors=status.langchain_vectors,
            custom_rag_vectors=status.custom_rag_vectors,
            total_vectors=status.total_vectors,
            last_sync=status.last_sync,
            sync_enabled=status.sync_enabled,
            namespace=status.to_dict().get("namespace", "pubmed"),
        )

    except Exception as e:
        logger.error(f"Sync status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sync/import", tags=["Sync"])
async def import_from_custom_rag(
    max_vectors: int = 1000,
    overwrite: bool = False,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Import vectors from Custom RAG to LangChain pipeline.

    Creates new vectors with `lc_` prefix from existing Custom RAG vectors.
    """
    try:
        from app.sync.smart_sync import SmartSyncManager

        # Initialize sync manager
        if state.sync_manager is None:
            state.sync_manager = SmartSyncManager()

        result = await state.sync_manager.import_from_custom_rag(
            max_vectors=max_vectors,
            overwrite=overwrite,
        )

        return result.to_dict()

    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/sync/clear", tags=["Sync"])
async def clear_langchain_vectors(
    authenticated: bool = Depends(verify_api_key),
):
    """
    Delete all LangChain vectors (with `lc_` prefix).

    This preserves Custom RAG vectors.
    """
    try:
        from app.sync.smart_sync import SmartSyncManager

        # Initialize sync manager
        if state.sync_manager is None:
            state.sync_manager = SmartSyncManager()

        result = await state.sync_manager.clear_langchain_vectors()

        return result.to_dict()

    except Exception as e:
        logger.error(f"Clear error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Stats Endpoint =====

@app.get("/api/v1/stats", tags=["Monitoring"])
async def get_service_stats():
    """Get service statistics including Fallback Chain metrics."""
    stats = {
        "service": "langchain-rag-service",
        "mode": "READ_WRITE",
        "uptime_seconds": (datetime.utcnow() - state.start_time).total_seconds(),
        "vector_id_prefix": "lc_",
        "source_pipeline": "langchain",
        "retrieval": {},
        "ingestion": {},
        "llm": {},
        "fallback_chain": {
            "enabled": True,
            "thresholds": {
                "primary": 0.60,
                "fallback_1": 0.40,
                "fallback_2": 0.25,
            },
            "query_count_limits": {
                "soft_limit": 10,
                "hard_limit": 50,
            },
        },
    }

    if state.retrieval_engine:
        retrieval_stats = state.retrieval_engine.get_stats()
        stats["retrieval"] = retrieval_stats
        
        # Add fallback chain specific stats
        if "fallback_1_count" in retrieval_stats:
            stats["fallback_chain"]["activations"] = {
                "total": retrieval_stats.get("fallback_activations", 0),
                "fallback_1_lower_threshold": retrieval_stats.get("fallback_1_count", 0),
                "fallback_2_simplified_query": retrieval_stats.get("fallback_2_count", 0),
                "fallback_3_direct_llm": retrieval_stats.get("fallback_3_count", 0),
                "all_failed": retrieval_stats.get("all_failed_count", 0),
            }

    if state.ingestion_pipeline:
        stats["ingestion"] = state.ingestion_pipeline.get_stats()

    if state.llm:
        stats["llm"] = state.llm.get_stats()

    return stats


# ===== Specialties Endpoint =====

@app.get("/api/v1/specialties", tags=["Reference"])
async def get_specialties():
    """Get available medical specialties with MeSH terms."""
    return {
        "specialties": MESH_SPECIALTIES,
        "total": len(MESH_SPECIALTIES),
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
            "service": "langchain-rag-service",
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
            "service": "langchain-rag-service",
        }
    )


# ===== Main Entry Point =====

if __name__ == "__main__":
    settings = get_settings()

    print(_get_startup_banner(settings))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
