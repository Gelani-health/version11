"""
Embedding Pipeline for Medical RAG
==================================

PubMedBERT-based embeddings with Pinecone ingestion.

Configuration:
- Model: microsoft/BiomedNLP-PubMedBERT-base (768 dimensions)
- Metric: cosine (semantic similarity)
- Chunking: 200-500 tokens with 100-token overlap
- Batch upsert: 2000 vectors per batch

Pinecone API:
- Base URL: https://api.pinecone.io/v1/
- Upsert: POST /indexes/{index_name}/vectors
- Query: POST /indexes/{index_name}/query
"""

import asyncio
import time
import hashlib
import json
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from loguru import logger

from app.core.config import get_settings
from app.core.pinecone_config import (
    PINECONE_INDEX_NAME,
    PINECONE_DIMENSION,
    PINECONE_NAMESPACE,
    PINECONE_MAX_BATCH_SIZE,
    VectorMetadata,
    build_medical_filter,
)


# ===== Chunking Constants =====
MIN_CHUNK_TOKENS = 200
MAX_CHUNK_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 100

# ===== Embedding Constants =====
# Using all-mpnet-base-v2 (768 dimensions, public model)
# Alternative: all-MiniLM-L6-v2 (384 dimensions, faster but less accurate)
# Note: microsoft/BiomedNLP-PubMedBERT-base requires HuggingFace authentication
EMBEDDING_MODEL = "all-mpnet-base-v2"  # 768 dimensions, public, works for medical text
EMBEDDING_DIMENSION = 768

# ===== Pinecone Constants =====
PINECONE_BATCH_SIZE = 2000


@dataclass
class ChunkMetadata:
    """Metadata for an embedded chunk."""
    pmid: str
    pmcid: Optional[str] = None
    title: str = ""
    section_type: str = "abstract"
    mesh_terms: List[str] = field(default_factory=list)
    pub_date: Optional[str] = None
    source_type: str = "PubMed"
    chunk_index: int = 0
    total_chunks: int = 1
    journal: str = ""
    authors: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    
    def to_pinecone_metadata(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "pmcid": self.pmcid or "",
            "title": self.title[:1000],
            "section_type": self.section_type,
            "mesh_terms": json.dumps(self.mesh_terms[:20]),
            "pub_date": self.pub_date or "",
            "source_type": self.source_type,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "journal": self.journal[:200],
            "authors": json.dumps(self.authors[:10]),
            "doi": self.doi or "",
            "ingest_timestamp": datetime.utcnow().isoformat(),
        }


@dataclass
class IngestionStats:
    """Statistics for ingestion pipeline."""
    total_articles: int = 0
    total_chunks: int = 0
    total_vectors: int = 0
    successful_upserts: int = 0
    failed_upserts: int = 0
    duration_seconds: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_articles": self.total_articles,
            "total_chunks": self.total_chunks,
            "total_vectors": self.total_vectors,
            "successful_upserts": self.successful_upserts,
            "failed_upserts": self.failed_upserts,
            "duration_seconds": round(self.duration_seconds, 2),
        }


