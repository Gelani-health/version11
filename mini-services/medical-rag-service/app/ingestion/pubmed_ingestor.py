"""
P9: PubMed Ingestion Pipeline for Pinecone
==========================================

Implements automated ingestion of PubMed articles into Pinecone vector database
with namespace-based organization by clinical domain.

Architecture:
- Uses NCBI E-utilities REST API (no API key required for <3 req/s)
- Uses NCBI_API_KEY env var for 10 req/s if provided
- Chunks abstracts into ≤512 token segments with 64-token overlap
- Embeds via Together AI m2-bert-80M-8k-retrieval model
- Upserts to Pinecone with namespace organization

Evidence Sources:
- NCBI E-utilities API: https://www.ncbi.nlm.nih.gov/books/NBK25500/
- Pinecone best practices: https://docs.pinecone.io/docs/namespaces
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
import sqlite3
import pickle
import os
import time
import re
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


# =============================================================================
# CLINICAL NAMESPACES - MeSH Query Mappings
# =============================================================================

CLINICAL_NAMESPACES = {
    "pubmed_infectious": "infectious disease[MeSH] AND (antibiotic[tiab] OR antimicrobial[tiab])",
    "pubmed_cardiology": "cardiovascular diseases[MeSH] AND (diagnosis[tiab] OR treatment[tiab])",
    "pubmed_nephrology": "kidney diseases[MeSH] AND (dosing[tiab] OR renal impairment[tiab])",
    "pubmed_pulmonology": "lung diseases[MeSH] AND (pneumonia[tiab] OR respiratory[tiab])",
    "pubmed_emergency": "emergencies[MeSH] AND (triage[tiab] OR acute[tiab])",
    "pubmed_pharmacology": "drug interactions[MeSH] OR adverse drug reaction[MeSH]",
    "pubmed_neurology": "nervous system diseases[MeSH] AND (diagnosis[tiab] OR seizure[tiab])",
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class PubMedChunk:
    """A chunk of a PubMed article for embedding."""
    pmid: str
    chunk_index: int
    total_chunks: int
    chunk_text: str
    title: str
    abstract: str
    mesh_terms: List[str]
    publication_year: Optional[int]
    journal: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "chunk_text": self.chunk_text,
            "title": self.title,
            "abstract": self.abstract,
            "mesh_terms": self.mesh_terms,
            "publication_year": self.publication_year,
            "journal": self.journal,
        }


@dataclass
class PubMedArticle:
    """Parsed PubMed article."""
    pmid: str
    title: str
    abstract: str
    mesh_terms: List[str]
    publication_year: Optional[int]
    journal: str
    doi: Optional[str] = None
    pmc_id: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract,
            "mesh_terms": self.mesh_terms,
            "publication_year": self.publication_year,
            "journal": self.journal,
            "doi": self.doi,
            "pmc_id": self.pmc_id,
            "authors": self.authors,
        }


@dataclass
class IngestionResult:
    """Result of an ingestion operation."""
    namespace: str
    status: str
    articles_processed: int = 0
    chunks_created: int = 0
    vectors_upserted: int = 0
    errors: int = 0
    latency_ms: float = 0.0
    message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "namespace": self.namespace,
            "status": self.status,
            "articles_processed": self.articles_processed,
            "chunks_created": self.chunks_created,
            "vectors_upserted": self.vectors_upserted,
            "errors": self.errors,
            "latency_ms": round(self.latency_ms, 2),
            "message": self.message,
        }


# =============================================================================
# PUBMED INGESTOR
# =============================================================================

class PubMedIngestor:
    """
    P9: Automated PubMed ingestion pipeline.
    
    Features:
    - NCBI E-utilities integration with rate limiting
    - Namespace-based MeSH query organization
    - Article chunking with overlap
    - Together AI embedding generation
    - Pinecone upsert with metadata
    - SQLite ingestion state tracking
    - 90-day re-ingestion skip logic
    """
    
    # NCBI API endpoints
    ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    
    # Chunking parameters
    MAX_CHUNK_CHARS = 2048  # ~512 tokens (1 token ≈ 4 chars)
    OVERLAP_CHARS = 256     # ~64 token overlap
    
    # Rate limiting
    RATE_LIMIT_NO_KEY = 0.34   # ~3 requests/second
    RATE_LIMIT_WITH_KEY = 0.1  # 10 requests/second
    
    def __init__(self, db_path: Optional[str] = None):
        self.settings = get_settings()
        
        # Database path for ingestion state
        if db_path is None:
            db_path = os.path.join(
                os.path.dirname(__file__),
                "..", "..", "data",
                "pinecone_ingestion.db"
            )
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Rate limiting
        self.api_key = self.settings.NCBI_API_KEY
        self.rate_limit = self.RATE_LIMIT_WITH_KEY if self.api_key else self.RATE_LIMIT_NO_KEY
        self._last_request_time = 0.0
        
        # Pinecone client (lazy init)
        self._pinecone = None
        self._index = None
        
        # Embedding client (lazy init)
        self._embedding_client = None
        
        # BM25 index storage path
        self.bm25_path = self.db_path.parent / "bm25_indexes"
        self.bm25_path.mkdir(parents=True, exist_ok=True)
        
        # Statistics
        self.stats = {
            "total_ingested": 0,
            "total_chunks": 0,
            "total_errors": 0,
            "last_ingestion": None,
        }
        
        # Initialize database
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for ingestion state."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pinecone_ingestion_log (
                namespace TEXT PRIMARY KEY,
                last_ingested_at TIMESTAMP,
                article_count INTEGER DEFAULT 0,
                chunk_count INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # BM25 index metadata table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bm25_index_metadata (
                namespace TEXT PRIMARY KEY,
                document_count INTEGER DEFAULT 0,
                vocabulary_size INTEGER DEFAULT 0,
                last_updated TIMESTAMP,
                pickle_path TEXT
            )
        """)
        
        conn.commit()
        conn.close()
        
        logger.info(f"[PubMedIngestor] Database initialized at {self.db_path}")
    
    def _check_ingestion_needed(self, namespace: str, days: int = 90) -> bool:
        """Check if namespace needs re-ingestion (>90 days old)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT last_ingested_at FROM pinecone_ingestion_log WHERE namespace = ?",
            (namespace,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row is None or row[0] is None:
            return True
        
        last_ingested = datetime.fromisoformat(row[0])
        return (datetime.utcnow() - last_ingested) > timedelta(days=days)
    
    def _record_ingestion(self, namespace: str, article_count: int, chunk_count: int):
        """Record successful ingestion in database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO pinecone_ingestion_log 
            (namespace, last_ingested_at, article_count, chunk_count, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(namespace) DO UPDATE SET
                last_ingested_at = excluded.last_ingested_at,
                article_count = excluded.article_count,
                chunk_count = excluded.chunk_count,
                updated_at = CURRENT_TIMESTAMP
        """, (namespace, datetime.utcnow().isoformat(), article_count, chunk_count))
        
        conn.commit()
        conn.close()
    
    async def _rate_limit_wait(self):
        """Wait to respect NCBI rate limits."""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit:
            await asyncio.sleep(self.rate_limit - elapsed)
        self._last_request_time = time.time()
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def _make_ncbi_request(
        self,
        session: aiohttp.ClientSession,
        url: str,
        params: Dict[str, str]
    ) -> str:
        """Make rate-limited request to NCBI API."""
        await self._rate_limit_wait()
        
        # Add API key if available
        if self.api_key:
            params["api_key"] = self.api_key
        params["email"] = self.settings.NCBI_EMAIL
        params["tool"] = self.settings.NCBI_TOOL
        
        async with session.get(url, params=params) as response:
            if response.status == 429:
                # Rate limited - wait and retry
                logger.warning("[PubMedIngestor] Rate limited, waiting...")
                await asyncio.sleep(1)
                raise Exception("Rate limited")
            
            response.raise_for_status()
            return await response.text()
    
    async def search_pubmed(
        self,
        session: aiohttp.ClientSession,
        query: str,
        max_results: int = 500,
        min_date: str = "2015"
    ) -> List[str]:
        """
        Search PubMed for PMIDs matching query.
        
        Args:
            session: aiohttp session
            query: PubMed search query
            max_results: Maximum PMIDs to return
            min_date: Minimum publication date (YYYY)
        
        Returns:
            List of PMID strings
        """
        params = {
            "db": "pubmed",
            "term": query,
            "retmax": str(max_results),
            "retmode": "json",
            "sort": "relevance",
            "datetype": "pdat",
            "mindate": f"{min_date}/01/01",
        }
        
        try:
            response_text = await self._make_ncbi_request(
                session, self.ESEARCH_URL, params
            )
            
            import json
            data = json.loads(response_text)
            id_list = data.get("esearchresult", {}).get("idlist", [])
            
            logger.info(f"[PubMedIngestor] Found {len(id_list)} PMIDs for query: {query[:50]}...")
            return id_list
            
        except Exception as e:
            logger.error(f"[PubMedIngestor] Search failed: {e}")
            return []
    
    async def fetch_articles(
        self,
        session: aiohttp.ClientSession,
        pmids: List[str],
        batch_size: int = 100
    ) -> AsyncGenerator[PubMedArticle, None]:
        """
        Fetch article details by PMIDs.
        
        Args:
            session: aiohttp session
            pmids: List of PMID strings
            batch_size: Articles per request
        
        Yields:
            PubMedArticle objects
        """
        for i in range(0, len(pmids), batch_size):
            batch = pmids[i:i + batch_size]
            
            params = {
                "db": "pubmed",
                "id": ",".join(batch),
                "rettype": "abstract",
                "retmode": "xml",
            }
            
            try:
                xml_text = await self._make_ncbi_request(
                    session, self.EFETCH_URL, params
                )
                
                # Parse XML
                articles = self._parse_pubmed_xml(xml_text)
                for article in articles:
                    yield article
                    
            except Exception as e:
                logger.error(f"[PubMedIngestor] Failed to fetch batch: {e}")
                continue
    
    def _parse_pubmed_xml(self, xml_text: str) -> List[PubMedArticle]:
        """Parse PubMed XML response into structured articles."""
        articles = []
        
        try:
            root = ET.fromstring(xml_text)
            
            for article_elem in root.findall(".//PubmedArticle"):
                try:
                    # Extract PMID
                    pmid = article_elem.findtext(".//PMID", "")
                    if not pmid:
                        continue
                    
                    # Extract title
                    title = article_elem.findtext(".//ArticleTitle", "")
                    
                    # Extract abstract
                    abstract_parts = []
                    for abstract_text in article_elem.findall(".//AbstractText"):
                        label = abstract_text.get("Label", "")
                        text = "".join(abstract_text.itertext())
                        if label:
                            abstract_parts.append(f"{label}: {text}")
                        else:
                            abstract_parts.append(text)
                    abstract = " ".join(abstract_parts)
                    
                    # Extract MeSH terms
                    mesh_terms = []
                    for mesh in article_elem.findall(".//MeshHeading/DescriptorName"):
                        if mesh.text:
                            mesh_terms.append(mesh.text)
                    
                    # Extract publication year
                    pub_year = None
                    for pub_date in article_elem.findall(".//PubDate"):
                        year = pub_date.findtext("Year", "")
                        if year:
                            pub_year = int(year)
                            break
                    
                    # Extract journal
                    journal = article_elem.findtext(".//Journal/Title", "")
                    
                    # Extract DOI
                    doi = None
                    for article_id in article_elem.findall(".//ArticleId"):
                        if article_id.get("IdType") == "doi":
                            doi = article_id.text
                            break
                    
                    # Extract PMC ID
                    pmc_id = None
                    for article_id in article_elem.findall(".//ArticleId"):
                        if article_id.get("IdType") == "pmc":
                            pmc_id = article_id.text
                            break
                    
                    # Extract authors
                    authors = []
                    for author in article_elem.findall(".//Author"):
                        lastname = author.findtext("LastName", "")
                        forename = author.findtext("ForeName", "")
                        if lastname or forename:
                            authors.append(f"{forename} {lastname}".strip())
                    
                    article = PubMedArticle(
                        pmid=pmid,
                        title=title,
                        abstract=abstract,
                        mesh_terms=mesh_terms,
                        publication_year=pub_year,
                        journal=journal,
                        doi=doi,
                        pmc_id=pmc_id,
                        authors=authors,
                    )
                    
                    articles.append(article)
                    
                except Exception as e:
                    logger.warning(f"[PubMedIngestor] Failed to parse article: {e}")
                    continue
                    
        except ET.ParseError as e:
            logger.error(f"[PubMedIngestor] XML parsing error: {e}")
        
        return articles
    
    def _chunk_text(self, text: str) -> List[str]:
        """
        Chunk text into segments with overlap.
        
        Uses simple period-boundary splitting (no NLTK dependency).
        Each chunk is ≤ MAX_CHUNK_CHARS with OVERLAP_CHARS overlap.
        """
        if not text:
            return []
        
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= self.MAX_CHUNK_CHARS:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # Add overlap from previous chunk
                if chunks and len(current_chunk) > self.OVERLAP_CHARS:
                    overlap = current_chunk[-self.OVERLAP_CHARS:]
                    # Find word boundary for overlap
                    space_idx = overlap.find(" ")
                    if space_idx > 0:
                        overlap = overlap[space_idx + 1:]
                    current_chunk = overlap + " " + sentence
                else:
                    current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _create_chunks(self, article: PubMedArticle) -> List[PubMedChunk]:
        """Create chunks from an article for embedding."""
        # Combine title and abstract
        full_text = f"{article.title}\n\n{article.abstract}"
        
        # Chunk the text
        text_chunks = self._chunk_text(full_text)
        
        if not text_chunks:
            # Create single chunk from title if no abstract
            text_chunks = [article.title] if article.title else []
        
        chunks = []
        for i, chunk_text in enumerate(text_chunks):
            chunk = PubMedChunk(
                pmid=article.pmid,
                chunk_index=i,
                total_chunks=len(text_chunks),
                chunk_text=chunk_text,
                title=article.title,
                abstract=article.abstract[:500],
                mesh_terms=article.mesh_terms,
                publication_year=article.publication_year,
                journal=article.journal,
            )
            chunks.append(chunk)
        
        return chunks
    
    async def _get_embedding_client(self):
        """Get or create embedding client."""
        if self._embedding_client is None:
            from app.ingestion.embedding_client import get_embedding_client
            self._embedding_client = await get_embedding_client()
        return self._embedding_client
    
    async def _get_pinecone_index(self):
        """Get or create Pinecone index client."""
        if self._index is None:
            from pinecone import Pinecone
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
        return self._index
    
    async def embed_and_upsert(
        self,
        chunks: List[PubMedChunk],
        namespace: str,
        batch_size: int = 32
    ) -> int:
        """
        Embed chunks and upsert to Pinecone.
        
        Args:
            chunks: List of PubMedChunk objects
            namespace: Pinecone namespace
            batch_size: Embedding batch size
        
        Returns:
            Number of vectors upserted
        """
        if not chunks:
            return 0
        
        embedding_client = await self._get_embedding_client()
        index = await self._get_pinecone_index()
        
        vectors_upserted = 0
        
        # Process in batches
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            
            # Get embeddings
            texts = [c.chunk_text for c in batch]
            embeddings = await embedding_client.embed_batch(texts)
            
            # Prepare vectors for Pinecone
            pinecone_vectors = []
            for chunk, embedding in zip(batch, embeddings):
                vector_id = f"pmid_{chunk.pmid}_chunk_{chunk.chunk_index}"
                
                metadata = {
                    "pmid": chunk.pmid,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                    "title": chunk.title[:1000],
                    "abstract": chunk.abstract[:5000],
                    "mesh_terms": ",".join(chunk.mesh_terms[:20]),
                    "publication_year": chunk.publication_year or 0,
                    "journal": chunk.journal[:200],
                    "namespace": namespace,
                    "ingest_timestamp": datetime.utcnow().isoformat(),
                }
                
                pinecone_vectors.append((vector_id, embedding, metadata))
            
            # Upsert to Pinecone in batches of 100
            for j in range(0, len(pinecone_vectors), 100):
                upsert_batch = pinecone_vectors[j:j + 100]
                
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: index.upsert(
                            vectors=upsert_batch,
                            namespace=namespace
                        )
                    )
                    vectors_upserted += len(upsert_batch)
                    
                except Exception as e:
                    logger.error(f"[PubMedIngestor] Upsert failed: {e}")
                    self.stats["total_errors"] += 1
            
            logger.debug(f"[PubMedIngestor] Upserted {vectors_upserted} vectors for namespace {namespace}")
        
        return vectors_upserted
    
    async def ingest_namespace(
        self,
        namespace: str,
        mesh_query: str,
        max_articles: int = 500,
        force: bool = False
    ) -> IngestionResult:
        """
        Ingest articles for a clinical namespace.
        
        Args:
            namespace: Pinecone namespace name
            mesh_query: MeSH search query
            max_articles: Maximum articles to ingest
            force: Force re-ingestion even if recently ingested
        
        Returns:
            IngestionResult with statistics
        """
        start_time = time.time()
        
        # Check if re-ingestion needed
        if not force and not self._check_ingestion_needed(namespace):
            logger.info(f"[PubMedIngestor] Skipping {namespace} - recently ingested")
            return IngestionResult(
                namespace=namespace,
                status="skipped",
                message="Recently ingested (<90 days)"
            )
        
        logger.info(f"[PubMedIngestor] Starting ingestion for {namespace}")
        
        articles_processed = 0
        chunks_created = 0
        vectors_upserted = 0
        errors = 0
        
        async with aiohttp.ClientSession() as session:
            # Search for PMIDs
            pmids = await self.search_pubmed(
                session, mesh_query, max_results=max_articles
            )
            
            if not pmids:
                return IngestionResult(
                    namespace=namespace,
                    status="error",
                    message="No articles found"
                )
            
            # Fetch and process articles
            all_chunks = []
            
            async for article in self.fetch_articles(session, pmids):
                try:
                    chunks = self._create_chunks(article)
                    all_chunks.extend(chunks)
                    articles_processed += 1
                    
                    # Process in batches
                    if len(all_chunks) >= 100:
                        upserted = await self.embed_and_upsert(all_chunks, namespace)
                        vectors_upserted += upserted
                        chunks_created += len(all_chunks)
                        all_chunks = []
                        
                except Exception as e:
                    logger.error(f"[PubMedIngestor] Article processing error: {e}")
                    errors += 1
            
            # Process remaining chunks
            if all_chunks:
                upserted = await self.embed_and_upsert(all_chunks, namespace)
                vectors_upserted += upserted
                chunks_created += len(all_chunks)
        
        # Record ingestion
        self._record_ingestion(namespace, articles_processed, chunks_created)
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["total_ingested"] += articles_processed
        self.stats["total_chunks"] += chunks_created
        self.stats["total_errors"] += errors
        self.stats["last_ingestion"] = datetime.utcnow().isoformat()
        
        logger.info(
            f"[PubMedIngestor] Completed {namespace}: "
            f"{articles_processed} articles, {vectors_upserted} vectors"
        )
        
        return IngestionResult(
            namespace=namespace,
            status="success",
            articles_processed=articles_processed,
            chunks_created=chunks_created,
            vectors_upserted=vectors_upserted,
            errors=errors,
            latency_ms=latency_ms,
            message=f"Ingested {articles_processed} articles"
        )
    
    async def ingest_all_namespaces(
        self,
        max_articles_per_namespace: int = 500,
        force: bool = False
    ) -> Dict[str, IngestionResult]:
        """
        Ingest all clinical namespaces.
        
        Args:
            max_articles_per_namespace: Maximum articles per namespace
            force: Force re-ingestion
        
        Returns:
            Dict mapping namespace to IngestionResult
        """
        results = {}
        
        for namespace, mesh_query in CLINICAL_NAMESPACES.items():
            try:
                result = await self.ingest_namespace(
                    namespace=namespace,
                    mesh_query=mesh_query,
                    max_articles=max_articles_per_namespace,
                    force=force
                )
                results[namespace] = result
                
            except Exception as e:
                logger.error(f"[PubMedIngestor] Failed to ingest {namespace}: {e}")
                results[namespace] = IngestionResult(
                    namespace=namespace,
                    status="error",
                    message=str(e)
                )
        
        return results
    
    def get_ingestion_status(self) -> Dict[str, Any]:
        """Get ingestion status for all namespaces."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM pinecone_ingestion_log")
        rows = cursor.fetchall()
        conn.close()
        
        status = {}
        for row in rows:
            namespace = row[0]
            status[namespace] = {
                "last_ingested_at": row[1],
                "article_count": row[2],
                "chunk_count": row[3],
                "last_error": row[4],
            }
        
        # Add namespaces not yet ingested
        for namespace in CLINICAL_NAMESPACES:
            if namespace not in status:
                status[namespace] = {
                    "last_ingested_at": None,
                    "article_count": 0,
                    "chunk_count": 0,
                    "last_error": None,
                }
        
        return {
            "namespaces": status,
            "stats": self.stats,
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_ingestor: Optional[PubMedIngestor] = None


def get_pubmed_ingestor() -> PubMedIngestor:
    """Get or create PubMed ingestor singleton."""
    global _ingestor
    
    if _ingestor is None:
        _ingestor = PubMedIngestor()
    
    return _ingestor
