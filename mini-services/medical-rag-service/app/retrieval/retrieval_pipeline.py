"""
P9: Hybrid Retrieval Pipeline with RRF
======================================

Implements hybrid retrieval combining:
1. Dense vector search (Together AI embeddings)
2. Sparse BM25 search (rank-bm25)
3. Reciprocal Rank Fusion (RRF) for result combination
4. MeSH synonym expansion
5. Citation passthrough with PMID validation

Architecture:
- Dense leg: Pinecone vector search per namespace
- Sparse leg: Per-namespace BM25 index
- RRF merge: 1/(k + rank_dense) + 1/(k + rank_bm25)
- Citation validation: Check PMIDs in context

Evidence Sources:
- RRF Paper: Cormack, G.V., et al. (2009). "Reciprocal Rank Fusion"
- BM25: Robertson, S., et al. (2009). "The Probabilistic Relevance Framework"
"""

import asyncio
import pickle
import os
import time
import re
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from loguru import logger

from app.core.config import get_settings
from app.ingestion.namespace_router import MESH_SYNONYMS


# =============================================================================
# CONSTANTS
# =============================================================================

# RRF constant (standard value from literature)
RRF_K = 60

# BM25 parameters
BM25_K1 = 1.5
BM25_B = 0.75

# Retrieval limits
DEFAULT_TOP_K = 10
DENSE_SEARCH_MULTIPLIER = 2  # Get 2x for RRF merging
BM25_SEARCH_MULTIPLIER = 2


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class RetrievedChunk:
    """A retrieved chunk with scoring metadata."""
    doc_id: str
    pmid: str
    title: str
    chunk_text: str
    abstract: str
    journal: str
    publication_year: Optional[int]
    mesh_terms: List[str]
    namespace: str
    
    # Scores
    dense_score: float = 0.0
    bm25_score: float = 0.0
    rrf_score: float = 0.0
    
    # Ranks
    dense_rank: int = 0
    bm25_rank: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "pmid": self.pmid,
            "title": self.title,
            "chunk_text": self.chunk_text[:300],
            "journal": self.journal,
            "publication_year": self.publication_year,
            "mesh_terms": self.mesh_terms[:5],
            "namespace": self.namespace,
            "scores": {
                "dense": round(self.dense_score, 4),
                "bm25": round(self.bm25_score, 4),
                "rrf": round(self.rrf_score, 4),
            },
            "ranks": {
                "dense": self.dense_rank,
                "bm25": self.bm25_rank,
            }
        }
    
    def format_citation(self) -> str:
        """Format as citation for LLM context."""
        year = f" ({self.publication_year}" if self.publication_year else ""
        journal = f", {self.journal}" if self.journal else ""
        return f"[PMID {self.pmid}] {self.title}{year}{journal}\n{self.chunk_text}"


@dataclass
class RetrievalResult:
    """Complete retrieval result."""
    query: str
    expanded_query: str
    namespaces_queried: List[str]
    chunks: List[RetrievedChunk]
    pmids_in_context: Set[str]
    
    # Latency breakdown
    dense_latency_ms: float = 0.0
    bm25_latency_ms: float = 0.0
    rrf_latency_ms: float = 0.0
    total_latency_ms: float = 0.0
    
    # Metadata
    dense_results_count: int = 0
    bm25_results_count: int = 0
    fallback: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "expanded_query": self.expanded_query,
            "namespaces_queried": self.namespaces_queried,
            "total_results": len(self.chunks),
            "pmids_in_context": list(self.pmids_in_context),
            "chunks": [c.to_dict() for c in self.chunks],
            "latency_ms": {
                "dense": round(self.dense_latency_ms, 2),
                "bm25": round(self.bm25_latency_ms, 2),
                "rrf": round(self.rrf_latency_ms, 2),
                "total": round(self.total_latency_ms, 2),
            },
            "metadata": {
                "dense_results_count": self.dense_results_count,
                "bm25_results_count": self.bm25_results_count,
                "fallback": self.fallback,
            }
        }
    
    def format_context_for_llm(self, max_chunks: int = 10) -> str:
        """Format chunks for LLM context."""
        context_parts = [
            "# Retrieved Evidence\n",
            "When citing evidence, reference PMIDs exactly as provided in context.",
            "Do not invent PMIDs.\n",
        ]
        
        for i, chunk in enumerate(self.chunks[:max_chunks], 1):
            context_parts.append(f"## Source {i}")
            context_parts.append(chunk.format_citation())
            context_parts.append("")
        
        return "\n".join(context_parts)


