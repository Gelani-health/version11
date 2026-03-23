"""
Hybrid Retrieval System for Medical RAG
========================================

Implements advanced retrieval strategies combining:
- BM25 Keyword Search (Lexical)
- Semantic Vector Search (PubMedBERT)
- Reciprocal Rank Fusion (RRF)
- Recency-Weighted Scoring
- Query Expansion

This module integrates with the existing Medical RAG architecture and
maintains cross-pipeline compatibility with LangChain RAG service.

Design Decisions:
1. BM25 index is local to Medical RAG (not synced to LangChain)
2. Semantic search uses existing PubMedBERT + Pinecone
3. RRF combines both result sets
4. Source pipeline filtering is preserved for cross-pipeline sync

Reference:
    Cormack, Clarke, Buettcher. "Reciprocal Rank Fusion outperforms Condorcet and
    individual Rank Learning Methods" (SIGIR 2009)
"""

import asyncio
import time
import re
import math
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import json

from loguru import logger

from app.core.config import get_settings


# =============================================================================
# CONSTANTS
# =============================================================================

# BM25 Parameters (tuned for medical literature)
BM25_K1 = 1.5  # Term frequency saturation parameter
BM25_B = 0.75  # Document length normalization

# RRF Parameters
RRF_K = 60  # Constant for RRF score calculation (standard value)

# Recency Weighting
RECENCY_DECAY_YEARS = 5  # Years for 50% recency decay
RECENCY_MIN_SCORE = 0.3  # Minimum recency score

# Query Expansion
MEDICAL_ABBREVIATIONS = {
    "mi": "myocardial infarction",
    "chf": "congestive heart failure",
    "htn": "hypertension",
    "dm": "diabetes mellitus",
    "ckd": "chronic kidney disease",
    "copd": "chronic obstructive pulmonary disease",
    "afib": "atrial fibrillation",
    "dvt": "deep vein thrombosis",
    "pe": "pulmonary embolism",
    "uti": "urinary tract infection",
    "cad": "coronary artery disease",
    "t2dm": "type 2 diabetes mellitus",
    "t1dm": "type 1 diabetes mellitus",
    "hiv": "human immunodeficiency virus",
    "cva": "cerebrovascular accident",
    "tia": "transient ischemic attack",
    "hf": "heart failure",
    "aki": "acute kidney injury",
}

# Medical synonyms for query expansion
MEDICAL_SYNONYMS = {
    "heart attack": ["myocardial infarction", "MI", "cardiac infarction"],
    "heart failure": ["cardiac failure", "CHF", "congestive heart failure"],
    "high blood pressure": ["hypertension", "HTN", "elevated blood pressure"],
    "diabetes": ["diabetes mellitus", "DM", "hyperglycemia"],
    "stroke": ["cerebrovascular accident", "CVA", "brain ischemia"],
    "cancer": ["malignancy", "neoplasm", "tumor", "carcinoma"],
    "kidney disease": ["renal disease", "nephropathy", "renal failure"],
    "lung disease": ["pulmonary disease", "respiratory disease"],
    "blood clot": ["thrombus", "thrombosis", "embolism"],
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class HybridResult:
    """A single hybrid retrieval result with multiple scores."""
    id: str
    pmid: str
    title: str
    abstract: str
    semantic_score: float = 0.0
    bm25_score: float = 0.0
    rrf_score: float = 0.0
    recency_score: float = 0.5
    final_score: float = 0.0
    journal: str = ""
    publication_date: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    source_pipeline: str = "medical_rag"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract[:500] if self.abstract else "",
            "semantic_score": round(self.semantic_score, 4),
            "bm25_score": round(self.bm25_score, 4),
            "rrf_score": round(self.rrf_score, 4),
            "recency_score": round(self.recency_score, 4),
            "final_score": round(self.final_score, 4),
            "journal": self.journal,
            "publication_date": self.publication_date,
            "authors": self.authors[:5],
            "mesh_terms": self.mesh_terms[:5],
            "doi": self.doi,
            "source_pipeline": self.source_pipeline,
        }


