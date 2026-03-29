"""
P9: Namespace Router for Clinical Queries
=========================================

Routes clinical queries to appropriate Pinecone namespaces based on
chief complaint and symptom keywords.

Architecture:
- Maps chief complaints to relevant namespaces
- Scores namespaces by keyword overlap
- Falls back to all namespaces if no strong match
"""

import re
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass
from loguru import logger


# =============================================================================
# CHIEF COMPLAINT TO NAMESPACE MAPPING
# =============================================================================

COMPLAINT_NAMESPACE_MAP = {
    # Infectious Disease
    "fever": ["pubmed_infectious", "pubmed_pharmacology"],
    "infection": ["pubmed_infectious", "pubmed_pharmacology"],
    "sepsis": ["pubmed_infectious", "pubmed_emergency"],
    "antibiotic": ["pubmed_infectious", "pubmed_pharmacology"],
    "antimicrobial": ["pubmed_infectious", "pubmed_pharmacology"],
    "bacteremia": ["pubmed_infectious"],
    "pneumonia": ["pubmed_pulmonology", "pubmed_infectious"],
    "meningitis": ["pubmed_infectious", "pubmed_neurology"],
    "endocarditis": ["pubmed_infectious", "pubmed_cardiology"],
    "osteomyelitis": ["pubmed_infectious"],
    "cellulitis": ["pubmed_infectious"],
    "abscess": ["pubmed_infectious"],
    "uti": ["pubmed_infectious", "pubmed_nephrology"],
    "urinary tract": ["pubmed_infectious", "pubmed_nephrology"],
    
    # Cardiology
    "chest pain": ["pubmed_cardiology", "pubmed_emergency"],
    "palpitations": ["pubmed_cardiology", "pubmed_emergency"],
    "syncope": ["pubmed_cardiology", "pubmed_emergency", "pubmed_neurology"],
    "ecg": ["pubmed_cardiology", "pubmed_emergency"],
    "ekg": ["pubmed_cardiology", "pubmed_emergency"],
    "myocardial infarction": ["pubmed_cardiology", "pubmed_emergency"],
    "heart failure": ["pubmed_cardiology"],
    "arrhythmia": ["pubmed_cardiology"],
    "atrial fibrillation": ["pubmed_cardiology"],
    "hypertension": ["pubmed_cardiology", "pubmed_nephrology"],
    "hypotension": ["pubmed_cardiology", "pubmed_emergency"],
    "coronary": ["pubmed_cardiology"],
    "cardiac": ["pubmed_cardiology"],
    
    # Pulmonology
    "shortness of breath": ["pubmed_pulmonology", "pubmed_emergency"],
    "dyspnea": ["pubmed_pulmonology", "pubmed_emergency"],
    "cough": ["pubmed_pulmonology", "pubmed_infectious"],
    "asthma": ["pubmed_pulmonology"],
    "copd": ["pubmed_pulmonology"],
    "respiratory": ["pubmed_pulmonology"],
    "lung": ["pubmed_pulmonology"],
    "pulmonary": ["pubmed_pulmonology"],
    "pleural": ["pubmed_pulmonology"],
    "bronchitis": ["pubmed_pulmonology", "pubmed_infectious"],
    
    # Nephrology
    "renal": ["pubmed_nephrology", "pubmed_pharmacology"],
    "creatinine": ["pubmed_nephrology", "pubmed_pharmacology"],
    "oliguria": ["pubmed_nephrology", "pubmed_emergency"],
    "dialysis": ["pubmed_nephrology"],
    "kidney": ["pubmed_nephrology"],
    "aki": ["pubmed_nephrology", "pubmed_emergency"],
    "ckd": ["pubmed_nephrology"],
    "proteinuria": ["pubmed_nephrology"],
    "hematuria": ["pubmed_nephrology", "pubmed_infectious"],
    "nephropathy": ["pubmed_nephrology"],
    
    # Neurology
    "headache": ["pubmed_neurology", "pubmed_emergency"],
    "seizure": ["pubmed_neurology", "pubmed_emergency"],
    "stroke": ["pubmed_neurology", "pubmed_emergency"],
    "confusion": ["pubmed_neurology", "pubmed_emergency"],
    "altered mental": ["pubmed_neurology", "pubmed_emergency"],
    "neuropathy": ["pubmed_neurology"],
    "dementia": ["pubmed_neurology"],
    "parkinson": ["pubmed_neurology"],
    "epilepsy": ["pubmed_neurology"],
    "migraine": ["pubmed_neurology"],
    "multiple sclerosis": ["pubmed_neurology"],
    "neurological": ["pubmed_neurology"],
    
    # Pharmacology / Drug Interactions
    "drug interaction": ["pubmed_pharmacology"],
    "allergy": ["pubmed_pharmacology", "pubmed_infectious"],
    "adverse": ["pubmed_pharmacology"],
    "medication": ["pubmed_pharmacology"],
    "dosing": ["pubmed_pharmacology", "pubmed_nephrology"],
    "toxicity": ["pubmed_pharmacology", "pubmed_emergency"],
    "overdose": ["pubmed_pharmacology", "pubmed_emergency"],
    "anticoagulation": ["pubmed_pharmacology", "pubmed_cardiology"],
    "warfarin": ["pubmed_pharmacology"],
    "insulin": ["pubmed_pharmacology"],
    
    # Emergency
    "emergency": ["pubmed_emergency"],
    "acute": ["pubmed_emergency"],
    "triage": ["pubmed_emergency"],
    "trauma": ["pubmed_emergency"],
    "critical": ["pubmed_emergency"],
    "unconscious": ["pubmed_emergency", "pubmed_neurology"],
    "cardiac arrest": ["pubmed_emergency", "pubmed_cardiology"],
}


