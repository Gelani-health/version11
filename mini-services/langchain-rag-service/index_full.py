#!/usr/bin/env python3
"""
LangChain RAG Service v2.0 - Full Implementation
=================================================

READ/WRITE enabled RAG service with:
- Z.ai SDK integration for LLM
- Local knowledge store with semantic search
- Smart sync with Medical RAG
- Document ingestion capabilities

Port: 3032
"""

import os
import sys
import time
import json
import uuid
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
import traceback

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    
    # Service Identity
    VECTOR_ID_PREFIX: str = "lc_"
    SOURCE_PIPELINE: str = "langchain-rag"
    SERVICE_NAME: str = "LangChain RAG Service"
    VERSION: str = "2.0.0-full"
    
    # Z.AI Configuration
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "")
    
    # Medical RAG Service (for sync/fallback)
    MEDICAL_RAG_URL: str = os.getenv("MEDICAL_RAG_URL", "http://localhost:3031")
    
    # Embedding
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = 384
    
    # Knowledge Store
    MAX_DOCUMENTS: int = 10000

config = Config()

# ============================================
# Request/Response Models
# ============================================

class QueryRequest(BaseModel):
    """RAG query request"""
    query: str = Field(..., min_length=3, max_length=5000)
    top_k: int = Field(10, ge=1, le=50)
    min_score: float = Field(0.3, ge=0.0, le=1.0)
    include_answer: bool = True
    use_medical_rag_fallback: bool = True

class DocumentInput(BaseModel):
    """Document input for ingestion"""
    id: Optional[str] = None
    title: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class IngestRequest(BaseModel):
    """Document ingestion request"""
    documents: List[DocumentInput]
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
    answer: Optional[str] = None
    total_results: int = 0
    latency_ms: float = 0.0
    source: str = "langchain-rag"

class IngestResponse(BaseModel):
    """Ingestion response"""
    status: str
    documents_ingested: int = 0
    total_documents: int = 0
    timestamp: str = ""

class SyncStatus(BaseModel):
    """Sync status"""
    status: str
    last_sync: Optional[str] = None
    documents_synced: int = 0
    errors: int = 0
    last_error: Optional[str] = None

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    mode: str = "READ_WRITE"
    namespace: str = ""
    models_loaded: Dict[str, bool] = {}
    features: List[str] = []
    timestamp: str = ""
    version: str = config.VERSION

# ============================================
# Z.ai LLM Engine
# ============================================

class ZaiLLMEngine:
    """Z.ai SDK LLM engine"""
    
    def __init__(self):
        self.is_available = False
        self.model_name = "glm-4.7-flash"
        self._check_availability()
        
    def _check_availability(self):
        """Check if Z.ai is available"""
        try:
            if config.ZAI_API_KEY:
                self.is_available = True
                logger.info("Z.ai API key configured")
            else:
                logger.warning("ZAI_API_KEY not configured")
        except Exception as e:
            logger.warning(f"Z.ai check failed: {e}")
    
    async def generate(self, prompt: str, system_prompt: str = None, max_tokens: int = 1024, temperature: float = 0.3) -> str:
        """Generate response using Z.ai"""
        if not self.is_available:
            return "LLM service not available"
        
        try:
            # Try Z.ai SDK
            try:
                import ZAI
                
                zai = await ZAI.create()
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                completion = await zai.chat.completions.create(
                    messages=messages,
                    model=self.model_name,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                
                return completion.choices[0].message.content
                
            except ImportError:
                # Direct API call
                import httpx
                
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.z.ai/api/paas/v4/chat/completions",
                        headers={
                            "Authorization": f"Bearer {config.ZAI_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.model_name,
                            "messages": messages,
                            "max_tokens": max_tokens,
                            "temperature": temperature
                        }
                    )
                    
                    if response.status_code == 200:
                        return response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                    return f"API error: {response.status_code}"
                    
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return f"Error: {str(e)}"
    
    async def generate_answer(self, query: str, context: str) -> str:
        """Generate answer from context"""
        system_prompt = """You are a helpful medical AI assistant. Answer questions based on the provided context.
If the context doesn't contain relevant information, say so. Always recommend consulting healthcare professionals."""
        
        prompt = f"""Context:
{context}

Question: {query}

Provide a clear, accurate answer based on the context above."""
        
        return await self.generate(prompt, system_prompt)

