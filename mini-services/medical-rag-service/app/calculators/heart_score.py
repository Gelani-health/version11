"""
HEART Score Calculator
======================

Clinical risk stratification tool for patients with chest pain in the ED.
Predicts 6-week risk of major adverse cardiac events (MACE).

Reference: Six et al., Int J Cardiol 2008

Components:
H - History (0-2 points)
E - ECG (0-2 points)
A - Age (0-2 points)
R - Risk factors (0-2 points)
T - Troponin (0-2 points)

Total Score: 0-10

Risk Categories:
- 0-3: Low risk (0.9-1.7% MACE) - Consider discharge
- 4-6: Moderate risk (12-16.6% MACE) - Admit for observation
- 7-10: High risk (50-65% MACE) - Admit, aggressive management
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class RiskCategory(str, Enum):
    """HEART score risk categories."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


@dataclass
class HEARTComponent:
    """Individual HEART component score."""
    component: str
    score: int
    max_score: int
    value: Any
    interpretation: str
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "component": self.component,
            "score": self.score,
            "max_score": self.max_score,
            "value": str(self.value),
            "interpretation": self.interpretation,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class HEARTScoreResult:
    """Complete HEART score result."""
    total_score: int
    components: List[HEARTComponent]
    risk_category: RiskCategory
    mace_probability: str
    interpretation: str
    recommendations: List[str] = field(default_factory=list)
    disposition: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_score": self.total_score,
            "components": [c.to_dict() for c in self.components],
            "risk_category": self.risk_category.value,
            "mace_probability": self.mace_probability,
            "interpretation": self.interpretation,
            "recommendations": self.recommendations,
            "disposition": self.disposition,
            "timestamp": datetime.utcnow().isoformat(),
        }