# =============================================================================
# MeSH SYNONYM EXPANSION
# =============================================================================

MESH_SYNONYMS = {
    # Cardiovascular
    "mi": "myocardial infarction",
    "ami": "acute myocardial infarction",
    "stemi": "st elevation myocardial infarction",
    "nstemi": "non st elevation myocardial infarction",
    "afib": "atrial fibrillation",
    "chf": "congestive heart failure",
    "cad": "coronary artery disease",
    "htn": "hypertension",
    
    # Pulmonary
    "pe": "pulmonary embolism",
    "dvt": "deep vein thrombosis",
    "cap": "community acquired pneumonia",
    "hap": "hospital acquired pneumonia",
    "vap": "ventilator associated pneumonia",
    "copd": "chronic obstructive pulmonary disease",
    "ards": "acute respiratory distress syndrome",
    
    # Renal
    "aki": "acute kidney injury",
    "ckd": "chronic kidney disease",
    "esrd": "end stage renal disease",
    
    # Neurological
    "cva": "cerebrovascular accident",
    "tia": "transient ischemic attack",
    "saH": "subarachnoid hemorrhage",
    "ich": "intracerebral hemorrhage",
    
    # General
    "uti": "urinary tract infection",
    "sob": "shortness of breath",
    "cp": "chest pain",
    "ha": "headache",
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class NamespaceScore:
    """Score for a namespace."""
    namespace: str
    score: float
    matched_keywords: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "namespace": self.namespace,
            "score": self.score,
            "matched_keywords": self.matched_keywords,
        }


@dataclass
class RoutingResult:
    """Result of namespace routing."""
    query: str
    chief_complaint: str
    expanded_query: str
    routed_namespaces: List[str]
    scores: List[NamespaceScore]
    fallback: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "chief_complaint": self.chief_complaint,
            "expanded_query": self.expanded_query,
            "routed_namespaces": self.routed_namespaces,
            "scores": [s.to_dict() for s in self.scores],
            "fallback": self.fallback,
        }


# =============================================================================
# NAMESPACE ROUTER
# =============================================================================

