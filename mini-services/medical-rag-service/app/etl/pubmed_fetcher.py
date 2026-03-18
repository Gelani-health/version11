"""
NCBI PubMed Data Fetcher Module
================================

Comprehensive PubMed data ingestion with:
- E-Utilities API integration (esearch, efetch, esummary)
- Rate limiting: 10 req/sec with API key, 3/sec without
- Retry logic: max 3 attempts, exponential backoff (2s, 4s, 8s)
- Pagination through 39M+ records using retstart parameter
- XML parsing for PMID, title, abstract, authors, journal, pub_date

API URLs:
- E-Utilities Root: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
- Search: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
- Fetch: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
- Summary: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
- Docs: https://www.ncbi.nlm.nih.gov/books/NBK25499/
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import hashlib
import re
import json
import time
from enum import Enum

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import get_settings


# ===== Constants =====

PUBMED_API_URLS = {
    "base": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    "search": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
    "fetch": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
    "summary": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    "link": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi",
    "info": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi",
}

# Rate limits
RATE_LIMIT_WITH_KEY = 10  # requests per second
RATE_LIMIT_WITHOUT_KEY = 3  # requests per second
MAX_RESULTS_PER_REQUEST = 10000  # NCBI limit


class PubMedError(Exception):
    """Base exception for PubMed API errors."""
    pass


class RateLimitError(PubMedError):
    """Rate limit exceeded error."""
    pass


class ParseError(PubMedError):
    """XML parsing error."""
    pass


@dataclass
class PubMedArticle:
    """Structured PubMed article data."""
    pmid: str
    title: str
    abstract: str
    authors: List[str] = field(default_factory=list)
    journal: str = ""
    publication_date: Optional[str] = None
    mesh_terms: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    doi: Optional[str] = None
    pmc_id: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    affiliation: Optional[str] = None
    language: str = "eng"
    publication_types: List[str] = field(default_factory=list)
    chemical_list: List[str] = field(default_factory=list)
    grant_list: List[str] = field(default_factory=list)
    
    @property
    def text_content(self) -> str:
        """Combined title + abstract for embedding."""
        return f"{self.title}\n\n{self.abstract}"
    
    @property
    def content_hash(self) -> str:
        """Generate hash for deduplication."""
        content = f"{self.pmid}:{self.title}:{self.abstract[:100]}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract,
            "authors": self.authors,
            "journal": self.journal,
            "publication_date": self.publication_date,
            "mesh_terms": self.mesh_terms,
            "keywords": self.keywords,
            "doi": self.doi,
            "pmc_id": self.pmc_id,
            "volume": self.volume,
            "issue": self.issue,
            "pages": self.pages,
            "language": self.language,
            "publication_types": self.publication_types,
            "chemical_list": self.chemical_list,
            "text_content": self.text_content,
        }


@dataclass
class SearchResults:
    """PubMed search results."""
    pmids: List[str]
    total_count: int
    query: str
    web_env: Optional[str] = None
    query_key: Optional[str] = None
    retrieval_time: float = 0.0


@dataclass
class FetchStats:
    """Statistics for fetch operations."""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    articles_fetched: int = 0
    bytes_received: int = 0
    total_time: float = 0.0
    retries: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "articles_fetched": self.articles_fetched,
            "bytes_received": self.bytes_received,
            "total_time_sec": round(self.total_time, 2),
            "retries": self.retries,
            "success_rate": (
                self.successful_requests / self.total_requests * 100
                if self.total_requests > 0 else 0
            ),
        }


class PubMedFetcher:
    """
    Async client for NCBI Entrez E-utilities API.
    
    Features:
    - Rate limiting: 10 requests/second with API key
    - Retry with exponential backoff: 2s, 4s, 8s
    - Pagination support for 39M+ records
    - XML parsing for all article metadata
    - Progress tracking
    
    Usage:
        async with PubMedFetcher() as fetcher:
            # Search for articles
            results = await fetcher.search("diagnosis AND symptoms", max_results=100)
            
            # Fetch article details
            async for article in fetcher.fetch_articles(results.pmids):
                print(article.title)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        email: str = "medical-rag@z.ai",
        tool: str = "medical_diagnostic_rag",
    ):
        self.settings = get_settings()
        self.api_key = api_key or self.settings.NCBI_API_KEY
        self.email = email
        self.tool = tool
        
        # Rate limiting setup
        self._rate_limit = RATE_LIMIT_WITH_KEY if self.api_key else RATE_LIMIT_WITHOUT_KEY
        self._min_interval = 1.0 / self._rate_limit
        self._last_request_time = 0.0
        self._request_semaphore = asyncio.Semaphore(self._rate_limit)
        
        # Session management
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Statistics
        self.stats = FetchStats()
        
        logger.info(f"PubMedFetcher initialized (rate limit: {self._rate_limit} req/sec)")
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def _ensure_session(self) -> aiohttp.ClientSession:
        """Ensure aiohttp session is created."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=120, connect=10)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    "User-Agent": f"{self.tool}/1.0 ({self.email})",
                    "Accept": "application/xml",
                }
            )
        return self._session
    
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
    def _get_base_params(self) -> Dict[str, str]:
        """Get base parameters for all requests."""
        params = {
            "email": self.email,
            "tool": self.tool,
        }
        if self.api_key:
            params["api_key"] = self.api_key
        return params
    
    async def _rate_limit_wait(self):
        """Wait to respect rate limits."""
        now = time.time()
        elapsed = now - self._last_request_time
        
        if elapsed < self._min_interval:
            await asyncio.sleep(self._min_interval - elapsed)
        
        self._last_request_time = time.time()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=8),
        retry=retry_if_exception_type(RateLimitError),
        reraise=True,
    )
    async def _make_request(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> str:
        """
        Make rate-limited request to NCBI API with retry logic.
        
        Retry logic: max 3 attempts, exponential backoff (2s, 4s, 8s)
        """
        session = await self._ensure_session()
        
        async with self._request_semaphore:
            await self._rate_limit_wait()
            
            url = f"{PUBMED_API_URLS['base']}/{endpoint}"
            params.update(self._get_base_params())
            
            self.stats.total_requests += 1
            start_time = time.time()
            
            try:
                async with session.get(url, params=params) as response:
                    # Handle rate limiting
                    if response.status == 429:
                        self.stats.retries += 1
                        logger.warning("Rate limited by NCBI, will retry...")
                        raise RateLimitError("NCBI rate limit exceeded")
                    
                    # Handle other errors
                    if response.status >= 400:
                        error_text = await response.text()
                        self.stats.failed_requests += 1
                        raise PubMedError(f"API error {response.status}: {error_text[:200]}")
                    
                    content = await response.text()
                    
                    self.stats.successful_requests += 1
                    self.stats.bytes_received += len(content)
                    self.stats.total_time += time.time() - start_time
                    
                    return content
                    
            except aiohttp.ClientError as e:
                self.stats.failed_requests += 1
                self.stats.retries += 1
                logger.error(f"HTTP client error: {e}")
                raise PubMedError(f"Request failed: {e}")
    
    async def search(
        self,
        query: str,
        max_results: int = 10000,
        date_range: Optional[Tuple[str, str]] = None,
        mesh_terms: Optional[List[str]] = None,
        use_history: bool = True,
        sort: str = "relevance",
        rettype: str = "uilist",
    ) -> SearchResults:
        """
        Search PubMed for article PMIDs.
        
        Args:
            query: PubMed search query (supports PubMed syntax)
            max_results: Maximum results to return (max 10000 per request)
            date_range: Tuple of (start_date, end_date) as YYYY/MM/DD
            mesh_terms: MeSH terms to filter by
            use_history: Enable history for large result sets
            sort: Sort order ('relevance', 'date', 'author')
            rettype: Return type ('uilist', 'count')
        
        Returns:
            SearchResults with PMIDs and metadata
        
        Example:
            results = await fetcher.search(
                "heart failure AND treatment",
                max_results=100,
                date_range=("2023/01/01", "2024/01/01"),
                mesh_terms=["Heart Failure", "Therapeutics"]
            )
        """
        start_time = time.time()
        
        # Build search query
        full_query = query
        
        if mesh_terms:
            mesh_query = " OR ".join([f'"{term}"[MeSH]' for term in mesh_terms])
            full_query = f"({query}) AND ({mesh_query})"
        
        # Build request parameters
        params = {
            "db": "pubmed",
            "term": full_query,
            "retmax": str(min(max_results, MAX_RESULTS_PER_REQUEST)),
            "rettype": rettype,
            "retmode": "json",
            "sort": sort,
        }
        
        # Add date range filter
        if date_range:
            start, end = date_range
            params["datetype"] = "pdat"
            params["mindate"] = start
            params["maxdate"] = end
        
        # Enable history for pagination
        if use_history:
            params["usehistory"] = "y"
        
        try:
            response_text = await self._make_request("esearch.fcgi", params)
            
            # Parse JSON response
            data = json.loads(response_text)
            result = data.get("esearchresult", {})
            
            pmids = result.get("idlist", [])
            total_count = int(result.get("count", 0))
            web_env = result.get("webenv")
            query_key = result.get("querykey")
            
            retrieval_time = time.time() - start_time
            
            logger.info(
                f"Search completed: {len(pmids)}/{total_count} articles "
                f"for query '{query[:50]}...' in {retrieval_time:.2f}s"
            )
            
            return SearchResults(
                pmids=pmids,
                total_count=total_count,
                query=query,
                web_env=web_env,
                query_key=query_key,
                retrieval_time=retrieval_time,
            )
            
        except json.JSONDecodeError as e:
            raise ParseError(f"Failed to parse search response: {e}")
    
    async def search_paginated(
        self,
        query: str,
        total_results: int = 100000,
        page_size: int = 5000,
        date_range: Optional[Tuple[str, str]] = None,
        mesh_terms: Optional[List[str]] = None,
    ) -> AsyncGenerator[List[str], None]:
        """
        Paginate through large PubMed result sets.
        
        Uses retstart parameter for pagination through 39M+ records.
        
        Args:
            query: PubMed search query
            total_results: Total number of results to retrieve
            page_size: Results per page (max 10000)
            date_range: Date filter
            mesh_terms: MeSH term filters
        
        Yields:
            Lists of PMIDs for each page
        """
        # Initial search to get total count and history
        initial = await self.search(
            query=query,
            max_results=0,  # Just get count
            date_range=date_range,
            mesh_terms=mesh_terms,
            use_history=True,
        )
        
        total_to_fetch = min(total_results, initial.total_count)
        pages = (total_to_fetch + page_size - 1) // page_size
        
        logger.info(
            f"Paginated search: {total_to_fetch} articles in {pages} pages "
            f"(total available: {initial.total_count})"
        )
        
        for page in range(pages):
            retstart = page * page_size
            retmax = min(page_size, total_to_fetch - retstart)
            
            params = {
                "db": "pubmed",
                "term": initial.query,
                "retstart": str(retstart),
                "retmax": str(retmax),
                "rettype": "uilist",
                "retmode": "json",
                "WebEnv": initial.web_env,
                "query_key": initial.query_key,
            }
            
            if date_range:
                start, end = date_range
                params["datetype"] = "pdat"
                params["mindate"] = start
                params["maxdate"] = end
            
            response_text = await self._make_request("esearch.fcgi", params)
            data = json.loads(response_text)
            pmids = data.get("esearchresult", {}).get("idlist", [])
            
            if pmids:
                yield pmids
                logger.debug(f"Page {page + 1}/{pages}: {len(pmids)} PMIDs")
    
    async def fetch_articles(
        self,
        pmids: List[str],
        batch_size: int = 100,
    ) -> AsyncGenerator[PubMedArticle, None]:
        """
        Fetch article details by PMIDs.
        
        Args:
            pmids: List of PMID strings
            batch_size: Number of articles per request (max 200 recommended)
        
        Yields:
            PubMedArticle objects with full metadata
        """
        total_batches = (len(pmids) + batch_size - 1) // batch_size
        
        for i in range(0, len(pmids), batch_size):
            batch = pmids[i:i + batch_size]
            batch_num = i // batch_size + 1
            
            logger.debug(f"Fetching batch {batch_num}/{total_batches} ({len(batch)} articles)")
            
            params = {
                "db": "pubmed",
                "id": ",".join(batch),
                "rettype": "medline",
                "retmode": "xml",
            }
            
            try:
                xml_text = await self._make_request("efetch.fcgi", params)
                articles = self._parse_pubmed_xml(xml_text)
                
                for article in articles:
                    self.stats.articles_fetched += 1
                    yield article
                    
            except Exception as e:
                logger.error(f"Failed to fetch batch {batch_num}: {e}")
                continue
    
    async def fetch_article(self, pmid: str) -> Optional[PubMedArticle]:
        """Fetch a single article by PMID."""
        async for article in self.fetch_articles([pmid]):
            return article
        return None
    
    def _parse_pubmed_xml(self, xml_text: str) -> List[PubMedArticle]:
        """
        Parse PubMed XML response into structured articles.
        
        Extracts:
        - PMID
        - Title
        - Abstract (with structured sections)
        - Authors (with affiliations)
        - Journal details
        - Publication date
        - MeSH terms
        - Keywords
        - DOI and PMC ID
        """
        articles = []
        
        try:
            root = ET.fromstring(xml_text)
            
            for article_elem in root.findall(".//PubmedArticle"):
                try:
                    article = self._parse_single_article(article_elem)
                    if article:
                        articles.append(article)
                except Exception as e:
                    logger.warning(f"Failed to parse article element: {e}")
                    continue
                    
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")
            raise ParseError(f"Failed to parse PubMed XML: {e}")
        
        return articles
    
    def _parse_single_article(self, article_elem: ET.Element) -> Optional[PubMedArticle]:
        """Parse a single PubmedArticle element."""
        # Extract PMID
        pmid = article_elem.findtext(".//PMID", "")
        if not pmid:
            return None
        
        # Extract title
        title = article_elem.findtext(".//ArticleTitle", "")
        
        # Extract abstract (may have structured sections)
        abstract_parts = []
        for abstract_text in article_elem.findall(".//AbstractText"):
            label = abstract_text.get("Label", "")
            text = "".join(abstract_text.itertext())
            if label:
                abstract_parts.append(f"{label}: {text}")
            else:
                abstract_parts.append(text)
        abstract = " ".join(abstract_parts)
        
        # Extract authors
        authors = []
        for author in article_elem.findall(".//Author"):
            lastname = author.findtext("LastName", "")
            forename = author.findtext("ForeName", "")
            initials = author.findtext("Initials", "")
            
            if lastname or forename:
                authors.append(f"{forename} {lastname}".strip())
            elif lastname and initials:
                authors.append(f"{lastname} {initials}".strip())
        
        # Extract journal details
        journal = article_elem.findtext(".//Journal/Title", "")
        volume = article_elem.findtext(".//JournalIssue/Volume")
        issue = article_elem.findtext(".//JournalIssue/Issue")
        
        # Extract publication date
        pub_date = None
        for date_elem in article_elem.findall(".//PubDate"):
            year = date_elem.findtext("Year", "")
            month = date_elem.findtext("Month", "01")
            day = date_elem.findtext("Day", "01")
            
            # Handle month names
            month_map = {
                "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
                "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
                "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
            }
            if month in month_map:
                month = month_map[month]
            
            if year:
                pub_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                break
        
        # Extract MeSH terms
        mesh_terms = []
        for mesh in article_elem.findall(".//MeshHeading/DescriptorName"):
            if mesh.text:
                mesh_terms.append(mesh.text)
        
        # Extract keywords
        keywords = []
        for keyword in article_elem.findall(".//Keyword"):
            if keyword.text:
                keywords.append(keyword.text)
        
        # Extract DOI and PMC ID
        doi = None
        pmc_id = None
        for article_id in article_elem.findall(".//ArticleId"):
            id_type = article_id.get("IdType", "")
            if id_type == "doi":
                doi = article_id.text
            elif id_type == "pmc":
                pmc_id = article_id.text
        
        # Extract publication types
        pub_types = []
        for pt in article_elem.findall(".//PublicationType"):
            if pt.text:
                pub_types.append(pt.text)
        
        # Extract chemicals
        chemicals = []
        for chem in article_elem.findall(".//Chemical/NameOfSubstance"):
            if chem.text:
                chemicals.append(chem.text)
        
        return PubMedArticle(
            pmid=pmid,
            title=title,
            abstract=abstract,
            authors=authors,
            journal=journal,
            publication_date=pub_date,
            mesh_terms=mesh_terms,
            keywords=keywords,
            doi=doi,
            pmc_id=pmc_id,
            volume=volume,
            issue=issue,
            publication_types=pub_types,
            chemical_list=chemicals,
        )
    
    async def get_article_summary(self, pmid: str) -> Optional[Dict[str, Any]]:
        """Get brief article summary using esummary."""
        params = {
            "db": "pubmed",
            "id": pmid,
            "retmode": "json",
        }
        
        try:
            response_text = await self._make_request("esummary.fcgi", params)
            data = json.loads(response_text)
            return data.get("result", {}).get(pmid)
        except Exception as e:
            logger.error(f"Failed to get summary for PMID {pmid}: {e}")
            return None
    
    async def get_related_articles(self, pmid: str, max_results: int = 20) -> List[str]:
        """Get related article PMIDs using elink."""
        params = {
            "dbfrom": "pubmed",
            "db": "pubmed",
            "id": pmid,
            "retmode": "json",
            "cmd": "neighbor",
        }
        
        try:
            response_text = await self._make_request("elink.fcgi", params)
            data = json.loads(response_text)
            
            link_sets = data.get("linksets", [])
            pmids = []
            
            for link_set in link_sets:
                for link in link_set.get("linksetdbs", []):
                    if "links" in link:
                        pmids.extend(link["links"][:max_results])
            
            return pmids[:max_results]
            
        except Exception as e:
            logger.error(f"Failed to get related articles for PMID {pmid}: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get fetch statistics."""
        return self.stats.to_dict()


