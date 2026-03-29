"""
Clinical Context Module
=======================

Patient context management for clinical decision support.
"""

from .clinical_context import (
    ClinicalContextManager,
    PatientContext,
    MedicationProfile,
    AllergyProfile,
    ConditionProfile,
    VitalSigns,
    LabResults,
    ContextValidationResult,
)

__all__ = [
    "ClinicalContextManager",
    "PatientContext",
    "MedicationProfile",
    "AllergyProfile",
    "ConditionProfile",
    "VitalSigns",
    "LabResults",
    "ContextValidationResult",
]