# =============================================================================
# BM25 INDEX
# =============================================================================

class SimpleBM25:
    """
    Simple BM25 implementation for sparse retrieval.
    
    Uses rank-bm25 style scoring with document frequency normalization.
    """
    
    def __init__(self, k1: float = BM25_K1, b: float = BM25_B):
        self.k1 = k1
        self.b = b
        
        self.documents: Dict[str, Dict[str, Any]] = {}  # doc_id -> {tokens, text, metadata}
        self.doc_freqs: Dict[str, int] = defaultdict(int)
        self.avg_doc_length: float = 0.0
        self.total_docs: int = 0
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization."""
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        return [t for t in text.split() if len(t) > 1]
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Add a document to the index."""
        tokens = self._tokenize(text)
        
        # Update document frequencies
        seen_tokens = set()
        for token in tokens:
            if token not in seen_tokens:
                self.doc_freqs[token] += 1
                seen_tokens.add(token)
        
        # Update average document length
        old_avg = self.avg_doc_length
        self.total_docs += 1
        self.avg_doc_length = (
            old_avg * (self.total_docs - 1) + len(tokens)
        ) / self.total_docs
        
        # Store document
        self.documents[doc_id] = {
            "tokens": tokens,
            "text": text,
            "metadata": metadata or {},
            "length": len(tokens),
        }
    
    def search(self, query: str, top_k: int = 20) -> List[Tuple[str, float]]:
        """
        Search the BM25 index.
        
        Returns:
            List of (doc_id, score) tuples
        """
        if not self.documents:
            return []
        
        query_tokens = self._tokenize(query)
        
        # Score documents
        scores: Dict[str, float] = defaultdict(float)
        
        for token in query_tokens:
            if token not in self.doc_freqs:
                continue
            
            # IDF calculation
            df = self.doc_freqs[token]
            idf = (
                (self.total_docs - df + 0.5) / (df + 0.5) + 1
            )
            
            # Score each document
            for doc_id, doc_data in self.documents.items():
                tf = doc_data["tokens"].count(token)
                if tf == 0:
                    continue
                
                # BM25 scoring
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (
                    1 - self.b + self.b * doc_data["length"] / self.avg_doc_length
                )
                scores[doc_id] += idf * numerator / denominator
        
        # Sort and return top-k
        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_results[:top_k]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        return {
            "total_documents": self.total_docs,
            "vocabulary_size": len(self.doc_freqs),
            "avg_doc_length": round(self.avg_doc_length, 2),
        }


# =============================================================================
# HYBRID RETRIEVAL PIPELINE
# =============================================================================

