"""
LangChain Embedding Pipeline - READ/WRITE Support
==================================================

Key Features:
- Vector ID prefixing with 'lc_' to avoid conflicts
- source_pipeline: 'langchain' metadata tagging
- Same embedding model as Custom RAG (all-mpnet-base-v2, 768-dim)
- Compatible with shared Pinecone namespace
"""

import asyncio
import time
import hashlib
import json
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from loguru import logger

from app.core.config import get_settings
from app.core.pinecone_config import (
    PINECONE_INDEX_NAME,
    PINECONE_DIMENSION,
    PINECONE_NAMESPACE,
    PINECONE_VECTOR_ID_PREFIX,
    VectorMetadata,
    generate_vector_id,
)


# ===== Chunking Constants =====
MIN_CHUNK_TOKENS = 200
MAX_CHUNK_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 100

# ===== Embedding Constants =====
EMBEDDING_MODEL = "all-mpnet-base-v2"  # MUST match Custom RAG
EMBEDDING_DIMENSION = 768  # MUST match Custom RAG

# ===== Pinecone Constants =====
PINECONE_BATCH_SIZE = 100


@dataclass
class ChunkMetadata:
    """Metadata for an embedded chunk with source tracking."""
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
    source_pipeline: str = "langchain"  # CRITICAL: Track source

    def to_pinecone_metadata(self) -> Dict[str, Any]:
        """Convert to Pinecone metadata with source tracking."""
        mesh = self.mesh_terms or []
        auth = self.authors or []
        return {
            "pmid": self.pmid,
            "pmcid": self.pmcid or "",
            "title": (self.title or "")[:1000],
            "section_type": self.section_type,
            "mesh_terms": json.dumps(mesh[:20]) if mesh else "[]",
            "pub_date": self.pub_date or "",
            "source_type": self.source_type,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "journal": (self.journal or "")[:200],
            "authors": json.dumps(auth[:10]) if auth else "[]",
            "doi": self.doi or "",
            "source_pipeline": self.source_pipeline,
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
    source_pipeline: str = "langchain"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_articles": self.total_articles,
            "total_chunks": self.total_chunks,
            "total_vectors": self.total_vectors,
            "successful_upserts": self.successful_upserts,
            "failed_upserts": self.failed_upserts,
            "duration_seconds": round(self.duration_seconds, 2),
            "source_pipeline": self.source_pipeline,
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
                "source_pipeline": "langchain",
                **{k: v for k, v in article.items() if k not in ["abstract", "text_content"]},
            }
            chunks.append((chunk_text, chunk_meta))

        return chunks


class LangChainEmbedder:
    """
    LangChain-compatible embedding service using sentence-transformers.
    
    Uses all-mpnet-base-v2 (768-dim) to match Custom RAG embeddings.
    """

    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = [2, 4, 8]

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
            "model": model_name,
            "dimension": EMBEDDING_DIMENSION,
        }

    async def initialize(self):
        """Initialize embedding model."""
        if self._initialized:
            return

        errors = []

        for attempt in range(self.MAX_RETRIES):
            try:
                from sentence_transformers import SentenceTransformer

                logger.info(f"[LangChain] Loading embedding model: {self.model_name} (attempt {attempt + 1}/{self.MAX_RETRIES})")
                self._model = SentenceTransformer(self.model_name, device=self.device)
                logger.info(f"[LangChain] Embedding model loaded successfully (dimension: {self.dimension})")
                self._initialized = True
                return

            except ImportError as e:
                error_msg = f"CRITICAL: sentence-transformers not installed: {e}"
                errors.append(error_msg)
                logger.error(error_msg)
                raise self.EmbeddingError(error_msg)

            except Exception as e:
                error_msg = f"Attempt {attempt + 1} failed: {type(e).__name__}: {e}"
                errors.append(error_msg)
                logger.warning(error_msg)

                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAY_SECONDS[attempt]
                    logger.info(f"Retrying in {delay} seconds...")
                    self.stats["retries"] += 1
                    await asyncio.sleep(delay)

        self._initialized = True
        raise self.EmbeddingError(f"Failed to initialize embedding model after {self.MAX_RETRIES} attempts: {errors}")

    async def embed(self, text: str, use_cache: bool = True) -> List[float]:
        """Generate embedding for text."""
        await self.initialize()

        if self._model is None:
            raise self.EmbeddingError("Embedding model not loaded")

        text_hash = hashlib.md5(text.encode()).hexdigest()

        if use_cache and text_hash in self._cache:
            return self._cache[text_hash]

        start_time = time.time()

        try:
            embedding = self._model.encode(text, convert_to_numpy=True)
            embedding = embedding.tolist()

            if len(embedding) != self.dimension:
                raise self.EmbeddingError(
                    f"Invalid embedding: expected {self.dimension} dimensions, got {len(embedding)}"
                )

        except self.EmbeddingError:
            raise
        except Exception as e:
            self.stats["errors"] += 1
            raise self.EmbeddingError(f"Embedding generation failed: {e}")

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
        """Generate embeddings for multiple texts."""
        await self.initialize()

        if self._model is None:
            raise self.EmbeddingError("Embedding model not loaded")

        try:
            embeddings = self._model.encode(texts, convert_to_numpy=True)
            embeddings_list = embeddings.tolist()

            for i, embedding in enumerate(embeddings_list):
                if len(embedding) != self.dimension:
                    raise self.EmbeddingError(
                        f"Invalid embedding at index {i}: expected {self.dimension} dimensions"
                    )

            return embeddings_list

        except self.EmbeddingError:
            raise
        except Exception as e:
            self.stats["errors"] += 1
            raise self.EmbeddingError(f"Batch embedding failed: {e}")

    def get_stats(self) -> Dict[str, Any]:
        return {
            **self.stats,
            "cache_size": len(self._cache),
            "model_loaded": self._model is not None,
        }