class NamespaceRouter:
    """
    P9: Routes clinical queries to appropriate Pinecone namespaces.
    
    Features:
    - Keyword-based namespace scoring
    - MeSH synonym expansion
    - Fallback to all namespaces
    - Configurable thresholds
    """
    
    # All available namespaces
    ALL_NAMESPACES = list(set(
        ns for nss in COMPLAINT_NAMESPACE_MAP.values() for ns in nss
    ))
    
    def __init__(
        self,
        min_score_threshold: float = 2.0,
        max_namespaces: int = 2
    ):
        self.complaint_map = COMPLAINT_NAMESPACE_MAP
        self.mesh_synonyms = MESH_SYNONYMS
        self.min_score_threshold = min_score_threshold
        self.max_namespaces = max_namespaces
        
        # Statistics
        self.stats = {
            "total_queries": 0,
            "fallback_count": 0,
            "namespace_counts": {ns: 0 for ns in self.ALL_NAMESPACES},
        }
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text into lowercase words."""
        # Lowercase and remove punctuation
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        return text.split()
    
    def _expand_mesh_synonyms(self, tokens: List[str]) -> Set[str]:
        """Expand tokens with MeSH synonyms."""
        expanded = set(tokens)
        
        for token in tokens:
            if token in self.mesh_synonyms:
                expansion = self.mesh_synonyms[token]
                expanded.update(expansion.split())
        
        return expanded
    
    def route(
        self,
        query: str,
        chief_complaint: Optional[str] = None
    ) -> RoutingResult:
        """
        Route a query to appropriate namespaces.
        
        Args:
            query: Medical query text
            chief_complaint: Optional chief complaint hint
        
        Returns:
            RoutingResult with namespace assignments
        """
        self.stats["total_queries"] += 1
        
        # Combine query and chief complaint
        combined_text = query
        if chief_complaint:
            combined_text = f"{chief_complaint} {query}"
        
        # Tokenize and expand
        tokens = self._tokenize(combined_text)
        expanded_tokens = self._expand_mesh_synonyms(tokens)
        
        # Build expanded query string
        expansion_parts = []
        for token in tokens:
            if token in self.mesh_synonyms:
                expansion_parts.append(self.mesh_synonyms[token])
        
        expanded_query = query
        if expansion_parts:
            expanded_query = f"{query} {' '.join(expansion_parts)}"
        
        # Score namespaces
        namespace_scores: Dict[str, float] = {}
        matched_keywords: Dict[str, List[str]] = {ns: [] for ns in self.ALL_NAMESPACES}
        
        for token in expanded_tokens:
            if token in self.complaint_map:
                for namespace in self.complaint_map[token]:
                    namespace_scores[namespace] = namespace_scores.get(namespace, 0) + 1
                    matched_keywords[namespace].append(token)
        
        # Sort by score
        scored_namespaces = sorted(
            namespace_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Build result
        scores = [
            NamespaceScore(
                namespace=ns,
                score=score,
                matched_keywords=matched_keywords[ns]
            )
            for ns, score in scored_namespaces
        ]
        
        # Check if we have strong matches
        fallback = False
        if not scores or scores[0].score < self.min_score_threshold:
            # Fallback to all namespaces
            fallback = True
            self.stats["fallback_count"] += 1
            routed_namespaces = self.ALL_NAMESPACES[:self.max_namespaces * 2]
        else:
            # Use top namespaces
            routed_namespaces = [
                ns.namespace for ns in scores[:self.max_namespaces]
            ]
        
        # Update namespace stats
        for ns in routed_namespaces:
            if ns in self.stats["namespace_counts"]:
                self.stats["namespace_counts"][ns] += 1
        
        return RoutingResult(
            query=query,
            chief_complaint=chief_complaint or "",
            expanded_query=expanded_query,
            routed_namespaces=routed_namespaces,
            scores=scores[:5],  # Top 5 scores
            fallback=fallback,
        )
    
    def get_namespace_for_specialty(self, specialty: str) -> str:
        """Get namespace for a medical specialty."""
        specialty_map = {
            "cardiology": "pubmed_cardiology",
            "infectious_disease": "pubmed_infectious",
            "nephrology": "pubmed_nephrology",
            "pulmonology": "pubmed_pulmonology",
            "neurology": "pubmed_neurology",
            "pharmacology": "pubmed_pharmacology",
            "emergency": "pubmed_emergency",
        }
        return specialty_map.get(specialty.lower(), "pubmed_general")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get router statistics."""
        return {
            **self.stats,
            "fallback_rate": (
                self.stats["fallback_count"] / max(self.stats["total_queries"], 1)
            ),
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_router: Optional[NamespaceRouter] = None


def get_namespace_router() -> NamespaceRouter:
    """Get or create namespace router singleton."""
    global _router
    
    if _router is None:
        _router = NamespaceRouter()
    
    return _router
