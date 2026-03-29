"""
Embedding Module for Medical RAG
=================================

PubMedBERT-based embeddings optimized for medical literature.
Supports batch processing and caching.
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import hashlib
import json
from datetime import datetime
import time

from loguru import logger


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""
    text_hash: str
    embedding: List[float]
    model_name: str
    dimension: int
    processing_time_ms: float


class EmbeddingCache:
    """In-memory cache for embeddings (Redis in production)."""
    
    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, List[float]] = {}
        self._max_size = max_size
        self._stats = {"hits": 0, "misses": 0}
    
    def _hash_text(self, text: str) -> str:
        """Generate hash for text."""
        return hashlib.md5(text.encode()).hexdigest()
    
    def get(self, text: str) -> Optional[List[float]]:
        """Get cached embedding."""
        key = self._hash_text(text)
        if key in self._cache:
            self._stats["hits"] += 1
            return self._cache[key]
        self._stats["misses"] += 1
        return None
    
    def set(self, text: str, embedding: List[float]) -> None:
        """Cache embedding."""
        if len(self._cache) >= self._max_size:
            # Remove oldest entries
            keys_to_remove = list(self._cache.keys())[:self._max_size // 10]
            for key in keys_to_remove:
                del self._cache[key]
        
        key = self._hash_text(text)
        self._cache[key] = embedding
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0
        return {
            **self._stats,
            "hit_rate": hit_rate,
            "size": len(self._cache),
            "max_size": self._max_size,
        }


class MedicalEmbeddingService:
    """
    PubMedBERT-based embedding service for medical text.
    
    Features:
    - Domain-specific embeddings (PubMedBERT)
    - Batch processing
    - Caching
    - Chunking for long texts
    
    CRITICAL: Requires sentence-transformers to be installed.
    NO FALLBACK - will raise error if model cannot be loaded.
    
    Installation:
        pip install sentence-transformers torch
    """
    
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = [2, 4, 8]  # Exponential backoff
    
    class EmbeddingError(Exception):
        """Raised when embedding generation fails."""
        pass
    
    def __init__(
        self,
        model_name: str = "all-mpnet-base-v2",  # Using public model
        device: str = "cpu",
        max_seq_length: int = 512,
        batch_size: int = 32,
    ):
        self.model_name = model_name
        self.device = device
        self.max_seq_length = max_seq_length
        self.batch_size = batch_size
        self.dimension = 768  # all-mpnet-base-v2 dimension
        
        self._model = None
        self._tokenizer = None
        self._cache = EmbeddingCache()
        self._initialized = False
        
        # Statistics
        self.stats = {
            "total_embeddings": 0,
            "total_tokens": 0,
            "avg_latency_ms": 0,
            "errors": 0,
            "retries": 0,
        }
    
    async def load_model(self) -> None:
        """Load embedding model with retry logic."""
        if self._initialized:
            return
        
        errors = []
        
        for attempt in range(self.MAX_RETRIES):
            try:
                from sentence_transformers import SentenceTransformer
                
                logger.info(f"Loading embedding model: {self.model_name} (attempt {attempt + 1}/{self.MAX_RETRIES})")
                self._model = SentenceTransformer(self.model_name, device=self.device)
                self._model.max_seq_length = self.max_seq_length
                logger.info(f"Embedding model loaded successfully on device: {self.device}")
                self._initialized = True
                return
                
            except ImportError as e:
                error_msg = (
                    f"CRITICAL: sentence-transformers library not installed.\n"
                    f"Error: {e}\n\n"
                    f"INSTALLATION REQUIRED:\n"
                    f"  pip install sentence-transformers torch\n\n"
                    f"The embedding model '{self.model_name}' requires the sentence-transformers library.\n"
                    f"Without it, NO vectors can be generated for the vector database.\n\n"
                    f"This is a production requirement - there is NO fallback embedding method."
                )
                errors.append(error_msg)
                logger.error(error_msg)
                break  # No point retrying import errors
                
            except Exception as e:
                error_msg = f"Attempt {attempt + 1} failed: {type(e).__name__}: {e}"
                errors.append(error_msg)
                logger.warning(error_msg)
                
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAY_SECONDS[attempt]
                    logger.info(f"Retrying in {delay} seconds...")
                    self.stats["retries"] += 1
                    await asyncio.sleep(delay)
        
        # All retries failed - raise comprehensive error
        self._initialized = True  # Mark as attempted
        
        error_report = (
            f"\n{'='*70}\n"
            f"EMBEDDING MODEL INITIALIZATION FAILED\n"
            f"{'='*70}\n\n"
            f"Model: {self.model_name}\n"
            f"Device: {self.device}\n"
            f"Attempts: {self.MAX_RETRIES}\n\n"
            f"ERRORS:\n" + "\n".join(f"  - {e}" for e in errors) + "\n\n"
            f"TROUBLESHOOTING:\n"
            f"  1. Check internet connection (model download required)\n"
            f"  2. Verify sentence-transformers is installed: pip show sentence-transformers\n"
            f"  3. Check disk space (model is ~400MB)\n"
            f"  4. Try clearing HuggingFace cache: rm -rf ~/.cache/huggingface\n\n"
            f"IMPACT:\n"
            f"  - Vector ingestion to Pinecone will FAIL\n"
            f"  - RAG retrieval will return NO results\n"
            f"  - Diagnostic recommendations will have NO literature support\n"
            f"{'='*70}\n"
        )
        
        raise self.EmbeddingError(error_report)
    
    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 400,
        overlap: int = 50,
    ) -> List[Tuple[str, int]]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Input text
            chunk_size: Maximum tokens per chunk
            overlap: Overlap between chunks
        
        Returns:
            List of (chunk_text, start_position) tuples
        """
        words = text.split()
        chunks = []
        
        if len(words) <= chunk_size:
            return [(text, 0)]
        
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk = " ".join(words[start:end])
            chunks.append((chunk, start))
            
            if end >= len(words):
                break
            
            start = end - overlap
        
        return chunks
    
    async def generate_embedding(
        self,
        text: str,
        use_cache: bool = True,
    ) -> EmbeddingResult:
        """
        Generate embedding for a single text.
        
        Args:
            text: Input text
            use_cache: Use cached embedding if available
        
        Returns:
            EmbeddingResult with embedding vector
            
        Raises:
            EmbeddingError: If model is not loaded or embedding generation fails
        """
        await self.load_model()
        
        if self._model is None:
            raise self.EmbeddingError(
                f"Embedding model not loaded. Cannot generate embedding for text.\n"
                f"This indicates a failed initialization - check logs above for details.\n"
                f"Text preview: {text[:100]}..."
            )
        
        start_time = datetime.now()
        
        # Check cache
        if use_cache:
            cached = self._cache.get(text)
            if cached is not None:
                return EmbeddingResult(
                    text_hash=self._cache._hash_text(text),
                    embedding=cached,
                    model_name=self.model_name,
                    dimension=len(cached),
                    processing_time_ms=0,
                )
        
        try:
            # Generate embedding using sentence-transformers
            import numpy as np
            embedding = self._model.encode(text, convert_to_numpy=True)
            embedding = embedding.tolist()
            
            # Validate embedding
            if not embedding or len(embedding) != self.dimension:
                raise self.EmbeddingError(
                    f"Invalid embedding generated: expected {self.dimension} dimensions, "
                    f"got {len(embedding) if embedding else 0}"
                )
            
            # Check for NaN values
            if any(isinstance(x, float) and (x != x) for x in embedding):  # NaN check
                raise self.EmbeddingError(
                    f"Embedding contains NaN values - this indicates a model error.\n"
                    f"Text preview: {text[:100]}..."
                )
            
            # Cache result
            if use_cache:
                self._cache.set(text, embedding)
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Update stats
            self.stats["total_embeddings"] += 1
            self.stats["avg_latency_ms"] = (
                (self.stats["avg_latency_ms"] * (self.stats["total_embeddings"] - 1) + processing_time)
                / self.stats["total_embeddings"]
            )
            
            return EmbeddingResult(
                text_hash=self._cache._hash_text(text),
                embedding=embedding,
                model_name=self.model_name,
                dimension=self.dimension,
                processing_time_ms=processing_time,
            )
            
        except self.EmbeddingError:
            raise
        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Embedding generation error: {e}")
            raise self.EmbeddingError(
                f"Embedding generation failed: {type(e).__name__}: {e}\n"
                f"Text preview: {text[:100]}..."
            )
    
    # REMOVED: _generate_semantic_embedding fallback method
    # This service now REQUIRES sentence-transformers to be properly installed.
    # There is NO fallback - if the model cannot be loaded, an error will be raised.
    # This ensures data integrity in the vector database.
    
    async def generate_embeddings_batch(
        self,
        texts: List[str],
        use_cache: bool = True,
    ) -> List[EmbeddingResult]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of input texts
            use_cache: Use cached embeddings
        
        Returns:
            List of EmbeddingResult objects
        """
        results = []
        
        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            
            # Generate embeddings concurrently
            tasks = [
                self.generate_embedding(text, use_cache)
                for text in batch
            ]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
        
        return results
    
    async def embed_article(
        self,
        article: Dict[str, Any],
        include_chunks: bool = True,
    ) -> List[Tuple[str, List[float], Dict[str, Any]]]:
        """
        Generate embeddings for an article.
        
        Args:
            article: Article dictionary with title, abstract, etc.
            include_chunks: Generate embeddings for chunks
        
        Returns:
            List of (id, embedding, metadata) tuples
        """
        results = []
        pmid = article.get("pmid", "unknown")
        
        # Main embedding: title + abstract
        main_text = f"{article.get('title', '')}\n\n{article.get('abstract', '')}"
        main_result = await self.generate_embedding(main_text)
        
        results.append((
            f"pmid_{pmid}",
            main_result.embedding,
            {
                "pmid": pmid,
                "chunk_index": 0,
                "text_type": "main",
                **article,
            }
        ))
        
        # Chunk embeddings for long texts
        if include_chunks and len(main_text) > 1000:
            chunks = self._chunk_text(main_text)
            
            for idx, (chunk_text, start_pos) in enumerate(chunks[1:], 1):  # Skip first (already embedded)
                chunk_result = await self.generate_embedding(chunk_text)
                
                results.append((
                    f"pmid_{pmid}_chunk_{idx}",
                    chunk_result.embedding,
                    {
                        "pmid": pmid,
                        "chunk_index": idx,
                        "text_type": "chunk",
                        "chunk_start": start_pos,
                        **article,
                    }
                ))
        
        return results
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self._cache.get_stats()


class MedicalQueryEmbedding:
    """
    Specialized embedding for medical queries.
    
    Enhances queries with:
    - MeSH term expansion
    - Synonym expansion
    - Medical abbreviation resolution
    """
    
    # Medical abbreviations
    ABBREVIATIONS = {
        "MI": "myocardial infarction",
        "CHF": "congestive heart failure",
        "COPD": "chronic obstructive pulmonary disease",
        "DM": "diabetes mellitus",
        "HTN": "hypertension",
        "DVT": "deep vein thrombosis",
        "PE": "pulmonary embolism",
        "AKI": "acute kidney injury",
        "CKD": "chronic kidney disease",
        "TIA": "transient ischemic attack",
        "BPH": "benign prostatic hyperplasia",
        "GERD": "gastroesophageal reflux disease",
        "IBD": "inflammatory bowel disease",
        "RA": "rheumatoid arthritis",
        "SLE": "systemic lupus erythematosus",
    }
    
    def __init__(self, embedding_service: MedicalEmbeddingService):
        self.embedding_service = embedding_service
    
    def expand_query(self, query: str) -> str:
        """
        Expand query with medical term expansions.
        
        Args:
            query: Original query
        
        Returns:
            Expanded query
        """
        expanded = query
        
        # Expand abbreviations
        for abbr, full in self.ABBREVIATIONS.items():
            pattern = r'\b' + abbr + r'\b'
            if re.search(pattern, query, re.IGNORECASE):
                expanded = re.sub(
                    pattern,
                    f"{abbr} ({full})",
                    expanded,
                    flags=re.IGNORECASE
                )
        
        return expanded
    
    async def embed_query(
        self,
        query: str,
        expand: bool = True,
    ) -> EmbeddingResult:
        """
        Generate embedding for a medical query.
        
        Args:
            query: Medical query text
            expand: Apply medical expansion
        
        Returns:
            EmbeddingResult with query embedding
        """
        if expand:
            query = self.expand_query(query)
        
        return await self.embedding_service.generate_embedding(query)


# Import re for regex
import re

# Convenience functions
_embedding_service: Optional[MedicalEmbeddingService] = None


async def get_embedding_service() -> MedicalEmbeddingService:
    """Get or create embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = MedicalEmbeddingService()
        await _embedding_service.load_model()
    return _embedding_service
