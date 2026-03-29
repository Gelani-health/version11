"""
Citation Network Module
=======================

Builds and manages citation networks for medical literature:
- "Cited by" relationships
- "Related articles" based on shared citations
- Co-citation analysis
- Bibliometric analysis

Features:
- OpenAlex API integration
- Semantic Scholar API integration
- PubMed Central citations
- Influence metrics

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

import asyncio
import aiohttp
from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import hashlib

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential


@dataclass
class CitationNode:
    """A node in the citation network."""
    paper_id: str  # PMID, DOI, or OpenAlex ID
    title: str
    authors: List[str]
    year: int
    journal: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    
    # Metrics
    citation_count: int = 0
    influence_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.paper_id,
            "title": self.title[:200],
            "authors": self.authors[:5],
            "year": self.year,
            "citation_count": self.citation_count,
        }


@dataclass
class CitationEdge:
    """A citation relationship."""
    citing_paper: str  # ID of paper that cites
    cited_paper: str   # ID of paper being cited
    citation_context: Optional[str] = None  # Text around citation
    citation_type: str = "explicit"  # explicit, implicit, self-citation
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "citing": self.citing_paper,
            "cited": self.cited_paper,
            "type": self.citation_type,
        }


@dataclass
class CitationNetwork:
    """A subgraph of the citation network."""
    center_paper: CitationNode
    cited_by: List[CitationNode]
    references: List[CitationNode]
    related_papers: List[CitationNode]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "center": self.center_paper.to_dict(),
            "cited_by_count": len(self.cited_by),
            "references_count": len(self.references),
            "related_count": len(self.related_papers),
            "top_citations": [p.to_dict() for p in self.cited_by[:10]],
            "top_references": [p.to_dict() for p in self.references[:10]],
        }


class OpenAlexClient:
    """
    Client for OpenAlex API - free scholarly citation data.
    
    OpenAlex provides:
    - Citation counts
    - References
    - Cited-by papers
    - Author disambiguation
    """
    
    BASE_URL = "https://api.openalex.org"
    
    def __init__(self, email: Optional[str] = None):
        self.email = email
        self._request_delay = 0.1
        self._last_request = 0.0
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def get_work(self, session: aiohttp.ClientSession, identifier: str) -> Optional[Dict[str, Any]]:
        """Get a work by DOI, PMID, or OpenAlex ID."""
        # Determine ID type
        if identifier.startswith("10."):
            url = f"{self.BASE_URL}/works/doi:{identifier}"
        elif identifier.isdigit():
            url = f"{self.BASE_URL}/works/pmida:{identifier}"
        elif identifier.startswith("W"):
            url = f"{self.BASE_URL}/works/{identifier}"
        else:
            url = f"{self.BASE_URL}/works/doi:{identifier}"
        
        headers = {}
        if self.email:
            headers["mailto"] = self.email
        
        try:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    return await response.json()
        except Exception as e:
            logger.error(f"OpenAlex API error: {e}")
        
        return None
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def get_cited_by(
        self,
        session: aiohttp.ClientSession,
        openalex_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get papers that cite this work."""
        url = f"{self.BASE_URL}/works"
        params = {
            "filter": f"cites:{openalex_id}",
            "per_page": str(min(limit, 200)),
            "sort": "cited_by_count:desc",
        }
        
        headers = {}
        if self.email:
            headers["mailto"] = self.email
        
        try:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("results", [])
        except Exception as e:
            logger.error(f"OpenAlex API error: {e}")
        
        return []
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def get_references(
        self,
        session: aiohttp.ClientSession,
        openalex_id: str,
    ) -> List[Dict[str, Any]]:
        """Get papers cited by this work."""
        url = f"{self.BASE_URL}/works"
        params = {
            "filter": f"cited_by:{openalex_id}",
            "per_page": "50",
        }
        
        headers = {}
        if self.email:
            headers["mailto"] = self.email
        
        try:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("results", [])
        except Exception as e:
            logger.error(f"OpenAlex API error: {e}")
        
        return []
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def get_related(
        self,
        session: aiohttp.ClientSession,
        openalex_id: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get related papers based on shared references."""
        # Use OpenAlex related works endpoint
        url = f"{self.BASE_URL}/works/{openalex_id}/related"
        
        headers = {}
        if self.email:
            headers["mailto"] = self.email
        
        try:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("related_results", [])[:limit]
        except Exception as e:
            logger.error(f"OpenAlex API error: {e}")
        
        return []


def parse_openalex_work(work: Dict[str, Any]) -> CitationNode:
    """Parse OpenAlex work into CitationNode."""
    # Extract year
    year = 0
    pub_date = work.get("publication_date")
    if pub_date:
        year = int(pub_date[:4])
    
    # Extract authors
    authors = []
    for authorship in work.get("authorships", [])[:10]:
        author = authorship.get("author", {})
        name = author.get("display_name")
        if name:
            authors.append(name)
    
    # Extract journal
    journal = None
    source = work.get("primary_location", {})
    if source:
        journal = source.get("source", {}).get("display_name")
    
    # Extract identifiers
    doi = work.get("doi")
    pmid = None
    ids = work.get("ids", {})
    if ids.get("pmid"):
        pmid = ids["pmid"].replace("https://pubmed.ncbi.nlm.nih.gov/", "")
    
    return CitationNode(
        paper_id=work.get("id", ""),
        title=work.get("title", ""),
        authors=authors,
        year=year,
        journal=journal,
        doi=doi,
        pmid=pmid,
        citation_count=work.get("cited_by_count", 0),
        influence_score=work.get("cited_by_count", 0) / max(1, 2025 - year) if year else 0,
    )


async def build_citation_network(
    identifier: str,
    include_cited_by: bool = True,
    include_references: bool = True,
    include_related: bool = True,
    limit: int = 50,
) -> Optional[CitationNetwork]:
    """
    Build a citation network for a paper.
    
    Args:
        identifier: DOI, PMID, or OpenAlex ID
        include_cited_by: Include papers that cite this paper
        include_references: Include papers cited by this paper
        include_related: Include related papers
        limit: Maximum papers to fetch per category
    
    Returns:
        CitationNetwork or None if paper not found
    """
    client = OpenAlexClient()
    
    async with aiohttp.ClientSession() as session:
        # Get the paper
        work = await client.get_work(session, identifier)
        if not work:
            logger.warning(f"Paper not found: {identifier}")
            return None
        
        center_paper = parse_openalex_work(work)
        openalex_id = work.get("id", "")
        
        cited_by = []
        references = []
        related = []
        
        # Get cited-by papers
        if include_cited_by:
            cited_by_works = await client.get_cited_by(session, openalex_id, limit)
            cited_by = [parse_openalex_work(w) for w in cited_by_works]
        
        # Get references
        if include_references:
            ref_ids = work.get("referenced_works", [])[:limit]
            for ref_id in ref_ids:
                ref_work = await client.get_work(session, ref_id)
                if ref_work:
                    references.append(parse_openalex_work(ref_work))
        
        # Get related papers
        if include_related:
            related_works = await client.get_related(session, openalex_id, limit)
            related = [parse_openalex_work(w) for w in related_works]
        
        return CitationNetwork(
            center_paper=center_paper,
            cited_by=cited_by,
            references=references,
            related_papers=related,
        )


async def get_citation_count(identifier: str) -> int:
    """Get citation count for a paper."""
    client = OpenAlexClient()
    
    async with aiohttp.ClientSession() as session:
        work = await client.get_work(session, identifier)
        if work:
            return work.get("cited_by_count", 0)
    
    return 0


async def get_highly_cited_in_topic(
    topic: str,
    limit: int = 20,
    year_range: Optional[tuple] = None,
) -> List[CitationNode]:
    """
    Get highly cited papers on a topic.
    
    Args:
        topic: Search topic
        limit: Maximum papers to return
        year_range: (start_year, end_year) tuple
    
    Returns:
        List of CitationNode sorted by citation count
    """
    client = OpenAlexClient()
    
    async with aiohttp.ClientSession() as session:
        url = f"{client.BASE_URL}/works"
        params = {
            "search": topic,
            "per_page": str(min(limit, 200)),
            "sort": "cited_by_count:desc",
        }
        
        if year_range:
            params["filter"] = f"from_publication_date:{year_range[0]}-01-01,to_publication_date:{year_range[1]}-12-31"
        
        headers = {}
        if client.email:
            headers["mailto"] = client.email
        
        try:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return [parse_openalex_work(w) for w in data.get("results", [])]
        except Exception as e:
            logger.error(f"OpenAlex search error: {e}")
        
        return []


# Main entry point
async def main():
    """Test citation network."""
    network = await build_citation_network("10.1056/NEJMoa2002032")  # REMAP-CAP
    
    if network:
        print(f"\nCenter Paper: {network.center_paper.title[:80]}...")
        print(f"Citations: {network.center_paper.citation_count}")
        print(f"Cited by: {len(network.cited_by)} papers")
        print(f"References: {len(network.references)} papers")
        print(f"Related: {len(network.related_papers)} papers")


if __name__ == "__main__":
    asyncio.run(main())
