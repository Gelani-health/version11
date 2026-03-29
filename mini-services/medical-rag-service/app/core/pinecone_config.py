"""
Pinecone Vector Database Configuration
======================================

Index: medical-diagnostic-rag
Dimension: 768 (BiomedNLP-PubMedBERT-base)
Metric: cosine (semantic similarity)
Namespace: pubmed

API Documentation:
- Main Docs: https://docs.pinecone.io
- API Reference: https://docs.pinecone.io/api/
- Python SDK: https://github.com/pinecone-io/pinecone-python-client

API Endpoints (v2024-10):
- Base URL: https://api.pinecone.io/v1/
- Upsert: POST /indexes/{index_name}/vectors
- Query: POST /indexes/{index_name}/query
- Delete: POST /indexes/{index_name}/vectors/delete
- Stats: GET /indexes/{index_name}
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import json


# ===== Index Configuration =====

PINECONE_INDEX_NAME = "medical-diagnostic-rag"
PINECONE_DIMENSION = 768  # BiomedNLP-PubMedBERT-base
PINECONE_METRIC = "cosine"
PINECONE_NAMESPACE = "pubmed"

# Batch limits
PINECONE_MAX_BATCH_SIZE = 2000  # vectors per batch
PINECONE_MAX_BATCH_BYTES = 2 * 1024 * 1024  # 2MB per request


# ===== Metadata Schema =====

@dataclass
class VectorMetadata:
    """
    Metadata schema for medical literature vectors.
    
    Stored with each vector in Pinecone for filtering and retrieval.
    
    Fields:
        pmid: PubMed ID (unique identifier)
        pmcid: PubMed Central ID (for full-text articles)
        title: Article title
        authors: Comma-separated author names
        journal: Publication journal name
        pub_date: Publication date (YYYY-MM-DD format)
        source_type: Source database (PubMed or PMC)
        section_type: Article section type
        mesh_terms: Comma-separated MeSH terms
        doi: Digital Object Identifier
        retracted: Whether article has been retracted
        url: Direct link to article
    """
    pmid: str
    pmcid: Optional[str] = None
    title: str = ""
    authors: str = ""
    journal: str = ""
    pub_date: Optional[str] = None  # YYYY-MM-DD
    source_type: str = "PubMed"  # PubMed | PMC
    section_type: str = "abstract"  # abstract | methods | results | discussion | conclusion
    mesh_terms: str = ""
    doi: Optional[str] = None
    retracted: bool = False
    url: Optional[str] = None
    chunk_index: int = 0
    total_chunks: int = 1
    ingest_timestamp: str = ""
    
    def to_pinecone_metadata(self) -> Dict[str, Any]:
        """Convert to Pinecone-compatible metadata format."""
        return {
            "pmid": self.pmid,
            "pmcid": self.pmcid or "",
            "title": self.title[:1000],  # Pinecone metadata limit
            "authors": self.authors[:500],
            "journal": self.journal[:200],
            "pub_date": self.pub_date or "",
            "source_type": self.source_type,
            "section_type": self.section_type,
            "mesh_terms": self.mesh_terms[:500],
            "doi": self.doi or "",
            "retracted": self.retracted,
            "url": self.url or "",
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "ingest_timestamp": self.ingest_timestamp,
        }
    
    @classmethod
    def from_article(cls, article: Dict[str, Any], chunk_index: int = 0, total_chunks: int = 1) -> "VectorMetadata":
        """Create metadata from article dictionary."""
        pmid = str(article.get("pmid", ""))
        url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None
        
        # Format authors
        authors_list = article.get("authors", [])
        if isinstance(authors_list, list):
            authors = ", ".join(str(a) for a in authors_list[:10])
        else:
            authors = str(authors_list)
        
        # Format MeSH terms
        mesh_list = article.get("mesh_terms", [])
        if isinstance(mesh_list, list):
            mesh_terms = ", ".join(str(m) for m in mesh_list[:20])
        else:
            mesh_terms = str(mesh_list)
        
        return cls(
            pmid=pmid,
            pmcid=article.get("pmc_id"),
            title=article.get("title", ""),
            authors=authors,
            journal=article.get("journal", ""),
            pub_date=article.get("publication_date"),
            source_type="PMC" if article.get("pmc_id") else "PubMed",
            section_type=article.get("section_type", "abstract"),
            mesh_terms=mesh_terms,
            doi=article.get("doi"),
            retracted=article.get("retracted", False),
            url=url,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            ingest_timestamp=datetime.utcnow().isoformat(),
        )


# ===== Query Filters =====

class QueryFilter:
    """Pinecone query filter builder."""
    
    @staticmethod
    def date_range(start_date: str, end_date: str = None) -> Dict[str, Any]:
        """Filter by publication date range."""
        if end_date:
            return {
                "pub_date": {
                    "$gte": start_date,
                    "$lte": end_date
                }
            }
        return {"pub_date": {"$gte": start_date}}
    
    @staticmethod
    def source_type(source: str) -> Dict[str, Any]:
        """Filter by source type (PubMed or PMC)."""
        return {"source_type": {"$eq": source}}
    
    @staticmethod
    def section_type(section: str) -> Dict[str, Any]:
        """Filter by section type."""
        return {"section_type": {"$eq": section}}
    
    @staticmethod
    def not_retracted() -> Dict[str, Any]:
        """Exclude retracted articles."""
        return {"retracted": {"$eq": False}}
    
    @staticmethod
    def mesh_terms(terms: List[str]) -> Dict[str, Any]:
        """Filter by MeSH terms (OR condition)."""
        return {
            "$or": [
                {"mesh_terms": {"$in": [term]}}
                for term in terms
            ]
        }
    
    @staticmethod
    def combine(*filters: Dict[str, Any]) -> Dict[str, Any]:
        """Combine multiple filters with AND condition."""
        return {"$and": list(filters)}


def build_medical_filter(
    date_from: str = "2020-01-01",
    source_type: str = None,
    section_type: str = None,
    mesh_terms: List[str] = None,
    exclude_retracted: bool = True,
) -> Dict[str, Any]:
    """
    Build a Pinecone filter for medical queries.
    
    Args:
        date_from: Minimum publication date
        source_type: Filter by source (PubMed/PMC)
        section_type: Filter by section
        mesh_terms: Filter by MeSH terms
        exclude_retracted: Exclude retracted articles
    
    Returns:
        Pinecone filter dictionary
    """
    filters = []
    
    # Date filter (default from 2020)
    filters.append(QueryFilter.date_range(date_from))
    
    # Source type filter
    if source_type:
        filters.append(QueryFilter.source_type(source_type))
    
    # Section type filter
    if section_type:
        filters.append(QueryFilter.section_type(section_type))
    
    # MeSH terms filter
    if mesh_terms:
        filters.append(QueryFilter.mesh_terms(mesh_terms))
    
    # Exclude retracted
    if exclude_retracted:
        filters.append(QueryFilter.not_retracted())
    
    if len(filters) == 1:
        return filters[0]
    
    return QueryFilter.combine(*filters)
