"""
P1: Hybrid Retrieval Engine for Medical RAG
============================================

Implements BM25 + Semantic hybrid search with Reciprocal Rank Fusion (RRF).

Architecture Context:
- Medical RAG (Port 3031): PRIMARY diagnostic engine - gets full P1 features
- LangChain RAG (Port 3032): SECONDARY with fallback chain - syncs BM25 index

Key Features:
1. BM25 Keyword Search with medical synonym support
2. Reciprocal Rank Fusion (RRF) for combining results
3. Recency-Weighted Scoring with domain-specific decay
4. Query Expansion with medical abbreviations
"""

import asyncio
import math
import re
import time
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
from loguru import logger

from app.core.config import get_settings


# =============================================================================
# CONSTANTS & CONFIGURATION
# =============================================================================

# BM25 Parameters (optimized for medical domain)
BM25_K1 = 1.5          # Term frequency saturation parameter
BM25_B = 0.75          # Document length normalization
BM25_EPSILON = 0.25    # Floor for IDF scores

# RRF Parameters
RRF_K = 60             # RRF constant (standard value)
BM25_WEIGHT = 0.35     # Weight for BM25 results
SEMANTIC_WEIGHT = 0.65 # Weight for semantic results (medical domain prefers semantic)
RECENCY_WEIGHT = 0.15  # Recency adjustment weight

# Recency Decay Rates (days) - Domain-specific
RECENCY_DECAY_RATES = {
    "guidelines": 730,        # 2 years - guidelines change slowly
    "clinical_trials": 365,   # 1 year - clinical trial data
    "case_reports": 1825,     # 5 years - historical value
    "systematic_reviews": 730, # 2 years
    "general": 1095,          # 3 years default
}

# Medical Abbreviations for Query Expansion
MEDICAL_ABBREVIATIONS = {
    "mi": "myocardial infarction",
    "chf": "congestive heart failure",
    "cad": "coronary artery disease",
    "afib": "atrial fibrillation",
    "copd": "chronic obstructive pulmonary disease",
    "dm": "diabetes mellitus",
    "htn": "hypertension",
    "ckd": "chronic kidney disease",
    "esrd": "end stage renal disease",
    "t2dm": "type 2 diabetes mellitus",
    "t1dm": "type 1 diabetes mellitus",
    "cabg": "coronary artery bypass graft",
    "pci": "percutaneous coronary intervention",
    "pe": "pulmonary embolism",
    "dvt": "deep vein thrombosis",
    "cva": "cerebrovascular accident",
    "tia": "transient ischemic attack",
    "saH": "subarachnoid hemorrhage",
    "sdh": "subdural hematoma",
    "edh": "epidural hematoma",
    "ich": "intracerebral hemorrhage",
    "aki": "acute kidney injury",
    "uti": "urinary tract infection",
    "cap": "community acquired pneumonia",
    "hap": "hospital acquired pneumonia",
    "vap": "ventilator associated pneumonia",
    "sepsis": "sepsis septic",
    "ar ds": "acute respiratory distress syndrome",
    "ards": "acute respiratory distress syndrome",
    "ami": "acute myocardial infarction",
    "stemi": "st elevation myocardial infarction",
    "nstemi": "non st elevation myocardial infarction",
    "ua": "unstable angina",
    "hf": "heart failure",
    "hfref": "heart failure reduced ejection fraction",
    "hfpef": "heart failure preserved ejection fraction",
    "af": "atrial fibrillation",
    "vte": "venous thromboembolism",
    "pad": "peripheral arterial disease",
    "taa": "thoracic aortic aneurysm",
    "aaa": "abdominal aortic aneurysm",
    "tbi": "traumatic brain injury",
    "saH": "subarachnoid hemorrhage",
    "ms": "multiple sclerosis",
    "pd": "parkinson disease",
    "ad": "alzheimer disease",
    "als": "amyotrophic lateral sclerosis",
    "gbm": "glioblastoma multiforme",
    "nsclc": "non small cell lung cancer",
    "sclc": "small cell lung cancer",
    "crc": "colorectal cancer",
    "hcc": "hepatocellular carcinoma",
    "rcc": "renal cell carcinoma",
    "tcc": "transitional cell carcinoma",
    "dlbcl": "diffuse large b cell lymphoma",
    "hl": "hodgkin lymphoma",
    "nhl": "non hodgkin lymphoma",
    "mm": "multiple myeloma",
    "aml": "acute myeloid leukemia",
    "all": "acute lymphoblastic leukemia",
    "cll": "chronic lymphocytic leukemia",
    "cml": "chronic myeloid leukemia",
    "mcl": "mantle cell lymphoma",
    "fl": "follicular lymphoma",
    "ibd": "inflammatory bowel disease",
    "cd": "crohn disease",
    "uc": "ulcerative colitis",
    "gerd": "gastroesophageal reflux disease",
    "pud": "peptic ulcer disease",
    "nafld": "nonalcoholic fatty liver disease",
    "nash": "nonalcoholic steatohepatitis",
    "pbc": "primary biliary cholangitis",
    "psc": "primary sclerosing cholangitis",
    "ra": "rheumatoid arthritis",
    "sle": "systemic lupus erythematosus",
    "ss": "sjogren syndrome",
    "ssc": "systemic sclerosis",
    "dm pm": "dermatomyositis polymyositis",
    "pso": "psoriatic arthritis",
    "as": "ankylosing spondylitis",
    "gca": "giant cell arteritis",
    "pmr": "polymyalgia rheumatica",
}

