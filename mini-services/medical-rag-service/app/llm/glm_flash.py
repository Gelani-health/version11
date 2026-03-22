"""
GLM-4.7-Flash LLM Integration
=============================

Integration with Z.ai GLM-4.7-Flash for medical reasoning.
Supports thinking mode for clinical decision support.
"""

import asyncio
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass
import httpx
from datetime import datetime
import json

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


@dataclass
class LLMResponse:
    """LLM response structure."""
    content: str
    thinking: Optional[str]
    model: str
    provider: str
    latency_ms: float
    tokens_used: int
    finish_reason: str


@dataclass
class Message:
    """Chat message structure."""
    role: str  # "system", "user", "assistant"
    content: str


class GLMFlashClient:
    """
    GLM-4.7-Flash client for medical reasoning.
    
    Features:
    - Thinking mode for clinical reasoning
    - Async streaming responses
    - Retry with exponential backoff
    - Token usage tracking
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.ZAI_API_KEY
        self.base_url = self.settings.ZAI_BASE_URL
        self.model = self.settings.GLM_MODEL
        
        self._client = None
        
        # Statistics
        self.stats = {
            "total_requests": 0,
            "total_tokens": 0,
            "total_errors": 0,
            "avg_latency_ms": 0,
        }
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
            )
        return self._client
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def chat_completion(
        self,
        messages: List[Message],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        thinking_mode: bool = True,
    ) -> LLMResponse:
        """
        Generate chat completion with GLM-4.7-Flash.
        
        Args:
            messages: List of chat messages
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            thinking_mode: Enable thinking/reasoning mode
        
        Returns:
            LLMResponse with content and metadata
        """
        start_time = datetime.now()
        
        client = await self._get_client()
        
        # Build request body
        request_body = {
            "model": self.model,
            "messages": [
                {"role": m.role, "content": m.content}
                for m in messages
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        # Enable thinking mode for medical reasoning
        if thinking_mode:
            request_body["thinking"] = {"type": "enabled"}
        
        try:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=request_body,
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Parse response
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            
            content = message.get("content", "")
            thinking = message.get("thinking", None)
            
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            finish_reason = choice.get("finish_reason", "stop")
            
            # Calculate latency
            latency_ms = (datetime.now() - start_time).total_seconds() * 1000
            
            # Update stats
            self.stats["total_requests"] += 1
            self.stats["total_tokens"] += tokens_used
            self.stats["avg_latency_ms"] = (
                (self.stats["avg_latency_ms"] * (self.stats["total_requests"] - 1) + latency_ms)
                / self.stats["total_requests"]
            )
            
            return LLMResponse(
                content=content,
                thinking=thinking,
                model=self.model,
                provider="zai",
                latency_ms=latency_ms,
                tokens_used=tokens_used,
                finish_reason=finish_reason,
            )
            
        except httpx.HTTPStatusError as e:
            self.stats["total_errors"] += 1
            logger.error(f"GLM API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            self.stats["total_errors"] += 1
            logger.error(f"GLM request error: {e}")
            raise
    
    async def stream_completion(
        self,
        messages: List[Message],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        thinking_mode: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion for real-time responses.
        
        Yields:
            Text chunks as they are generated
        """
        client = await self._get_client()
        
        request_body = {
            "model": self.model,
            "messages": [
                {"role": m.role, "content": m.content}
                for m in messages
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        
        if thinking_mode:
            request_body["thinking"] = {"type": "enabled"}
        
        try:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=request_body,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        
                        if data_str == "[DONE]":
                            break
                        
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            
                            if content:
                                yield content
                                
                        except json.JSONDecodeError:
                            continue
                            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            raise
    
    async def medical_rag_query(
        self,
        query: str,
        retrieved_context: List[Dict[str, Any]],
        patient_context: Optional[Dict[str, Any]] = None,
        specialty: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate medical response using RAG context.
        
        Args:
            query: Medical query
            retrieved_context: Retrieved medical literature
            patient_context: Patient-specific information
            specialty: Medical specialty
        
        Returns:
            LLMResponse with clinical reasoning
        """
        # Build system prompt
        system_prompt = self._build_medical_system_prompt(specialty)
        
        # Build user prompt with context
        user_prompt = self._build_rag_prompt(
            query=query,
            context=retrieved_context,
            patient_context=patient_context,
        )
        
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=user_prompt),
        ]
        
        return await self.chat_completion(
            messages=messages,
            temperature=0.3,  # Lower temperature for medical accuracy
            max_tokens=4096,
            thinking_mode=True,
        )
    
    def _build_medical_system_prompt(self, specialty: Optional[str] = None) -> str:
        """Build system prompt for medical reasoning using optimal Gelani prompts."""
        from app.prompts.system_prompts import MEDICAL_DIAGNOSTIC_SYSTEM_PROMPT
        
        base_prompt = MEDICAL_DIAGNOSTIC_SYSTEM_PROMPT
        
        if specialty:
            # Add specialty-specific focus with relevant MeSH terms
            specialty_focus = f"""

## SPECIALTY FOCUS: {specialty.upper()}

Apply specialized clinical reasoning for {specialty}. Consider specialty-specific:
- Differential diagnoses common in {specialty}
- Specialty-specific diagnostic criteria
- Relevant clinical guidelines
- Specialty referral criteria"""
            base_prompt += specialty_focus
        
        return base_prompt
    
    def _build_rag_prompt(
        self,
        query: str,
        context: List[Dict[str, Any]],
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build RAG prompt with retrieved context."""
        prompt_parts = [f"## Clinical Query\n{query}\n"]
        
        # Add patient context if available
        if patient_context:
            prompt_parts.append("## Patient Context")
            prompt_parts.append(f"- Age: {patient_context.get('age', 'Unknown')}")
            prompt_parts.append(f"- Gender: {patient_context.get('gender', 'Unknown')}")
            
            if patient_context.get('conditions'):
                prompt_parts.append(f"- Known Conditions: {', '.join(patient_context['conditions'])}")
            
            if patient_context.get('medications'):
                prompt_parts.append(f"- Current Medications: {', '.join(patient_context['medications'])}")
            
            if patient_context.get('allergies'):
                prompt_parts.append(f"- Allergies: {', '.join(patient_context['allergies'])}")
            
            prompt_parts.append("")
        
        # Add retrieved literature
        if context:
            prompt_parts.append("## Retrieved Medical Literature\n")
            for i, article in enumerate(context[:10], 1):  # Top 10 articles
                prompt_parts.append(f"### [{i}] PMID: {article.get('pmid', 'N/A')}")
                prompt_parts.append(f"**Title**: {article.get('title', 'N/A')}")
                prompt_parts.append(f"**Journal**: {article.get('journal', 'N/A')}")
                prompt_parts.append(f"**Relevance Score**: {article.get('score', 0):.2%}")
                
                abstract = article.get('abstract', '')[:500]
                if abstract:
                    prompt_parts.append(f"**Abstract (excerpt)**: {abstract}...")
                
                mesh_terms = article.get('mesh_terms', [])
                if mesh_terms:
                    prompt_parts.append(f"**MeSH Terms**: {', '.join(mesh_terms[:5])}")
                
                prompt_parts.append("")
        
        prompt_parts.append("## Task")
        prompt_parts.append("Based on the clinical query and retrieved medical literature above, provide a comprehensive evidence-based response. Include citations using PMID references.")
        
        return "\n".join(prompt_parts)
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton instance
_llm_client: Optional[GLMFlashClient] = None


async def get_llm_client() -> GLMFlashClient:
    """Get or create LLM client instance."""
    global _llm_client
    if _llm_client is None:
        _llm_client = GLMFlashClient()
    return _llm_client
