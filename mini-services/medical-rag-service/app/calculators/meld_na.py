"""
P1: MELD-Na Score Calculator
============================

Model for End-Stage Liver Disease with Sodium (MELD-Na)
Mortality prediction for patients with chronic liver disease.

Reference: Biggins SW, et al. Gastroenterology 2006;131:1941-1951.

MELD-Na Formula:
MELD-Na = MELD + 1.32 × (137-Na) - [0.033 × MELD × (137-Na)]

Where MELD = 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43

Interpretation:
- Score < 10: 1.9% 3-month mortality
- Score 10-19: 6.0% 3-month mortality
- Score 20-29: 19.6% 3-month mortality
- Score 30-39: 52.6% 3-month mortality
- Score ≥ 40: 71.3% 3-month mortality

Used for liver transplant prioritization (UNOS).
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import math


class MELDRiskCategory(str, Enum):
    """MELD risk categories."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    SEVERE = "severe"
    CRITICAL = "critical"


@dataclass
class MELDNaResult:
    """Complete MELD-Na score result."""
    meld_score: float
    meld_na_score: float
    three_month_mortality: float
    risk_category: MELDRiskCategory
    bilirubin: float
    inr: float
    creatinine: float
    sodium: float
    is_dialysis: bool
    transplant_priority: str
    recommendations: List[str] = field(default_factory=list)
    clinical_notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "meld_score": round(self.meld_score, 1),
            "meld_na_score": round(self.meld_na_score, 1),
            "three_month_mortality": f"{self.three_month_mortality:.1%}",
            "risk_category": self.risk_category.value,
            "bilirubin": self.bilirubin,
            "inr": self.inr,
            "creatinine": self.creatinine,
            "sodium": self.sodium,
            "is_dialysis": self.is_dialysis,
            "transplant_priority": self.transplant_priority,
            "recommendations": self.recommendations,
            "clinical_notes": self.clinical_notes,
            "timestamp": datetime.utcnow().isoformat(),
        }


