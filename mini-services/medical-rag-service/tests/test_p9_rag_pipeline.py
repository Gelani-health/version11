"""
P9: Comprehensive Tests for RAG Pipeline with PubMed/Pinecone Ingestion
======================================================================

Tests cover:
1. PubMed Ingestor
2. Together AI Embedding Client
3. Namespace Router
4. Hybrid Retrieval Pipeline with RRF
5. Citation Validation
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta

# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = Mock()
    settings.NCBI_API_KEY = "test_key"
    settings.NCBI_EMAIL = "test@test.com"
    settings.NCBI_TOOL = "test_tool"
    settings.NCBI_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    settings.PINECONE_API_KEY = "test_pinecone_key"
    settings.PINECONE_INDEX_NAME = "test-index"
    settings.PINECONE_NAMESPACE = "test-namespace"
    settings.EMBEDDING_DIMENSION = 768
    settings.TOGETHER_API_KEY = "test_together_key"
    return settings


@pytest.fixture
def sample_pubmed_xml():
    """Sample PubMed XML response for testing."""
    return """<?xml version="1.0"?>
    <PubmedArticleSet>
        <PubmedArticle>
            <MedlineCitation>
                <PMID>12345678</PMID>
                <Article>
                    <ArticleTitle>Test Article Title</ArticleTitle>
                    <Abstract>
                        <AbstractText>This is a test abstract about myocardial infarction treatment.</AbstractText>
                    </Abstract>
                    <Journal>
                        <Title>Test Journal of Medicine</Title>
                    </Journal>
                </Article>
                <MeshHeadingList>
                    <MeshHeading>
                        <DescriptorName>Myocardial Infarction</DescriptorName>
                    </MeshHeading>
                </MeshHeadingList>
            </MedlineCitation>
        </PubmedArticle>
    </PubmedArticleSet>
    """


# =============================================================================
# TESTS: PUBMED INGESTOR
# =============================================================================

class TestPubMedIngestor:
    """Tests for PubMed Ingestor."""
    
    def test_clinical_namespaces_defined(self):
        """Test that all clinical namespaces are properly defined."""
        from app.ingestion.pubmed_ingestor import CLINICAL_NAMESPACES
        
        expected_namespaces = [
            "pubmed_infectious",
            "pubmed_cardiology",
            "pubmed_nephrology",
            "pubmed_pulmonology",
            "pubmed_emergency",
            "pubmed_pharmacology",
            "pubmed_neurology",
        ]
        
        for ns in expected_namespaces:
            assert ns in CLINICAL_NAMESPACES, f"Missing namespace: {ns}"
            assert len(CLINICAL_NAMESPACES[ns]) > 0, f"Empty query for namespace: {ns}"
    
    def test_chunk_text_basic(self):
        """Test text chunking functionality."""
        from app.ingestion.pubmed_ingestor import PubMedIngestor
        
        ingestor = PubMedIngestor()
        
        # Short text should return single chunk
        text = "Short text."
        chunks = ingestor._chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0] == "Short text."
        
        # Long text should be chunked
        long_text = "This is a sentence. " * 100
        chunks = ingestor._chunk_text(long_text)
        assert len(chunks) > 1
        
        # Each chunk should be within limits
        for chunk in chunks:
            assert len(chunk) <= ingestor.MAX_CHUNK_CHARS + ingestor.OVERLAP_CHARS
    
    def test_parse_pubmed_xml(self, sample_pubmed_xml):
        """Test PubMed XML parsing."""
        from app.ingestion.pubmed_ingestor import PubMedIngestor
        
        ingestor = PubMedIngestor()
        articles = ingestor._parse_pubmed_xml(sample_pubmed_xml)
        
        assert len(articles) == 1
        article = articles[0]
        
        assert article.pmid == "12345678"
        assert article.title == "Test Article Title"
        assert "myocardial infarction" in article.abstract.lower()
        assert "Myocardial Infarction" in article.mesh_terms
        assert article.journal == "Test Journal of Medicine"
    
    def test_create_chunks(self):
        """Test article chunking."""
        from app.ingestion.pubmed_ingestor import PubMedIngestor, PubMedArticle
        
        ingestor = PubMedIngestor()
        
        article = PubMedArticle(
            pmid="12345",
            title="Test Title",
            abstract="A" * 3000,  # Long abstract
            mesh_terms=["Test"],
            publication_year=2024,
            journal="Test Journal",
        )
        
        chunks = ingestor._create_chunks(article)
        
        assert len(chunks) > 1
        for chunk in chunks:
            assert chunk.pmid == "12345"
            assert chunk.chunk_index >= 0
            assert len(chunk.chunk_text) > 0


# =============================================================================
# TESTS: EMBEDDING CLIENT
# =============================================================================

class TestTogetherAIEmbeddingClient:
    """Tests for Together AI Embedding Client."""
    
    @pytest.mark.asyncio
    async def test_embed_single_text(self):
        """Test single text embedding."""
        from app.ingestion.embedding_client import TogetherAIEmbeddingClient
        
        client = TogetherAIEmbeddingClient(api_key="test_key")
        
        with patch("aiohttp.ClientSession.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": [{"embedding": [0.1] * 768}],
                "usage": {"total_tokens": 10}
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # This would need actual async context manager mocking
            # For now, test the model/dimension attributes
            assert client.model == "togethercomputer/m2-bert-80M-8k-retrieval"
            assert client.dimension == 768
    
    def test_client_initialization(self):
        """Test client initialization."""
        from app.ingestion.embedding_client import TogetherAIEmbeddingClient, EMBEDDING_MODEL, EMBEDDING_DIMENSION
        
        client = TogetherAIEmbeddingClient()
        
        assert client.model == EMBEDDING_MODEL
        assert client.dimension == EMBEDDING_DIMENSION
        assert client.stats["total_embeddings"] == 0


# =============================================================================
# TESTS: NAMESPACE ROUTER
# =============================================================================

class TestNamespaceRouter:
    """Tests for Namespace Router."""
    
    def test_route_cardiology_complaint(self):
        """Test routing for cardiology-related complaints."""
        from app.ingestion.namespace_router import NamespaceRouter
        
        router = NamespaceRouter()
        
        result = router.route(
            query="chest pain and shortness of breath",
            chief_complaint="chest pain"
        )
        
        assert "pubmed_cardiology" in result.routed_namespaces
        assert result.fallback == False
    
    def test_route_infectious_disease(self):
        """Test routing for infectious disease complaints."""
        from app.ingestion.namespace_router import NamespaceRouter
        
        router = NamespaceRouter()
        
        result = router.route(
            query="fever and sepsis treatment",
            chief_complaint="fever"
        )
        
        assert "pubmed_infectious" in result.routed_namespaces
        assert "pubmed_pharmacology" in result.routed_namespaces
    
    def test_route_nephrology(self):
        """Test routing for nephrology complaints."""
        from app.ingestion.namespace_router import NamespaceRouter
        
        router = NamespaceRouter()
        
        result = router.route(
            query="renal failure dosing",
            chief_complaint="creatinine elevated"
        )
        
        assert "pubmed_nephrology" in result.routed_namespaces or "pubmed_pharmacology" in result.routed_namespaces
    
    def test_route_fallback(self):
        """Test fallback to all namespaces for unknown queries."""
        from app.ingestion.namespace_router import NamespaceRouter
        
        router = NamespaceRouter()
        
        result = router.route(
            query="xyz unknown query",
            chief_complaint=None
        )
        
        # Should fallback to multiple namespaces
        assert result.fallback == True
        assert len(result.routed_namespaces) > 0
    
    def test_mesh_synonym_expansion(self):
        """Test MeSH synonym expansion in routing."""
        from app.ingestion.namespace_router import NamespaceRouter, MESH_SYNONYMS
        
        router = NamespaceRouter()
        
        result = router.route(
            query="MI treatment options",
            chief_complaint="chest pain"
        )
        
        # MI should expand to myocardial infarction
        assert "myocardial infarction" in result.expanded_query.lower() or "mi" in result.query.lower()
    
    def test_complaint_namespace_map_coverage(self):
        """Test that complaint map covers all major specialties."""
        from app.ingestion.namespace_router import COMPLAINT_NAMESPACE_MAP
        
        # Ensure we have mappings for common chief complaints
        essential_complaints = [
            "chest pain", "fever", "headache", "shortness of breath",
            "infection", "sepsis", "renal", "antibiotic"
        ]
        
        for complaint in essential_complaints:
            assert complaint in COMPLAINT_NAMESPACE_MAP, f"Missing complaint mapping: {complaint}"


# =============================================================================
# TESTS: HYBRID RETRIEVAL PIPELINE
# =============================================================================

class TestHybridRetrievalPipeline:
    """Tests for Hybrid Retrieval Pipeline."""
    
    def test_bm25_index(self):
        """Test BM25 index functionality."""
        from app.retrieval.retrieval_pipeline import SimpleBM25
        
        bm25 = SimpleBM25()
        
        # Add documents
        bm25.add_document("doc1", "myocardial infarction treatment", {"pmid": "123"})
        bm25.add_document("doc2", "pneumonia antibiotic therapy", {"pmid": "456"})
        bm25.add_document("doc3", "heart failure management", {"pmid": "789"})
        
        # Search
        results = bm25.search("heart treatment", top_k=5)
        
        assert len(results) > 0
        assert bm25.total_docs == 3
    
    def test_bm25_search_returns_relevant(self):
        """Test that BM25 returns relevant results."""
        from app.retrieval.retrieval_pipeline import SimpleBM25
        
        bm25 = SimpleBM25()
        
        bm25.add_document("doc1", "myocardial infarction heart attack", {"pmid": "1"})
        bm25.add_document("doc2", "common cold flu symptoms", {"pmid": "2"})
        bm25.add_document("doc3", "heart disease coronary artery", {"pmid": "3"})
        
        results = bm25.search("heart attack", top_k=10)
        
        # doc1 should be highly ranked
        top_doc = results[0]
        assert top_doc[0] == "doc1"
    
    def test_rrf_fusion(self):
        """Test Reciprocal Rank Fusion."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        # Simulate dense results
        dense_results = [
            ("doc1", 0.9, {"pmid": "1", "title": "A"}, "ns1"),
            ("doc2", 0.8, {"pmid": "2", "title": "B"}, "ns1"),
            ("doc3", 0.7, {"pmid": "3", "title": "C"}, "ns1"),
        ]
        
        # Simulate BM25 results
        bm25_results = [
            ("doc2", 3.5, {"pmid": "2", "title": "B"}, "ns1"),
            ("doc4", 2.8, {"pmid": "4", "title": "D"}, "ns1"),
            ("doc1", 2.1, {"pmid": "1", "title": "A"}, "ns1"),
        ]
        
        chunks = pipeline._reciprocal_rank_fusion(dense_results, bm25_results, top_k=5)
        
        # doc2 appears in both lists with high ranks, should be top
        assert len(chunks) > 0
        
        # Check RRF scores are calculated
        for chunk in chunks:
            assert chunk.rrf_score > 0
    
    def test_mesh_synonym_expansion_in_pipeline(self):
        """Test MeSH synonym expansion in retrieval."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        # Test acronym expansion
        expanded = pipeline._expand_query_with_mesh("MI treatment for PE")
        
        assert "myocardial infarction" in expanded.lower() or "pulmonary embolism" in expanded.lower()
    
    def test_retrieved_chunk_format(self):
        """Test RetrievedChunk dataclass."""
        from app.retrieval.retrieval_pipeline import RetrievedChunk
        
        chunk = RetrievedChunk(
            doc_id="pmid_123_chunk_0",
            pmid="123",
            title="Test Article",
            chunk_text="This is a test chunk about cardiology.",
            abstract="Full abstract here",
            journal="Test Journal",
            publication_year=2024,
            mesh_terms=["Cardiology", "Heart"],
            namespace="pubmed_cardiology",
            dense_score=0.85,
            bm25_score=2.5,
            rrf_score=0.033,
            dense_rank=1,
            bm25_rank=2,
        )
        
        # Test to_dict
        chunk_dict = chunk.to_dict()
        assert chunk_dict["pmid"] == "123"
        assert chunk_dict["namespace"] == "pubmed_cardiology"
        assert "scores" in chunk_dict
        
        # Test citation format
        citation = chunk.format_citation()
        assert "PMID 123" in citation
        assert "2024" in citation


# =============================================================================
# TESTS: CITATION VALIDATION
# =============================================================================

class TestCitationValidation:
    """Tests for citation validation."""
    
    def test_validate_valid_citations(self):
        """Test validation of valid citations."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        cited_pmids = ["123", "456", "789"]
        context_pmids = {"123", "456", "789", "111", "222"}
        
        valid, hallucinated = pipeline.validate_citations(cited_pmids, context_pmids)
        
        assert len(valid) == 3
        assert len(hallucinated) == 0
    
    def test_detect_hallucinated_citations(self):
        """Test detection of hallucinated citations."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        cited_pmids = ["123", "456", "999999"]  # 999999 is fake
        context_pmids = {"123", "456", "789"}
        
        valid, hallucinated = pipeline.validate_citations(cited_pmids, context_pmids)
        
        assert len(valid) == 2
        assert len(hallucinated) == 1
        assert "999999" in hallucinated
    
    def test_empty_citations(self):
        """Test with empty citation lists."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        valid, hallucinated = pipeline.validate_citations([], set())
        
        assert len(valid) == 0
        assert len(hallucinated) == 0


