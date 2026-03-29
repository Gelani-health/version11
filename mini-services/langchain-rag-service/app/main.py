"""
P9: LangChain RAG Service - Thin HTTP Proxy
============================================

This service has been demoted to a pure HTTP proxy that forwards all requests
to the authoritative Medical RAG Service on port 3031.

Architecture Decision:
- Medical RAG (Port 3031): PRIMARY diagnostic engine with full P1-P9 features
- LangChain RAG (Port 3032): Thin proxy for backward compatibility

Why this change:
- Previously duplicated retrieval logic between services
- Medical RAG now has authoritative RAG pipeline with:
  - PubMed/Pinecone ingestion with 7 clinical namespaces
  - Hybrid BM25 + semantic search with RRF
  - MeSH synonym expansion
  - Citation validation

This file keeps the service alive for backward compatibility with any external
callers expecting the port 3032 interface.
"""

import asyncio
import time
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import httpx
from loguru import logger

from app.core.config import get_settings


# =============================================================================
# CONFIGURATION
# =============================================================================

MEDICAL_RAG_URL = os.environ.get("MEDICAL_RAG_URL", "http://localhost:3031")
PROXY_TIMEOUT = 30.0  # 30 seconds timeout

import os


# =============================================================================
# REQUEST/RESPONSE MODELS (Kept for backward compatibility)
# =============================================================================

class QueryRequest(BaseModel):
    """Medical diagnostic query request."""
    query: str = Field(..., description="Medical query text", min_length=3, max_length=5000)
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Patient context data")
    specialty: Optional[str] = Field(None, description="Medical specialty filter")
    top_k: int = Field(50, ge=1, le=100, description="Number of results to retrieve")
    min_score: float = Field(0.5, ge=0.0, le=1.0, description="Minimum relevance score")
    source_filter: Optional[str] = Field(None, description="Filter by source")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str = "langchain-rag-proxy"
    mode: str = "PROXY"
    target_url: str = MEDICAL_RAG_URL
    timestamp: str = ""


# =============================================================================
# APPLICATION STATE
# =============================================================================

class AppState:
    """Application state container."""
    http_client: Optional[httpx.AsyncClient] = None
    start_time: datetime = datetime.utcnow()


state = AppState()


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    
    # Startup
    logger.info("=" * 60)
    logger.info("Starting LangChain RAG Proxy Service")
    logger.info("=" * 60)
    logger.info(f"Mode: PROXY (forwarding to {MEDICAL_RAG_URL})")
    logger.info(f"Port: {settings.PORT}")
    logger.info("-" * 60)
    
    # Initialize HTTP client
    state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(PROXY_TIMEOUT),
        follow_redirects=True,
    )
    
    logger.info("Service ready - proxying to Medical RAG Service")
    
    yield
    
    # Shutdown
    if state.http_client:
        await state.http_client.aclose()
    logger.info("Shutting down LangChain RAG Proxy Service...")


# =============================================================================
# CREATE FASTAPI APP
# =============================================================================

app = FastAPI(
    title="LangChain RAG Proxy Service",
    description="""
Thin HTTP proxy for the Medical RAG Service.

All requests are forwarded to the authoritative Medical RAG Service on port 3031.
This service exists for backward compatibility with external callers on port 3032.

## Proxied Endpoints
All endpoints are forwarded unchanged to the Medical RAG Service.
    """,
    version="2.0.0",
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

# PROMPT 13: Health Check Router
from app.api.health import router as health_router
app.include_router(health_router)

# PROMPT 13: Initialize OpenTelemetry
from app.telemetry import init_telemetry
tracer = init_telemetry(app, "langchain-rag-proxy", "2.0.0")

# PROMPT 13: Prometheus FastAPI Instrumentator
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# =============================================================================
# AUTHENTICATION
# =============================================================================

async def verify_api_key(x_api_key: str = Header(None)) -> bool:
    """Verify API key for protected endpoints."""
    if not settings.API_SECRET_KEY:
        return True
    
    if x_api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check proxy health status."""
    return HealthResponse(
        status="healthy",
        service="langchain-rag-proxy",
        mode="PROXY",
        target_url=MEDICAL_RAG_URL,
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/health/deep", tags=["System"])
async def deep_health_check():
    """Check connectivity to upstream Medical RAG Service."""
    try:
        response = await state.http_client.get(f"{MEDICAL_RAG_URL}/health")
        return {
            "status": "healthy" if response.status_code == 200 else "degraded",
            "proxy": "healthy",
            "upstream_status": response.status_code,
            "upstream_url": MEDICAL_RAG_URL,
        }
    except Exception as e:
        return {
            "status": "degraded",
            "proxy": "healthy",
            "upstream_status": "unreachable",
            "upstream_url": MEDICAL_RAG_URL,
            "error": str(e),
        }


# =============================================================================
# PROXY HELPER
# =============================================================================

async def proxy_request(
    method: str,
    path: str,
    request: Request,
    json_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Forward a request to the Medical RAG Service.
    
    Args:
        method: HTTP method (GET, POST, DELETE, etc.)
        path: API path (e.g., "/api/v1/query")
        request: Original FastAPI request object
        json_body: Optional JSON body for POST/PUT requests
    
    Returns:
        Response from Medical RAG Service
    """
    url = f"{MEDICAL_RAG_URL}{path}"
    
    # Forward headers (except Host)
    headers = dict(request.headers)
    headers.pop("host", None)
    
    try:
        if method.upper() == "GET":
            response = await state.http_client.get(url, headers=headers)
        elif method.upper() == "POST":
            response = await state.http_client.post(url, headers=headers, json=json_body)
        elif method.upper() == "PUT":
            response = await state.http_client.put(url, headers=headers, json=json_body)
        elif method.upper() == "DELETE":
            response = await state.http_client.delete(url, headers=headers)
        else:
            raise HTTPException(status_code=405, detail=f"Method {method} not supported")
        
        # Return response
        if response.status_code >= 400:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            )
        
        return response.json()
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gateway timeout - Medical RAG Service not responding")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Bad gateway - {str(e)}")


