"""
Medical RAG Embedding Module
============================

Provides embedding services for medical literature.

Components:
- PubMedBERTEmbeddingService: Domain-specific medical embeddings
- EmbeddingOptimizer: Optimized batch embedding with caching
- ReembeddingPipeline: Migration tool for existing vectors

Usage:
    from app.embedding import get_pubmedbert_service

    service = await get_pubmedbert_service()
    result = await service.embed("patient has diabetes")
"""

from app.embedding.pubmedbert_embeddings import (
    PubMedBERTEmbeddingService,
    get_pubmedbert_service,
    warmup_embedding_model,
    PUBMEDBERT_MODEL,
    PUBMEDBERT_DIMENSION,
)

from app.embedding.embedding_optimizer import (
    EmbeddingOptimizer,
    get_embedding_optimizer,
)

from app.embedding.reembed_pipeline import (
    ReembeddingPipeline,
    run_reembedding,
    estimate_migration_time,
)

__all__ = [
    # PubMedBERT Service
    "PubMedBERTEmbeddingService",
    "get_pubmedbert_service",
    "warmup_embedding_model",
    "PUBMEDBERT_MODEL",
    "PUBMEDBERT_DIMENSION",
    
    # Embedding Optimizer
    "EmbeddingOptimizer",
    "get_embedding_optimizer",
    
    # Re-embedding Pipeline
    "ReembeddingPipeline",
    "run_reembedding",
    "estimate_migration_time",
]