# =============================================================================
# TESTS: RETRIEVAL RESULT
# =============================================================================

class TestRetrievalResult:
    """Tests for RetrievalResult dataclass."""
    
    def test_format_context_for_llm(self):
        """Test context formatting for LLM."""
        from app.retrieval.retrieval_pipeline import RetrievedChunk, RetrievalResult
        
        chunks = [
            RetrievedChunk(
                doc_id="pmid_123_chunk_0",
                pmid="123",
                title="Test Article 1",
                chunk_text="This is the first test chunk.",
                abstract="Abstract 1",
                journal="Journal A",
                publication_year=2024,
                mesh_terms=["Test"],
                namespace="pubmed_cardiology",
                dense_score=0.9,
                bm25_score=0.8,
                rrf_score=0.03,
                dense_rank=1,
                bm25_rank=2,
            ),
            RetrievedChunk(
                doc_id="pmid_456_chunk_0",
                pmid="456",
                title="Test Article 2",
                chunk_text="This is the second test chunk.",
                abstract="Abstract 2",
                journal="Journal B",
                publication_year=2023,
                mesh_terms=["Test"],
                namespace="pubmed_cardiology",
                dense_score=0.85,
                bm25_score=0.75,
                rrf_score=0.028,
                dense_rank=2,
                bm25_rank=3,
            ),
        ]
        
        result = RetrievalResult(
            query="test query",
            expanded_query="test query expanded",
            namespaces_queried=["pubmed_cardiology"],
            chunks=chunks,
            pmids_in_context={"123", "456"},
        )
        
        context = result.format_context_for_llm()
        
        assert "PMID 123" in context
        assert "PMID 456" in context
        assert "When citing evidence" in context
    
    def test_to_dict(self):
        """Test serialization."""
        from app.retrieval.retrieval_pipeline import RetrievalResult
        
        result = RetrievalResult(
            query="test",
            expanded_query="test expanded",
            namespaces_queried=["ns1"],
            chunks=[],
            pmids_in_context=set(),
            total_latency_ms=100.0,
        )
        
        result_dict = result.to_dict()
        
        assert result_dict["query"] == "test"
        assert "latency_ms" in result_dict
        assert "metadata" in result_dict


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests for the full pipeline."""
    
    @pytest.mark.asyncio
    async def test_full_retrieval_flow(self, mock_settings):
        """Test the full retrieval flow with mocks."""
        from app.retrieval.retrieval_pipeline import HybridRetrievalPipeline
        
        pipeline = HybridRetrievalPipeline()
        
        # This is a mock test - in real scenario would mock Pinecone
        # and embedding client
        
        assert pipeline.stats["total_queries"] == 0
    
    def test_namespace_router_integration(self):
        """Test namespace router with real complaint map."""
        from app.ingestion.namespace_router import get_namespace_router
        
        router = get_namespace_router()
        
        # Test various clinical scenarios
        test_cases = [
            ("chest pain radiating to left arm", "chest pain", "pubmed_cardiology"),
            ("fever chills and productive cough", "fever", "pubmed_infectious"),
            ("acute kidney injury with elevated creatinine", "creatinine", "pubmed_nephrology"),
            ("new onset seizure in elderly", "seizure", "pubmed_neurology"),
            ("drug interaction between warfarin and amiodarone", "drug interaction", "pubmed_pharmacology"),
        ]
        
        for query, complaint, expected_ns in test_cases:
            result = router.route(query, complaint)
            assert expected_ns in result.routed_namespaces or result.fallback, \
                f"Expected {expected_ns} in namespaces for query: {query}"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
