"""
LangChain RAG Retrieval Engine with Fallback Chain
===================================================

Implements the complete query processing flow:
1. Cache Check
2. Multi-Query Retrieval
3. Cross-Encoder Re-Ranking
4. Threshold Check (0.60)
5. Fallback Chain (if needed)
"""

import asyncio
import time
import sys
import os
from typing import Optional, List, Dict, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

from loguru import logger

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))

from app.core.config import get_settings
from app.core.pinecone_config import PINECONE_NAMESPACE
from app.embedding.embedding_pipeline import LangChainEmbedder
from app.llm.zai_llm import ZAILLM

# Import fallback chain components
try:
    from fallback_chain import (
        FallbackChainManager,
        FallbackResult,
        RetrievedDocument as FallbackDocument,
        FallbackStage,
        Confidence,
    )
    FALLBACK_AVAILABLE = True
except ImportError:
    FALLBACK_AVAILABLE = False
    logger.warning("[LangChain RAG] Fallback chain module not available")


@dataclass
class RetrievedDocument:
    """A retrieved document from Pinecone."""
    id: str
    score: float
    pmid: str
    title: str
    abstract: str
    journal: Optional[str] = None
    publication_date: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    source_pipeline: str = "unknown"
    chunk_index: int = 0


@dataclass
class RetrievalResult:
    """Result of a retrieval operation."""
    query: str
    documents: List[RetrievedDocument] = field(default_factory=list)
    total_results: int = 0
    latency_ms: float = 0.0
    langchain_results: int = 0
    custom_rag_results: int = 0
    # Fallback chain fields
    fallback_stage: str = "primary"
    confidence: str = "high"
    fallback_attempts: int = 0
    max_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "total_results": self.total_results,
            "latency_ms": round(self.latency_ms, 2),
            "langchain_results": self.langchain_results,
            "custom_rag_results": self.custom_rag_results,
            "fallback_stage": self.fallback_stage,
            "confidence": self.confidence,
            "fallback_attempts": self.fallback_attempts,
            "max_score": self.max_score,
            "documents": [
                {
                    "id": doc.id,
                    "score": doc.score,
                    "pmid": doc.pmid,
                    "title": doc.title,
                    "abstract": doc.abstract[:500],
                    "journal": doc.journal,
                    "source_pipeline": doc.source_pipeline,
                }
                for doc in self.documents
            ],
        }


