"""
Renal Dose Adjustment Calculator for Antimicrobial Stewardship
==============================================================

Comprehensive renal dosing guidance for antibiotics including:
- Antibiotic-specific dosing for CKD stages
- Dialysis dosing (IHD, CRRT)
- Pharmacokinetic monitoring (vancomycin, aminoglycosides)
- Cockcroft-Gault eGFR calculation
- Dose adjustment recommendations

References:
- Sanford Guide to Antimicrobial Therapy 2024
- Lexicomp Drug Information
- AHFS Drug Information
- KDIGO CKD Guidelines
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import math


class CKDStage(Enum):
    """CKD staging based on GFR."""
    NORMAL = "normal"                 # GFR >= 90
    MILD = "mild"                     # GFR 60-89
    MODERATE = "moderate"             # GFR 30-59
    SEVERE = "severe"                 # GFR 15-29
    ESRD = "esrd"                     # GFR < 15 or dialysis


class DialysisType(Enum):
    """Type of renal replacement therapy."""
    NONE = "none"
    IHD = "ihd"                       # Intermittent hemodialysis
    CRRT_CVVH = "crrt_cvvh"           # Continuous venovenous hemofiltration
    CRRT_CVVHD = "crrt_cvvhd"         # Continuous venovenous hemodialysis
    CRRT_CVVHDF = "crrt_cvvhdf"       # Continuous venovenous hemodiafiltration
    PD = "pd"                         # Peritoneal dialysis


class DoseAdjustmentType(Enum):
    """Type of dose adjustment."""
    NONE = "none"
    DOSE_REDUCTION = "dose_reduction"
    INTERVAL_EXTENSION = "interval_extension"
    BOTH = "both"
    AVOID = "avoid"


@dataclass
class DosingRecommendation:
    """Complete dosing recommendation."""
    dose: str
    frequency: str
    route: str = "IV"
    max_dose: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    monitoring: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dose": self.dose,
            "frequency": self.frequency,
            "route": self.route,
            "max_dose": self.max_dose,
            "notes": self.notes,
            "monitoring": self.monitoring,
        }


@dataclass
class RenalDosingInfo:
    """Complete renal dosing information for an antibiotic."""
    drug_name: str
    drug_class: str
    primary_elimination: str  # "renal", "hepatic", "both"
    fraction_renal_excretion: float  # 0.0 to 1.0
    normal_dose: DosingRecommendation
    crcl_50_90: Optional[DosingRecommendation] = None
    crcl_30_49: Optional[DosingRecommendation] = None
    crcl_15_29: Optional[DosingRecommendation] = None
    crcl_less_15: Optional[DosingRecommendation] = None
    ihd_dose: Optional[DosingRecommendation] = None
    crrt_dose: Optional[DosingRecommendation] = None
    pd_dose: Optional[DosingRecommendation] = None
    supplement_after_ihd: bool = False
    dialyzable: bool = True
    requires_therapeutic_monitoring: bool = False
    contraindicated_in_severe_renal: bool = False
    special_notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "drug_class": self.drug_class,
            "primary_elimination": self.primary_elimination,
            "fraction_renal_excretion": self.fraction_renal_excretion,
            "normal_dose": self.normal_dose.to_dict(),
            "crcl_50_90": self.crcl_50_90.to_dict() if self.crcl_50_90 else None,
            "crcl_30_49": self.crcl_30_49.to_dict() if self.crcl_30_49 else None,
            "crcl_15_29": self.crcl_15_29.to_dict() if self.crcl_15_29 else None,
            "crcl_less_15": self.crcl_less_15.to_dict() if self.crcl_less_15 else None,
            "ihd_dose": self.ihd_dose.to_dict() if self.ihd_dose else None,
            "crrt_dose": self.crrt_dose.to_dict() if self.crrt_dose else None,
            "pd_dose": self.pd_dose.to_dict() if self.pd_dose else None,
            "supplement_after_ihd": self.supplement_after_ihd,
            "dialyzable": self.dialyzable,
            "requires_therapeutic_monitoring": self.requires_therapeutic_monitoring,
            "contraindicated_in_severe_renal": self.contraindicated_in_severe_renal,
            "special_notes": self.special_notes,
        }


# =============================================================================
# RENAL FUNCTION CALCULATIONS
# =============================================================================

def calculate_cockcroft_gault(
    age: int,
    weight_kg: float,
    serum_creatinine: float,
    is_female: bool = False
) -> float:
    """
    Calculate creatinine clearance using Cockcroft-Gault equation.
    
    CrCl = ((140 - age) × weight_kg) / (72 × SCr) × (0.85 if female)
    
    Args:
        age: Age in years
        weight_kg: Weight in kilograms (use ideal body weight if obese)
        serum_creatinine: Serum creatinine in mg/dL
        is_female: True if patient is female
    
    Returns:
        Estimated creatinine clearance in mL/min
    """
    if serum_creatinine <= 0:
        raise ValueError("Serum creatinine must be positive")
    
    crcl = ((140 - age) * weight_kg) / (72 * serum_creatinine)
    
    if is_female:
        crcl *= 0.85
    
    return round(crcl, 1)


def calculate_ideal_body_weight(height_cm: float, is_male: bool = True) -> float:
    """
    Calculate ideal body weight (IBW).
    
    Devine formula:
    Male: 50 kg + 2.3 kg for each inch over 5 feet
    Female: 45.5 kg + 2.3 kg for each inch over 5 feet
    """
    height_inches = height_cm / 2.54
    inches_over_5ft = height_inches - 60
    
    if is_male:
        ibw = 50 + (2.3 * inches_over_5ft)
    else:
        ibw = 45.5 + (2.3 * inches_over_5ft)
    
    return round(ibw, 1)


def calculate_adjusted_body_weight(
    actual_weight_kg: float,
    ideal_weight_kg: float,
    adjustment_factor: float = 0.4
) -> float:
    """
    Calculate adjusted body weight for obese patients.
    
    Used for drug dosing in patients with BMI > 30.
    Adjusted BW = IBW + adjustment_factor × (actual BW - IBW)
    """
    return ideal_weight_kg + (adjustment_factor * (actual_weight_kg - ideal_weight_kg))


def get_ckd_stage(gfr: float) -> CKDStage:
    """Determine CKD stage based on GFR."""
    if gfr >= 90:
        return CKDStage.NORMAL
    elif gfr >= 60:
        return CKDStage.MILD
    elif gfr >= 30:
        return CKDStage.MODERATE
    elif gfr >= 15:
        return CKDStage.SEVERE
    else:
        return CKDStage.ESRD


def get_dosing_crcl_range(crcl: float) -> str:
    """Get the dosing range category for a given CrCl."""
    if crcl >= 90:
        return "normal"
    elif crcl >= 50:
        return "crcl_50_90"
    elif crcl >= 30:
        return "crcl_30_49"
    elif crcl >= 15:
        return "crcl_15_29"
    else:
        return "crcl_less_15"


# =============================================================================
# VANCOMYCIN PHARMACOKINETICS
# =============================================================================

@dataclass
class VancomycinPKParameters:
    """Vancomycin pharmacokinetic parameters."""
    vd: float = 0.7  # Volume of distribution L/kg
    ke: float = 0.0  # Elimination rate constant (calculated)
    half_life: float = 0.0  # Half-life in hours (calculated)
    clearance: float = 0.0  # Clearance in L/hr (calculated)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "vd": self.vd,
            "ke": self.ke,
            "half_life": self.half_life,
            "clearance": self.clearance,
        }


def calculate_vancomycin_ke(crcl: float) -> float:
    """
    Calculate vancomycin elimination rate constant.
    
    ke = 0.00083 × CrCl + 0.0044
    
    Reference: Matzke et al., 1984
    """
    return 0.00083 * crcl + 0.0044


def calculate_vancomycin_clearance(crcl: float) -> float:
    """
    Calculate vancomycin clearance.
    
    Vancomycin Cl = CrCl × 0.689 (adjustment factor)
    
    Alternative: Cl = ke × Vd × weight
    """
    return crcl * 0.689 / 60  # Convert mL/min to L/hr


def estimate_vancomycin_dose(
    crcl: float,
    weight_kg: float,
    target_trough: float = 15.0,
    vd_ld_per_kg: float = 0.7
) -> Dict[str, Any]:
    """
    Estimate vancomycin dosing to achieve target trough.
    
    Uses first-order kinetics to estimate maintenance dose.
    
    Args:
        crcl: Creatinine clearance in mL/min
        weight_kg: Patient weight in kg
        target_trough: Target trough concentration (default 15 mcg/mL)
        vd_ld_per_kg: Volume of distribution (default 0.7 L/kg)
    
    Returns:
        Dictionary with recommended dose and interval
    """
    # Calculate PK parameters
    ke = calculate_vancomycin_ke(crcl)
    half_life = 0.693 / ke  # hours
    vd = vd_ld_per_kg * weight_kg  # Liters
    
    # For serious infections (MRSA), target AUC/MIC > 400
    # Assuming MIC = 1, target AUC = 400
    # Daily dose = Cl × AUC × 1000 (convert L to mL)
    
    clearance_l_hr = crcl * 0.689 / 60  # L/hr
    daily_dose_mg = clearance_l_hr * 400  # mg/24hr for AUC 400
    
    # Round to nearest 250 mg
    daily_dose_rounded = round(daily_dose_mg / 250) * 250
    
    # Determine interval based on half-life
    if half_life < 7:
        interval = 8
    elif half_life < 12:
        interval = 12
    elif half_life < 24:
        interval = 24
    else:
        interval = 48
    
    # Calculate dose per interval
    dose_per_interval = daily_dose_rounded * (interval / 24)
    dose_rounded = round(dose_per_interval / 250) * 250
    
    # Minimum dose 500 mg, maximum 2000 mg per dose
    dose_rounded = max(500, min(2000, dose_rounded))
    
    # Estimate expected trough
    # Trough = Dose/Vd × e^(-ke×tau) / (1 - e^(-ke×tau))
    if ke * interval > 0:
        expected_trough = (dose_rounded / vd) * math.exp(-ke * interval) / (1 - math.exp(-ke * interval))
    else:
        expected_trough = target_trough
    
    return {
        "recommended_dose_mg": int(dose_rounded),
        "interval_hours": interval,
        "daily_dose_mg": daily_dose_rounded,
        "estimated_half_life_hours": round(half_life, 1),
        "estimated_trough": round(expected_trough, 1),
        "pk_parameters": {
            "ke": round(ke, 4),
            "vd_liters": round(vd, 1),
            "clearance_l_hr": round(clearance_l_hr, 2),
        },
        "notes": [
            f"Target AUC/MIC: 400-600 (assuming MIC=1)",
            f"Expected trough: {round(expected_trough, 1)} mcg/mL",
            "Check trough before 4th dose for verification",
            "Adjust based on actual trough levels",
        ],
        "warnings": [
            "For initial dosing estimate only",
            "Monitor renal function daily",
            "Adjust dose with changes in CrCl",
            "For obese patients, consider adjusted body weight",
        ]
    }


def calculate_vancomycin_auc(
    dose_mg: float,
    interval_hours: float,
    vd_liters: float,
    ke: float
) -> float:
    """
    Calculate AUC24 for vancomycin using trapezoidal method.
    
    AUC = Dose / (Cl × tau) × (1 - e^(-ke×tau)) / ke
    
    Simplified: AUC24 = (Dose × (1 - e^(-ke×tau))) / (Vd × ke × tau) × 24/tau
    """
    # AUC per dose interval
    if ke <= 0:
        return 0
    
    auc_interval = (dose_mg / vd_liters) * (1 - math.exp(-ke * interval_hours)) / ke
    # AUC24
    auc_24 = auc_interval * (24 / interval_hours)
    
    return round(auc_24, 0)


# =============================================================================
# AMINOGLYCOSIDE PHARMACOKINETICS
# =============================================================================

def calculate_amikacin_dose(
    crcl: float,
    weight_kg: float,
    dosing_method: str = "extended_interval"
) -> Dict[str, Any]:
    """
    Calculate amikacin dosing.
    
    Extended interval (once daily): 15-20 mg/kg daily
    Traditional: 5-7.5 mg/kg every 8-12 hours
    
    Args:
        crcl: Creatinine clearance in mL/min
        weight_kg: Weight in kg
        dosing_method: "extended_interval" or "traditional"
    
    Returns:
        Dictionary with recommended dose and interval
    """
    # Extended interval dosing (preferred for most patients)
    if dosing_method == "extended_interval":
        if crcl >= 60:
            return {
                "dose_mg_kg": 15,
                "interval_hours": 24,
                "dose_mg": round(weight_kg * 15),
                "method": "extended_interval",
                "notes": [
                    "Preferred dosing method",
                    "Draw random level 6-14 hours after first dose",
                    "Use Hartford nomogram for interval adjustment",
                ]
            }
        elif crcl >= 40:
            return {
                "dose_mg_kg": 15,
                "interval_hours": 36,
                "dose_mg": round(weight_kg * 15),
                "method": "extended_interval",
                "notes": ["Extended interval to 36 hours"]
            }
        elif crcl >= 20:
            return {
                "dose_mg_kg": 15,
                "interval_hours": 48,
                "dose_mg": round(weight_kg * 15),
                "method": "extended_interval",
                "notes": ["Extended interval to 48 hours"]
            }
        else:
            return {
                "dose_mg_kg": 7.5,
                "interval_hours": 48,
                "dose_mg": round(weight_kg * 7.5),
                "method": "traditional",
                "notes": [
                    "Reduced dose for severe renal impairment",
                    "Consider alternative antibiotic",
                    "Monitor levels closely"
                ]
            }
    
    # Traditional dosing
    else:
        dose_per_dose_mg = round(weight_kg * 7.5)
        
        if crcl >= 80:
            interval = 8
        elif crcl >= 50:
            interval = 12
        elif crcl >= 30:
            interval = 18
        elif crcl >= 15:
            interval = 24
        else:
            interval = 48
            dose_per_dose_mg = round(weight_kg * 5)
        
        return {
            "dose_mg": dose_per_dose_mg,
            "interval_hours": interval,
            "method": "traditional",
            "notes": [
                "Draw peak 30 min after infusion",
                "Draw trough before next dose",
                "Target peak: 20-35 mcg/mL",
                "Target trough: <10 mcg/mL",
            ]
        }


def calculate_gentamicin_dose(
    crcl: float,
    weight_kg: float,
    dosing_method: str = "extended_interval"
) -> Dict[str, Any]:
    """
    Calculate gentamicin dosing.
    
    Extended interval: 5-7 mg/kg daily
    Traditional: 1-2 mg/kg every 8 hours
    """
    # Extended interval dosing
    if dosing_method == "extended_interval":
        if crcl >= 60:
            return {
                "dose_mg_kg": 5,
                "interval_hours": 24,
                "dose_mg": round(weight_kg * 5),
                "method": "extended_interval",
                "notes": [
                    "Preferred for most infections",
                    "Hartford nomogram for interval adjustment",
                ]
            }
        elif crcl >= 40:
            return {
                "dose_mg_kg": 5,
                "interval_hours": 36,
                "dose_mg": round(weight_kg * 5),
                "method": "extended_interval",
            }
        elif crcl >= 20:
            return {
                "dose_mg_kg": 5,
                "interval_hours": 48,
                "dose_mg": round(weight_kg * 5),
                "method": "extended_interval",
            }
        else:
            return {
                "dose_mg_kg": 2,
                "interval_hours": 48,
                "dose_mg": round(weight_kg * 2),
                "method": "traditional_reduced",
                "notes": [
                    "Consider alternative antibiotic",
                    "Monitor levels closely",
                    "High risk of nephrotoxicity"
                ]
            }
    
    # Traditional dosing
    else:
        dose_mg = round(weight_kg * 1.5)
        
        if crcl >= 80:
            interval = 8
        elif crcl >= 50:
            interval = 12
        elif crcl >= 30:
            interval = 18
        elif crcl >= 15:
            interval = 24
        else:
            interval = 48
            dose_mg = round(weight_kg * 1)
        
        return {
            "dose_mg": dose_mg,
            "interval_hours": interval,
            "method": "traditional",
            "notes": [
                "Peak: 5-10 mcg/mL",
                "Trough: <2 mcg/mL",
            ]
        }


# =============================================================================
# COMPREHENSIVE RENAL DOSING DATABASE
# =============================================================================

RENAL_DOSING_DATABASE: Dict[str, RenalDosingInfo] = {
    # =========================================================================
    # BETA-LACTAMS
    # =========================================================================
    
    "penicillin_g": RenalDosingInfo(
        drug_name="Penicillin G",
        drug_class="Penicillin",
        primary_elimination="renal",
        fraction_renal_excretion=0.75,
        normal_dose=DosingRecommendation("2-4 million units", "every 4-6 hours", "IV"),
        crcl_50_90=DosingRecommendation("2-4 million units", "every 4-6 hours", "IV"),
        crcl_30_49=DosingRecommendation("2-4 million units", "every 6-8 hours", "IV"),
        crcl_15_29=DosingRecommendation("2-4 million units", "every 8-12 hours", "IV"),
        crcl_less_15=DosingRecommendation("2-4 million units", "every 12 hours", "IV"),
        ihd_dose=DosingRecommendation("2-4 million units", "every 12 hours", "IV", notes=["Dose after dialysis"]),
        crrt_dose=DosingRecommendation("2-4 million units", "every 8-12 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
    ),
    
    "ampicillin": RenalDosingInfo(
        drug_name="Ampicillin",
        drug_class="Penicillin",
        primary_elimination="renal",
        fraction_renal_excretion=0.90,
        normal_dose=DosingRecommendation("1-2 g", "every 4-6 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 4-6 hours", "IV"),
        crcl_30_49=DosingRecommendation("1-2 g", "every 6-8 hours", "IV"),
        crcl_15_29=DosingRecommendation("1-2 g", "every 8-12 hours", "IV"),
        crcl_less_15=DosingRecommendation("1-2 g", "every 12-24 hours", "IV"),
        ihd_dose=DosingRecommendation("1-2 g", "every 12-24 hours", "IV", notes=["Dose after dialysis"]),
        crrt_dose=DosingRecommendation("1-2 g", "every 8-12 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
    ),
    
    "nafcillin": RenalDosingInfo(
        drug_name="Nafcillin",
        drug_class="Penicillin (anti-staphylococcal)",
        primary_elimination="hepatic",
        fraction_renal_excretion=0.30,
        normal_dose=DosingRecommendation("1-2 g", "every 4-6 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 4-6 hours", "IV", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("1-2 g", "every 4-6 hours", "IV", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("1-2 g", "every 4-6 hours", "IV", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("1-2 g", "every 4-6 hours", "IV", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("1-2 g", "every 4-6 hours", "IV", notes=["No adjustment needed"]),
        crrt_dose=DosingRecommendation("1-2 g", "every 4-6 hours", "IV"),
        dialyzable=False,
        supplement_after_ihd=False,
        special_notes=["Hepatically eliminated - no renal adjustment needed"],
    ),
    
    "piperacillin_tazobactam": RenalDosingInfo(
        drug_name="Piperacillin-Tazobactam",
        drug_class="Beta-lactam/Beta-lactamase inhibitor",
        primary_elimination="renal",
        fraction_renal_excretion=0.70,
        normal_dose=DosingRecommendation("4.5 g", "every 6 hours", "IV", notes=["Extended infusion improves efficacy"]),
        crcl_50_90=DosingRecommendation("4.5 g", "every 6 hours", "IV"),
        crcl_30_49=DosingRecommendation("4.5 g", "every 8 hours", "IV"),
        crcl_15_29=DosingRecommendation("2.25 g", "every 6 hours", "IV"),
        crcl_less_15=DosingRecommendation("2.25 g", "every 8 hours", "IV"),
        ihd_dose=DosingRecommendation("2.25 g", "every 8 hours", "IV", notes=["Dose after dialysis on dialysis days"]),
        crrt_dose=DosingRecommendation("2.25-4.5 g", "every 6-8 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "Consider extended infusion (over 4 hours) for better T>MIC",
            "Monitor for neurotoxicity at high doses in renal failure",
        ],
    ),
    
    "cefazolin": RenalDosingInfo(
        drug_name="Cefazolin",
        drug_class="Cephalosporin (1st generation)",
        primary_elimination="renal",
        fraction_renal_excretion=0.85,
        normal_dose=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_30_49=DosingRecommendation("1-2 g", "every 12 hours", "IV"),
        crcl_15_29=DosingRecommendation("1-2 g", "every 24 hours", "IV"),
        crcl_less_15=DosingRecommendation("1-2 g", "every 48 hours", "IV"),
        ihd_dose=DosingRecommendation("1-2 g", "after dialysis", "IV", notes=["Redose after each dialysis session"]),
        crrt_dose=DosingRecommendation("1-2 g", "every 12-24 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
    ),
    
    "ceftriaxone": RenalDosingInfo(
        drug_name="Ceftriaxone",
        drug_class="Cephalosporin (3rd generation)",
        primary_elimination="both",
        fraction_renal_excretion=0.50,
        normal_dose=DosingRecommendation("1-2 g", "daily", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "daily", "IV", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("1-2 g", "daily", "IV", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("1-2 g", "daily", "IV", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("1-2 g", "daily", "IV", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("1-2 g", "daily", "IV", notes=["Dose after dialysis on dialysis days"]),
        crrt_dose=DosingRecommendation("1-2 g", "daily", "IV"),
        dialyzable=False,
        supplement_after_ihd=False,
        special_notes=[
            "Dual elimination (hepatic + renal) - rarely needs adjustment",
            "Avoid in neonates with hyperbilirubinemia",
        ],
    ),
    
    "cefepime": RenalDosingInfo(
        drug_name="Cefepime",
        drug_class="Cephalosporin (4th generation)",
        primary_elimination="renal",
        fraction_renal_excretion=0.85,
        normal_dose=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 12 hours", "IV"),
        crcl_30_49=DosingRecommendation("1-2 g", "every 12 hours", "IV"),
        crcl_15_29=DosingRecommendation("1-2 g", "every 24 hours", "IV"),
        crcl_less_15=DosingRecommendation("500 mg", "every 24 hours", "IV"),
        ihd_dose=DosingRecommendation("1-2 g", "after dialysis", "IV", notes=["Redose after dialysis"]),
        crrt_dose=DosingRecommendation("1-2 g", "every 12-24 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "NEUROTOXICITY RISK: Monitor for encephalopathy, myoclonus, seizures in renal failure",
            "Reduce dose appropriately to prevent neurotoxicity",
        ],
    ),
    
    "ceftazidime": RenalDosingInfo(
        drug_name="Ceftazidime",
        drug_class="Cephalosporin (3rd generation, anti-Pseudomonas)",
        primary_elimination="renal",
        fraction_renal_excretion=0.90,
        normal_dose=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 8-12 hours", "IV"),
        crcl_30_49=DosingRecommendation("1 g", "every 12 hours", "IV"),
        crcl_15_29=DosingRecommendation("1 g", "every 24 hours", "IV"),
        crcl_less_15=DosingRecommendation("500 mg", "every 24 hours", "IV"),
        ihd_dose=DosingRecommendation("1 g", "after dialysis", "IV"),
        crrt_dose=DosingRecommendation("1-2 g", "every 12-24 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
    ),
    
    # =========================================================================
    # CARBAPENEMS
    # =========================================================================
    
    "meropenem": RenalDosingInfo(
        drug_name="Meropenem",
        drug_class="Carbapenem",
        primary_elimination="renal",
        fraction_renal_excretion=0.70,
        normal_dose=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_50_90=DosingRecommendation("1-2 g", "every 8 hours", "IV"),
        crcl_30_49=DosingRecommendation("1 g", "every 12 hours", "IV"),
        crcl_15_29=DosingRecommendation("1 g", "every 24 hours", "IV"),
        crcl_less_15=DosingRecommendation("500 mg", "every 24 hours", "IV"),
        ihd_dose=DosingRecommendation("500 mg", "after dialysis", "IV", notes=["Dose after dialysis"]),
        crrt_dose=DosingRecommendation("1 g", "every 12 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=["Seizure risk at high doses, reduce in renal impairment"],
    ),
    
    "ertapenem": RenalDosingInfo(
        drug_name="Ertapenem",
        drug_class="Carbapenem",
        primary_elimination="both",
        fraction_renal_excretion=0.44,
        normal_dose=DosingRecommendation("1 g", "daily", "IV"),
        crcl_50_90=DosingRecommendation("1 g", "daily", "IV"),
        crcl_30_49=DosingRecommendation("1 g", "daily", "IV"),
        crcl_15_29=DosingRecommendation("500 mg", "daily", "IV"),
        crcl_less_15=DosingRecommendation("500 mg", "daily", "IV"),
        ihd_dose=DosingRecommendation("500 mg", "daily", "IV", notes=["Dose after dialysis on dialysis days"]),
        crrt_dose=DosingRecommendation("500 mg", "daily", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=["No Pseudomonas coverage", "Once daily dosing convenient"],
    ),
    
    "imipenem_cilastatin": RenalDosingInfo(
        drug_name="Imipenem-Cilastatin",
        drug_class="Carbapenem",
        primary_elimination="renal",
        fraction_renal_excretion=0.70,
        normal_dose=DosingRecommendation("500 mg", "every 6 hours", "IV"),
        crcl_50_90=DosingRecommendation("500 mg", "every 6-8 hours", "IV"),
        crcl_30_49=DosingRecommendation("500 mg", "every 8 hours", "IV"),
        crcl_15_29=DosingRecommendation("500 mg", "every 12 hours", "IV"),
        crcl_less_15=DosingRecommendation("250-500 mg", "every 12 hours", "IV"),
        ihd_dose=DosingRecommendation("250 mg", "after dialysis", "IV"),
        crrt_dose=DosingRecommendation("500 mg", "every 8 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "HIGHER SEIZURE RISK than meropenem",
            "Reduce dose in renal failure to minimize neurotoxicity",
        ],
    ),
    
    # =========================================================================
    # FLUOROQUINOLONES
    # =========================================================================
    
    "ciprofloxacin": RenalDosingInfo(
        drug_name="Ciprofloxacin",
        drug_class="Fluoroquinolone",
        primary_elimination="both",
        fraction_renal_excretion=0.50,
        normal_dose=DosingRecommendation("400 mg IV / 500-750 mg PO", "every 12 hours", "IV/PO"),
        crcl_50_90=DosingRecommendation("400 mg IV / 500-750 mg PO", "every 12 hours", "IV/PO"),
        crcl_30_49=DosingRecommendation("400 mg IV / 500 mg PO", "every 18 hours", "IV/PO"),
        crcl_15_29=DosingRecommendation("400 mg IV / 500 mg PO", "every 24 hours", "IV/PO"),
        crcl_less_15=DosingRecommendation("400 mg IV / 500 mg PO", "every 24 hours", "IV/PO"),
        ihd_dose=DosingRecommendation("400 mg IV / 500 mg PO", "after dialysis", "IV/PO"),
        crrt_dose=DosingRecommendation("400 mg IV", "every 24 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "Avoid in pregnancy",
            "QT prolongation risk",
            "Tendon rupture risk",
        ],
    ),
    
    "levofloxacin": RenalDosingInfo(
        drug_name="Levofloxacin",
        drug_class="Fluoroquinolone",
        primary_elimination="renal",
        fraction_renal_excretion=0.85,
        normal_dose=DosingRecommendation("500-750 mg", "daily", "IV/PO"),
        crcl_50_90=DosingRecommendation("500-750 mg", "daily", "IV/PO"),
        crcl_30_49=DosingRecommendation("500 mg", "every 24-48 hours", "IV/PO"),
        crcl_15_29=DosingRecommendation("500 mg", "every 48 hours", "IV/PO"),
        crcl_less_15=DosingRecommendation("250-500 mg", "every 48 hours", "IV/PO"),
        ihd_dose=DosingRecommendation("250-500 mg", "after dialysis", "IV/PO"),
        crrt_dose=DosingRecommendation("500 mg", "every 24 hours", "IV/PO"),
        dialyzable=True,
        supplement_after_ihd=True,
    ),
    
    "moxifloxacin": RenalDosingInfo(
        drug_name="Moxifloxacin",
        drug_class="Fluoroquinolone",
        primary_elimination="hepatic",
        fraction_renal_excretion=0.20,
        normal_dose=DosingRecommendation("400 mg", "daily", "IV/PO"),
        crcl_50_90=DosingRecommendation("400 mg", "daily", "IV/PO", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("400 mg", "daily", "IV/PO", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("400 mg", "daily", "IV/PO", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("400 mg", "daily", "IV/PO", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("400 mg", "daily", "IV/PO", notes=["No adjustment needed"]),
        crrt_dose=DosingRecommendation("400 mg", "daily", "IV/PO"),
        dialyzable=False,
        supplement_after_ihd=False,
        special_notes=["No renal adjustment needed - hepatically eliminated"],
    ),
    
    # =========================================================================
    # GLYCOPEPTIDES
    # =========================================================================
    
    "vancomycin": RenalDosingInfo(
        drug_name="Vancomycin",
        drug_class="Glycopeptide",
        primary_elimination="renal",
        fraction_renal_excretion=0.85,
        normal_dose=DosingRecommendation("15-20 mg/kg", "every 8-12 hours", "IV", 
            notes=["Trough 15-20 mcg/mL for serious infections", "AUC/MIC >400"]),
        crcl_50_90=DosingRecommendation("15-20 mg/kg", "every 12 hours", "IV"),
        crcl_30_49=DosingRecommendation("15-20 mg/kg", "every 24 hours", "IV"),
        crcl_15_29=DosingRecommendation("15-20 mg/kg", "every 48 hours", "IV", notes=["Or use pharmacy protocol"]),
        crcl_less_15=DosingRecommendation("Variable", "by levels", "IV", 
            notes=["Use loading dose 25 mg/kg then follow levels", "Consider alternative agent"]),
        ihd_dose=DosingRecommendation("15-20 mg/kg", "after dialysis", "IV", 
            notes=["Redose after dialysis", "Check trough before dialysis"]),
        crrt_dose=DosingRecommendation("15-20 mg/kg", "every 24 hours", "IV",
            notes=["Follow levels, may need adjustment based on CRRT dose"]),
        dialyzable=True,
        supplement_after_ihd=True,
        requires_therapeutic_monitoring=True,
        special_notes=[
            "ALWAYS monitor trough levels",
            "Loading dose 25-30 mg/kg for critically ill",
            "Infuse over 2 hours to reduce red man syndrome",
            "Target AUC/MIC 400-600 for serious MRSA infections",
        ],
    ),
    
    # =========================================================================
    # LIPOPEPTIDES
    # =========================================================================
    
    "daptomycin": RenalDosingInfo(
        drug_name="Daptomycin",
        drug_class="Lipopeptide",
        primary_elimination="renal",
        fraction_renal_excretion=0.54,
        normal_dose=DosingRecommendation("4-6 mg/kg", "daily", "IV", 
            notes=["8-10 mg/kg for severe MRSA infections"]),
        crcl_50_90=DosingRecommendation("4-6 mg/kg", "daily", "IV"),
        crcl_30_49=DosingRecommendation("4-6 mg/kg", "daily", "IV"),
        crcl_15_29=DosingRecommendation("4-6 mg/kg", "every 48 hours", "IV"),
        crcl_less_15=DosingRecommendation("4-6 mg/kg", "every 48 hours", "IV"),
        ihd_dose=DosingRecommendation("4-6 mg/kg", "after dialysis", "IV", notes=["Dose after dialysis"]),
        crrt_dose=DosingRecommendation("4-6 mg/kg", "every 48 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "NOT FOR PNEUMONIA - inactivated by surfactant",
            "Monitor CPK weekly",
            "Discontinue if CPK >10× ULN with symptoms",
        ],
    ),
    
    # =========================================================================
    # OXAZOLIDINONES
    # =========================================================================
    
    "linezolid": RenalDosingInfo(
        drug_name="Linezolid",
        drug_class="Oxazolidinone",
        primary_elimination="both",
        fraction_renal_excretion=0.30,
        normal_dose=DosingRecommendation("600 mg", "every 12 hours", "IV/PO"),
        crcl_50_90=DosingRecommendation("600 mg", "every 12 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("600 mg", "every 12 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("600 mg", "every 12 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("600 mg", "every 12 hours", "IV/PO", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("600 mg", "every 12 hours", "IV/PO", notes=["No adjustment needed"]),
        crrt_dose=DosingRecommendation("600 mg", "every 12 hours", "IV/PO"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "No renal adjustment needed",
            "Monitor for myelosuppression if >2 weeks",
            "MAO inhibitor interaction - avoid tyramine-rich foods",
            "Excellent bioavailability (100%)",
        ],
    ),
    
    # =========================================================================
    # AMINOGLYCOSIDES
    # =========================================================================
    
    "gentamicin": RenalDosingInfo(
        drug_name="Gentamicin",
        drug_class="Aminoglycoside",
        primary_elimination="renal",
        fraction_renal_excretion=0.95,
        normal_dose=DosingRecommendation("5-7 mg/kg", "daily (extended interval)", "IV",
            notes=["Traditional: 1-2 mg/kg every 8 hours"]),
        crcl_50_90=DosingRecommendation("5 mg/kg", "every 24-36 hours", "IV", monitoring=["Trough <2 mcg/mL"]),
        crcl_30_49=DosingRecommendation("5 mg/kg", "every 48 hours", "IV", monitoring=["Follow levels"]),
        crcl_15_29=DosingRecommendation("2-3 mg/kg", "every 48 hours", "IV", monitoring=["Follow levels closely"]),
        crcl_less_15=DosingRecommendation("2 mg/kg", "every 48-72 hours", "IV", 
            notes=["Consider alternative", "Follow levels"], monitoring=["Trough <1 mcg/mL"]),
        ihd_dose=DosingRecommendation("2 mg/kg", "after dialysis", "IV", notes=["Follow levels"]),
        crrt_dose=DosingRecommendation("2-3 mg/kg", "every 24-48 hours", "IV", notes=["Follow levels"]),
        dialyzable=True,
        supplement_after_ihd=True,
        requires_therapeutic_monitoring=True,
        special_notes=[
            "HIGH NEPHROTOXICITY RISK",
            "Monitor trough levels",
            "Limit duration to 7-10 days when possible",
            "Avoid with other nephrotoxins",
            "Use Hartford nomogram for extended interval dosing",
        ],
    ),
    
    "tobramycin": RenalDosingInfo(
        drug_name="Tobramycin",
        drug_class="Aminoglycoside",
        primary_elimination="renal",
        fraction_renal_excretion=0.95,
        normal_dose=DosingRecommendation("5-7 mg/kg", "daily", "IV"),
        crcl_50_90=DosingRecommendation("5 mg/kg", "every 24-36 hours", "IV"),
        crcl_30_49=DosingRecommendation("5 mg/kg", "every 48 hours", "IV"),
        crcl_15_29=DosingRecommendation("2-3 mg/kg", "every 48 hours", "IV"),
        crcl_less_15=DosingRecommendation("2 mg/kg", "every 48-72 hours", "IV"),
        ihd_dose=DosingRecommendation("2 mg/kg", "after dialysis", "IV"),
        crrt_dose=DosingRecommendation("2-3 mg/kg", "every 24-48 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        requires_therapeutic_monitoring=True,
        special_notes=["Better Pseudomonas activity than gentamicin"],
    ),
    
    "amikacin": RenalDosingInfo(
        drug_name="Amikacin",
        drug_class="Aminoglycoside",
        primary_elimination="renal",
        fraction_renal_excretion=0.95,
        normal_dose=DosingRecommendation("15-20 mg/kg", "daily", "IV",
            monitoring=["Peak 20-35 mcg/mL", "Trough <10 mcg/mL"]),
        crcl_50_90=DosingRecommendation("15 mg/kg", "every 24 hours", "IV"),
        crcl_30_49=DosingRecommendation("15 mg/kg", "every 36 hours", "IV"),
        crcl_15_29=DosingRecommendation("15 mg/kg", "every 48 hours", "IV"),
        crcl_less_15=DosingRecommendation("7.5 mg/kg", "every 48 hours", "IV"),
        ihd_dose=DosingRecommendation("7.5-10 mg/kg", "after dialysis", "IV"),
        crrt_dose=DosingRecommendation("7.5-10 mg/kg", "every 24-48 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        requires_therapeutic_monitoring=True,
    ),
    
    # =========================================================================
    # OTHERS
    # =========================================================================
    
    "metronidazole": RenalDosingInfo(
        drug_name="Metronidazole",
        drug_class="Nitroimidazole",
        primary_elimination="hepatic",
        fraction_renal_excretion=0.20,
        normal_dose=DosingRecommendation("500 mg", "every 8 hours", "IV/PO"),
        crcl_50_90=DosingRecommendation("500 mg", "every 8 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("500 mg", "every 8 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("500 mg", "every 8 hours", "IV/PO", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("500 mg", "every 8 hours", "IV/PO", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("500 mg", "every 8 hours", "IV/PO", notes=["No adjustment needed"]),
        crrt_dose=DosingRecommendation("500 mg", "every 8 hours", "IV/PO"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "No renal adjustment needed",
            "Disulfiram reaction with alcohol",
            "Excellent anaerobic coverage",
        ],
    ),
    
    "clindamycin": RenalDosingInfo(
        drug_name="Clindamycin",
        drug_class="Lincosamide",
        primary_elimination="hepatic",
        fraction_renal_excretion=0.10,
        normal_dose=DosingRecommendation("600-900 mg", "every 8 hours", "IV"),
        crcl_50_90=DosingRecommendation("600-900 mg", "every 8 hours", "IV", notes=["No adjustment needed"]),
        crcl_30_49=DosingRecommendation("600-900 mg", "every 8 hours", "IV", notes=["No adjustment needed"]),
        crcl_15_29=DosingRecommendation("600-900 mg", "every 8 hours", "IV", notes=["No adjustment needed"]),
        crcl_less_15=DosingRecommendation("600-900 mg", "every 8 hours", "IV", notes=["No adjustment needed"]),
        ihd_dose=DosingRecommendation("600-900 mg", "every 8 hours", "IV", notes=["No adjustment needed"]),
        crrt_dose=DosingRecommendation("600-900 mg", "every 8 hours", "IV"),
        dialyzable=False,
        supplement_after_ihd=False,
        special_notes=[
            "No renal adjustment needed",
            "C. difficile risk",
            "Good bone penetration",
        ],
    ),
    
    "tmp_smx": RenalDosingInfo(
        drug_name="TMP-SMX",
        drug_class="Sulfonamide",
        primary_elimination="renal",
        fraction_renal_excretion=0.60,
        normal_dose=DosingRecommendation("1-2 DS tablets", "every 8-12 hours", "PO"),
        crcl_50_90=DosingRecommendation("1 DS tablet", "every 12 hours", "PO"),
        crcl_30_49=DosingRecommendation("1 DS tablet", "every 12 hours", "PO"),
        crcl_15_29=DosingRecommendation("1 DS tablet", "every 24 hours", "PO"),
        crcl_less_15=DosingRecommendation("1 SS tablet", "every 24 hours", "PO"),
        ihd_dose=DosingRecommendation("1 DS tablet", "after dialysis", "PO"),
        crrt_dose=DosingRecommendation("1 DS tablet", "every 12-24 hours", "PO"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=[
            "Hyperkalemia risk in renal failure",
            "Avoid in severe renal failure if possible",
            "Monitor potassium and creatinine",
        ],
    ),
    
    "nitrofurantoin": RenalDosingInfo(
        drug_name="Nitrofurantoin",
        drug_class="Nitrofuran",
        primary_elimination="renal",
        fraction_renal_excretion=0.40,
        normal_dose=DosingRecommendation("100 mg", "every 12 hours", "PO"),
        crcl_50_90=DosingRecommendation("100 mg", "every 12 hours", "PO"),
        crcl_30_49=DosingRecommendation("AVOID", "-", "PO", notes=["Inadequate urine concentrations"]),
        crcl_15_29=DosingRecommendation("AVOID", "-", "PO", notes=["Contraindicated"]),
        crcl_less_15=DosingRecommendation("AVOID", "-", "PO", notes=["Contraindicated"]),
        ihd_dose=DosingRecommendation("AVOID", "-", "PO", notes=["Contraindicated"]),
        crrt_dose=DosingRecommendation("AVOID", "-", "PO"),
        dialyzable=True,
        supplement_after_ihd=False,
        contraindicated_in_severe_renal=True,
        special_notes=[
            "AVOID if CrCl < 30 mL/min",
            "Only for uncomplicated lower UTI",
            "Pulmonary fibrosis with chronic use",
        ],
    ),
    
    "fosfomycin": RenalDosingInfo(
        drug_name="Fosfomycin",
        drug_class="Phosphonic acid",
        primary_elimination="renal",
        fraction_renal_excretion=0.90,
        normal_dose=DosingRecommendation("3 g", "single dose", "PO"),
        crcl_50_90=DosingRecommendation("3 g", "single dose", "PO"),
        crcl_30_49=DosingRecommendation("3 g", "single dose", "PO", notes=["May repeat in 24-48 hours"]),
        crcl_15_29=DosingRecommendation("3 g", "every 48 hours x 2 doses", "PO"),
        crcl_less_15=DosingRecommendation("3 g", "every 7 days", "PO"),
        ihd_dose=DosingRecommendation("3 g", "after dialysis", "PO"),
        crrt_dose=DosingRecommendation("3 g", "every 48-72 hours", "PO"),
        dialyzable=True,
        supplement_after_ihd=True,
        special_notes=["Single dose for uncomplicated UTI", "May need repeat dose for complicated UTI"],
    ),
    
    "colistin": RenalDosingInfo(
        drug_name="Colistin (Colistimethate)",
        drug_class="Polymyxin",
        primary_elimination="renal",
        fraction_renal_excretion=0.60,
        normal_dose=DosingRecommendation("2.5-5 mg/kg/day CBA", "divided every 8-12 hours", "IV",
            notes=["Dose as colistin base activity (CBA)"]),
        crcl_50_90=DosingRecommendation("2.5 mg/kg/day CBA", "divided every 12 hours", "IV"),
        crcl_30_49=DosingRecommendation("2.5 mg/kg/day CBA", "divided every 12 hours", "IV"),
        crcl_15_29=DosingRecommendation("1.5 mg/kg/day CBA", "divided every 12 hours", "IV"),
        crcl_less_15=DosingRecommendation("1 mg/kg/day CBA", "divided every 12 hours", "IV"),
        ihd_dose=DosingRecommendation("1.5 mg/kg CBA", "after dialysis", "IV"),
        crrt_dose=DosingRecommendation("2 mg/kg/day CBA", "divided every 12 hours", "IV"),
        dialyzable=True,
        supplement_after_ihd=True,
        requires_therapeutic_monitoring=True,
        special_notes=[
            "NEPHROTOXICITY COMMON",
            "Dose in colistin base activity (CBA), not colistimethate sodium",
            "Loading dose: 5-10 mg/kg CBA for critically ill",
            "Last-line agent for MDR gram-negatives",
        ],
    ),
}


# =============================================================================
# RENAL DOSING ENGINE CLASS
# =============================================================================

class RenalDosingEngine:
    """
    Comprehensive renal dosing calculator for antimicrobials.
    
    Features:
    - Cockcroft-Gault calculation
    - CKD staging
    - Antibiotic-specific dosing recommendations
    - Dialysis dosing (IHD, CRRT)
    - Vancomycin and aminoglycoside PK monitoring
    """
    
    def __init__(self):
        self._database = RENAL_DOSING_DATABASE
    
    def calculate_crcl(
        self,
        age: int,
        weight_kg: float,
        scr: float,
        is_female: bool = False,
        use_ibw: bool = False,
        height_cm: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate creatinine clearance with options for IBW adjustment.
        """
        actual_weight = weight_kg
        
        if use_ibw and height_cm:
            ibw = calculate_ideal_body_weight(height_cm, is_male=not is_female)
            if weight_kg > ibw * 1.3:  # If >30% over IBW, use adjusted BW
                weight_kg = calculate_adjusted_body_weight(weight_kg, ibw)
        
        crcl = calculate_cockcroft_gault(age, weight_kg, scr, is_female)
        ckd_stage = get_ckd_stage(crcl)
        
        return {
            "crcl_ml_min": crcl,
            "ckd_stage": ckd_stage.value,
            "weight_used_kg": weight_kg,
            "actual_weight_kg": actual_weight,
            "ibw_used": use_ibw and height_cm is not None,
            "dosing_range": get_dosing_crcl_range(crcl),
        }
    
    def get_dose_recommendation(
        self,
        drug_name: str,
        crcl: Optional[float] = None,
        dialysis_type: DialysisType = DialysisType.NONE
    ) -> Dict[str, Any]:
        """
        Get dose recommendation for an antibiotic based on renal function.
        """
        # Find drug in database
        drug_key = drug_name.lower().replace("-", "_").replace(" ", "_")
        
        if drug_key not in self._database:
            # Try partial match
            for key in self._database:
                if drug_name.lower() in key or key in drug_name.lower():
                    drug_key = key
                    break
            else:
                return {
                    "error": f"Drug {drug_name} not found in database",
                    "available_drugs": list(self._database.keys())
                }
        
        drug_info = self._database[drug_key]
        result = {
            "drug_name": drug_info.drug_name,
            "drug_class": drug_info.drug_class,
            "primary_elimination": drug_info.primary_elimination,
            "fraction_renal_excretion": drug_info.fraction_renal_excretion,
            "dialyzable": drug_info.dialyzable,
            "requires_monitoring": drug_info.requires_therapeutic_monitoring,
        }
        
        # Get dose based on renal function or dialysis
        if dialysis_type == DialysisType.IHD:
            result["recommended_dose"] = drug_info.ihd_dose.to_dict() if drug_info.ihd_dose else drug_info.normal_dose.to_dict()
            result["supplement_after_ihd"] = drug_info.supplement_after_ihd
        elif dialysis_type in [DialysisType.CRRT_CVVH, DialysisType.CRRT_CVVHD, DialysisType.CRRT_CVVHDF]:
            result["recommended_dose"] = drug_info.crrt_dose.to_dict() if drug_info.crrt_dose else drug_info.normal_dose.to_dict()
        elif dialysis_type == DialysisType.PD:
            result["recommended_dose"] = drug_info.pd_dose.to_dict() if drug_info.pd_dose else drug_info.normal_dose.to_dict()
        elif crcl is not None:
            dosing_range = get_dosing_crcl_range(crcl)
            if dosing_range == "normal":
                result["recommended_dose"] = drug_info.normal_dose.to_dict()
            elif dosing_range == "crcl_50_90":
                result["recommended_dose"] = (drug_info.crcl_50_90 or drug_info.normal_dose).to_dict()
            elif dosing_range == "crcl_30_49":
                result["recommended_dose"] = (drug_info.crcl_30_49 or drug_info.normal_dose).to_dict()
            elif dosing_range == "crcl_15_29":
                result["recommended_dose"] = (drug_info.crcl_15_29 or drug_info.normal_dose).to_dict()
            else:
                result["recommended_dose"] = (drug_info.crcl_less_15 or drug_info.normal_dose).to_dict()
        else:
            result["recommended_dose"] = drug_info.normal_dose.to_dict()
        
        result["special_notes"] = drug_info.special_notes
        result["contraindicated_in_severe_renal"] = drug_info.contraindicated_in_severe_renal
        
        return result
    
    def get_vancomycin_dosing(
        self,
        crcl: float,
        weight_kg: float,
        target_trough: float = 15.0,
        is_obese: bool = False,
        actual_weight_kg: Optional[float] = None,
        height_cm: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate vancomycin dosing with PK parameters.
        """
        # Adjust weight for obese patients
        if is_obese and actual_weight_kg and height_cm:
            ibw = calculate_ideal_body_weight(height_cm)
            weight_kg = calculate_adjusted_body_weight(actual_weight_kg, ibw)
        
        return estimate_vancomycin_dose(crcl, weight_kg, target_trough)
    
    def get_amikacin_dosing(
        self,
        crcl: float,
        weight_kg: float,
        dosing_method: str = "extended_interval"
    ) -> Dict[str, Any]:
        """Calculate amikacin dosing."""
        return calculate_amikacin_dose(crcl, weight_kg, dosing_method)
    
    def get_gentamicin_dosing(
        self,
        crcl: float,
        weight_kg: float,
        dosing_method: str = "extended_interval"
    ) -> Dict[str, Any]:
        """Calculate gentamicin dosing."""
        return calculate_gentamicin_dose(crcl, weight_kg, dosing_method)
    
    def list_available_drugs(self) -> List[str]:
        """List all drugs in the database."""
        return list(self._database.keys())
    
    def get_drugs_requiring_monitoring(self) -> List[str]:
        """List drugs requiring therapeutic drug monitoring."""
        return [
            drug.drug_name for drug in self._database.values()
            if drug.requires_therapeutic_monitoring
        ]
    
    def get_drugs_contraindicated_in_severe_renal(self) -> List[str]:
        """List drugs contraindicated in severe renal impairment."""
        return [
            drug.drug_name for drug in self._database.values()
            if drug.contraindicated_in_severe_renal
        ]


# Singleton instance
_renal_dosing_engine = None

def get_renal_dosing_engine() -> RenalDosingEngine:
    """Get singleton RenalDosingEngine instance."""
    global _renal_dosing_engine
    if _renal_dosing_engine is None:
        _renal_dosing_engine = RenalDosingEngine()
    return _renal_dosing_engine
