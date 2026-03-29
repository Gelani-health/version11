"""
P9: Together AI Embedding Client
================================

Provides embedding generation using Together AI's m2-bert-80M-8k-retrieval model.
This model is optimized for retrieval tasks with 8K context window.

API Documentation:
- https://docs.together.ai/docs/embeddings
- Model: togethercomputer/m2-bert-80M-8k-retrieval
- Dimension: 768

Rate Limits:
- Batch size: 32 recommended
- Rate limit: Depends on API tier
"""

import asyncio
import aiohttp
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


# =============================================================================
# CONSTANTS
# =============================================================================

# Together AI embedding model
EMBEDDING_MODEL = "togethercomputer/m2-bert-80M-8k-retrieval"
EMBEDDING_DIMENSION = 768

# API endpoints
TOGETHER_EMBEDDING_URL = "https://api.together.xyz/v1/embeddings"

# Rate limiting
DEFAULT_BATCH_SIZE = 32
MAX_RETRIES = 3


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class EmbeddingResult:
    """Result of embedding generation."""
    text: str
    embedding: List[float]
    model: str
    dimension: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text[:100] + "..." if len(self.text) > 100 else self.text,
            "embedding_dimension": self.dimension,
            "model": self.model,
        }


# =============================================================================
# EMBEDDING CLIENT
# =============================================================================

class TogetherAIEmbeddingClient:
    """
    P9: Together AI embedding client for medical text.
    
    Features:
    - m2-bert-80M-8k-retrieval model (768 dimensions)
    - Batch embedding support
    - Automatic retry with exponential backoff
    - Rate limit handling
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.settings = get_settings()
        self.api_key = api_key or self.settings.TOGETHER_API_KEY or self.settings.ZAI_API_KEY
        self.model = EMBEDDING_MODEL
        self.dimension = EMBEDDING_DIMENSION
        
        # Statistics
        self.stats = {
            "total_embeddings": 0,
            "total_tokens": 0,
            "total_errors": 0,
            "avg_latency_ms": 0.0,
        }
    
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(min=1, max=10)
    )
    async def embed(
        self,
        text: str,
        session: Optional[aiohttp.ClientSession] = None
    ) -> EmbeddingResult:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            session: Optional aiohttp session (creates new if None)
        
        Returns:
            EmbeddingResult with embedding vector
        """
        results = await self.embed_batch([text], session)
        return results[0]
    
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(min=1, max=10)
    )
    async def embed_batch(
        self,
        texts: List[str],
        session: Optional[aiohttp.ClientSession] = None
    ) -> List[EmbeddingResult]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts to embed
            session: Optional aiohttp session
        
        Returns:
            List of EmbeddingResult objects
        """
        import time
        start_time = time.time()
        
        if not texts:
            return []
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "input": texts,
        }
        
        own_session = session is None
        
        try:
            if own_session:
                session = aiohttp.ClientSession()
            
            async with session.post(
                TOGETHER_EMBEDDING_URL,
                headers=headers,
                json=payload
            ) as response:
                if response.status == 429:
                    # Rate limited
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.warning(f"[EmbeddingClient] Rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    raise Exception("Rate limited")
                
                response.raise_for_status()
                data = await response.json()
            
            # Parse response
            results = []
            for i, item in enumerate(data.get("data", [])):
                embedding = item.get("embedding", [])
                results.append(EmbeddingResult(
                    text=texts[i],
                    embedding=embedding,
                    model=self.model,
                    dimension=len(embedding)
                ))
            
            # Update stats
            latency_ms = (time.time() - start_time) * 1000
            self.stats["total_embeddings"] += len(texts)
            self.stats["total_tokens"] += data.get("usage", {}).get("total_tokens", 0)
            self.stats["avg_latency_ms"] = (
                (self.stats["avg_latency_ms"] * (self.stats["total_embeddings"] - len(texts)) + latency_ms)
                / self.stats["total_embeddings"]
            )
            
            logger.debug(f"[EmbeddingClient] Generated {len(results)} embeddings in {latency_ms:.2f}ms")
            
            return results
            
        except Exception as e:
            self.stats["total_errors"] += 1
            logger.error(f"[EmbeddingClient] Embedding failed: {e}")
            raise
            
        finally:
            if own_session:
                await session.close()
    
    async def embed_with_cache(
        self,
        text: str,
        cache: Optional[Dict[str, List[float]]] = None
    ) -> List[float]:
        """
        Generate embedding with optional caching.
        
        Args:
            text: Text to embed
            cache: Optional cache dict (text -> embedding)
        
        Returns:
            Embedding vector
        """
        if cache is not None and text in cache:
            return cache[text]
        
        result = await self.embed(text)
        
        if cache is not None:
            cache[text] = result.embedding
        
        return result.embedding
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics."""
        return {
            **self.stats,
            "model": self.model,
            "dimension": self.dimension,
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_client: Optional[TogetherAIEmbeddingClient] = None


async def get_embedding_client() -> TogetherAIEmbeddingClient:
    """Get or create embedding client singleton."""
    global _client
    
    if _client is None:
        _client = TogetherAIEmbeddingClient()
    
    return _client
