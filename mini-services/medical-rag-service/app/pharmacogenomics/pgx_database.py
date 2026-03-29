"""
Pharmacogenomics Data Module
============================

Integrates pharmacogenomics data for personalized medicine:
- CPIC guidelines
- PharmGKB data
- Drug-gene interactions
- Dosing recommendations by genotype

References:
- CPIC: https://cpicpgx.org/
- PharmGKB: https://www.pharmgkb.org/

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class Gene(Enum):
    """Important pharmacogenes."""
    CYP2C19 = "CYP2C19"
    CYP2D6 = "CYP2D6"
    CYP2C9 = "CYP2C9"
    CYP3A5 = "CYP3A5"
    SLCO1B1 = "SLCO1B1"
    HLA_B = "HLA-B"
    TPMT = "TPMT"
    NUDT15 = "NUDT15"
    VKORC1 = "VKORC1"
    UGT1A1 = "UGT1A1"
    DPYD = "DPYD"


class Phenotype(Enum):
    """Metabolizer phenotypes."""
    POOR = "Poor Metabolizer"
    INTERMEDIATE = "Intermediate Metabolizer"
    NORMAL = "Normal Metabolizer"
    RAPID = "Rapid Metabolizer"
    ULTRA_RAPID = "Ultra-rapid Metabolizer"


@dataclass
class DrugGeneInteraction:
    """Drug-gene interaction."""
    drug: str
    gene: Gene
    phenotype: Phenotype
    effect: str
    recommendation: str
    evidence_level: str  # high, moderate, low
    cpic_level: str  # A, B, C, D
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug": self.drug,
            "gene": self.gene.value,
            "phenotype": self.phenotype.value,
            "effect": self.effect,
            "recommendation": self.recommendation,
            "evidence": self.evidence_level,
        }


# CPIC-based drug-gene interactions
PHARMACOGENOMIC_DATABASE: List[Dict[str, Any]] = [
    # CYP2C19
    {
        "drug": "Clopidogrel",
        "gene": Gene.CYP2C19,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(
                drug="Clopidogrel",
                gene=Gene.CYP2C19,
                phenotype=Phenotype.POOR,
                effect="Reduced platelet inhibition, increased cardiovascular events",
                recommendation="Consider alternative antiplatelet (prasugrel, ticagrelor)",
                evidence_level="high",
                cpic_level="A",
            ),
            Phenotype.ULTRA_RAPID: DrugGeneInteraction(
                drug="Clopidogrel",
                gene=Gene.CYP2C19,
                phenotype=Phenotype.ULTRA_RAPID,
                effect="Enhanced platelet inhibition",
                recommendation="Standard dosing appropriate",
                evidence_level="moderate",
                cpic_level="A",
            ),
        },
    },
    # CYP2D6
    {
        "drug": "Codeine",
        "gene": Gene.CYP2D6,
        "phenotypes": {
            Phenotype.ULTRA_RAPID: DrugGeneInteraction(
                drug="Codeine",
                gene=Gene.CYP2D6,
                phenotype=Phenotype.ULTRA_RAPID,
                effect="Increased morphine formation, toxicity risk",
                recommendation="Avoid codeine; use alternative analgesic",
                evidence_level="high",
                cpic_level="A",
            ),
            Phenotype.POOR: DrugGeneInteraction(
                drug="Codeine",
                gene=Gene.CYP2D6,
                phenotype=Phenotype.POOR,
                effect="Reduced efficacy, no analgesia",
                recommendation="Avoid codeine; use alternative analgesic",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
    # SLCO1B1
    {
        "drug": "Simvastatin",
        "gene": Gene.SLCO1B1,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(
                drug="Simvastatin",
                gene=Gene.SLCO1B1,
                phenotype=Phenotype.POOR,
                effect="Increased myopathy risk",
                recommendation="Avoid simvastatin >20mg or use alternative statin",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
    # CYP2C9
    {
        "drug": "Warfarin",
        "gene": Gene.CYP2C9,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(
                drug="Warfarin",
                gene=Gene.CYP2C9,
                phenotype=Phenotype.POOR,
                effect="Increased bleeding risk, lower dose needed",
                recommendation="Reduce dose 25-50%; use pharmacogenomic dosing algorithm",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
    # HLA-B
    {
        "drug": "Carbamazepine",
        "gene": Gene.HLA_B,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(  # Using POOR for "positive"
                drug="Carbamazepine",
                gene=Gene.HLA_B,
                phenotype=Phenotype.POOR,
                effect="HLA-B*15:02 positive: SJS/TEN risk",
                recommendation="Avoid carbamazepine if HLA-B*15:02 positive",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
    # TPMT
    {
        "drug": "Azathioprine",
        "gene": Gene.TPMT,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(
                drug="Azathioprine",
                gene=Gene.TPMT,
                phenotype=Phenotype.POOR,
                effect="Severe myelosuppression risk",
                recommendation="Avoid or reduce dose 90%; start with 10% standard dose",
                evidence_level="high",
                cpic_level="A",
            ),
            Phenotype.INTERMEDIATE: DrugGeneInteraction(
                drug="Azathioprine",
                gene=Gene.TPMT,
                phenotype=Phenotype.INTERMEDIATE,
                effect="Increased toxicity risk",
                recommendation="Reduce dose 30-50%",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
    # DPYD
    {
        "drug": "Fluorouracil",
        "gene": Gene.DPYD,
        "phenotypes": {
            Phenotype.POOR: DrugGeneInteraction(
                drug="Fluorouracil",
                gene=Gene.DPYD,
                phenotype=Phenotype.POOR,
                effect="Severe, potentially fatal toxicity",
                recommendation="Avoid fluorouracil and capecitabine",
                evidence_level="high",
                cpic_level="A",
            ),
        },
    },
]


class PharmacogenomicsDatabase:
    """Pharmacogenomics lookup and recommendation engine."""
    
    def __init__(self):
        self._initialized = False
        self._interactions: Dict[str, Dict[Gene, Dict[Phenotype, DrugGeneInteraction]]] = {}
    
    def initialize(self):
        if self._initialized:
            return
        
        for entry in PHARMACOGENOMIC_DATABASE:
            drug = entry["drug"].lower()
            self._interactions[drug] = {}
            
            for gene, phenotypes in entry.get("phenotypes", {}).items():
                if gene not in self._interactions[drug]:
                    self._interactions[drug][gene] = {}
                self._interactions[drug][gene][phenotypes] = phenotypes
        
        self._initialized = True
    
    def get_recommendation(
        self,
        drug: str,
        gene: Gene,
        phenotype: Phenotype,
    ) -> Optional[DrugGeneInteraction]:
        """Get pharmacogenomic recommendation."""
        if not self._initialized:
            self.initialize()
        
        drug_lower = drug.lower()
        if drug_lower in self._interactions:
            if gene in self._interactions[drug_lower]:
                return self._interactions[drug_lower][gene].get(phenotype)
        
        return None
    
    def get_drug_genes(self, drug: str) -> List[Gene]:
        """Get genes that affect a drug."""
        if not self._initialized:
            self.initialize()
        
        drug_lower = drug.lower()
        if drug_lower in self._interactions:
            return list(self._interactions[drug_lower].keys())
        
        return []
    
    def get_all_drugs_for_gene(self, gene: Gene) -> List[str]:
        """Get all drugs affected by a gene."""
        if not self._initialized:
            self.initialize()
        
        drugs = []
        for drug, gene_dict in self._interactions.items():
            if gene in gene_dict:
                drugs.append(drug)
        
        return drugs


# Singleton
_pgx_db: Optional[PharmacogenomicsDatabase] = None

def get_pharmacogenomics_db() -> PharmacogenomicsDatabase:
    global _pgx_db
    if _pgx_db is None:
        _pgx_db = PharmacogenomicsDatabase()
        _pgx_db.initialize()
    return _pgx_db