# ============================================
# Embedding Engine
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
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {config.EMBEDDING_MODEL}")
            
            self.model = SentenceTransformer(config.EMBEDDING_MODEL, device="cpu")
            self.dimension = self.model.get_sentence_embedding_dimension()
            self.is_loaded = True
            
            logger.info(f"Embedding model loaded. Dimension: {self.dimension}")
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
    
    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        if not self.is_loaded:
            return [[0.0] * self.dimension] * len(texts)
        
        try:
            return self.model.encode(texts, convert_to_numpy=True).tolist()
        except:
            return [[0.0] * self.dimension] * len(texts)

# ============================================
# Knowledge Store
# ============================================

@dataclass
class Document:
    """Stored document"""
    id: str
    title: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

class KnowledgeStore:
    """Local knowledge store with semantic search"""
    
    def __init__(self):
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, List[float]] = {}
        self._last_id = 0
        
    def add_document(self, doc: Document, embedding: List[float] = None):
        """Add document to store"""
        self.documents[doc.id] = doc
        if embedding:
            self.embeddings[doc.id] = embedding
        self._last_id += 1
        
    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get document by ID"""
        return self.documents.get(doc_id)
    
    def delete_document(self, doc_id: str) -> bool:
        """Delete document"""
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.embeddings.pop(doc_id, None)
            return True
        return False
    
    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        min_score: float = 0.3,
        filters: Dict[str, Any] = None
    ) -> List[Tuple[Document, float]]:
        """Search documents by embedding similarity"""
        
        results = []
        
        for doc_id, doc in self.documents.items():
            # Apply filters if specified
            if filters:
                match = all(
                    doc.metadata.get(k) == v
                    for k, v in filters.items()
                )
                if not match:
                    continue
            
            # Calculate similarity
            if doc_id in self.embeddings:
                score = self._cosine_similarity(query_embedding, self.embeddings[doc_id])
            else:
                score = 0.0
            
            if score >= min_score:
                results.append((doc, score))
        
        # Sort by score and return top_k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def search_by_keywords(self, query: str, top_k: int = 10) -> List[Tuple[Document, float]]:
        """Fallback keyword search"""
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        results = []
        
        for doc_id, doc in self.documents.items():
            score = 0.0
            
            # Check title
            title_words = set(doc.title.lower().split())
            title_match = len(query_words & title_words) / len(query_words) if query_words else 0
            score += title_match * 0.5
            
            # Check content
            content_words = set(doc.content.lower().split())
            content_match = len(query_words & content_words) / len(query_words) if query_words else 0
            score += content_match * 0.3
            
            # Check metadata
            metadata_text = " ".join(str(v) for v in doc.metadata.values()).lower()
            if any(w in metadata_text for w in query_words):
                score += 0.2
            
            if score > 0.1:
                results.append((doc, min(score, 1.0)))
        
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity"""
        try:
            import numpy as np
            a, b = np.array(vec1), np.array(vec2)
            norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(a, b) / (norm_a * norm_b))
        except:
            return 0.0
    
    def count(self) -> int:
        """Count documents"""
        return len(self.documents)
    
    def clear(self):
        """Clear all documents"""
        self.documents.clear()
        self.embeddings.clear()

# ============================================
# Global State
# ============================================

