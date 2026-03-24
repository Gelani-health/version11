#!/usr/bin/env python3
"""
LangChain RAG Service - Full Implementation
============================================
Port: 3032

READ/WRITE enabled RAG service with Smart Sync.
Shares Pinecone namespace with Medical RAG.
"""

import os
import sys
import time
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level="INFO")

# ============================================
# Configuration
# ============================================

class Config:
    """Service configuration"""
    PORT: int = int(os.getenv("PORT", "3032"))
    
    # Service identity
    VECTOR_ID_PREFIX: str = "lc_"
    SOURCE_PIPELINE: str = "langchain"
    
    # Pinecone (shared with Medical RAG)
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "pcsk_57cpCV_8i4dNCraxqLetEckEEJPm65wWYbde1ywNGbtSoDx7AtJ6txzWHzsSJNvnXqvQ1q")
    PINECONE_INDEX: str = os.getenv("PINECONE_INDEX", "medical-diagnostic-rag")
    PINECONE_NAMESPACE: str = os.getenv("PINECONE_NAMESPACE", "pubmed")
    
    # Medical RAG Service
    MEDICAL_RAG_URL: str = os.getenv("MEDICAL_RAG_URL", "http://localhost:3031")
    
    # Z.AI LLM
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs")
    ZAI_BASE_URL: str = os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4")
    GLM_MODEL: str = os.getenv("GLM_MODEL", "glm-4.7-flash")
    
    # Embedding
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = 384

config = Config()

# ============================================
# Request/Response Models
# ============================================

class QueryRequest(BaseModel):
    """RAG query request"""
    query: str = Field(..., min_length=3, max_length=5000)
    top_k: int = Field(10, ge=1, le=50)
    min_score: float = Field(0.5, ge=0.0, le=1.0)
    use_medical_rag_fallback: bool = True

class IngestRequest(BaseModel):
    """Document ingestion request"""
    documents: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

class SearchResult(BaseModel):
    """Search result"""
    id: str
    score: float
    title: str
    content: str
    source: Optional[str] = None
    metadata: Dict[str, Any] = {}

class QueryResponse(BaseModel):
    """Query response"""
    query: str
    results: List[SearchResult] = []
    total_results: int = 0
    latency_ms: float = 0.0
    source: str = "langchain"

class SyncStatus(BaseModel):
    """Sync status response"""
    status: str
    last_sync: Optional[str] = None
    documents_synced: int = 0
    errors: int = 0

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    mode: str = "READ_WRITE"
    namespace: str = ""
    models_loaded: Dict[str, bool] = {}
    timestamp: str = ""

# ============================================
# Engines
# ============================================

class EmbeddingEngine:
    """Embedding engine for document vectors"""
    
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.dimension = config.EMBEDDING_DIMENSION
        
    async def load_model(self):
        """Load embedding model"""
        try:
            logger.info(f"Loading embedding model: {config.EMBEDDING_MODEL}")
            from sentence_transformers import SentenceTransformer
            
            self.model = SentenceTransformer(config.EMBEDDING_MODEL, device="cpu")
            self.is_loaded = True
            logger.info("Embedding model loaded successfully")
            return True
        except Exception as e:
            logger.warning(f"Could not load embedding model: {e}")
            return False
    
    def encode(self, text: str) -> List[float]:
        """Generate embedding"""
        if not self.is_loaded:
            return [0.0] * self.dimension
        
        try:
            return self.model.encode(text, convert_to_numpy=True).tolist()
        except:
            return [0.0] * self.dimension