# Medical Synonyms for Query Expansion
MEDICAL_SYNONYMS = {
    "heart attack": ["myocardial infarction", "mi", "cardiac infarction"],
    "stroke": ["cerebrovascular accident", "cva", "brain attack"],
    "high blood pressure": ["hypertension", "htn", "elevated blood pressure"],
    "low blood pressure": ["hypotension", "low bp"],
    "heart failure": ["cardiac failure", "chf", "congestive heart failure"],
    "diabetes": ["diabetes mellitus", "dm", "high blood sugar"],
    "cancer": ["malignancy", "neoplasm", "tumor", "carcinoma"],
    "kidney failure": ["renal failure", "esrd", "end stage renal disease", "kidney disease"],
    "lung disease": ["pulmonary disease", "respiratory disease"],
    "liver disease": ["hepatic disease", "liver dysfunction"],
    "blood clot": ["thrombus", "thrombosis", "embolism"],
    "infection": ["infectious disease", "bacterial infection", "viral infection"],
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class BM25Document:
    """Document in BM25 index."""
    doc_id: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    term_freqs: Dict[str, int] = field(default_factory=dict)
    doc_length: int = 0
    
    def __post_init__(self):
        if not self.term_freqs:
            self.term_freqs = self._compute_term_freqs()
        if not self.doc_length:
            self.doc_length = len(self.content.split())


@dataclass
class HybridResult:
    """Result from hybrid retrieval."""
    doc_id: str
    pmid: str
    title: str
    abstract: str
    bm25_score: float = 0.0
    semantic_score: float = 0.0
    rrf_score: float = 0.0
    final_score: float = 0.0
    recency_score: float = 0.5
    publication_date: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract[:500],
            "bm25_score": round(self.bm25_score, 4),
            "semantic_score": round(self.semantic_score, 4),
            "rrf_score": round(self.rrf_score, 4),
            "final_score": round(self.final_score, 4),
            "recency_score": round(self.recency_score, 4),
            "publication_date": self.publication_date,
        }


@dataclass
class HybridSearchResult:
    """Complete hybrid search result."""
    query: str
    expanded_query: Optional[str]
    results: List[HybridResult] = field(default_factory=list)
    total_results: int = 0
    bm25_latency_ms: float = 0.0
    semantic_latency_ms: float = 0.0
    fusion_latency_ms: float = 0.0
    total_latency_ms: float = 0.0
    bm25_docs_count: int = 0
    semantic_docs_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "expanded_query": self.expanded_query,
            "results": [r.to_dict() for r in self.results],
            "total_results": self.total_results,
            "latency_ms": {
                "bm25": round(self.bm25_latency_ms, 2),
                "semantic": round(self.semantic_latency_ms, 2),
                "fusion": round(self.fusion_latency_ms, 2),
                "total": round(self.total_latency_ms, 2),
            },
            "bm25_docs_count": self.bm25_docs_count,
            "semantic_docs_count": self.semantic_docs_count,
        }


