"""
Clinical Calculators Module
===========================

Evidence-based clinical scoring systems for decision support.

P1 Additions:
- Wells PE Score (Pulmonary Embolism)
- APACHE II (ICU Mortality)
- MELD-Na (Liver Disease Severity)
- NNT Calculator
- Medication Adherence Scoring
"""

from app.calculators.sofa_score import SOFAScoreCalculator, get_sofa_calculator
from app.calculators.heart_score import HEARTScoreCalculator, get_heart_calculator
from app.calculators.wells_pe_score import WellsPEScoreCalculator, get_wells_pe_calculator
from app.calculators.apache_ii import ApacheIICalculator, get_apache_ii_calculator
from app.calculators.meld_na import MeldNaCalculator, get_meld_na_calculator
from app.calculators.nnt_calculator import NNTCalculator, get_nnt_calculator
from app.calculators.medication_adherence import MedicationAdherenceScorer, get_adherence_scorer

__all__ = [
    # SOFA Score
    "SOFAScoreCalculator",
    "get_sofa_calculator",
    # HEART Score
    "HEARTScoreCalculator",
    "get_heart_calculator",
    # Wells PE Score (P1)
    "WellsPEScoreCalculator",
    "get_wells_pe_calculator",
    # APACHE II (P1)
    "ApacheIICalculator",
    "get_apache_ii_calculator",
    # MELD-Na (P1)
    "MeldNaCalculator",
    "get_meld_na_calculator",
    # NNT Calculator (P1)
    "NNTCalculator",
    "get_nnt_calculator",
    # Medication Adherence (P1)
    "MedicationAdherenceScorer",
    "get_adherence_scorer",
]
