"""
Renal Function Calculations Module
==================================

Implements clinically validated renal function calculations:
- Ideal Body Weight (IBW) - Devine Formula
- Adjusted Body Weight (AdjBW) for obese patients
- Cockcroft-Gault Creatinine Clearance estimation
- Proper weight selection for CrCl calculation

Clinical References:
- Devine BJ. Drug Intell Clin Pharm 1974;8:650-655 (IBW formula)
- Cockcroft DW, Gault MH. Nephron 1976;16:31-41 (CrCl formula)
- Winter MA, et al. Am J Health-Syst Pharm 2012;69:293-301 (weight selection)

CRITICAL: This module addresses the dangerous practice of using hardcoded weight
values (70kg) for CrCl estimation, which can lead to incorrect drug dosing.

Example Clinical Impact:
- 45kg elderly female with Cr 1.8: Previously calculated as if 70kg
  (CrCl ~30 mL/min) → Actual CrCl ~18 mL/min (66% error!)
  This error could result in vancomycin/aminoglycoside toxicity.
"""

from typing import Optional, Tuple, List
from dataclasses import dataclass, field
from enum import Enum
from pydantic import BaseModel, Field, validator


class WeightType(Enum):
    """Type of weight used in CrCl calculation."""
    ACTUAL = "actual"
    IDEAL = "ideal"
    ADJUSTED = "adjusted"


@dataclass
class RenalFunctionResult:
    """
    Comprehensive renal function calculation result.
    
    Includes all intermediate calculations for clinical review.
    """
    creatinine_clearance: float  # mL/min
    weight_used: float  # kg
    weight_type: WeightType
    ideal_body_weight: Optional[float] = None  # kg
    adjusted_body_weight: Optional[float] = None  # kg
    is_obese: bool = False
    obesity_ratio: Optional[float] = None  # actual_weight / IBW
    warnings: List[str] = field(default_factory=list)
    calculation_notes: List[str] = field(default_factory=list)
    
    # Evidence citations
    evidence_sources: List[str] = field(default_factory=lambda: [
        "Cockcroft DW, Gault MH. Nephron 1976;16:31-41",
        "Devine BJ. Drug Intell Clin Pharm 1974;8:650-655",
    ])
    
    def to_dict(self) -> dict:
        return {
            "creatinine_clearance_ml_min": round(self.creatinine_clearance, 1),
            "weight_used_kg": round(self.weight_used, 1),
            "weight_type": self.weight_type.value,
            "ideal_body_weight_kg": round(self.ideal_body_weight, 1) if self.ideal_body_weight else None,
            "adjusted_body_weight_kg": round(self.adjusted_body_weight, 1) if self.adjusted_body_weight else None,
            "is_obese": self.is_obese,
            "obesity_ratio": round(self.obesity_ratio, 2) if self.obesity_ratio else None,
            "warnings": self.warnings,
            "calculation_notes": self.calculation_notes,
            "evidence_sources": self.evidence_sources,
        }


class RenalCalculationRequest(BaseModel):
    """
    Request model for renal function calculations.
    
    Required parameters:
    - age_years: Patient age in years
    - weight_kg: Actual body weight in kilograms
    - serum_creatinine: Serum creatinine in mg/dL
    - gender: Biological sex ('male' or 'female')
    
    Optional parameters:
    - height_cm: Height in centimeters (required for IBW calculation)
    
    WARNING: If height_cm is not provided, IBW cannot be calculated.
    This means obese patients may receive incorrect dosing.
    """
    age_years: int = Field(..., ge=18, le=120, description="Patient age in years")
    weight_kg: float = Field(..., gt=0, le=500, description="Actual body weight in kg")
    serum_creatinine: float = Field(..., gt=0, le=25, description="Serum creatinine in mg/dL")
    gender: str = Field(..., description="Biological sex: 'male' or 'female'")
    height_cm: Optional[float] = Field(None, ge=50, le=250, description="Height in cm (required for IBW)")
    
    @validator('gender')
    def validate_gender(cls, v):
        v_lower = v.lower().strip()
        if v_lower not in ['male', 'female', 'm', 'f']:
            raise ValueError("Gender must be 'male' or 'female'")
        return 'male' if v_lower in ['male', 'm'] else 'female'
    
    @validator('serum_creatinine')
    def validate_creatinine(cls, v):
        if v < 0.2:
            raise ValueError("Serum creatinine appears too low - verify lab result")
        return v


