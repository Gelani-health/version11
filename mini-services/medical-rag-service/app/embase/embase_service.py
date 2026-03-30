"""
EMBASE Integration Module
=========================

Integrates EMBASE (Excerpta Medica Database) for comprehensive biomedical literature:
- 32+ million records from 8,500+ journals
- Strong drug and pharmacology coverage
- European and international coverage
- Medline overlap management

This module provides integration with Elsevier EMBASE API for comprehensive
biomedical literature searching beyond PubMed.

References:
- EMBASE: https://www.embase.com/
- Elsevier APIs: https://dev.elsevier.com/

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

import asyncio
import aiohttp
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import re

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential


class EMBASESource(Enum):
    """EMBASE content sources."""
    EMBASE = "embase"  # EMBASE records only
    MEDLINE = "medline"  # MEDLINE records only
    ALL = "all"  # Combined EMBASE and MEDLINE


class ArticleType(Enum):
    """Article types in EMBASE."""
    ARTICLE = "article"
    REVIEW = "review"
    CLINICAL_TRIAL = "clinical_trial"
    CASE_REPORT = "case_report"
    EDITORIAL = "editorial"
    LETTER = "letter"
    CONFERENCE_PAPER = "conference_paper"


@dataclass
class EMBASEArticle:
    """EMBASE article record."""
    embase_id: str
    title: str
    abstract: str
    authors: List[str]
    journal: str
    publication_date: Optional[str]
    doi: Optional[str] = None
    pmid: Optional[str] = None
    
    # EMBASE-specific fields
    drug_names: List[str] = field(default_factory=list)
    emtree_terms: List[str] = field(default_factory=list)  # EMTREE thesaurus terms
    cas_numbers: List[str] = field(default_factory=list)  # Chemical Abstracts registry
    trade_names: List[str] = field(default_factory=list)
    device_tradenames: List[str] = field(default_factory=list)
    
    # Source info
    source: EMBASESource = EMBASESource.ALL
    article_type: ArticleType = ArticleType.ARTICLE
    
    # Additional metadata
    keywords: List[str] = field(default_factory=list)
    language: str = "English"
    country: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "embase_id": self.embase_id,
            "title": self.title,
            "abstract": self.abstract[:500],
            "authors": self.authors[:10],
            "journal": self.journal,
            "publication_date": self.publication_date,
            "doi": self.doi,
            "pmid": self.pmid,
            "drug_names": self.drug_names[:10],
            "emtree_terms": self.emtree_terms[:10],
            "source": self.source.value,
        }
    
    @property
    def content_hash(self) -> str:
        """Generate hash for deduplication."""
        content = f"{self.embase_id}:{self.title}:{self.publication_date}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get_text_for_embedding(self) -> str:
        """Get combined text for embedding."""
        parts = [
            f"Title: {self.title}",
            f"Abstract: {self.abstract}",
        ]
        
        if self.drug_names:
            parts.append(f"Drugs: {', '.join(self.drug_names[:10])}")
        
        if self.emtree_terms:
            parts.append(f"Terms: {', '.join(self.emtree_terms[:10])}")
        
        return "\n\n".join(parts)


class EMBASEClient:
    """
    Client for EMBASE API access.
    
    Note: EMBASE requires institutional subscription through Elsevier.
    This client provides integration when API access is available.
    
    Features:
    - Advanced drug and pharmacology search
    - EMTREE thesaurus support
    - De-duplication with MEDLINE
    - Conference coverage
    """
    
    API_BASE_URL = "https://api.elsevier.com/content/search/embase"
    
    def __init__(self, api_key: Optional[str] = None, inst_token: Optional[str] = None):
        self.api_key = api_key
        self.inst_token = inst_token
        self._request_delay = 0.5
        self._last_request = 0.0
        self._request_semaphore = asyncio.Semaphore(3)
        
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "articles_fetched": 0,
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def search(
        self,
        session: aiohttp.ClientSession,
        query: str,
        max_results: int = 100,
        source: EMBASESource = EMBASESource.ALL,
        date_range: Optional[tuple] = None,
        article_types: Optional[List[ArticleType]] = None,
    ) -> List[EMBASEArticle]:
        """
        Search EMBASE for articles.
        
        Args:
            session: aiohttp session
            query: Search query (EMBASE syntax)
            max_results: Maximum results to return
            source: Content source filter
            date_range: (start_year, end_year) tuple
            article_types: Filter by article types
        
        Returns:
            List of EMBASEArticle objects
        """
        if not self.api_key:
            logger.warning("EMBASE API key not configured, returning empty results")
            return []
        
        async with self._request_semaphore:
            headers = {
                "X-ELS-APIKey": self.api_key,
                "Accept": "application/json",
            }
            
            if self.inst_token:
                headers["X-ELS-Insttoken"] = self.inst_token
            
            params = {
                "query": query,
                "count": str(min(max_results, 200)),
                "view": "COMPLETE",
            }
            
            # Add source filter
            if source == EMBASESource.EMBASE:
                params["query"] += " AND srctitle(embase)"
            elif source == EMBASESource.MEDLINE:
                params["query"] += " AND srctitle(medline)"
            
            # Add date range
            if date_range:
                start, end = date_range
                params["query"] += f" AND pubyear AFT {start} BEF {end}"
            
            # Add article type filter
            if article_types:
                type_query = " OR ".join([f"doctype({t.value})" for t in article_types])
                params["query"] += f" AND ({type_query})"
            
            try:
                self.stats["total_requests"] += 1
                
                async with session.get(self.API_BASE_URL, params=params, headers=headers) as response:
                    if response.status == 429:
                        logger.warning("Rate limited by EMBASE API")
                        await asyncio.sleep(5)
                        raise Exception("Rate limited")
                    
                    response.raise_for_status()
                    self.stats["successful_requests"] += 1
                    
                    data = await response.json()
                    articles = self._parse_search_results(data)
                    
                    self.stats["articles_fetched"] += len(articles)
                    return articles
                    
            except Exception as e:
                self.stats["failed_requests"] += 1
                logger.error(f"EMBASE API error: {e}")
                return []
    
    def _parse_search_results(self, data: Dict[str, Any]) -> List[EMBASEArticle]:
        """Parse EMBASE API search results."""
        articles = []
        
        results = data.get("search-results", {}).get("entry", [])
        
        for entry in results:
            try:
                # Extract basic fields
                embase_id = entry.get("dc:identifier", "").replace("EMBASE:", "")
                title = entry.get("dc:title", "")
                abstract = entry.get("dc:description", "")
                
                # Extract authors
                authors = []
                for author in entry.get("dc:creator", []):
                    if isinstance(author, dict):
                        authors.append(author.get("authname", ""))
                    elif isinstance(author, str):
                        authors.append(author)
                
                # Extract journal
                journal = entry.get("prism:publicationName", "")
                
                # Extract date
                pub_date = entry.get("prism:coverDate")
                
                # Extract identifiers
                doi = entry.get("prism:doi")
                pmid = entry.get("pubmed-id")
                
                # Extract EMTREE terms (drug thesaurus)
                emtree_terms = []
                for term in entry.get("authkeywords", []):
                    if isinstance(term, dict):
                        emtree_terms.append(term.get("$", ""))
                    elif isinstance(term, str):
                        emtree_terms.append(term)
                
                # Extract drug names (EMBASE specialty)
                drug_names = entry.get("drugname", [])
                if isinstance(drug_names, str):
                    drug_names = [drug_names]
                
                # Extract CAS numbers
                cas_numbers = entry.get("casregistrynumber", [])
                if isinstance(cas_numbers, str):
                    cas_numbers = [cas_numbers]
                
                # Determine source
                source_str = entry.get("srctitle", "").lower()
                if "embase" in source_str:
                    source = EMBASESource.EMBASE
                elif "medline" in source_str:
                    source = EMBASESource.MEDLINE
                else:
                    source = EMBASESource.ALL
                
                # Determine article type
                type_str = entry.get("doctype", "article").lower()
                try:
                    article_type = ArticleType(type_str.replace("-", "_"))
                except ValueError:
                    article_type = ArticleType.ARTICLE
                
                article = EMBASEArticle(
                    embase_id=embase_id,
                    title=title,
                    abstract=abstract,
                    authors=authors,
                    journal=journal,
                    publication_date=pub_date,
                    doi=doi,
                    pmid=pmid,
                    drug_names=drug_names,
                    emtree_terms=emtree_terms,
                    cas_numbers=cas_numbers,
                    source=source,
                    article_type=article_type,
                )
                
                articles.append(article)
                
            except Exception as e:
                logger.warning(f"Failed to parse EMBASE article: {e}")
                continue
        
        return articles
    
    async def search_drugs(
        self,
        session: aiohttp.ClientSession,
        drug_name: str,
        max_results: int = 100,
        include_adverse_events: bool = True,
    ) -> List[EMBASEArticle]:
        """
        Search for drug-related literature.
        
        This is EMBASE's strength - comprehensive drug and pharmacology coverage.
        
        Args:
            session: aiohttp session
            drug_name: Drug name (generic or trade)
            max_results: Maximum results
            include_adverse_events: Include adverse event studies
        
        Returns:
            List of EMBASEArticle objects
        """
        # EMBASE has superior drug indexing with EMTREE
        query = f'drugname("{drug_name}")'
        
        if include_adverse_events:
            query += ' OR (drugname("{}") AND adverse)'.format(drug_name)
        
        return await self.search(session, query, max_results)


# EMTREE Drug Terms Cache (High-Priority Drug Terms)
EMTREE_DRUG_TERMS: Dict[str, List[str]] = {
    "metformin": ["metformin", "dimethylbiguanide", "glucophage"],
    "lisinopril": ["lisinopril", "prinivil", "zestril"],
    "atorvastatin": ["atorvastatin", "lipitor"],
    "aspirin": ["aspirin", "acetylsalicylic acid", "asa"],
    "warfarin": ["warfarin", "coumadin", "jantoven"],
    "clopidogrel": ["clopidogrel", "plavix"],
    "insulin": ["insulin", "humulin", "novolin", "lantus"],
    "omeprazole": ["omeprazole", "prilosec", "losec"],
    "amlodipine": ["amlodipine", "norvasc"],
    "metoprolol": ["metoprolol", "lopressor", "toprol"],
    "apixaban": ["apixaban", "eliquis"],
    "rivaroxaban": ["rivaroxaban", "xarelto"],
    "dabigatran": ["dabigatran", "pradaxa"],
    "empagliflozin": ["empagliflozin", "jardiance"],
    "dapagliflozin": ["dapagliflozin", "forxiga"],
    "semaglutide": ["semaglutide", "ozempic", "wegovy"],
}


# EMBASE Unique Coverage Areas
EMBASE_UNIQUE_COVERAGE: List[Dict[str, Any]] = [
    {
        "area": "Pharmacology",
        "description": "Comprehensive drug and pharmacology literature coverage",
        "strength": "EMTREE drug indexing, trade names, CAS numbers",
    },
    {
        "area": "European Literature",
        "description": "Strong coverage of European biomedical journals",
        "strength": "Non-English language coverage, European conferences",
    },
    {
        "area": "Conference Proceedings",
        "description": "Extensive conference paper coverage",
        "strength": "1000+ conference sources, early research findings",
    },
    {
        "area": "Medical Devices",
        "description": "Medical device literature and safety",
        "strength": "Device trade names, device safety studies",
    },
    {
        "area": "Adverse Drug Reactions",
        "description": "Comprehensive adverse event literature",
        "strength": "Drug safety signals, pharmacovigilance",
    },
]


async def search_embase(
    query: str,
    max_results: int = 100,
    api_key: Optional[str] = None,
) -> List[EMBASEArticle]:
    """
    Search EMBASE for biomedical literature.
    
    Args:
        query: Search query
        max_results: Maximum results to return
        api_key: Elsevier API key (optional, will use environment if not provided)
    
    Returns:
        List of EMBASEArticle objects
    """
    client = EMBASEClient(api_key=api_key)
    
    async with aiohttp.ClientSession() as session:
        return await client.search(session, query, max_results)


async def search_drug_literature(
    drug_name: str,
    max_results: int = 100,
    api_key: Optional[str] = None,
) -> List[EMBASEArticle]:
    """
    Search for comprehensive drug literature.
    
    Uses EMBASE's superior drug indexing.
    
    Args:
        drug_name: Drug name to search
        max_results: Maximum results
        api_key: Elsevier API key
    
    Returns:
        List of EMBASEArticle objects
    """
    client = EMBASEClient(api_key=api_key)
    
    async with aiohttp.ClientSession() as session:
        return await client.search_drugs(session, drug_name, max_results)


def get_emtree_terms(drug_name: str) -> List[str]:
    """Get EMTREE terms for a drug."""
    drug_lower = drug_name.lower()
    return EMTREE_DRUG_TERMS.get(drug_lower, [drug_name])


def build_drug_query(drug_name: str, include_adverse: bool = True) -> str:
    """Build an EMBASE drug search query."""
    terms = get_emtree_terms(drug_name)
    
    query_parts = []
    for term in terms:
        query_parts.append(f'drugname("{term}")')
        query_parts.append(f'tradename("{term}")')
    
    query = " OR ".join(query_parts)
    
    if include_adverse:
        query = f"({query}) AND (adverse OR safety OR toxicity)"
    
    return query


# Example usage
async def main():
    """Test EMBASE integration."""
    # Note: Requires API key for actual use
    articles = await search_embase(
        query="metformin AND cardiovascular",
        max_results=10,
    )
    
    for article in articles[:5]:
        print(f"\nID: {article.embase_id}")
        print(f"Title: {article.title[:80]}...")
        print(f"Drugs: {', '.join(article.drug_names[:3])}")
        print(f"Source: {article.source.value}")


if __name__ == "__main__":
    asyncio.run(main())
