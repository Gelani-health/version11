"""
Pharmacology Module for Gelani Healthcare Clinical Decision Support System
==========================================================================

This module provides comprehensive drug safety and dosing support:

1. Drug Interaction Engine - 200+ evidence-based DDI entries
2. Allergy Cross-Reactivity - Beta-lactam, sulfonamide, NSAID cross-reactivity
3. Renal Dosing Calculator - Cockcroft-Gault with dose adjustments
4. Hepatic Dosing Calculator - Child-Pugh classification adjustments

References:
- FDA Drug Labels and Black Box Warnings
- Hansten PD, Horn JR. Drug Interactions Analysis and Management
- Lexicomp Drug Interactions Database
- Clinical Pharmacology Database
- IDSA Antimicrobial Stewardship Guidelines 2024
- KDIGO Clinical Practice Guidelines
"""

from app.pharmacology.drug_interaction_engine import (
    DrugInteractionEngine,
    DrugInteraction,
    SeverityLevel,
    MechanismType,
    check_drug_interaction,
    check_multiple_interactions,
    get_qt_prolonging_drugs,
    get_serotonergic_drugs,
    get_cyp_inhibitors,
    get_cyp_inducers,
)

from app.pharmacology.allergy_cross_reactivity import (
    AllergyCrossReactivityEngine,
    CrossReactivityResult,
    check_beta_lactam_cross_reactivity,
    check_sulfonamide_cross_reactivity,
    check_nsaid_cross_reactivity,
    check_latex_fruit_syndrome,
)

from app.pharmacology.renal_dosing import (
    RenalDosingCalculator,
    RenalDosingResult,
    CKDStage,
    calculate_cockcroft_gault,
    get_renal_dose_adjustment,
    get_dialysis_dosing,
)

from app.pharmacology.hepatic_dosing import (
    HepaticDosingCalculator,
    ChildPughClass,
    HepaticDosingResult,
    calculate_child_pugh_score,
    get_hepatic_dose_adjustment,
)

__all__ = [
    # Drug Interaction Engine
    "DrugInteractionEngine",
    "DrugInteraction",
    "SeverityLevel",
    "MechanismType",
    "check_drug_interaction",
    "check_multiple_interactions",
    "get_qt_prolonging_drugs",
    "get_serotonergic_drugs",
    "get_cyp_inhibitors",
    "get_cyp_inducers",
    
    # Allergy Cross-Reactivity
    "AllergyCrossReactivityEngine",
    "CrossReactivityResult",
    "check_beta_lactam_cross_reactivity",
    "check_sulfonamide_cross_reactivity",
    "check_nsaid_cross_reactivity",
    "check_latex_fruit_syndrome",
    
    # Renal Dosing
    "RenalDosingCalculator",
    "RenalDosingResult",
    "CKDStage",
    "calculate_cockcroft_gault",
    "get_renal_dose_adjustment",
    "get_dialysis_dosing",
    
    # Hepatic Dosing
    "HepaticDosingCalculator",
    "ChildPughClass",
    "HepaticDosingResult",
    "calculate_child_pugh_score",
    "get_hepatic_dose_adjustment",
]