class RenalCalculationResponse(BaseModel):
    """Response model for renal function calculations."""
    creatinine_clearance_ml_min: float = Field(..., description="Estimated CrCl in mL/min")
    weight_used_kg: float = Field(..., description="Weight used in calculation")
    weight_type: str = Field(..., description="Type of weight used: actual, ideal, or adjusted")
    ideal_body_weight_kg: Optional[float] = Field(None, description="Calculated IBW")
    adjusted_body_weight_kg: Optional[float] = Field(None, description="Calculated AdjBW for obese patients")
    is_obese: bool = Field(..., description="Whether patient meets obesity criteria for CrCl")
    obesity_ratio: Optional[float] = Field(None, description="Ratio of actual weight to IBW")
    warnings: List[str] = Field(default_factory=list)
    calculation_notes: List[str] = Field(default_factory=list)
    renal_impairment_severity: str = Field(..., description="none, mild, moderate, severe, or esrd")
    dosing_considerations: List[str] = Field(default_factory=list)
    evidence_sources: List[str] = Field(default_factory=list)


# =============================================================================
# IDEAL BODY WEIGHT (IBW) CALCULATION
# =============================================================================

def calculate_ideal_body_weight(
    height_cm: float,
    gender: str,
) -> float:
    """
    Calculate Ideal Body Weight using the Devine Formula.
    
    Reference: Devine BJ. Drug Intell Clin Pharm 1974;8:650-655
    
    Formula:
    - Male: IBW (kg) = 50 + 2.3 × (height_inches − 60)
    - Female: IBW (kg) = 45.5 + 2.3 × (height_inches − 60)
    
    Note: For heights ≤ 60 inches (152.4 cm), the formula gives:
    - Male: 50 kg
    - Female: 45.5 kg
    
    Args:
        height_cm: Height in centimeters
        gender: 'male' or 'female'
        
    Returns:
        Ideal body weight in kilograms
        
    Example:
        >>> calculate_ideal_body_weight(175, 'male')
        70.5  # 50 + 2.3 * (68.9 - 60) = 50 + 20.47 ≈ 70.5 kg
    """
    # Convert cm to inches
    height_inches = height_cm / 2.54
    
    # Devine formula base values
    if gender.lower() == 'male':
        base_weight = 50.0
    else:
        base_weight = 45.5
    
    # For heights > 60 inches, add the increment
    if height_inches > 60:
        increment = 2.3 * (height_inches - 60)
        ibw = base_weight + increment
    else:
        # For shorter individuals, use base weight
        # (original formula doesn't subtract for shorter heights)
        ibw = base_weight
    
    return round(ibw, 1)


# =============================================================================
# ADJUSTED BODY WEIGHT (AdjBW) CALCULATION
# =============================================================================

def calculate_adjusted_body_weight(
    ideal_body_weight: float,
    actual_weight_kg: float,
) -> float:
    """
    Calculate Adjusted Body Weight for obese patients.
    
    Reference: Winter MA, et al. Am J Health-Syst Pharm 2012;69:293-301
    
    Used when actual weight > 130% of IBW.
    
    Formula: AdjBW = IBW + 0.4 × (actual_weight − IBW)
    
    This accounts for the fact that adipose tissue has lower blood flow
    and contributes less to creatinine production than lean mass.
    
    Args:
        ideal_body_weight: Calculated IBW in kg
        actual_weight_kg: Actual body weight in kg
        
    Returns:
        Adjusted body weight in kilograms
        
    Example:
        >>> calculate_adjusted_body_weight(70, 130)
        94.0  # 70 + 0.4 * (130 - 70) = 70 + 24 = 94 kg
    """
    adjbw = ideal_body_weight + 0.4 * (actual_weight_kg - ideal_body_weight)
    return round(adjbw, 1)


# =============================================================================
# WEIGHT SELECTION FOR COCKCROFT-GAULT
# =============================================================================