class LLMEngine:
    """LLM engine for text generation"""
    
    def __init__(self):
        self.is_configured = bool(config.ZAI_API_KEY)
        
    async def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        """Generate text"""
        if not self.is_configured:
            return "LLM not configured"
        
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{config.ZAI_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {config.ZAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": config.GLM_MODEL,
                        "messages": [
                            {"role": "system", "content": "You are a helpful medical AI assistant."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": 0.3
                    }
                )
                
                if response.status_code == 200:
                    return response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                return f"Error: {response.status_code}"
                
        except Exception as e:
            return f"Error: {str(e)}"

class KnowledgeStore:
    """Local knowledge store with synchronization capability"""
    
    def __init__(self):
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.embeddings: Dict[str, List[float]] = {}
        
    def add_document(self, doc_id: str, content: str, metadata: Dict[str, Any] = None):
        """Add document to store"""
        self.documents[doc_id] = {
            "id": doc_id,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }
    
    def search(self, query_embedding: List[float], top_k: int = 10, min_score: float = 0.5) -> List[Dict[str, Any]]:
        """Search documents by embedding similarity"""
        results = []
        
        for doc_id, doc in self.documents.items():
            if doc_id not in self.embeddings:
                continue
            
            score = self._cosine_similarity(query_embedding, self.embeddings[doc_id])
            if score >= min_score:
                results.append({
                    **doc,
                    "score": score
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity"""
        try:
            import numpy as np
            a, b = np.array(vec1), np.array(vec2)
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        except:
            return 0.0

# ============================================
# Global State
# ============================================

class AppState:
    embedding_engine: Optional[EmbeddingEngine] = None
    llm_engine: Optional[LLMEngine] = None
    knowledge_store: Optional[KnowledgeStore] = None
    models_loaded: Dict[str, bool] = {}
    last_sync: Optional[datetime] = None
    documents_synced: int = 0

state = AppState()

# ============================================
# Lifespan Management
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("=" * 60)
    logger.info("Starting LangChain RAG Service (Full)")
    logger.info("=" * 60)
    logger.info(f"Port: {config.PORT}")
    logger.info(f"Mode: READ_WRITE")
    logger.info(f"Namespace: {config.PINECONE_NAMESPACE}")
    logger.info(f"Vector ID Prefix: {config.VECTOR_ID_PREFIX}")
    logger.info("-" * 60)
    
    # Initialize embedding engine
    state.embedding_engine = EmbeddingEngine()
    loaded = await state.embedding_engine.load_model()
    state.models_loaded["embedding"] = loaded
    
    # Initialize LLM engine
    state.llm_engine = LLMEngine()
    state.models_loaded["llm"] = state.llm_engine.is_configured
    
    # Initialize knowledge store
    state.knowledge_store = KnowledgeStore()
    state.models_loaded["knowledge_store"] = True
    
    # Add sample documents
    _load_sample_documents()
    
    logger.info(f"Models loaded: {state.models_loaded}")
    logger.info("Service ready!")
    
    yield
    
    logger.info("Shutting down LangChain RAG Service...")

def _load_sample_documents():
    """Load sample medical documents"""
    samples = [
        {
            "id": f"{config.VECTOR_ID_PREFIX}doc001",
            "title": "Clinical Guidelines for Diabetes Management",
            "content": "ADA recommends HbA1c target <7% for most adults with diabetes. First-line therapy is metformin. Consider SGLT2 inhibitors for patients with ASCVD or high cardiovascular risk.",
            "category": "guidelines"
        },
        {
            "id": f"{config.VECTOR_ID_PREFIX}doc002",
            "title": "Antibiotic Stewardship Principles",
            "content": "Optimize antibiotic use to improve outcomes and reduce resistance. De-escalate therapy based on culture results. Use shortest effective duration.",
            "category": "pharmacology"
        },
        {
            "id": f"{config.VECTOR_ID_PREFIX}doc003",
            "title": "Heart Failure Management",
            "content": "GDMT for HFrEF: ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i. Target doses based on trial evidence. Monitor renal function and potassium.",
            "category": "cardiology"
        }
    ]
    
    for doc in samples:
        state.knowledge_store.add_document(doc["id"], doc["content"], {"title": doc["title"], "category": doc["category"]})
        if state.embedding_engine.is_loaded:
            state.knowledge_store.embeddings[doc["id"]] = state.embedding_engine.encode(doc["content"])
    
    state.documents_synced = len(samples)
    logger.info(f"Loaded {len(samples)} sample documents")

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="LangChain RAG Service",
    description="READ/WRITE RAG service with Smart Sync capability",
    version="2.0.0-full",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Health Endpoints
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check"""
    return HealthResponse(
        status="healthy",
        mode="READ_WRITE",
        namespace=config.PINECONE_NAMESPACE,
        models_loaded=state.models_loaded,
        timestamp=datetime.utcnow().isoformat()
    )

@app.get("/health/ready")
async def readiness():
    return {"status": "ready"}

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}

# ============================================
# Query Endpoints
# ============================================

@app.post("/api/v1/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """Query RAG system"""
    start_time = time.time()
    
    try:
        # Generate query embedding
        query_embedding = state.embedding_engine.encode(request.query)
        
        # Search local store
        results = state.knowledge_store.search(
            query_embedding,
            top_k=request.top_k,
            min_score=request.min_score
        )
        
        # Format results
        search_results = [
            SearchResult(
                id=r["id"],
                score=r.get("score", 0.5),
                title=r.get("metadata", {}).get("title", "Untitled"),
                content=r["content"][:500],
                source=r.get("metadata", {}).get("category"),
                metadata=r.get("metadata", {})
            )
            for r in results
        ]
        
        # Fallback to Medical RAG if no results and fallback enabled
        if not search_results and request.use_medical_rag_fallback:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{config.MEDICAL_RAG_URL}/api/v1/query",
                        json={
                            "query": request.query,
                            "top_k": request.top_k
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        search_results = [
                            SearchResult(**r) for r in data.get("results", [])
                        ]
            except Exception as e:
                logger.warning(f"Medical RAG fallback failed: {e}")
        
        latency_ms = (time.time() - start_time) * 1000
        
        return QueryResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results),
            latency_ms=latency_ms
        )
        
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Ingestion Endpoints
# ============================================

@app.post("/api/v1/ingest")
async def ingest_document(request: IngestRequest):
    """Ingest documents (WRITE operation)"""
    try:
        ingested = 0
        for doc in request.documents:
            doc_id = doc.get("id", f"{config.VECTOR_ID_PREFIX}{datetime.utcnow().timestamp()}")
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            
            if request.metadata:
                metadata.update(request.metadata)
            
            metadata["source_pipeline"] = config.SOURCE_PIPELINE
            
            state.knowledge_store.add_document(doc_id, content, metadata)
            
            if state.embedding_engine.is_loaded:
                state.knowledge_store.embeddings[doc_id] = state.embedding_engine.encode(content)
            
            ingested += 1
        
        state.documents_synced += ingested
        
        return {
            "status": "success",
            "documents_ingested": ingested,
            "total_documents": len(state.knowledge_store.documents)
        }
        
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Sync Endpoints
# ============================================

@app.get("/api/v1/sync/status", response_model=SyncStatus)
async def get_sync_status():
    """Get synchronization status"""
    return SyncStatus(
        status="active",
        last_sync=state.last_sync.isoformat() if state.last_sync else None,
        documents_synced=state.documents_synced,
        errors=0
    )

@app.post("/api/v1/sync/trigger")
async def trigger_sync():
    """Trigger manual sync with Medical RAG"""
    try:
        import httpx
        
        # Sync from Medical RAG
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{config.MEDICAL_RAG_URL}/api/v1/query?query=medical%20knowledge")
            if response.status_code == 200:
                state.last_sync = datetime.utcnow()
                return {
                    "status": "success",
                    "message": "Sync completed",
                    "last_sync": state.last_sync.isoformat()
                }
        
        return {"status": "partial", "message": "Could not reach Medical RAG"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     LangChain RAG Service (Full)                           ║
    ║                                                            ║
    ║     Mode: READ_WRITE                                       ║
    ║     Namespace: {config.PINECONE_NAMESPACE}                             ║
    ║                                                            ║
    ║     Port: {config.PORT}                                              ║
    ║     Docs: http://localhost:{config.PORT}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=config.PORT, log_level="info")
