"""
P9: Ingestion Module for PubMed/Pinecone RAG Pipeline
======================================================

This module provides:
- PubMed ingestion via NCBI E-utilities API
- Together AI embedding client
- Namespace routing for clinical queries
"""

from app.ingestion.pubmed_ingestor import (
    PubMedIngestor,
    CLINICAL_NAMESPACES,
    get_pubmed_ingestor,
)
from app.ingestion.embedding_client import (
    TogetherAIEmbeddingClient,
    get_embedding_client,
)
from app.ingestion.namespace_router import (
    NamespaceRouter,
    COMPLAINT_NAMESPACE_MAP,
    get_namespace_router,
)

__all__ = [
    "PubMedIngestor",
    "CLINICAL_NAMESPACES",
    "get_pubmed_ingestor",
    "TogetherAIEmbeddingClient",
    "get_embedding_client",
    "NamespaceRouter",
    "COMPLAINT_NAMESPACE_MAP",
    "get_namespace_router",
]
