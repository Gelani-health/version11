"""
P2: Medical Knowledge Graph Construction Module
=================================================

Builds and maintains a medical knowledge graph for:
- Clinical concept relationships
- Disease-symptom associations
- Drug-disease interactions
- Comorbidity networks
- Treatment pathways
- Clinical decision support

Features:
- Graph construction from clinical data
- Relationship extraction from medical literature
- Subgraph extraction for clinical queries
- Path finding between medical concepts
- Centrality analysis for important concepts
- Graph-based clinical decision support

Technologies:
- In-memory graph storage with adjacency lists
- Relationship type classification
- Confidence-weighted edges
- Temporal relationship tracking

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

import re
import json
import time
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import lru_cache
from collections import defaultdict
import heapq

from loguru import logger


# =============================================================================
# ENUMERATIONS
# =============================================================================

class RelationType(Enum):
    """Types of relationships in the medical knowledge graph."""
    # Disease Relationships
    CAUSES = "causes"
    CAUSED_BY = "caused_by"
    IS_A = "is_a"
    HAS_SYMPTOM = "has_symptom"
    SYMPTOM_OF = "symptom_of"
    COMPLICATES = "complicates"
    COMPLICATED_BY = "complicated_by"
    PREDISPOSES = "predisposes"
    PREDISPOSED_BY = "predisposed_by"
    
    # Treatment Relationships
    TREATS = "treats"
    TREATED_BY = "treated_by"
    PREVENTS = "prevents"
    PREVENTED_BY = "prevented_by"
    CONTRAINDICATED = "contraindicated"
    INDICATED = "indicated"
    
    # Drug Relationships
    DRUG_DRUG_INTERACTION = "drug_drug_interaction"
    HAS_SIDE_EFFECT = "has_side_effect"
    SIDE_EFFECT_OF = "side_effect_of"
    METABOLIZED_BY = "metabolized_by"
    METABOLIZES = "metabolizes"
    INHIBITS = "inhibits"
    INHIBITED_BY = "inhibited_by"
    
    # Anatomy Relationships
    LOCATED_IN = "located_in"
    CONTAINS = "contains"
    PART_OF = "part_of"
    HAS_PART = "has_part"
    AFFECTS = "affects"
    AFFECTED_BY = "affected_by"
    
    # Diagnostic Relationships
    DIAGNOSES = "diagnoses"
    DIAGNOSED_BY = "diagnosed_by"
    HAS_FINDING = "has_finding"
    FINDING_OF = "finding_of"
    
    # Temporal Relationships
    PRECEDES = "precedes"
    FOLLOWS = "follows"
    CO_OCCURS = "co_occurs"
    
    # General
    RELATED_TO = "related_to"
    SAME_AS = "same_as"
    DIFFERENT_FROM = "different_from"


class NodeType(Enum):
    """Types of nodes in the medical knowledge graph."""
    DISEASE = "disease"
    SYMPTOM = "symptom"
    DRUG = "drug"
    PROCEDURE = "procedure"
    ANATOMY = "anatomy"
    LAB_TEST = "lab_test"
    FINDING = "finding"
    GENE = "gene"
    PATHWAY = "pathway"
    ORGANISM = "organism"
    COMPOUND = "compound"
    PHENOMENON = "phenomenon"
    CONCEPT = "concept"


class EdgeStrength(Enum):
    """Strength of relationship evidence."""
    STRONG = "strong"        # Clinical trial evidence
    MODERATE = "moderate"    # Observational studies
    WEAK = "weak"           # Case reports/expert opinion
    THEORETICAL = "theoretical"  # Hypothetical


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class GraphNode:
    """A node in the medical knowledge graph."""
    id: str
    name: str
    node_type: NodeType
    aliases: List[str] = field(default_factory=list)
    description: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)
    source_concept: Optional[str] = None  # CUI if from UMLS
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.node_type.value,
            "aliases": self.aliases[:5],
            "description": self.description[:200] if self.description else "",
            "attributes": {k: v for k, v in list(self.attributes.items())[:5]},
        }


@dataclass
class GraphEdge:
    """An edge in the medical knowledge graph."""
    source_id: str
    target_id: str
    relation_type: RelationType
    confidence: float = 1.0
    evidence: List[str] = field(default_factory=list)  # PubMed IDs or guideline IDs
    strength: EdgeStrength = EdgeStrength.MODERATE
    attributes: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source_id,
            "target": self.target_id,
            "relation": self.relation_type.value,
            "confidence": round(self.confidence, 3),
            "evidence": self.evidence[:3],
            "strength": self.strength.value,
        }


@dataclass
class GraphPath:
    """A path between nodes in the knowledge graph."""
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    total_confidence: float
    length: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
            "total_confidence": round(self.total_confidence, 3),
            "length": self.length,
            "path_text": " -> ".join([n.name for n in self.nodes]),
        }


@dataclass
class Subgraph:
    """A subgraph extracted from the knowledge graph."""
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    center_node: Optional[GraphNode] = None
    extraction_query: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
            "center_node": self.center_node.to_dict() if self.center_node else None,
            "extraction_query": self.extraction_query,
            "statistics": {
                "node_count": len(self.nodes),
                "edge_count": len(self.edges),
                "node_types": self._count_node_types(),
                "relation_types": self._count_relation_types(),
            }
        }
    
    def _count_node_types(self) -> Dict[str, int]:
        counts = defaultdict(int)
        for node in self.nodes:
            counts[node.node_type.value] += 1
        return dict(counts)
    
    def _count_relation_types(self) -> Dict[str, int]:
        counts = defaultdict(int)
        for edge in self.edges:
            counts[edge.relation_type.value] += 1
        return dict(counts)


# =============================================================================
# BUILT-IN KNOWLEDGE GRAPH DATA
# =============================================================================

# Pre-built medical knowledge graph with clinical relationships
BUILTIN_NODES: List[Dict[str, Any]] = [
    # Diseases
    {"id": "D_MI", "name": "Myocardial Infarction", "type": NodeType.DISEASE, "aliases": ["Heart Attack", "MI"]},
    {"id": "D_HF", "name": "Heart Failure", "type": NodeType.DISEASE, "aliases": ["CHF", "Cardiac Failure"]},
    {"id": "D_AF", "name": "Atrial Fibrillation", "type": NodeType.DISEASE, "aliases": ["AF", "AFib"]},
    {"id": "D_HTN", "name": "Hypertension", "type": NodeType.DISEASE, "aliases": ["High Blood Pressure", "HTN"]},
    {"id": "D_DM", "name": "Diabetes Mellitus", "type": NodeType.DISEASE, "aliases": ["DM", "Diabetes"]},
    {"id": "D_T2DM", "name": "Type 2 Diabetes", "type": NodeType.DISEASE, "aliases": ["T2DM", "NIDDM"]},
    {"id": "D_CKD", "name": "Chronic Kidney Disease", "type": NodeType.DISEASE, "aliases": ["CKD", "Renal Failure"]},
    {"id": "D_STROKE", "name": "Stroke", "type": NodeType.DISEASE, "aliases": ["CVA", "Cerebrovascular Accident"]},
    {"id": "D_COPD", "name": "COPD", "type": NodeType.DISEASE, "aliases": ["Chronic Obstructive Pulmonary Disease"]},
    {"id": "D_PNEUMONIA", "name": "Pneumonia", "type": NodeType.DISEASE, "aliases": ["Lung Infection"]},
    {"id": "D_SEPSIS", "name": "Sepsis", "type": NodeType.DISEASE, "aliases": ["Septicemia"]},
    {"id": "D_Asthma", "name": "Asthma", "type": NodeType.DISEASE, "aliases": ["Bronchial Asthma"]},
    {"id": "D_DEPRESSION", "name": "Major Depressive Disorder", "type": NodeType.DISEASE, "aliases": ["Depression", "MDD"]},
    {"id": "D_OBESITY", "name": "Obesity", "type": NodeType.DISEASE, "aliases": ["Obese"]},
    {"id": "D_ASCVD", "name": "Atherosclerotic Cardiovascular Disease", "type": NodeType.DISEASE, "aliases": ["ASCVD", "CAD"]},
    {"id": "D_VTE", "name": "Venous Thromboembolism", "type": NodeType.DISEASE, "aliases": ["VTE", "Blood Clot"]},
    {"id": "D_DVT", "name": "Deep Vein Thrombosis", "type": NodeType.DISEASE, "aliases": ["DVT"]},
    {"id": "D_PE", "name": "Pulmonary Embolism", "type": NodeType.DISEASE, "aliases": ["PE"]},
    
    # Symptoms
    {"id": "S_CHEST_PAIN", "name": "Chest Pain", "type": NodeType.SYMPTOM, "aliases": ["Chest Discomfort"]},
    {"id": "S_DYSPNEA", "name": "Dyspnea", "type": NodeType.SYMPTOM, "aliases": ["Shortness of Breath", "SOB"]},
    {"id": "S_PALPITATIONS", "name": "Palpitations", "type": NodeType.SYMPTOM, "aliases": ["Heart Racing"]},
    {"id": "S_EDEMA", "name": "Edema", "type": NodeType.SYMPTOM, "aliases": ["Swelling"]},
    {"id": "S_FATIGUE", "name": "Fatigue", "type": NodeType.SYMPTOM, "aliases": ["Tiredness"]},
    {"id": "S_FEVER", "name": "Fever", "type": NodeType.SYMPTOM, "aliases": ["Pyrexia", "Elevated Temperature"]},
    {"id": "S_COUGH", "name": "Cough", "type": NodeType.SYMPTOM, "aliases": ["Coughing"]},
    {"id": "S_SYNCOPE", "name": "Syncope", "type": NodeType.SYMPTOM, "aliases": ["Fainting", "Loss of Consciousness"]},
    {"id": "S_HEADACHE", "name": "Headache", "type": NodeType.SYMPTOM, "aliases": ["Cephalgia"]},
    {"id": "S_POLYURIA", "name": "Polyuria", "type": NodeType.SYMPTOM, "aliases": ["Frequent Urination"]},
    {"id": "S_POLYDIPSIA", "name": "Polydipsia", "type": NodeType.SYMPTOM, "aliases": ["Excessive Thirst"]},
    
    # Drugs
    {"id": "DR_ASA", "name": "Aspirin", "type": NodeType.DRUG, "aliases": ["ASA", "Acetylsalicylic Acid"]},
    {"id": "DR_METFORMIN", "name": "Metformin", "type": NodeType.DRUG, "aliases": ["Glucophage"]},
    {"id": "DR_ATORVASTATIN", "name": "Atorvastatin", "type": NodeType.DRUG, "aliases": ["Lipitor"]},
    {"id": "DR_LISINOPRIL", "name": "Lisinopril", "type": NodeType.DRUG, "aliases": ["Prinivil", "Zestril"]},
    {"id": "DR_METOPROLOL", "name": "Metoprolol", "type": NodeType.DRUG, "aliases": ["Lopressor", "Toprol"]},
    {"id": "DR_HCTZ", "name": "Hydrochlorothiazide", "type": NodeType.DRUG, "aliases": ["HCTZ"]},
    {"id": "DR_DABIGATRAN", "name": "Dabigatran", "type": NodeType.DRUG, "aliases": ["Pradaxa"]},
    {"id": "DR_APIXABAN", "name": "Apixaban", "type": NodeType.DRUG, "aliases": ["Eliquis"]},
    {"id": "DR_RIVAROXABAN", "name": "Rivaroxaban", "type": NodeType.DRUG, "aliases": ["Xarelto"]},
    {"id": "DR_AMLODIPINE", "name": "Amlodipine", "type": NodeType.DRUG, "aliases": ["Norvasc"]},
    {"id": "DR_CLOPIDOGREL", "name": "Clopidogrel", "type": NodeType.DRUG, "aliases": ["Plavix"]},
    {"id": "DR_DAPAGLIFLOZIN", "name": "Dapagliflozin", "type": NodeType.DRUG, "aliases": ["Farxiga"]},
    {"id": "DR_EMPAGLIFLOZIN", "name": "Empagliflozin", "type": NodeType.DRUG, "aliases": ["Jardiance"]},
    {"id": "DR_SGLT2I", "name": "SGLT2 Inhibitors", "type": NodeType.DRUG, "aliases": ["SGLT2i", "Gliflozins"]},
    {"id": "DR_ACEI", "name": "ACE Inhibitors", "type": NodeType.DRUG, "aliases": ["ACEi", "ACE Inhibitor"]},
    {"id": "DR_ARB", "name": "ARBs", "type": NodeType.DRUG, "aliases": ["Angiotensin Receptor Blockers"]},
    {"id": "DR_STATIN", "name": "Statins", "type": NodeType.DRUG, "aliases": ["HMG-CoA Reductase Inhibitors"]},
    {"id": "DR_INSULIN", "name": "Insulin", "type": NodeType.DRUG, "aliases": ["Insulin Therapy"]},
    {"id": "DR_METROPROLOL", "name": "Metoprolol", "type": NodeType.DRUG, "aliases": ["Lopressor"]},
    {"id": "DR_CEFTRIAXONE", "name": "Ceftriaxone", "type": NodeType.DRUG, "aliases": ["Rocephin"]},
    {"id": "DR_AZITHROMYCIN", "name": "Azithromycin", "type": NodeType.DRUG, "aliases": ["Zithromax"]},
    {"id": "DR_NOREPINEPHRINE", "name": "Norepinephrine", "type": NodeType.DRUG, "aliases": ["Levophed", "Norad"]},
    {"id": "DR_MORPHINE", "name": "Morphine", "type": NodeType.DRUG, "aliases": ["MS Contin"]},
    {"id": "DR_NITROGLYCERIN", "name": "Nitroglycerin", "type": NodeType.DRUG, "aliases": ["Nitro"]},
    {"id": "DR_OSIMERTINIB", "name": "Osimertinib", "type": NodeType.DRUG, "aliases": ["Tagrisso"]},
    {"id": "DR_AMLODICINE", "name": "Amlodipine", "type": NodeType.DRUG, "aliases": ["Norvasc"]},
    
    # Procedures
    {"id": "P_PCI", "name": "Percutaneous Coronary Intervention", "type": NodeType.PROCEDURE, "aliases": ["PCI", "Angioplasty"]},
    {"id": "P_CABG", "name": "Coronary Artery Bypass Graft", "type": NodeType.PROCEDURE, "aliases": ["CABG", "Bypass Surgery"]},
    {"id": "P_ECHO", "name": "Echocardiogram", "type": NodeType.PROCEDURE, "aliases": ["Echo", "Cardiac Ultrasound"]},
    {"id": "P_ECG", "name": "Electrocardiogram", "type": NodeType.PROCEDURE, "aliases": ["ECG", "EKG"]},
    {"id": "P_CT", "name": "CT Scan", "type": NodeType.PROCEDURE, "aliases": ["Computed Tomography"]},
    {"id": "P_MRI", "name": "MRI", "type": NodeType.PROCEDURE, "aliases": ["Magnetic Resonance Imaging"]},
    {"id": "P_ABLATION", "name": "Catheter Ablation", "type": NodeType.PROCEDURE, "aliases": ["Cardiac Ablation"]},
    {"id": "P_ICD", "name": "ICD Implantation", "type": NodeType.PROCEDURE, "aliases": ["Implantable Cardioverter Defibrillator"]},
    {"id": "P_HB1AC", "name": "HbA1c Test", "type": NodeType.LAB_TEST, "aliases": ["Glycated Hemoglobin"]},
    {"id": "P_EGFR", "name": "eGFR", "type": NodeType.LAB_TEST, "aliases": ["Estimated Glomerular Filtration Rate"]},
    {"id": "P_BNP", "name": "BNP", "type": NodeType.LAB_TEST, "aliases": ["B-type Natriuretic Peptide"]},
    {"id": "P_TROPONIN", "name": "Troponin", "type": NodeType.LAB_TEST, "aliases": ["Cardiac Troponin"]},
    
    # Anatomy
    {"id": "A_HEART", "name": "Heart", "type": NodeType.ANATOMY, "aliases": ["Cardiac"]},
    {"id": "A_KIDNEY", "name": "Kidney", "type": NodeType.ANATOMY, "aliases": ["Renal"]},
    {"id": "A_LUNG", "name": "Lung", "type": NodeType.ANATOMY, "aliases": ["Pulmonary"]},
    {"id": "A_BRAIN", "name": "Brain", "type": NodeType.ANATOMY, "aliases": ["Cerebral"]},
    {"id": "A_VASCULATURE", "name": "Blood Vessels", "type": NodeType.ANATOMY, "aliases": ["Vasculature"]},
]

BUILTIN_EDGES: List[Dict[str, Any]] = [
    # Disease -> Symptom relationships
    {"source": "D_MI", "target": "S_CHEST_PAIN", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.95},
    {"source": "D_MI", "target": "S_DYSPNEA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.85},
    {"source": "D_MI", "target": "S_SYNCOPE", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.6},
    {"source": "D_HF", "target": "S_DYSPNEA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.95},
    {"source": "D_HF", "target": "S_EDEMA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.90},
    {"source": "D_HF", "target": "S_FATIGUE", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.85},
    {"source": "D_AF", "target": "S_PALPITATIONS", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.90},
    {"source": "D_AF", "target": "S_DYSPNEA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.70},
    {"source": "D_AF", "target": "S_SYNCOPE", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.50},
    {"source": "D_HTN", "target": "S_HEADACHE", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.60},
    {"source": "D_DM", "target": "S_POLYURIA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.80},
    {"source": "D_DM", "target": "S_POLYDIPSIA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.80},
    {"source": "D_COPD", "target": "S_DYSPNEA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.95},
    {"source": "D_COPD", "target": "S_COUGH", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.90},
    {"source": "D_PNEUMONIA", "target": "S_FEVER", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.90},
    {"source": "D_PNEUMONIA", "target": "S_COUGH", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.95},
    {"source": "D_PNEUMONIA", "target": "S_DYSPNEA", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.80},
    {"source": "D_SEPSIS", "target": "S_FEVER", "relation": RelationType.HAS_SYMPTOM, "confidence": 0.85},
    
    # Disease -> Disease relationships (comorbidities, complications)
    {"source": "D_HTN", "target": "D_MI", "relation": RelationType.PREDISPOSES, "confidence": 0.85},
    {"source": "D_DM", "target": "D_MI", "relation": RelationType.PREDISPOSES, "confidence": 0.80},
    {"source": "D_DM", "target": "D_CKD", "relation": RelationType.CAUSES, "confidence": 0.75},
    {"source": "D_HTN", "target": "D_CKD", "relation": RelationType.PREDISPOSES, "confidence": 0.70},
    {"source": "D_HTN", "target": "D_STROKE", "relation": RelationType.PREDISPOSES, "confidence": 0.85},
    {"source": "D_AF", "target": "D_STROKE", "relation": RelationType.PREDISPOSES, "confidence": 0.90},
    {"source": "D_MI", "target": "D_HF", "relation": RelationType.COMPLICATES, "confidence": 0.60},
    {"source": "D_HF", "target": "D_AF", "relation": RelationType.PREDISPOSES, "confidence": 0.50},
    {"source": "D_DVT", "target": "D_PE", "relation": RelationType.CAUSES, "confidence": 0.80},
    {"source": "D_OBESITY", "target": "D_T2DM", "relation": RelationType.PREDISPOSES, "confidence": 0.85},
    {"source": "D_OBESITY", "target": "D_HTN", "relation": RelationType.PREDISPOSES, "confidence": 0.80},
    {"source": "D_T2DM", "target": "D_ASCVD", "relation": RelationType.PREDISPOSES, "confidence": 0.80},
    {"source": "D_DVT", "target": "D_VTE", "relation": RelationType.IS_A, "confidence": 1.0},
    {"source": "D_PE", "target": "D_VTE", "relation": RelationType.IS_A, "confidence": 1.0},
    
    # Drug -> Disease relationships (treatments)
    {"source": "DR_ASA", "target": "D_MI", "relation": RelationType.PREVENTS, "confidence": 0.90},
    {"source": "DR_ASA", "target": "D_STROKE", "relation": RelationType.PREVENTS, "confidence": 0.85},
    {"source": "DR_METFORMIN", "target": "D_T2DM", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_ATORVASTATIN", "target": "D_ASCVD", "relation": RelationType.PREVENTS, "confidence": 0.90},
    {"source": "DR_LISINOPRIL", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_LISINOPRIL", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_METOPROLOL", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_METOPROLOL", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.85},
    {"source": "DR_METOPROLOL", "target": "D_AF", "relation": RelationType.TREATS, "confidence": 0.80},
    {"source": "DR_HCTZ", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_DABIGATRAN", "target": "D_STROKE", "relation": RelationType.PREVENTS, "confidence": 0.90},
    {"source": "DR_APIXABAN", "target": "D_STROKE", "relation": RelationType.PREVENTS, "confidence": 0.92},
    {"source": "DR_RIVAROXABAN", "target": "D_STROKE", "relation": RelationType.PREVENTS, "confidence": 0.88},
    {"source": "DR_CLOPIDOGREL", "target": "D_MI", "relation": RelationType.PREVENTS, "confidence": 0.90},
    {"source": "DR_DAPAGLIFLOZIN", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.92},
    {"source": "DR_DAPAGLIFLOZIN", "target": "D_T2DM", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_EMPAGLIFLOZIN", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.92},
    {"source": "DR_EMPAGLIFLOZIN", "target": "D_T2DM", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_SGLT2I", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.92},
    {"source": "DR_SGLT2I", "target": "D_CKD", "relation": RelationType.TREATS, "confidence": 0.88},
    {"source": "DR_ACEI", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_ACEI", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_ACEI", "target": "D_CKD", "relation": RelationType.TREATS, "confidence": 0.85},
    {"source": "DR_ARB", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "DR_ARB", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_STATIN", "target": "D_ASCVD", "relation": RelationType.PREVENTS, "confidence": 0.92},
    {"source": "DR_AMLODIPINE", "target": "D_HTN", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_NOREPINEPHRINE", "target": "D_SEPSIS", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "DR_CEFTRIAXONE", "target": "D_PNEUMONIA", "relation": RelationType.TREATS, "confidence": 0.85},
    {"source": "DR_AZITHROMYCIN", "target": "D_PNEUMONIA", "relation": RelationType.TREATS, "confidence": 0.85},
    
    # Drug class relationships
    {"source": "DR_LISINOPRIL", "target": "DR_ACEI", "relation": RelationType.IS_A, "confidence": 1.0},
    {"source": "DR_DAPAGLIFLOZIN", "target": "DR_SGLT2I", "relation": RelationType.IS_A, "confidence": 1.0},
    {"source": "DR_EMPAGLIFLOZIN", "target": "DR_SGLT2I", "relation": RelationType.IS_A, "confidence": 1.0},
    {"source": "DR_ATORVASTATIN", "target": "DR_STATIN", "relation": RelationType.IS_A, "confidence": 1.0},
    {"source": "DR_APIXABAN", "target": "DR_RIVAROXABAN", "relation": RelationType.RELATED_TO, "confidence": 0.95},
    {"source": "DR_DABIGATRAN", "target": "DR_APIXABAN", "relation": RelationType.RELATED_TO, "confidence": 0.90},
    
    # Drug-Drug Interactions
    {"source": "DR_ASA", "target": "DR_CLOPIDOGREL", "relation": RelationType.DRUG_DRUG_INTERACTION, "confidence": 0.95, "strength": EdgeStrength.STRONG},
    {"source": "DR_DABIGATRAN", "target": "DR_ASA", "relation": RelationType.DRUG_DRUG_INTERACTION, "confidence": 0.85, "strength": EdgeStrength.STRONG},
    {"source": "DR_APIXABAN", "target": "DR_ASA", "relation": RelationType.DRUG_DRUG_INTERACTION, "confidence": 0.80, "strength": EdgeStrength.STRONG},
    
    # Procedure -> Disease relationships
    {"source": "P_PCI", "target": "D_MI", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "P_CABG", "target": "D_MI", "relation": RelationType.TREATS, "confidence": 0.95},
    {"source": "P_CABG", "target": "D_ASCVD", "relation": RelationType.TREATS, "confidence": 0.90},
    {"source": "P_ABLATION", "target": "D_AF", "relation": RelationType.TREATS, "confidence": 0.85},
    {"source": "P_ICD", "target": "D_HF", "relation": RelationType.TREATS, "confidence": 0.90},
    
    # Diagnostic relationships
    {"source": "P_ECG", "target": "D_MI", "relation": RelationType.DIAGNOSES, "confidence": 0.85},
    {"source": "P_ECG", "target": "D_AF", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_ECHO", "target": "D_HF", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_TROPONIN", "target": "D_MI", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_BNP", "target": "D_HF", "relation": RelationType.DIAGNOSES, "confidence": 0.90},
    {"source": "P_HB1AC", "target": "D_DM", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_EGFR", "target": "D_CKD", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_CT", "target": "D_PE", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_CT", "target": "D_STROKE", "relation": RelationType.DIAGNOSES, "confidence": 0.95},
    {"source": "P_MRI", "target": "D_STROKE", "relation": RelationType.DIAGNOSES, "confidence": 0.98},
    
    # Anatomy relationships
    {"source": "D_MI", "target": "A_HEART", "relation": RelationType.LOCATED_IN, "confidence": 1.0},
    {"source": "D_HF", "target": "A_HEART", "relation": RelationType.AFFECTS, "confidence": 1.0},
    {"source": "D_AF", "target": "A_HEART", "relation": RelationType.AFFECTS, "confidence": 1.0},
    {"source": "D_CKD", "target": "A_KIDNEY", "relation": RelationType.AFFECTS, "confidence": 1.0},
    {"source": "D_COPD", "target": "A_LUNG", "relation": RelationType.AFFECTS, "confidence": 1.0},
    {"source": "D_PNEUMONIA", "target": "A_LUNG", "relation": RelationType.LOCATED_IN, "confidence": 1.0},
    {"source": "D_STROKE", "target": "A_BRAIN", "relation": RelationType.LOCATED_IN, "confidence": 1.0},
]


# =============================================================================
# MEDICAL KNOWLEDGE GRAPH ENGINE
# =============================================================================

class MedicalKnowledgeGraph:
    """
    P2: Medical Knowledge Graph Construction and Query Engine.
    
    Provides comprehensive knowledge graph capabilities:
    - Graph construction from clinical data
    - Subgraph extraction for clinical queries
    - Path finding between concepts
    - Centrality analysis
    - Treatment recommendation
    """
    
    def __init__(self):
        self._nodes: Dict[str, GraphNode] = {}
        self._edges: List[GraphEdge] = []
        self._adjacency: Dict[str, Dict[str, List[GraphEdge]]] = defaultdict(lambda: defaultdict(list))
        self._reverse_adjacency: Dict[str, Dict[str, List[GraphEdge]]] = defaultdict(lambda: defaultdict(list))
        self._name_index: Dict[str, str] = {}  # name/alias -> node_id
        self._type_index: Dict[NodeType, List[str]] = defaultdict(list)
        self._initialized = False
        
        self.stats = {
            "total_nodes": 0,
            "total_edges": 0,
            "total_queries": 0,
            "avg_query_time_ms": 0.0,
        }
    
    def initialize(self):
        """Initialize the knowledge graph with built-in data."""
        if self._initialized:
            return
        
        start_time = time.time()
        
        # Load nodes
        for node_data in BUILTIN_NODES:
            self._add_node_from_dict(node_data)
        
        # Load edges
        for edge_data in BUILTIN_EDGES:
            self._add_edge_from_dict(edge_data)
        
        self._initialized = True
        
        latency = (time.time() - start_time) * 1000
        logger.info(f"[KnowledgeGraph] Loaded {len(self._nodes)} nodes and {len(self._edges)} edges in {latency:.2f}ms")
    
    def _add_node_from_dict(self, data: Dict[str, Any]) -> str:
        """Add a node from dictionary data."""
        node = GraphNode(
            id=data["id"],
            name=data["name"],
            node_type=data["type"],
            aliases=data.get("aliases", []),
            description=data.get("description", ""),
            attributes=data.get("attributes", {}),
        )
        
        self._nodes[node.id] = node
        self._name_index[node.name.lower()] = node.id
        
        for alias in node.aliases:
            self._name_index[alias.lower()] = node.id
        
        self._type_index[node.node_type].append(node.id)
        self.stats["total_nodes"] += 1
        
        return node.id
    
    def _add_edge_from_dict(self, data: Dict[str, Any]) -> None:
        """Add an edge from dictionary data."""
        edge = GraphEdge(
            source_id=data["source"],
            target_id=data["target"],
            relation_type=data["relation"],
            confidence=data.get("confidence", 1.0),
            evidence=data.get("evidence", []),
            strength=data.get("strength", EdgeStrength.MODERATE),
            attributes=data.get("attributes", {}),
        )
        
        self._edges.append(edge)
        self._adjacency[edge.source_id][edge.target_id].append(edge)
        self._reverse_adjacency[edge.target_id][edge.source_id].append(edge)
        self.stats["total_edges"] += 1
    
    def get_node(self, node_id: str) -> Optional[GraphNode]:
        """Get a node by ID."""
        if not self._initialized:
            self.initialize()
        return self._nodes.get(node_id)
    
    def find_node_by_name(self, name: str) -> Optional[GraphNode]:
        """Find a node by name or alias."""
        if not self._initialized:
            self.initialize()
        
        name_lower = name.lower()
        node_id = self._name_index.get(name_lower)
        
        if node_id:
            return self._nodes.get(node_id)
        
        # Fuzzy matching
        for indexed_name, nid in self._name_index.items():
            if name_lower in indexed_name or indexed_name in name_lower:
                return self._nodes.get(nid)
        
        return None
    
    def get_neighbors(
        self,
        node_id: str,
        relation_types: Optional[List[RelationType]] = None,
        direction: str = "out",  # "out", "in", "both"
    ) -> List[Tuple[GraphNode, GraphEdge]]:
        """Get neighboring nodes with their edges."""
        if not self._initialized:
            self.initialize()
        
        neighbors = []
        
        if direction in ["out", "both"]:
            for target_id, edges in self._adjacency[node_id].items():
                for edge in edges:
                    if relation_types is None or edge.relation_type in relation_types:
                        target_node = self._nodes.get(target_id)
                        if target_node:
                            neighbors.append((target_node, edge))
        
        if direction in ["in", "both"]:
            for source_id, edges in self._reverse_adjacency[node_id].items():
                for edge in edges:
                    if relation_types is None or edge.relation_type in relation_types:
                        source_node = self._nodes.get(source_id)
                        if source_node:
                            neighbors.append((source_node, edge))
        
        return neighbors
    
    def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
        relation_types: Optional[List[RelationType]] = None,
    ) -> Optional[GraphPath]:
        """Find the shortest path between two nodes using BFS."""
        if not self._initialized:
            self.initialize()
        
        if source_id not in self._nodes or target_id not in self._nodes:
            return None
        
        # BFS
        queue = [(source_id, [self._nodes[source_id]], [])]
        visited = {source_id}
        
        while queue:
            current_id, path_nodes, path_edges = queue.pop(0)
            
            if current_id == target_id:
                total_confidence = 1.0
                for edge in path_edges:
                    total_confidence *= edge.confidence
                
                return GraphPath(
                    nodes=path_nodes,
                    edges=path_edges,
                    total_confidence=total_confidence,
                    length=len(path_edges),
                )
            
            if len(path_nodes) > max_depth:
                continue
            
            for neighbor, edge in self.get_neighbors(current_id, relation_types, "out"):
                if neighbor.id not in visited:
                    visited.add(neighbor.id)
                    queue.append((
                        neighbor.id,
                        path_nodes + [neighbor],
                        path_edges + [edge],
                    ))
        
        return None
    
    def extract_subgraph(
        self,
        center_node_id: str,
        depth: int = 2,
        node_types: Optional[List[NodeType]] = None,
        relation_types: Optional[List[RelationType]] = None,
    ) -> Subgraph:
        """Extract a subgraph around a center node."""
        if not self._initialized:
            self.initialize()
        
        center_node = self._nodes.get(center_node_id)
        if not center_node:
            return Subgraph(nodes=[], edges=[])
        
        visited_nodes = {center_node_id}
        visited_edges = set()
        nodes = [center_node]
        edges = []
        
        # BFS expansion
        current_level = [center_node_id]
        
        for _ in range(depth):
            next_level = []
            
            for node_id in current_level:
                for neighbor, edge in self.get_neighbors(node_id, relation_types, "both"):
                    # Filter by node type
                    if node_types and neighbor.node_type not in node_types:
                        continue
                    
                    if neighbor.id not in visited_nodes:
                        visited_nodes.add(neighbor.id)
                        nodes.append(neighbor)
                        next_level.append(neighbor.id)
                    
                    # Add edge
                    edge_key = f"{edge.source_id}-{edge.target_id}-{edge.relation_type.value}"
                    if edge_key not in visited_edges:
                        visited_edges.add(edge_key)
                        edges.append(edge)
            
            current_level = next_level
        
        return Subgraph(
            nodes=nodes,
            edges=edges,
            center_node=center_node,
        )
    
    def get_treatments_for_disease(
        self,
        disease_name: str,
        include_prevention: bool = True,
    ) -> List[Tuple[GraphNode, GraphEdge]]:
        """Get all treatments for a disease."""
        if not self._initialized:
            self.initialize()
        
        disease_node = self.find_node_by_name(disease_name)
        if not disease_node:
            return []
        
        # Look for TREATS and PREVENTS relations where disease is the target
        relation_types = [RelationType.TREATS]
        if include_prevention:
            relation_types.append(RelationType.PREVENTS)
        
        return self.get_neighbors(disease_node.id, relation_types, "in")
    
    def get_diseases_for_symptom(
        self,
        symptom_name: str,
    ) -> List[Tuple[GraphNode, GraphEdge]]:
        """Get all diseases that can cause a symptom."""
        if not self._initialized:
            self.initialize()
        
        symptom_node = self.find_node_by_name(symptom_name)
        if not symptom_node:
            return []
        
        return self.get_neighbors(
            symptom_node.id,
            [RelationType.HAS_SYMPTOM],
            "in"
        )
    
    def get_drug_interactions(
        self,
        drug_name: str,
    ) -> List[Tuple[GraphNode, GraphEdge]]:
        """Get all drug interactions for a medication."""
        if not self._initialized:
            self.initialize()
        
        drug_node = self.find_node_by_name(drug_name)
        if not drug_node:
            return []
        
        return self.get_neighbors(
            drug_node.id,
            [RelationType.DRUG_DRUG_INTERACTION],
            "both"
        )
    
    def get_comorbidities(
        self,
        disease_name: str,
    ) -> List[Tuple[GraphNode, GraphEdge]]:
        """Get comorbidities and related diseases."""
        if not self._initialized:
            self.initialize()
        
        disease_node = self.find_node_by_name(disease_name)
        if not disease_node:
            return []
        
        relations = [
            RelationType.PREDISPOSES,
            RelationType.COMPLICATES,
            RelationType.CO_OCCURS,
            RelationType.CAUSES,
        ]
        
        return self.get_neighbors(disease_node.id, relations, "both")
    
    def calculate_centrality(self, node_id: str) -> float:
        """Calculate degree centrality for a node."""
        if not self._initialized:
            self.initialize()
        
        in_degree = sum(len(edges) for edges in self._reverse_adjacency[node_id].values())
        out_degree = sum(len(edges) for edges in self._adjacency[node_id].values())
        
        total_nodes = len(self._nodes)
        if total_nodes == 0:
            return 0.0
        
        return (in_degree + out_degree) / (total_nodes - 1)
    
    def get_most_central_nodes(
        self,
        node_type: Optional[NodeType] = None,
        top_k: int = 10,
    ) -> List[Tuple[GraphNode, float]]:
        """Get the most central nodes by degree centrality."""
        if not self._initialized:
            self.initialize()
        
        candidates = list(self._nodes.values())
        if node_type:
            candidates = [n for n in candidates if n.node_type == node_type]
        
        centrality_scores = [
            (node, self.calculate_centrality(node.id))
            for node in candidates
        ]
        
        centrality_scores.sort(key=lambda x: x[1], reverse=True)
        return centrality_scores[:top_k]
    
    def search_nodes(
        self,
        query: str,
        node_types: Optional[List[NodeType]] = None,
        top_k: int = 10,
    ) -> List[GraphNode]:
        """Search for nodes matching a query."""
        if not self._initialized:
            self.initialize()
        
        query_lower = query.lower()
        results = []
        
        for node in self._nodes.values():
            # Filter by type
            if node_types and node.node_type not in node_types:
                continue
            
            # Match by name
            if query_lower in node.name.lower():
                results.append(node)
                continue
            
            # Match by alias
            for alias in node.aliases:
                if query_lower in alias.lower():
                    results.append(node)
                    break
        
        return results[:top_k]
    
    def query_graph(
        self,
        query: str,
        depth: int = 2,
    ) -> Subgraph:
        """
        Natural language query of the knowledge graph.
        
        Extracts relevant subgraph based on query terms.
        """
        if not self._initialized:
            self.initialize()
        
        # Find matching nodes
        matching_nodes = self.search_nodes(query)
        
        if not matching_nodes:
            return Subgraph(nodes=[], edges=[])
        
        # Use the most relevant node as center
        center_node = matching_nodes[0]
        
        # Extract subgraph
        return self.extract_subgraph(center_node.id, depth=depth)
    
    def get_nodes_by_type(self, node_type: NodeType) -> List[GraphNode]:
        """Get all nodes of a specific type."""
        if not self._initialized:
            self.initialize()
        
        return [self._nodes[nid] for nid in self._type_index.get(node_type, []) if nid in self._nodes]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get knowledge graph statistics."""
        if not self._initialized:
            self.initialize()
        
        return {
            **self.stats,
            "node_types": {t.value: len(ids) for t, ids in self._type_index.items()},
            "edge_types": self._count_edge_types(),
        }
    
    def _count_edge_types(self) -> Dict[str, int]:
        """Count edges by type."""
        counts = defaultdict(int)
        for edge in self._edges:
            counts[edge.relation_type.value] += 1
        return dict(counts)


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_knowledge_graph: Optional[MedicalKnowledgeGraph] = None


