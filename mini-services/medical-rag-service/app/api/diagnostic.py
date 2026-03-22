"""
Diagnostic API Module
=====================

GLM-4.7-Flash powered diagnostic recommendations via Together AI.

Provider: Together AI (Recommended)
- Base URL: https://api.together.xyz/v1/
- Model ID: together_ai/z-ai/glm-4.7-flash
- Pricing: $0.06 per 1M input tokens, $0.18 per 1M output tokens
- Context Window: 200K tokens
"""

import asyncio
import time
import json
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import httpx

from loguru import logger
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


# ===== Constants =====

# Together AI endpoint for GLM-4.7-Flash
TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
GLM_MODEL = "together_ai/z-ai/glm-4.7-flash"
MAX_TOKENS = 4096
TEMPERATURE = 0.3  # Lower for more precise diagnostic reasoning
REQUEST_TIMEOUT = 120.0


# ===== Request/Response Models =====

class DiagnosticRequest(BaseModel):
    """Diagnostic request model."""
    patient_symptoms: str = Field(..., min_length=10, max_length=5000)
    medical_history: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = None
    current_medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    vital_signs: Optional[Dict[str, Any]] = None
    lab_results: Optional[Dict[str, Any]] = None
    specialty: Optional[str] = None
    top_k: int = Field(20, ge=5, le=50)


class DifferentialDiagnosis(BaseModel):
    """Differential diagnosis item."""
    condition: str
    icd10_code: Optional[str] = None
    probability: float = Field(ge=0.0, le=1.0)
    reasoning: str
    supporting_evidence: List[str] = field(default_factory=list)
    recommended_tests: List[str] = field(default_factory=list)


class Citation(BaseModel):
    """Literature citation."""
    pmid: str
    title: str
    authors: List[str] = field(default_factory=list)
    journal: Optional[str] = None
    publication_date: Optional[str] = None
    relevance_score: float = 0.0


class DiagnosticResponse(BaseModel):
    """Diagnostic response model."""
    request_id: str
    timestamp: str
    summary: str
    differential_diagnoses: List[DifferentialDiagnosis]
    evidence_summary: str
    citations: List[Citation]
    recommended_workup: List[str]
    treatment_considerations: List[str]
    red_flags: List[str]
    follow_up: str
    confidence_level: str
    articles_retrieved: int
    total_latency_ms: float
    model_used: str
    disclaimer: str = (
        "This AI-generated recommendation is for educational purposes only. "
        "Always verify with clinical examination and appropriate diagnostic tests."
    )


class DiagnosticEngine:
    """
    Diagnostic engine combining RAG retrieval with GLM-4.7-Flash via Together AI.
    
    GLM-4.7-Flash Advantages:
    - 200K context window (fit entire article corpus in single query)
    - Superior multi-step reasoning (complex diagnostic chains)
    - Task decomposition (understand multi-part diagnostic queries)
    - Structured output (JSON mode for consistent diagnosis formatting)
    - Multilingual support
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None
        
        self.stats = {
            "total_requests": 0,
            "total_tokens": 0,
            "total_errors": 0,
            "avg_latency_ms": 0.0,
        }
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            # Use Together AI if configured and key is available
            if self.settings.USE_TOGETHER_AI and self.settings.TOGETHER_API_KEY:
                api_key = self.settings.TOGETHER_API_KEY
                base_url = self.settings.TOGETHER_BASE_URL
                model = "together_ai/z-ai/glm-4.7-flash"
            else:
                # Default to Z.AI Direct
                api_key = self.settings.ZAI_API_KEY
                base_url = self.settings.ZAI_BASE_URL
                model = self.settings.GLM_MODEL
            
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(REQUEST_TIMEOUT, connect=10.0),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
            )
            self._current_base_url = base_url
            self._current_model = model
        return self._client
    
    def _build_system_prompt(self, specialty: Optional[str] = None) -> str:
        """Build system prompt for GLM-4.7-Flash using optimal Gelani prompts."""
        from app.prompts.system_prompts import MEDICAL_DIAGNOSTIC_SYSTEM_PROMPT
        
        # Use the comprehensive medical diagnostic system prompt
        base_prompt = MEDICAL_DIAGNOSTIC_SYSTEM_PROMPT
        
        # Add JSON output requirement for structured diagnostic response
        json_format = """

