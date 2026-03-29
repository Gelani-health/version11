"""
P3: Quality Assurance Module
============================

Response validation, citation verification, and faithfulness scoring
for clinical decision support outputs.
"""

from app.quality.response_validator import (
    QualityAssuranceEngine,
    ValidationResult,
    CitationVerification,
    FaithfulnessScore,
    get_qa_engine,
)

__all__ = [
    "QualityAssuranceEngine",
    "ValidationResult",
    "CitationVerification",
    "FaithfulnessScore",
    "get_qa_engine",
]
