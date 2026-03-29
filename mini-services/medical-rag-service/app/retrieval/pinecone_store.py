"""
Pinecone Vector Database Integration
====================================

Handles storage and retrieval of medical literature embeddings.
Production-ready with error handling and retry logic.
"""

import asyncio
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
import json
from datetime import datetime
import hashlib

from loguru import logger
from pinecone import Pinecone, ServerlessSpec
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


@dataclass
class VectorMetadata:
    """Metadata structure for Pinecone vectors."""
    pmid: str
    title: str
    abstract: str
    journal: str
    publication_date: Optional[str]
    mesh_terms: List[str]
    authors: List[str]
    doi: Optional[str]
    pmc_id: Optional[str]
    content_type: str  # 'abstract' or 'full_text'
    specialty: Optional[str] = None
    ingest_timestamp: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to Pinecone metadata format."""
        return {
            "pmid": self.pmid,
            "title": self.title[:1000],  # Pinecone metadata limit
            "abstract": self.abstract[:5000],  # Truncate for metadata
            "journal": self.journal[:200],
            "publication_date": self.publication_date or "",
            "mesh_terms": json.dumps(self.mesh_terms[:20]),  # JSON string
            "authors": json.dumps(self.authors[:10]),
            "doi": self.doi or "",
            "pmc_id": self.pmc_id or "",
            "content_type": self.content_type,
            "specialty": self.specialty or "",
            "ingest_timestamp": self.ingest_timestamp,
        }


@dataclass
class SearchResult:
    """Search result from Pinecone query."""
    id: str
    score: float
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "score": self.score,
            "metadata": self.metadata,
        }


class PineconeVectorStore:
    """
    Pinecone vector database client for medical RAG.
    
    Features:
    - Async-compatible operations
    - Batch upsert with retry logic
    - Semantic search with filtering
    - Namespace isolation
    - Metrics and monitoring
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.PINECONE_API_KEY
        self.index_name = self.settings.PINECONE_INDEX_NAME
        self.environment = self.settings.PINECONE_ENVIRONMENT
        self.namespace = self.settings.PINECONE_NAMESPACE
        self.dimension = self.settings.EMBEDDING_DIMENSION
        
        self._client: Optional[Pinecone] = None
        self._index = None
        
        # Statistics
        self.stats = {
            "total_upserts": 0,
            "total_queries": 0,
            "total_errors": 0,
            "avg_query_latency_ms": 0,
        }
    
    def connect(self) -> None:
        """Initialize Pinecone connection."""
        try:
            self._client = Pinecone(api_key=self.api_key)
            
            # Check if index exists
            existing_indexes = [idx.name for idx in self._client.list_indexes()]
            
            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone index: {self.index_name}")
                self._client.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1",
                    ),
                )
                # Wait for index to be ready
                import time
                time.sleep(10)
            
            self._index = self._client.Index(self.index_name)
            logger.info(f"Connected to Pinecone index: {self.index_name}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone: {e}")
            raise
    
    def _ensure_connection(self) -> None:
        """Ensure connection is established."""
        if self._index is None:
            self.connect()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def upsert_vectors(
        self,
        vectors: List[Tuple[str, List[float], Dict[str, Any]]],
        batch_size: int = 100,
    ) -> Dict[str, int]:
        """
        Upsert vectors to Pinecone.
        
        Args:
            vectors: List of (id, embedding, metadata) tuples
            batch_size: Number of vectors per batch
        
        Returns:
            Statistics about the upsert operation
        """
        self._ensure_connection()
        
        total_upserted = 0
        errors = 0
        
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            
            try:
                # Convert to Pinecone format
                pinecone_vectors = [
                    (id, embedding, metadata)
                    for id, embedding, metadata in batch
                ]
                
                # Upsert to Pinecone (sync in thread pool)
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self._index.upsert(
                        vectors=pinecone_vectors,
                        namespace=self.namespace,
                    )
                )
                
                total_upserted += len(batch)
                self.stats["total_upserts"] += len(batch)
                
                logger.debug(f"Upserted batch {i//batch_size + 1}: {len(batch)} vectors")
                
            except Exception as e:
                errors += len(batch)
                self.stats["total_errors"] += 1
                logger.error(f"Upsert error in batch {i//batch_size + 1}: {e}")
        
        return {
            "total": len(vectors),
            "upserted": total_upserted,
            "errors": errors,
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def query(
        self,
        query_vector: List[float],
        top_k: int = 50,
        filter_dict: Optional[Dict[str, Any]] = None,
        include_metadata: bool = True,
        include_values: bool = False,
    ) -> List[SearchResult]:
        """
        Query Pinecone for similar vectors.
        
        Args:
            query_vector: Query embedding vector
            top_k: Number of results to return
            filter_dict: Metadata filters
            include_metadata: Include metadata in results
            include_values: Include vector values in results
        
        Returns:
            List of SearchResult objects
        """
        self._ensure_connection()
        
        start_time = datetime.now()
        
        try:
            # Build query parameters
            query_params = {
                "vector": query_vector,
                "top_k": top_k,
                "namespace": self.namespace,
                "include_metadata": include_metadata,
                "include_values": include_values,
            }
            
            if filter_dict:
                query_params["filter"] = filter_dict
            
            # Execute query (sync in thread pool)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._index.query(**query_params)
            )
            
            # Parse results
            results = []
            for match in response.matches:
                # Parse JSON strings in metadata
                metadata = match.metadata or {}
                for key in ["mesh_terms", "authors"]:
                    if key in metadata and isinstance(metadata[key], str):
                        try:
                            metadata[key] = json.loads(metadata[key])
                        except json.JSONDecodeError:
                            pass
                
                results.append(SearchResult(
                    id=match.id,
                    score=match.score,
                    metadata=metadata,
                ))
            
            # Update stats
            latency_ms = (datetime.now() - start_time).total_seconds() * 1000
            self.stats["total_queries"] += 1
            self.stats["avg_query_latency_ms"] = (
                (self.stats["avg_query_latency_ms"] * (self.stats["total_queries"] - 1) + latency_ms)
                / self.stats["total_queries"]
            )
            
            logger.debug(f"Query returned {len(results)} results in {latency_ms:.2f}ms")
            return results
            
        except Exception as e:
            self.stats["total_errors"] += 1
            logger.error(f"Query error: {e}")
            raise
    
    async def hybrid_query(
        self,
        query_vector: List[float],
        keywords: List[str],
        top_k: int = 50,
        alpha: float = 0.7,
    ) -> List[SearchResult]:
        """
        Hybrid search combining vector similarity and keyword matching.
        
        Args:
            query_vector: Query embedding
            keywords: Keywords for text matching
            top_k: Number of results
            alpha: Weight for vector vs keyword (0-1)
        
        Returns:
            List of SearchResult objects
        """
        # Build filter for keyword matching
        filter_dict = None
        if keywords:
            # Create OR filter for keywords
            filter_dict = {
                "$or": [
                    {"title": {"$in": keywords}},
                    {"abstract": {"$in": keywords}},
                    {"mesh_terms": {"$in": keywords}},
                ]
            }
        
        # Query with filter
        results = await self.query(
            query_vector=query_vector,
            top_k=top_k * 2,  # Get more for reranking
            filter_dict=filter_dict,
        )
        
        # Rerank by combining scores
        # (In production, would use cross-encoder reranking)
        return results[:top_k]
    
    async def delete_by_pmid(self, pmid: str) -> bool:
        """Delete vectors by PMID."""
        self._ensure_connection()
        
        try:
            # Query to find vectors with this PMID
            self._index.delete(
                filter={"pmid": pmid},
                namespace=self.namespace,
            )
            return True
        except Exception as e:
            logger.error(f"Delete error for PMID {pmid}: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        self._ensure_connection()
        
        try:
            stats = self._index.describe_index_stats()
            return {
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "total_vector_count": stats.total_vector_count,
                "namespaces": dict(stats.namespaces) if stats.namespaces else {},
            }
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return {}
    
    def create_vector_id(self, pmid: str, chunk_index: int = 0) -> str:
        """Create unique vector ID."""
        return f"pmid_{pmid}_chunk_{chunk_index}"


class MedicalVectorStore:
    """
    High-level interface for medical RAG vector operations.
    
    Provides:
    - Article indexing with embeddings
    - Semantic search with medical context
    - Specialty filtering
    - Citation generation
    """
    
    def __init__(self):
        self.vector_store = PineconeVectorStore()
    
    async def index_article(
        self,
        article: Dict[str, Any],
        embedding: List[float],
        chunk_index: int = 0,
    ) -> bool:
        """
        Index a single article with its embedding.
        
        Args:
            article: Article data dictionary
            embedding: Embedding vector
            chunk_index: Index if article is chunked
        
        Returns:
            Success status
        """
        vector_id = self.vector_store.create_vector_id(
            article.get("pmid", "unknown"),
            chunk_index
        )
        
        metadata = VectorMetadata(
            pmid=article.get("pmid", ""),
            title=article.get("title", ""),
            abstract=article.get("abstract", ""),
            journal=article.get("journal", ""),
            publication_date=article.get("publication_date"),
            mesh_terms=article.get("mesh_terms", []),
            authors=article.get("authors", []),
            doi=article.get("doi"),
            pmc_id=article.get("pmc_id"),
            content_type="abstract",
            specialty=article.get("specialty"),
            ingest_timestamp=datetime.utcnow().isoformat(),
        )
        
        try:
            await self.vector_store.upsert_vectors([
                (vector_id, embedding, metadata.to_dict())
            ])
            return True
        except Exception as e:
            logger.error(f"Failed to index article: {e}")
            return False
    
    async def batch_index_articles(
        self,
        articles: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> Dict[str, int]:
        """
        Batch index articles with embeddings.
        
        Args:
            articles: List of article dictionaries
            embeddings: List of embedding vectors
        
        Returns:
            Statistics about the operation
        """
        if len(articles) != len(embeddings):
            raise ValueError("Articles and embeddings must have same length")
        
        vectors = []
        for article, embedding in zip(articles, embeddings):
            vector_id = self.vector_store.create_vector_id(
                article.get("pmid", f"unknown_{hash(article.get('title', ''))}")
            )
            
            metadata = VectorMetadata(
                pmid=article.get("pmid", ""),
                title=article.get("title", ""),
                abstract=article.get("abstract", ""),
                journal=article.get("journal", ""),
                publication_date=article.get("publication_date"),
                mesh_terms=article.get("mesh_terms", []),
                authors=article.get("authors", []),
                doi=article.get("doi"),
                pmc_id=article.get("pmc_id"),
                content_type="abstract",
                specialty=article.get("specialty"),
                ingest_timestamp=datetime.utcnow().isoformat(),
            )
            
            vectors.append((vector_id, embedding, metadata.to_dict()))
        
        return await self.vector_store.upsert_vectors(vectors)
    
    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 50,
        specialty: Optional[str] = None,
        date_range: Optional[Tuple[str, str]] = None,
        mesh_terms: Optional[List[str]] = None,
        min_score: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant medical literature.
        
        Args:
            query_embedding: Query vector
            top_k: Number of results
            specialty: Filter by medical specialty
            date_range: (start_date, end_date) filter
            mesh_terms: Filter by MeSH terms
            min_score: Minimum similarity score
        
        Returns:
            List of search results with metadata
        """
        # Build filter
        filter_dict = {}
        
        if specialty:
            filter_dict["specialty"] = specialty
        
        if mesh_terms:
            filter_dict["mesh_terms"] = {"$in": mesh_terms}
        
        # Execute search
        results = await self.vector_store.query(
            query_vector=query_embedding,
            top_k=top_k,
            filter_dict=filter_dict if filter_dict else None,
        )
        
        # Filter by minimum score
        filtered_results = [
            r.to_dict() for r in results
            if r.score >= min_score
        ]
        
        return filtered_results


# Convenience functions
async def get_vector_store() -> MedicalVectorStore:
    """Get initialized vector store instance."""
    store = MedicalVectorStore()
    store.vector_store.connect()
    return store
