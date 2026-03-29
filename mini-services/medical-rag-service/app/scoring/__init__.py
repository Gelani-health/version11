"""
Scoring Module
==============

Evidence quality scoring and confidence calibration for Clinical Decision Support.
"""

from .evidence_scorer import (
    EvidenceScorer,
    EvidenceScore,
    GRADELevel,
    StudyDesignType,
    QualityAssessment,
)

from .confidence_calibrator import (
    ConfidenceCalibrator,
    CalibratedConfidence,
    ReliabilityDiagram,
)

__all__ = [
    # Evidence Scorer
    "EvidenceScorer",
    "EvidenceScore",
    "GRADELevel",
    "StudyDesignType",
    "QualityAssessment",
    # Confidence Calibrator
    "ConfidenceCalibrator",
    "CalibratedConfidence",
    "ReliabilityDiagram",
]