def get_knowledge_graph() -> MedicalKnowledgeGraph:
    """Get or create knowledge graph singleton."""
    global _knowledge_graph
    
    if _knowledge_graph is None:
        _knowledge_graph = MedicalKnowledgeGraph()
        _knowledge_graph.initialize()
    
    return _knowledge_graph


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def find_treatments(disease: str) -> List[Dict[str, Any]]:
    """Find treatments for a disease."""
    kg = get_knowledge_graph()
    results = kg.get_treatments_for_disease(disease)
    return [
        {"drug": node.to_dict(), "relationship": edge.to_dict()}
        for node, edge in results
    ]


def find_diseases_by_symptom(symptom: str) -> List[Dict[str, Any]]:
    """Find diseases that cause a symptom."""
    kg = get_knowledge_graph()
    results = kg.get_diseases_for_symptom(symptom)
    return [
        {"disease": node.to_dict(), "relationship": edge.to_dict()}
        for node, edge in results
    ]


def check_drug_interaction(drug1: str, drug2: Optional[str] = None) -> List[Dict[str, Any]]:
    """Check for drug interactions."""
    kg = get_knowledge_graph()
    results = kg.get_drug_interactions(drug1)
    
    if drug2:
        drug2_lower = drug2.lower()
        results = [
            (node, edge) for node, edge in results
            if drug2_lower in node.name.lower() or drug2_lower in [a.lower() for a in node.aliases]
        ]
    
    return [
        {"interacting_drug": node.to_dict(), "interaction": edge.to_dict()}
        for node, edge in results
    ]