## JSON OUTPUT REQUIREMENT
For the diagnostic API, additionally provide this JSON structure in your response:

```json
{
  "summary": "Brief clinical summary",
  "differential_diagnoses": [
    {
      "condition": "Diagnosis name",
      "icd10_code": "ICD-10 code",
      "probability": 0.0-1.0,
      "reasoning": "Clinical reasoning with evidence",
      "supporting_evidence": ["Evidence items with PMIDs"],
      "recommended_tests": ["Diagnostic tests"]
    }
  ],
  "evidence_summary": "Summary of literature evidence",
  "recommended_workup": ["Diagnostic steps"],
  "treatment_considerations": ["Treatment options"],
  "red_flags": ["Critical warnings"],
  "follow_up": "Follow-up recommendation",
  "confidence_level": "high/medium/low"
}
```

Provide both the structured response AND the JSON for API parsing."""
        
        if specialty:
            base_prompt += f"\n\n## SPECIALTY FOCUS: {specialty.upper()}\nApply specialized {specialty} expertise with relevant differential diagnoses."
        
        return base_prompt + json_format
    
    def _build_user_prompt(
        self,
        request: DiagnosticRequest,
        retrieved_articles: List[Dict[str, Any]],
    ) -> str:
        """Build user prompt with patient info and literature."""
        parts = ["## Patient Presentation"]
        parts.append(f"**Symptoms**: {request.patient_symptoms}")
        
        if request.age:
            parts.append(f"**Age**: {request.age}")
        if request.gender:
            parts.append(f"**Gender**: {request.gender}")
        if request.medical_history:
            parts.append(f"**History**: {request.medical_history}")
        if request.current_medications:
            parts.append(f"**Medications**: {', '.join(request.current_medications)}")
        if request.allergies:
            parts.append(f"**Allergies**: {', '.join(request.allergies)}")
        if request.vital_signs:
            parts.append(f"**Vitals**: {json.dumps(request.vital_signs)}")
        
        if retrieved_articles:
            parts.append("\n## Retrieved Literature")
            for i, article in enumerate(retrieved_articles[:10], 1):
                parts.append(f"[{i}] PMID: {article.get('pmid', 'N/A')}")
                parts.append(f"Title: {article.get('title', 'N/A')}")
                parts.append(f"Relevance: {article.get('score', 0):.1%}")
        
        parts.append("\n## Task")
        parts.append("Provide differential diagnoses with evidence-based reasoning.")
        
        return "\n".join(parts)
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def _call_glm(
        self,
        messages: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Call GLM-4.7-Flash via Together AI API."""
        client = await self._get_client()
        
        model = getattr(self, '_current_model', self.settings.GLM_MODEL)
        base_url = getattr(self, '_current_base_url', self.settings.ZAI_BASE_URL)
        
        request_body = {
            "model": model,
            "messages": messages,
            "temperature": self.settings.GLM_TEMPERATURE,
            "max_tokens": self.settings.GLM_MAX_TOKENS,
            "top_p": 0.9,
        }
        
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                json=request_body,
            )
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            self.stats["total_errors"] += 1
            logger.error(f"GLM API error: {e.response.status_code} - {e.response.text}")
            raise
    
    async def diagnose(self, request: DiagnosticRequest) -> DiagnosticResponse:
        """Generate diagnostic recommendation."""
        start_time = time.time()
        request_id = f"diag_{int(time.time() * 1000)}"
        
        logger.info(f"Processing diagnostic request {request_id}")
        
        try:
            # Build prompts
            system_prompt = self._build_system_prompt(request.specialty)
            
            # Try to retrieve articles (optional)
            retrieved_articles = []
            try:
                from app.retrieval.rag_engine import RAGRetrievalEngine
                rag_engine = RAGRetrievalEngine()
                context = await rag_engine.retrieve(
                    query=request.patient_symptoms,
                    specialty=request.specialty,
                    top_k=request.top_k,
                )
                retrieved_articles = [a.to_dict() for a in context.articles]
            except Exception as e:
                logger.warning(f"RAG retrieval failed: {e}")
            
            user_prompt = self._build_user_prompt(request, retrieved_articles)
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            
            # Call GLM-4.7-Flash via Together AI
            response = await self._call_glm(messages)
            
            # Parse response
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Try to parse JSON
            parsed = {}
            try:
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    parsed = json.loads(json_match.group())
            except:
                pass
            
            # Build diagnoses
            diagnoses = []
            for d in parsed.get("differential_diagnoses", []):
                diagnoses.append(DifferentialDiagnosis(
                    condition=d.get("condition", "Unknown"),
                    icd10_code=d.get("icd10_code"),
                    probability=d.get("probability", 0.5),
                    reasoning=d.get("reasoning", ""),
                    supporting_evidence=d.get("supporting_evidence", []),
                    recommended_tests=d.get("recommended_tests", []),
                ))
            
            if not diagnoses:
                diagnoses.append(DifferentialDiagnosis(
                    condition="Clinical assessment required",
                    probability=0.5,
                    reasoning=content[:500] if content else "Unable to parse",
                ))
            
            # Build citations
            citations = [
                Citation(
                    pmid=a.get("pmid", ""),
                    title=a.get("title", ""),
                    authors=a.get("authors", []),
                    journal=a.get("journal"),
                    publication_date=a.get("publication_date"),
                    relevance_score=a.get("rerank_score", a.get("score", 0)),
                )
                for a in retrieved_articles[:10]
            ]
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Update stats
            self.stats["total_requests"] += 1
            self.stats["avg_latency_ms"] = (
                (self.stats["avg_latency_ms"] * (self.stats["total_requests"] - 1) + latency_ms)
                / self.stats["total_requests"]
            )
            
            usage = response.get("usage", {})
            self.stats["total_tokens"] += usage.get("total_tokens", 0)
            
            return DiagnosticResponse(
                request_id=request_id,
                timestamp=datetime.utcnow().isoformat(),
                summary=parsed.get("summary", "See differential diagnoses"),
                differential_diagnoses=diagnoses,
                evidence_summary=parsed.get("evidence_summary", "Literature retrieved"),
                citations=citations,
                recommended_workup=parsed.get("recommended_workup", ["Consult physician"]),
                treatment_considerations=parsed.get("treatment_considerations", []),
                red_flags=parsed.get("red_flags", []),
                follow_up=parsed.get("follow_up", "Schedule follow-up"),
                confidence_level=parsed.get("confidence_level", "medium"),
                articles_retrieved=len(retrieved_articles),
                total_latency_ms=latency_ms,
                model_used=getattr(self, '_current_model', self.settings.GLM_MODEL),
            )
            
        except Exception as e:
            logger.error(f"Diagnostic request failed: {e}")
            self.stats["total_errors"] += 1
            
            return DiagnosticResponse(
                request_id=request_id,
                timestamp=datetime.utcnow().isoformat(),
                summary="Processing error",
                differential_diagnoses=[DifferentialDiagnosis(
                    condition="Error",
                    probability=0.0,
                    reasoning=str(e),
                )],
                evidence_summary="",
                citations=[],
                recommended_workup=["Retry or consult physician"],
                treatment_considerations=[],
                red_flags=["System error"],
                follow_up="Consult physician",
                confidence_level="low",
                articles_retrieved=0,
                total_latency_ms=(time.time() - start_time) * 1000,
                model_used=getattr(self, '_current_model', self.settings.GLM_MODEL),
            )
    
    def get_stats(self) -> Dict[str, Any]:
        return self.stats
    
    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