# =============================================================================
# BM25 ENGINE
# =============================================================================

class BM25Engine:
    """
    BM25 ranking engine optimized for medical text.
    
    Features:
    - Medical term tokenization
    - Document frequency caching
    - Query expansion with medical synonyms
    """
    
    def __init__(
        self,
        k1: float = BM25_K1,
        b: float = BM25_B,
        epsilon: float = BM25_EPSILON,
    ):
        self.k1 = k1
        self.b = b
        self.epsilon = epsilon
        
        # Index structures
        self.documents: Dict[str, BM25Document] = {}
        self.inverted_index: Dict[str, Set[str]] = defaultdict(set)
        self.doc_freqs: Dict[str, int] = defaultdict(int)
        self.avg_doc_length: float = 0.0
        self.total_docs: int = 0
        
        # Statistics
        self.stats = {
            "total_indexed": 0,
            "total_queries": 0,
            "avg_query_time_ms": 0.0,
        }
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for BM25 with medical awareness."""
        # Lowercase
        text = text.lower()
        
        # Expand abbreviations before tokenization
        for abbr, expansion in MEDICAL_ABBREVIATIONS.items():
            if abbr in text:
                text = text.replace(abbr, expansion)
        
        # Remove special characters but keep hyphens in medical terms
        text = re.sub(r'[^a-z0-9\s\-]', ' ', text)
        
        # Split into tokens
        tokens = text.split()
        
        # Filter very short tokens
        tokens = [t for t in tokens if len(t) > 1]
        
        return tokens
    
    def add_document(self, doc_id: str, content: str, metadata: Dict[str, Any] = None):
        """Add a document to the BM25 index."""
        tokens = self._tokenize(content)
        term_freqs = defaultdict(int)
        
        for token in tokens:
            term_freqs[token] += 1
            self.inverted_index[token].add(doc_id)
        
        doc = BM25Document(
            doc_id=doc_id,
            content=content,
            metadata=metadata or {},
            term_freqs=dict(term_freqs),
            doc_length=len(tokens),
        )
        
        self.documents[doc_id] = doc
        self.total_docs += 1
        
        # Update document frequencies
        for token in term_freqs:
            self.doc_freqs[token] += 1
        
        # Update average document length
        old_avg = self.avg_doc_length
        self.avg_doc_length = (old_avg * (self.total_docs - 1) + len(tokens)) / self.total_docs
        
        self.stats["total_indexed"] += 1
    
    def remove_document(self, doc_id: str):
        """Remove a document from the index."""
        if doc_id not in self.documents:
            return
        
        doc = self.documents[doc_id]
        
        # Update inverted index and doc frequencies
        for token in doc.term_freqs:
            self.inverted_index[token].discard(doc_id)
            self.doc_freqs[token] = max(0, self.doc_freqs[token] - 1)
        
        del self.documents[doc_id]
        self.total_docs -= 1
        
        # Recalculate average doc length
        if self.total_docs > 0:
            total_length = sum(d.doc_length for d in self.documents.values())
            self.avg_doc_length = total_length / self.total_docs
        else:
            self.avg_doc_length = 0.0
    
    def search(self, query: str, top_k: int = 50) -> List[Tuple[str, float]]:
        """
        Search the BM25 index.
        
        Returns:
            List of (doc_id, score) tuples sorted by score descending
        """
        start_time = time.time()
        
        query_tokens = self._tokenize(query)
        
        # Expand query with synonyms
        expanded_tokens = set(query_tokens)
        for token in query_tokens:
            if token in MEDICAL_SYNONYMS:
                expanded_tokens.update(MEDICAL_SYNONYMS[token])
        
        # Score documents
        scores: Dict[str, float] = defaultdict(float)
        
        for token in expanded_tokens:
            if token not in self.doc_freqs:
                continue
            
            # IDF calculation
            df = self.doc_freqs[token]
            idf = math.log((self.total_docs - df + 0.5) / (df + 0.5) + 1)
            idf = max(self.epsilon, idf)  # Floor for negative IDFs
            
            # Score each document containing the term
            for doc_id in self.inverted_index.get(token, set()):
                doc = self.documents.get(doc_id)
                if not doc:
                    continue
                
                tf = doc.term_freqs.get(token, 0)
                if tf == 0:
                    continue
                
                # BM25 scoring
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc.doc_length / self.avg_doc_length)
                scores[doc_id] += idf * numerator / denominator
        
        # Sort and return top-k
        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        # Update stats
        latency = (time.time() - start_time) * 1000
        self.stats["total_queries"] += 1
        self.stats["avg_query_time_ms"] = (
            (self.stats["avg_query_time_ms"] * (self.stats["total_queries"] - 1) + latency)
            / self.stats["total_queries"]
        )
        
        return sorted_results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get BM25 index statistics."""
        return {
            **self.stats,
            "total_documents": self.total_docs,
            "vocabulary_size": len(self.doc_freqs),
            "avg_doc_length": round(self.avg_doc_length, 2),
        }
    
    def clear(self):
        """Clear the entire index."""
        self.documents.clear()
        self.inverted_index.clear()
        self.doc_freqs.clear()
        self.total_docs = 0
        self.avg_doc_length = 0.0