def select_weight_for_crcl(
    actual_weight_kg: float,
    height_cm: Optional[float],
    gender: str,
) -> Tuple[float, WeightType, Optional[float], Optional[float], bool, Optional[float]]:
    """
    Select the appropriate weight for Cockcroft-Gault calculation.
    
    Reference: Winter MA, et al. Am J Health-Syst Pharm 2012;69:293-301
    
    Weight Selection Algorithm:
    1. If height not provided: Use actual weight (with warning)
    2. Calculate IBW from height
    3. If actual weight ≤ IBW: Use actual weight (underweight/normal)
    4. If actual weight between IBW and 130% IBW: Use actual weight
    5. If actual weight > 130% IBW: Use Adjusted Body Weight
    
    Args:
        actual_weight_kg: Actual body weight in kg
        height_cm: Height in cm (optional but recommended)
        gender: 'male' or 'female'
        
    Returns:
        Tuple of:
        - weight_to_use: The weight to use in CrCl calculation
        - weight_type: Type of weight (actual, ideal, or adjusted)
        - ibw: Calculated ideal body weight (or None)
        - adjbw: Calculated adjusted body weight (or None)
        - is_obese: Whether patient is obese (>130% IBW)
        - obesity_ratio: actual_weight / IBW (or None)
    """
    # Case 1: No height provided - must use actual weight
    if height_cm is None:
        return (
            actual_weight_kg,
            WeightType.ACTUAL,
            None,
            None,
            False,  # Cannot determine obesity without height
            None,
        )
    
    # Calculate IBW
    ibw = calculate_ideal_body_weight(height_cm, gender)
    obesity_ratio = actual_weight_kg / ibw
    
    # Case 2: Underweight or normal weight (≤ IBW)
    if actual_weight_kg <= ibw:
        return (
            actual_weight_kg,
            WeightType.ACTUAL,
            ibw,
            None,
            False,
            obesity_ratio,
        )
    
    # Case 3: Overweight but not obese (IBW < weight ≤ 130% IBW)
    if actual_weight_kg <= 1.3 * ibw:
        return (
            actual_weight_kg,
            WeightType.ACTUAL,
            ibw,
            None,
            False,
            obesity_ratio,
        )
    
    # Case 4: Obese (> 130% IBW) - use adjusted body weight
    adjbw = calculate_adjusted_body_weight(ibw, actual_weight_kg)
    return (
        adjbw,
        WeightType.ADJUSTED,
        ibw,
        adjbw,
        True,
        obesity_ratio,
    )


# =============================================================================
# COCKCROFT-GAULT CREATININE CLEARANCE
# =============================================================================

