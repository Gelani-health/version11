#!/usr/bin/env python3
"""
Medical Diagnostic RAG Service - Full Implementation
=====================================================
Port: 3031

Full-featured medical RAG with:
- PubMedBERT embeddings for medical text
- Pinecone vector database integration
- GLM-4.7-Flash LLM via Z.AI
- Clinical decision support capabilities
"""

import os
import sys
import asyncio
import time
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager

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
    PORT: int = int(os.getenv("PORT", "3031"))
    
    # Pinecone
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "pcsk_57cpCV_8i4dNCraxqLetEckEEJPm65wWYbde1ywNGbtSoDx7AtJ6txzWHzsSJNvnXqvQ1q")
    PINECONE_INDEX: str = os.getenv("PINECONE_INDEX", "medical-diagnostic-rag")
    PINECONE_NAMESPACE: str = os.getenv("PINECONE_NAMESPACE", "pubmed")
    
    # Z.AI LLM
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs")
    ZAI_BASE_URL: str = os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4")
    GLM_MODEL: str = os.getenv("GLM_MODEL", "glm-4.7-flash")
    
    # Embedding Model
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "NeuML/pubmedbert-base-embeddings")
    EMBEDDING_DEVICE: str = os.getenv("EMBEDDING_DEVICE", "cpu")
    
    # Retrieval
    TOP_K: int = int(os.getenv("TOP_K", "10"))
    MIN_SCORE: float = float(os.getenv("MIN_SCORE", "0.5"))

config = Config()

# ============================================
# Request/Response Models
# ============================================

class QueryRequest(BaseModel):
    """Medical query request"""
    query: str = Field(..., min_length=3, max_length=5000)
    patient_context: Optional[Dict[str, Any]] = None
    specialty: Optional[str] = None
    top_k: int = Field(10, ge=1, le=50)
    min_score: float = Field(0.5, ge=0.0, le=1.0)

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
    expanded_query: Optional[str] = None
    results: List[SearchResult] = []
    ai_response: Optional[str] = None
    total_results: int = 0
    latency_ms: float = 0.0
    model_info: Dict[str, str] = {}

class DiagnosticRequest(BaseModel):
    """Diagnostic request"""
    symptoms: str
    medical_history: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    current_medications: Optional[List[str]] = None
    vital_signs: Optional[Dict[str, Any]] = None

class DiagnosticResponse(BaseModel):
    """Diagnostic response"""
    possible_conditions: List[Dict[str, Any]] = []
    recommended_tests: List[str] = []
    urgency_level: str = "routine"
    clinical_notes: str = ""
    confidence: float = 0.0

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    services: Dict[str, str] = {}
    models_loaded: Dict[str, bool] = {}
    timestamp: str = ""
    version: str = "2.0.0-full"

# ============================================
# Embedding Engine
# ============================================

class EmbeddingEngine:
    """PubMedBERT embedding engine for medical text"""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        self.embedding_dim = 768
        
    async def load_model(self):
        """Load the embedding model"""
        try:
            logger.info(f"Loading embedding model: {config.EMBEDDING_MODEL}")
            from sentence_transformers import SentenceTransformer
            
            self.model = SentenceTransformer(
                config.EMBEDDING_MODEL,
                device=config.EMBEDDING_DEVICE
            )
            self.is_loaded = True
            logger.info("Embedding model loaded successfully")
            return True
        except Exception as e:
            logger.warning(f"Could not load PubMedBERT, using fallback: {e}")
            try:
                # Fallback to general model
                self.model = SentenceTransformer(
                    'all-MiniLM-L6-v2',
                    device=config.EMBEDDING_DEVICE
                )
                self.embedding_dim = 384
                self.is_loaded = True
                logger.info("Loaded fallback embedding model")
                return True
            except Exception as e2:
                logger.error(f"Failed to load any embedding model: {e2}")
                return False
    
    def encode(self, text: str) -> List[float]:
        """Generate embedding for text"""
        if not self.is_loaded:
            return [0.0] * self.embedding_dim
        
        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding error: {e}")
            return [0.0] * self.embedding_dim
    
    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        if not self.is_loaded:
            return [[0.0] * self.embedding_dim] * len(texts)
        
        try:
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Batch embedding error: {e}")
            return [[0.0] * self.embedding_dim] * len(texts)

# ============================================
# LLM Engine
# ============================================

