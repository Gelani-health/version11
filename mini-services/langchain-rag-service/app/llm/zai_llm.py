"""
LLM Integration for LangChain RAG
=================================

Uses GLM-4.7-Flash via Z.AI for generation.
"""

import asyncio
import time
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass

import httpx
from loguru import logger

from app.core.config import get_settings


@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str
    model: str
    latency_ms: float
    tokens_used: int = 0
    finish_reason: str = "stop"


class ZAILLM:
    """
    Z.AI LLM client for GLM-4.7-Flash.

    Used for:
    - Query expansion
    - Answer generation
    - Diagnostic reasoning
    """

    MAX_RETRIES = 3
    RETRY_DELAY = [1, 2, 4]

    def __init__(self):
        self.settings = get_settings()
        self.stats = {
            "total_requests": 0,
            "total_tokens": 0,
            "avg_latency_ms": 0,
            "errors": 0,
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        """
        Generate a response from the LLM.

        Args:
            prompt: User prompt
            system_prompt: System prompt for context
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Returns:
            LLMResponse with generated content
        """
        start_time = time.time()

        max_tokens = max_tokens or self.settings.GLM_MAX_TOKENS
        temperature = temperature or self.settings.GLM_TEMPERATURE

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_error = None

        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.settings.ZAI_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.settings.ZAI_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.settings.GLM_MODEL,
                            "messages": messages,
                            "max_tokens": max_tokens,
                            "temperature": temperature,
                        },
                    )

                    if response.status_code == 200:
                        data = response.json()
                        content = data["choices"][0]["message"]["content"]
                        tokens_used = data.get("usage", {}).get("total_tokens", 0)

                        latency_ms = (time.time() - start_time) * 1000

                        # Update stats
                        self.stats["total_requests"] += 1
                        self.stats["total_tokens"] += tokens_used
                        self.stats["avg_latency_ms"] = (
                            (self.stats["avg_latency_ms"] * (self.stats["total_requests"] - 1) + latency_ms)
                            / self.stats["total_requests"]
                        )

                        return LLMResponse(
                            content=content,
                            model=self.settings.GLM_MODEL,
                            latency_ms=latency_ms,
                            tokens_used=tokens_used,
                            finish_reason=data["choices"][0].get("finish_reason", "stop"),
                        )

                    else:
                        last_error = f"API error: {response.status_code} - {response.text}"
                        logger.warning(f"[LLM] Attempt {attempt + 1} failed: {last_error}")

            except httpx.TimeoutException:
                last_error = "Request timeout"
                logger.warning(f"[LLM] Timeout on attempt {attempt + 1}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"[LLM] Error on attempt {attempt + 1}: {e}")

            if attempt < self.MAX_RETRIES - 1:
                await asyncio.sleep(self.RETRY_DELAY[attempt])

        self.stats["errors"] += 1
        raise Exception(f"LLM request failed after {self.MAX_RETRIES} attempts: {last_error}")

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming response from the LLM.
        """
        max_tokens = max_tokens or self.settings.GLM_MAX_TOKENS
        temperature = temperature or self.settings.GLM_TEMPERATURE

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.settings.ZAI_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.ZAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.settings.GLM_MODEL,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "stream": True,
                    },
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                import json
                                chunk = json.loads(data)
                                if chunk["choices"][0].get("delta", {}).get("content"):
                                    yield chunk["choices"][0]["delta"]["content"]
                            except:
                                continue

        except Exception as e:
            logger.error(f"[LLM] Streaming error: {e}")
            raise

    async def expand_query(self, query: str) -> str:
        """
        Expand a medical query with related terms.
        """
        system_prompt = """You are a medical query expansion expert.
Given a medical query, expand it with relevant medical terminology,
synonyms, and related concepts. Return only the expanded query."""

        response = await self.generate(
            prompt=query,
            system_prompt=system_prompt,
            max_tokens=500,
            temperature=0.3,
        )

        return response.content

    def get_stats(self) -> Dict[str, Any]:
        """Get LLM statistics."""
        return {
            **self.stats,
            "model": self.settings.GLM_MODEL,
        }