def calculate_creatinine_clearance(
    age_years: int,
    weight_kg: float,
    serum_creatinine: float,
    gender: str,
    height_cm: Optional[float] = None,
) -> RenalFunctionResult:
    """
    Calculate Creatinine Clearance using the Cockcroft-Gault equation.
    
    Reference: Cockcroft DW, Gault MH. Nephron 1976;16:31-41
    
    Original Formula:
    CrCl (mL/min) = [(140 − age) × weight_kg / (72 × serum_creatinine)] × (0.85 if female)
    
    This implementation properly selects weight based on patient body composition:
    - Uses actual weight for non-obese patients
    - Uses Adjusted Body Weight for obese patients (>130% IBW)
    
    CRITICAL: The original formula's publication did not specify which weight
    to use for obese patients. This led to inconsistent clinical practice.
    Current recommendations (Winter 2012) support AdjBW for obese patients.
    
    Args:
        age_years: Patient age in years (18-120)
        weight_kg: Actual body weight in kg
        serum_creatinine: Serum creatinine in mg/dL
        gender: 'male' or 'female'
        height_cm: Height in cm (optional but recommended for obesity assessment)
        
    Returns:
        RenalFunctionResult with CrCl and all calculation details
        
    Clinical Examples:
        >>> # 70kg male, 175cm, age 65, Cr 1.2
        >>> result = calculate_creatinine_clearance(65, 70, 1.2, 'male', 175)
        >>> result.creatinine_clearance  # ~65 mL/min
        
        >>> # 45kg elderly female, age 80, Cr 1.8 - DANGEROUS if calculated with 70kg!
        >>> result = calculate_creatinine_clearance(80, 45, 1.8, 'female', 155)
        >>> result.creatinine_clearance  # ~18 mL/min (NOT ~30 if 70kg was used)
    """
    warnings: List[str] = []
    notes: List[str] = []
    
    # Select appropriate weight
    weight_to_use, weight_type, ibw, adjbw, is_obese, obesity_ratio = select_weight_for_crcl(
        actual_weight_kg=weight_kg,
        height_cm=height_cm,
        gender=gender,
    )
    
    # Add warning if height not provided
    if height_cm is None:
        warnings.append(
            "⚠️ CLINICAL WARNING: Height not provided. IBW cannot be calculated. "
            "Actual weight used, which may overestimate CrCl in obese patients. "
            "This could result in inappropriate drug dosing (vancomycin, aminoglycosides, DOACs)."
        )
        notes.append("Actual weight used without obesity adjustment (height unknown)")
    elif is_obese:
        warnings.append(
            f"Patient is obese ({obesity_ratio:.1%} of IBW). "
            f"Using Adjusted Body Weight ({adjbw:.1f} kg) instead of actual weight ({weight_kg:.1f} kg) "
            "for CrCl calculation per Winter 2012 recommendations."
        )
        notes.append(f"Obesity detected: AdjBW = IBW + 0.4 × (actual - IBW) = {adjbw:.1f} kg")
    
    # Calculate CrCl using Cockcroft-Gault
    # CrCl = [(140 - age) × weight / (72 × Cr)] × (0.85 if female)
    base_crcl = ((140 - age_years) * weight_to_use) / (72 * serum_creatinine)
    
    # Apply female correction factor
    if gender.lower() == 'female':
        crcl = base_crcl * 0.85
        notes.append("Female sex correction factor (0.85) applied")
    else:
        crcl = base_crcl
    
    # PROMPT 2 FIX: Cap CrCl at 120 mL/min for muscle wasting patients
    # Reference: Matthieu DB et al. Eur J Clin Pharmacol 2023;79:773-781
    # Patients with low muscle mass (elderly >80 years or BMI <18.5) may have
    # spuriously high CrCl estimates due to low serum creatinine from low muscle mass,
    # which can lead to dangerous overdosing of renally-cleared drugs.
    # 
    # Calculate BMI if height provided
    bmi = None
    if height_cm is not None and weight_kg > 0:
        height_m = height_cm / 100
        bmi = weight_kg / (height_m * height_m)
    
    # Apply cap for at-risk populations
    cap_applied = False
    if age_years > 80 or (bmi is not None and bmi < 18.5):
        original_crcl = crcl
        if crcl > 120:
            crcl = 120.0
            cap_applied = True
            cap_reason = []
            if age_years > 80:
                cap_reason.append(f"age > 80 years ({age_years})")
            if bmi is not None and bmi < 18.5:
                cap_reason.append(f"BMI < 18.5 ({bmi:.1f})")
            warnings.append(
                f"⚠️ CrCl CAPPED AT 120 mL/min: Patient has low muscle mass indicators: "
                f"{', '.join(cap_reason)}. Original calculated CrCl was {original_crcl:.1f} mL/min. "
                "High CrCl in low muscle mass may be spurious and lead to drug toxicity. "
                "Reference: Matthieu DB et al. Eur J Clin Pharmacol 2023;79:773-781"
            )
            notes.append(f"CrCl capped at 120 mL/min (original: {original_crcl:.1f}) for patient with low muscle mass")
    
    # Add calculation details
    notes.insert(0, f"Cockcroft-Gault: CrCl = [(140-{age_years}) × {weight_to_use:.1f}] / (72 × {serum_creatinine})")
    
    # Add renal function interpretation
    if crcl >= 90:
        notes.append("Normal renal function (CrCl ≥ 90 mL/min)")
    elif crcl >= 60:
        notes.append("Mild renal impairment (CrCl 60-89 mL/min)")
    elif crcl >= 30:
        notes.append("Moderate renal impairment (CrCl 30-59 mL/min)")
    elif crcl >= 15:
        notes.append("Severe renal impairment (CrCl 15-29 mL/min)")
    else:
        notes.append("End-stage renal disease (CrCl < 15 mL/min)")
    
    # Add safety warnings for critical values
    if crcl < 15:
        warnings.append(
            "⚠️ CRITICAL - END-STAGE RENAL DISEASE (ESRD): CrCl < 15 mL/min. "
            "Many medications contraindicated or require dialysis-specific dosing. "
            "MANDATORY: Pharmacy and nephrology consultation. "
            "Check dialyzability of all medications."
        )
    elif crcl < 30:
        warnings.append(
            "⚠️ SEVERE RENAL IMPAIRMENT: Significant dose adjustments required for: "
            "vancomycin, aminoglycosides, fluoroquinolones, DOACs, metformin, and many other medications. "
            "Consider pharmacy/nephrology consultation."
        )
    
    return RenalFunctionResult(
        creatinine_clearance=round(crcl, 1),
        weight_used=weight_to_use,
        weight_type=weight_type,
        ideal_body_weight=ibw,
        adjusted_body_weight=adjbw,
        is_obese=is_obese,
        obesity_ratio=obesity_ratio,
        warnings=warnings,
        calculation_notes=notes,
    )