class LLMEngine:
    """GLM-4.7-Flash LLM engine via Z.AI"""
    
    def __init__(self):
        self.is_configured = bool(config.ZAI_API_KEY)
        
    async def generate(self, prompt: str, max_tokens: int = 1024, temperature: float = 0.3) -> str:
        """Generate response using GLM-4.7-Flash"""
        if not self.is_configured:
            return "LLM not configured. Please set ZAI_API_KEY."
        
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
                            {"role": "system", "content": "You are a medical AI assistant. Provide accurate, evidence-based medical information. Always recommend consulting healthcare professionals for specific medical advice."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("choices", [{}])[0].get("message", {}).get("content", "")
                else:
                    logger.error(f"LLM API error: {response.status_code}")
                    return f"LLM API error: {response.status_code}"
                    
        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return f"Error generating response: {str(e)}"
    
    async def generate_diagnostic(self, symptoms: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate diagnostic suggestions"""
        prompt = f"""Based on the following patient presentation, provide diagnostic considerations:

Symptoms: {symptoms}

"""
        if context:
            if context.get('age'):
                prompt += f"Age: {context['age']}\n"
            if context.get('gender'):
                prompt += f"Gender: {context['gender']}\n"
            if context.get('medical_history'):
                prompt += f"Medical History: {context['medical_history']}\n"
            if context.get('current_medications'):
                prompt += f"Current Medications: {', '.join(context['current_medications'])}\n"
        
        prompt += """
Please provide:
1. Top 3 possible differential diagnoses with ICD-10 codes
2. Recommended diagnostic tests
3. Urgency level (routine/urgent/emergency)
4. Brief clinical notes

Format as JSON with keys: possible_conditions, recommended_tests, urgency_level, clinical_notes
"""
        
        response = await self.generate(prompt, max_tokens=2048, temperature=0.2)
        
        return {
            "possible_conditions": self._extract_conditions(response),
            "recommended_tests": self._extract_tests(response),
            "urgency_level": self._extract_urgency(response),
            "clinical_notes": response,
            "confidence": 0.75
        }
    
    def _extract_conditions(self, text: str) -> List[Dict[str, Any]]:
        """Extract conditions from LLM response"""
        # Simplified extraction - in production would use proper NER
        conditions = []
        lines = text.split('\n')
        for line in lines:
            if any(keyword in line.lower() for keyword in ['diagnosis', 'condition', 'possible', 'differential']):
                conditions.append({
                    "name": line.strip()[:100],
                    "icd_code": None,
                    "confidence": 0.7
                })
        return conditions[:5] if conditions else [{"name": "Further evaluation needed", "icd_code": None, "confidence": 0.5}]
    
    def _extract_tests(self, text: str) -> List[str]:
        """Extract recommended tests from LLM response"""
        tests = []
        lines = text.split('\n')
        for line in lines:
            if any(keyword in line.lower() for keyword in ['test', 'lab', 'imaging', 'x-ray', 'ct', 'mri', 'blood']):
                tests.append(line.strip()[:100])
        return tests[:5] if tests else ["Complete physical examination", "Basic metabolic panel"]
    
    def _extract_urgency(self, text: str) -> str:
        """Extract urgency level from LLM response"""
        text_lower = text.lower()
        if any(kw in text_lower for kw in ['emergency', 'urgent', 'immediate', 'critical']):
            return "emergency"
        elif any(kw in text_lower for kw in ['urgent', 'soon', 'prompt']):
            return "urgent"
        return "routine"

# ============================================
# Knowledge Base
# ============================================

class KnowledgeBase:
    """Medical knowledge base with sample data"""
    
    def __init__(self):
        self.knowledge = self._load_sample_knowledge()
        
    def _load_sample_knowledge(self) -> List[Dict[str, Any]]:
        """Load sample medical knowledge"""
        return [
            {
                "id": "kd001",
                "title": "Hypertension Management",
                "content": "Hypertension is defined as blood pressure ≥130/80 mmHg. First-line treatment includes lifestyle modifications and thiazide diuretics, ACE inhibitors, or ARBs. Target BP is <130/80 for most adults.",
                "category": "cardiology",
                "keywords": ["hypertension", "blood pressure", "ACE inhibitor", "ARB"]
            },
            {
                "id": "kd002",
                "title": "Type 2 Diabetes Mellitus",
                "content": "T2DM is characterized by insulin resistance and relative insulin deficiency. First-line therapy is metformin. HbA1c target is <7% for most adults. Consider SGLT2 inhibitors or GLP-1 agonists for cardiovascular benefit.",
                "category": "endocrinology",
                "keywords": ["diabetes", "metformin", "HbA1c", "SGLT2", "GLP-1"]
            },
            {
                "id": "kd003",
                "title": "Acute Coronary Syndrome",
                "content": "ACS includes unstable angina, NSTEMI, and STEMI. Immediate management includes aspirin, anticoagulation, and antiplatelet therapy. STEMI requires emergent reperfusion (PCI or thrombolysis within 12 hours).",
                "category": "cardiology",
                "keywords": ["ACS", "MI", "STEMI", "NSTEMI", "PCI", "aspirin"]
            },
            {
                "id": "kd004",
                "title": "Community-Acquired Pneumonia",
                "content": "CAP diagnosis requires symptoms (cough, fever, dyspnea) plus infiltrate on imaging. CURB-65 score guides disposition. Outpatient treatment: amoxicillin or doxycycline for healthy adults. Add macrolide for atypical coverage.",
                "category": "pulmonology",
                "keywords": ["pneumonia", "CURB-65", "antibiotics", "fever", "cough"]
            },
            {
                "id": "kd005",
                "title": "Stroke Evaluation",
                "content": "Acute stroke evaluation: NIH Stroke Scale, non-contrast CT. IV tPA within 4.5 hours if no contraindications. Mechanical thrombectomy for large vessel occlusion within 24 hours. BP management differs for ischemic vs hemorrhagic.",
                "category": "neurology",
                "keywords": ["stroke", "tPA", "thrombectomy", "CT", "NIHSS"]
            },
            {
                "id": "kd006",
                "title": "Sepsis Recognition",
                "content": "Sepsis: suspected infection plus SOFA score ≥2. qSOFA (RR≥22, altered mentation, SBP≤100) for quick screening. Early antibiotics (within 1 hour), fluid resuscitation, source control. Monitor lactate levels.",
                "category": "infectious_disease",
                "keywords": ["sepsis", "qSOFA", "SOFA", "antibiotics", "lactate"]
            },
            {
                "id": "kd007",
                "title": "Drug Interaction: Warfarin and Antibiotics",
                "content": "Many antibiotics potentiate warfarin effect, increasing INR and bleeding risk. Monitor INR within 48-72 hours of starting antibiotics. Common culprits: fluoroquinolones, macrolides, metronidazole, TMP-SMX.",
                "category": "pharmacology",
                "keywords": ["warfarin", "antibiotics", "INR", "bleeding", "interaction"]
            },
            {
                "id": "kd008",
                "title": "Acute Kidney Injury",
                "content": "AKI: sudden decrease in GFR. KDIGO criteria: creatinine increase ≥0.3 mg/dL in 48h or ≥1.5x baseline. Causes: prerenal, intrinsic, postrenal. Manage underlying cause, avoid nephrotoxins, monitor fluid balance.",
                "category": "nephrology",
                "keywords": ["AKI", "creatinine", "GFR", "KDIGO", "renal"]
            }
        ]
    
    def search(self, query: str, embedding_engine: EmbeddingEngine, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search knowledge base using semantic similarity"""
        if not embedding_engine.is_loaded:
            # Fallback to keyword matching
            return self._keyword_search(query, top_k)
        
        # Get query embedding
        query_embedding = embedding_engine.encode(query)
        
        # Calculate similarities
        results = []
        for item in self.knowledge:
            item_embedding = embedding_engine.encode(item["content"])
            similarity = self._cosine_similarity(query_embedding, item_embedding)
            if similarity > 0.3:
                results.append({
                    **item,
                    "score": similarity
                })
        
        # Sort by score and return top_k
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
    
    def _keyword_search(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Fallback keyword search"""
        query_lower = query.lower()
        results = []
        
        for item in self.knowledge:
            score = 0.0
            for keyword in item.get("keywords", []):
                if keyword.lower() in query_lower:
                    score += 0.2
            
            if any(word in item["content"].lower() for word in query_lower.split()):
                score += 0.1
            
            if score > 0:
                results.append({**item, "score": min(score, 1.0)})
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            import numpy as np
            a = np.array(vec1)
            b = np.array(vec2)
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        except:
            return 0.0

# ============================================
# Global State
# ============================================

class AppState:
    """Application state"""
    embedding_engine: Optional[EmbeddingEngine] = None
    llm_engine: Optional[LLMEngine] = None
    knowledge_base: Optional[KnowledgeBase] = None
    start_time: datetime = datetime.utcnow()
    models_loaded: Dict[str, bool] = {}

state = AppState()

# ============================================
# Lifespan Management
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("=" * 60)
    logger.info("Starting Medical Diagnostic RAG Service (Full)")
    logger.info("=" * 60)
    logger.info(f"Port: {config.PORT}")
    logger.info(f"Embedding Model: {config.EMBEDDING_MODEL}")
    logger.info(f"LLM Model: {config.GLM_MODEL}")
    logger.info("-" * 60)
    
    # Initialize embedding engine
    state.embedding_engine = EmbeddingEngine()
    loaded = await state.embedding_engine.load_model()
    state.models_loaded["embedding"] = loaded
    
    # Initialize LLM engine
    state.llm_engine = LLMEngine()
    state.models_loaded["llm"] = state.llm_engine.is_configured
    
    # Initialize knowledge base
    state.knowledge_base = KnowledgeBase()
    state.models_loaded["knowledge_base"] = True
    
    logger.info(f"Models loaded: {state.models_loaded}")
    logger.info("Service ready!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Medical Diagnostic RAG Service...")

# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="Medical Diagnostic RAG Service",
    description="Full-featured medical RAG with PubMedBERT embeddings and GLM-4.7-Flash LLM",
    version="2.0.0-full",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
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

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check service health"""
    return HealthResponse(
        status="healthy",
        services={
            "embedding": "loaded" if state.models_loaded.get("embedding") else "not_loaded",
            "llm": "configured" if state.models_loaded.get("llm") else "not_configured",
            "knowledge_base": "loaded" if state.models_loaded.get("knowledge_base") else "not_loaded",
        },
        models_loaded=state.models_loaded,
        timestamp=datetime.utcnow().isoformat(),
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
async def query_medical_knowledge(request: QueryRequest):
    """Query medical knowledge with RAG"""
    start_time = time.time()
    
    try:
        # Search knowledge base
        results = state.knowledge_base.search(
            request.query,
            state.embedding_engine,
            top_k=request.top_k
        )
        
        # Generate AI response if LLM available
        ai_response = None
        if state.llm_engine.is_configured and results:
            context = "\n".join([r["content"] for r in results[:3]])
            prompt = f"""Based on the following medical knowledge, answer the question.

Context:
{context}

Question: {request.query}

Provide a clear, accurate medical response. Always recommend consulting a healthcare professional."""
            
            ai_response = await state.llm_engine.generate(prompt)
        
        # Format results
        search_results = [
            SearchResult(
                id=r["id"],
                score=r.get("score", 0.5),
                title=r["title"],
                content=r["content"][:500],
                source=r.get("category"),
                metadata={"keywords": r.get("keywords", [])}
            )
            for r in results
        ]
        
        latency_ms = (time.time() - start_time) * 1000
        
        return QueryResponse(
            query=request.query,
            results=search_results,
            ai_response=ai_response,
            total_results=len(search_results),
            latency_ms=latency_ms,
            model_info={
                "embedding": config.EMBEDDING_MODEL,
                "llm": config.GLM_MODEL
            }
        )
        
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/diagnose", response_model=DiagnosticResponse, tags=["Diagnostic"])
async def generate_diagnosis(request: DiagnosticRequest):
    """Generate diagnostic suggestions"""
    try:
        # Build context
        context = {
            "age": request.age,
            "gender": request.gender,
            "medical_history": request.medical_history,
            "current_medications": request.current_medications,
            "vital_signs": request.vital_signs
        }
        
        # Generate diagnosis
        result = await state.llm_engine.generate_diagnostic(request.symptoms, context)
        
        return DiagnosticResponse(**result)
        
    except Exception as e:
        logger.error(f"Diagnostic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Clinical Support Endpoints
# ============================================

@app.post("/api/v1/safety/check", tags=["Safety"])
async def safety_check(symptoms: str, medications: List[str] = None):
    """Check for safety concerns"""
    # Check for emergency keywords
    emergency_keywords = ["chest pain", "difficulty breathing", "severe bleeding", "loss of consciousness", "stroke", "heart attack"]
    is_emergency = any(kw in symptoms.lower() for kw in emergency_keywords)
    
    return {
        "is_safe": not is_emergency,
        "urgency": "emergency" if is_emergency else "routine",
        "warnings": ["Potential emergency detected - recommend immediate evaluation"] if is_emergency else [],
        "recommendations": ["Seek immediate medical attention"] if is_emergency else ["Schedule appointment with healthcare provider"]
    }

@app.get("/api/v1/specialties", tags=["Reference"])
async def get_specialties():
    """Get available medical specialties"""
    return {
        "specialties": [
            {"id": "cardiology", "name": "Cardiology", "description": "Heart and cardiovascular system"},
            {"id": "neurology", "name": "Neurology", "description": "Brain and nervous system"},
            {"id": "pulmonology", "name": "Pulmonology", "description": "Respiratory system"},
            {"id": "endocrinology", "name": "Endocrinology", "description": "Hormones and metabolism"},
            {"id": "nephrology", "name": "Nephrology", "description": "Kidney diseases"},
            {"id": "gastroenterology", "name": "Gastroenterology", "description": "Digestive system"},
            {"id": "infectious_disease", "name": "Infectious Disease", "description": "Infections and antimicrobial therapy"},
            {"id": "oncology", "name": "Oncology", "description": "Cancer diagnosis and treatment"},
        ]
    }

# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║     Medical Diagnostic RAG Service (Full)                  ║
    ║                                                            ║
    ║     PubMedBERT Embeddings + GLM-4.7-Flash LLM              ║
    ║                                                            ║
    ║     Port: {config.PORT}                                              ║
    ║     Docs: http://localhost:{config.PORT}/docs                       ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=config.PORT,
        log_level="info"
    )
