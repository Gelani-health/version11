"""
RAG Retrieval Engine Module
===========================

Retrieval-Augmented Generation engine for medical diagnostics.
Includes hybrid retrieval with BM25 + Semantic search and RRF fusion.
"""

from .rag_engine import RAGRetrievalEngine, RAGContext, RetrievedArticle
from .hybrid_retrieval import (
    HybridRetrievalEngine,
    HybridContext,
    HybridResult,
    BM25Index,
    ReciprocalRankFusion,
    RecencyScorer,
    QueryExpander,
    get_hybrid_retrieval_engine,
)

__all__ = [
    # Original RAG
    "RAGRetrievalEngine",
    "RAGContext",
    "RetrievedArticle",
    # Hybrid Retrieval
    "HybridRetrievalEngine",
    "HybridContext",
    "HybridResult",
    "BM25Index",
    "ReciprocalRankFusion",
    "RecencyScorer",
    "QueryExpander",
    "get_hybrid_retrieval_engine",
]