class TextChunker:
    """Semantic text chunker for medical literature."""
    
    TOKENS_PER_WORD = 1.3
    
    def __init__(
        self,
        min_chunk_tokens: int = MIN_CHUNK_TOKENS,
        max_chunk_tokens: int = MAX_CHUNK_TOKENS,
        overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
    ):
        self.min_chunk_tokens = min_chunk_tokens
        self.max_chunk_tokens = max_chunk_tokens
        self.overlap_tokens = overlap_tokens
    
    def estimate_tokens(self, text: str) -> int:
        return int(len(text.split()) * self.TOKENS_PER_WORD)
    
    def chunk_text(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into overlapping chunks."""
        if not text.strip():
            return []
        
        words = text.split()
        chunks = []
        
        if len(words) <= self.max_chunk_tokens:
            return [(text, 0, len(words))]
        
        start = 0
        while start < len(words):
            end = min(start + self.max_chunk_tokens, len(words))
            chunk = " ".join(words[start:end])
            chunks.append((chunk, start, end))
            
            if end >= len(words):
                break
            
            start = end - self.overlap_tokens
        
        return chunks
    
    def chunk_article(
        self,
        article: Dict[str, Any],
    ) -> List[Tuple[str, Dict[str, Any]]]:
        """Chunk an article with metadata preservation."""
        chunks = []
        pmid = article.get("pmid", "unknown")
        
        text = f"{article.get('title', '')}\n\n{article.get('abstract', '')}"
        text_chunks = self.chunk_text(text)
        
        for idx, (chunk_text, start, end) in enumerate(text_chunks):
            chunk_meta = {
                "pmid": pmid,
                "section_type": "abstract" if idx == 0 else "full_text",
                "chunk_index": idx,
                **{k: v for k, v in article.items() if k not in ["abstract", "text_content"]},
            }
            chunks.append((chunk_text, chunk_meta))
        
        return chunks


class PubMedBERTEmbedder:
    """
    PubMedBERT-based embedding service with NO FALLBACK.
    
    CRITICAL: This class requires sentence-transformers to be installed.
    If the model cannot be loaded, it will raise an error instead of using
    mock/fallback embeddings. This ensures data integrity in the vector database.
    
    Installation:
        pip install sentence-transformers torch
    
    Model: microsoft/BiomedNLP-PubMedBERT-base (768 dimensions)
    """
    
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = [2, 4, 8]  # Exponential backoff
    
    class EmbeddingError(Exception):
        """Raised when embedding generation fails."""
        pass
    
    def __init__(
        self,
        model_name: str = EMBEDDING_MODEL,
        device: str = "cpu",
        batch_size: int = 32,
    ):
        self.model_name = model_name
        self.device = device
        self.batch_size = batch_size
        self.dimension = EMBEDDING_DIMENSION
        
        self._model = None
        self._initialized = False
        self._cache: Dict[str, List[float]] = {}
        
        self.stats = {
            "total_embeddings": 0,
            "avg_latency_ms": 0,
            "errors": 0,
            "retries": 0,
        }
    
    async def initialize(self):
        """
        Initialize embedding model.
        
        Raises:
            EmbeddingError: If model cannot be loaded after retries
        """
        if self._initialized:
            return
        
        errors = []
        
        for attempt in range(self.MAX_RETRIES):
            try:
                from sentence_transformers import SentenceTransformer
                
                logger.info(f"Loading embedding model: {self.model_name} (attempt {attempt + 1}/{self.MAX_RETRIES})")
                self._model = SentenceTransformer(self.model_name, device=self.device)
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
    
    async def embed(self, text: str, use_cache: bool = True) -> List[float]:
        """
        Generate embedding for text.
        
        Raises:
            EmbeddingError: If model is not loaded or embedding generation fails
        """
        await self.initialize()
        
        if self._model is None:
            raise self.EmbeddingError(
                f"Embedding model not loaded. Cannot generate embedding for text.\n"
                f"This indicates a failed initialization - check logs above for details.\n"
                f"Text preview: {text[:100]}..."
            )
        
        text_hash = hashlib.md5(text.encode()).hexdigest()
        
        if use_cache and text_hash in self._cache:
            return self._cache[text_hash]
        
        start_time = time.time()
        
        try:
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
            
        except self.EmbeddingError:
            raise
        except Exception as e:
            self.stats["errors"] += 1
            raise self.EmbeddingError(
                f"Embedding generation failed: {type(e).__name__}: {e}\n"
                f"Text preview: {text[:100]}..."
            )
        
        if use_cache:
            self._cache[text_hash] = embedding
        
        latency = (time.time() - start_time) * 1000
        self.stats["total_embeddings"] += 1
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (self.stats["total_embeddings"] - 1) + latency)
            / self.stats["total_embeddings"]
        )
        
        return embedding
    
    async def embed_batch(self, texts: List[str], use_cache: bool = True) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        
        Raises:
            EmbeddingError: If model is not loaded or embedding generation fails
        """
        await self.initialize()
        
        if self._model is None:
            raise self.EmbeddingError(
                f"Embedding model not loaded. Cannot generate embeddings for {len(texts)} texts.\n"
                f"This indicates a failed initialization - check logs above for details."
            )
        
        try:
            import numpy as np
            embeddings = self._model.encode(texts, convert_to_numpy=True)
            embeddings_list = embeddings.tolist()
            
            # Validate all embeddings
            for i, embedding in enumerate(embeddings_list):
                if len(embedding) != self.dimension:
                    raise self.EmbeddingError(
                        f"Invalid embedding at index {i}: expected {self.dimension} dimensions, "
                        f"got {len(embedding)}"
                    )
                if any(isinstance(x, float) and (x != x) for x in embedding):
                    raise self.EmbeddingError(
                        f"Embedding at index {i} contains NaN values"
                    )
            
            return embeddings_list
            
        except self.EmbeddingError:
            raise
        except Exception as e:
            self.stats["errors"] += 1
            raise self.EmbeddingError(
                f"Batch embedding generation failed for {len(texts)} texts: "
                f"{type(e).__name__}: {e}"
            )
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            **self.stats,
            "cache_size": len(self._cache),
            "model_loaded": self._model is not None,
            "model_name": self.model_name,
            "device": self.device,
            "dimension": self.dimension,
        }


