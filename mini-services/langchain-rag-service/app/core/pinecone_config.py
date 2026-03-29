"""
Pinecone Configuration - Shared with Custom RAG
================================================

CRITICAL: Uses same namespace (pubmed) as Custom RAG
- Vector IDs prefixed with 'lc_' to avoid conflicts
- Metadata includes 'source_pipeline: langchain' for identification
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import json

from app.core.config import get_settings

# Pinecone Configuration
PINECONE_INDEX_NAME = "medical-diagnostic-rag"
PINECONE_DIMENSION = 768  # CRITICAL: Must match Custom RAG
PINECONE_NAMESPACE = "pubmed"  # Shared namespace
PINECONE_MAX_BATCH_SIZE = 2000
PINECONE_VECTOR_ID_PREFIX = "lc_"  # LangChain prefix


@dataclass
class VectorMetadata:
    """Metadata structure for Pinecone vectors."""
    pmid: str
    title: str
    chunk_index: int = 0
    total_chunks: int = 1
    section_type: str = "abstract"
    mesh_terms: List[str] = field(default_factory=list)
    journal: str = ""
    publication_date: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    pmcid: Optional[str] = None
    source_type: str = "PubMed"
    source_pipeline: str = "langchain"  # CRITICAL: Identify source
    ingest_timestamp: Optional[str] = None

    def to_pinecone_metadata(self) -> Dict[str, Any]:
        """Convert to Pinecone metadata format."""
        return {
            "pmid": self.pmid,
            "title": self.title[:1000] if self.title else "",
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "section_type": self.section_type,
            "mesh_terms": json.dumps(self.mesh_terms[:20]),
            "journal": self.journal[:200] if self.journal else "",
            "publication_date": self.publication_date or "",
            "authors": json.dumps(self.authors[:10]),
            "doi": self.doi or "",
            "pmcid": self.pmcid or "",
            "source_type": self.source_type,
            "source_pipeline": self.source_pipeline,
            "ingest_timestamp": self.ingest_timestamp or datetime.utcnow().isoformat(),
        }

    @classmethod
    def from_pinecone(cls, metadata: Dict[str, Any]) -> "VectorMetadata":
        """Create from Pinecone metadata."""
        return cls(
            pmid=metadata.get("pmid", "unknown"),
            title=metadata.get("title", ""),
            chunk_index=metadata.get("chunk_index", 0),
            total_chunks=metadata.get("total_chunks", 1),
            section_type=metadata.get("section_type", "abstract"),
            mesh_terms=json.loads(metadata.get("mesh_terms", "[]")),
            journal=metadata.get("journal", ""),
            publication_date=metadata.get("publication_date"),
            authors=json.loads(metadata.get("authors", "[]")),
            doi=metadata.get("doi"),
            pmcid=metadata.get("pmcid"),
            source_type=metadata.get("source_type", "PubMed"),
            source_pipeline=metadata.get("source_pipeline", "unknown"),
            ingest_timestamp=metadata.get("ingest_timestamp"),
        )


def generate_vector_id(pmid: str, chunk_index: int, prefix: str = PINECONE_VECTOR_ID_PREFIX) -> str:
    """
    Generate a unique vector ID with LangChain prefix.

    Format: lc_pmid_{pmid}_chunk_{chunk_index}

    Example: lc_pmid_12345678_chunk_0
    """
    return f"{prefix}pmid_{pmid}_chunk_{chunk_index}"


def parse_vector_id(vector_id: str) -> Dict[str, Any]:
    """
    Parse a vector ID to extract components.

    Returns:
        dict with 'prefix', 'pmid', 'chunk_index'
    """
    parts = vector_id.split("_")
    if len(parts) >= 4 and parts[0] in ["lc", "pmid"]:
        if parts[0] == "lc":
            # Format: lc_pmid_{pmid}_chunk_{chunk_index}
            return {
                "prefix": "lc_",
                "pipeline": "langchain",
                "pmid": parts[2],
                "chunk_index": int(parts[4]) if len(parts) > 4 else 0,
            }
        else:
            # Format: pmid_{pmid}_chunk_{chunk_index} (Custom RAG)
            return {
                "prefix": "",
                "pipeline": "custom_rag",
                "pmid": parts[1],
                "chunk_index": int(parts[3]) if len(parts) > 3 else 0,
            }

    return {
        "prefix": "unknown",
        "pipeline": "unknown",
        "pmid": "unknown",
        "chunk_index": 0,
    }


def is_langchain_vector(vector_id: str) -> bool:
    """Check if a vector belongs to LangChain pipeline."""
    return vector_id.startswith("lc_")


def build_medical_filter(
    specialty: Optional[str] = None,
    mesh_terms: Optional[List[str]] = None,
    source_pipeline: Optional[str] = None,
    min_date: Optional[str] = None,
    max_date: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Build Pinecone metadata filter for medical queries."""
    filters = []

    if specialty and specialty in MESH_SPECIALTIES:
        # Note: Pinecone doesn't support array contains, so we'd need
        # to use a different approach for mesh terms
        pass

    if source_pipeline:
        filters.append({"source_pipeline": {"$eq": source_pipeline}})

    if min_date:
        filters.append({"publication_date": {"$gte": min_date}})

    if max_date:
        filters.append({"publication_date": {"$lte": max_date}})

    if not filters:
        return None

    if len(filters) == 1:
        return filters[0]

    return {"$and": filters}


# MeSH specialties (shared)
MESH_SPECIALTIES = {
    "cardiology": ["Heart Diseases", "Cardiovascular Diseases", "Arrhythmias"],
    "oncology": ["Neoplasms", "Cancer", "Tumor"],
    "neurology": ["Nervous System Diseases", "Brain Diseases", "Stroke"],
    "pulmonology": ["Respiratory Diseases", "Lung Diseases", "Asthma"],
    "endocrinology": ["Endocrine Diseases", "Diabetes Mellitus"],
    "infectious_disease": ["Infection", "Bacterial Infections", "Viral Infections"],
}