class LangChainIngestionPipeline:
    """
    LangChain ingestion pipeline with READ/WRITE support.
    """

    def __init__(self, batch_size: int = PINECONE_BATCH_SIZE):
        self.settings = get_settings()
        self.embedder = LangChainEmbedder()
        self.chunker = TextChunker()
        self.batch_size = batch_size
        self.vector_id_prefix = PINECONE_VECTOR_ID_PREFIX

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
            logger.info(f"[LangChain] Connected to Pinecone index: {self.settings.PINECONE_INDEX_NAME}")

        except Exception as e:
            logger.error(f"Failed to connect to Pinecone: {e}")
            raise

        self._initialized = True

    def _generate_vector_id(self, pmid: str, chunk_index: int) -> str:
        return generate_vector_id(pmid, chunk_index, self.vector_id_prefix)

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
                source_pipeline="langchain",
            )

            vectors.append((vector_id, embedding, metadata.to_pinecone_metadata()))

        await self._upsert_batch(vectors)

        self.stats.total_articles += 1
        self.stats.total_chunks += len(chunks)
        self.stats.total_vectors += len(vectors)

        return {
            "pmid": pmid,
            "vectors": len(vectors),
            "chunks": len(chunks),
            "status": "success",
            "source_pipeline": "langchain",
            "vector_id_prefix": self.vector_id_prefix,
        }

    async def ingest_articles_batch(
        self,
        articles: List[Dict[str, Any]],
        progress_callback: Optional[callable] = None,
    ) -> Dict[str, Any]:
        """Batch ingest articles into Pinecone."""
        self.stats = IngestionStats()
        start_time = time.time()

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
                        source_pipeline="langchain",
                    )

                    all_vectors.append((vector_id, embedding, metadata.to_pinecone_metadata()))

                self.stats.total_articles += 1
                self.stats.total_chunks += len(chunks)

                if progress_callback:
                    await progress_callback(article_idx + 1, len(articles), len(all_vectors))

            except Exception as e:
                logger.error(f"Failed to process article: {e}")
                continue

        total_vectors = len(all_vectors)

        for i in range(0, total_vectors, self.batch_size):
            batch = all_vectors[i:i + self.batch_size]
            try:
                await self._upsert_batch(batch)
                logger.info(f"[LangChain] Upserted batch {i // self.batch_size + 1}: {len(batch)} vectors")
            except Exception as e:
                logger.error(f"Failed to upsert batch: {e}")

        self.stats.duration_seconds = time.time() - start_time
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

    async def delete_vectors_by_pmid(self, pmid: str) -> Dict[str, Any]:
        """Delete all vectors for a given PMID using metadata filter."""
        if not self._initialized:
            await self.initialize()

        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self._index.delete(
                    filter={
                        "pmid": {"$eq": pmid},
                        "source_pipeline": {"$eq": "langchain"}
                    },
                    namespace=self.settings.PINECONE_NAMESPACE,
                )
            )

            return {
                "status": "success",
                "pmid": pmid,
                "source_pipeline": "langchain",
                "message": f"Deleted LangChain vectors for PMID: {pmid}",
            }

        except Exception as e:
            logger.error(f"Failed to delete vectors: {e}")
            return {
                "status": "error",
                "pmid": pmid,
                "error": str(e),
            }

    def get_stats(self) -> Dict[str, Any]:
        return self.stats.to_dict()
