"""
P2: Clinical Intelligence Integration Module
=============================================

Integrates Clinical Guidelines, UMLS/SNOMED Terminology, and Knowledge Graph
for comprehensive clinical decision support.
"""

from .service import P2IntegrationService, get_p2_service
from .clinical_context import ClinicalContext, ClinicalQueryResult

__all__ = [
    "P2IntegrationService",
    "get_p2_service",
    "ClinicalContext",
    "ClinicalQueryResult",
]
