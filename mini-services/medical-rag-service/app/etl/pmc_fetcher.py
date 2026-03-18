"""
PMC Full-Text Fetcher Module
============================

Fetches full-text articles from PubMed Central (PMC) using:
- OAI-PMH API: https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/
- FTP Bulk: ftp.ncbi.nlm.nih.gov/pub/pmc/oa_bulk/
- Docs: https://pmc.ncbi.nlm.nih.gov/tools/oai/

Features:
- OAI ListRecords with filters (pub_date, set=pubmed)
- JATS XML parsing for article structure
- Incremental updates (only new articles since last sync)
- Progress tracking (articles fetched/total)
- Error handling for malformed XML
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import hashlib
import json
import time
import re
from enum import Enum

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import get_settings


# ===== Constants =====

PMC_API_URLS = {
    "oai": "https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/",
    "oai_legacy": "https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi",
    "ftp": "ftp.ncbi.nlm.nih.gov/pub/pmc/",
    "oa_bulk": "ftp.ncbi.nlm.nih.gov/pub/pmc/oa_bulk/",
    "id_converter": "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/",
}

# OAI-PMH metadata prefixes
class MetadataPrefix(str, Enum):
    PMC = "pmc"  # Full JATS XML
    PMC_FM = "pmc_fm"  # Front matter only
    OAI_DC = "oai_dc"  # Dublin Core


# JATS XML namespaces
JATS_NAMESPACES = {
    "jats": "http://jats.nlm.nih.gov/ns/archiving/1.2/",
    "mml": "http://www.w3.org/1998/Math/MathML",
    "xlink": "http://www.w3.org/1999/xlink",
}


class PMCError(Exception):
    """Base exception for PMC API errors."""
    pass


class OAIPMHError(PMCError):
    """OAI-PMH protocol error."""
    pass


class JATSParseError(PMCError):
    """JATS XML parsing error."""
    pass


@dataclass
class ArticleSection:
    """Represents a section of a PMC article."""
    section_type: str  # abstract, introduction, methods, results, discussion, conclusion
    heading: str
    content: str
    subsections: List["ArticleSection"] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "section_type": self.section_type,
            "heading": self.heading,
            "content": self.content[:2000],  # Truncate for storage
            "subsections": [s.to_dict() for s in self.subsections],
        }


@dataclass
class PMCArticle:
    """Structured PMC full-text article."""
    pmc_id: str
    pmid: Optional[str] = None
    doi: Optional[str] = None
    title: str = ""
    abstract: str = ""
    full_text: str = ""
    sections: List[ArticleSection] = field(default_factory=list)
    authors: List[Dict[str, str]] = field(default_factory=list)  # [{name, affiliation, email}]
    affiliations: List[str] = field(default_factory=list)
    journal: str = ""
    journal_issn: Optional[str] = None
    publication_date: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    references: List[Dict[str, str]] = field(default_factory=list)
    article_type: str = ""
    license: str = ""
    
    @property
    def text_content(self) -> str:
        """Combined text for embedding."""
        parts = [f"Title: {self.title}"]
        if self.abstract:
            parts.append(f"Abstract: {self.abstract}")
        if self.sections:
            for section in self.sections:
                parts.append(f"{section.heading}: {section.content}")
        return "\n\n".join(parts)
    
    @property
    def content_hash(self) -> str:
        """Generate hash for deduplication."""
        content = f"{self.pmc_id}:{self.title}:{self.abstract[:100]}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "pmc_id": self.pmc_id,
            "pmid": self.pmid,
            "doi": self.doi,
            "title": self.title,
            "abstract": self.abstract,
            "full_text": self.full_text[:10000],  # Truncate
            "sections": [s.to_dict() for s in self.sections],
            "authors": self.authors,
            "journal": self.journal,
            "journal_issn": self.journal_issn,
            "publication_date": self.publication_date,
            "volume": self.volume,
            "issue": self.issue,
            "pages": self.pages,
            "keywords": self.keywords,
            "mesh_terms": self.mesh_terms,
            "article_type": self.article_type,
            "license": self.license,
            "text_content": self.text_content[:15000],
        }


@dataclass
class OAIRecord:
    """OAI-PMH record metadata."""
    identifier: str
    datestamp: str
    sets: List[str]
    metadata: Dict[str, Any]
    deleted: bool = False


@dataclass
class HarvestStats:
    """Statistics for OAI harvest operations."""
    total_requests: int = 0
    records_harvested: int = 0
    records_deleted: int = 0
    errors: int = 0
    bytes_received: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def duration_seconds(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "records_harvested": self.records_harvested,
            "records_deleted": self.records_deleted,
            "errors": self.errors,
            "bytes_received": self.bytes_received,
            "duration_seconds": round(self.duration_seconds, 2),
        }


class PMCFetcher:
    """
    PMC full-text article fetcher using OAI-PMH protocol.
    
    Features:
    - OAI-PMH harvesting with resumption tokens
    - JATS XML parsing for article structure
    - Incremental updates via date filtering
    - Progress tracking
    - Graceful error handling for malformed XML
    
    OAI-PMH Operations:
    - ListRecords: Bulk harvest with filters
    - GetRecord: Fetch specific article
    - ListSets: Available collections
    - ListIdentifiers: PMCID listing without content
    
    Usage:
        async with PMCFetcher() as fetcher:
            # Harvest recent articles
            async for article in fetcher.harvest_articles(from_date="2024-01-01"):
                print(article.title)
            
            # Fetch specific article
            article = await fetcher.get_article("PMC1234567")
    """
    
    def __init__(
        self,
        email: str = "medical-rag@z.ai",
        tool: str = "medical_diagnostic_rag",
    ):
        self.settings = get_settings()
        self.email = email
        self.tool = tool
        self.oai_url = PMC_API_URLS["oai"]
        
        # Rate limiting: 3 requests/second for OAI
        self._min_interval = 0.35  # ~3 req/sec
        self._last_request_time = 0.0
        self._request_semaphore = asyncio.Semaphore(3)
        
        # Session management
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Statistics
        self.stats = HarvestStats()
        
        logger.info("PMCFetcher initialized (OAI-PMH, 3 req/sec)")
    
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
            timeout = aiohttp.ClientTimeout(total=180, connect=10)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    "User-Agent": f"{self.tool}/1.0 ({self.email})",
                    "Accept": "application/xml",
                    "Accept-Encoding": "gzip, deflate",
                }
            )
        return self._session
    
    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
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
        reraise=True,
    )
    async def _make_oai_request(
        self,
        params: Dict[str, str],
    ) -> str:
        """Make rate-limited OAI-PMH request."""
        session = await self._ensure_session()
        
        async with self._request_semaphore:
            await self._rate_limit_wait()
            
            self.stats.total_requests += 1
            
            try:
                async with session.get(self.oai_url, params=params) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise PMCError(f"OAI error {response.status}: {error_text[:200]}")
                    
                    content = await response.text()
                    self.stats.bytes_received += len(content)
                    return content
                    
            except aiohttp.ClientError as e:
                self.stats.errors += 1
                logger.error(f"OAI request error: {e}")
                raise PMCError(f"Request failed: {e}")
    
    async def list_sets(self) -> List[Dict[str, str]]:
        """
        List available OAI sets (journal/subject collections).
        
        Returns:
            List of {setSpec, setName} dictionaries
        """
        params = {"verb": "ListSets"}
        
        try:
            xml_text = await self._make_oai_request(params)
            root = ET.fromstring(xml_text)
            
            sets = []
            for set_elem in root.findall(".//set"):
                set_spec = set_elem.findtext("setSpec", "")
                set_name = set_elem.findtext("setName", "")
                if set_spec:
                    sets.append({"setSpec": set_spec, "setName": set_name})
            
            return sets
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse ListSets response: {e}")
            return []
    
    async def list_identifiers(
        self,
        from_date: Optional[str] = None,
        until_date: Optional[str] = None,
        set_spec: str = "pubmed",
    ) -> AsyncGenerator[str, None]:
        """
        List PMCIDs without fetching full content.
        
        Args:
            from_date: Start date (YYYY-MM-DD)
            until_date: End date (YYYY-MM-DD)
            set_spec: OAI set to harvest
        
        Yields:
            PMCIDs as strings
        """
        params = {
            "verb": "ListIdentifiers",
            "metadataPrefix": "oai_dc",
            "set": set_spec,
        }
        
        if from_date:
            params["from"] = from_date
        if until_date:
            params["until"] = until_date
        
        resumption_token = None
        
        while True:
            if resumption_token:
                params = {
                    "verb": "ListIdentifiers",
                    "resumptionToken": resumption_token,
                }
            
            try:
                xml_text = await self._make_oai_request(params)
                root = ET.fromstring(xml_text)
                
                # Check for errors
                error = root.find(".//error")
                if error is not None:
                    logger.warning(f"OAI error: {error.text}")
                    break
                
                # Extract identifiers
                for header in root.findall(".//header"):
                    identifier = header.findtext("identifier", "")
                    # Extract PMCID from identifier like "oai:pubmedcentral.nih.gov:12345678"
                    if identifier:
                        pmcid_match = re.search(r'(\d+)$', identifier)
                        if pmcid_match:
                            yield f"PMC{pmcid_match.group(1)}"
                
                # Get resumption token for pagination
                token_elem = root.find(".//resumptionToken")
                if token_elem is not None and token_elem.text:
                    resumption_token = token_elem.text
                    # Check if complete
                    cursor = token_elem.get("cursor", "0")
                    complete_list_size = token_elem.get("completeListSize", "0")
                    logger.debug(f"Progress: {cursor}/{complete_list_size}")
                else:
                    break
                    
            except ET.ParseError as e:
                logger.error(f"XML parsing error: {e}")
                break
    
    async def harvest_records(
        self,
        from_date: Optional[str] = None,
        until_date: Optional[str] = None,
        set_spec: str = "pmc-open",
        metadata_prefix: str = "pmc",
    ) -> AsyncGenerator[OAIRecord, None]:
        """
        Harvest PMC records via OAI-PMH ListRecords.
        
        Args:
            from_date: Start date (YYYY-MM-DD) for incremental updates
            until_date: End date (YYYY-MM-DD)
            set_spec: OAI set (pmc-open for open access articles)
            metadata_prefix: Metadata format (pmc, oai_dc)
        
        Yields:
            OAIRecord objects with article metadata
        
        Note: Max 10 records per request as of Sept 2025
        """
        self.stats.start_time = datetime.utcnow()
        
        params = {
            "verb": "ListRecords",
            "metadataPrefix": metadata_prefix,
            "set": set_spec,
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
                xml_text = await self._make_oai_request(params)
                root = ET.fromstring(xml_text)
                
                # Check for OAI errors
                error = root.find(".//error")
                if error is not None:
                    error_code = error.get("code", "")
                    if error_code == "noRecordsMatch":
                        logger.info("No records match the criteria")
                        break
                    raise OAIPMHError(f"OAI error: {error.text} (code: {error_code})")
                
                # Parse records
                for record_elem in root.findall(".//record"):
                    try:
                        record = self._parse_oai_record(record_elem)
                        
                        if record.deleted:
                            self.stats.records_deleted += 1
                        else:
                            self.stats.records_harvested += 1
                            yield record
                            
                    except Exception as e:
                        self.stats.errors += 1
                        logger.warning(f"Failed to parse record: {e}")
                        continue
                
                # Get resumption token
                token_elem = root.find(".//resumptionToken")
                if token_elem is not None and token_elem.text:
                    resumption_token = token_elem.text
                    
                    # Progress tracking
                    cursor = token_elem.get("cursor", "0")
                    complete_list_size = token_elem.get("completeListSize", "?")
                    logger.info(
                        f"Harvest progress: {self.stats.records_harvested} records "
                        f"(cursor: {cursor}/{complete_list_size})"
                    )
                else:
                    break
                    
            except ET.ParseError as e:
                self.stats.errors += 1
                logger.error(f"XML parsing error: {e}")
                # Try to continue with next batch
                break
        
        self.stats.end_time = datetime.utcnow()
        logger.info(f"Harvest complete: {self.stats.to_dict()}")
    
    def _parse_oai_record(self, record_elem: ET.Element) -> OAIRecord:
        """Parse OAI-PMH record element."""
        header = record_elem.find("header")
        metadata = record_elem.find("metadata")
        
        # Check if deleted
        deleted = header.get("status") == "deleted" if header is not None else False
        
        # Extract header info
        identifier = header.findtext("identifier", "") if header else ""
        datestamp = header.findtext("datestamp", "") if header else ""
        sets = [s.text for s in header.findall("setSpec")] if header else []
        
        # Extract PMCID
        pmcid_match = re.search(r'(\d+)$', identifier)
        pmc_id = f"PMC{pmcid_match.group(1)}" if pmcid_match else ""
        
        # Parse metadata
        metadata_dict = {}
        if metadata is not None:
            metadata_dict["pmc_id"] = pmc_id
            metadata_dict["raw_xml"] = ET.tostring(metadata, encoding="unicode")
        
        return OAIRecord(
            identifier=identifier,
            datestamp=datestamp,
            sets=sets,
            metadata=metadata_dict,
            deleted=deleted,
        )
    
    async def get_article(
        self,
        pmc_id: str,
        metadata_prefix: str = "pmc",
    ) -> Optional[PMCArticle]:
        """
        Fetch a specific article by PMCID.
        
        Args:
            pmc_id: PMC ID (with or without "PMC" prefix)
            metadata_prefix: Metadata format
        
        Returns:
            PMCArticle with full text, or None if not found
        """
        # Normalize PMCID format
        if pmc_id.upper().startswith("PMC"):
            pmc_num = pmc_id[3:]
        else:
            pmc_num = pmc_id
        
        oai_identifier = f"oai:pubmedcentral.nih.gov:{pmc_num}"
        
        params = {
            "verb": "GetRecord",
            "identifier": oai_identifier,
            "metadataPrefix": metadata_prefix,
        }
        
        try:
            xml_text = await self._make_oai_request(params)
            root = ET.fromstring(xml_text)
            
            # Check for errors
            error = root.find(".//error")
            if error is not None:
                logger.warning(f"Article {pmc_id} not found: {error.text}")
                return None
            
            # Parse article
            record = root.find(".//record")
            if record is not None:
                metadata = record.find("metadata")
                if metadata is not None:
                    return self._parse_jats_article(metadata, f"PMC{pmc_num}")
            
            return None
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse article {pmc_id}: {e}")
            return None
    
    def _parse_jats_article(self, metadata: ET.Element, pmc_id: str) -> PMCArticle:
        """
        Parse JATS XML article structure.
        
        Extracts:
        - Title, abstract
        - Sections: introduction, methods, results, discussion
        - Authors with affiliations
        - Journal metadata
        - References
        """
        article = PMCArticle(pmc_id=pmc_id)
        
        # Find article element (may be nested)
        article_elem = metadata.find(".//article")
        if article_elem is None:
            # Try direct children
            article_elem = metadata
        
        # Extract front matter
        front = article_elem.find(".//front") or article_elem
        
        # Article meta
        article_meta = front.find(".//article-meta")
        if article_meta is None:
            article_meta = front
        
        # Title
        title_group = article_meta.find(".//title-group")
        if title_group is not None:
            article.title = title_group.findtext("article-title", "")
        
        # Abstract
        abstract_elem = article_meta.find(".//abstract")
        if abstract_elem is not None:
            article.abstract = self._extract_text_content(abstract_elem)
        
        # Authors
        for contrib in article_meta.findall(".//contrib[@contrib-type='author']"):
            author = {}
            
            name = contrib.find(".//name")
            if name is not None:
                given = name.findtext("given-names", "")
                surname = name.findtext("surname", "")
                author["name"] = f"{given} {surname}".strip()
            
            # Affiliation
            aff = contrib.find(".//aff")
            if aff is not None:
                author["affiliation"] = aff.findtext("institution", "")
            
            # Email
            email = contrib.find(".//email")
            if email is not None:
                author["email"] = email.text or ""
            
            if author.get("name"):
                article.authors.append(author)
        
        # Affiliations list
        for aff in article_meta.findall(".//aff"):
            inst = aff.findtext("institution", "")
            if inst:
                article.affiliations.append(inst)
        
        # Journal info
        journal_meta = front.find(".//journal-meta")
        if journal_meta is not None:
            article.journal = journal_meta.findtext(".//journal-title", "")
            
            for issn in journal_meta.findall(".//issn"):
                article.journal_issn = issn.text
                break
        
        # Publication date
        pub_date = article_meta.find(".//pub-date")
        if pub_date is not None:
            year = pub_date.findtext("year", "")
            month = pub_date.findtext("month", "01")
            day = pub_date.findtext("day", "01")
            if year:
                article.publication_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
        # Volume/Issue/Pages
        article.volume = article_meta.findtext(".//volume")
        article.issue = article_meta.findtext(".//issue")
        
        fpage = article_meta.findtext(".//fpage")
        lpage = article_meta.findtext(".//lpage")
        if fpage and lpage:
            article.pages = f"{fpage}-{lpage}"
        elif fpage:
            article.pages = fpage
        
        # DOI
        for article_id in article_meta.findall(".//article-id"):
            if article_id.get("pub-id-type") == "doi":
                article.doi = article_id.text
            elif article_id.get("pub-id-type") == "pmid":
                article.pmid = article_id.text
        
        # Keywords
        for kwd in article_meta.findall(".//kwd"):
            if kwd.text:
                article.keywords.append(kwd.text)
        
        # Extract body (full text sections)
        body = article_elem.find(".//body")
        if body is not None:
            article.sections = self._parse_body_sections(body)
            article.full_text = self._extract_text_content(body)
        
        # Extract references
        back = article_elem.find(".//back")
        if back is not None:
            for ref in back.findall(".//ref"):
                ref_info = {}
                ref_info["pmid"] = ref.findtext(".//pub-id[@pub-id-type='pmid']")
                ref_info["doi"] = ref.findtext(".//pub-id[@pub-id-type='doi']")
                ref_info["title"] = ref.findtext(".//article-title")
                if any(ref_info.values()):
                    article.references.append(ref_info)
        
        # License
        for license_elem in article_meta.findall(".//license"):
            license_type = license_elem.get("license-type", "")
            if license_type:
                article.license = license_type
        
        return article
    
    def _parse_body_sections(self, body: ET.Element) -> List[ArticleSection]:
        """Parse body into structured sections."""
        sections = []
        
        for sec in body.findall(".//sec"):
            section_type = self._determine_section_type(sec)
            heading = sec.findtext("title", "")
            content = self._extract_text_content(sec)
            
            # Skip empty sections
            if not content.strip():
                continue
            
            # Parse subsections
            subsections = []
            for subsec in sec.findall("sec"):
                sub_heading = subsec.findtext("title", "")
                sub_content = self._extract_text_content(subsec)
                if sub_content.strip():
                    subsections.append(ArticleSection(
                        section_type=f"{section_type}_sub",
                        heading=sub_heading,
                        content=sub_content,
                    ))
            
            sections.append(ArticleSection(
                section_type=section_type,
                heading=heading,
                content=content,
                subsections=subsections,
            ))
        
        return sections
    
    def _determine_section_type(self, section: ET.Element) -> str:
        """Determine section type from content."""
        title = section.findtext("title", "").lower()
        sec_type = section.get("sec-type", "").lower()
        
        # Known section types
        type_mapping = {
            "introduction": ["introduction", "background"],
            "methods": ["methods", "methodology", "materials and methods", "patients and methods"],
            "results": ["results", "findings"],
            "discussion": ["discussion", "comments"],
            "conclusion": ["conclusion", "conclusions", "summary"],
            "case": ["case presentation", "case report"],
            "abstract": ["abstract", "summary"],
        }
        
        for section_type, keywords in type_mapping.items():
            if sec_type in keywords:
                return section_type
            for keyword in keywords:
                if keyword in title:
                    return section_type
        
        return "other"
    
    def _extract_text_content(self, element: ET.Element) -> str:
        """Extract all text content from an element."""
        texts = []
        for elem in element.iter():
            if elem.text:
                texts.append(elem.text)
            if elem.tail:
                texts.append(elem.tail)
        
        # Clean and join
        content = " ".join(texts)
        content = re.sub(r'\s+', ' ', content)  # Normalize whitespace
        return content.strip()
    
    async def harvest_articles(
        self,
        from_date: Optional[str] = None,
        until_date: Optional[str] = None,
        set_spec: str = "pmc-open",
        max_articles: int = 10000,
    ) -> AsyncGenerator[PMCArticle, None]:
        """
        Harvest PMC articles with full text.
        
        Args:
            from_date: Start date for incremental updates
            until_date: End date
            set_spec: OAI set (pmc-open for open access)
            max_articles: Maximum articles to harvest
        
        Yields:
            PMCArticle objects with full text
        """
        count = 0
        
        async for record in self.harvest_records(
            from_date=from_date,
            until_date=until_date,
            set_spec=set_spec,
            metadata_prefix="pmc",
        ):
            if count >= max_articles:
                break
            
            try:
                # Parse JATS XML from metadata
                raw_xml = record.metadata.get("raw_xml", "")
                if raw_xml:
                    metadata = ET.fromstring(f"<metadata>{raw_xml}</metadata>")
                    article = self._parse_jats_article(metadata, record.metadata.get("pmc_id", ""))
                    
                    if article.title:  # Only yield valid articles
                        yield article
                        count += 1
                        
            except Exception as e:
                logger.warning(f"Failed to parse article: {e}")
                continue
    
    def get_stats(self) -> Dict[str, Any]:
        """Get harvest statistics."""
        return self.stats.to_dict()


# ===== ID Converter =====

async def convert_pmid_to_pmcid(
    pmids: List[str],
    email: str = "medical-rag@z.ai",
) -> Dict[str, str]:
    """
    Convert PMIDs to PMCIDs using PMC ID Converter API.
    
    Args:
        pmids: List of PMIDs
        email: Email for API
    
    Returns:
        Dictionary mapping PMID to PMCID
    """
    if not pmids:
        return {}
    
    url = PMC_API_URLS["id_converter"]
    params = {
        "ids": ",".join(pmids),
        "tool": "medical_diagnostic_rag",
        "email": email,
        "format": "json",
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    result = {}
                    for record in data.get("records", []):
                        pmid = record.get("pmid")
                        pmcid = record.get("pmcid")
                        if pmid and pmcid:
                            result[pmid] = pmcid
                    
                    return result
                    
        except Exception as e:
            logger.error(f"ID conversion error: {e}")
    
    return {}


# ===== Convenience Functions =====

async def fetch_pmc_article(pmc_id: str) -> Optional[PMCArticle]:
    """Convenience function to fetch a single PMC article."""
    async with PMCFetcher() as fetcher:
        return await fetcher.get_article(pmc_id)


async def harvest_recent_pmc_articles(
    days: int = 7,
    max_articles: int = 1000,
) -> List[PMCArticle]:
    """
    Harvest recent PMC articles from the last N days.
    
    Args:
        days: Number of days to look back
        max_articles: Maximum articles to fetch
    
    Returns:
        List of PMCArticle objects
    """
    articles = []
    from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    async with PMCFetcher() as fetcher:
        async for article in fetcher.harvest_articles(
            from_date=from_date,
            max_articles=max_articles,
        ):
            articles.append(article)
    
    logger.info(f"Harvested {len(articles)} recent PMC articles")
    return articles


# ===== Unit Tests =====
# NOTE: Test class moved to tests/test_pmc_fetcher.py
# Do not import pytest here to avoid production import errors


if __name__ == "__main__":
    # Example usage
    async def main():
        async with PMCFetcher() as fetcher:
            # List available sets
            sets = await fetcher.list_sets()
            print(f"Available sets: {len(sets)}")
            
            # Harvest recent articles
            count = 0
            async for article in fetcher.harvest_articles(
                from_date="2024-01-01",
                max_articles=5,
            ):
                print(f"\nPMC ID: {article.pmc_id}")
                print(f"Title: {article.title[:80]}...")
                print(f"Sections: {len(article.sections)}")
                print(f"Authors: {len(article.authors)}")
                
                count += 1
                if count >= 5:
                    break
            
            # Print stats
            print(f"\nStats: {fetcher.get_stats()}")
    
    asyncio.run(main())
