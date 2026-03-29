"""
Antimicrobial Stewardship Module
================================

Comprehensive antimicrobial stewardship engine for clinical decision support.

Modules:
- antibiogram: Facility-specific antibiogram tracking (50+ organisms)
- empiric_therapy: Condition-specific empiric recommendations (30+ protocols)
- allergy_conflict: Evidence-based allergy cross-reactivity checking
- desensitization: Antibiotic desensitization protocols
- renal_dosing: Renal dose adjustment calculator
- duration_optimization: Treatment duration recommendations
- stewardship_engine: Main stewardship orchestration
"""

from app.antimicrobial.antibiogram import (
    AntibiogramDatabase,
    OrganismData,
    SusceptibilityData,
    OrganismCategory,
    AlertLevel,
    get_antibiogram_db,
    normalize_organism_name,
    get_drug_class,
    ORGANISM_DATABASE,
    ResistanceRates,
)

from app.antimicrobial.empiric_therapy import (
    EmpiricProtocol,
    AntibioticOption,
    DosingRegimen,
    PKPDParameters,
    InfectionType,
    SeverityLevel,
    PregnancyCategory,
    get_empiric_engine,
    EMPIRIC_PROTOCOLS,
    PK_PD_DATABASE,
)

from app.antimicrobial.allergy_conflict import (
    check_allergy_conflict,
    build_allergy_types_dict,
    AllergyConflictResult,
    AllergyType,
    ConflictSeverity,
    is_cephalosporin,
    is_penicillin,
    is_sulfa_drug,
    get_cephalosporin_generation,
    CEPHALOSPORIN_GENERATIONS,
)

from app.antimicrobial.desensitization import (
    DesensitizationProtocol,
    DesensitizationStep,
    DesensitizationType,
    DesensitizationStatus,
    RiskLevel,
    get_desensitization_engine,
    DESENSITIZATION_PROTOCOLS,
    ALTERNATIVE_ANTIBIOTICS,
)

from app.antimicrobial.renal_dosing import (
    RenalDosingInfo,
    DosingRecommendation,
    CKDStage,
    DialysisType,
    get_renal_dosing_engine,
    calculate_cockcroft_gault,
    calculate_ideal_body_weight,
    get_ckd_stage,
    estimate_vancomycin_dose,
    calculate_amikacin_dose,
    calculate_gentamicin_dose,
    RENAL_DOSING_DATABASE,
)

from app.antimicrobial.duration_optimization import (
    DurationRecommendation,
    BiomarkerThreshold,
    IVToPOCriteria,
    DurationCategory,
    IVToPOEligibility,
    get_duration_engine,
    evaluate_procalcitonin_stopping,
    check_iv_to_po_eligibility,
    DURATION_DATABASE,
    BIOMARKER_THRESHOLDS,
    IV_TO_PO_ELIGIBILITY_DATABASE,
)

from app.antimicrobial.stewardship_engine import (
    AntimicrobialStewardshipEngine,
    get_stewardship_engine,
)

__all__ = [
    # Antibiogram
    "AntibiogramDatabase",
    "OrganismData",
    "SusceptibilityData",
    "OrganismCategory",
    "AlertLevel",
    "get_antibiogram_db",
    "normalize_organism_name",
    "get_drug_class",
    "ORGANISM_DATABASE",
    "ResistanceRates",
    
    # Empiric Therapy
    "EmpiricProtocol",
    "AntibioticOption",
    "DosingRegimen",
    "PKPDParameters",
    "InfectionType",
    "SeverityLevel",
    "PregnancyCategory",
    "get_empiric_engine",
    "EMPIRIC_PROTOCOLS",
    "PK_PD_DATABASE",
    
    # Allergy Conflict
    "check_allergy_conflict",
    "build_allergy_types_dict",
    "AllergyConflictResult",
    "AllergyType",
    "ConflictSeverity",
    "is_cephalosporin",
    "is_penicillin",
    "is_sulfa_drug",
    "get_cephalosporin_generation",
    "CEPHALOSPORIN_GENERATIONS",
    
    # Desensitization
    "DesensitizationProtocol",
    "DesensitizationStep",
    "DesensitizationType",
    "DesensitizationStatus",
    "RiskLevel",
    "get_desensitization_engine",
    "DESENSITIZATION_PROTOCOLS",
    "ALTERNATIVE_ANTIBIOTICS",
    
    # Renal Dosinging
    "RenalDosingInfo",
    "DosingRecommendation",
    "CKDStage",
    "DialysisType",
    "get_renal_dosing_engine",
    "calculate_cockcroft_gault",
    "calculate_ideal_body_weight",
    "get_ckd_stage",
    "estimate_vancomycin_dose",
    "calculate_amikacin_dose",
    "calculate_gentamicin_dose",
    "RENAL_DOSING_DATABASE",
    
    # Duration Optimization
    "DurationRecommendation",
    "BiomarkerThreshold",
    "IVToPOCriteria",
    "DurationCategory",
    "IVToPOEligibility",
    "get_duration_engine",
    "evaluate_procalcitonin_stopping",
    "check_iv_to_po_eligibility",
    "DURATION_DATABASE",
    "BIOMARKER_THRESHOLDS",
    "IV_TO_PO_ELIGIBILITY_DATABASE",
    
    # Main Engine
    "AntimicrobialStewardshipEngine",
    "get_stewardship_engine",
]