class MeldNaCalculator:
    """
    MELD-Na Score Calculator for liver disease severity.

    Usage:
        calculator = MeldNaCalculator()
        result = calculator.calculate(
            bilirubin=3.5,  # mg/dL
            inr=1.8,
            creatinine=2.0,  # mg/dL
            sodium=132,  # mEq/L
            is_dialysis=False,
        )
    """

    # 3-month mortality by MELD score
    MORTALITY_TABLE = {
        (0, 9): {"mortality": 0.019, "category": MELDRiskCategory.LOW},
        (10, 19): {"mortality": 0.060, "category": MELDRiskCategory.MODERATE},
        (20, 29): {"mortality": 0.196, "category": MELDRiskCategory.HIGH},
        (30, 39): {"mortality": 0.526, "category": MELDRiskCategory.SEVERE},
        (40, 100): {"mortality": 0.713, "category": MELDRiskCategory.CRITICAL},
    }

    # Minimum values to prevent log(0)
    MIN_BILIRUBIN = 1.0  # mg/dL
    MIN_INR = 1.0
    MIN_CREATININE = 1.0  # mg/dL

    # Creatinine cap for MELD
    MAX_CREATININE = 4.0  # mg/dL

    def calculate(
        self,
        bilirubin: float,  # mg/dL
        inr: float,
        creatinine: float,  # mg/dL
        sodium: float,  # mEq/L
        is_dialysis: bool = False,
        is_transplant_candidate: bool = True,
    ) -> MELDNaResult:
        """
        Calculate MELD-Na score.

        Args:
            bilirubin: Total bilirubin (mg/dL)
            inr: International Normalized Ratio
            creatinine: Serum creatinine (mg/dL)
            sodium: Serum sodium (mEq/L)
            is_dialysis: Patient on dialysis (creatinine capped at 4.0)
            is_transplant_candidate: Whether patient is eligible for transplant

        Returns:
            MELDNaResult with scores and mortality prediction
        """
        # Apply minimums
        bilirubin_adj = max(bilirubin, self.MIN_BILIRUBIN)
        inr_adj = max(inr, self.MIN_INR)

        # Creatinine handling for dialysis patients
        if is_dialysis:
            creatinine_adj = self.MAX_CREATININE
        else:
            creatinine_adj = min(max(creatinine, self.MIN_CREATININE), self.MAX_CREATININE)

        # Calculate MELD score
        meld = (
            3.78 * math.log(bilirubin_adj) +
            11.2 * math.log(inr_adj) +
            9.57 * math.log(creatinine_adj) +
            6.43
        )

        # Round MELD to nearest integer for calculation
        meld_rounded = round(meld)

        # Calculate MELD-Na
        sodium_adj = min(max(sodium, 125), 137)  # Sodium bounds

        meld_na = meld_rounded + 1.32 * (137 - sodium_adj) - (
            0.033 * meld_rounded * (137 - sodium_adj)
        )

        # Bound MELD-Na to 0-40 range for UNOS (with exceptions)
        meld_na_bounded = max(0, min(40, meld_na))

        # Exception: Patients with sodium < 125 get additional points
        if sodium < 125:
            meld_na_bounded = min(40, meld_na_bounded + (125 - sodium) * 0.1)

        # Get mortality and category
        risk_info = self._get_risk_info(meld_na_bounded)

        # Determine transplant priority
        priority = self._get_transplant_priority(meld_na_bounded, is_transplant_candidate)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            meld_na_bounded,
            risk_info["category"],
            is_transplant_candidate,
            sodium,
        )

        # Clinical notes
        notes = self._generate_clinical_notes(
            meld_rounded,
            meld_na_bounded,
            sodium,
            is_dialysis,
        )

        return MELDNaResult(
            meld_score=meld_rounded,
            meld_na_score=meld_na_bounded,
            three_month_mortality=risk_info["mortality"],
            risk_category=risk_info["category"],
            bilirubin=bilirubin,
            inr=inr,
            creatinine=creatinine,
            sodium=sodium,
            is_dialysis=is_dialysis,
            transplant_priority=priority,
            recommendations=recommendations,
            clinical_notes=notes,
        )

    def _get_risk_info(self, score: float) -> Dict[str, Any]:
        """Get mortality and risk category for score."""
        for (low, high), info in self.MORTALITY_TABLE.items():
            if low <= score <= high:
                return info
        return {"mortality": 0.713, "category": MELDRiskCategory.CRITICAL}

    def _get_transplant_priority(
        self,
        score: float,
        is_candidate: bool,
    ) -> str:
        """Determine transplant priority status."""
        if not is_candidate:
            return "Not a transplant candidate"

        if score >= 35:
            return "Status 1A/1B - Highest priority"
        elif score >= 30:
            return "High priority - Urgent evaluation"
        elif score >= 20:
            return "Moderate priority - Active listing"
        elif score >= 15:
            return "Standard priority - Transplant evaluation recommended"
        else:
            return "Low priority - Monitor and re-evaluate"

    def _generate_recommendations(
        self,
        score: float,
        category: MELDRiskCategory,
        is_candidate: bool,
        sodium: float,
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        # Score-based recommendations
        if score >= 30:
            recommendations.append("⚠️ CRITICAL - Urgent liver transplant evaluation")
            recommendations.append("Consider ICU monitoring")
        elif score >= 20:
            recommendations.append("High urgency - Complete transplant workup")
            recommendations.append("Monitor for complications (variceal bleeding, encephalopathy)")
        elif score >= 15:
            recommendations.append("Initiate transplant evaluation")
            recommendations.append("Regular monitoring of liver function")

        # Hyponatremia management
        if sodium < 130:
            recommendations.append(f"⚠️ Hyponatremia ({sodium} mEq/L) - Avoid aggressive correction")
            recommendations.append("Restrict free water intake")
            recommendations.append("Consider albumin infusion if refractory ascites")

        if sodium < 125:
            recommendations.append("Severe hyponatremia - Monitor for neurological complications")

        # Transplant status
        if is_candidate and score >= 15:
            recommendations.append("Ensure transplant workup is complete")
            recommendations.append("Update UNOS status if score changes")

        if not is_candidate:
            recommendations.append("Evaluate for transplant eligibility")
            recommendations.append("Consider palliative care consultation if not a candidate")

        return recommendations

    def _generate_clinical_notes(
        self,
        meld: float,
        meld_na: float,
        sodium: float,
        is_dialysis: bool,
    ) -> str:
        """Generate clinical notes for documentation."""
        notes = f"MELD score: {meld:.0f}. MELD-Na score: {meld_na:.1f}. "

        if sodium < 130:
            notes += f"Hyponatremia ({sodium} mEq/L) contributing to elevated MELD-Na. "

        if is_dialysis:
            notes += "Patient on dialysis - creatinine capped at 4.0 mg/dL for MELD calculation. "

        return notes.strip()


# Singleton instance
_meld_na_calculator: Optional[MeldNaCalculator] = None


def get_meld_na_calculator() -> MeldNaCalculator:
    """Get MELD-Na calculator singleton."""
    global _meld_na_calculator
    if _meld_na_calculator is None:
        _meld_na_calculator = MeldNaCalculator()
    return _meld_na_calculator