class AppState:
    """Application state"""
    llm_engine: Optional[ZaiLLMEngine] = None
    embedding_engine: Optional[EmbeddingEngine] = None
    knowledge_store: Optional[KnowledgeStore] = None
    models_loaded: Dict[str, bool] = {}
    last_sync: Optional[datetime] = None
    sync_errors: int = 0
    last_sync_error: Optional[str] = None
    start_time: datetime = datetime.utcnow()

state = AppState()

# ============================================
# Lifespan Management
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("=" * 60)
    logger.info(f"Starting {config.SERVICE_NAME} v{config.VERSION}")
    logger.info("=" * 60)
    logger.info(f"Port: {config.PORT}")
    logger.info(f"Mode: READ_WRITE")
    logger.info(f"Medical RAG URL: {config.MEDICAL_RAG_URL}")
    logger.info("-" * 60)
    
    # Initialize LLM engine
    state.llm_engine = ZaiLLMEngine()
    state.models_loaded["llm"] = state.llm_engine.is_available
    
    # Initialize embedding engine
    state.embedding_engine = EmbeddingEngine()
    embedding_loaded = await state.embedding_engine.load_model()
    state.models_loaded["embedding"] = embedding_loaded
    
    # Initialize knowledge store
    state.knowledge_store = KnowledgeStore()
    state.models_loaded["knowledge_store"] = True
    
    # Load sample documents
    await _load_sample_documents()
    
    logger.info(f"Models loaded: {state.models_loaded}")
    logger.info("Service ready!")
    
    yield
    
    logger.info("Shutting down LangChain RAG Service...")

