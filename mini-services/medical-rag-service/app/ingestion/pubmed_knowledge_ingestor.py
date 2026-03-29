"""
Enhanced PubMed Knowledge Ingestion Pipeline
=============================================

Comprehensive ingestion pipeline for PubMed/PMC articles with:
- NCBI E-utilities API integration
- MeSH term enrichment
- Automatic embedding generation
- Rate limiting compliance (10 req/sec with API key)
- Z.ai SDK LLM capabilities for content enhancement

Architecture:
- Uses NCBI E-utilities REST API
- Implements rate limiting (10 req/sec with API key, 3 req/sec without)
- Chunks abstracts into ≤512 token segments with 64-token overlap
- Embeds via PubMedBERT embeddings (768-dim)
- Upserts to Pinecone with namespace organization

Evidence Sources:
- NCBI E-utilities API: https://www.ncbi.nlm.nih.gov/books/NBK25500/
- MeSH Browser: https://meshb.nlm.nih.gov/
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
import sqlite3
import json
import time
import re
import hashlib
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from enum import Enum
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings


# =============================================================================
# ENUMERATIONS
# =============================================================================

class EvidenceLevel(Enum):
    """Evidence levels for medical knowledge."""
    LEVEL_IA = "IA"  # Systematic review of RCTs
    LEVEL_IB = "IB"  # Individual RCT
    LEVEL_IIA = "IIA"  # Systematic review of cohort studies
    LEVEL_IIB = "IIB"  # Individual cohort study
    LEVEL_IIIA = "IIIA"  # Systematic review of case-control studies
    LEVEL_IIIB = "IIIB"  # Individual case-control study
    LEVEL_IV = "IV"  # Case series, poor-quality cohort
    LEVEL_V = "V"  # Expert opinion


class KnowledgeSourceType(Enum):
    """Types of knowledge sources."""
    PUBMED = "pubmed"
    PMC = "pmc"
    CLINICAL_GUIDELINE = "guideline"
    TEXTBOOK = "textbook"
    CURATED = "curated"


# =============================================================================
# CLINICAL NAMESPACES - MeSH Query Mappings
# =============================================================================

CLINICAL_NAMESPACES = {
    "pubmed_cardiology": "cardiovascular diseases[MeSH] AND (diagnosis[tiab] OR treatment[tiab] OR therapy[tiab])",
    "pubmed_endocrinology": "endocrine system diseases[MeSH] AND (diabetes[tiab] OR thyroid[tiab] OR metabolic[tiab])",
    "pubmed_pulmonology": "respiratory tract diseases[MeSH] AND (pneumonia[tiab] OR asthma[tiab] OR COPD[tiab])",
    "pubmed_neurology": "nervous system diseases[MeSH] AND (stroke[tiab] OR seizure[tiab] OR headache[tiab])",
    "pubmed_nephrology": "kidney diseases[MeSH] AND (CKD[tiab] OR AKI[tiab] OR dialysis[tiab])",
    "pubmed_infectious": "infectious diseases[MeSH] AND (sepsis[tiab] OR antibiotic[tiab] OR HIV[tiab])",
    "pubmed_gastroenterology": "gastrointestinal diseases[MeSH] AND (liver[tiab] OR GI bleed[tiab] OR IBD[tiab])",
    "pubmed_hematology": "hematologic diseases[MeSH] AND (anemia[tiab] OR thrombosis[tiab] OR bleeding[tiab])",
    "pubmed_oncology": "neoplasms[MeSH] AND (chemotherapy[tiab] OR cancer[tiab] OR tumor[tiab])",
    "pubmed_emergency": "emergencies[MeSH] AND (triage[tiab] OR acute[tiab] OR critical[tiab])",
    "pubmed_pharmacology": "drug interactions[MeSH] OR adverse drug reaction[MeSH]",
}

# MeSH term enrichment mappings
MESH_ENRICHMENT = {
    "myocardial infarction": ["Myocardial Infarction", "Heart Attack", "Acute Coronary Syndrome", "MI", "STEMI", "NSTEMI"],
    "heart failure": ["Heart Failure", "Cardiac Failure", "CHF", "Left Ventricular Dysfunction"],
    "atrial fibrillation": ["Atrial Fibrillation", "AF", "AFib", "Arrhythmia", "Cardiac Arrhythmia"],
    "hypertension": ["Hypertension", "High Blood Pressure", "Essential Hypertension", "HTN"],
    "diabetes": ["Diabetes Mellitus", "Type 2 Diabetes", "T2DM", "NIDDM", "Diabetic"],
    "copd": ["Pulmonary Disease, Chronic Obstructive", "COPD", "Chronic Obstructive Airway Disease"],
    "pneumonia": ["Pneumonia", "Lung Inflammation", "Lower Respiratory Tract Infection"],
    "sepsis": ["Sepsis", "Septicemia", "Systemic Inflammatory Response Syndrome", "SIRS"],
    "stroke": ["Stroke", "Cerebrovascular Accident", "CVA", "Brain Infarction"],
    "ckd": ["Kidney Diseases", "Chronic Kidney Disease", "CKD", "Renal Insufficiency", "CKD Stage"],
    "aki": ["Acute Kidney Injury", "AKI", "Acute Renal Failure", "ARF"],
    "dvt": ["Venous Thrombosis", "Deep Vein Thrombosis", "DVT", "Thromboembolism"],
    "pe": ["Pulmonary Embolism", "PE", "Venous Thromboembolism", "VTE"],
    "asthma": ["Asthma", "Bronchial Asthma", "Reactive Airway Disease"],
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class MeSHTerm:
    """MeSH term with hierarchy information."""
    term: str
    ui: str  # MeSH Unique Identifier
    tree_number: Optional[str] = None
    scope_note: Optional[str] = None
    synonyms: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "term": self.term,
            "ui": self.ui,
            "tree_number": self.tree_number,
            "scope_note": self.scope_note,
            "synonyms": self.synonyms[:5],
        }


@dataclass
class PubMedKnowledgeChunk:
    """A chunk of PubMed knowledge for embedding."""
    chunk_id: str
    pmid: str
    chunk_index: int
    total_chunks: int
    chunk_text: str
    title: str
    abstract: str
    mesh_terms: List[MeSHTerm]
    icd10_codes: List[str]
    evidence_level: EvidenceLevel
    knowledge_source: KnowledgeSourceType
    publication_year: Optional[int]
    journal: str
    doi: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    summary: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "pmid": self.pmid,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "chunk_text": self.chunk_text,
            "title": self.title,
            "abstract": self.abstract[:500],
            "mesh_terms": [m.to_dict() for m in self.mesh_terms[:10]],
            "icd10_codes": self.icd10_codes[:5],
            "evidence_level": self.evidence_level.value,
            "knowledge_source": self.knowledge_source.value,
            "publication_year": self.publication_year,
            "journal": self.journal,
            "doi": self.doi,
            "authors": self.authors[:5],
            "keywords": self.keywords[:10],
            "summary": self.summary[:200] if self.summary else None,
        }


@dataclass
class PubMedKnowledgeArticle:
    """Parsed PubMed article with enhanced knowledge extraction."""
    pmid: str
    title: str
    abstract: str
    mesh_terms: List[MeSHTerm]
    icd10_codes: List[str]
    evidence_level: EvidenceLevel
    knowledge_source: KnowledgeSourceType
    publication_year: Optional[int]
    journal: str
    doi: Optional[str] = None
    pmc_id: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    summary: Optional[str] = None
    clinical_relevance: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract,
            "mesh_terms": [m.to_dict() for m in self.mesh_terms[:10]],
            "icd10_codes": self.icd10_codes[:5],
            "evidence_level": self.evidence_level.value,
            "knowledge_source": self.knowledge_source.value,
            "publication_year": self.publication_year,
            "journal": self.journal,
            "doi": self.doi,
            "pmc_id": self.pmc_id,
            "authors": self.authors[:5],
            "keywords": self.keywords[:10],
            "summary": self.summary[:200] if self.summary else None,
            "clinical_relevance": self.clinical_relevance,
        }


@dataclass
class IngestionResult:
    """Result of an ingestion operation."""
    namespace: str
    status: str
    articles_processed: int = 0
    chunks_created: int = 0
    vectors_upserted: int = 0
    mesh_terms_enriched: int = 0
    embeddings_generated: int = 0
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
            "mesh_terms_enriched": self.mesh_terms_enriched,
            "embeddings_generated": self.embeddings_generated,
            "errors": self.errors,
            "latency_ms": round(self.latency_ms, 2),
            "message": self.message,
        }


# =============================================================================
# MESH TERM ENRICHER
# =============================================================================

class MeSHTermEnricher:
    """
    Enriches medical terms with MeSH terminology.
    
    Features:
    - Local MeSH term database
    - MeSH hierarchy navigation
    - Synonym expansion
    - ICD-10 code mapping
    """
    
    # Built-in MeSH term database
    MESH_DATABASE = {
        "Myocardial Infarction": MeSHTerm(
            term="Myocardial Infarction",
            ui="D009203",
            tree_number="C14.907.617.625",
            scope_note="NECROSIS of the MYOCARDIUM caused by an obstruction of the blood supply to the heart.",
            synonyms=["Heart Attack", "MI", "Acute Myocardial Infarction", "Cardiac Infarction"]
        ),
        "Heart Failure": MeSHTerm(
            term="Heart Failure",
            ui="D006333",
            tree_number="C14.280.720",
            scope_note="A heterogeneous condition in which the heart is unable to pump out sufficient blood.",
            synonyms=["CHF", "Cardiac Failure", "Congestive Heart Failure", "Left Ventricular Failure"]
        ),
        "Atrial Fibrillation": MeSHTerm(
            term="Atrial Fibrillation",
            ui="D001281",
            tree_number="C14.280.247.500",
            scope_note="Abnormal cardiac rhythm characterized by rapid, irregular atrial impulses.",
            synonyms=["AF", "AFib", "Auricular Fibrillation"]
        ),
        "Hypertension": MeSHTerm(
            term="Hypertension",
            ui="D006973",
            tree_number="C14.907.489",
            scope_note="Persistently high systemic arterial BLOOD PRESSURE.",
            synonyms=["High Blood Pressure", "HTN", "Essential Hypertension"]
        ),
        "Diabetes Mellitus, Type 2": MeSHTerm(
            term="Diabetes Mellitus, Type 2",
            ui="D003924",
            tree_number="C18.452.394.750.124",
            scope_note="A subclass of DIABETES MELLITUS that is not INSULIN-responsive.",
            synonyms=["T2DM", "NIDDM", "Adult-Onset Diabetes", "Non-Insulin-Dependent Diabetes"]
        ),
        "Pulmonary Disease, Chronic Obstructive": MeSHTerm(
            term="Pulmonary Disease, Chronic Obstructive",
            ui="D029424",
            tree_number="C08.381.495.389",
            scope_note="A disease of chronic diffuse irreversible airflow obstruction.",
            synonyms=["COPD", "Chronic Obstructive Airway Disease", "COAD"]
        ),
        "Pneumonia": MeSHTerm(
            term="Pneumonia",
            ui="D011014",
            tree_number="C08.381.677",
            scope_note="Infection of the lung often accompanied by inflammation.",
            synonyms=["Lung Inflammation", "Pneumonitis"]
        ),
        "Sepsis": MeSHTerm(
            term="Sepsis",
            ui="D018805",
            tree_number="C01.252.400.800",
            scope_note="Systemic inflammatory response to infection with organ dysfunction.",
            synonyms=["Septicemia", "Systemic Inflammatory Response Syndrome", "SIRS"]
        ),
        "Stroke": MeSHTerm(
            term="Stroke",
            ui="D020521",
            tree_number="C10.228.140",
            scope_note="A group of pathological conditions characterized by sudden, non-convulsive loss of neurological function.",
            synonyms=["CVA", "Cerebrovascular Accident", "Brain Attack"]
        ),
        "Kidney Failure, Chronic": MeSHTerm(
            term="Kidney Failure, Chronic",
            ui="D007676",
            tree_number="C12.777.419.780.500",
            scope_note="The end-stage of CHRONIC RENAL INSUFFICIENCY.",
            synonyms=["CKD", "Chronic Kidney Disease", "Chronic Renal Failure", "CRF"]
        ),
        "Acute Kidney Injury": MeSHTerm(
            term="Acute Kidney Injury",
            ui="D058186",
            tree_number="C12.777.419.780.143",
            scope_note="Abrupt reduction in kidney function with or without structural damage.",
            synonyms=["AKI", "Acute Renal Failure", "ARF"]
        ),
        "Venous Thrombosis": MeSHTerm(
            term="Venous Thrombosis",
            ui="D020246",
            tree_number="C14.907.775.750",
            scope_note="The formation or presence of a blood clot within a vein.",
            synonyms=["Deep Vein Thrombosis", "DVT", "Thrombophlebitis"]
        ),
        "Pulmonary Embolism": MeSHTerm(
            term="Pulmonary Embolism",
            ui="D011655",
            tree_number="C08.730.810",
            scope_note="Blocking of the PULMONARY ARTERY or one of its branches by an embolus.",
            synonyms=["PE", "Lung Embolism", "Pulmonary Thromboembolism"]
        ),
        "Asthma": MeSHTerm(
            term="Asthma",
            ui="D001249",
            tree_number="C08.381.511",
            scope_note="A form of bronchial disorder associated with airway obstruction.",
            synonyms=["Bronchial Asthma", "Reactive Airway Disease"]
        ),
        "Anemia": MeSHTerm(
            term="Anemia",
            ui="D000740",
            tree_number="C15.378.190",
            scope_note="A reduction in the number of circulating RED BLOOD CELLS.",
            synonyms=["Low Hemoglobin", "Low Red Blood Cell Count"]
        ),
    }
    
    # ICD-10 code mappings
    ICD10_MAPPINGS = {
        "Myocardial Infarction": ["I21", "I22", "I23", "I25.2"],
        "Heart Failure": ["I50", "I11.0", "I13.0", "I25.5"],
        "Atrial Fibrillation": ["I48"],
        "Hypertension": ["I10", "I11", "I12", "I13", "I15"],
        "Diabetes Mellitus, Type 2": ["E11"],
        "Pulmonary Disease, Chronic Obstructive": ["J44"],
        "Pneumonia": ["J12", "J13", "J14", "J15", "J16", "J18"],
        "Sepsis": ["A41", "A40", "R65.2"],
        "Stroke": ["I63", "I64", "I61", "I60"],
        "Kidney Failure, Chronic": ["N18"],
        "Acute Kidney Injury": ["N17"],
        "Venous Thrombosis": ["I80", "I82"],
        "Pulmonary Embolism": ["I26"],
        "Asthma": ["J45", "J46"],
        "Anemia": ["D50", "D51", "D52", "D53", "D55", "D56", "D57", "D58", "D59"],
    }
    
    def __init__(self):
        self._cache: Dict[str, MeSHTerm] = {}
        self.stats = {"terms_enriched": 0, "cache_hits": 0}
    
    def enrich_term(self, term: str) -> Optional[MeSHTerm]:
        """Enrich a medical term with MeSH information."""
        # Normalize term
        term_lower = term.lower().strip()
        
        # Check cache
        if term_lower in self._cache:
            self.stats["cache_hits"] += 1
            return self._cache[term_lower]
        
        # Check built-in database
        for mesh_term, mesh_obj in self.MESH_DATABASE.items():
            # Check exact match
            if term_lower == mesh_term.lower():
                self._cache[term_lower] = mesh_obj
                self.stats["terms_enriched"] += 1
                return mesh_obj
            
            # Check synonyms
            for synonym in mesh_obj.synonyms:
                if term_lower == synonym.lower():
                    self._cache[term_lower] = mesh_obj
                    self.stats["terms_enriched"] += 1
                    return mesh_obj
        
        # Check enrichment mappings
        for key, enrichments in MESH_ENRICHMENT.items():
            if term_lower == key.lower():
                # Find the corresponding MeSH term
                for enrichment in enrichments:
                    if enrichment in self.MESH_DATABASE:
                        mesh_obj = self.MESH_DATABASE[enrichment]
                        self._cache[term_lower] = mesh_obj
                        self.stats["terms_enriched"] += 1
                        return mesh_obj
        
        return None
    
    def get_icd10_codes(self, mesh_term: str) -> List[str]:
        """Get ICD-10 codes for a MeSH term."""
        return self.ICD10_MAPPINGS.get(mesh_term, [])
    
    def enrich_terms(self, terms: List[str]) -> List[MeSHTerm]:
        """Enrich multiple terms."""
        enriched = []
        for term in terms:
            mesh = self.enrich_term(term)
            if mesh:
                enriched.append(mesh)
        return enriched


# =============================================================================
# EVIDENCE LEVEL CLASSIFIER
# =============================================================================

class EvidenceLevelClassifier:
    """
    Classifies evidence level based on publication type.
    
    Based on Oxford Centre for Evidence-Based Medicine levels.
    """
    
    # Publication type to evidence level mapping
    PUBLICATION_TYPE_EVIDENCE = {
        "Systematic Review": EvidenceLevel.LEVEL_IA,
        "Meta-Analysis": EvidenceLevel.LEVEL_IA,
        "Randomized Controlled Trial": EvidenceLevel.LEVEL_IB,
        "Controlled Clinical Trial": EvidenceLevel.LEVEL_IB,
        "Cohort Study": EvidenceLevel.LEVEL_IIB,
        "Case-Control Study": EvidenceLevel.LEVEL_IIIB,
        "Case Report": EvidenceLevel.LEVEL_IV,
        "Case Series": EvidenceLevel.LEVEL_IV,
        "Practice Guideline": EvidenceLevel.LEVEL_IA,
        "Consensus Development Conference": EvidenceLevel.LEVEL_V,
        "Editorial": EvidenceLevel.LEVEL_V,
        "Letter": EvidenceLevel.LEVEL_V,
        "Comment": EvidenceLevel.LEVEL_V,
        "Review": EvidenceLevel.LEVEL_IIIA,
    }
    
    # Journal impact factor weights for evidence quality
    HIGH_IMPACT_JOURNALS = {
        "New England Journal of Medicine": 1.0,
        "The Lancet": 1.0,
        "JAMA": 1.0,
        "BMJ": 0.95,
        "Annals of Internal Medicine": 0.95,
        "Circulation": 0.9,
        "Journal of the American College of Cardiology": 0.9,
        "Chest": 0.85,
        "Critical Care Medicine": 0.85,
    }
    
    def classify(
        self,
        publication_types: List[str],
        journal: str = "",
        abstract: str = ""
    ) -> EvidenceLevel:
        """Classify evidence level from publication metadata."""
        # Check publication types
        for pub_type in publication_types:
            for pattern, level in self.PUBLICATION_TYPE_EVIDENCE.items():
                if pattern.lower() in pub_type.lower():
                    return level
        
        # Analyze abstract for study design hints
        abstract_lower = abstract.lower()
        
        if any(term in abstract_lower for term in ["randomized", "rct", "randomised"]):
            return EvidenceLevel.LEVEL_IB
        if any(term in abstract_lower for term in ["systematic review", "meta-analysis", "meta analysis"]):
            return EvidenceLevel.LEVEL_IA
        if any(term in abstract_lower for term in ["cohort study", "prospective study"]):
            return EvidenceLevel.LEVEL_IIB
        if any(term in abstract_lower for term in ["case-control", "retrospective study"]):
            return EvidenceLevel.LEVEL_IIIB
        if any(term in abstract_lower for term in ["case report", "case series"]):
            return EvidenceLevel.LEVEL_IV
        
        # Default based on journal reputation
        for high_impact, weight in self.HIGH_IMPACT_JOURNALS.items():
            if high_impact.lower() in journal.lower():
                return EvidenceLevel.LEVEL_IIA
        
        return EvidenceLevel.LEVEL_IV


# =============================================================================
# ENHANCED PUBMED KNOWLEDGE INGESTOR
# =============================================================================

class PubMedKnowledgeIngestor:
    """
    Enhanced PubMed Knowledge Ingestion Pipeline.
    
    Features:
    - NCBI E-utilities integration with rate limiting (10 req/sec with API key)
    - MeSH term enrichment with hierarchy information
    - ICD-10 code mapping
    - Evidence level classification
    - Automatic embedding generation
    - Pinecone upsert with metadata
    - SQLite ingestion state tracking
    - 90-day re-ingestion skip logic
    """
    
    # NCBI API endpoints
    ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    
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
                "knowledge_ingestion.db"
            )
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Rate limiting
        self.api_key = self.settings.NCBI_API_KEY
        self.rate_limit = self.RATE_LIMIT_WITH_KEY if self.api_key else self.RATE_LIMIT_NO_KEY
        self._last_request_time = 0.0
        
        # Enrichers
        self.mesh_enricher = MeSHTermEnricher()
        self.evidence_classifier = EvidenceLevelClassifier()
        
        # Pinecone client (lazy init)
        self._pinecone = None
        self._index = None
        
        # Embedding service (lazy init)
        self._embedding_service = None
        
        # Statistics
        self.stats = {
            "total_ingested": 0,
            "total_chunks": 0,
            "total_mesh_enriched": 0,
            "total_embeddings": 0,
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
            CREATE TABLE IF NOT EXISTS knowledge_ingestion_log (
                namespace TEXT PRIMARY KEY,
                last_ingested_at TIMESTAMP,
                article_count INTEGER DEFAULT 0,
                chunk_count INTEGER DEFAULT 0,
                mesh_terms_enriched INTEGER DEFAULT 0,
                embeddings_generated INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_articles (
                pmid TEXT PRIMARY KEY,
                title TEXT,
                abstract TEXT,
                mesh_terms TEXT,
                icd10_codes TEXT,
                evidence_level TEXT,
                knowledge_source TEXT,
                publication_year INTEGER,
                journal TEXT,
                doi TEXT,
                pmc_id TEXT,
                authors TEXT,
                keywords TEXT,
                summary TEXT,
                clinical_relevance REAL,
                ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                chunk_id TEXT PRIMARY KEY,
                pmid TEXT,
                chunk_index INTEGER,
                chunk_text TEXT,
                embedding_status TEXT,
                upserted_at TIMESTAMP,
                FOREIGN KEY (pmid) REFERENCES knowledge_articles(pmid)
            )
        """)
        
        conn.commit()
        conn.close()
        
        logger.info(f"[PubMedKnowledgeIngestor] Database initialized at {self.db_path}")
    
    def _check_ingestion_needed(self, namespace: str, days: int = 90) -> bool:
        """Check if namespace needs re-ingestion."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT last_ingested_at FROM knowledge_ingestion_log WHERE namespace = ?",
            (namespace,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row is None or row[0] is None:
            return True
        
        last_ingested = datetime.fromisoformat(row[0])
        return (datetime.utcnow() - last_ingested) > timedelta(days=days)
    
    def _record_ingestion(
        self,
        namespace: str,
        article_count: int,
        chunk_count: int,
        mesh_enriched: int,
        embeddings_generated: int
    ):
        """Record successful ingestion in database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO knowledge_ingestion_log 
            (namespace, last_ingested_at, article_count, chunk_count, 
             mesh_terms_enriched, embeddings_generated, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(namespace) DO UPDATE SET
                last_ingested_at = excluded.last_ingested_at,
                article_count = excluded.article_count,
                chunk_count = excluded.chunk_count,
                mesh_terms_enriched = excluded.mesh_terms_enriched,
                embeddings_generated = excluded.embeddings_generated,
                updated_at = CURRENT_TIMESTAMP
        """, (namespace, datetime.utcnow().isoformat(), article_count, chunk_count,
              mesh_enriched, embeddings_generated))
        
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
                logger.warning("[PubMedKnowledgeIngestor] Rate limited, waiting...")
                await asyncio.sleep(1)
                raise Exception("Rate limited")
            
            response.raise_for_status()
            return await response.text()
    
    async def search_pubmed(
        self,
        session: aiohttp.ClientSession,
        query: str,
        max_results: int = 500,
        min_date: str = "2018"
    ) -> List[str]:
        """Search PubMed for PMIDs matching query."""
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
            
            data = json.loads(response_text)
            id_list = data.get("esearchresult", {}).get("idlist", [])
            
            logger.info(f"[PubMedKnowledgeIngestor] Found {len(id_list)} PMIDs for query: {query[:50]}...")
            return id_list
            
        except Exception as e:
            logger.error(f"[PubMedKnowledgeIngestor] Search failed: {e}")
            return []
    
    async def fetch_articles(
        self,
        session: aiohttp.ClientSession,
        pmids: List[str],
        batch_size: int = 100
    ) -> AsyncGenerator[PubMedKnowledgeArticle, None]:
        """Fetch article details by PMIDs."""
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
                
                articles = self._parse_pubmed_xml(xml_text)
                for article in articles:
                    yield article
                    
            except Exception as e:
                logger.error(f"[PubMedKnowledgeIngestor] Failed to fetch batch: {e}")
                continue
    
    def _parse_pubmed_xml(self, xml_text: str) -> List[PubMedKnowledgeArticle]:
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
                    mesh_terms_raw = []
                    for mesh in article_elem.findall(".//MeshHeading/DescriptorName"):
                        if mesh.text:
                            mesh_terms_raw.append(mesh.text)
                    
                    # Enrich MeSH terms
                    mesh_terms = self.mesh_enricher.enrich_terms(mesh_terms_raw)
                    
                    # Get ICD-10 codes from MeSH terms
                    icd10_codes = []
                    for mesh in mesh_terms:
                        icd10_codes.extend(self.mesh_enricher.get_icd10_codes(mesh.term))
                    icd10_codes = list(set(icd10_codes))
                    
                    # Extract publication types
                    pub_types = []
                    for pub_type in article_elem.findall(".//PublicationType"):
                        if pub_type.text:
                            pub_types.append(pub_type.text)
                    
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
                    
                    # Extract keywords
                    keywords = []
                    for keyword in article_elem.findall(".//Keyword"):
                        if keyword.text:
                            keywords.append(keyword.text)
                    
                    # Classify evidence level
                    evidence_level = self.evidence_classifier.classify(
                        pub_types, journal, abstract
                    )
                    
                    article = PubMedKnowledgeArticle(
                        pmid=pmid,
                        title=title,
                        abstract=abstract,
                        mesh_terms=mesh_terms,
                        icd10_codes=icd10_codes,
                        evidence_level=evidence_level,
                        knowledge_source=KnowledgeSourceType.PUBMED,
                        publication_year=pub_year,
                        journal=journal,
                        doi=doi,
                        pmc_id=pmc_id,
                        authors=authors,
                        keywords=keywords,
                    )
                    
                    articles.append(article)
                    
                except Exception as e:
                    logger.warning(f"[PubMedKnowledgeIngestor] Failed to parse article: {e}")
                    continue
                    
        except ET.ParseError as e:
            logger.error(f"[PubMedKnowledgeIngestor] XML parsing error: {e}")
        
        return articles
    
    def _chunk_text(self, text: str) -> List[str]:
        """Chunk text into segments with overlap."""
        if not text:
            return []
        
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= self.MAX_CHUNK_CHARS:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                if chunks and len(current_chunk) > self.OVERLAP_CHARS:
                    overlap = current_chunk[-self.OVERLAP_CHARS:]
                    space_idx = overlap.find(" ")
                    if space_idx > 0:
                        overlap = overlap[space_idx + 1:]
                    current_chunk = overlap + " " + sentence
                else:
                    current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _create_chunks(self, article: PubMedKnowledgeArticle) -> List[PubMedKnowledgeChunk]:
        """Create chunks from an article for embedding."""
        full_text = f"{article.title}\n\n{article.abstract}"
        text_chunks = self._chunk_text(full_text)
        
        if not text_chunks:
            text_chunks = [article.title] if article.title else []
        
        chunks = []
        for i, chunk_text in enumerate(text_chunks):
            chunk_id = f"pmid_{article.pmid}_chunk_{i}"
            chunk = PubMedKnowledgeChunk(
                chunk_id=chunk_id,
                pmid=article.pmid,
                chunk_index=i,
                total_chunks=len(text_chunks),
                chunk_text=chunk_text,
                title=article.title,
                abstract=article.abstract[:500],
                mesh_terms=article.mesh_terms,
                icd10_codes=article.icd10_codes,
                evidence_level=article.evidence_level,
                knowledge_source=article.knowledge_source,
                publication_year=article.publication_year,
                journal=article.journal,
                doi=article.doi,
                authors=article.authors,
                keywords=article.keywords,
                summary=article.summary,
            )
            chunks.append(chunk)
        
        return chunks
    
    async def _get_embedding_service(self):
        """Get or create embedding service."""
        if self._embedding_service is None:
            from app.embedding.pubmedbert_embeddings import get_pubmedbert_service
            self._embedding_service = await get_pubmedbert_service()
        return self._embedding_service
    
    async def _get_pinecone_index(self):
        """Get or create Pinecone index client."""
        if self._index is None:
            from pinecone import Pinecone
            self._pinecone = Pinecone(api_key=self.settings.PINECONE_API_KEY)
            self._index = self._pinecone.Index(self.settings.PINECONE_INDEX_NAME)
        return self._index
    
    async def embed_and_upsert(
        self,
        chunks: List[PubMedKnowledgeChunk],
        namespace: str,
        batch_size: int = 32
    ) -> Tuple[int, int]:
        """Embed chunks and upsert to Pinecone."""
        if not chunks:
            return 0, 0
        
        embedding_service = await self._get_embedding_service()
        index = await self._get_pinecone_index()
        
        vectors_upserted = 0
        embeddings_generated = 0
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            
            # Get embeddings
            texts = [c.chunk_text for c in batch]
            results = await embedding_service.embed_batch(texts)
            embeddings_generated += len([r for r in results if r and not r.cached])
            
            # Prepare vectors
            pinecone_vectors = []
            for chunk, result in zip(batch, results):
                if result is None:
                    continue
                    
                metadata = {
                    "chunk_id": chunk.chunk_id,
                    "pmid": chunk.pmid,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                    "title": chunk.title[:1000] if chunk.title else "",
                    "abstract": chunk.abstract[:5000] if chunk.abstract else "",
                    "mesh_terms": ",".join([m.term for m in chunk.mesh_terms[:20]]),
                    "icd10_codes": ",".join(chunk.icd10_codes[:10]),
                    "evidence_level": chunk.evidence_level.value,
                    "knowledge_source": chunk.knowledge_source.value,
                    "publication_year": chunk.publication_year or 0,
                    "journal": chunk.journal[:200] if chunk.journal else "",
                    "namespace": namespace,
                    "ingest_timestamp": datetime.utcnow().isoformat(),
                }
                
                pinecone_vectors.append((chunk.chunk_id, result.embedding, metadata))
            
            # Upsert in batches
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
                    logger.error(f"[PubMedKnowledgeIngestor] Upsert failed: {e}")
                    self.stats["total_errors"] += 1
        
        return vectors_upserted, embeddings_generated
    
    async def ingest_namespace(
        self,
        namespace: str,
        mesh_query: str,
        max_articles: int = 500,
        force: bool = False
    ) -> IngestionResult:
        """Ingest articles for a clinical namespace."""
        start_time = time.time()
        
        if not force and not self._check_ingestion_needed(namespace):
            logger.info(f"[PubMedKnowledgeIngestor] Skipping {namespace} - recently ingested")
            return IngestionResult(
                namespace=namespace,
                status="skipped",
                message="Recently ingested (<90 days)"
            )
        
        logger.info(f"[PubMedKnowledgeIngestor] Starting ingestion for {namespace}")
        
        articles_processed = 0
        chunks_created = 0
        vectors_upserted = 0
        mesh_enriched = 0
        embeddings_generated = 0
        errors = 0
        
        async with aiohttp.ClientSession() as session:
            pmids = await self.search_pubmed(
                session, mesh_query, max_results=max_articles
            )
            
            if not pmids:
                return IngestionResult(
                    namespace=namespace,
                    status="error",
                    message="No articles found"
                )
            
            all_chunks = []
            
            async for article in self.fetch_articles(session, pmids):
                try:
                    chunks = self._create_chunks(article)
                    all_chunks.extend(chunks)
                    articles_processed += 1
                    mesh_enriched += len(article.mesh_terms)
                    
                    if len(all_chunks) >= 100:
                        upserted, embeddings = await self.embed_and_upsert(all_chunks, namespace)
                        vectors_upserted += upserted
                        embeddings_generated += embeddings
                        chunks_created += len(all_chunks)
                        all_chunks = []
                        
                except Exception as e:
                    logger.error(f"[PubMedKnowledgeIngestor] Article processing error: {e}")
                    errors += 1
            
            if all_chunks:
                upserted, embeddings = await self.embed_and_upsert(all_chunks, namespace)
                vectors_upserted += upserted
                embeddings_generated += embeddings
                chunks_created += len(all_chunks)
        
        # Record ingestion
        self._record_ingestion(
            namespace, articles_processed, chunks_created, mesh_enriched, embeddings_generated
        )
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["total_ingested"] += articles_processed
        self.stats["total_chunks"] += chunks_created
        self.stats["total_mesh_enriched"] += mesh_enriched
        self.stats["total_embeddings"] += embeddings_generated
        self.stats["total_errors"] += errors
        self.stats["last_ingestion"] = datetime.utcnow().isoformat()
        
        logger.info(
            f"[PubMedKnowledgeIngestor] Completed {namespace}: "
            f"{articles_processed} articles, {vectors_upserted} vectors, "
            f"{mesh_enriched} MeSH terms enriched"
        )
        
        return IngestionResult(
            namespace=namespace,
            status="success",
            articles_processed=articles_processed,
            chunks_created=chunks_created,
            vectors_upserted=vectors_upserted,
            mesh_terms_enriched=mesh_enriched,
            embeddings_generated=embeddings_generated,
            errors=errors,
            latency_ms=latency_ms,
            message=f"Ingested {articles_processed} articles with MeSH enrichment"
        )
    
    async def ingest_all_namespaces(
        self,
        max_articles_per_namespace: int = 500,
        force: bool = False
    ) -> Dict[str, IngestionResult]:
        """Ingest all clinical namespaces."""
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
                logger.error(f"[PubMedKnowledgeIngestor] Failed to ingest {namespace}: {e}")
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
        
        cursor.execute("SELECT * FROM knowledge_ingestion_log")
        rows = cursor.fetchall()
        conn.close()
        
        status = {}
        for row in rows:
            namespace = row[0]
            status[namespace] = {
                "last_ingested_at": row[1],
                "article_count": row[2],
                "chunk_count": row[3],
                "mesh_terms_enriched": row[4],
                "embeddings_generated": row[5],
                "last_error": row[6],
            }
        
        for namespace in CLINICAL_NAMESPACES:
            if namespace not in status:
                status[namespace] = {
                    "last_ingested_at": None,
                    "article_count": 0,
                    "chunk_count": 0,
                    "mesh_terms_enriched": 0,
                    "embeddings_generated": 0,
                    "last_error": None,
                }
        
        return {
            "namespaces": status,
            "stats": self.stats,
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_ingestor: Optional[PubMedKnowledgeIngestor] = None


def get_pubmed_knowledge_ingestor() -> PubMedKnowledgeIngestor:
    """Get or create PubMed knowledge ingestor singleton."""
    global _ingestor
    
    if _ingestor is None:
        _ingestor = PubMedKnowledgeIngestor()
    
    return _ingestor
