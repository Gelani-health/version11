"""
Renal Dosing Calculator for Gelani Healthcare
=============================================

Comprehensive renal function assessment and drug dose adjustment calculator.

Features:
- Cockcroft-Gault creatinine clearance estimation
- CKD staging per KDIGO guidelines
- Drug dose adjustments for CKD stages 1-5
- Dialysis dosing considerations
- Nephrotoxic drug alerts

References:
- Cockcroft DW, Gault MH. Nephron 1976;16:31-41
- KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD
- Winter MA et al. Am J Health-Syst Pharm 2012;69:293-301 (weight selection)
- Aronoff GR et al. Drug Prescribing in Renal Failure, 5th Edition
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import math


class CKDStage(Enum):
    """CKD staging per KDIGO guidelines based on GFR."""
    STAGE_1 = "stage_1"    # GFR ≥ 90 mL/min/1.73m² with kidney damage
    STAGE_2 = "stage_2"    # GFR 60-89 mL/min/1.73m² with kidney damage
    STAGE_3A = "stage_3a"  # GFR 45-59 mL/min/1.73m²
    STAGE_3B = "stage_3b"  # GFR 30-44 mL/min/1.73m²
    STAGE_4 = "stage_4"    # GFR 15-29 mL/min/1.73m²
    STAGE_5 = "stage_5"    # GFR < 15 mL/min/1.73m² (or dialysis)


class DialysisType(Enum):
    """Type of renal replacement therapy."""
    NONE = "none"
    HD = "hemodialysis"
    PD = "peritoneal_dialysis"
    CRRT = "continuous_renal_replacement_therapy"


class WeightType(Enum):
    """Type of weight used in CrCl calculation."""
    ACTUAL = "actual"
    IDEAL = "ideal"
    ADJUSTED = "adjusted"


@dataclass
class RenalFunctionResult:
    """Result of renal function calculation."""
    creatinine_clearance: float  # mL/min
    gfr_estimate: float  # mL/min/1.73m² (estimated)
    ckd_stage: CKDStage
    weight_used: float
    weight_type: WeightType
    ideal_body_weight: Optional[float] = None
    adjusted_body_weight: Optional[float] = None
    is_obese: bool = False
    obesity_ratio: Optional[float] = None
    warnings: List[str] = field(default_factory=list)
    calculation_notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "creatinine_clearance_ml_min": round(self.creatinine_clearance, 1),
            "gfr_estimate_ml_min_173m2": round(self.gfr_estimate, 1),
            "ckd_stage": self.ckd_stage.value,
            "weight_used_kg": round(self.weight_used, 1),
            "weight_type": self.weight_type.value,
            "ideal_body_weight_kg": round(self.ideal_body_weight, 1) if self.ideal_body_weight else None,
            "adjusted_body_weight_kg": round(self.adjusted_body_weight, 1) if self.adjusted_body_weight else None,
            "is_obese": self.is_obese,
            "obesity_ratio": round(self.obesity_ratio, 2) if self.obesity_ratio else None,
            "warnings": self.warnings,
            "calculation_notes": self.calculation_notes
        }


@dataclass
class RenalDosingResult:
    """Result of renal drug dosing adjustment."""
    drug_name: str
    standard_dose: str
    adjusted_dose: str
    dose_reduction_percentage: int
    frequency_adjustment: str
    ckd_stage: CKDStage
    dialysis_considerations: List[str]
    monitoring: List[str]
    warnings: List[str]
    avoid_in_ckd: bool
    dialysis_dose: Optional[str] = None
    dialysis_supplement: Optional[str] = None
    nephrotoxic_alert: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "standard_dose": self.standard_dose,
            "adjusted_dose": self.adjusted_dose,
            "dose_reduction_percentage": self.dose_reduction_percentage,
            "frequency_adjustment": self.frequency_adjustment,
            "ckd_stage": self.ckd_stage.value,
            "dialysis_considerations": self.dialysis_considerations,
            "monitoring": self.monitoring,
            "warnings": self.warnings,
            "avoid_in_ckd": self.avoid_in_ckd,
            "dialysis_dose": self.dialysis_dose,
            "dialysis_supplement": self.dialysis_supplement,
            "nephrotoxic_alert": self.nephrotoxic_alert
        }
    
    def to_fhir(self) -> Dict[str, Any]:
        """Convert to FHIR-compatible format."""
        return {
            "resourceType": "MedicationRequest",
            "status": "draft",
            "dosageInstruction": [{
                "text": self.adjusted_dose,
                "timing": {
                    "repeat": {
                        "frequency": self._parse_frequency()
                    }
                }
            }],
            "note": [{
                "text": f"Renal adjustment required for CKD {self.ckd_stage.value}"
            }],
            "extension": [
                {
                    "url": "http://gelani.health/fhir/extension/renal-adjustment",
                    "valueBoolean": True
                }
            ]
        }
    
    def _parse_frequency(self) -> int:
        """Parse frequency from string."""
        freq_map = {
            "daily": 1,
            "twice daily": 2,
            "three times daily": 3,
            "every 12 hours": 2,
            "every 8 hours": 3,
            "every 6 hours": 4,
            "every 24 hours": 1,
            "every 48 hours": 0.5,
            "after dialysis": 1
        }
        for key, val in freq_map.items():
            if key in self.frequency_adjustment.lower():
                return val
        return 1


# =============================================================================
# RENAL DRUG DOSING DATABASE
# =============================================================================

RENAL_DOSING_DATABASE: Dict[str, Dict[str, Any]] = {
    # ==========================================================================
    # ANTIMICROBIALS
    # ==========================================================================
    
    "vancomycin": {
        "standard_dose": "15-20 mg/kg",
        "standard_frequency": "every 8-12 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "15-20 mg/kg", "frequency": "every 8-12 hours", "notes": "TDM required"},
            CKDStage.STAGE_2: {"dose": "15-20 mg/kg", "frequency": "every 12 hours", "notes": "TDM required"},
            CKDStage.STAGE_3A: {"dose": "15-20 mg/kg", "frequency": "every 12-24 hours", "notes": "TDM required"},
            CKDStage.STAGE_3B: {"dose": "15-20 mg/kg", "frequency": "every 24-48 hours", "notes": "TDM required"},
            CKDStage.STAGE_4: {"dose": "15-20 mg/kg", "frequency": "every 48-72 hours", "notes": "TDM required, pre-dialysis trough"},
            CKDStage.STAGE_5: {"dose": "15-20 mg/kg", "frequency": "after dialysis", "notes": "Give after HD session, check trough pre-dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "15-20 mg/kg", "frequency": "after dialysis", "supplement": "None if trough 15-20"},
            DialysisType.PD: {"dose": "15-20 mg/kg", "frequency": "every 5-7 days"},
            DialysisType.CRRT: {"dose": "15-20 mg/kg", "frequency": "every 24-48 hours", "notes": "TDM q48h"}
        },
        "monitoring": ["Trough levels 15-20 mcg/mL for serious infections", "Serum creatinine", "Ototoxicity signs"],
        "warnings": ["Red man syndrome with rapid infusion", "Nephrotoxicity risk increases with concurrent nephrotoxins"],
        "nephrotoxic": True,
        "avoid_in_esrd": False
    },
    
    "piperacillin_tazobactam": {
        "standard_dose": "4.5 g",
        "standard_frequency": "every 6 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "4.5 g", "frequency": "every 6 hours"},
            CKDStage.STAGE_2: {"dose": "4.5 g", "frequency": "every 6 hours"},
            CKDStage.STAGE_3A: {"dose": "3.375 g", "frequency": "every 8 hours"},
            CKDStage.STAGE_3B: {"dose": "3.375 g", "frequency": "every 8 hours"},
            CKDStage.STAGE_4: {"dose": "2.25 g", "frequency": "every 8 hours"},
            CKDStage.STAGE_5: {"dose": "2.25 g", "frequency": "every 8 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "2.25 g", "frequency": "every 8 hours", "supplement": "Give after HD on dialysis days"},
            DialysisType.PD: {"dose": "2.25 g", "frequency": "every 8 hours"},
            DialysisType.CRRT: {"dose": "4.5 g", "frequency": "every 8 hours"}
        },
        "monitoring": ["CBC for neutropenia with prolonged use", "Renal function", "CNS toxicity at high doses"],
        "warnings": ["High sodium load in CKD", "May cause bleeding due to antiplatelet effect"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "ceftriaxone": {
        "standard_dose": "1-2 g",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "1-2 g", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "1-2 g", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "1-2 g", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "1-2 g", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "1-2 g", "frequency": "daily"},
            CKDStage.STAGE_5: {"dose": "1-2 g", "frequency": "daily"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "1-2 g", "frequency": "daily", "supplement": "Give after HD on dialysis days"},
            DialysisType.PD: {"dose": "1-2 g", "frequency": "daily"},
            DialysisType.CRRT: {"dose": "1-2 g", "frequency": "daily"}
        },
        "monitoring": ["Clinical response"],
        "warnings": ["No adjustment needed - primarily biliary excretion"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "cefepime": {
        "standard_dose": "1-2 g",
        "standard_frequency": "every 8-12 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "1-2 g", "frequency": "every 8-12 hours"},
            CKDStage.STAGE_2: {"dose": "1-2 g", "frequency": "every 8-12 hours"},
            CKDStage.STAGE_3A: {"dose": "1-2 g", "frequency": "every 12 hours"},
            CKDStage.STAGE_3B: {"dose": "1-2 g", "frequency": "every 24 hours"},
            CKDStage.STAGE_4: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
            CKDStage.STAGE_5: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "1-2 g", "frequency": "after dialysis", "supplement": "Re-dose after HD"},
            DialysisType.PD: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
            DialysisType.CRRT: {"dose": "1-2 g", "frequency": "every 12 hours"}
        },
        "monitoring": ["Neurotoxicity (encephalopathy, seizures)", "Renal function"],
        "warnings": ["HIGH RISK of neurotoxicity in CKD - encephalopathy, myoclonus, seizures"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "levofloxacin": {
        "standard_dose": "500-750 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "500-750 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "500-750 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "500-750 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_3B: {"dose": "500-750 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_4: {"dose": "250-500 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_5: {"dose": "250-500 mg", "frequency": "every 48 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "250-500 mg", "frequency": "every 48 hours", "supplement": "Give after HD"},
            DialysisType.PD: {"dose": "250-500 mg", "frequency": "every 48 hours"},
            DialysisType.CRRT: {"dose": "500 mg", "frequency": "every 24 hours"}
        },
        "monitoring": ["QT prolongation", "Tendon pain", "CNS effects", "Glucose in diabetics"],
        "warnings": ["QT prolongation risk increased", "Tendon rupture risk", "Avoid with other QT prolonging drugs"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "ciprofloxacin": {
        "standard_dose": "400 mg IV / 500-750 mg PO",
        "standard_frequency": "every 12 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "400 mg IV / 500-750 mg PO", "frequency": "every 12 hours"},
            CKDStage.STAGE_2: {"dose": "400 mg IV / 500-750 mg PO", "frequency": "every 12 hours"},
            CKDStage.STAGE_3A: {"dose": "400 mg IV / 500 mg PO", "frequency": "every 18 hours"},
            CKDStage.STAGE_3B: {"dose": "400 mg IV / 500 mg PO", "frequency": "every 18 hours"},
            CKDStage.STAGE_4: {"dose": "400 mg IV / 500 mg PO", "frequency": "every 24 hours"},
            CKDStage.STAGE_5: {"dose": "400 mg IV / 500 mg PO", "frequency": "every 24 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "400 mg IV", "frequency": "every 24 hours", "supplement": "Give after HD"},
            DialysisType.PD: {"dose": "400 mg IV", "frequency": "every 24 hours"},
            DialysisType.CRRT: {"dose": "400 mg IV", "frequency": "every 18 hours"}
        },
        "monitoring": ["QT prolongation", "Tendon pain", "CNS effects"],
        "warnings": ["QT prolongation risk", "Tendon rupture risk"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "meropenem": {
        "standard_dose": "1-2 g",
        "standard_frequency": "every 8 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "1-2 g", "frequency": "every 8 hours"},
            CKDStage.STAGE_2: {"dose": "1-2 g", "frequency": "every 8 hours"},
            CKDStage.STAGE_3A: {"dose": "1-2 g", "frequency": "every 12 hours"},
            CKDStage.STAGE_3B: {"dose": "1 g", "frequency": "every 12 hours"},
            CKDStage.STAGE_4: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
            CKDStage.STAGE_5: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "0.5-1 g", "frequency": "every 24 hours", "supplement": "Give after HD"},
            DialysisType.PD: {"dose": "0.5-1 g", "frequency": "every 24 hours"},
            DialysisType.CRRT: {"dose": "1 g", "frequency": "every 12 hours"}
        },
        "monitoring": ["Seizure risk at high doses", "CBC for neutropenia"],
        "warnings": ["Seizure risk increased in CKD", "Reduce dose for CNS infections"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "gentamicin": {
        "standard_dose": "5-7 mg/kg",
        "standard_frequency": "once daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5-7 mg/kg", "frequency": "once daily", "notes": "TDM required"},
            CKDStage.STAGE_2: {"dose": "5-7 mg/kg", "frequency": "every 24-48 hours", "notes": "TDM required"},
            CKDStage.STAGE_3A: {"dose": "5-7 mg/kg", "frequency": "every 48-72 hours", "notes": "TDM required"},
            CKDStage.STAGE_3B: {"dose": "5-7 mg/kg", "frequency": "every 72-96 hours", "notes": "TDM required"},
            CKDStage.STAGE_4: {"dose": "2 mg/kg", "frequency": "after dialysis", "notes": "Extended interval not appropriate"},
            CKDStage.STAGE_5: {"dose": "2 mg/kg", "frequency": "after dialysis", "notes": "Extended interval not appropriate"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "2 mg/kg", "frequency": "after dialysis", "notes": "Check random level 1hr post-dose"},
            DialysisType.PD: {"dose": "Consult pharmacy", "notes": "May use intraperitoneal dosing"},
            DialysisType.CRRT: {"dose": "3-5 mg/kg", "frequency": "every 48-72 hours", "notes": "TDM required"}
        },
        "monitoring": ["Trough levels <2 mcg/mL for extended interval", "Creatinine daily", "Vestibular function", "Auditory function"],
        "warnings": ["NEPHROTOXIC - use only when necessary", "Ototoxicity risk", "Avoid if possible in CKD"],
        "nephrotoxic": True,
        "avoid_in_esrd": False,
        "dosing_strategy": "extended_interval"  # vs traditional
    },
    
    "tobramycin": {
        "standard_dose": "5-7 mg/kg",
        "standard_frequency": "once daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5-7 mg/kg", "frequency": "once daily"},
            CKDStage.STAGE_2: {"dose": "5-7 mg/kg", "frequency": "every 24-48 hours"},
            CKDStage.STAGE_3A: {"dose": "5-7 mg/kg", "frequency": "every 48-72 hours"},
            CKDStage.STAGE_3B: {"dose": "5-7 mg/kg", "frequency": "every 72-96 hours"},
            CKDStage.STAGE_4: {"dose": "2 mg/kg", "frequency": "after dialysis"},
            CKDStage.STAGE_5: {"dose": "2 mg/kg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "2 mg/kg", "frequency": "after dialysis"},
            DialysisType.PD: {"dose": "Consult pharmacy"},
            DialysisType.CRRT: {"dose": "3-5 mg/kg", "frequency": "every 48-72 hours"}
        },
        "monitoring": ["Trough levels <2 mcg/mL", "Creatinine", "Vestibular/auditory function"],
        "warnings": ["NEPHROTOXIC", "Ototoxicity risk", "Avoid if possible in CKD"],
        "nephrotoxic": True,
        "avoid_in_esrd": False
    },
    
    "amphotericin_b": {
        "standard_dose": "0.5-1.5 mg/kg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "0.5-1.5 mg/kg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "0.5-1.5 mg/kg", "frequency": "daily", "notes": "Monitor closely"},
            CKDStage.STAGE_3A: {"dose": "Consider lipid formulation", "frequency": "daily", "notes": "Avoid conventional if possible"},
            CKDStage.STAGE_3B: {"dose": "Use lipid formulation", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "Use lipid formulation", "frequency": "daily"},
            CKDStage.STAGE_5: {"dose": "Use lipid formulation", "frequency": "daily"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "No adjustment for lipid formulations", "notes": "Conventional amphotericin highly nephrotoxic"},
            DialysisType.PD: {"dose": "Use lipid formulation"},
            DialysisType.CRRT: {"dose": "Use lipid formulation", "frequency": "daily"}
        },
        "monitoring": ["Serum creatinine daily", "Potassium", "Magnesium", "CBC"],
        "warnings": ["HIGHLY NEPHROTOXIC", "Consider lipid formulation (Ambisome) in CKD", "Electrolyte wasting"],
        "nephrotoxic": True,
        "avoid_in_esrd": False,
        "notes": "Lipid formulations: Ambisome (liposomal), Abelcet (lipid complex) - less nephrotoxic"
    },
    
    "acyclovir": {
        "standard_dose": "5-10 mg/kg IV",
        "standard_frequency": "every 8 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5-10 mg/kg", "frequency": "every 8 hours"},
            CKDStage.STAGE_2: {"dose": "5-10 mg/kg", "frequency": "every 12 hours"},
            CKDStage.STAGE_3A: {"dose": "5-10 mg/kg", "frequency": "every 12 hours"},
            CKDStage.STAGE_3B: {"dose": "5-10 mg/kg", "frequency": "every 24 hours"},
            CKDStage.STAGE_4: {"dose": "2.5-5 mg/kg", "frequency": "every 24 hours"},
            CKDStage.STAGE_5: {"dose": "2.5-5 mg/kg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "2.5-5 mg/kg", "frequency": "after dialysis", "supplement": "Re-dose after each HD"},
            DialysisType.PD: {"dose": "2.5-5 mg/kg", "frequency": "every 24 hours"},
            DialysisType.CRRT: {"dose": "5 mg/kg", "frequency": "every 24 hours"}
        },
        "monitoring": ["Neurotoxicity (confusion, seizures)", "Renal function", "Urine output"],
        "warnings": ["CRYSTALLURIA - ensure adequate hydration", "Neurotoxicity in CKD", "Slow IV infusion over 1 hour"],
        "nephrotoxic": True,
        "avoid_in_esrd": False
    },
    
    "valacyclovir": {
        "standard_dose": "500-1000 mg",
        "standard_frequency": "every 8-12 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "500-1000 mg", "frequency": "every 8-12 hours"},
            CKDStage.STAGE_2: {"dose": "500-1000 mg", "frequency": "every 12-24 hours"},
            CKDStage.STAGE_3A: {"dose": "500-1000 mg", "frequency": "every 24 hours"},
            CKDStage.STAGE_3B: {"dose": "500 mg", "frequency": "every 24 hours"},
            CKDStage.STAGE_4: {"dose": "500 mg", "frequency": "every 24 hours"},
            CKDStage.STAGE_5: {"dose": "500 mg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "500 mg", "frequency": "after dialysis"},
            DialysisType.PD: {"dose": "500 mg", "frequency": "every 24 hours"},
            DialysisType.CRRT: {"dose": "500 mg", "frequency": "every 24 hours"}
        },
        "monitoring": ["Neurotoxicity", "Renal function"],
        "warnings": ["Neurotoxicity risk in CKD", "TTP/HUS reported in immunocompromised"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "foscarnet": {
        "standard_dose": "60-90 mg/kg",
        "standard_frequency": "every 8-12 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "60-90 mg/kg", "frequency": "every 8-12 hours"},
            CKDStage.STAGE_2: {"dose": "Reduce dose 50%", "frequency": "every 8-12 hours"},
            CKDStage.STAGE_3A: {"dose": "Reduce dose 50%", "frequency": "every 12-24 hours"},
            CKDStage.STAGE_3B: {"dose": "AVOID", "frequency": "Consider alternative"},
            CKDStage.STAGE_4: {"dose": "AVOID", "frequency": "Contraindicated"},
            CKDStage.STAGE_5: {"dose": "AVOID", "frequency": "Contraindicated"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "Consult infectious disease", "notes": "Highly dialyzable"},
            DialysisType.PD: {"dose": "AVOID"},
            DialysisType.CRRT: {"dose": "Consult ID"}
        },
        "monitoring": ["Serum creatinine daily", "Electrolytes (Ca, Mg, K, Phos)", "Seizure risk"],
        "warnings": ["HIGHLY NEPHROTOXIC", "Severe electrolyte abnormalities", "Avoid in CKD 3B+ if possible"],
        "nephrotoxic": True,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    # ==========================================================================
    # CARDIOVASCULAR DRUGS
    # ==========================================================================
    
    "metoprolol": {
        "standard_dose": "25-200 mg",
        "standard_frequency": "daily to twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "25-200 mg", "frequency": "standard"},
            CKDStage.STAGE_2: {"dose": "25-200 mg", "frequency": "standard"},
            CKDStage.STAGE_3A: {"dose": "25-200 mg", "frequency": "standard"},
            CKDStage.STAGE_3B: {"dose": "25-200 mg", "frequency": "standard"},
            CKDStage.STAGE_4: {"dose": "25-200 mg", "frequency": "standard"},
            CKDStage.STAGE_5: {"dose": "25-200 mg", "frequency": "standard"},
        },
        "monitoring": ["Heart rate", "Blood pressure"],
        "warnings": ["No renal adjustment needed - hepatic metabolism"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "atenolol": {
        "standard_dose": "25-100 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "25-100 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "25-100 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "25-50 mg", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "25 mg", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "25 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_5: {"dose": "25 mg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "25-50 mg", "frequency": "after dialysis", "supplement": "Removed by HD"},
            DialysisType.PD: {"dose": "25 mg", "frequency": "every 48 hours"},
            DialysisType.CRRT: {"dose": "25-50 mg", "frequency": "daily"}
        },
        "monitoring": ["Heart rate", "Blood pressure"],
        "warnings": ["Primarily renal excretion - reduce dose in CKD", "Removed by hemodialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "lisinopril": {
        "standard_dose": "5-40 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5-40 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "5-20 mg", "frequency": "daily", "notes": "Start low, titrate slowly"},
            CKDStage.STAGE_3A: {"dose": "2.5-10 mg", "frequency": "daily", "notes": "Start 2.5 mg"},
            CKDStage.STAGE_3B: {"dose": "2.5-10 mg", "frequency": "daily", "notes": "Start 2.5 mg"},
            CKDStage.STAGE_4: {"dose": "2.5-5 mg", "frequency": "daily", "notes": "Start 2.5 mg, monitor K+"},
            CKDStage.STAGE_5: {"dose": "2.5 mg", "frequency": "daily", "notes": "Use with caution, hyperkalemia risk"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "2.5-5 mg", "frequency": "daily", "notes": "Monitor K+ closely"},
            DialysisType.PD: {"dose": "2.5-5 mg", "frequency": "daily"},
            DialysisType.CRRT: {"dose": "2.5-10 mg", "frequency": "daily"}
        },
        "monitoring": ["Serum potassium", "Serum creatinine", "Blood pressure"],
        "warnings": ["HYPERKALEMIA RISK", "Acute kidney injury if bilateral RAS", "May need to hold for hyperkalemia"],
        "nephrotoxic": False,
        "avoid_in_esrd": False,
        "notes": "ACE inhibitor - renoprotective in diabetic nephropathy"
    },
    
    "losartan": {
        "standard_dose": "25-100 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "25-100 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "25-100 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "25-50 mg", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "25-50 mg", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "25 mg", "frequency": "daily", "notes": "Use with caution"},
            CKDStage.STAGE_5: {"dose": "25 mg", "frequency": "daily", "notes": "Use with caution"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "25-50 mg", "frequency": "daily", "notes": "Not removed by HD"},
            DialysisType.PD: {"dose": "25-50 mg", "frequency": "daily"},
            DialysisType.CRRT: {"dose": "25-50 mg", "frequency": "daily"}
        },
        "monitoring": ["Serum potassium", "Serum creatinine", "Blood pressure"],
        "warnings": ["HYPERKALEMIA RISK", "Not removed by dialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "spironolactone": {
        "standard_dose": "25-200 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "25-200 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "25-100 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "12.5-50 mg", "frequency": "daily", "notes": "Monitor K+ closely"},
            CKDStage.STAGE_3B: {"dose": "12.5-25 mg", "frequency": "daily", "notes": "Monitor K+ closely"},
            CKDStage.STAGE_4: {"dose": "AVOID", "frequency": "Hyperkalemia risk too high"},
            CKDStage.STAGE_5: {"dose": "AVOID", "frequency": "Hyperkalemia risk too high"},
        },
        "monitoring": ["Serum potassium", "Serum creatinine", "Blood pressure"],
        "warnings": ["HIGH HYPERKALEMIA RISK in CKD", "Avoid if K+ > 5.0", "Not removed by dialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "digoxin": {
        "standard_dose": "0.125-0.25 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "0.125-0.25 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "0.125-0.25 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "0.125 mg", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "0.125 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_4: {"dose": "0.125 mg", "frequency": "every 48-72 hours"},
            CKDStage.STAGE_5: {"dose": "0.125 mg", "frequency": "every 72 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "0.125 mg", "frequency": "every 48-72 hours", "notes": "Not removed by HD"},
            DialysisType.PD: {"dose": "0.125 mg", "frequency": "every 48-72 hours"},
            DialysisType.CRRT: {"dose": "0.125 mg", "frequency": "every 48 hours"}
        },
        "monitoring": ["Digoxin level (target 0.5-0.9 ng/mL in CKD)", "Serum potassium", "Heart rate", "ECG"],
        "warnings": ["TOXICITY RISK in CKD - narrow therapeutic window", "Hypokalemia increases toxicity", "Not removed by dialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "dabigatran": {
        "standard_dose": "150 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "150 mg", "frequency": "twice daily"},
            CKDStage.STAGE_2: {"dose": "150 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3A: {"dose": "150 mg", "frequency": "twice daily", "notes": "Or 110 mg BID if bleeding risk high"},
            CKDStage.STAGE_3B: {"dose": "AVOID", "frequency": "Use alternative anticoagulant"},
            CKDStage.STAGE_4: {"dose": "CONTRAINDICATED", "frequency": "Use warfarin"},
            CKDStage.STAGE_5: {"dose": "CONTRAINDICATED", "frequency": "Use warfarin"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "CONTRAINDICATED", "notes": "Highly dialyzable - may consider after HD with ID consult"},
            DialysisType.PD: {"dose": "CONTRAINDICATED"},
            DialysisType.CRRT: {"dose": "CONTRAINDICATED"}
        },
        "monitoring": ["Renal function", "aPTT (qualitative)", "Hemoglobin"],
        "warnings": ["CONTRAINDICATED in CrCl < 30 mL/min", "Removed by dialysis", "No specific reversal agent before 2015"],
        "nephrotoxic": False,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "apixaban": {
        "standard_dose": "5 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5 mg", "frequency": "twice daily"},
            CKDStage.STAGE_2: {"dose": "5 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3A: {"dose": "5 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3B: {"dose": "5 mg", "frequency": "twice daily", "notes": "Reduce to 2.5 mg if age ≥80, weight ≤60kg, or Cr ≥1.5"},
            CKDStage.STAGE_4: {"dose": "5 mg", "frequency": "twice daily", "notes": "Reduce to 2.5 mg BID"},
            CKDStage.STAGE_5: {"dose": "Limited data", "frequency": "Consider warfarin"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "5 mg", "frequency": "twice daily", "notes": "Reduce to 2.5 mg BID if criteria met"},
            DialysisType.PD: {"dose": "Limited data"},
            DialysisType.CRRT: {"dose": "Limited data"}
        },
        "monitoring": ["Renal function", "Anti-Xa levels not routinely available"],
        "warnings": ["Less renal clearance than dabigatran", "Can use in ESRD at reduced dose", "Not significantly removed by HD"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    # ==========================================================================
    # DIABETES MEDICATIONS
    # ==========================================================================
    
    "metformin": {
        "standard_dose": "500-2000 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "500-2000 mg", "frequency": "twice daily"},
            CKDStage.STAGE_2: {"dose": "500-2000 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3A: {"dose": "500-1000 mg", "frequency": "twice daily", "notes": "Max 1000 mg/day if eGFR 30-45"},
            CKDStage.STAGE_3B: {"dose": "AVOID", "frequency": "Do not initiate; may continue if stable"},
            CKDStage.STAGE_4: {"dose": "CONTRAINDICATED", "frequency": "Lactic acidosis risk"},
            CKDStage.STAGE_5: {"dose": "CONTRAINDICATED", "frequency": "Lactic acidosis risk"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "CONTRAINDICATED", "notes": "Lactic acidosis risk"},
            DialysisType.PD: {"dose": "CONTRAINDICATED"},
            DialysisType.CRRT: {"dose": "CONTRAINDICATED"}
        },
        "monitoring": ["eGFR at least annually", "Lactate if symptomatic"],
        "warnings": ["LACTIC ACIDOSIS RISK in significant renal impairment", "Hold before contrast in CKD"],
        "nephrotoxic": False,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "glyburide": {
        "standard_dose": "2.5-20 mg",
        "standard_frequency": "daily to twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "2.5-20 mg", "frequency": "standard"},
            CKDStage.STAGE_2: {"dose": "2.5-10 mg", "frequency": "standard"},
            CKDStage.STAGE_3A: {"dose": "AVOID", "frequency": "Use glipizide instead"},
            CKDStage.STAGE_3B: {"dose": "CONTRAINDICATED", "frequency": "Prolonged hypoglycemia risk"},
            CKDStage.STAGE_4: {"dose": "CONTRAINDICATED", "frequency": "Prolonged hypoglycemia risk"},
            CKDStage.STAGE_5: {"dose": "CONTRAINDICATED", "frequency": "Prolonged hypoglycemia risk"},
        },
        "monitoring": ["Blood glucose", "Renal function"],
        "warnings": ["Active metabolites accumulate in CKD", "Prolonged hypoglycemia", "Use glipizide instead (hepatic metabolism)"],
        "nephrotoxic": False,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3A, CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "glipizide": {
        "standard_dose": "5-40 mg",
        "standard_frequency": "daily to twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5-40 mg", "frequency": "standard"},
            CKDStage.STAGE_2: {"dose": "5-40 mg", "frequency": "standard"},
            CKDStage.STAGE_3A: {"dose": "5-20 mg", "frequency": "standard"},
            CKDStage.STAGE_3B: {"dose": "5-20 mg", "frequency": "standard"},
            CKDStage.STAGE_4: {"dose": "5-10 mg", "frequency": "standard"},
            CKDStage.STAGE_5: {"dose": "5-10 mg", "frequency": "standard"},
        },
        "monitoring": ["Blood glucose"],
        "warnings": ["Preferred sulfonylurea in CKD - hepatic metabolism", "Still monitor for hypoglycemia"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "linagliptin": {
        "standard_dose": "5 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "5 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "5 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "5 mg", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "5 mg", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "5 mg", "frequency": "daily"},
            CKDStage.STAGE_5: {"dose": "5 mg", "frequency": "daily"},
        },
        "monitoring": ["Blood glucose", "Renal function"],
        "warnings": ["NO RENAL ADJUSTMENT needed - primarily biliary excretion", "Preferred DPP-4 inhibitor in CKD"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "sitagliptin": {
        "standard_dose": "100 mg",
        "standard_frequency": "daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "100 mg", "frequency": "daily"},
            CKDStage.STAGE_2: {"dose": "100 mg", "frequency": "daily"},
            CKDStage.STAGE_3A: {"dose": "50 mg", "frequency": "daily"},
            CKDStage.STAGE_3B: {"dose": "50 mg", "frequency": "daily"},
            CKDStage.STAGE_4: {"dose": "25 mg", "frequency": "daily"},
            CKDStage.STAGE_5: {"dose": "25 mg", "frequency": "daily"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "25 mg", "frequency": "daily", "supplement": "Can give anytime - not significantly removed"},
            DialysisType.PD: {"dose": "25 mg", "frequency": "daily"},
            DialysisType.CRRT: {"dose": "25 mg", "frequency": "daily"}
        },
        "monitoring": ["Blood glucose", "Renal function"],
        "warnings": ["Dose adjustment required in CKD"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    # ==========================================================================
    # ANALGESICS
    # ==========================================================================
    
    "morphine": {
        "standard_dose": "2-10 mg IV",
        "standard_frequency": "every 2-4 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "2-10 mg", "frequency": "every 2-4 hours"},
            CKDStage.STAGE_2: {"dose": "2-10 mg", "frequency": "every 2-4 hours"},
            CKDStage.STAGE_3A: {"dose": "Start low", "frequency": "every 4-6 hours", "notes": "Active metabolite accumulates"},
            CKDStage.STAGE_3B: {"dose": "AVOID", "frequency": "Use fentanyl or hydromorphone"},
            CKDStage.STAGE_4: {"dose": "AVOID", "frequency": "Use fentanyl"},
            CKDStage.STAGE_5: {"dose": "AVOID", "frequency": "Use fentanyl"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "AVOID", "notes": "Metabolite not dialyzable"},
            DialysisType.PD: {"dose": "AVOID"},
            DialysisType.CRRT: {"dose": "AVOID"}
        },
        "monitoring": ["Respiratory rate", "Level of consciousness", "Pain score"],
        "warnings": ["Active metabolite (M3G, M6G) accumulates in CKD", "Neurotoxicity, myoclonus, seizures", "AVOID in CKD 3B+"],
        "nephrotoxic": False,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "hydromorphone": {
        "standard_dose": "0.2-1 mg IV",
        "standard_frequency": "every 2-4 hours",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "0.2-1 mg", "frequency": "every 2-4 hours"},
            CKDStage.STAGE_2: {"dose": "0.2-1 mg", "frequency": "every 2-4 hours"},
            CKDStage.STAGE_3A: {"dose": "0.2-0.5 mg", "frequency": "every 4-6 hours"},
            CKDStage.STAGE_3B: {"dose": "0.2-0.5 mg", "frequency": "every 4-6 hours"},
            CKDStage.STAGE_4: {"dose": "0.2 mg", "frequency": "every 6 hours"},
            CKDStage.STAGE_5: {"dose": "0.2 mg", "frequency": "every 6 hours"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "0.2 mg", "frequency": "every 6 hours", "notes": "Better than morphine in CKD"},
            DialysisType.PD: {"dose": "0.2 mg", "frequency": "every 6 hours"},
            DialysisType.CRRT: {"dose": "0.2-0.5 mg", "frequency": "every 4-6 hours"}
        },
        "monitoring": ["Respiratory rate", "Level of consciousness"],
        "warnings": ["Preferred over morphine in CKD", "Active metabolite still accumulates but less than morphine"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "gabapentin": {
        "standard_dose": "300-1200 mg",
        "standard_frequency": "three times daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "300-1200 mg", "frequency": "three times daily"},
            CKDStage.STAGE_2: {"dose": "200-700 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3A: {"dose": "200-600 mg", "frequency": "once or twice daily"},
            CKDStage.STAGE_3B: {"dose": "100-300 mg", "frequency": "once daily"},
            CKDStage.STAGE_4: {"dose": "100-300 mg", "frequency": "every 48 hours"},
            CKDStage.STAGE_5: {"dose": "100-300 mg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "100-300 mg", "frequency": "after dialysis", "supplement": "Loading dose 300-400 mg post-HD"},
            DialysisType.PD: {"dose": "100-300 mg", "frequency": "every 48 hours"},
            DialysisType.CRRT: {"dose": "200-400 mg", "frequency": "once daily"}
        },
        "monitoring": ["CNS effects (dizziness, somnolence)", "Renal function"],
        "warnings": ["Significant accumulation in CKD", "Neurotoxicity risk", "Removed by hemodialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    "pregabalin": {
        "standard_dose": "150-600 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "150-600 mg", "frequency": "twice daily"},
            CKDStage.STAGE_2: {"dose": "75-300 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3A: {"dose": "75-150 mg", "frequency": "twice daily"},
            CKDStage.STAGE_3B: {"dose": "25-75 mg", "frequency": "twice daily"},
            CKDStage.STAGE_4: {"dose": "25-75 mg", "frequency": "once daily"},
            CKDStage.STAGE_5: {"dose": "25-75 mg", "frequency": "after dialysis"},
        },
        "dialysis": {
            DialysisType.HD: {"dose": "25-75 mg", "frequency": "after dialysis", "supplement": "Supplemental dose after HD"},
            DialysisType.PD: {"dose": "25-75 mg", "frequency": "once daily"},
            DialysisType.CRRT: {"dose": "50-150 mg", "frequency": "once daily"}
        },
        "monitoring": ["CNS effects", "Renal function"],
        "warnings": ["Significant accumulation in CKD", "Neurotoxicity risk", "Removed by hemodialysis"],
        "nephrotoxic": False,
        "avoid_in_esrd": False
    },
    
    # ==========================================================================
    # NEPHROTOXIC DRUGS TO AVOID/MONITOR
    # ==========================================================================
    
    "nsaids": {
        "standard_dose": "varies",
        "standard_frequency": "varies",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "Use caution", "frequency": "shortest duration"},
            CKDStage.STAGE_2: {"dose": "Use caution", "frequency": "shortest duration"},
            CKDStage.STAGE_3A: {"dose": "AVOID if possible", "frequency": "Consider acetaminophen"},
            CKDStage.STAGE_3B: {"dose": "AVOID", "frequency": "Use acetaminophen"},
            CKDStage.STAGE_4: {"dose": "CONTRAINDICATED", "frequency": "Use acetaminophen"},
            CKDStage.STAGE_5: {"dose": "CONTRAINDICATED", "frequency": "Use acetaminophen"},
        },
        "monitoring": ["Renal function", "Blood pressure", "Fluid status"],
        "warnings": ["NEPHROTOXIC", "Can precipitate AKI", "Worsens hypertension", "Causes sodium/water retention", "Avoid in CKD 3A+"],
        "nephrotoxic": True,
        "avoid_in_esrd": True,
        "avoid_stage": [CKDStage.STAGE_3B, CKDStage.STAGE_4, CKDStage.STAGE_5]
    },
    
    "contrast_media": {
        "standard_dose": "varies by study",
        "standard_frequency": "single dose",
        "dosing": {
            CKDStage.STAGE_1: {"dose": "Standard", "frequency": "Hydration optional"},
            CKDStage.STAGE_2: {"dose": "Standard", "frequency": "Hydration recommended"},
            CKDStage.STAGE_3A: {"dose": "Minimize volume", "frequency": "Pre-hydrate"},
            CKDStage.STAGE_3B: {"dose": "Minimize volume", "frequency": "Pre-hydrate, consider alternative"},
            CKDStage.STAGE_4: {"dose": "AVOID if possible", "frequency": "Consider non-contrast study"},
            CKDStage.STAGE_5: {"dose": "AVOID", "frequency": "Non-contrast studies preferred"},
        },
        "monitoring": ["Serum creatinine 48-72h post-contrast"],
        "warnings": ["CONTRAST-INDUCED NEPHROPATHY risk", "Hydration before and after", "Hold metformin", "Consider N-acetylcysteine"],
        "nephrotoxic": True,
        "avoid_in_esrd": False,  # Already on dialysis - less concern
        "notes": "Hydration protocol: NS 1 mL/kg/h x 12h before and after"
    },
}


# =============================================================================
# RENAL DOSING CALCULATOR CLASS
# =============================================================================

class RenalDosingCalculator:
    """
    Comprehensive renal function and drug dosing calculator.
    
    Features:
    - Cockcroft-Gault creatinine clearance estimation
    - CKD staging per KDIGO
    - Drug dose adjustments
    - Dialysis dosing
    - Nephrotoxicity alerts
    """
    
    def __init__(self, database: Dict[str, Any] = None):
        """Initialize with optional custom dosing database."""
        self.database = database or RENAL_DOSING_DATABASE
    
    def calculate_cockcroft_gault(
        self,
        age_years: int,
        weight_kg: float,
        serum_creatinine: float,
        gender: str,
        height_cm: Optional[float] = None
    ) -> RenalFunctionResult:
        """
        Calculate creatinine clearance using Cockcroft-Gault equation.
        
        Reference: Cockcroft DW, Gault MH. Nephron 1976;16:31-41
        
        Args:
            age_years: Patient age in years (18-120)
            weight_kg: Actual body weight in kg
            serum_creatinine: Serum creatinine in mg/dL
            gender: 'male' or 'female'
            height_cm: Height in cm (optional, for obesity adjustment)
            
        Returns:
            RenalFunctionResult with CrCl and staging
        """
        warnings: List[str] = []
        notes: List[str] = []
        
        # Calculate ideal body weight if height provided
        ibw = None
        adjbw = None
        is_obese = False
        obesity_ratio = None
        
        if height_cm:
            height_inches = height_cm / 2.54
            if gender.lower() == 'male':
                ibw = 50 + 2.3 * max(0, height_inches - 60)
            else:
                ibw = 45.5 + 2.3 * max(0, height_inches - 60)
            
            obesity_ratio = weight_kg / ibw
            is_obese = obesity_ratio > 1.3
            
            if is_obese:
                adjbw = ibw + 0.4 * (weight_kg - ibw)
                weight_to_use = adjbw
                weight_type = WeightType.ADJUSTED
                warnings.append(f"Obesity detected ({obesity_ratio:.1%} of IBW). Using adjusted body weight.")
            else:
                weight_to_use = weight_kg
                weight_type = WeightType.ACTUAL
        else:
            weight_to_use = weight_kg
            weight_type = WeightType.ACTUAL
            warnings.append("Height not provided - IBW cannot be calculated. May overestimate CrCl in obese patients.")
        
        # Calculate CrCl
        # CrCl = [(140 - age) × weight / (72 × Cr)] × 0.85 if female
        base_crcl = ((140 - age_years) * weight_to_use) / (72 * serum_creatinine)
        
        if gender.lower() == 'female':
            crcl = base_crcl * 0.85
            notes.append("Female correction factor (0.85) applied")
        else:
            crcl = base_crcl
        
        # Determine CKD stage
        ckd_stage = self._determine_ckd_stage(crcl)
        
        # Add staging interpretation
        stage_descriptions = {
            CKDStage.STAGE_1: "Normal or high GFR (≥90 mL/min)",
            CKDStage.STAGE_2: "Mildly decreased GFR (60-89 mL/min)",
            CKDStage.STAGE_3A: "Mildly to moderately decreased GFR (45-59 mL/min)",
            CKDStage.STAGE_3B: "Moderately to severely decreased GFR (30-44 mL/min)",
            CKDStage.STAGE_4: "Severely decreased GFR (15-29 mL/min)",
            CKDStage.STAGE_5: "Kidney failure (<15 mL/min)"
        }
        notes.append(f"CKD {ckd_stage.value}: {stage_descriptions[ckd_stage]}")
        
        # Add critical warnings
        if crcl < 15:
            warnings.append("CRITICAL: End-stage renal disease - Many medications require significant dose adjustments or are contraindicated.")
        elif crcl < 30:
            warnings.append("SEVERE renal impairment - Significant dose adjustments required for many medications.")
        
        return RenalFunctionResult(
            creatinine_clearance=round(crcl, 1),
            gfr_estimate=round(crcl, 1),  # Simplified - for actual GFR use MDRD or CKD-EPI
            ckd_stage=ckd_stage,
            weight_used=round(weight_to_use, 1),
            weight_type=weight_type,
            ideal_body_weight=round(ibw, 1) if ibw else None,
            adjusted_body_weight=round(adjbw, 1) if adjbw else None,
            is_obese=is_obese,
            obesity_ratio=round(obesity_ratio, 2) if obesity_ratio else None,
            warnings=warnings,
            calculation_notes=notes
        )
    
    def _determine_ckd_stage(self, gfr: float) -> CKDStage:
        """Determine CKD stage based on GFR."""
        if gfr >= 90:
            return CKDStage.STAGE_1
        elif gfr >= 60:
            return CKDStage.STAGE_2
        elif gfr >= 45:
            return CKDStage.STAGE_3A
        elif gfr >= 30:
            return CKDStage.STAGE_3B
        elif gfr >= 15:
            return CKDStage.STAGE_4
        else:
            return CKDStage.STAGE_5
    
    def get_renal_dose_adjustment(
        self,
        drug_name: str,
        ckd_stage: CKDStage,
        dialysis_type: DialysisType = DialysisType.NONE
    ) -> Optional[RenalDosingResult]:
        """
        Get renal dose adjustment for a specific drug.
        
        Args:
            drug_name: Drug name
            ckd_stage: CKD stage
            dialysis_type: Type of dialysis (if applicable)
            
        Returns:
            RenalDosingResult if drug found, None otherwise
        """
        drug_key = drug_name.lower().replace(" ", "_").replace("-", "_")
        
        # Try to find in database
        drug_data = None
        for key in self.database:
            if drug_key in key or key in drug_key:
                drug_data = self.database[key]
                drug_name = key
                break
        
        if not drug_data:
            return None
        
        standard_dose = drug_data.get("standard_dose", "See dosing guidelines")
        standard_freq = drug_data.get("standard_frequency", "")
        
        # Get dose for CKD stage
        stage_dosing = drug_data.get("dosing", {}).get(ckd_stage, {})
        
        if dialysis_type != DialysisType.NONE:
            dialysis_dosing = drug_data.get("dialysis", {}).get(dialysis_type, {})
            if dialysis_dosing:
                adjusted_dose = dialysis_dosing.get("dose", stage_dosing.get("dose", standard_dose))
                frequency = dialysis_dosing.get("frequency", stage_dosing.get("frequency", standard_freq))
                dialysis_dose = adjusted_dose
                dialysis_supplement = dialysis_dosing.get("supplement")
            else:
                adjusted_dose = stage_dosing.get("dose", standard_dose)
                frequency = stage_dosing.get("frequency", standard_freq)
                dialysis_dose = None
                dialysis_supplement = None
        else:
            adjusted_dose = stage_dosing.get("dose", standard_dose)
            frequency = stage_dosing.get("frequency", standard_freq)
            dialysis_dose = None
            dialysis_supplement = None
        
        # Calculate dose reduction percentage
        dose_reduction = self._calculate_dose_reduction(standard_dose, adjusted_dose)
        
        # Determine if drug should be avoided
        avoid_stages = drug_data.get("avoid_stage", [])
        avoid_in_ckd = ckd_stage in avoid_stages or drug_data.get("avoid_in_esrd", False)
        
        # Build dialysis considerations
        dialysis_considerations = []
        if dialysis_type != DialysisType.NONE:
            dialysis_considerations.append(f"Dialysis type: {dialysis_type.value}")
            if dialysis_supplement:
                dialysis_considerations.append(f"Supplement: {dialysis_supplement}")
        
        return RenalDosingResult(
            drug_name=drug_name,
            standard_dose=f"{standard_dose} {standard_freq}",
            adjusted_dose=f"{adjusted_dose} {frequency}",
            dose_reduction_percentage=dose_reduction,
            frequency_adjustment=frequency,
            ckd_stage=ckd_stage,
            dialysis_considerations=dialysis_considerations,
            monitoring=drug_data.get("monitoring", []),
            warnings=drug_data.get("warnings", []),
            avoid_in_ckd=avoid_in_ckd,
            dialysis_dose=dialysis_dose,
            dialysis_supplement=dialysis_supplement,
            nephrotoxic_alert=drug_data.get("nephrotoxic", False)
        )
    
    def _calculate_dose_reduction(self, standard_dose: str, adjusted_dose: str) -> int:
        """Calculate percentage dose reduction."""
        try:
            # Extract numeric values from dose strings
            import re
            standard_nums = re.findall(r'[\d.]+', standard_dose)
            adjusted_nums = re.findall(r'[\d.]+', adjusted_dose)
            
            if standard_nums and adjusted_nums:
                standard_val = float(standard_nums[0])
                adjusted_val = float(adjusted_nums[0])
                if standard_val > 0:
                    reduction = int((1 - adjusted_val / standard_val) * 100)
                    return max(0, reduction)
        except:
            pass
        return 0
    
    def get_nephrotoxic_drugs(self) -> List[str]:
        """Get list of nephrotoxic drugs in database."""
        return [
            drug for drug, data in self.database.items()
            if data.get("nephrotoxic", False)
        ]
    
    def get_drugs_to_avoid(self, ckd_stage: CKDStage) -> List[str]:
        """Get list of drugs to avoid in specific CKD stage."""
        avoid_list = []
        for drug, data in self.database.items():
            avoid_stages = data.get("avoid_stage", [])
            if ckd_stage in avoid_stages or (data.get("avoid_in_esrd", False) and ckd_stage == CKDStage.STAGE_5):
                avoid_list.append(drug)
        return avoid_list


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def calculate_cockcroft_gault(
    age: int,
    weight_kg: float,
    creatinine: float,
    gender: str,
    height_cm: Optional[float] = None
) -> Dict[str, Any]:
    """
    Calculate creatinine clearance using Cockcroft-Gault equation.
    
    Args:
        age: Patient age in years
        weight_kg: Actual body weight in kg
        creatinine: Serum creatinine in mg/dL
        gender: 'male' or 'female'
        height_cm: Height in cm (optional but recommended)
        
    Returns:
        Dictionary with CrCl and staging information
    """
    calc = RenalDosingCalculator()
    result = calc.calculate_cockcroft_gault(age, weight_kg, creatinine, gender, height_cm)
    return result.to_dict()


def get_renal_dose_adjustment(
    drug_name: str,
    crcl: float,
    dialysis_type: str = "none"
) -> Optional[Dict[str, Any]]:
    """
    Get renal dose adjustment for a drug.
    
    Args:
        drug_name: Drug name
        crcl: Creatinine clearance in mL/min
        dialysis_type: 'none', 'hd', 'pd', or 'crrt'
        
    Returns:
        Dictionary with dose adjustment information
    """
    calc = RenalDosingCalculator()
    
    # Map dialysis type
    dialysis_map = {
        "none": DialysisType.NONE,
        "hd": DialysisType.HD,
        "hemodialysis": DialysisType.HD,
        "pd": DialysisType.PD,
        "peritoneal": DialysisType.PD,
        "crrt": DialysisType.CRRT
    }
    
    # Determine CKD stage
    if crcl >= 90:
        stage = CKDStage.STAGE_1
    elif crcl >= 60:
        stage = CKDStage.STAGE_2
    elif crcl >= 45:
        stage = CKDStage.STAGE_3A
    elif crcl >= 30:
        stage = CKDStage.STAGE_3B
    elif crcl >= 15:
        stage = CKDStage.STAGE_4
    else:
        stage = CKDStage.STAGE_5
    
    dialysis = dialysis_map.get(dialysis_type.lower(), DialysisType.NONE)
    result = calc.get_renal_dose_adjustment(drug_name, stage, dialysis)
    return result.to_dict() if result else None


def get_dialysis_dosing(
    drug_name: str,
    dialysis_type: str
) -> Optional[Dict[str, Any]]:
    """
    Get dialysis-specific dosing for a drug.
    
    Args:
        drug_name: Drug name
        dialysis_type: 'hd', 'pd', or 'crrt'
    """
    calc = RenalDosingCalculator()
    
    dialysis_map = {
        "hd": DialysisType.HD,
        "hemodialysis": DialysisType.HD,
        "pd": DialysisType.PD,
        "peritoneal": DialysisType.PD,
        "crrt": DialysisType.CRRT
    }
    
    dialysis = dialysis_map.get(dialysis_type.lower(), DialysisType.HD)
    result = calc.get_renal_dose_adjustment(drug_name, CKDStage.STAGE_5, dialysis)
    return result.to_dict() if result else None