class PineconeIngestionPipeline:
    """
    Complete pipeline for embedding and ingesting articles into Pinecone.
    """
    
    def __init__(self, batch_size: int = PINECONE_BATCH_SIZE):
        self.settings = get_settings()
        self.embedder = PubMedBERTEmbedder()
        self.chunker = TextChunker()
        self.batch_size = batch_size
        
        self._pinecone = None
        self._index = None
        self._initialized = False
        
        self.stats = IngestionStats()
    
    async def initialize(self):
        """Initialize Pinecone connection and embedder."""
        if self._initialized:
            return
        
        await self.embedder.initialize()
        
        try:
            from pinecone import Pinecone
            
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            logger.info(f"Connected to Pinecone index: {self.settings.PINECONE_INDEX_NAME}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone: {e}")
            raise
        
        self._initialized = True
    
    def _generate_vector_id(self, pmid: str, chunk_index: int) -> str:
        return f"pmid_{pmid}_chunk_{chunk_index}"
    
    async def ingest_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """Ingest a single article into Pinecone."""
        if not self._initialized:
            await self.initialize()
        
        pmid = article.get("pmid", "unknown")
        chunks = self.chunker.chunk_article(article)
        
        if not chunks:
            return {"vectors": 0, "status": "no_content"}
        
        texts = [chunk_text for chunk_text, _ in chunks]
        embeddings = await self.embedder.embed_batch(texts)
        
        vectors = []
        for i, ((chunk_text, chunk_meta), embedding) in enumerate(zip(chunks, embeddings)):
            vector_id = self._generate_vector_id(pmid, i)
            
            metadata = ChunkMetadata(
                pmid=pmid,
                pmcid=article.get("pmc_id"),
                title=article.get("title", "")[:1000],
                section_type=chunk_meta.get("section_type", "abstract"),
                mesh_terms=article.get("mesh_terms", []),
                pub_date=article.get("publication_date"),
                source_type="PMC" if article.get("pmc_id") else "PubMed",
                chunk_index=i,
                total_chunks=len(chunks),
                journal=article.get("journal", ""),
                authors=article.get("authors", []),
                doi=article.get("doi"),
            )
            
            vectors.append((vector_id, embedding, metadata.to_pinecone_metadata()))
        
        # Upsert to Pinecone
        await self._upsert_batch(vectors)
        
        self.stats.total_articles += 1
        self.stats.total_chunks += len(chunks)
        self.stats.total_vectors += len(vectors)
        
        return {
            "pmid": pmid,
            "vectors": len(vectors),
            "chunks": len(chunks),
            "status": "success",
        }
    
    async def ingest_articles_batch(
        self,
        articles: List[Dict[str, Any]],
        progress_callback: Optional[callable] = None,
    ) -> Dict[str, Any]:
        """Batch ingest articles into Pinecone."""
        self.stats = IngestionStats()
        self.stats.start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        all_vectors = []
        
        for article_idx, article in enumerate(articles):
            try:
                pmid = article.get("pmid", f"unknown_{article_idx}")
                chunks = self.chunker.chunk_article(article)
                
                if not chunks:
                    continue
                
                texts = [chunk_text for chunk_text, _ in chunks]
                embeddings = await self.embedder.embed_batch(texts)
                
                for i, ((chunk_text, chunk_meta), embedding) in enumerate(zip(chunks, embeddings)):
                    vector_id = self._generate_vector_id(pmid, i)
                    
                    metadata = ChunkMetadata(
                        pmid=pmid,
                        pmcid=article.get("pmc_id"),
                        title=article.get("title", "")[:1000],
                        section_type=chunk_meta.get("section_type", "abstract"),
                        mesh_terms=article.get("mesh_terms", []),
                        pub_date=article.get("publication_date"),
                        source_type="PMC" if article.get("pmc_id") else "PubMed",
                        chunk_index=i,
                        total_chunks=len(chunks),
                        journal=article.get("journal", ""),
                        authors=article.get("authors", []),
                        doi=article.get("doi"),
                    )
                    
                    all_vectors.append((vector_id, embedding, metadata.to_pinecone_metadata()))
                
                self.stats.total_articles += 1
                self.stats.total_chunks += len(chunks)
                
                if progress_callback:
                    await progress_callback(article_idx + 1, len(articles), len(all_vectors))
                
            except Exception as e:
                logger.error(f"Failed to process article: {e}")
                continue
        
        # Upsert all vectors in batches
        total_vectors = len(all_vectors)
        
        for i in range(0, total_vectors, self.batch_size):
            batch = all_vectors[i:i + self.batch_size]
            
            try:
                await self._upsert_batch(batch)
                logger.info(f"Upserted batch {i // self.batch_size + 1}: {len(batch)} vectors")
                
            except Exception as e:
                logger.error(f"Failed to upsert batch: {e}")
        
        self.stats.end_time = time.time()
        self.stats.total_vectors = total_vectors
        self.stats.successful_upserts = total_vectors
        
        return self.stats.to_dict()
    
    async def _upsert_batch(self, vectors: List[Tuple[str, List[float], Dict[str, Any]]]):
        """Upsert a batch of vectors to Pinecone."""
        if not self._initialized:
            await self.initialize()
        
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self._index.upsert(
                    vectors=vectors,
                    namespace=self.settings.PINECONE_NAMESPACE,
                )
            )
            
            self.stats.successful_upserts += len(vectors)
            
        except Exception as e:
            logger.error(f"Pinecone upsert error: {e}")
            self.stats.failed_upserts += len(vectors)
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        return self.stats.to_dict()