async def _load_sample_documents():
    """Load sample documents"""
    samples = [
        Document(
            id=f"{config.VECTOR_ID_PREFIX}doc001",
            title="Clinical Guidelines for Diabetes Management",
            content="ADA recommends HbA1c target <7% for most adults with diabetes. First-line therapy is metformin. Consider SGLT2 inhibitors for patients with ASCVD or high cardiovascular risk.",
            metadata={"category": "guidelines", "source": "ADA"}
        ),
        Document(
            id=f"{config.VECTOR_ID_PREFIX}doc002",
            title="Antibiotic Stewardship Principles",
            content="Optimize antibiotic use to improve outcomes and reduce resistance. De-escalate therapy based on culture results. Use shortest effective duration.",
            metadata={"category": "pharmacology", "source": "IDSA"}
        ),
        Document(
            id=f"{config.VECTOR_ID_PREFIX}doc003",
            title="Heart Failure Management",
            content="GDMT for HFrEF: ACEi/ARB/ARNI + beta-blocker + MRA + SGLT2i. Target doses based on trial evidence. Monitor renal function and potassium.",
            metadata={"category": "cardiology", "source": "ACC/AHA"}
        ),
        Document(
            id=f"{config.VECTOR_ID_PREFIX}doc004",
            title="Stroke Prevention in Atrial Fibrillation",
            content="CHA2DS2-VASc score guides anticoagulation decisions. DOACs preferred over warfarin for most patients. HAS-BLED assesses bleeding risk.",
            metadata={"category": "cardiology", "source": "ESC"}
        ),
        Document(
            id=f"{config.VECTOR_ID_PREFIX}doc005",
            title="Sepsis Management Protocol",
            content="Hour-1 bundle: Lactate, cultures, antibiotics, fluids, vasopressors. Target MAP ≥65 mmHg. Source control essential.",
            metadata={"category": "critical_care", "source": "Surviving Sepsis"}
        )
    ]
    
    for doc in samples:
        embedding = state.embedding_engine.encode(doc.content) if state.embedding_engine.is_loaded else None
        state.knowledge_store.add_document(doc, embedding)
    
    logger.info(f"Loaded {len(samples)} sample documents")

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title=config.SERVICE_NAME,
    description="READ/WRITE RAG service with Smart Sync capability",
    version=config.VERSION,
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

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "service": config.SERVICE_NAME,
        "version": config.VERSION,
        "mode": "READ_WRITE",
        "features": [
            "document-ingestion",
            "semantic-search",
            "smart-sync",
            "llm-answers"
        ],
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check"""
    return HealthResponse(
        status="healthy",
        mode="READ_WRITE",
        namespace="langchain-rag",
        models_loaded=state.models_loaded,
        features=[
            "document-ingestion",
            "semantic-search",
            "smart-sync",
            "llm-integration"
        ],
        timestamp=datetime.utcnow().isoformat()
    )

@app.get("/health/ready", tags=["System"])
async def readiness():
    """Readiness probe"""
    return {"status": "ready"}

@app.get("/health/live", tags=["System"])
async def liveness():
    """Liveness probe"""
    return {"status": "alive"}

# ============================================
# Query Endpoints
# ============================================

@app.post("/api/v1/query", response_model=QueryResponse, tags=["RAG"])
async def query_rag(request: QueryRequest):
    """Query RAG system"""
    start_time = time.time()
    
    try:
        # Generate query embedding
        query_embedding = state.embedding_engine.encode(request.query)
        
        # Search local store
        search_results = state.knowledge_store.search(
            query_embedding,
            top_k=request.top_k,
            min_score=request.min_score
        )
        
        # If no results and fallback enabled, try Medical RAG
        if not search_results and request.use_medical_rag_fallback:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{config.MEDICAL_RAG_URL}/api/v1/query",
                        json={
                            "query": request.query,
                            "top_k": request.top_k,
                            "include_ai_response": request.include_answer
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return QueryResponse(
                            query=request.query,
                            results=[SearchResult(**r) for r in data.get("results", [])],
                            answer=data.get("ai_response"),
                            total_results=data.get("total_results", 0),
                            latency_ms=(time.time() - start_time) * 1000,
                            source="medical-rag-fallback"
                        )
            except Exception as e:
                logger.warning(f"Medical RAG fallback failed: {e}")
        
        # Format results
        results = [
            SearchResult(
                id=doc.id,
                score=score,
                title=doc.title,
                content=doc.content[:500],
                source=doc.metadata.get("source"),
                metadata=doc.metadata
            )
            for doc, score in search_results
        ]
        
        # Generate answer if requested
        answer = None
        if request.include_answer and results and state.llm_engine.is_available:
            context = "\n\n".join([f"{r.title}:\n{r.content}" for r in results[:3]])
            answer = await state.llm_engine.generate_answer(request.query, context)
        
        latency_ms = (time.time() - start_time) * 1000
        
        return QueryResponse(
            query=request.query,
            results=results,
            answer=answer,
            total_results=len(results),
            latency_ms=latency_ms
        )
        
    except Exception as e:
        logger.error(f"Query error: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Ingestion Endpoints
# ============================================

@app.post("/api/v1/documents", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_documents(request: IngestRequest):
    """Ingest documents (WRITE operation)"""
    try:
        ingested = 0
        
        for doc_input in request.documents:
            # Generate ID if not provided
            doc_id = doc_input.id or f"{config.VECTOR_ID_PREFIX}{uuid.uuid4().hex[:12]}"
            
            # Merge metadata
            metadata = doc_input.metadata or {}
            if request.metadata:
                metadata.update(request.metadata)
            metadata["source_pipeline"] = config.SOURCE_PIPELINE
            metadata["ingested_at"] = datetime.utcnow().isoformat()
            
            # Create document
            doc = Document(
                id=doc_id,
                title=doc_input.title,
                content=doc_input.content,
                metadata=metadata
            )
            
            # Generate embedding
            embedding = None
            if state.embedding_engine.is_loaded:
                embedding = state.embedding_engine.encode(doc.content)
            
            # Add to store
            state.knowledge_store.add_document(doc, embedding)
            ingested += 1
        
        return IngestResponse(
            status="success",
            documents_ingested=ingested,
            total_documents=state.knowledge_store.count(),
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/documents/{doc_id}", tags=["Ingestion"])
async def delete_document(doc_id: str):
    """Delete document by ID"""
    if state.knowledge_store.delete_document(doc_id):
        return {"status": "success", "message": f"Document {doc_id} deleted"}
    raise HTTPException(status_code=404, detail="Document not found")

@app.get("/api/v1/documents/{doc_id}", tags=["Ingestion"])
async def get_document(doc_id: str):
    """Get document by ID"""
    doc = state.knowledge_store.get_document(doc_id)
    if doc:
        return {
            "id": doc.id,
            "title": doc.title,
            "content": doc.content,
            "metadata": doc.metadata,
            "created_at": doc.created_at.isoformat()
        }
    raise HTTPException(status_code=404, detail="Document not found")

# ============================================
# Sync Endpoints
# ============================================

@app.get("/api/v1/sync/status", response_model=SyncStatus, tags=["Sync"])
async def get_sync_status():
    """Get synchronization status"""
    return SyncStatus(
        status="active",
        last_sync=state.last_sync.isoformat() if state.last_sync else None,
        documents_synced=state.knowledge_store.count(),
        errors=state.sync_errors,
        last_error=state.last_sync_error
    )

@app.post("/api/v1/sync/trigger", tags=["Sync"])
async def trigger_sync():
    """Trigger manual sync with Medical RAG"""
    try:
        import httpx
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try to get documents from Medical RAG
            response = await client.post(
                f"{config.MEDICAL_RAG_URL}/api/v1/query",
                json={"query": "medical knowledge", "top_k": 20}
            )
            
            if response.status_code == 200:
                data = response.json()
                synced = 0
                
                for result in data.get("results", []):
                    doc_id = f"{config.VECTOR_ID_PREFIX}sync_{result['id']}"
                    
                    # Check if already exists
                    if state.knowledge_store.get_document(doc_id):
                        continue
                    
                    doc = Document(
                        id=doc_id,
                        title=result.get("title", "Untitled"),
                        content=result.get("content", ""),
                        metadata={
                            "source": result.get("source"),
                            "category": result.get("category"),
                            "synced_from": "medical-rag"
                        }
                    )
                    
                    embedding = None
                    if state.embedding_engine.is_loaded:
                        embedding = state.embedding_engine.encode(doc.content)
                    
                    state.knowledge_store.add_document(doc, embedding)
                    synced += 1
                
                state.last_sync = datetime.utcnow()
                state.sync_errors = 0
                
                return {
                    "status": "success",
                    "message": f"Synced {synced} documents",
                    "last_sync": state.last_sync.isoformat()
                }
            
            return {"status": "partial", "message": "Could not reach Medical RAG"}
            
    except Exception as e:
        state.sync_errors += 1
        state.last_sync_error = str(e)
        return {"status": "error", "message": str(e)}

# ============================================
# Stats Endpoints
# ============================================

@app.get("/api/v1/stats", tags=["Monitoring"])
async def get_stats():
    """Get service statistics"""
    return {
        "total_documents": state.knowledge_store.count(),
        "models_loaded": state.models_loaded,
        "last_sync": state.last_sync.isoformat() if state.last_sync else None,
        "sync_errors": state.sync_errors,
        "uptime_seconds": (datetime.utcnow() - state.start_time).total_seconds()
    }

@app.delete("/api/v1/clear", tags=["Ingestion"])
async def clear_knowledge_store():
    """Clear all documents from knowledge store"""
    count = state.knowledge_store.count()
    state.knowledge_store.clear()
    return {
        "status": "success",
        "message": f"Cleared {count} documents"
    }

# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     {config.SERVICE_NAME} v{config.VERSION}                  ║
    ║                                                            ║
    ║     Mode: READ_WRITE                                       ║
    ║     Smart Sync: {config.MEDICAL_RAG_URL:<40}  ║
    ║                                                            ║
    ║     Port: {config.PORT}                                              ║
    ║     Docs: http://localhost:{config.PORT}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=config.PORT, log_level="info")
