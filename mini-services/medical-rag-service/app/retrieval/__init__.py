"""
RAG Retrieval Engine Module
===========================

Retrieval-Augmented Generation engine for medical diagnostics.

P1 Enhancements:
- Hybrid retrieval (BM25 + Semantic)
- Multi-query generation
- Query decomposition
"""

from .rag_engine import RAGRetrievalEngine, RAGContext, RetrievedArticle

# P1: Hybrid Retrieval
from .hybrid_retrieval import (
    HybridRetrievalEngine,
    HybridResult,
    HybridSearchResult,
    BM25Engine,
    get_hybrid_engine,
)

# P1: Multi-Query Generation
from .multi_query import (
    MultiQueryGenerator,
    MultiQueryResult,
    QueryVariation,
    get_multi_query_generator,
)

# P1: Query Decomposition
from .query_decomposition import (
    QueryDecomposer,
    DecompositionResult,
    SubQuery,
    get_query_decomposer,
)

__all__ = [
    # Original
    "RAGRetrievalEngine",
    "RAGContext",
    "RetrievedArticle",
    # P1: Hybrid Retrieval
    "HybridRetrievalEngine",
    "HybridResult",
    "HybridSearchResult",
    "BM25Engine",
    "get_hybrid_engine",
    # P1: Multi-Query
    "MultiQueryGenerator",
    "MultiQueryResult",
    "QueryVariation",
    "get_multi_query_generator",
    # P1: Query Decomposition
    "QueryDecomposer",
    "DecompositionResult",
    "SubQuery",
    "get_query_decomposer",
]