class HEARTScoreCalculator:
    """
    HEART Score Calculator for chest pain risk stratification.
    
    Usage:
        calculator = HEARTScoreCalculator()
        result = calculator.calculate(
            history="suspicious",  # typical, suspicious, non-specific
            ecg_findings="st_depression",  # normal, nonspecific, significant
            age=65,
            risk_factors=["diabetes", "hypertension", "smoking"],
            troponin_level=0.08,  # ng/mL
            troponin_upper_limit=0.04,  # ng/mL
        )
    """

    # MACE probability by score
    MACE_PROBABILITY = {
        (0, 3): "0.9-1.7%",
        4: "12%",
        5: "16.6%",
        6: "27%",
        7: "50%",
        8: "65%",
        9: "78%",
        10: "96%",
    }

    def calculate(
        self,
        history: str,
        ecg_findings: str,
        age: int,
        risk_factors: List[str],
        troponin_level: Optional[float] = None,
        troponin_upper_limit: float = 0.04,  # ng/mL
        troponin_units: str = "ng/mL",
    ) -> HEARTScoreResult:
        """
        Calculate HEART score from clinical parameters.
        
        Args:
            history: History description ('typical', 'suspicious', 'non_specific')
            ecg_findings: ECG result ('normal', 'nonspecific', 'significant')
            age: Patient age in years
            risk_factors: List of risk factors
            troponin_level: Troponin level value
            troponin_upper_limit: Upper limit of normal for troponin assay
            troponin_units: Units for troponin level
        
        Returns:
            HEARTScoreResult with total score and recommendations
        """
        components = []

        # H - History
        components.append(self._calculate_history(history))

        # E - ECG
        components.append(self._calculate_ecg(ecg_findings))

        # A - Age
        components.append(self._calculate_age(age))

        # R - Risk factors
        components.append(self._calculate_risk_factors(risk_factors))

        # T - Troponin
        components.append(
            self._calculate_troponin(troponin_level, troponin_upper_limit)
        )

        total_score = sum(c.score for c in components)

        # Determine risk category
        risk_category, mace_prob = self._get_risk_category(total_score)

        # Generate interpretation and recommendations
        interpretation = self._get_interpretation(total_score, risk_category)
        recommendations = self._generate_recommendations(total_score, risk_category)
        disposition = self._get_disposition(risk_category)

        return HEARTScoreResult(
            total_score=total_score,
            components=components,
            risk_category=risk_category,
            mace_probability=mace_prob,
            interpretation=interpretation,
            recommendations=recommendations,
            disposition=disposition,
        )

    def _calculate_history(self, history: str) -> HEARTComponent:
        """Calculate history component."""
        history_lower = history.lower()

        if history_lower in ["typical", "classic", "highly_suspicious"]:
            score, interpretation = 2, "Highly suspicious for ACS"
        elif history_lower in ["suspicious", "moderately_suspicious", "atypical"]:
            score, interpretation = 1, "Moderately suspicious for ACS"
        else:  # non_specific, low_suspicious, non_cardiac
            score, interpretation = 0, "Low suspicion for ACS"

        return HEARTComponent(
            component="History",
            score=score,
            max_score=2,
            value=history,
            interpretation=interpretation,
        )

    def _calculate_ecg(self, ecg_findings: str) -> HEARTComponent:
        """Calculate ECG component."""
        ecg_lower = ecg_findings.lower()

        if ecg_lower in ["significant", "st_elevation", "st_depression", "lbbb_new", "twave_inversion"]:
            score, interpretation = 2, "Significant ST/T changes suggesting ischemia"
        elif ecg_lower in ["nonspecific", "minor_abnormality", "lbbb_old"]:
            score, interpretation = 1, "Nonspecific or minor abnormalities"
        else:  # normal
            score, interpretation = 0, "Normal ECG"

        return HEARTComponent(
            component="ECG",
            score=score,
            max_score=2,
            value=ecg_findings,
            interpretation=interpretation,
        )

    def _calculate_age(self, age: int) -> HEARTComponent:
        """Calculate age component."""
        if age >= 65:
            score, interpretation = 2, f"Age {age}: High risk age group"
        elif age >= 45:
            score, interpretation = 1, f"Age {age}: Moderate risk age group"
        else:
            score, interpretation = 0, f"Age {age}: Low risk age group"

        return HEARTComponent(
            component="Age",
            score=score,
            max_score=2,
            value=age,
            interpretation=interpretation,
        )

    def _calculate_risk_factors(self, risk_factors: List[str]) -> HEARTComponent:
        """Calculate risk factors component."""
        # Count traditional cardiac risk factors
        traditional_factors = {
            "diabetes", "dm", "hypertension", "htn", "hyperlipidemia",
            "hld", "smoking", "smoker", "obesity", "family_history",
            "premature_cad", "known_cad", "prior_mi", "prior_pci", "prior_cabg",
        }

        count = sum(
            1 for rf in risk_factors
            if rf.lower() in traditional_factors
        )

        if count >= 3 or "known_cad" in [rf.lower() for rf in risk_factors]:
            score, interpretation = 2, f"{count} risk factors or known CAD: High risk"
        elif count == 1 or count == 2:
            score, interpretation = 1, f"{count} risk factors: Moderate risk"
        else:
            score, interpretation = 0, "No risk factors: Low risk"

        return HEARTComponent(
            component="Risk Factors",
            score=score,
            max_score=2,
            value=", ".join(risk_factors) if risk_factors else "None",
            interpretation=interpretation,
        )

    def _calculate_troponin(
        self,
        troponin_level: Optional[float],
        upper_limit: float,
    ) -> HEARTComponent:
        """Calculate troponin component."""
        if troponin_level is None:
            return HEARTComponent(
                component="Troponin",
                score=0,
                max_score=2,
                value="Not available",
                interpretation="Troponin result pending",
            )

        # Calculate multiples of upper limit
        ratio = troponin_level / upper_limit

        if ratio >= 3:  # ≥3x upper limit
            score, interpretation = 2, f"Elevated ({troponin_level:.2f} ng/mL): Strongly positive"
        elif ratio > 1:  # 1-3x upper limit
            score, interpretation = 1, f"Mildly elevated ({troponin_level:.2f} ng/mL): Borderline"
        else:
            score, interpretation = 0, f"Normal ({troponin_level:.2f} ng/mL): Negative"

        return HEARTComponent(
            component="Troponin",
            score=score,
            max_score=2,
            value=f"{troponin_level} ng/mL",
            interpretation=interpretation,
        )

    def _get_risk_category(self, total_score: int) -> tuple:
        """Determine risk category based on total score."""
        if total_score <= 3:
            return RiskCategory.LOW, "0.9-1.7%"
        elif total_score <= 6:
            mace = self.MACE_PROBABILITY.get(total_score, "12-27%")
            return RiskCategory.MODERATE, mace
        else:
            mace = self.MACE_PROBABILITY.get(total_score, "50-96%")
            return RiskCategory.HIGH, mace

    def _get_interpretation(self, total_score: int, risk_category: RiskCategory) -> str:
        """Generate interpretation based on score."""
        if risk_category == RiskCategory.LOW:
            return (
                f"HEART Score {total_score}/10: LOW RISK. "
                "Low probability of ACS. MACE risk 0.9-1.7% at 6 weeks. "
                "Consider early discharge with outpatient follow-up."
            )
        elif risk_category == RiskCategory.MODERATE:
            return (
                f"HEART Score {total_score}/10: MODERATE RISK. "
                "Intermediate probability of ACS. Requires observation and further evaluation. "
                "Consider cardiac imaging and serial troponins."
            )
        else:
            return (
                f"HEART Score {total_score}/10: HIGH RISK. "
                "High probability of ACS. Requires immediate intervention. "
                "Strongly consider cardiac catheterization."
            )

    def _generate_recommendations(
        self,
        total_score: int,
        risk_category: RiskCategory,
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        if risk_category == RiskCategory.LOW:
            recommendations.append("✓ Consider discharge with outpatient follow-up")
            recommendations.append("✓ Stress testing can be performed as outpatient")
            recommendations.append("✓ Patient education on warning signs")
            recommendations.append("✓ Follow-up with cardiology within 72 hours")

        elif risk_category == RiskCategory.MODERATE:
            recommendations.append("⚠ Admit to observation unit")
            recommendations.append("⚠ Serial troponins (0, 3, 6 hours)")
            recommendations.append("⚠ Continuous cardiac monitoring")
            recommendations.append("⚠ Consider cardiac imaging:")
            recommendations.append("   - Stress test if troponin negative")
            recommendations.append("   - Coronary CTA if low-intermediate risk")
            recommendations.append("   - Echocardiography for wall motion")

        else:  # HIGH risk
            recommendations.append("🚨 URGENT: Admit to cardiac care unit")
            recommendations.append("🚨 Immediate cardiology consultation")
            recommendations.append("🚨 Consider early invasive strategy")
            recommendations.append("🚨 Dual antiplatelet therapy (if no contraindication)")
            recommendations.append("🚨 Anticoagulation per protocol")
            recommendations.append("🚨 Prepare for possible cardiac catheterization")

        return recommendations

    def _get_disposition(self, risk_category: RiskCategory) -> str:
        """Determine recommended disposition."""
        if risk_category == RiskCategory.LOW:
            return "Consider discharge with outpatient follow-up"
        elif risk_category == RiskCategory.MODERATE:
            return "Admit for observation and evaluation"
        else:
            return "Admit to CCU/ICU for aggressive management"


# Singleton instance
_heart_calculator: Optional[HEARTScoreCalculator] = None


def get_heart_calculator() -> HEARTScoreCalculator:
    """Get HEART calculator singleton."""
    global _heart_calculator
    if _heart_calculator is None:
        _heart_calculator = HEARTScoreCalculator()
    return _heart_calculator
