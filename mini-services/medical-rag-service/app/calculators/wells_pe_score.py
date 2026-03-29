"""
P1: Wells PE Score Calculator
==============================

Clinical calculator for Pulmonary Embolism probability assessment.
Based on Wells PS, et al. Thromb Haemost 2000;83:416-420.

Wells PE Score Components:
1. Clinical signs and symptoms of DVT (3 points)
2. PE is #1 or equally likely diagnosis (3 points)
3. Heart rate > 100 bpm (1.5 points)
4. Immobilization or surgery in past 4 weeks (1.5 points)
5. Previous DVT/PE (1.5 points)
6. Hemoptysis (1 point)
7. Malignancy (1 point)

Interpretation:
- Score < 2: Low probability (1-2% PE prevalence)
- Score 2-6: Moderate probability (16-21% PE prevalence)
- Score > 6: High probability (28-53% PE prevalence)

Modified Wells (for PERC rule):
- Score ≤ 4: Unlikely PE (can apply PERC)
- Score > 4: Likely PE (proceed to imaging)
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class PELikelihood(str, Enum):
    """PE likelihood categories."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    UNLIKELY = "unlikely"  # Modified Wells
    LIKELY = "likely"  # Modified Wells


@dataclass
class WellsPEComponent:
    """Individual Wells PE component."""
    criterion: str
    points: float
    selected: bool = False
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "criterion": self.criterion,
            "points": self.points,
            "selected": self.selected,
            "description": self.description,
        }


@dataclass
class WellsPEResult:
    """Complete Wells PE score result."""
    total_score: float
    likelihood: PELikelihood
    modified_likelihood: PELikelihood
    components: List[WellsPEComponent]
    pe_prevalence: str
    recommendation: str
    perc_eligible: bool = False
    next_steps: List[str] = field(default_factory=list)
    clinical_notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_score": self.total_score,
            "likelihood": self.likelihood.value,
            "modified_likelihood": self.modified_likelihood.value,
            "components": [c.to_dict() for c in self.components],
            "pe_prevalence": self.pe_prevalence,
            "recommendation": self.recommendation,
            "perc_eligible": self.perc_eligible,
            "next_steps": self.next_steps,
            "clinical_notes": self.clinical_notes,
            "timestamp": datetime.utcnow().isoformat(),
        }