def get_renal_dosing_category(crcl: float) -> Tuple[str, List[str]]:
    """
    Determine renal dosing category and considerations.
    
    Args:
        crcl: Creatinine clearance in mL/min
        
    Returns:
        Tuple of (category, dosing_considerations)
    """
    if crcl >= 90:
        return (
            "normal",
            ["Standard dosing for most medications"]
        )
    elif crcl >= 60:
        return (
            "mild",
            [
                "Monitor renal function periodically",
                "Some medications may need minor adjustments",
                "Adequate hydration important"
            ]
        )
    elif crcl >= 30:
        return (
            "moderate",
            [
                "⚠️ Dose reduction often required",
                "Check specific drug dosing guidelines",
                "Monitor drug levels when available",
                "Avoid nephrotoxic combinations when possible"
            ]
        )
    elif crcl >= 15:
        return (
            "severe",
            [
                "⚠️ SIGNIFICANT dose adjustments required",
                "Many drugs contraindicated or require major dose reduction",
                "Consider drug level monitoring",
                "Pharmacy consult recommended",
                "Avoid: NSAIDs, aminoglycosides (if possible), iodinated contrast"
            ]
        )
    else:
        return (
            "esrd",
            [
                "⚠️ CRITICAL: End-stage renal disease",
                "Many medications contraindicated",
                "Dialysis-specific dosing often required",
                "Mandatory pharmacy/nephrology consultation",
                "Check dialyzability of each medication"
            ]
        )


def create_renal_calculation_response(
    request: RenalCalculationRequest,
) -> RenalCalculationResponse:
    """
    Create a full response for renal function calculation.
    
    Args:
        request: Validated RenalCalculationRequest
        
    Returns:
        RenalCalculationResponse with all calculation results
    """
    result = calculate_creatinine_clearance(
        age_years=request.age_years,
        weight_kg=request.weight_kg,
        serum_creatinine=request.serum_creatinine,
        gender=request.gender,
        height_cm=request.height_cm,
    )
    
    severity, considerations = get_renal_dosing_category(result.creatinine_clearance)
    
    return RenalCalculationResponse(
        creatinine_clearance_ml_min=result.creatinine_clearance,
        weight_used_kg=result.weight_used,
        weight_type=result.weight_type.value,
        ideal_body_weight_kg=result.ideal_body_weight,
        adjusted_body_weight_kg=result.adjusted_body_weight,
        is_obese=result.is_obese,
        obesity_ratio=result.obesity_ratio,
        warnings=result.warnings,
        calculation_notes=result.calculation_notes,
        renal_impairment_severity=severity,
        dosing_considerations=considerations,
        evidence_sources=result.evidence_sources,
    )


# =============================================================================
# CONVENIENCE FUNCTIONS FOR INTEGRATION
# =============================================================================

def estimate_crcl_simple(
    age: int,
    weight_kg: float,
    creatinine: float,
    gender: str,
    height_cm: Optional[float] = None,
) -> float:
    """
    Simple function to get CrCl value without full result object.
    
    Use this for quick integration where you only need the CrCl value.
    For full clinical context, use calculate_creatinine_clearance() instead.
    
    Args:
        age: Patient age in years
        weight_kg: Actual body weight in kg
        creatinine: Serum creatinine in mg/dL
        gender: 'male' or 'female'
        height_cm: Height in cm (optional but recommended)
        
    Returns:
        Estimated creatinine clearance in mL/min
    """
    result = calculate_creatinine_clearance(
        age_years=age,
        weight_kg=weight_kg,
        serum_creatinine=creatinine,
        gender=gender,
        height_cm=height_cm,
    )
    return result.creatinine_clearance
