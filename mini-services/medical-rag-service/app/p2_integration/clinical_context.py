"""
P2: Clinical Context Models
===========================

Data models for clinical context and query results in P2 integration.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ClinicalContext:
    """
    Comprehensive clinical context for a patient encounter.
    
    Used to personalize clinical recommendations and guideline matching.
    """
    patient_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    
    # Clinical conditions
    conditions: List[str] = field(default_factory=list)
    active_problems: List[str] = field(default_factory=list)
    
    # Medications
    current_medications: List[str] = field(default_factory=list)
    medication_allergies: List[str] = field(default_factory=list)
    
    # Vital signs
    vital_signs: Dict[str, Any] = field(default_factory=dict)
    
    # Lab results
    lab_results: Dict[str, Any] = field(default_factory=dict)
    
    # Risk factors
    cardiovascular_risk_factors: List[str] = field(default_factory=list)
    family_history: List[str] = field(default_factory=list)
    social_history: Dict[str, Any] = field(default_factory=dict)
    
    # Current encounter
    chief_complaint: Optional[str] = None
    presenting_symptoms: List[str] = field(default_factory=list)
    
    # Calculated values
    bmi: Optional[float] = None
    egfr: Optional[float] = None
    cha2ds2_vasc_score: Optional[int] = None
    has_bled_score: Optional[int] = None
    
    # Metadata
    encounter_date: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "age": self.age,
            "gender": self.gender,
            "weight_kg": self.weight_kg,
            "height_cm": self.height_cm,
            "conditions": self.conditions,
            "active_problems": self.active_problems,
            "current_medications": self.current_medications,
            "medication_allergies": self.medication_allergies,
            "vital_signs": self.vital_signs,
            "lab_results": self.lab_results,
            "cardiovascular_risk_factors": self.cardiovascular_risk_factors,
            "family_history": self.family_history,
            "social_history": self.social_history,
            "chief_complaint": self.chief_complaint,
            "presenting_symptoms": self.presenting_symptoms,
            "bmi": self.bmi,
            "egfr": self.egfr,
            "cha2ds2_vasc_score": self.cha2ds2_vasc_score,
            "has_bled_score": self.has_bled_score,
            "encounter_date": self.encounter_date.isoformat(),
        }
    
    def calculate_bmi(self) -> Optional[float]:
        """Calculate BMI from weight and height."""
        if self.weight_kg and self.height_cm:
            height_m = self.height_cm / 100
            self.bmi = round(self.weight_kg / (height_m ** 2), 1)
            return self.bmi
        return None
    
    def has_condition(self, condition: str) -> bool:
        """Check if patient has a specific condition (case-insensitive fuzzy match)."""
        condition_lower = condition.lower()
        for c in self.conditions + self.active_problems:
            if condition_lower in c.lower() or c.lower() in condition_lower:
                return True
        return False
    
    def is_on_medication(self, medication: str) -> bool:
        """Check if patient is on a specific medication (case-insensitive fuzzy match)."""
        med_lower = medication.lower()
        for m in self.current_medications:
            if med_lower in m.lower() or m.lower() in med_lower:
                return True
        return False
    
    def has_allergy(self, substance: str) -> bool:
        """Check if patient has an allergy to a substance."""
        substance_lower = substance.lower()
        for a in self.medication_allergies:
            if substance_lower in a.lower() or a.lower() in substance_lower:
                return True
        return False


@dataclass
class GuidelineRecommendation:
    """A guideline-based recommendation with context."""
    guideline_id: str
    guideline_title: str
    recommendation_id: str
    recommendation_text: str
    evidence_level: str
    strength: str
    applicability_score: float
    conditions_met: List[str]
    conditions_missing: List[str]
    contraindications: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "guideline_id": self.guideline_id,
            "guideline_title": self.guideline_title,
            "recommendation_id": self.recommendation_id,
            "recommendation_text": self.recommendation_text,
            "evidence_level": self.evidence_level,
            "strength": self.strength,
            "applicability_score": round(self.applicability_score, 3),
            "conditions_met": self.conditions_met,
            "conditions_missing": self.conditions_missing,
            "contraindications": self.contraindications,
        }


@dataclass
class TerminologyMatch:
    """A terminology match from UMLS/SNOMED."""
    term: str
    cui: str
    preferred_name: str
    semantic_types: List[str]
    codes: Dict[str, str]
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "term": self.term,
            "cui": self.cui,
            "preferred_name": self.preferred_name,
            "semantic_types": self.semantic_types,
            "codes": self.codes,
            "confidence": round(self.confidence, 3),
        }


@dataclass
class KnowledgeGraphResult:
    """A result from knowledge graph query."""
    center_concept: str
    related_concepts: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    paths: List[Dict[str, Any]]
    clinical_insights: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "center_concept": self.center_concept,
            "related_concepts": self.related_concepts,
            "relationships": self.relationships,
            "paths": self.paths,
            "clinical_insights": self.clinical_insights,
        }


@dataclass
class ClinicalQueryResult:
    """
    Comprehensive result from P2 clinical intelligence query.
    
    Combines results from all three P2 components:
    - Clinical guidelines
    - UMLS/SNOMED terminology
    - Knowledge graph
    """
    query: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    # Results from each component
    terminology_matches: List[TerminologyMatch] = field(default_factory=list)
    guideline_recommendations: List[GuidelineRecommendation] = field(default_factory=list)
    knowledge_graph: Optional[KnowledgeGraphResult] = None
    
    # Combined insights
    clinical_summary: str = ""
    differential_diagnoses: List[Dict[str, Any]] = field(default_factory=list)
    treatment_options: List[Dict[str, Any]] = field(default_factory=list)
    drug_interactions: List[Dict[str, Any]] = field(default_factory=list)
    safety_alerts: List[Dict[str, Any]] = field(default_factory=list)
    
    # Metadata
    processing_time_ms: float = 0.0
    confidence: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "timestamp": self.timestamp.isoformat(),
            "terminology_matches": [m.to_dict() for m in self.terminology_matches],
            "guideline_recommendations": [r.to_dict() for r in self.guideline_recommendations],
            "knowledge_graph": self.knowledge_graph.to_dict() if self.knowledge_graph else None,
            "clinical_summary": self.clinical_summary,
            "differential_diagnoses": self.differential_diagnoses,
            "treatment_options": self.treatment_options,
            "drug_interactions": self.drug_interactions,
            "safety_alerts": self.safety_alerts,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "confidence": round(self.confidence, 3),
        }