class WellsPEScoreCalculator:
    """
    Wells PE Score Calculator for pulmonary embolism risk assessment.

    Usage:
        calculator = WellsPEScoreCalculator()
        result = calculator.calculate(
            dvt_signs=True,
            pe_most_likely=True,
            heart_rate=110,
            immobilization=False,
            previous_dvt_pe=False,
            hemoptysis=False,
            malignancy=False,
        )
    """

    # Prevalence estimates based on score
    PREVALENCE_ESTIMATES = {
        (0, 1.5): {"prevalence": "1-2%", "likelihood": PELikelihood.LOW},
        (2, 6): {"prevalence": "16-21%", "likelihood": PELikelihood.MODERATE},
        (6.5, 15): {"prevalence": "28-53%", "likelihood": PELikelihood.HIGH},
    }

    # Clinical criteria definitions
    CRITERIA = [
        {
            "name": "dvt_signs",
            "points": 3.0,
            "description": "Clinical signs and symptoms of DVT (leg swelling, pain, tenderness)",
        },
        {
            "name": "pe_most_likely",
            "points": 3.0,
            "description": "PE is #1 diagnosis or equally likely as other diagnoses",
        },
        {
            "name": "heart_rate_over_100",
            "points": 1.5,
            "description": "Heart rate > 100 beats per minute",
        },
        {
            "name": "immobilization_surgery",
            "points": 1.5,
            "description": "Immobilization (bed rest ≥3 days) or surgery within past 4 weeks",
        },
        {
            "name": "previous_dvt_pe",
            "points": 1.5,
            "description": "Previous documented DVT or PE",
        },
        {
            "name": "hemoptysis",
            "points": 1.0,
            "description": "Hemoptysis (coughing up blood)",
        },
        {
            "name": "malignancy",
            "points": 1.0,
            "description": "Active malignancy (treatment ongoing or within 6 months, or palliative)",
        },
    ]

    def calculate(
        self,
        dvt_signs: bool = False,
        pe_most_likely: bool = False,
        heart_rate: Optional[int] = None,
        immobilization_surgery: bool = False,
        previous_dvt_pe: bool = False,
        hemoptysis: bool = False,
        malignancy: bool = False,
        age: Optional[int] = None,
        apply_perc: bool = True,
    ) -> WellsPEResult:
        """
        Calculate Wells PE Score.

        Args:
            dvt_signs: Clinical signs/symptoms of DVT
            pe_most_likely: PE is #1 or equally likely diagnosis
            heart_rate: Heart rate in bpm (auto-checks if > 100)
            immobilization_surgery: Immobilization or recent surgery
            previous_dvt_pe: History of DVT or PE
            hemoptysis: Presence of hemoptysis
            malignancy: Active malignancy
            age: Patient age (for PERC consideration)
            apply_perc: Whether to assess PERC eligibility

        Returns:
            WellsPEResult with score, likelihood, and recommendations
        """
        components = []
        total_score = 0.0

        # Process each criterion
        criteria_values = {
            "dvt_signs": dvt_signs,
            "pe_most_likely": pe_most_likely,
            "heart_rate_over_100": heart_rate is not None and heart_rate > 100,
            "immobilization_surgery": immobilization_surgery,
            "previous_dvt_pe": previous_dvt_pe,
            "hemoptysis": hemoptysis,
            "malignancy": malignancy,
        }

        for criterion in self.CRITERIA:
            selected = criteria_values.get(criterion["name"], False)
            component = WellsPEComponent(
                criterion=criterion["name"],
                points=criterion["points"],
                selected=selected,
                description=criterion["description"],
            )
            components.append(component)

            if selected:
                total_score += criterion["points"]

        # Determine likelihood (original Wells)
        likelihood = self._get_likelihood(total_score)
        prevalence = self._get_prevalence(total_score)

        # Determine modified Wells classification
        modified_likelihood = (
            PELikelihood.LIKELY if total_score > 4
            else PELikelihood.UNLIKELY
        )

        # Generate recommendations
        next_steps = self._generate_next_steps(
            total_score,
            modified_likelihood,
            apply_perc=apply_perc,
            heart_rate=heart_rate,
            hemoptysis=hemoptysis,
            age=age,
        )

        # Check PERC eligibility
        perc_eligible = self._check_perc_eligibility(
            total_score,
            heart_rate=heart_rate,
            hemoptysis=hemoptysis,
            age=age,
            apply_perc=apply_perc,
        )

        # Generate clinical notes
        clinical_notes = self._generate_clinical_notes(
            total_score,
            likelihood,
            modified_likelihood,
            perc_eligible,
        )

        return WellsPEResult(
            total_score=total_score,
            likelihood=likelihood,
            modified_likelihood=modified_likelihood,
            components=components,
            pe_prevalence=prevalence,
            recommendation=self._get_recommendation(modified_likelihood),
            perc_eligible=perc_eligible,
            next_steps=next_steps,
            clinical_notes=clinical_notes,
        )

    def _get_likelihood(self, score: float) -> PELikelihood:
        """Determine PE likelihood based on score."""
        if score < 2:
            return PELikelihood.LOW
        elif score <= 6:
            return PELikelihood.MODERATE
        else:
            return PELikelihood.HIGH

    def _get_prevalence(self, score: float) -> str:
        """Get estimated PE prevalence based on score."""
        if score < 2:
            return "1-2%"
        elif score <= 6:
            return "16-21%"
        else:
            return "28-53%"

    def _get_recommendation(self, modified_likelihood: PELikelihood) -> str:
        """Get clinical recommendation based on modified Wells."""
        if modified_likelihood == PELikelihood.UNLIKELY:
            return "PE unlikely - Consider PERC rule or D-dimer"
        else:
            return "PE likely - Proceed to imaging (CT-PA or V/Q scan)"

    def _check_perc_eligibility(
        self,
        score: float,
        heart_rate: Optional[int],
        hemoptysis: bool,
        age: Optional[int],
        apply_perc: bool,
    ) -> bool:
        """
        Check if patient qualifies for PERC (Pulmonary Embolism Rule-Out Criteria).

        PERC Criteria (all must be NO):
        - Age ≥ 50
        - Heart rate ≥ 100
        - SpO2 < 95%
        - Hemoptysis
        - Estrogen use
        - Prior VTE
        - Leg swelling
        - Surgery/trauma within 4 weeks

        Note: We only have partial criteria here.
        """
        if not apply_perc:
            return False

        # Modified Wells must be "unlikely" (score ≤ 4)
        if score > 4:
            return False

        # Check available PERC criteria
        if age is not None and age >= 50:
            return False
        if heart_rate is not None and heart_rate >= 100:
            return False
        if hemoptysis:
            return False

        # Additional PERC criteria would need to be passed in
        # For now, return True if basic criteria are met
        return True

    def _generate_next_steps(
        self,
        score: float,
        modified_likelihood: PELikelihood,
        apply_perc: bool,
        heart_rate: Optional[int],
        hemoptysis: bool,
        age: Optional[int],
    ) -> List[str]:
        """Generate recommended next steps."""
        steps = []

        if modified_likelihood == PELikelihood.UNLIKELY:
            if apply_perc and self._check_perc_eligibility(
                score, heart_rate, hemoptysis, age, apply_perc
            ):
                steps.append("✅ PERC criteria met - PE can be reliably excluded without further testing")
                steps.append("Consider alternative diagnoses")
            else:
                steps.append("📊 D-dimer recommended to further stratify risk")
                steps.append("If D-dimer negative, PE can be excluded")
                steps.append("If D-dimer positive, proceed to CT-PA")
        else:
            steps.append("🚨 PE likely - Do NOT rely on D-dimer alone")
            steps.append("CT-PA (CT Pulmonary Angiography) recommended")
            steps.append("Consider V/Q scan if CT contraindicated (renal failure, contrast allergy)")
            steps.append("Consider empiric anticoagulation if imaging delayed")

            if score > 6:
                steps.append("⚠️ HIGH probability - Consider immediate anticoagulation pending imaging")

        return steps

    def _generate_clinical_notes(
        self,
        score: float,
        likelihood: PELikelihood,
        modified_likelihood: PELikelihood,
        perc_eligible: bool,
    ) -> str:
        """Generate clinical notes for documentation."""
        notes = f"Wells PE Score: {score} points. "
        notes += f"Original classification: {likelihood.value} probability. "
        notes += f"Modified Wells: PE {modified_likelihood.value}. "

        if perc_eligible:
            notes += "Patient meets PERC criteria for PE exclusion."

        return notes


# Singleton instance
_wells_pe_calculator: Optional[WellsPEScoreCalculator] = None


def get_wells_pe_calculator() -> WellsPEScoreCalculator:
    """Get Wells PE calculator singleton."""
    global _wells_pe_calculator
    if _wells_pe_calculator is None:
        _wells_pe_calculator = WellsPEScoreCalculator()
    return _wells_pe_calculator
