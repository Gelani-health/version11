"""
Hepatic Dosing Calculator for Gelani Healthcare
================================================

Comprehensive hepatic function assessment and drug dose adjustment calculator.

Features:
- Child-Pugh classification (Turcot modification)
- MELD score calculation
- Drug dose adjustments for hepatic impairment
- Hepatotoxic drug alerts
- FHIR-compatible output

References:
- Pugh RN et al. Br J Surg 1973;60:846-849 (Child-Pugh)
- Kamath PS et al. Hepatology 2001;33:464-470 (MELD Score)
- Verbeeck RK. Clin Pharmacokinet 2008;47:557-584 (Hepatic drug dosing)
- FDA Guidance: Pharmacokinetics in Patients with Impaired Hepatic Function
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import math


class ChildPughClass(Enum):
    """Child-Pugh classification for severity of liver disease."""
    A = "a"  # 5-6 points: Mild liver disease
    B = "b"  # 7-9 points: Moderate liver disease
    C = "c"  # 10-15 points: Severe liver disease


class HepaticImpairmentSeverity(Enum):
    """Simplified hepatic impairment classification."""
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class AscitesSeverity(Enum):
    """Ascites grading."""
    NONE = "none"
    MILD = "mild"      # Detectable only by ultrasound
    MODERATE = "moderate"  # Symmetrical distension
    SEVERE = "severe"  # Markedly distended


class EncephalopathyGrade(Enum):
    """Hepatic encephalopathy grading (West Haven criteria)."""
    NONE = "none"      # No encephalopathy
    GRADE_1 = "grade_1"  # Trivial lack of awareness, euphoria, anxiety
    GRADE_2 = "grade_2"  # Lethargy, disorientation, personality change
    GRADE_3 = "grade_3"  # Confusion, somnolence to semi-stupor
    GRADE_4 = "grade_4"  # Coma


@dataclass
class ChildPughResult:
    """Result of Child-Pugh score calculation."""
    total_points: int
    classification: ChildPughClass
    severity: HepaticImpairmentSeverity
    bilirubin_points: int
    albumin_points: int
    inr_points: int
    ascites_points: int
    encephalopathy_points: int
    survival_estimate_1yr: str
    survival_estimate_2yr: str
    considerations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_points": self.total_points,
            "classification": self.classification.value.upper(),
            "severity": self.severity.value,
            "score_breakdown": {
                "bilirubin": self.bilirubin_points,
                "albumin": self.albumin_points,
                "inr": self.inr_points,
                "ascites": self.ascites_points,
                "encephalopathy": self.encephalopathy_points
            },
            "survival_estimates": {
                "1_year": self.survival_estimate_1yr,
                "2_year": self.survival_estimate_2yr
            },
            "considerations": self.considerations
        }


@dataclass
class MELDResult:
    """Result of MELD score calculation."""
    meld_score: float
    bilirubin: float
    creatinine: float
    inr: float
    sodium: Optional[float]
    mortality_3month: str
    transplant_priority: str
    considerations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "meld_score": round(self.meld_score, 1),
            "lab_values": {
                "bilirubin_mg_dl": self.bilirubin,
                "creatinine_mg_dl": self.creatinine,
                "inr": self.inr,
                "sodium_mmol_l": self.sodium
            },
            "mortality_3_month": self.mortality_3month,
            "transplant_priority": self.transplant_priority,
            "considerations": self.considerations
        }


@dataclass
class HepaticDosingResult:
    """Result of hepatic drug dosing adjustment."""
    drug_name: str
    standard_dose: str
    adjusted_dose: str
    dose_reduction_percentage: int
    max_daily_dose: str
    hepatic_class: ChildPughClass
    contraindicated: bool
    hepatotoxic: bool
    requires_monitoring: List[str]
    warnings: List[str]
    alternative_drugs: List[str]
    notes: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "standard_dose": self.standard_dose,
            "adjusted_dose": self.adjusted_dose,
            "dose_reduction_percentage": self.dose_reduction_percentage,
            "max_daily_dose": self.max_daily_dose,
            "hepatic_class": self.hepatic_class.value.upper(),
            "contraindicated": self.contraindicated,
            "hepatotoxic": self.hepatotoxic,
            "requires_monitoring": self.requires_monitoring,
            "warnings": self.warnings,
            "alternative_drugs": self.alternative_drugs,
            "notes": self.notes
        }
    
    def to_fhir(self) -> Dict[str, Any]:
        """Convert to FHIR-compatible format."""
        return {
            "resourceType": "MedicationRequest",
            "status": "draft" if not self.contraindicated else "entered-in-error",
            "dosageInstruction": [{
                "text": self.adjusted_dose
            }],
            "note": [{
                "text": f"Hepatic adjustment required: Child-Pugh {self.hepatic_class.value.upper()}"
            }],
            "extension": [
                {
                    "url": "http://gelani.health/fhir/extension/hepatic-adjustment",
                    "valueBoolean": True
                }
            ]
        }


# =============================================================================
# HEPATIC DRUG DOSING DATABASE
# =============================================================================

HEPATIC_DOSING_DATABASE: Dict[str, Dict[str, Any]] = {
    # ==========================================================================
    # ANALGESICS
    # ==========================================================================
    
    "acetaminophen": {
        "standard_dose": "325-1000 mg",
        "standard_frequency": "every 4-6 hours",
        "max_daily_dose_normal": "4000 mg",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "2000-3000 mg",
                "dose": "325-650 mg",
                "frequency": "every 4-6 hours",
                "notes": "Reduce maximum daily dose"
            },
            ChildPughClass.B: {
                "max_daily_dose": "1500-2000 mg",
                "dose": "325 mg",
                "frequency": "every 6-8 hours",
                "notes": "Avoid prolonged use; short-term only"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED in severe liver disease"
            },
        },
        "monitoring": ["LFTs if prolonged use", "Signs of hepatotoxicity"],
        "warnings": ["HEPATOTOXIC in overdose", "Reduce dose in liver disease", "Alcohol use increases toxicity"],
        "hepatotoxic": True,
        "alternatives": ["Consider opioids for severe pain", "NSAIDs may be used with caution in mild disease"],
        "metabolism": "hepatic"
    },
    
    "ibuprofen": {
        "standard_dose": "400-800 mg",
        "standard_frequency": "every 6-8 hours",
        "max_daily_dose_normal": "3200 mg",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "2400 mg",
                "dose": "400 mg",
                "frequency": "every 6-8 hours",
                "notes": "Use lowest effective dose"
            },
            ChildPughClass.B: {
                "max_daily_dose": "1600 mg",
                "dose": "200-400 mg",
                "frequency": "every 8 hours",
                "notes": "Increased bleeding risk; avoid prolonged use"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED - bleeding risk, fluid retention"
            },
        },
        "monitoring": ["LFTs", "Renal function", "Bleeding parameters"],
        "warnings": ["Increased bleeding risk with coagulopathy", "Fluid retention", "Renal effects"],
        "hepatotoxic": False,
        "alternatives": ["Acetaminophen at reduced doses", "Opioids for severe pain"],
        "metabolism": "hepatic"
    },
    
    "morphine": {
        "standard_dose": "5-10 mg PO / 2-5 mg IV",
        "standard_frequency": "every 4 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "Individualize",
                "dose": "50% of standard",
                "frequency": "every 4-6 hours",
                "notes": "Start low, titrate slowly"
            },
            ChildPughClass.B: {
                "max_daily_dose": "Individualize",
                "dose": "25-50% of standard",
                "frequency": "every 6-8 hours",
                "notes": "Significant accumulation; consider alternative"
            },
            ChildPughClass.C: {
                "max_daily_dose": "Individualize",
                "dose": "25% of standard",
                "frequency": "every 8-12 hours",
                "notes": "HIGH RISK - precipitate encephalopathy; use fentanyl preferred"
            },
        },
        "monitoring": ["Respiratory status", "Level of consciousness", "Signs of encephalopathy"],
        "warnings": ["Can precipitate hepatic encephalopathy", "Accumulates in liver disease", "Reduced clearance 30-50%"],
        "hepatotoxic": False,
        "alternatives": ["Fentanyl (less hepatic metabolism)", "Hydromorphone"],
        "metabolism": "hepatic"
    },
    
    "fentanyl": {
        "standard_dose": "25-100 mcg IV",
        "standard_frequency": "every 1-2 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "Individualize",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Preferred opioid in liver disease"
            },
            ChildPughClass.B: {
                "max_daily_dose": "Individualize",
                "dose": "Standard to 75%",
                "frequency": "Standard",
                "notes": "Preferred over morphine; still reduce dose"
            },
            ChildPughClass.C: {
                "max_daily_dose": "Individualize",
                "dose": "50-75% of standard",
                "frequency": "Reduce frequency",
                "notes": "Preferred opioid; still accumulates"
            },
        },
        "monitoring": ["Respiratory status", "Level of consciousness"],
        "warnings": ["Still accumulates in severe disease", "Reduce dose with repeated dosing"],
        "hepatotoxic": False,
        "alternatives": [],
        "metabolism": "hepatic",
        "notes": "Preferred opioid in hepatic impairment due to high first-pass metabolism bypass"
    },
    
    # ==========================================================================
    # CARDIOVASCULAR DRUGS
    # ==========================================================================
    
    "metoprolol": {
        "standard_dose": "25-200 mg",
        "standard_frequency": "daily to twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "200 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor for increased effect"
            },
            ChildPughClass.B: {
                "max_daily_dose": "100 mg",
                "dose": "Start at 25 mg",
                "frequency": "Start once daily",
                "notes": "Increased bioavailability; start low"
            },
            ChildPughClass.C: {
                "max_daily_dose": "100 mg",
                "dose": "Start at 12.5-25 mg",
                "frequency": "Start once daily",
                "notes": "Significant increase in levels; titrate slowly"
            },
        },
        "monitoring": ["Heart rate", "Blood pressure", "Signs of hypotension"],
        "warnings": ["Increased bioavailability (up to 2-fold)", "Hypotension risk"],
        "hepatotoxic": False,
        "alternatives": ["Atenolol (renal elimination)"],
        "metabolism": "hepatic"
    },
    
    "propranolol": {
        "standard_dose": "20-80 mg",
        "standard_frequency": "twice to four times daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "320 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Used for portal hypertension"
            },
            ChildPughClass.B: {
                "max_daily_dose": "160 mg",
                "dose": "50% of standard",
                "frequency": "Reduce frequency",
                "notes": "Significantly increased levels"
            },
            ChildPughClass.C: {
                "max_daily_dose": "80 mg",
                "dose": "25-50% of standard",
                "frequency": "Reduce frequency",
                "notes": "Start very low; high risk of hypotension"
            },
        },
        "monitoring": ["Heart rate", "Blood pressure", "Portal pressure"],
        "warnings": ["High first-pass metabolism; levels increase 4-fold", "May be used therapeutically for portal HTN"],
        "hepatotoxic": False,
        "alternatives": ["Nadolol (less hepatic metabolism)"],
        "metabolism": "hepatic"
    },
    
    "carvedilol": {
        "standard_dose": "3.125-25 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "50 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Used for portal hypertension"
            },
            ChildPughClass.B: {
                "max_daily_dose": "25 mg",
                "dose": "Start 3.125 mg",
                "frequency": "twice daily",
                "notes": "Reduce initial dose; titrate slowly"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED - box warning"
            },
        },
        "monitoring": ["Heart rate", "Blood pressure", "Signs of hypotension"],
        "warnings": ["FDA Box Warning: Avoid in severe hepatic impairment", "Increased bioavailability 4-7 fold"],
        "hepatotoxic": False,
        "alternatives": ["Propranolol", "Nadolol for portal HTN"],
        "metabolism": "hepatic"
    },
    
    "losartan": {
        "standard_dose": "25-100 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "100 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor blood pressure"
            },
            ChildPughClass.B: {
                "max_daily_dose": "50 mg",
                "dose": "Start 12.5 mg",
                "frequency": "daily",
                "notes": "Reduced clearance; lower starting dose"
            },
            ChildPughClass.C: {
                "max_daily_dose": "50 mg",
                "dose": "12.5-25 mg",
                "frequency": "daily",
                "notes": "Use with caution; consider alternative"
            },
        },
        "monitoring": ["Blood pressure", "Potassium", "Renal function"],
        "warnings": ["Active metabolite levels may be reduced", "Hypotension risk"],
        "hepatotoxic": False,
        "alternatives": ["Candesartan (less hepatic metabolism)"],
        "metabolism": "hepatic"
    },
    
    "atorvastatin": {
        "standard_dose": "10-80 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "40 mg",
                "dose": "Start 10 mg",
                "frequency": "daily",
                "notes": "Reduce maximum dose"
            },
            ChildPughClass.B: {
                "max_daily_dose": "20 mg",
                "dose": "Start 5-10 mg",
                "frequency": "daily",
                "notes": "Use with caution; increased AUC"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED in active liver disease"
            },
        },
        "monitoring": ["LFTs at baseline and periodically", "CK if muscle symptoms"],
        "warnings": ["Contraindicated in active liver disease", "Increased myopathy risk"],
        "hepatotoxic": True,
        "alternatives": ["Pravastatin (less hepatic)", "Rosuvastatin"],
        "metabolism": "hepatic"
    },
    
    "simvastatin": {
        "standard_dose": "10-40 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "40 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor LFTs"
            },
            ChildPughClass.B: {
                "max_daily_dose": "20 mg",
                "dose": "Start 5-10 mg",
                "frequency": "daily",
                "notes": "Use with caution"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["LFTs", "CK if muscle symptoms"],
        "warnings": ["Contraindicated in active liver disease", "Increased statin levels"],
        "hepatotoxic": True,
        "alternatives": ["Pravastatin", "Rosuvastatin"],
        "metabolism": "hepatic"
    },
    
    "pravastatin": {
        "standard_dose": "10-40 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "40 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Preferred statin in liver disease"
            },
            ChildPughClass.B: {
                "max_daily_dose": "20 mg",
                "dose": "Start 10 mg",
                "frequency": "daily",
                "notes": "Preferred over other statins"
            },
            ChildPughClass.C: {
                "max_daily_dose": "20 mg",
                "dose": "Start 10 mg",
                "frequency": "daily",
                "notes": "Use with caution; still preferred"
            },
        },
        "monitoring": ["LFTs", "CK if muscle symptoms"],
        "warnings": ["Less hepatic metabolism than other statins", "Still monitor LFTs"],
        "hepatotoxic": True,
        "alternatives": [],
        "metabolism": "hepatic",
        "notes": "Preferred statin in hepatic impairment due to less CYP metabolism"
    },
    
    # ==========================================================================
    # ANTICOAGULANTS
    # ==========================================================================
    
    "warfarin": {
        "standard_dose": "2-10 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "Individualize",
                "dose": "Standard start",
                "frequency": "daily",
                "notes": "Monitor INR closely"
            },
            ChildPughClass.B: {
                "max_daily_dose": "Individualize",
                "dose": "Start 2-5 mg",
                "frequency": "daily",
                "notes": "Start lower; enhanced anticoagulant effect"
            },
            ChildPughClass.C: {
                "max_daily_dose": "Individualize",
                "dose": "Start 2 mg or less",
                "frequency": "daily",
                "notes": "Start very low; high bleeding risk"
            },
        },
        "monitoring": ["INR frequently", "Signs of bleeding", "Liver function"],
        "warnings": ["Reduced synthesis of clotting factors", "Enhanced anticoagulant effect", "High bleeding risk"],
        "hepatotoxic": False,
        "alternatives": ["LMWH may be preferred in some cases"],
        "metabolism": "hepatic"
    },
    
    "rivaroxaban": {
        "standard_dose": "20 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "20 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "No adjustment needed"
            },
            ChildPughClass.B: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "Avoid - increased drug exposure"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["Signs of bleeding", "Liver function"],
        "warnings": ["Contraindicated in Child-Pugh B and C", "Increased exposure and bleeding risk"],
        "hepatotoxic": False,
        "alternatives": ["Warfarin (with caution)", "LMWH"],
        "metabolism": "hepatic"
    },
    
    "apixaban": {
        "standard_dose": "5 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "10 mg",
                "dose": "Standard",
                "frequency": "twice daily",
                "notes": "No adjustment needed"
            },
            ChildPughClass.B: {
                "max_daily_dose": "10 mg",
                "dose": "Standard",
                "frequency": "twice daily",
                "notes": "Use with caution; limited data"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["Signs of bleeding", "Liver function"],
        "warnings": ["Contraindicated in Child-Pugh C", "Limited data in Child-Pugh B"],
        "hepatotoxic": False,
        "alternatives": ["Warfarin", "LMWH"],
        "metabolism": "hepatic"
    },
    
    # ==========================================================================
    # DIABETES MEDICATIONS
    # ==========================================================================
    
    "metformin": {
        "standard_dose": "500-2000 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "2000 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor renal function"
            },
            ChildPughClass.B: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "Contraindicated - lactic acidosis risk"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["Lactic acid", "Liver function", "Renal function"],
        "warnings": ["CONTRAINDICATED in hepatic impairment due to lactic acidosis risk"],
        "hepatotoxic": False,
        "alternatives": ["Insulin", "Sulfonylureas (with caution)", "DPP-4 inhibitors"],
        "metabolism": "none",
        "notes": "No hepatic metabolism, but contraindicated due to lactic acidosis risk"
    },
    
    "pioglitazone": {
        "standard_dose": "15-45 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "45 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor LFTs"
            },
            ChildPughClass.B: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "Avoid - hepatotoxicity risk"
            },
            ChildPughClass.C: {
                "max_daily_dose": "CONTRAINDICATED",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["LFTs", "Signs of hepatotoxicity"],
        "warnings": ["Hepatotoxicity reported", "Fluid retention", "Worsens heart failure"],
        "hepatotoxic": True,
        "alternatives": ["Insulin", "Linagliptin", "Sitagliptin"],
        "metabolism": "hepatic"
    },
    
    # ==========================================================================
    # ANTIBIOTICS
    # ==========================================================================
    
    "ceftriaxone": {
        "standard_dose": "1-2 g",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "2 g",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "No adjustment needed"
            },
            ChildPughClass.B: {
                "max_daily_dose": "2 g",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor for accumulation if also renal impairment"
            },
            ChildPughClass.C: {
                "max_daily_dose": "2 g",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Caution with calcium-containing solutions"
            },
        },
        "monitoring": ["Liver function if prolonged use"],
        "warnings": ["Biliary sludge formation", "Caution with IV calcium in severe disease"],
        "hepatotoxic": False,
        "alternatives": [],
        "metabolism": "minimal",
        "notes": "Biliary excretion - no hepatic adjustment typically needed"
    },
    
    "clindamycin": {
        "standard_dose": "150-450 mg PO / 600-900 mg IV",
        "standard_frequency": "every 6-8 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "1800 mg PO",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor for accumulation"
            },
            ChildPughClass.B: {
                "max_daily_dose": "1800 mg PO",
                "dose": "Standard",
                "frequency": "Reduce frequency",
                "notes": "Half-life prolonged; consider q12h"
            },
            ChildPughClass.C: {
                "max_daily_dose": "1800 mg PO",
                "dose": "Reduce dose 50%",
                "frequency": "every 8-12 hours",
                "notes": "Significant accumulation; reduce dose"
            },
        },
        "monitoring": ["Liver function"],
        "warnings": ["Accumulates in liver disease", "Pseudomembranous colitis risk"],
        "hepatotoxic": False,
        "alternatives": ["Azithromycin", "Doxycycline"],
        "metabolism": "hepatic"
    },
    
    "doxycycline": {
        "standard_dose": "100 mg",
        "standard_frequency": "every 12 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "200 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "No adjustment needed"
            },
            ChildPughClass.B: {
                "max_daily_dose": "200 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "No adjustment typically needed"
            },
            ChildPughClass.C: {
                "max_daily_dose": "200 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "No adjustment; monitor for side effects"
            },
        },
        "monitoring": ["Liver function if prolonged"],
        "warnings": ["Rare hepatotoxicity", "Photosensitivity"],
        "hepatotoxic": False,
        "alternatives": [],
        "metabolism": "minimal",
        "notes": "Preferred antibiotic in liver disease - minimal hepatic metabolism"
    },
    
    # ==========================================================================
    # ANTIFUNGALS
    # ==========================================================================
    
    "fluconazole": {
        "standard_dose": "100-400 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "400 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor LFTs"
            },
            ChildPughClass.B: {
                "max_daily_dose": "400 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor LFTs closely"
            },
            ChildPughClass.C: {
                "max_daily_dose": "400 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Use with caution; monitor LFTs frequently"
            },
        },
        "monitoring": ["LFTs at baseline and during therapy", "Drug interactions"],
        "warnings": ["Hepatotoxicity reported", "Many drug interactions via CYP inhibition"],
        "hepatotoxic": True,
        "alternatives": [],
        "metabolism": "hepatic"
    },
    
    "itraconazole": {
        "standard_dose": "100-200 mg",
        "standard_frequency": "daily to twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "400 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor LFTs"
            },
            ChildPughClass.B: {
                "max_daily_dose": "200 mg",
                "dose": "Consider dose reduction",
                "frequency": "Consider once daily",
                "notes": "Increased levels; monitor closely"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "CONTRAINDICATED"
            },
        },
        "monitoring": ["LFTs monthly", "Drug levels if available"],
        "warnings": ["Hepatotoxicity risk", "Negative inotropic effects", "Many drug interactions"],
        "hepatotoxic": True,
        "alternatives": ["Fluconazole", "Echinocandins"],
        "metabolism": "hepatic"
    },
    
    "voriconazole": {
        "standard_dose": "200 mg",
        "standard_frequency": "every 12 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "400 mg",
                "dose": "Standard",
                "frequency": "every 12 hours",
                "notes": "Standard loading dose"
            },
            ChildPughClass.B: {
                "max_daily_dose": "200 mg",
                "dose": "100 mg",
                "frequency": "every 12 hours",
                "notes": "Halve maintenance dose after standard load"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "No data; avoid in severe disease"
            },
        },
        "monitoring": ["LFTs twice weekly initially", "Voriconazole levels", "Visual disturbances"],
        "warnings": ["Hepatotoxicity", "Visual disturbances", "Photosensitivity"],
        "hepatotoxic": True,
        "alternatives": ["Amphotericin B", "Echinocandins"],
        "metabolism": "hepatic"
    },
    
    "caspofungin": {
        "standard_dose": "50 mg IV",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "50 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "No adjustment needed"
            },
            ChildPughClass.B: {
                "max_daily_dose": "35 mg",
                "dose": "35 mg",
                "frequency": "daily",
                "notes": "Reduce dose to 35 mg"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "Not recommended; no data"
            },
        },
        "monitoring": ["LFTs"],
        "warnings": ["Limited data in severe hepatic impairment"],
        "hepatotoxic": False,
        "alternatives": ["Fluconazole", "Amphotericin B"],
        "metabolism": "hepatic"
    },
    
    # ==========================================================================
    # PSYCHIATRIC DRUGS
    # ==========================================================================
    
    "diazepam": {
        "standard_dose": "2-10 mg",
        "standard_frequency": "every 6-12 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "40 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor for sedation"
            },
            ChildPughClass.B: {
                "max_daily_dose": "20 mg",
                "dose": "Reduce 50%",
                "frequency": "Reduce frequency",
                "notes": "Significant accumulation; prolonged half-life"
            },
            ChildPughClass.C: {
                "max_daily_dose": "AVOID",
                "dose": "AVOID",
                "frequency": "Use alternative",
                "notes": "AVOID - precipitates encephalopathy"
            },
        },
        "monitoring": ["Level of consciousness", "Respiratory status"],
        "warnings": ["Half-life prolonged from 30h to 60-100h", "Can precipitate encephalopathy", "Active metabolite accumulation"],
        "hepatotoxic": False,
        "alternatives": ["Lorazepam (less hepatic metabolism)", "Oxazepam"],
        "metabolism": "hepatic"
    },
    
    "lorazepam": {
        "standard_dose": "0.5-2 mg",
        "standard_frequency": "every 6-8 hours",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "4 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Preferred benzodiazepine in liver disease"
            },
            ChildPughClass.B: {
                "max_daily_dose": "4 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Preferred - glucuronidation preserved"
            },
            ChildPughClass.C: {
                "max_daily_dose": "4 mg",
                "dose": "Reduce if needed",
                "frequency": "Standard",
                "notes": "Preferred; use with caution"
            },
        },
        "monitoring": ["Level of consciousness", "Respiratory status"],
        "warnings": ["Glucuronidation relatively preserved in liver disease", "Still use caution"],
        "hepatotoxic": False,
        "alternatives": [],
        "metabolism": "hepatic",
        "notes": "Preferred benzodiazepine - undergoes glucuronidation which is preserved in liver disease"
    },
    
    "sertraline": {
        "standard_dose": "50-200 mg",
        "standard_frequency": "daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "200 mg",
                "dose": "Standard",
                "frequency": "daily",
                "notes": "Monitor for side effects"
            },
            ChildPughClass.B: {
                "max_daily_dose": "200 mg",
                "dose": "Start 25-50 mg",
                "frequency": "daily",
                "notes": "Reduced clearance; start lower"
            },
            ChildPughClass.C: {
                "max_daily_dose": "100 mg",
                "dose": "Start 25 mg",
                "frequency": "daily",
                "notes": "Significantly increased levels; use with caution"
            },
        },
        "monitoring": ["Serotonin syndrome symptoms", "GI side effects"],
        "warnings": ["Increased levels in hepatic impairment", "Start low, titrate slowly"],
        "hepatotoxic": False,
        "alternatives": ["Escitalopram", "Paroxetine"],
        "metabolism": "hepatic"
    },
    
    # ==========================================================================
    # IMMUNOSUPPRESSANTS
    # ==========================================================================
    
    "tacrolimus": {
        "standard_dose": "0.05-0.15 mg/kg",
        "standard_frequency": "twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "Individualize",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "TDM required"
            },
            ChildPughClass.B: {
                "max_daily_dose": "Individualize",
                "dose": "Reduce 25-50%",
                "frequency": "Standard",
                "notes": "Reduce dose; TDM essential"
            },
            ChildPughClass.C: {
                "max_daily_dose": "Individualize",
                "dose": "Reduce 50-75%",
                "frequency": "Standard",
                "notes": "Significant dose reduction required; TDM essential"
            },
        },
        "monitoring": ["Tacrolimus trough levels", "Renal function", "LFTs", "Neurotoxicity"],
        "warnings": ["Extensively metabolized by liver", "Narrow therapeutic window", "Neurotoxicity"],
        "hepatotoxic": True,
        "alternatives": [],
        "metabolism": "hepatic"
    },
    
    "mycophenolate": {
        "standard_dose": "1000-1500 mg",
        "standard_frequency": "twice daily",
        "dosing": {
            ChildPughClass.A: {
                "max_daily_dose": "3000 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor levels"
            },
            ChildPughClass.B: {
                "max_daily_dose": "3000 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Reduced albumin may affect free drug"
            },
            ChildPughClass.C: {
                "max_daily_dose": "3000 mg",
                "dose": "Standard",
                "frequency": "Standard",
                "notes": "Monitor for toxicity; reduced protein binding"
            },
        },
        "monitoring": ["CBC", "MMF levels if available", "GI toxicity"],
        "warnings": ["Reduced protein binding may increase free drug", "GI toxicity"],
        "hepatotoxic": False,
        "alternatives": [],
        "metabolism": "hepatic",
        "notes": "Active metabolite (MPA) is glucuronidated"
    },
}


# =============================================================================
# HEPATIC DOSING CALCULATOR CLASS
# =============================================================================

class HepaticDosingCalculator:
    """
    Comprehensive hepatic function and drug dosing calculator.
    
    Features:
    - Child-Pugh classification
    - MELD score calculation
    - Drug dose adjustments for hepatic impairment
    - Hepatotoxicity alerts
    """
    
    def __init__(self, database: Dict[str, Any] = None):
        """Initialize with optional custom dosing database."""
        self.database = database or HEPATIC_DOSING_DATABASE
    
    def calculate_child_pugh(
        self,
        bilirubin: float,      # mg/dL
        albumin: float,        # g/dL
        inr: float,
        ascites: str,          # none, mild, moderate, severe
        encephalopathy: str    # none, grade_1, grade_2, grade_3, grade_4
    ) -> ChildPughResult:
        """
        Calculate Child-Pugh score and classification.
        
        Reference: Pugh RN et al. Br J Surg 1973;60:846-849
        
        Args:
            bilirubin: Total bilirubin in mg/dL
            albumin: Serum albumin in g/dL
            inr: International normalized ratio
            ascites: Ascites severity (none, mild, moderate, severe)
            encephalopathy: Hepatic encephalopathy grade
            
        Returns:
            ChildPughResult with score and classification
        """
        considerations = []
        
        # Bilirubin scoring
        if bilirubin < 2:
            bilirubin_points = 1
        elif bilirubin <= 3:
            bilirubin_points = 2
        else:
            bilirubin_points = 3
            considerations.append(f"Elevated bilirubin ({bilirubin} mg/dL) indicates significant cholestasis")
        
        # Albumin scoring
        if albumin > 3.5:
            albumin_points = 1
        elif albumin >= 2.8:
            albumin_points = 2
        else:
            albumin_points = 3
            considerations.append(f"Low albumin ({albumin} g/dL) indicates synthetic dysfunction")
        
        # INR scoring
        if inr < 1.7:
            inr_points = 1
        elif inr <= 2.2:
            inr_points = 2
        else:
            inr_points = 3
            considerations.append(f"Elevated INR ({inr}) indicates coagulopathy")
        
        # Ascites scoring
        ascites_lower = ascites.lower()
        if ascites_lower in ["none", "absent"]:
            ascites_points = 1
        elif ascites_lower in ["mild", "slight"]:
            ascites_points = 2
            considerations.append("Ascites present - consider diuretic therapy")
        else:
            ascites_points = 3
            considerations.append("Severe ascites - consider paracentesis")
        
        # Encephalopathy scoring
        enceph_lower = encephalopathy.lower()
        if enceph_lower in ["none", "absent", "grade_1"]:
            encephalopathy_points = 1
        elif enceph_lower == "grade_2":
            encephalopathy_points = 2
            considerations.append("Encephalopathy present - consider lactulose")
        else:
            encephalopathy_points = 3
            considerations.append("Severe encephalopathy - urgent management needed")
        
        # Calculate total
        total_points = (
            bilirubin_points + albumin_points + inr_points +
            ascites_points + encephalopathy_points
        )
        
        # Determine classification
        if total_points <= 6:
            classification = ChildPughClass.A
            severity = HepaticImpairmentSeverity.MILD
            survival_1yr = "100%"
            survival_2yr = "85%"
        elif total_points <= 9:
            classification = ChildPughClass.B
            severity = HepaticImpairmentSeverity.MODERATE
            survival_1yr = "81%"
            survival_2yr = "57%"
        else:
            classification = ChildPughClass.C
            severity = HepaticImpairmentSeverity.SEVERE
            survival_1yr = "45%"
            survival_2yr = "35%"
        
        # Add transplant consideration
        if classification == ChildPughClass.C:
            considerations.append("Consider liver transplant evaluation")
        elif classification == ChildPughClass.B and total_points >= 8:
            considerations.append("Consider liver transplant evaluation")
        
        return ChildPughResult(
            total_points=total_points,
            classification=classification,
            severity=severity,
            bilirubin_points=bilirubin_points,
            albumin_points=albumin_points,
            inr_points=inr_points,
            ascites_points=ascites_points,
            encephalopathy_points=encephalopathy_points,
            survival_estimate_1yr=survival_1yr,
            survival_estimate_2yr=survival_2yr,
            considerations=considerations
        )
    
    def calculate_meld(
        self,
        bilirubin: float,      # mg/dL
        creatinine: float,     # mg/dL
        inr: float,
        sodium: Optional[float] = None,  # mmol/L (for MELD-Na)
        dialysis: bool = False
    ) -> MELDResult:
        """
        Calculate MELD (Model for End-Stage Liver Disease) score.
        
        Reference: Kamath PS et al. Hepatology 2001;33:464-470
        
        Args:
            bilirubin: Total bilirubin in mg/dL
            creatinine: Serum creatinine in mg/dL
            inr: International normalized ratio
            sodium: Serum sodium in mmol/L (optional, for MELD-Na)
            dialysis: Whether patient is on dialysis
            
        Returns:
            MELDResult with score and mortality estimate
        """
        considerations = []
        
        # Handle dialysis patients - use creatinine of 4.0
        if dialysis:
            creatinine_used = 4.0
            considerations.append("Patient on dialysis - creatinine set to 4.0 for MELD calculation")
        else:
            creatinine_used = creatinine
        
        # Cap values
        bilirubin = max(1, min(bilirubin, 40))
        creatinine_used = max(1, min(creatinine_used, 4))
        inr = max(1, min(inr, 20))
        
        # MELD formula
        meld = (
            0.957 * math.log(creatinine_used) +
            0.378 * math.log(bilirubin) +
            1.12 * math.log(inr) +
            0.643
        ) * 10
        
        meld = round(meld)
        
        # MELD-Na adjustment
        if sodium is not None:
            sodium = max(125, min(sodium, 137))
            meld_na = meld + 1.32 * (137 - sodium) - 0.033 * meld * (137 - sodium)
            meld = round(max(meld, meld_na))
            considerations.append(f"MELD-Na calculated: {meld}")
        
        # Determine mortality risk
        if meld < 10:
            mortality_3mo = "1.9%"
            priority = "Low priority"
        elif meld < 20:
            mortality_3mo = "6.0%"
            priority = "Medium priority"
        elif meld < 30:
            mortality_3mo = "19.6%"
            priority = "High priority"
        elif meld < 40:
            mortality_3mo = "52.6%"
            priority = "Very high priority"
        else:
            mortality_3mo = "71.3%"
            priority = "Urgent"
        
        if meld >= 15:
            considerations.append("Consider transplant evaluation if not already")
        
        return MELDResult(
            meld_score=meld,
            bilirubin=bilirubin,
            creatinine=creatinine,
            inr=inr,
            sodium=sodium,
            mortality_3month=mortality_3mo,
            transplant_priority=priority,
            considerations=considerations
        )
    
    def get_hepatic_dose_adjustment(
        self,
        drug_name: str,
        child_pugh_class: ChildPughClass
    ) -> Optional[HepaticDosingResult]:
        """
        Get hepatic dose adjustment for a specific drug.
        
        Args:
            drug_name: Drug name
            child_pugh_class: Child-Pugh classification
            
        Returns:
            HepaticDosingResult if drug found, None otherwise
        """
        drug_key = drug_name.lower().replace(" ", "_").replace("-", "_")
        
        # Try to find in database
        drug_data = None
        matched_drug_name = None
        for key in self.database:
            if drug_key in key or key in drug_key:
                drug_data = self.database[key]
                matched_drug_name = key
                break
        
        if not drug_data:
            return None
        
        standard_dose = f"{drug_data.get('standard_dose', '')} {drug_data.get('standard_frequency', '')}"
        stage_dosing = drug_data.get("dosing", {}).get(child_pugh_class, {})
        
        adjusted_dose = f"{stage_dosing.get('dose', 'Standard')} {stage_dosing.get('frequency', '')}"
        max_dose = stage_dosing.get("max_daily_dose", drug_data.get("max_daily_dose_normal", "Standard"))
        
        # Determine if contraindicated
        contraindicated = "AVOID" in str(stage_dosing.get("dose", "")).upper() or \
                        "CONTRAINDICATED" in str(max_dose).upper()
        
        # Calculate dose reduction
        dose_reduction = 0
        if not contraindicated:
            dose_reduction = self._calculate_dose_reduction(
                drug_data.get("standard_dose", ""),
                stage_dosing.get("dose", drug_data.get("standard_dose", ""))
            )
        
        return HepaticDosingResult(
            drug_name=matched_drug_name,
            standard_dose=standard_dose,
            adjusted_dose=adjusted_dose,
            dose_reduction_percentage=dose_reduction,
            max_daily_dose=max_dose,
            hepatic_class=child_pugh_class,
            contraindicated=contraindicated,
            hepatotoxic=drug_data.get("hepatotoxic", False),
            requires_monitoring=drug_data.get("monitoring", []),
            warnings=drug_data.get("warnings", []),
            alternative_drugs=drug_data.get("alternatives", []),
            notes=[stage_dosing.get("notes", "")]
        )
    
    def _calculate_dose_reduction(self, standard_dose: str, adjusted_dose: str) -> int:
        """Calculate percentage dose reduction."""
        try:
            import re
            standard_nums = re.findall(r'[\d.]+', standard_dose)
            adjusted_nums = re.findall(r'[\d.]+', adjusted_dose)
            
            if standard_nums and adjusted_nums:
                standard_val = float(standard_nums[0])
                adjusted_val = float(adjusted_nums[0])
                if standard_val > 0:
                    # Handle "X% of standard" format
                    if "%" in adjusted_dose:
                        percent_match = re.search(r'(\d+)%', adjusted_dose)
                        if percent_match:
                            return 100 - int(percent_match.group(1))
                    reduction = int((1 - adjusted_val / standard_val) * 100)
                    return max(0, min(100, reduction))
        except:
            pass
        return 0
    
    def get_hepatotoxic_drugs(self) -> List[str]:
        """Get list of hepatotoxic drugs in database."""
        return [
            drug for drug, data in self.database.items()
            if data.get("hepatotoxic", False)
        ]
    
    def get_drugs_to_avoid(self, child_pugh_class: ChildPughClass) -> List[str]:
        """Get list of drugs to avoid in specific Child-Pugh class."""
        avoid_list = []
        for drug, data in self.database.items():
            stage_dosing = data.get("dosing", {}).get(child_pugh_class, {})
            dose = str(stage_dosing.get("dose", "")).upper()
            max_dose = str(stage_dosing.get("max_daily_dose", "")).upper()
            if "AVOID" in dose or "CONTRAINDICATED" in max_dose:
                avoid_list.append(drug)
        return avoid_list


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def calculate_child_pugh_score(
    bilirubin: float,
    albumin: float,
    inr: float,
    ascites: str,
    encephalopathy: str
) -> Dict[str, Any]:
    """
    Calculate Child-Pugh score.
    
    Args:
        bilirubin: Total bilirubin in mg/dL
        albumin: Serum albumin in g/dL
        inr: International normalized ratio
        ascites: 'none', 'mild', 'moderate', or 'severe'
        encephalopathy: 'none', 'grade_1', 'grade_2', 'grade_3', or 'grade_4'
        
    Returns:
        Dictionary with Child-Pugh score and classification
    """
    calc = HepaticDosingCalculator()
    result = calc.calculate_child_pugh(bilirubin, albumin, inr, ascites, encephalopathy)
    return result.to_dict()


def get_hepatic_dose_adjustment(
    drug_name: str,
    child_pugh_class: str
) -> Optional[Dict[str, Any]]:
    """
    Get hepatic dose adjustment for a drug.
    
    Args:
        drug_name: Drug name
        child_pugh_class: 'a', 'b', or 'c'
        
    Returns:
        Dictionary with dose adjustment information
    """
    calc = HepaticDosingCalculator()
    
    class_map = {
        "a": ChildPughClass.A,
        "b": ChildPughClass.B,
        "c": ChildPughClass.C
    }
    
    cp_class = class_map.get(child_pugh_class.lower(), ChildPughClass.A)
    result = calc.get_hepatic_dose_adjustment(drug_name, cp_class)
    return result.to_dict() if result else None