class HybridRetrievalPipeline:
    """
    P9: Hybrid retrieval pipeline with RRF fusion.
    
    Features:
    - Dense vector search via Pinecone
    - Sparse BM25 search via local index
    - RRF result combination
    - MeSH synonym expansion
    - Citation validation
    """
    
    def __init__(self, bm25_path: Optional[str] = None):
        self.settings = get_settings()
        
        # BM25 indexes per namespace
        self.bm25_indexes: Dict[str, SimpleBM25] = {}
        self.bm25_path = Path(bm25_path or os.path.join(
            os.path.dirname(__file__),
            "..", "data", "bm25_indexes"
        ))
        self.bm25_path.mkdir(parents=True, exist_ok=True)
        
        # Pinecone client (lazy init)
        self._pinecone = None
        self._index = None
        
        # Embedding client (lazy init)
        self._embedding_client = None
        
        # Namespace router
        self._router = None
        
        # Statistics
        self.stats = {
            "total_queries": 0,
            "dense_queries": 0,
            "bm25_queries": 0,
            "avg_latency_ms": 0.0,
            "citation_warnings": 0,
        }
    
    async def _get_pinecone_index(self):
        """Get or create Pinecone index client."""
        if self._index is None:
            from pinecone import Pinecone
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
        return self._index
    
    async def _get_embedding_client(self):
        """Get or create embedding client."""
        if self._embedding_client is None:
            from app.ingestion.embedding_client import get_embedding_client
            self._embedding_client = await get_embedding_client()
        return self._embedding_client
    
    def _get_router(self):
        """Get or create namespace router."""
        if self._router is None:
            from app.ingestion.namespace_router import get_namespace_router
            self._router = get_namespace_router()
        return self._router
    
    def _load_bm25_index(self, namespace: str) -> SimpleBM25:
        """Load BM25 index for a namespace."""
        if namespace in self.bm25_indexes:
            return self.bm25_indexes[namespace]
        
        pickle_path = self.bm25_path / f"{namespace}_bm25.pkl"
        
        if pickle_path.exists():
            try:
                with open(pickle_path, "rb") as f:
                    self.bm25_indexes[namespace] = pickle.load(f)
                logger.info(f"[RetrievalPipeline] Loaded BM25 index for {namespace}")
            except Exception as e:
                logger.warning(f"[RetrievalPipeline] Failed to load BM25: {e}")
                self.bm25_indexes[namespace] = SimpleBM25()
        else:
            self.bm25_indexes[namespace] = SimpleBM25()
        
        return self.bm25_indexes[namespace]
    
    def _expand_query_with_mesh(self, query: str) -> str:
        """Expand query with MeSH synonyms."""
        query_lower = query.lower()
        expansions = []
        
        for acronym, expansion in MESH_SYNONYMS.items():
            if acronym in query_lower.split():
                expansions.append(expansion)
        
        if expansions:
            return f"{query} {' '.join(expansions)}"
        return query
    
    async def _dense_search(
        self,
        query_embedding: List[float],
        namespaces: List[str],
        top_k: int
    ) -> List[Tuple[str, float, Dict[str, Any], str]]:
        """
        Perform dense vector search across namespaces.
        
        Returns:
            List of (doc_id, score, metadata, namespace) tuples
        """
        index = await self._get_pinecone_index()
        
        all_results = []
        seen_pmids = set()
        
        for namespace in namespaces:
            try:
                result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda ns=namespace: index.query(
                        vector=query_embedding,
                        top_k=top_k,
                        namespace=ns,
                        include_metadata=True,
                    )
                )
                
                for match in result.matches:
                    metadata = match.metadata or {}
                    pmid = metadata.get("pmid", "")
                    
                    # Deduplicate by PMID, keep highest score
                    if pmid and pmid in seen_pmids:
                        continue
                    if pmid:
                        seen_pmids.add(pmid)
                    
                    all_results.append((
                        match.id,
                        match.score,
                        metadata,
                        namespace
                    ))
                    
            except Exception as e:
                logger.error(f"[RetrievalPipeline] Dense search failed for {namespace}: {e}")
        
        # Sort by score
        all_results.sort(key=lambda x: x[1], reverse=True)
        return all_results[:top_k]
    
    def _bm25_search(
        self,
        query: str,
        namespaces: List[str],
        top_k: int
    ) -> List[Tuple[str, float, Dict[str, Any], str]]:
        """
        Perform BM25 search across namespaces.
        
        Returns:
            List of (doc_id, score, metadata, namespace) tuples
        """
        all_results = []
        
        for namespace in namespaces:
            bm25 = self._load_bm25_index(namespace)
            
            if bm25.total_docs == 0:
                continue
            
            results = bm25.search(query, top_k=top_k)
            
            for doc_id, score in results:
                doc_data = bm25.documents.get(doc_id, {})
                metadata = doc_data.get("metadata", {})
                all_results.append((doc_id, score, metadata, namespace))
        
        # Sort by score
        all_results.sort(key=lambda x: x[1], reverse=True)
        return all_results[:top_k]
    
    def _reciprocal_rank_fusion(
        self,
        dense_results: List[Tuple[str, float, Dict[str, Any], str]],
        bm25_results: List[Tuple[str, float, Dict[str, Any], str]],
        top_k: int
    ) -> List[RetrievedChunk]:
        """
        Combine results using Reciprocal Rank Fusion.
        
        RRF Score = 1/(k + rank_dense) + 1/(k + rank_bm25)
        """
        # Build rank maps
        dense_ranks = {r[0]: i + 1 for i, r in enumerate(dense_results)}
        bm25_ranks = {r[0]: i + 1 for i, r in enumerate(bm25_results)}
        
        # Get all doc IDs
        all_doc_ids = set(dense_ranks.keys()) | set(bm25_ranks.keys())
        
        # Build metadata map
        metadata_map = {}
        for doc_id, score, metadata, namespace in dense_results + bm25_results:
            if doc_id not in metadata_map:
                metadata_map[doc_id] = (metadata, namespace)
        
        # Calculate RRF scores
        rrf_scores: Dict[str, float] = {}
        for doc_id in all_doc_ids:
            dense_rank = dense_ranks.get(doc_id, len(dense_results) + 1)
            bm25_rank = bm25_ranks.get(doc_id, len(bm25_results) + 1)
            
            rrf_score = 1 / (RRF_K + dense_rank) + 1 / (RRF_K + bm25_rank)
            rrf_scores[doc_id] = rrf_score
        
        # Sort by RRF score
        sorted_doc_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        # Build RetrievedChunk objects
        chunks = []
        for doc_id in sorted_doc_ids[:top_k]:
            metadata, namespace = metadata_map.get(doc_id, ({}, ""))
            
            dense_rank = dense_ranks.get(doc_id, 0)
            bm25_rank = bm25_ranks.get(doc_id, 0)
            
            chunk = RetrievedChunk(
                doc_id=doc_id,
                pmid=metadata.get("pmid", ""),
                title=metadata.get("title", ""),
                chunk_text=metadata.get("abstract", "")[:500],  # Use abstract as chunk
                abstract=metadata.get("abstract", ""),
                journal=metadata.get("journal", ""),
                publication_year=metadata.get("publication_year"),
                mesh_terms=metadata.get("mesh_terms", "").split(",") if metadata.get("mesh_terms") else [],
                namespace=namespace,
                dense_score=next((r[1] for r in dense_results if r[0] == doc_id), 0.0),
                bm25_score=next((r[1] for r in bm25_results if r[0] == doc_id), 0.0),
                rrf_score=rrf_scores[doc_id],
                dense_rank=dense_rank,
                bm25_rank=bm25_rank,
            )
            chunks.append(chunk)
        
        return chunks
    
    def validate_citations(
        self,
        cited_pmids: List[str],
        context_pmids: Set[str]
    ) -> Tuple[List[str], List[str]]:
        """
        Validate cited PMIDs against context.
        
        Returns:
            Tuple of (valid_pmids, hallucinated_pmids)
        """
        valid = []
        hallucinated = []
        
        for pmid in cited_pmids:
            if pmid in context_pmids:
                valid.append(pmid)
            else:
                hallucinated.append(pmid)
        
        if hallucinated:
            self.stats["citation_warnings"] += 1
            logger.warning(f"[RetrievalPipeline] Hallucinated PMIDs detected: {hallucinated}")
        
        return valid, hallucinated
    
    async def retrieve(
        self,
        query: str,
        chief_complaint: Optional[str] = None,
        top_k: int = DEFAULT_TOP_K,
        namespaces: Optional[List[str]] = None,
    ) -> RetrievalResult:
        """
        Perform hybrid retrieval with RRF fusion.
        
        Args:
            query: Medical query text
            chief_complaint: Optional chief complaint for namespace routing
            top_k: Number of results to return
            namespaces: Optional list of namespaces to query
        
        Returns:
            RetrievalResult with ranked chunks
        """
        start_time = time.time()
        self.stats["total_queries"] += 1
        
        # Get namespace router
        router = self._get_router()
        
        # Route to namespaces
        if namespaces is None:
            routing = router.route(query, chief_complaint)
            namespaces = routing.routed_namespaces
            expanded_query = routing.expanded_query
            fallback = routing.fallback
        else:
            expanded_query = self._expand_query_with_mesh(query)
            fallback = False
        
        # Get query embedding
        embedding_client = await self._get_embedding_client()
        embedding_result = await embedding_client.embed(expanded_query)
        query_embedding = embedding_result.embedding
        
        # Dense search
        dense_start = time.time()
        dense_results = await self._dense_search(
            query_embedding,
            namespaces,
            top_k * DENSE_SEARCH_MULTIPLIER
        )
        dense_latency = (time.time() - dense_start) * 1000
        self.stats["dense_queries"] += 1
        
        # BM25 search
        bm25_start = time.time()
        bm25_results = self._bm25_search(
            expanded_query,
            namespaces,
            top_k * BM25_SEARCH_MULTIPLIER
        )
        bm25_latency = (time.time() - bm25_start) * 1000
        self.stats["bm25_queries"] += 1
        
        # RRF fusion
        rrf_start = time.time()
        chunks = self._reciprocal_rank_fusion(dense_results, bm25_results, top_k)
        rrf_latency = (time.time() - rrf_start) * 1000
        
        # Collect PMIDs in context
        pmids_in_context = {c.pmid for c in chunks if c.pmid}
        
        total_latency = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (self.stats["total_queries"] - 1) + total_latency)
            / self.stats["total_queries"]
        )
        
        return RetrievalResult(
            query=query,
            expanded_query=expanded_query,
            namespaces_queried=namespaces,
            chunks=chunks,
            pmids_in_context=pmids_in_context,
            dense_latency_ms=dense_latency,
            bm25_latency_ms=bm25_latency,
            rrf_latency_ms=rrf_latency,
            total_latency_ms=total_latency,
            dense_results_count=len(dense_results),
            bm25_results_count=len(bm25_results),
            fallback=fallback,
        )
    
    async def sync_bm25_from_pinecone(
        self,
        namespace: str,
        max_docs: int = 1000
    ) -> Dict[str, Any]:
        """
        Sync BM25 index from Pinecone vectors.
        
        Args:
            namespace: Namespace to sync
            max_docs: Maximum documents to sync
        
        Returns:
            Sync statistics
        """
        index = await self._get_pinecone_index()
        bm25 = SimpleBM25()
        
        try:
            # Use dummy vector to fetch documents
            dummy_vector = [0.0] * 768
            
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: index.query(
                    vector=dummy_vector,
                    top_k=max_docs,
                    namespace=namespace,
                    include_metadata=True,
                )
            )
            
            synced = 0
            for match in result.matches:
                metadata = match.metadata or {}
                
                # Build text for BM25
                title = metadata.get("title", "")
                abstract = metadata.get("abstract", "")
                text = f"{title} {abstract}"
                
                if text.strip():
                    bm25.add_document(
                        doc_id=match.id,
                        text=text,
                        metadata=metadata
                    )
                    synced += 1
            
            # Save index
            pickle_path = self.bm25_path / f"{namespace}_bm25.pkl"
            with open(pickle_path, "wb") as f:
                pickle.dump(bm25, f)
            
            self.bm25_indexes[namespace] = bm25
            
            logger.info(f"[RetrievalPipeline] Synced {synced} docs to BM25 for {namespace}")
            
            return {
                "status": "success",
                "namespace": namespace,
                "documents_synced": synced,
                "bm25_stats": bm25.get_stats(),
            }
            
        except Exception as e:
            logger.error(f"[RetrievalPipeline] BM25 sync failed: {e}")
            return {
                "status": "error",
                "namespace": namespace,
                "error": str(e),
            }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics."""
        return {
            **self.stats,
            "bm25_indexes": {
                ns: idx.get_stats() 
                for ns, idx in self.bm25_indexes.items()
            },
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_pipeline: Optional[HybridRetrievalPipeline] = None


def get_retrieval_pipeline() -> HybridRetrievalPipeline:
    """Get or create retrieval pipeline singleton."""
    global _pipeline
    
    if _pipeline is None:
        _pipeline = HybridRetrievalPipeline()
    
    return _pipeline