@dataclass
class HybridContext:
    """Complete context from hybrid retrieval."""
    query: str
    expanded_query: Optional[str]
    results: List[HybridResult]
    total_semantic_results: int
    total_bm25_results: int
    fusion_latency_ms: float
    retrieval_latency_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "expanded_query": self.expanded_query,
            "results": [r.to_dict() for r in self.results],
            "total_semantic_results": self.total_semantic_results,
            "total_bm25_results": self.total_bm25_results,
            "fusion_latency_ms": round(self.fusion_latency_ms, 2),
            "retrieval_latency_ms": round(self.retrieval_latency_ms, 2),
        }


# =============================================================================
# BM25 IMPLEMENTATION
# =============================================================================

class BM25Index:
    """
    In-memory BM25 index for keyword search.
    
    BM25 is particularly effective for medical literature where:
    - Exact term matching is important (drug names, conditions)
    - Medical abbreviations need precise matching
    - Rare disease names benefit from IDF weighting
    """
    
    def __init__(self, k1: float = BM25_K1, b: float = BM25_B):
        self.k1 = k1
        self.b = b
        
        # Index structures
        self.documents: Dict[str, Dict[str, Any]] = {}  # id -> document
        self.term_freqs: Dict[str, Dict[str, int]] = {}  # term -> {doc_id: freq}
        self.doc_lengths: Dict[str, int] = {}  # doc_id -> length
        self.avg_doc_length: float = 0.0
        self.num_docs: int = 0
        self.doc_term_freqs: Dict[str, Dict[str, int]] = {}  # doc_id -> {term: freq}
        
        # Medical stop words (less aggressive than general stop words)
        self.stop_words = {
            "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will", "would",
        }
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for BM25 indexing."""
        if not text:
            return []
        
        # Convert to lowercase
        text = text.lower()
        
        # Replace hyphens with spaces for term separation
        text = text.replace("-", " ")
        
        # Remove punctuation except alphanumeric and spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Split into tokens
        tokens = text.split()
        
        # Filter short tokens and stop words
        tokens = [t for t in tokens if len(t) > 1 and t not in self.stop_words]
        
        return tokens
    
    def add_document(
        self,
        doc_id: str,
        title: str,
        abstract: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add a document to the BM25 index."""
        # Combine title and abstract
        full_text = f"{title} {abstract}"
        tokens = self._tokenize(full_text)
        
        # Store document
        self.documents[doc_id] = {
            "id": doc_id,
            "title": title,
            "abstract": abstract,
            "metadata": metadata or {},
            "tokens": tokens,
        }
        
        # Calculate term frequencies for this document
        term_freq = defaultdict(int)
        for token in tokens:
            term_freq[token] += 1
        
        self.doc_term_freqs[doc_id] = dict(term_freq)
        self.doc_lengths[doc_id] = len(tokens)
        
        # Update inverted index
        for term, freq in term_freq.items():
            if term not in self.term_freqs:
                self.term_freqs[term] = {}
            self.term_freqs[term][doc_id] = freq
        
        # Update statistics
        self.num_docs = len(self.documents)
        total_length = sum(self.doc_lengths.values())
        self.avg_doc_length = total_length / self.num_docs if self.num_docs > 0 else 0
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove a document from the index."""
        if doc_id not in self.documents:
            return False
        
        # Remove from inverted index
        for term in self.doc_term_freqs.get(doc_id, {}):
            if term in self.term_freqs and doc_id in self.term_freqs[term]:
                del self.term_freqs[term][doc_id]
        
        # Remove document data
        del self.documents[doc_id]
        del self.doc_term_freqs[doc_id]
        del self.doc_lengths[doc_id]
        
        # Update statistics
        self.num_docs = len(self.documents)
        if self.num_docs > 0:
            self.avg_doc_length = sum(self.doc_lengths.values()) / self.num_docs
        else:
            self.avg_doc_length = 0
        
        return True
    
    def search(
        self,
        query: str,
        top_k: int = 50,
        min_score: float = 0.0,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """
        Search the BM25 index for relevant documents.
        
        Returns:
            List of (doc_id, score, metadata) tuples
        """
        if not query or self.num_docs == 0:
            return []
        
        # Tokenize query
        query_tokens = self._tokenize(query)
        
        # Expand query with synonyms
        expanded_tokens = set(query_tokens)
        for token in query_tokens:
            if token in MEDICAL_SYNONYMS:
                expanded_tokens.update(MEDICAL_SYNONYMS[token][:2])  # Limit expansions
        
        # Calculate BM25 scores
        scores: Dict[str, float] = defaultdict(float)
        
        for term in expanded_tokens:
            if term not in self.term_freqs:
                continue
            
            # Calculate IDF
            doc_freq = len(self.term_freqs[term])
            idf = math.log((self.num_docs - doc_freq + 0.5) / (doc_freq + 0.5) + 1)
            
            # Calculate term score for each document containing the term
            for doc_id, tf in self.term_freqs[term].items():
                doc_length = self.doc_lengths.get(doc_id, self.avg_doc_length)
                
                # BM25 formula
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (
                    1 - self.b + self.b * (doc_length / self.avg_doc_length)
                )
                score = idf * (numerator / denominator)
                
                scores[doc_id] += score
        
        # Sort by score
        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        # Format results
        results = []
        for doc_id, score in sorted_results[:top_k]:
            if score >= min_score:
                doc = self.documents.get(doc_id, {})
                results.append((
                    doc_id,
                    score,
                    {
                        "title": doc.get("title", ""),
                        "abstract": doc.get("abstract", ""),
                        "metadata": doc.get("metadata", {}),
                    }
                ))
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        return {
            "num_documents": self.num_docs,
            "num_unique_terms": len(self.term_freqs),
            "avg_doc_length": round(self.avg_doc_length, 2),
            "total_tokens": sum(self.doc_lengths.values()),
        }
    
    def clear(self) -> None:
        """Clear the entire index."""
        self.documents.clear()
        self.term_freqs.clear()
        self.doc_lengths.clear()
        self.doc_term_freqs.clear()
        self.num_docs = 0
        self.avg_doc_length = 0


# =============================================================================
# RECIPROCAL RANK FUSION
# =============================================================================

class ReciprocalRankFusion:
    """
    Reciprocal Rank Fusion (RRF) for combining multiple retrieval results.
    
    RRF formula: RRF(d) = Σ 1/(k + rank(d))
    
    Where:
    - d is a document
    - k is a constant (typically 60)
    - rank(d) is the rank of document d in a result list
    """
    
    def __init__(self, k: int = RRF_K):
        self.k = k
    
    def fuse(
        self,
        result_lists: List[List[Tuple[str, float, Dict[str, Any]]]],
        weights: Optional[List[float]] = None,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """
        Fuse multiple ranked result lists using RRF.
        
        Args:
            result_lists: List of ranked result lists [(doc_id, score, metadata), ...]
            weights: Optional weights for each result list
            
        Returns:
            Fused and re-ranked result list
        """
        if not result_lists:
            return []
        
        if weights is None:
            weights = [1.0] * len(result_lists)
        
        # Normalize weights
        total_weight = sum(weights)
        weights = [w / total_weight for w in weights]
        
        # Calculate RRF scores
        rrf_scores: Dict[str, float] = defaultdict(float)
        doc_metadata: Dict[str, Dict[str, Any]] = {}
        doc_scores: Dict[str, Dict[str, float]] = defaultdict(dict)
        
        for list_idx, (result_list, weight) in enumerate(zip(result_lists, weights)):
            for rank, (doc_id, score, metadata) in enumerate(result_list, 1):
                # RRF formula with weight
                rrf_contribution = weight / (self.k + rank)
                rrf_scores[doc_id] += rrf_contribution
                
                # Store metadata (prefer first occurrence or higher scoring one)
                if doc_id not in doc_metadata or score > doc_metadata[doc_id].get("_score", 0):
                    doc_metadata[doc_id] = {**metadata, "_score": score}
                
                # Store individual scores
                doc_scores[doc_id][f"list_{list_idx}"] = score
        
        # Sort by RRF score
        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Format results
        fused_results = []
        for doc_id, rrf_score in sorted_results:
            metadata = doc_metadata[doc_id]
            del metadata["_score"]  # Remove temporary field
            fused_results.append((doc_id, rrf_score, metadata))
        
        return fused_results


# =============================================================================
# RECENCY SCORER
# =============================================================================

class RecencyScorer:
    """
    Calculates recency-weighted scores for medical literature.
    
    Domain-specific decay rates:
    - infectious_disease: Fast decay (emerging pathogens)
    - oncology: Moderate-fast (new treatments frequently)
    - cardiology: Moderate (guidelines update regularly)
    """
    
    DOMAIN_DECAY_RATES = {
        "infectious_disease": 0.5,
        "oncology": 0.7,
        "cardiology": 0.8,
        "neurology": 0.9,
        "anatomy": 1.5,
        "physiology": 1.2,
        "default": 1.0,
    }
    
    def __init__(
        self,
        decay_years: float = RECENCY_DECAY_YEARS,
        min_score: float = RECENCY_MIN_SCORE,
    ):
        self.decay_years = decay_years
        self.min_score = min_score
    
    def calculate_score(
        self,
        publication_date: Optional[str],
        base_score: float,
        domain: Optional[str] = None,
    ) -> float:
        """Calculate recency-weighted score."""
        if not publication_date:
            return base_score * 0.7
        
        try:
            pub_date = datetime.strptime(publication_date[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            return base_score * 0.7
        
        # Calculate age in years
        age_days = (datetime.utcnow() - pub_date).days
        age_years = age_days / 365.25
        
        # Get domain-specific decay rate
        decay_rate = self.DOMAIN_DECAY_RATES.get(domain, self.DOMAIN_DECAY_RATES["default"])
        
        # Calculate recency factor with exponential decay
        recency_factor = math.exp(-age_years / (self.decay_years * decay_rate))
        
        # Apply minimum floor
        recency_factor = max(recency_factor, self.min_score)
        
        # Combine with base score
        weighted_score = base_score * recency_factor
        
        return weighted_score
    
    def get_recency_score(self, publication_date: Optional[str]) -> float:
        """Get just the recency score (0-1)."""
        if not publication_date:
            return 0.5
        
        try:
            pub_date = datetime.strptime(publication_date[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            return 0.5
        
        age_days = (datetime.utcnow() - pub_date).days
        age_years = age_days / 365.25
        
        recency_factor = math.exp(-age_years / self.decay_years)
        return max(recency_factor, self.min_score)


# =============================================================================
# QUERY EXPANDER
# =============================================================================

class QueryExpander:
    """
    Expands medical queries with synonyms and abbreviations.
    """
    
    @staticmethod
    def expand(query: str) -> Tuple[str, List[str]]:
        """
        Expand query with medical synonyms and abbreviations.
        
        Returns:
            (expanded_query, expansion_terms)
        """
        query_lower = query.lower()
        expansion_terms = []
        
        # Expand abbreviations
        for abbrev, full_form in MEDICAL_ABBREVIATIONS.items():
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            if re.search(pattern, query_lower):
                expansion_terms.append(full_form)
        
        # Add synonyms
        for term, synonyms in MEDICAL_SYNONYMS.items():
            if term in query_lower:
                expansion_terms.extend(synonyms[:2])
        
        # Build expanded query
        if expansion_terms:
            expanded = f"{query} {' '.join(set(expansion_terms))}"
        else:
            expanded = query
        
        return expanded, expansion_terms


# =============================================================================
# HYBRID RETRIEVAL ENGINE
# =============================================================================

class HybridRetrievalEngine:
    """
    Hybrid retrieval engine combining BM25 and semantic search.
    
    Architecture:
    1. Query Expansion (synonyms + abbreviations)
    2. Parallel Retrieval (BM25 + Semantic)
    3. Reciprocal Rank Fusion
    4. Recency Weighting
    5. Final Ranking
    
    This engine maintains compatibility with the cross-pipeline sync
    by preserving source_pipeline metadata.
    """
    
    def __init__(
        self,
        top_k: int = 50,
        min_score: float = 0.3,
        rrf_k: int = RRF_K,
        enable_bm25: bool = True,
        enable_expansion: bool = True,
    ):
        self.settings = get_settings()
        self.top_k = top_k
        self.min_score = min_score
        self.enable_bm25 = enable_bm25
        self.enable_expansion = enable_expansion
        
        # Components
        self.bm25_index = BM25Index()
        self.rrf = ReciprocalRankFusion(k=rrf_k)
        self.recency_scorer = RecencyScorer()
        self.query_expander = QueryExpander()
        
        # Pinecone connection (reuse existing)
        self._pinecone = None
        self._index = None
        self._initialized = False
        
        # Statistics
        self.stats = {
            "total_queries": 0,
            "total_results": 0,
            "avg_latency_ms": 0.0,
            "bm25_queries": 0,
            "semantic_queries": 0,
            "cache_hits": 0,
        }
    
    async def initialize(self):
        """Initialize the hybrid retrieval engine."""
        if self._initialized:
            return
        
        try:
            from pinecone import Pinecone
            
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            
            logger.info(f"Hybrid Retrieval Engine initialized")
            self._initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize hybrid engine: {e}")
            raise
    
    def index_document(
        self,
        doc_id: str,
        title: str,
        abstract: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add a document to the BM25 index."""
        self.bm25_index.add_document(doc_id, title, abstract, metadata)
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove a document from the BM25 index."""
        return self.bm25_index.remove_document(doc_id)
    
    async def retrieve(
        self,
        query: str,
        patient_context: Optional[Dict[str, Any]] = None,
        specialty: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> HybridContext:
        """
        Perform hybrid retrieval combining BM25 and semantic search.
        
        Args:
            query: Medical diagnostic query
            patient_context: Patient-specific context
            specialty: Medical specialty filter
            top_k: Number of results
            
        Returns:
            HybridContext with retrieval results
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        top_k = top_k or self.top_k
        
        # Step 1: Query Expansion
        expanded_query = query
        if self.enable_expansion:
            expanded_query, _ = self.query_expander.expand(query)
        
        # Step 2: Parallel Retrieval
        retrieval_start = time.time()
        
        # Run BM25 and Semantic retrievals in parallel
        bm25_task = self._bm25_search(expanded_query, top_k * 2) if self.enable_bm25 else asyncio.sleep(0)
        semantic_task = self._semantic_search(expanded_query, top_k * 2)
        
        if self.enable_bm25:
            bm25_results, semantic_results = await asyncio.gather(
                bm25_task, semantic_task, return_exceptions=True
            )
            if isinstance(bm25_results, Exception):
                logger.warning(f"BM25 search failed: {bm25_results}")
                bm25_results = []
            if isinstance(semantic_results, Exception):
                logger.warning(f"Semantic search failed: {semantic_results}")
                semantic_results = []
        else:
            bm25_results = []
            semantic_results = await semantic_task
        
        retrieval_latency = (time.time() - retrieval_start) * 1000
        
        # Step 3: Reciprocal Rank Fusion
        fusion_start = time.time()
        
        # Apply RRF
        fused_results = self.rrf.fuse(
            [bm25_results, semantic_results],
            weights=[0.35, 0.65],  # Slightly prefer semantic for medical
        )
        
        fusion_latency = (time.time() - fusion_start) * 1000
        
        # Step 4: Recency Weighting and Final Formatting
        final_results: List[HybridResult] = []
        seen_ids: Set[str] = set()
        
        for doc_id, rrf_score, metadata in fused_results:
            if doc_id in seen_ids:
                continue
            seen_ids.add(doc_id)
            
            pub_date = metadata.get("publication_date") or metadata.get("metadata", {}).get("pub_date")
            
            # Calculate recency score
            recency_score = self.recency_scorer.get_recency_score(pub_date)
            
            # Calculate final score
            final_score = rrf_score * (0.85 + 0.15 * recency_score)
            
            if final_score < self.min_score:
                continue
            
            # Extract individual scores
            bm25_score = metadata.get("_bm25_score", 0)
            semantic_score = metadata.get("_semantic_score", 0)
            
            result = HybridResult(
                id=doc_id,
                pmid=metadata.get("pmid") or metadata.get("metadata", {}).get("pmid", ""),
                title=metadata.get("title") or metadata.get("metadata", {}).get("title", ""),
                abstract=metadata.get("abstract") or metadata.get("metadata", {}).get("abstract", ""),
                semantic_score=semantic_score,
                bm25_score=bm25_score,
                rrf_score=rrf_score,
                recency_score=recency_score,
                final_score=final_score,
                journal=metadata.get("journal") or metadata.get("metadata", {}).get("journal", ""),
                publication_date=pub_date,
                authors=metadata.get("authors") or metadata.get("metadata", {}).get("authors", []),
                mesh_terms=metadata.get("mesh_terms") or metadata.get("metadata", {}).get("mesh_terms", []),
                doi=metadata.get("doi") or metadata.get("metadata", {}).get("doi"),
                source_pipeline=metadata.get("source_pipeline", "medical_rag"),
            )
            
            final_results.append(result)
            
            if len(final_results) >= top_k:
                break
        
        # Sort by final score
        final_results.sort(key=lambda r: r.final_score, reverse=True)
        final_results = final_results[:top_k]
        
        # Update stats
        self.stats["total_queries"] += 1
        self.stats["total_results"] += len(final_results)
        latency = (time.time() - start_time) * 1000
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (self.stats["total_queries"] - 1) + latency)
            / self.stats["total_queries"]
        )
        
        return HybridContext(
            query=query,
            expanded_query=expanded_query if expanded_query != query else None,
            results=final_results,
            total_semantic_results=len(semantic_results),
            total_bm25_results=len(bm25_results),
            fusion_latency_ms=fusion_latency,
            retrieval_latency_ms=retrieval_latency,
        )
    
    async def _bm25_search(
        self,
        query: str,
        top_k: int,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """Perform BM25 keyword search."""
        results = self.bm25_index.search(query, top_k)
        
        # Add BM25 score marker to metadata
        return [
            (doc_id, score, {**metadata, "_bm25_score": score})
            for doc_id, score, metadata in results
        ]
    
    async def _semantic_search(
        self,
        query: str,
        top_k: int,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """Perform semantic vector search using Pinecone."""
        if self._index is None:
            await self.initialize()
        
        try:
            # Generate query embedding
            from app.embedding.pubmedbert_embeddings import get_pubmedbert_service
            
            service = await get_pubmedbert_service()
            embedding_result = await service.embed(query)
            query_embedding = embedding_result.embedding
            
            # Query Pinecone
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._index.query(
                    vector=query_embedding,
                    top_k=top_k,
                    namespace=self.settings.PINECONE_NAMESPACE,
                    include_metadata=True,
                )
            )
            
            # Parse results
            results = []
            for match in response.matches:
                metadata = match.metadata or {}
                
                # Parse JSON strings
                for key in ["mesh_terms", "authors"]:
                    if key in metadata and isinstance(metadata[key], str):
                        try:
                            metadata[key] = json.loads(metadata[key])
                        except:
                            metadata[key] = []
                
                results.append((
                    match.id,
                    match.score,
                    {
                        **metadata,
                        "_semantic_score": match.score,
                    }
                ))
            
            self.stats["semantic_queries"] += 1
            return results
            
        except Exception as e:
            logger.error(f"Semantic search error: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval statistics."""
        return {
            **self.stats,
            "bm25_index_stats": self.bm25_index.get_stats(),
        }
    
    def clear_bm25_index(self) -> None:
        """Clear the BM25 index."""
        self.bm25_index.clear()


# =============================================================================
# SINGLETON
# =============================================================================

_hybrid_engine: Optional[HybridRetrievalEngine] = None


async def get_hybrid_retrieval_engine() -> HybridRetrievalEngine:
    """Get or create hybrid retrieval engine singleton."""
    global _hybrid_engine
    
    if _hybrid_engine is None:
        _hybrid_engine = HybridRetrievalEngine()
        await _hybrid_engine.initialize()
    
    return _hybrid_engine
