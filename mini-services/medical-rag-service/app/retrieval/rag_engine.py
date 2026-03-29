"""
RAG Retrieval Engine for Medical Diagnostics
============================================

Combines PubMedBERT embeddings with Pinecone vector search
for medical literature retrieval.
"""

import asyncio
import time
import json
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from loguru import logger

from app.core.config import get_settings


# ===== Constants =====

DEFAULT_TOP_K = 50
MAX_CONTEXT_TOKENS = 8000
MIN_RELEVANCE_SCORE = 0.5
EMBEDDING_DIMENSION = 768


@dataclass
class RetrievedArticle:
    """A retrieved article with relevance scoring."""
    id: str
    pmid: str
    title: str
    abstract: str
    score: float
    rerank_score: float = 0.0
    journal: str = ""
    publication_date: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    pmc_id: Optional[str] = None
    section_type: str = "abstract"
    source_type: str = "PubMed"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract[:500],
            "score": round(self.score, 4),
            "rerank_score": round(self.rerank_score, 4),
            "journal": self.journal,
            "publication_date": self.publication_date,
            "authors": self.authors[:5],
            "mesh_terms": self.mesh_terms[:5],
            "doi": self.doi,
            "pmc_id": self.pmc_id,
            "section_type": self.section_type,
            "source_type": self.source_type,
        }


@dataclass
class RAGContext:
    """Assembled context for LLM prompt."""
    query: str
    expanded_query: Optional[str]
    articles: List[RetrievedArticle]
    context_text: str
    total_tokens: int
    total_score: float
    retrieval_latency_ms: float
    rerank_latency_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "expanded_query": self.expanded_query,
            "articles": [a.to_dict() for a in self.articles],
            "context_text": self.context_text[:2000],
            "total_tokens": self.total_tokens,
            "total_score": round(self.total_score, 4),
            "retrieval_latency_ms": round(self.retrieval_latency_ms, 2),
            "rerank_latency_ms": round(self.rerank_latency_ms, 2),
        }