# =============================================================================
# HYBRID RETRIEVAL ENGINE
# =============================================================================

class HybridRetrievalEngine:
    """
    P1: Hybrid Retrieval Engine combining BM25 + Semantic search with RRF.
    
    Architecture:
    - Medical RAG (Port 3031): Primary service with full P1 features
    - LangChain RAG (Port 3032): Secondary service, syncs BM25 index
    """
    
    def __init__(
        self,
        bm25_weight: float = BM25_WEIGHT,
        semantic_weight: float = SEMANTIC_WEIGHT,
        recency_weight: float = RECENCY_WEIGHT,
        rrf_k: int = RRF_K,
    ):
        self.settings = get_settings()
        self.bm25_weight = bm25_weight
        self.semantic_weight = semantic_weight
        self.recency_weight = recency_weight
        self.rrf_k = rrf_k
        
        self.bm25 = BM25Engine()
        self._pinecone = None
        self._index = None
        self._initialized = False
        
        self.stats = {
            "total_queries": 0,
            "bm25_queries": 0,
            "semantic_queries": 0,
            "hybrid_queries": 0,
            "avg_latency_ms": 0.0,
        }
    
    async def initialize(self):
        """Initialize Pinecone connection."""
        if self._initialized:
            return
        
        try:
            from pinecone import Pinecone
            
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
            self._initialized = True
            
            logger.info(f"[HybridRetrieval] Connected to Pinecone: {self.settings.PINECONE_INDEX_NAME}")
            
        except Exception as e:
            logger.error(f"[HybridRetrieval] Failed to initialize: {e}")
            raise
    
    def _calculate_recency_score(
        self,
        publication_date: Optional[str],
        publication_type: str = "general",
    ) -> float:
        """
        Calculate recency score with domain-specific decay.
        
        Args:
            publication_date: Date string (YYYY-MM-DD)
            publication_type: Type of publication for decay rate
        
        Returns:
            Recency score (0.0 to 1.0)
        """
        if not publication_date:
            return 0.5  # Neutral score for unknown dates
        
        try:
            # Parse date
            pub_date = datetime.strptime(publication_date[:10], "%Y-%m-%d")
            days_old = (datetime.utcnow() - pub_date).days
            
            # Get decay rate
            decay_days = RECENCY_DECAY_RATES.get(publication_type, RECENCY_DECAY_RATES["general"])
            
            # Exponential decay
            score = math.exp(-days_old / decay_days)
            return max(0.0, min(1.0, score))
            
        except Exception:
            return 0.5
    
    def _reciprocal_rank_fusion(
        self,
        bm25_results: List[Tuple[str, float]],
        semantic_results: List[Tuple[str, float]],
        top_k: int = 50,
    ) -> Dict[str, float]:
        """
        Combine BM25 and semantic results using Reciprocal Rank Fusion.
        
        RRF Score = 1 / (k + rank)
        
        Args:
            bm25_results: List of (doc_id, score) from BM25
            semantic_results: List of (doc_id, score) from semantic search
            top_k: Number of results to return
        
        Returns:
            Dict mapping doc_id to RRF score
        """
        rrf_scores: Dict[str, float] = defaultdict(float)
        
        # BM25 contributions
        for rank, (doc_id, _) in enumerate(bm25_results, 1):
            rrf_scores[doc_id] += self.bm25_weight / (self.rrf_k + rank)
        
        # Semantic contributions
        for rank, (doc_id, _) in enumerate(semantic_results, 1):
            rrf_scores[doc_id] += self.semantic_weight / (self.rrf_k + rank)
        
        return dict(rrf_scores)
    
    async def sync_bm25_from_pinecone(self, max_docs: int = 10000) -> Dict[str, Any]:
        """
        Sync BM25 index from Pinecone vectors.
        
        This populates the BM25 index with documents from the vector database.
        """
        if not self._initialized:
            await self.initialize()
        
        start_time = time.time()
        synced = 0
        errors = 0
        
        try:
            # Use dummy vector to fetch all documents
            dummy_vector = [0.0] * self.settings.EMBEDDING_DIMENSION
            
            # Fetch in batches
            batch_size = 1000
            fetched_ids = set()
            
            while synced < max_docs:
                result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._index.query(
                        vector=dummy_vector,
                        top_k=min(batch_size, max_docs - synced),
                        namespace=self.settings.PINECONE_NAMESPACE,
                        include_metadata=True,
                    )
                )
                
                if not result.matches:
                    break
                
                for match in result.matches:
                    if match.id in fetched_ids:
                        continue
                    
                    fetched_ids.add(match.id)
                    metadata = match.metadata or {}
                    
                    # Build document content
                    content = metadata.get("title", "")
                    abstract = metadata.get("abstract", "")
                    if abstract:
                        content += " " + abstract
                    
                    if content.strip():
                        self.bm25.add_document(
                            doc_id=match.id,
                            content=content,
                            metadata=metadata,
                        )
                        synced += 1
                    
                    if synced >= max_docs:
                        break
                
                # Check if we've exhausted the index
                if len(result.matches) < batch_size:
                    break
            
            latency = (time.time() - start_time) * 1000
            
            logger.info(f"[HybridRetrieval] Synced {synced} documents to BM25 index in {latency:.2f}ms")
            
            return {
                "status": "success",
                "documents_synced": synced,
                "errors": errors,
                "latency_ms": round(latency, 2),
            }
            
        except Exception as e:
            logger.error(f"[HybridRetrieval] BM25 sync failed: {e}")
            return {
                "status": "error",
                "documents_synced": synced,
                "errors": errors + 1,
                "error_message": str(e),
            }
    
    async def hybrid_search(
        self,
        query: str,
        query_embedding: List[float],
        top_k: int = 50,
        min_score: float = 0.3,
        enable_expansion: bool = True,
    ) -> HybridSearchResult:
        """
        Perform hybrid search combining BM25 and semantic retrieval.
        
        Args:
            query: Query text
            query_embedding: Pre-computed query embedding
            top_k: Number of results to return
            min_score: Minimum score threshold
            enable_expansion: Enable query expansion
        
        Returns:
            HybridSearchResult with combined and ranked results
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        expanded_query = None
        
        # Step 1: BM25 Search
        bm25_start = time.time()
        bm25_results = self.bm25.search(query, top_k=top_k * 2)
        bm25_latency = (time.time() - bm25_start) * 1000
        
        # Step 2: Semantic Search
        semantic_start = time.time()
        semantic_results = await self._semantic_search(query_embedding, top_k * 2)
        semantic_latency = (time.time() - semantic_start) * 1000
        
        # Step 3: RRF Fusion
        fusion_start = time.time()
        rrf_scores = self._reciprocal_rank_fusion(bm25_results, semantic_results)
        fusion_latency = (time.time() - fusion_start) * 1000
        
        # Step 4: Build final results
        # Get all doc IDs from both searches
        all_doc_ids = set(doc_id for doc_id, _ in bm25_results) | set(doc_id for doc_id, _ in semantic_results)
        
        # Fetch metadata for all docs
        doc_metadata = await self._fetch_metadata(list(all_doc_ids))
        
        # Build result objects
        results = []
        bm25_scores = dict(bm25_results)
        semantic_scores = dict(semantic_results)
        
        for doc_id in all_doc_ids:
            rrf_score = rrf_scores.get(doc_id, 0.0)
            if rrf_score < min_score:
                continue
            
            metadata = doc_metadata.get(doc_id, {})
            
            result = HybridResult(
                doc_id=doc_id,
                pmid=metadata.get("pmid", ""),
                title=metadata.get("title", ""),
                abstract=metadata.get("abstract", ""),
                bm25_score=bm25_scores.get(doc_id, 0.0),
                semantic_score=semantic_scores.get(doc_id, 0.0),
                rrf_score=rrf_score,
                publication_date=metadata.get("pub_date") or metadata.get("publication_date"),
                metadata=metadata,
            )
            
            # Calculate recency score
            result.recency_score = self._calculate_recency_score(result.publication_date)
            
            # Calculate final score with recency
            result.final_score = rrf_score * (1 - self.recency_weight) + result.recency_score * self.recency_weight
            
            results.append(result)
        
        # Sort by final score
        results.sort(key=lambda x: x.final_score, reverse=True)
        results = results[:top_k]
        
        total_latency = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["total_queries"] += 1
        self.stats["hybrid_queries"] += 1
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (self.stats["total_queries"] - 1) + total_latency)
            / self.stats["total_queries"]
        )
        
        return HybridSearchResult(
            query=query,
            expanded_query=expanded_query,
            results=results,
            total_results=len(results),
            bm25_latency_ms=bm25_latency,
            semantic_latency_ms=semantic_latency,
            fusion_latency_ms=fusion_latency,
            total_latency_ms=total_latency,
            bm25_docs_count=len(bm25_results),
            semantic_docs_count=len(semantic_results),
        )
    
    async def _semantic_search(
        self,
        query_embedding: List[float],
        top_k: int,
    ) -> List[Tuple[str, float]]:
        """Perform semantic search using Pinecone."""
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.query(
                    vector=query_embedding,
                    top_k=top_k,
                    namespace=self.settings.PINECONE_NAMESPACE,
                    include_metadata=False,
                )
            )
            
            return [(match.id, match.score) for match in result.matches]
            
        except Exception as e:
            logger.error(f"[HybridRetrieval] Semantic search failed: {e}")
            return []
    
    async def _fetch_metadata(self, doc_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch metadata for documents from Pinecone."""
        if not doc_ids:
            return {}
        
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._index.fetch(
                    ids=doc_ids,
                    namespace=self.settings.PINECONE_NAMESPACE,
                )
            )
            
            return {
                doc_id: data.get("metadata", {})
                for doc_id, data in result.vectors.items()
            }
            
        except Exception as e:
            logger.error(f"[HybridRetrieval] Metadata fetch failed: {e}")
            return {}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get hybrid retrieval statistics."""
        return {
            **self.stats,
            "bm25_stats": self.bm25.get_stats(),
            "weights": {
                "bm25": self.bm25_weight,
                "semantic": self.semantic_weight,
                "recency": self.recency_weight,
            },
            "rrf_k": self.rrf_k,
        }
    
    def clear_bm25_index(self) -> Dict[str, Any]:
        """Clear the BM25 index."""
        count = self.bm25.total_docs
        self.bm25.clear()
        return {
            "status": "success",
            "documents_removed": count,
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_hybrid_engine: Optional[HybridRetrievalEngine] = None


def get_hybrid_engine() -> HybridRetrievalEngine:
    """Get or create hybrid retrieval engine singleton."""
    global _hybrid_engine
    
    if _hybrid_engine is None:
        _hybrid_engine = HybridRetrievalEngine()
    
    return _hybrid_engine
