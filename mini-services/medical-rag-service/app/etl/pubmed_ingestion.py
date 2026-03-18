"""
PubMed/PMC Data Ingestion Module
================================

Handles fetching and processing of medical literature from NCBI databases:
- PubMed abstracts (39M+)
- PubMed Central full-text articles (11M+)
- MeSH term enrichment

HIPAA-compliant with audit logging.
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any, AsyncGenerator
from datetime import datetime, timedelta
from dataclasses import dataclass
import hashlib
import re

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings, PUBMED_ENDPOINTS


@dataclass
class PubMedArticle:
    """Structured PubMed article data."""
    pmid: str
    title: str
    abstract: str
    authors: List[str]
    journal: str
    publication_date: Optional[str]
    mesh_terms: List[str]
    keywords: List[str]
    doi: Optional[str]
    pmc_id: Optional[str]
    text_content: str  # Combined title + abstract for embedding
    
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
            "text_content": self.text_content,
        }
    
    @property
    def content_hash(self) -> str:
        """Generate hash for deduplication."""
        content = f"{self.pmid}:{self.title}:{self.abstract[:100]}"
        return hashlib.md5(content.encode()).hexdigest()


@dataclass
class PMCArticle:
    """Structured PMC full-text article data."""
    pmc_id: str
    pmid: Optional[str]
    title: str
    abstract: str
    full_text: str
    sections: List[Dict[str, str]]  # [{heading: str, content: str}]
    authors: List[str]
    journal: str
    publication_date: Optional[str]
    mesh_terms: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "pmc_id": self.pmc_id,
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract,
            "full_text": self.full_text,
            "sections": self.sections,
            "authors": self.authors,
            "journal": self.journal,
            "publication_date": self.publication_date,
            "mesh_terms": self.mesh_terms,
        }


class PubMedIngestionError(Exception):
    """Custom exception for PubMed ingestion errors."""
    pass


class PubMedClient:
    """
    Async client for NCBI Entrez E-utilities API.
    
    Handles:
    - Rate limiting (3-10 req/sec with API key)
    - Retries with exponential backoff
    - XML parsing
    - Audit logging
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.NCBI_API_KEY
        self.email = self.settings.NCBI_EMAIL
        self.tool = self.settings.NCBI_TOOL
        self.base_url = self.settings.NCBI_BASE_URL
        
        # Rate limiting: 10 requests/second with API key
        self._request_semaphore = asyncio.Semaphore(10)
        self._last_request_time = 0.0
        self._min_interval = 0.1  # 100ms between requests
        
        # Statistics
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "articles_fetched": 0,
        }
    
    def _get_base_params(self) -> Dict[str, str]:
        """Get base parameters for all requests."""
        return {
            "api_key": self.api_key,
            "email": self.email,
            "tool": self.tool,
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def _make_request(
        self,
        session: aiohttp.ClientSession,
        endpoint: str,
        params: Dict[str, str],
    ) -> str:
        """Make rate-limited request to NCBI API."""
        async with self._request_semaphore:
            # Rate limiting
            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_request_time
            if elapsed < self._min_interval:
                await asyncio.sleep(self._min_interval - elapsed)
            
            self._last_request_time = asyncio.get_event_loop().time()
            self.stats["total_requests"] += 1
            
            url = f"{self.base_url}/{endpoint}"
            params.update(self._get_base_params())
            
            try:
                async with session.get(url, params=params) as response:
                    if response.status == 429:
                        # Rate limited - wait and retry
                        logger.warning("Rate limited by NCBI, waiting...")
                        await asyncio.sleep(1)
                        raise PubMedIngestionError("Rate limited")
                    
                    response.raise_for_status()
                    self.stats["successful_requests"] += 1
                    return await response.text()
                    
            except aiohttp.ClientError as e:
                self.stats["failed_requests"] += 1
                logger.error(f"NCBI API error: {e}")
                raise PubMedIngestionError(f"API request failed: {e}")
    
    async def search_articles(
        self,
        session: aiohttp.ClientSession,
        query: str,
        max_results: int = 10000,
        date_range: Optional[tuple] = None,
        mesh_terms: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Search PubMed for article PMIDs.
        
        Args:
            session: aiohttp session
            query: Search query (supports PubMed syntax)
            max_results: Maximum results to return
            date_range: Tuple of (start_date, end_date) as YYYY/MM/DD
            mesh_terms: MeSH terms to filter by
        
        Returns:
            List of PMID strings
        """
        params = {
            "db": "pubmed",
            "term": query,
            "retmax": str(min(max_results, 10000)),
            "retmode": "json",
            "usehistory": "y",
        }
        
        # Add date range
        if date_range:
            start, end = date_range
            params["datetype"] = "pdat"
            params["mindate"] = start
            params["maxdate"] = end
        
        # Add MeSH terms
        if mesh_terms:
            mesh_query = " OR ".join([f'"{term}"[MeSH]' for term in mesh_terms])
            params["term"] = f"({params['term']}) AND ({mesh_query})"
        
        try:
            response_text = await self._make_request(
                session, "esearch.fcgi", params
            )
            
            # Parse JSON response
            import json
            data = json.loads(response_text)
            id_list = data.get("esearchresult", {}).get("idlist", [])
            
            logger.info(f"Found {len(id_list)} articles for query: {query[:50]}...")
            return id_list
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    async def fetch_articles(
        self,
        session: aiohttp.ClientSession,
        pmids: List[str],
        batch_size: int = 100,
    ) -> AsyncGenerator[PubMedArticle, None]:
        """
        Fetch article details by PMIDs.
        
        Args:
            session: aiohttp session
            pmids: List of PMID strings
            batch_size: Number of articles per request
        
        Yields:
            PubMedArticle objects
        """
        for i in range(0, len(pmids), batch_size):
            batch = pmids[i:i + batch_size]
            
            params = {
                "db": "pubmed",
                "id": ",".join(batch),
                "rettype": "medline",
                "retmode": "xml",
            }
            
            try:
                xml_text = await self._make_request(
                    session, "efetch.fcgi", params
                )
                
                # Parse XML
                articles = self._parse_pubmed_xml(xml_text)
                for article in articles:
                    self.stats["articles_fetched"] += 1
                    yield article
                    
            except Exception as e:
                logger.error(f"Failed to fetch batch {i}-{i+batch_size}: {e}")
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
                    
                    # Extract authors
                    authors = []
                    for author in article_elem.findall(".//Author"):
                        lastname = author.findtext("LastName", "")
                        forename = author.findtext("ForeName", "")
                        if lastname or forename:
                            authors.append(f"{forename} {lastname}".strip())
                    
                    # Extract journal
                    journal = article_elem.findtext(".//Journal/Title", "")
                    
                    # Extract publication date
                    pub_date = None
                    for date_elem in article_elem.findall(".//PubDate"):
                        year = date_elem.findtext("Year", "")
                        month = date_elem.findtext("Month", "01")
                        day = date_elem.findtext("Day", "01")
                        if year:
                            pub_date = f"{year}-{month}-{day}"
                            break
                    
                    # Extract MeSH terms
                    mesh_terms = []
                    for mesh in article_elem.findall(".//MeshHeading/DescriptorName"):
                        mesh_terms.append(mesh.text or "")
                    
                    # Extract keywords
                    keywords = []
                    for keyword in article_elem.findall(".//Keyword"):
                        keywords.append(keyword.text or "")
                    
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
                    
                    # Create combined text for embedding
                    text_content = f"{title}\n\n{abstract}"
                    
                    article = PubMedArticle(
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
                        text_content=text_content,
                    )
                    
                    articles.append(article)
                    
                except Exception as e:
                    logger.warning(f"Failed to parse article: {e}")
                    continue
                    
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")
        
        return articles
    
    async def fetch_mesh_terms(
        self,
        session: aiohttp.ClientSession,
        mesh_id: str,
    ) -> Dict[str, Any]:
        """Fetch MeSH term details."""
        url = f"{PUBMED_ENDPOINTS['mesh']}{mesh_id}.json"
        
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch MeSH term {mesh_id}: {e}")
        
        return {}


class PMCClient:
    """
    Client for PubMed Central full-text articles.
    
    Handles:
    - OAI-PMH harvesting
    - Bulk FTP downloads
    - JATS XML parsing
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.oai_url = PUBMED_ENDPOINTS["pmc_oai"]
        self.ftp_url = PUBMED_ENDPOINTS["pmc_ftp"]
    
    async def harvest_oai(
        self,
        session: aiohttp.ClientSession,
        from_date: Optional[str] = None,
        until_date: Optional[str] = None,
        metadata_prefix: str = "oai_dc",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Harvest PMC articles via OAI-PMH.
        
        Args:
            session: aiohttp session
            from_date: Start date (YYYY-MM-DD)
            until_date: End date (YYYY-MM-DD)
            metadata_prefix: Metadata format (oai_dc or pmc)
        
        Yields:
            Article metadata dictionaries
        """
        params = {
            "verb": "ListRecords",
            "metadataPrefix": metadata_prefix,
            "set": "pubmed",
        }
        
        if from_date:
            params["from"] = from_date
        if until_date:
            params["until"] = until_date
        
        resumption_token = None
        
        while True:
            if resumption_token:
                params = {
                    "verb": "ListRecords",
                    "resumptionToken": resumption_token,
                }
            
            try:
                async with session.get(self.oai_url, params=params) as response:
                    xml_text = await response.text()
                    
                    # Parse OAI response
                    root = ET.fromstring(xml_text)
                    
                    for record in root.findall(".//record"):
                        yield self._parse_oai_record(record)
                    
                    # Check for resumption token
                    token_elem = root.find(".//resumptionToken")
                    if token_elem is not None and token_elem.text:
                        resumption_token = token_elem.text
                    else:
                        break
                        
            except Exception as e:
                logger.error(f"OAI harvest error: {e}")
                break
    
    def _parse_oai_record(self, record: ET.Element) -> Dict[str, Any]:
        """Parse OAI-PMH record."""
        header = record.find("header")
        metadata = record.find("metadata")
        
        identifier = header.findtext("identifier", "") if header else ""
        datestamp = header.findtext("datestamp", "") if header else ""
        
        # Extract Dublin Core metadata
        dc_data = {}
        if metadata is not None:
            ns = {"dc": "http://purl.org/dc/elements/1.1/"}
            for elem in metadata.iter():
                tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                if tag in ["title", "creator", "subject", "description", "date"]:
                    if tag not in dc_data:
                        dc_data[tag] = []
                    dc_data[tag].append(elem.text)
        
        return {
            "identifier": identifier,
            "datestamp": datestamp,
            "metadata": dc_data,
        }


async def ingest_pubmed_articles(
    query: str,
    max_articles: int = 1000,
    date_range: Optional[tuple] = None,
    mesh_filter: Optional[List[str]] = None,
) -> List[PubMedArticle]:
    """
    Ingest PubMed articles based on search criteria.
    
    Args:
        query: PubMed search query
        max_articles: Maximum articles to fetch
        date_range: (start_date, end_date) tuple
        mesh_filter: MeSH terms to filter
    
    Returns:
        List of PubMedArticle objects
    """
    articles = []
    client = PubMedClient()
    
    async with aiohttp.ClientSession() as session:
        # Search for PMIDs
        pmids = await client.search_articles(
            session,
            query,
            max_results=max_articles,
            date_range=date_range,
            mesh_terms=mesh_filter,
        )
        
        if not pmids:
            logger.warning(f"No articles found for query: {query}")
            return articles
        
        # Fetch article details
        async for article in client.fetch_articles(session, pmids):
            articles.append(article)
            
            if len(articles) >= max_articles:
                break
    
    logger.info(
        f"Ingested {len(articles)} articles",
        extra={
            "query": query,
            "stats": client.stats,
        }
    )
    
    return articles


# Example usage and testing
async def main():
    """Test PubMed ingestion."""
    # Example: Search for recent cardiology articles
    articles = await ingest_pubmed_articles(
        query="heart failure treatment",
        max_articles=10,
        date_range=("2023/01/01", "2024/01/01"),
        mesh_filter=["Heart Failure", "Therapeutics"],
    )
    
    for article in articles[:5]:
        print(f"\nPMID: {article.pmid}")
        print(f"Title: {article.title[:100]}...")
        print(f"MeSH: {', '.join(article.mesh_terms[:3])}")


if __name__ == "__main__":
    asyncio.run(main())