class RAGRetrievalEngine:
    """
    Main RAG retrieval engine for medical diagnostics.
    
    Features:
    - Query embedding
    - Pinecone vector search
    - Re-ranking by relevance + recency
    - Context assembly
    """
    
    def __init__(
        self,
        top_k: int = DEFAULT_TOP_K,
        min_score: float = MIN_RELEVANCE_SCORE,
    ):
        self.settings = get_settings()
        self.top_k = top_k
        self.min_score = min_score
        
        self._pinecone = None
        self._index = None
        self._initialized = False
        
        self.stats = {
            "total_queries": 0,
            "total_articles": 0,
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
            
            logger.info(f"RAG Engine connected to Pinecone index: {self.settings.PINECONE_INDEX_NAME}")
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG engine: {e}")
            raise
    
    async def retrieve(
        self,
        query: str,
        patient_context: Optional[Dict[str, Any]] = None,
        specialty: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> RAGContext:
        """
        Retrieve relevant medical literature.
        
        Args:
            query: Medical diagnostic query
            patient_context: Patient-specific context
            specialty: Medical specialty filter
            top_k: Number of results
        
        Returns:
            RAGContext with retrieved articles
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        top_k = top_k or self.top_k
        
        # Generate query embedding (simplified for demo)
        query_embedding = await self._generate_embedding(query)
        
        # Search Pinecone
        retrieval_start = time.time()
        articles = await self._search_pinecone(query_embedding, top_k)
        retrieval_latency = (time.time() - retrieval_start) * 1000
        
        # Re-rank results
        rerank_start = time.time()
        articles = self._rerank(articles)
        rerank_latency = (time.time() - rerank_start) * 1000
        
        # Assemble context
        context_text, total_tokens = self._assemble_context(articles)
        
        # Calculate total score
        total_score = sum(a.rerank_score for a in articles) / max(len(articles), 1)
        
        # Update stats
        self.stats["total_queries"] += 1
        self.stats["total_articles"] += len(articles)
        latency = (time.time() - start_time) * 1000
        self.stats["avg_latency_ms"] = (
            (self.stats["avg_latency_ms"] * (self.stats["total_queries"] - 1) + latency)
            / self.stats["total_queries"]
        )
        
        return RAGContext(
            query=query,
            expanded_query=None,
            articles=articles,
            context_text=context_text,
            total_tokens=total_tokens,
            total_score=total_score,
            retrieval_latency_ms=retrieval_latency,
            rerank_latency_ms=rerank_latency,
        )
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for query text using PubMedBERT."""
        # Use the new PubMedBERT embedding service
        from app.embedding.pubmedbert_embeddings import get_pubmedbert_service
        
        # Get embedding service (will reuse cached model)
        service = await get_pubmedbert_service()
        result = await service.embed(text)
        
        return result.embedding
    
    async def _search_pinecone(
        self,
        query_embedding: List[float],
        top_k: int,
    ) -> List[RetrievedArticle]:
        """Search Pinecone for similar vectors."""
        if self._index is None:
            await self.initialize()
        
        try:
            # Build filter - no date restriction for broader results
            filter_dict = None
            
            # Execute query
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
            articles = []
            for match in response.matches:
                if match.score < self.min_score:
                    continue
                
                metadata = match.metadata or {}
                
                # Parse JSON strings
                for key in ["mesh_terms", "authors"]:
                    if key in metadata and isinstance(metadata[key], str):
                        try:
                            metadata[key] = json.loads(metadata[key])
                        except:
                            metadata[key] = []
                
                article = RetrievedArticle(
                    id=match.id,
                    pmid=metadata.get("pmid", ""),
                    title=metadata.get("title", ""),
                    abstract=metadata.get("abstract", ""),
                    score=match.score,
                    rerank_score=match.score,
                    journal=metadata.get("journal", ""),
                    publication_date=metadata.get("pub_date"),
                    authors=metadata.get("authors", []),
                    mesh_terms=metadata.get("mesh_terms", []),
                    doi=metadata.get("doi"),
                    pmc_id=metadata.get("pmcid"),
                )
                
                articles.append(article)
            
            return articles
            
        except Exception as e:
            logger.error(f"Pinecone search error: {e}")
            return []
    
    def _rerank(self, articles: List[RetrievedArticle]) -> List[RetrievedArticle]:
        """Re-rank articles by relevance and recency."""
        for article in articles:
            # Calculate recency score
            recency_score = 0.5
            if article.publication_date:
                try:
                    pub_date = datetime.strptime(article.publication_date[:10], "%Y-%m-%d")
                    days_old = (datetime.utcnow() - pub_date).days
                    recency_score = max(0, 1 - (days_old / 3650))  # Decay over 10 years
                except:
                    pass
            
            # Combined score
            article.rerank_score = 0.8 * article.score + 0.2 * recency_score
        
        # Sort by rerank score
        articles.sort(key=lambda a: a.rerank_score, reverse=True)
        
        return articles
    
    def _assemble_context(
        self,
        articles: List[RetrievedArticle],
        max_tokens: int = MAX_CONTEXT_TOKENS,
    ) -> Tuple[str, int]:
        """Assemble context from articles."""
        context_parts = []
        total_tokens = 0
        seen_pmids = set()
        
        for i, article in enumerate(articles, 1):
            if article.pmid in seen_pmids:
                continue
            seen_pmids.add(article.pmid)
            
            article_text = f"[{i}] PMID: {article.pmid}\n"
            article_text += f"Title: {article.title}\n"
            if article.abstract:
                article_text += f"Abstract: {article.abstract[:300]}...\n"
            
            article_tokens = len(article_text.split()) * 1.3
            
            if total_tokens + article_tokens > max_tokens:
                break
            
            context_parts.append(article_text)
            total_tokens += article_tokens
        
        return "\n\n---\n\n".join(context_parts), int(total_tokens)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval statistics."""
        return self.stats