# ===== Convenience Functions =====

async def fetch_pubmed_articles(
    query: str,
    max_articles: int = 1000,
    date_range: Optional[Tuple[str, str]] = None,
    mesh_terms: Optional[List[str]] = None,
) -> List[PubMedArticle]:
    """
    Convenience function to fetch PubMed articles.
    
    Args:
        query: PubMed search query
        max_articles: Maximum articles to fetch
        date_range: (start_date, end_date) tuple as YYYY/MM/DD
        mesh_terms: MeSH terms to filter
    
    Returns:
        List of PubMedArticle objects
    """
    articles = []
    
    async with PubMedFetcher() as fetcher:
        # Search for PMIDs
        results = await fetcher.search(
            query=query,
            max_results=max_articles,
            date_range=date_range,
            mesh_terms=mesh_terms,
        )
        
        if not results.pmids:
            logger.warning(f"No articles found for query: {query}")
            return articles
        
        # Fetch article details
        async for article in fetcher.fetch_articles(results.pmids):
            articles.append(article)
            
            if len(articles) >= max_articles:
                break
    
    logger.info(f"Fetched {len(articles)} articles for query: {query[:50]}...")
    return articles


# ===== Unit Tests =====
# NOTE: Test class moved to tests/test_pubmed_fetcher.py
# Do not import pytest here to avoid production import errors


if __name__ == "__main__":
    # Example usage
    async def main():
        async with PubMedFetcher() as fetcher:
            # Search for recent cardiology articles
            results = await fetcher.search(
                query="heart failure treatment",
                max_results=10,
                date_range=("2023/01/01", "2024/01/01"),
                mesh_terms=["Heart Failure", "Therapeutics"],
            )
            
            print(f"Found {results.total_count} articles")
            
            # Fetch article details
            async for article in fetcher.fetch_articles(results.pmids[:5]):
                print(f"\nPMID: {article.pmid}")
                print(f"Title: {article.title[:80]}...")
                print(f"Journal: {article.journal}")
                print(f"MeSH: {', '.join(article.mesh_terms[:3])}")
            
            # Print stats
            print(f"\nStats: {fetcher.get_stats()}")
    
    asyncio.run(main())
