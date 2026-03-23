"""
P2: UMLS/SNOMED Terminology Integration Module
"""

from app.terminology.umls_snomed import (
    UMLSTerminologyEngine,
    UMLSConcept,
    ConceptMapping,
    EntityExtraction,
    SemanticType,
    TerminologySystem,
    ConceptStatus,
    get_terminology_engine,
    lookup_medical_term,
    extract_medical_entities,
    map_icd10_to_snomed,
    map_snomed_to_icd10,
)

__all__ = [
    "UMLSTerminologyEngine",
    "UMLSConcept",
    "ConceptMapping",
    "EntityExtraction",
    "SemanticType",
    "TerminologySystem",
    "ConceptStatus",
    "get_terminology_engine",
    "lookup_medical_term",
    "extract_medical_entities",
    "map_icd10_to_snomed",
    "map_snomed_to_icd10",
]