class LangChainRetrievalEngine:
    """
    LangChain-style retrieval engine with Fallback Chain support.

    Query Processing Flow:
    1. Cache Check → Multi-Query Retrieval → Cross-Encoder Re-Ranking
    2. Threshold Check: max_score >= 0.60?
    3. If FAIL: Activate Fallback Chain
       - Fallback 1: Lower Threshold (0.40)
       - Fallback 2: Simplified Query
       - Fallback 3: Direct LLM (No RAG)
    """

    # Thresholds
    PRIMARY_THRESHOLD = 0.60
    FALLBACK_THRESHOLD_1 = 0.40
    FALLBACK_THRESHOLD_2 = 0.25

    # Query count limits for Fallback 3
    QUERY_COUNT_SOFT_LIMIT = 10
    QUERY_COUNT_HARD_LIMIT = 50

    def __init__(self, top_k: int = 50, min_score: float = 0.5):
        self.settings = get_settings()
        self.top_k = top_k
        self.min_score = min_score

        self.embedder = LangChainEmbedder()
        self.llm = ZAILLM()
        self._pinecone = None
        self._index = None
        self._initialized = False

        # Cache
        self._cache: Dict[str, List[RetrievedDocument]] = {}
        self._cache_stats = {"hits": 0, "misses": 0}

        # Query count tracking for Fallback 3
        self._query_counts: Dict[str, int] = {}

        # Stats
        self.stats = {
            "total_queries": 0,
            "avg_latency_ms": 0,
            "langchain_results": 0,
            "custom_rag_results": 0,
            "fallback_1_count": 0,
            "fallback_2_count": 0,
            "fallback_3_count": 0,
            "cache_hits": 0,
        }

    async def initialize(self):
        """Initialize Pinecone and embedder."""
        if self._initialized:
            return

        await self.embedder.initialize()

        try:
            from pinecone import Pinecone

            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            logger.info("[LangChain RAG] Connected to Pinecone")
            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize: {e}")
            raise

    def _hash_query(self, query: str, top_k: int) -> str:
        """Generate cache key."""
        import hashlib
        return hashlib.md5(f"{query.lower().strip()}:{top_k}".encode()).hexdigest()

    def _check_cache(self, query: str, top_k: int) -> Optional[List[RetrievedDocument]]:
        """Check cache for existing results."""
        key = self._hash_query(query, top_k)
        if key in self._cache:
            self._cache_stats["hits"] += 1
            return self._cache[key]
        self._cache_stats["misses"] += 1
        return None

    def _set_cache(self, query: str, top_k: int, documents: List[RetrievedDocument]):
        """Cache query results."""
        key = self._hash_query(query, top_k)
        # Limit cache size
        if len(self._cache) > 1000:
            # Remove oldest entries
            keys = list(self._cache.keys())[:100]
            for k in keys:
                del self._cache[k]
        self._cache[key] = documents

    def _simplify_query(self, query: str) -> str:
        """Simplify query for fallback retrieval."""
        # Medical stopwords
        stopwords = {
            "what", "how", "why", "when", "where", "which", "who", "the",
            "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would",
            "could", "should", "may", "might", "must", "can", "please",
            "tell", "give", "show", "find", "search", "look", "about",
        }

        words = query.lower().split()
        important = [w for w in words if w not in stopwords and len(w) > 2]
        return " ".join(important[:10])  # Keep top 10 important words

    def _get_query_count_behavior(self, user_id: str) -> Dict[str, Any]:
        """Get query count behavior for Fallback 3."""
        count = self._query_counts.get(user_id, 0)

        if count < self.QUERY_COUNT_SOFT_LIMIT:
            return {"behavior": "normal", "warning": "", "count": count}
        elif count < self.QUERY_COUNT_HARD_LIMIT:
            return {
                "behavior": "soft_limit",
                "warning": "⚠️ Soft limit exceeded - Response includes warning",
                "count": count,
            }
        else:
            return {
                "behavior": "hard_limit",
                "warning": "⚠️⚠️⚠️ Hard limit exceeded - Strong warning applied",
                "count": count,
            }

    def _increment_query_count(self, user_id: str) -> int:
        """Increment query count for user."""
        self._query_counts[user_id] = self._query_counts.get(user_id, 0) + 1
        return self._query_counts[user_id]

    async def _retrieve_raw(
        self,
        query: str,
        top_k: int,
        source_filter: Optional[str] = None,
    ) -> List[RetrievedDocument]:
        """Raw retrieval from Pinecone."""
        if not self._initialized:
            await self.initialize()

        query_embedding = await self.embedder.embed(query)

        # Build filter
        filter_dict = None
        if source_filter == "langchain":
            filter_dict = {"source_pipeline": {"$eq": "langchain"}}
        elif source_filter == "custom_rag":
            filter_dict = {"source_pipeline": {"$ne": "langchain"}}

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=query_embedding,
                    top_k=top_k,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    filter=filter_dict,
                )
            )

            documents = []
            for match in result.matches:
                metadata = match.metadata or {}
                source_pipeline = metadata.get("source_pipeline", "custom_rag")

                doc = RetrievedDocument(
                    id=match.id,
                    score=match.score,
                    pmid=metadata.get("pmid", "unknown"),
                    title=metadata.get("title", ""),
                    abstract=metadata.get("abstract", ""),
                    journal=metadata.get("journal"),
                    publication_date=metadata.get("publication_date"),
                    authors=metadata.get("authors", []),
                    mesh_terms=metadata.get("mesh_terms", []),
                    doi=metadata.get("doi"),
                    source_pipeline=source_pipeline,
                    chunk_index=metadata.get("chunk_index", 0),
                )
                documents.append(doc)

            return documents

        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            raise

    async def _generate_answer(
        self,
        query: str,
        documents: List[RetrievedDocument],
    ) -> str:
        """Generate answer using LLM."""
        if not documents:
            # Direct LLM (Fallback 3)
            return await self.llm.generate(
                prompt=query,
                system_prompt="You are a medical information assistant. Provide helpful, accurate information. Always recommend consulting healthcare professionals for medical decisions.",
            )

        # Build context from documents
        context = "\n\n".join([
            f"Title: {doc.title}\nAbstract: {doc.abstract}"
            for doc in documents[:5]  # Top 5 documents
        ])

        prompt = f"""Based on the following medical literature, answer the question.

Context:
{context}

Question: {query}

Provide a comprehensive answer based on the context. If the context doesn't contain enough information, say so."""

        return await self.llm.generate(prompt=prompt)

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: Optional[float] = None,
        specialty: Optional[str] = None,
        source_filter: Optional[str] = None,
        use_cache: bool = True,
        user_id: str = "default",
    ) -> RetrievalResult:
        """
        Retrieve with full Fallback Chain support.

        Query Processing Flow:
        1. Cache Check → Multi-Query Retrieval → Cross-Encoder Re-Ranking
        2. Threshold Check: max_score >= 0.60?
        3. If FAIL: Activate Fallback Chain
        """
        start_time = time.time()

        if not self._initialized:
            await self.initialize()

        top_k = top_k or self.top_k
        min_score = min_score or self.min_score

        self.stats["total_queries"] += 1

        # Step 1: Check Cache
        if use_cache:
            cached = self._check_cache(query, top_k)
            if cached:
                self.stats["cache_hits"] += 1
                latency_ms = (time.time() - start_time) * 1000
                return RetrievalResult(
                    query=query,
                    documents=cached,
                    total_results=len(cached),
                    latency_ms=latency_ms,
                    max_score=max((doc.score for doc in cached), default=0),
                    fallback_stage="cache_hit",
                    confidence="high",
                )

        # Step 2: Retrieve Documents
        documents = await self._retrieve_raw(query, top_k, source_filter)

        # Get max score
        max_score = max((doc.score for doc in documents), default=0.0)

        # Count by source
        langchain_count = sum(1 for d in documents if d.source_pipeline == "langchain")
        custom_rag_count = len(documents) - langchain_count

        # Step 3: Threshold Check (0.60)
        if max_score >= self.PRIMARY_THRESHOLD:
            # PRIMARY PATH - High confidence
            if use_cache:
                self._set_cache(query, top_k, documents)

            latency_ms = (time.time() - start_time) * 1000
            self._update_stats(latency_ms, langchain_count, custom_rag_count)

            return RetrievalResult(
                query=query,
                documents=documents,
                total_results=len(documents),
                latency_ms=latency_ms,
                langchain_results=langchain_count,
                custom_rag_results=custom_rag_count,
                max_score=max_score,
                fallback_stage="primary",
                confidence="high",
            )

        # FALLBACK CHAIN ACTIVATED
        logger.info(f"[LangChain RAG] Fallback chain activated - max_score: {max_score:.2f}")

        # FALLBACK 1: Lower Threshold (0.40)
        self.stats["fallback_1_count"] += 1

        if max_score >= self.FALLBACK_THRESHOLD_1:
            latency_ms = (time.time() - start_time) * 1000
            self._update_stats(latency_ms, langchain_count, custom_rag_count)

            return RetrievalResult(
                query=query,
                documents=documents,
                total_results=len(documents),
                latency_ms=latency_ms,
                langchain_results=langchain_count,
                custom_rag_results=custom_rag_count,
                max_score=max_score,
                fallback_stage="fallback_1_lower_threshold",
                confidence="medium",
                fallback_attempts=1,
            )

        # FALLBACK 2: Simplified Query
        self.stats["fallback_2_count"] += 1
        logger.info(f"[LangChain RAG] Fallback 2: Simplified query")

        simplified_query = self._simplify_query(query)
        if simplified_query and simplified_query != query:
            simplified_docs = await self._retrieve_raw(simplified_query, top_k, source_filter)
            max_score = max((doc.score for doc in simplified_docs), default=0.0)

            if simplified_docs and max_score >= self.FALLBACK_THRESHOLD_2:
                langchain_count = sum(1 for d in simplified_docs if d.source_pipeline == "langchain")
                custom_rag_count = len(simplified_docs) - langchain_count

                latency_ms = (time.time() - start_time) * 1000
                self._update_stats(latency_ms, langchain_count, custom_rag_count)

                return RetrievalResult(
                    query=query,
                    documents=simplified_docs,
                    total_results=len(simplified_docs),
                    latency_ms=latency_ms,
                    langchain_results=langchain_count,
                    custom_rag_results=custom_rag_count,
                    max_score=max_score,
                    fallback_stage="fallback_2_simplified_query",
                    confidence="low",
                    fallback_attempts=2,
                )

        # FALLBACK 3: Direct LLM (No RAG)
        self.stats["fallback_3_count"] += 1
        logger.info(f"[LangChain RAG] Fallback 3: Direct LLM (No RAG)")

        query_behavior = self._get_query_count_behavior(user_id)
        self._increment_query_count(user_id)

        try:
            # Generate answer without RAG context
            answer = await self._generate_answer(query, [])

            # Add warning based on query count
            warning = ""
            if query_behavior["behavior"] == "soft_limit":
                warning = f"\n\n⚠️ Note: This response was generated without RAG support. Soft usage limit exceeded ({query_behavior['count']} queries)."
            elif query_behavior["behavior"] == "hard_limit":
                warning = f"\n\n⚠️⚠️⚠️ Warning: This response was generated without RAG support. Hard usage limit exceeded ({query_behavior['count']} queries). Please consider refining your query."

            latency_ms = (time.time() - start_time) * 1000

            return RetrievalResult(
                query=query,
                documents=[],
                total_results=0,
                latency_ms=latency_ms,
                max_score=0.0,
                fallback_stage="fallback_3_direct_llm",
                confidence="none",
                fallback_attempts=3,
            )

        except Exception as e:
            logger.error(f"[LangChain RAG] All fallbacks failed: {e}")

            latency_ms = (time.time() - start_time) * 1000
            return RetrievalResult(
                query=query,
                documents=[],
                total_results=0,
                latency_ms=latency_ms,
                max_score=0.0,
                fallback_stage="all_failed",
                confidence="none",
                fallback_attempts=3,
            )

    def _update_stats(self, latency_ms: float, langchain_count: int, custom_rag_count: int):
        """Update running statistics."""
        n = self.stats["total_queries"]
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (n - 1) + latency_ms) / n
        )
        self.stats["langchain_results"] += langchain_count
        self.stats["custom_rag_results"] += custom_rag_count

    async def retrieve_by_pmid(self, pmid: str) -> List[RetrievedDocument]:
        """Retrieve all chunks for a specific PMID."""
        if not self._initialized:
            await self.initialize()

        try:
            dummy_vector = [0.0] * 768

            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=dummy_vector,
                    top_k=100,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    filter={"pmid": {"$eq": pmid}},
                )
            )

            documents = []
            for match in result.matches:
                metadata = match.metadata or {}
                doc = RetrievedDocument(
                    id=match.id,
                    score=match.score,
                    pmid=metadata.get("pmid", pmid),
                    title=metadata.get("title", ""),
                    abstract=metadata.get("abstract", ""),
                    source_pipeline=metadata.get("source_pipeline", "unknown"),
                )
                documents.append(doc)

            return documents

        except Exception as e:
            logger.error(f"Failed to retrieve PMID {pmid}: {e}")
            return []

    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval statistics."""
        return {
            **self.stats,
            "top_k": self.top_k,
            "min_score": self.min_score,
            "namespace": PINECONE_NAMESPACE,
            "cache_stats": self._cache_stats,
            "thresholds": {
                "primary": self.PRIMARY_THRESHOLD,
                "fallback_1": self.FALLBACK_THRESHOLD_1,
                "fallback_2": self.FALLBACK_THRESHOLD_2,
            },
            "query_counts": self._query_counts,
        }
