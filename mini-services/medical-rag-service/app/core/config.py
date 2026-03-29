"""
Medical Diagnostic RAG Service - Core Configuration
====================================================

HIPAA-compliant configuration management for the medical RAG system.
Integrates PubMed/PMC, Pinecone, and GLM-4.7-Flash LLM via Together AI.
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # ===== Pinecone Configuration =====
    # SECURITY: API key must be set via environment variable
    # Never commit API keys to version control
    PINECONE_API_KEY: Optional[str] = Field(
        default=None,
        description="Pinecone API key (set via PINECONE_API_KEY env var)"
    )
    PINECONE_INDEX_NAME: str = Field(
        default="medical-diagnostic-rag",
        description="Pinecone index name"
    )
    PINECONE_ENVIRONMENT: str = Field(
        default="us-east-1-aws",
        description="Pinecone cloud environment"
    )
    PINECONE_NAMESPACE: str = Field(
        default="pubmed",
        description="Namespace within Pinecone index"
    )
    
    # ===== NCBI Configuration =====
    # SECURITY: API key must be set via environment variable
    NCBI_API_KEY: Optional[str] = Field(
        default=None,
        description="NCBI Entrez API key (set via NCBI_API_KEY env var)"
    )
    NCBI_EMAIL: str = Field(
        default="info@gelani-health.ai",
        description="Email for NCBI API"
    )
    NCBI_TOOL: str = Field(
        default="medical_diagnostic_rag",
        description="Tool name for NCBI API"
    )
    NCBI_BASE_URL: str = Field(
        default="https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        description="NCBI E-utilities base URL"
    )
    
    # ===== GLM-4.7-Flash via Z.AI Direct =====
    # Provider: Z.AI Direct
    # Base URL: https://api.z.ai/api/paas/v4
    # Model ID: glm-4.7-flash
    # Documentation: https://docs.z.ai/guides/llm/glm-4.7
    # 
    # Alternative Providers (set USE_ALTERNATIVE_PROVIDER to use):
    # - Together AI: https://api.together.xyz/v1 (model: together_ai/z-ai/glm-4.7-flash)
    # - OpenRouter: https://openrouter.ai/api/v1 (model: z-ai/glm-4.7-flash)
    
    # SECURITY: API key must be set via environment variable
    # The TypeScript services use z-ai-web-dev-sdk which handles auth internally
    ZAI_API_KEY: Optional[str] = Field(
        default=None,
        description="Z.AI API key for GLM-4.7-Flash (set via ZAI_API_KEY env var)"
    )
    ZAI_BASE_URL: str = Field(
        default="https://api.z.ai/api/paas/v4",
        description="Z.AI API base URL"
    )
    GLM_MODEL: str = Field(
        default="glm-4.7-flash",
        description="GLM-4.7-Flash model identifier"
    )
    
    # Alternative provider settings (Together AI recommended if available)
    USE_TOGETHER_AI: bool = Field(
        default=False,
        description="Use Together AI instead of Z.AI Direct"
    )
    TOGETHER_API_KEY: Optional[str] = Field(
        default=None,
        description="Together AI API key (optional)"
    )
    TOGETHER_BASE_URL: str = Field(
        default="https://api.together.xyz/v1",
        description="Together AI API base URL"
    )
    
    # Alternative: OpenRouter (fallback)
    OPENROUTER_API_KEY: Optional[str] = Field(
        default=None,
        description="OpenRouter API key (alternative provider)"
    )
    OPENROUTER_BASE_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        description="OpenRouter API base URL"
    )
    OPENROUTER_MODEL: str = Field(
        default="z-ai/glm-4.7-flash",
        description="GLM model ID for OpenRouter"
    )
    
    # ===== GLM-4.7-Flash Capabilities =====
    # - 200K context window (fit entire article corpus in single query)
    # - Superior multi-step reasoning (complex diagnostic chains)
    # - Task decomposition (understand multi-part diagnostic queries)
    # - Structured output (JSON mode for consistent diagnosis formatting)
    # - Multilingual support
    
    GLM_MAX_TOKENS: int = Field(
        default=4096,
        description="Maximum tokens for GLM response"
    )
    GLM_TEMPERATURE: float = Field(
        default=0.3,
        description="Temperature for diagnostic reasoning (lower = more precise)"
    )
    GLM_CONTEXT_WINDOW: int = Field(
        default=200000,
        description="GLM-4.7-Flash context window (200K tokens)"
    )
    
    # ===== Embedding Configuration =====
    # PubMedBERT: Domain-specific medical embeddings (RECOMMENDED)
    # - NeuML/pubmedbert-base-embeddings: 768-dim, optimized for biomedical text
    # - 15-25% better performance on medical queries
    #
    # Alternative: all-mpnet-base-v2 (general-purpose, 768-dim)
    PUBMEDBERT_MODEL: str = Field(
        default="NeuML/pubmedbert-base-embeddings",
        description="PubMedBERT model for medical embeddings (768-dim)"
    )
    EMBEDDING_MODEL: str = Field(
        default="NeuML/pubmedbert-base-embeddings",
        description="Embedding model (PubMedBERT recommended for medical RAG)"
    )
    EMBEDDING_DEVICE: str = Field(
        default="cpu",
        description="Device for embedding model (cpu/cuda)"
    )
    EMBEDDING_DIMENSION: int = Field(
        default=768,
        description="Embedding vector dimension (768 for PubMedBERT)"
    )
    EMBEDDING_BATCH_SIZE: int = Field(
        default=32,
        description="Batch size for embedding generation"
    )
    EMBEDDING_WARMUP_ON_STARTUP: bool = Field(
        default=True,
        description="Warmup embedding model on application startup"
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
    
    # ===== Performance Targets =====
    QUERY_LATENCY_TARGET_MS: int = Field(
        default=500,
        description="Target query latency in milliseconds"
    )
    MAX_CONCURRENT_REQUESTS: int = Field(
        default=100,
        description="Maximum concurrent API requests"
    )
    
    # ===== Security =====
    # SECURITY: Secret key must be set via environment variable
    API_SECRET_KEY: Optional[str] = Field(
        default=None,
        description="API secret key for authentication (set via API_SECRET_KEY env var)"
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
    ENCRYPTION_KEY: Optional[str] = Field(
        default=None,
        description="Data encryption key"
    )
    
    # ===== Redis Cache =====
    REDIS_URL: Optional[str] = Field(
        default=None,
        description="Redis connection URL"
    )
    CACHE_TTL_SECONDS: int = Field(
        default=3600,
        description="Cache time-to-live in seconds"
    )
    
    # ===== Application =====
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level"
    )
    PORT: int = Field(
        default=3031,
        description="Service port"
    )
    DEBUG: bool = Field(
        default=False,
        description="Debug mode"
    )
    
    # ===== HuggingFace =====
    HF_TOKEN: Optional[str] = Field(
        default=None,
        description="HuggingFace API token for embedding rate limits"
    )
    
    @field_validator('ALLOWED_ORIGINS')
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        """Validate CORS origins."""
        return v
    
    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(',')]
    
    @property
    def api_secret_key(self) -> Optional[str]:
        """Get API secret key."""
        return self.API_SECRET_KEY
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# PubMed/PMC API endpoints
PUBMED_ENDPOINTS = {
    "search": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
    "fetch": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
    "summary": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    "link": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi",
    "info": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi",
    "pmc_oai": "https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi",
    "pmc_ftp": "ftp.ncbi.nlm.nih.gov/pub/pmc/",
    "mesh": "https://id.nlm.nih.gov/mesh/",
}

# Medical specialty MeSH terms for enhanced retrieval
MESH_SPECIALTIES = {
    "cardiology": ["Heart Diseases", "Cardiovascular Diseases", "Arrhythmias", "Heart Failure", "Myocardial Infarction", "Hypertension"],
    "oncology": ["Neoplasms", "Cancer", "Tumor", "Oncology", "Chemotherapy", "Radiotherapy"],
    "neurology": ["Nervous System Diseases", "Brain Diseases", "Stroke", "Epilepsy", "Dementia", "Parkinson Disease"],
    "pulmonology": ["Respiratory Diseases", "Lung Diseases", "Asthma", "COPD", "Pneumonia", "Pulmonary Embolism"],
    "endocrinology": ["Endocrine Diseases", "Diabetes Mellitus", "Thyroid Diseases", "Obesity", "Metabolic Syndrome"],
    "nephrology": ["Kidney Diseases", "Renal Diseases", "Dialysis", "Chronic Kidney Disease", "Acute Kidney Injury"],
    "gastroenterology": ["Gastrointestinal Diseases", "Liver Diseases", "IBD", "Crohn Disease", "Ulcerative Colitis"],
    "infectious_disease": ["Infection", "Bacterial Infections", "Viral Infections", "Sepsis", "HIV", "COVID-19"],
    "rheumatology": ["Rheumatic Diseases", "Arthritis", "Autoimmune Diseases", "Rheumatoid Arthritis", "Lupus"],
    "psychiatry": ["Mental Disorders", "Depression", "Anxiety Disorders", "Schizophrenia", "Bipolar Disorder"],
    "dermatology": ["Skin Diseases", "Dermatitis", "Psoriasis", "Eczema", "Melanoma"],
    "obstetrics_gynecology": ["Pregnancy", "Obstetrics", "Gynecology", "Prenatal Care", "Menstruation"],
}

# UMLS semantic types for medical concepts
UMLS_SEMANTIC_TYPES = {
    "T047": "Disease or Syndrome",
    "T048": "Mental or Behavioral Dysfunction",
    "T049": "Cell or Molecular Dysfunction",
    "T019": "Congenital Abnormality",
    "T020": "Acquired Abnormality",
    "T033": "Finding",
    "T037": "Injury or Poisoning",
    "T041": "Pathologic Function",
    "T184": "Sign or Symptom",
    "T121": "Pharmacologic Substance",
    "T122": "Biomedical Occupation or Discipline",
    "T109": "Organic Chemical",
    "T116": "Amino Acid, Peptide, or Protein",
    "T195": "Antibiotic",
    "T200": "Clinical Drug",
}

# ICD-10 Chapter mappings
ICD10_CHAPTERS = {
    "A00-B99": "Infectious and Parasitic Diseases",
    "C00-D49": "Neoplasms",
    "D50-D89": "Blood and Blood-Forming Organs",
    "E00-E89": "Endocrine, Nutritional and Metabolic Diseases",
    "F01-F99": "Mental and Behavioral Disorders",
    "G00-G99": "Nervous System Diseases",
    "H00-H59": "Eye and Adnexa Diseases",
    "H60-H95": "Ear and Mastoid Process Diseases",
    "I00-I99": "Circulatory System Diseases",
    "J00-J99": "Respiratory System Diseases",
    "K00-K95": "Digestive System Diseases",
    "L00-L99": "Skin and Subcutaneous Tissue Diseases",
    "M00-M99": "Musculoskeletal System Diseases",
    "N00-N99": "Genitourinary System Diseases",
    "O00-O9A": "Pregnancy, Childbirth and Puerperium",
    "P00-P96": "Perinatal Period Conditions",
    "Q00-Q99": "Congenital Malformations",
    "R00-R99": "Symptoms and Abnormal Findings",
    "S00-T88": "Injury, Poisoning and External Causes",
    "Z00-Z99": "Health Status Factors",
}
