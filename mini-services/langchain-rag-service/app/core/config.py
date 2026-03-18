"""
LangChain RAG Service - Core Configuration
===========================================

READ/WRITE enabled configuration with Smart Sync support.
Shares Pinecone namespace with Custom RAG (pubmed).

Key Features:
- Vector ID prefixing (lc_) to avoid conflicts
- source_pipeline metadata tagging
- Sync endpoints for cross-pipeline management
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with READ/WRITE mode enabled."""

    # ===== Service Identity =====
    SERVICE_NAME: str = Field(
        default="langchain-rag-service",
        description="Service name for identification"
    )
    SERVICE_MODE: str = Field(
        default="READ_WRITE",
        description="Service mode: READ_ONLY or READ_WRITE"
    )

    # ===== Vector ID Prefixing (CRITICAL for avoiding conflicts) =====
    VECTOR_ID_PREFIX: str = Field(
        default="lc_",
        description="Prefix for all vector IDs to avoid conflicts with Custom RAG"
    )
    SOURCE_PIPELINE: str = Field(
        default="langchain",
        description="Source pipeline identifier in metadata"
    )

    # ===== Pinecone Configuration (Shared with Custom RAG) =====
    PINECONE_API_KEY: str = Field(
        default="pcsk_57cpCV_8i4dNCraxqLetEckEEJPm65wWYbde1ywNGbtSoDx7AtJ6txzWHzsSJNvnXqvQ1q",
        description="Pinecone API key"
    )
    PINECONE_INDEX_NAME: str = Field(
        default="medical-diagnostic-rag",
        description="Pinecone index name (shared with Custom RAG)"
    )
    PINECONE_ENVIRONMENT: str = Field(
        default="us-east-1-aws",
        description="Pinecone cloud environment"
    )
    PINECONE_NAMESPACE: str = Field(
        default="pubmed",
        description="Shared namespace with Custom RAG"
    )

    # ===== Custom RAG Service (for Smart Sync) =====
    CUSTOM_RAG_URL: str = Field(
        default="http://localhost:3031",
        description="Custom RAG service URL for sync operations"
    )
    CUSTOM_RAG_API_KEY: str = Field(
        default="medical_rag_secret_key_2024",
        description="Custom RAG API key"
    )

    # ===== NCBI Configuration =====
    NCBI_API_KEY: str = Field(
        default="25b0fc18f6507e7190c88bd59aaf1a6cc609",
        description="NCBI Entrez API key"
    )
    NCBI_EMAIL: str = Field(
        default="info@gelani-health.ai",
        description="Email for NCBI API"
    )
    NCBI_TOOL: str = Field(
        default="langchain_medical_rag",
        description="Tool name for NCBI API"
    )

    # ===== Z.AI LLM Configuration =====
    ZAI_API_KEY: str = Field(
        default="f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs",
        description="Z.AI API key for GLM-4.7-Flash"
    )
    ZAI_BASE_URL: str = Field(
        default="https://api.z.ai/api/paas/v4",
        description="Z.AI API base URL"
    )
    GLM_MODEL: str = Field(
        default="glm-4.7-flash",
        description="GLM-4.7-Flash model identifier"
    )
    GLM_MAX_TOKENS: int = Field(
        default=4096,
        description="Maximum tokens for GLM response"
    )
    GLM_TEMPERATURE: float = Field(
        default=0.3,
        description="Temperature for diagnostic reasoning"
    )

    # ===== Embedding Configuration =====
    EMBEDDING_MODEL: str = Field(
        default="all-mpnet-base-v2",
        description="Embedding model (must match Custom RAG: 768-dim)"
    )
    EMBEDDING_DEVICE: str = Field(
        default="cpu",
        description="Device for embedding model (cpu/cuda)"
    )
    EMBEDDING_DIMENSION: int = Field(
        default=768,
        description="Embedding vector dimension (CRITICAL: must match Custom RAG)"
    )
    EMBEDDING_BATCH_SIZE: int = Field(
        default=32,
        description="Batch size for embedding generation"
    )

    # ===== LangChain Specific =====
    LANGCHAIN_TRACING: bool = Field(
        default=False,
        description="Enable LangSmith tracing"
    )
    LANGCHAIN_API_KEY: Optional[str] = Field(
        default=None,
        description="LangSmith API key"
    )
    LANGCHAIN_PROJECT: str = Field(
        default="medical-rag",
        description="LangSmith project name"
    )

    # ===== Retrieval Configuration =====
    RETRIEVAL_TOP_K: int = Field(
        default=50,
        description="Number of documents to retrieve"
    )
    RETRIEVAL_MIN_SCORE: float = Field(
        default=0.5,
        description="Minimum similarity score threshold"
    )
    RETRIEVAL_ALPHA: float = Field(
        default=0.7,
        description="Hybrid search weight (0=keyword, 1=semantic)"
    )

    # ===== Smart Sync Configuration =====
    SYNC_ENABLED: bool = Field(
        default=True,
        description="Enable Smart Sync functionality"
    )
    SYNC_BATCH_SIZE: int = Field(
        default=100,
        description="Batch size for sync operations"
    )
    SYNCConflict_RESOLUTION: str = Field(
        default="keep_newest",
        description="Conflict resolution: keep_newest, keep_both, skip"
    )

    # ===== Security =====
    API_SECRET_KEY: str = Field(
        default="langchain_rag_secret_key_2024",
        description="API secret key for authentication"
    )
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://21.0.7.104:3000",
        description="CORS allowed origins (comma-separated)"
    )

    # ===== HIPAA Compliance =====
    AUDIT_LOGGING: bool = Field(
        default=True,
        description="Enable HIPAA audit logging"
    )

    # ===== Application =====
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level"
    )
    PORT: int = Field(
        default=3032,
        description="Service port"
    )
    DEBUG: bool = Field(
        default=False,
        description="Debug mode"
    )

    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(',')]

    @property
    def is_read_write(self) -> bool:
        """Check if service is in READ_WRITE mode."""
        return self.SERVICE_MODE.upper() == "READ_WRITE"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Medical specialty MeSH terms (shared with Custom RAG)
MESH_SPECIALTIES = {
    "cardiology": ["Heart Diseases", "Cardiovascular Diseases", "Arrhythmias", "Heart Failure"],
    "oncology": ["Neoplasms", "Cancer", "Tumor", "Oncology", "Chemotherapy"],
    "neurology": ["Nervous System Diseases", "Brain Diseases", "Stroke", "Epilepsy"],
    "pulmonology": ["Respiratory Diseases", "Lung Diseases", "Asthma", "COPD"],
    "endocrinology": ["Endocrine Diseases", "Diabetes Mellitus", "Thyroid Diseases"],
    "infectious_disease": ["Infection", "Bacterial Infections", "Viral Infections", "Sepsis"],
}
