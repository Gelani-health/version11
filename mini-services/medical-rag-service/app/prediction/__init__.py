"""
Prediction Module for Clinical Decision Support
================================================

Production-ready prediction models for:
- 30-Day Readmission Risk (LACE Index, HOSPITAL Score)
- Clinical Deterioration Risk (NEWS2)
- Length of Stay Prediction
- Mortality Risk Assessment

All models are evidence-based with:
- Peer-reviewed validation studies
- Transparent scoring algorithms
- Explainable predictions
- Human review required for all clinical decisions

Evidence Sources:
- LACE: van Walraven C, et al. CMAJ 2010;182:551-557
- HOSPITAL: Donzé J, et al. JAMA Intern Med 2013;173:1559-1565
- NEWS2: Royal College of Physicians. NEWS2 (2017)
"""

from .prediction_models import (
    PredictionModel,
    PredictionResult,
    RiskLevel,
    LACEIndexCalculator,
    HospitalScoreCalculator,
    NEWS2Calculator,
    PredictionService,
    get_prediction_service,
)

__all__ = [
    'PredictionModel',
    'PredictionResult',
    'RiskLevel',
    'LACEIndexCalculator',
    'HospitalScoreCalculator',
    'NEWS2Calculator',
    'PredictionService',
    'get_prediction_service',
]