# =============================================================================
# PROXIED ENDPOINTS
# =============================================================================

@app.post("/api/v1/query", tags=["RAG"])
async def query_medical_literature(
    request: QueryRequest,
    authenticated: bool = Depends(verify_api_key),
):
    """
    Query medical literature with RAG.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        "/api/v1/query",
        request=Request,
        json_body=request.dict(),
    )


@app.post("/api/v1/rag-query", tags=["P9 - RAG Pipeline"])
async def rag_query(
    query: str,
    chief_complaint: Optional[str] = None,
    top_k: int = 10,
    namespaces: Optional[List[str]] = None,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P9: Hybrid RAG query with namespace routing.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    from typing import List
    
    body = {
        "query": query,
        "chief_complaint": chief_complaint,
        "top_k": top_k,
    }
    if namespaces:
        body["namespaces"] = namespaces
    
    return await proxy_request(
        "POST",
        "/api/v1/rag-query",
        request=Request,
        json_body=body,
    )


@app.post("/api/v1/diagnose", tags=["Diagnostic"])
async def diagnose_patient(
    request: Dict[str, Any],
    authenticated: bool = Depends(verify_api_key),
):
    """
    Generate diagnostic recommendation.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        "/api/v1/diagnose",
        request=Request,
        json_body=request,
    )


@app.post("/api/v1/ingest", tags=["Ingestion"])
async def ingest_articles(
    request: Dict[str, Any],
    authenticated: bool = Depends(verify_api_key),
):
    """
    Ingest articles from PubMed.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        "/api/v1/ingest",
        request=Request,
        json_body=request,
    )


@app.post("/api/v1/ingestion/namespace/{namespace}", tags=["P9 - Ingestion"])
async def ingest_namespace(
    namespace: str,
    max_articles: int = 500,
    force: bool = False,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P9: Ingest articles for a specific clinical namespace.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        f"/api/v1/ingestion/namespace/{namespace}?max_articles={max_articles}&force={force}",
        request=Request,
    )


@app.post("/api/v1/ingestion/all-namespaces", tags=["P9 - Ingestion"])
async def ingest_all_namespaces(
    max_articles_per_namespace: int = 500,
    force: bool = False,
    authenticated: bool = Depends(verify_api_key),
):
    """
    P9: Ingest articles for all clinical namespaces.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        f"/api/v1/ingestion/all-namespaces?max_articles_per_namespace={max_articles_per_namespace}&force={force}",
        request=Request,
    )


@app.get("/api/v1/ingestion/status", tags=["P9 - Ingestion"])
async def get_ingestion_status():
    """
    P9: Get ingestion status for all namespaces.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "GET",
        "/api/v1/ingestion/status",
        request=Request,
    )


@app.get("/api/v1/scheduler/status", tags=["Scheduler"])
async def get_scheduler_status():
    """Get scheduler status. Proxied to Medical RAG Service."""
    return await proxy_request(
        "GET",
        "/api/v1/scheduler/status",
        request=Request,
    )


@app.get("/api/v1/specialties", tags=["Reference"])
async def get_specialties():
    """Get available specialties. Proxied to Medical RAG Service."""
    return await proxy_request(
        "GET",
        "/api/v1/specialties",
        request=Request,
    )


@app.post("/api/v1/hybrid-query", tags=["P1 - Hybrid Retrieval"])
async def hybrid_query(
    request: Dict[str, Any],
    authenticated: bool = Depends(verify_api_key),
):
    """
    P1: Hybrid retrieval with BM25 + Semantic search.
    
    Proxied to Medical RAG Service (Port 3031).
    """
    return await proxy_request(
        "POST",
        "/api/v1/hybrid-query",
        request=Request,
        json_body=request,
    )


@app.get("/api/v1/hybrid/stats", tags=["P1 - Hybrid Retrieval"])
async def get_hybrid_stats():
    """P1: Get hybrid retrieval statistics. Proxied to Medical RAG Service."""
    return await proxy_request(
        "GET",
        "/api/v1/hybrid/stats",
        request=Request,
    )


# =============================================================================
# CATCH-ALL PROXY FOR UNMATCHED ROUTES
# =============================================================================

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all_proxy(request: Request, path: str):
    """
    Catch-all proxy for any unmatched routes.
    
    Forwards all requests to the Medical RAG Service.
    """
    # Get request body if present
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            body = None
    
    return await proxy_request(
        request.method,
        f"/{path}",
        request=request,
        json_body=body,
    )


# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "langchain-rag-proxy",
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
            "detail": str(exc),
            "timestamp": datetime.utcnow().isoformat(),
            "service": "langchain-rag-proxy",
        }
    )


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     LangChain RAG Proxy Service                            ║
    ║                                                            ║
    ║     PROXY MODE: Forwarding to {MEDICAL_RAG_URL:<24}  ║
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
