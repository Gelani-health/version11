"""
SOFA Score Calculator (Sequential Organ Failure Assessment)
============================================================

Clinical calculator for assessing organ dysfunction in critically ill patients.
Used for sepsis diagnosis and ICU mortality prediction.

Reference: Vincent et al., Intensive Care Med 1996

Components:
1. Respiration (PaO2/FiO2 ratio)
2. Coagulation (Platelet count)
3. Liver (Bilirubin)
4. Cardiovascular (MAP and vasopressors)
5. CNS (Glasgow Coma Scale)
6. Renal (Creatinine or UO)

Interpretation:
- Score 0-1: Normal/mild dysfunction
- Score 2-3: Moderate dysfunction
- Score 4: Severe organ dysfunction
- Total ≥2: Sepsis diagnosis (with infection)
- ΔSOFA ≥2: Septic shock criteria
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class OrganSystem(str, Enum):
    """Organ systems assessed in SOFA score."""
    RESPIRATION = "respiration"
    COAGULATION = "coagulation"
    LIVER = "liver"
    CARDIOVASCULAR = "cardiovascular"
    CNS = "cns"
    RENAL = "renal"


@dataclass
class SOFAComponent:
    """Individual SOFA component score."""
    organ_system: OrganSystem
    score: int
    value: float
    unit: str
    interpretation: str
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "organ_system": self.organ_system.value,
            "score": self.score,
            "value": self.value,
            "unit": self.unit,
            "interpretation": self.interpretation,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class SOFAScoreResult:
    """Complete SOFA score result."""
    total_score: int
    components: List[SOFAComponent]
    has_sepsis: bool = False
    mortality_risk: str = "low"
    interpretation: str = ""
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_score": self.total_score,
            "components": [c.to_dict() for c in self.components],
            "has_sepsis": self.has_sepsis,
            "mortality_risk": self.mortality_risk,
            "interpretation": self.interpretation,
            "recommendations": self.recommendations,
            "timestamp": datetime.utcnow().isoformat(),
        }


class SOFAScoreCalculator:
    """
    SOFA Score Calculator for ICU patients.
    
    Usage:
        calculator = SOFAScoreCalculator()
        result = calculator.calculate(
            pao2=65,  # mmHg
            fio2=0.4,  # Fraction
            platelets=120,  # ×10³/µL
            bilirubin=2.5,  # mg/dL
            map=55,  # mmHg
            gcs=14,
            creatinine=1.8,  # mg/dL
        )
    """

    # Mortality risk based on total SOFA score
    MORTALITY_RANGES = {
        (0, 1): {"risk": "low", "mortality": "<10%", "interpretation": "Normal organ function or minimal dysfunction"},
        (2, 3): {"risk": "low-moderate", "mortality": "10-15%", "interpretation": "Mild organ dysfunction"},
        (4, 5): {"risk": "moderate", "mortality": "15-20%", "interpretation": "Moderate organ dysfunction"},
        (6, 7): {"risk": "moderate-high", "mortality": "20-40%", "interpretation": "Significant organ dysfunction"},
        (8, 9): {"risk": "high", "mortality": "40-60%", "interpretation": "Severe organ dysfunction"},
        (10, 11): {"risk": "very_high", "mortality": "60-80%", "interpretation": "Very severe organ dysfunction"},
        (12, 24): {"risk": "extremely_high", "mortality": ">80%", "interpretation": "Critical organ failure"},
    }

    def calculate(
        self,
        pao2: Optional[float] = None,
        fio2: Optional[float] = None,
        platelets: Optional[float] = None,
        bilirubin: Optional[float] = None,
        map: Optional[float] = None,
        vasopressors: Optional[List[str]] = None,
        gcs: Optional[int] = None,
        creatinine: Optional[float] = None,
        urine_output_24h: Optional[float] = None,
        has_infection: bool = False,
    ) -> SOFAScoreResult:
        """
        Calculate SOFA score from clinical parameters.
        
        Args:
            pao2: Partial pressure of oxygen (mmHg)
            fio2: Fraction of inspired oxygen (0-1 or %)
            platelets: Platelet count (×10³/µL)
            bilirubin: Total bilirubin (mg/dL)
            map: Mean arterial pressure (mmHg)
            vasopressors: List of vasopressors being used
            gcs: Glasgow Coma Scale score (3-15)
            creatinine: Serum creatinine (mg/dL)
            urine_output_24h: 24-hour urine output (mL)
            has_infection: Whether patient has confirmed/suspected infection
        
        Returns:
            SOFAScoreResult with total score and component breakdown
        """
        components = []

        # 1. Respiration (PaO2/FiO2)
        if pao2 is not None and fio2 is not None:
            components.append(self._calculate_respiration(pao2, fio2))

        # 2. Coagulation (Platelets)
        if platelets is not None:
            components.append(self._calculate_coagulation(platelets))

        # 3. Liver (Bilirubin)
        if bilirubin is not None:
            components.append(self._calculate_liver(bilirubin))

        # 4. Cardiovascular (MAP and vasopressors)
        if map is not None or vasopressors:
            components.append(self._calculate_cardiovascular(map, vasopressors or []))

        # 5. CNS (GCS)
        if gcs is not None:
            components.append(self._calculate_cns(gcs))

        # 6. Renal (Creatinine or Urine Output)
        if creatinine is not None or urine_output_24h is not None:
            components.append(self._calculate_renal(creatinine, urine_output_24h))

        total_score = sum(c.score for c in components)

        # Determine mortality risk
        mortality_info = self._get_mortality_risk(total_score)

        # Check for sepsis
        has_sepsis = has_infection and total_score >= 2

        # Generate recommendations
        recommendations = self._generate_recommendations(total_score, components, has_sepsis)

        return SOFAScoreResult(
            total_score=total_score,
            components=components,
            has_sepsis=has_sepsis,
            mortality_risk=mortality_info["risk"],
            interpretation=mortality_info["interpretation"],
            recommendations=recommendations,
        )

    def _calculate_respiration(self, pao2: float, fio2: float) -> SOFAComponent:
        """Calculate respiratory component based on PaO2/FiO2 ratio."""
        # Convert FiO2 from percentage if needed
        if fio2 > 1:
            fio2 = fio2 / 100

        ratio = pao2 / fio2

        if ratio >= 400:
            score, interpretation = 0, "Normal gas exchange"
        elif ratio >= 300:
            score, interpretation = 1, "Mild impairment (Berlin: no ARDS)"
        elif ratio >= 200:
            score, interpretation = 2, "Moderate impairment (Berlin: mild ARDS)"
        elif ratio >= 100:
            score, interpretation = 3, "Severe impairment (Berlin: moderate ARDS)"
        else:
            score, interpretation = 4, "Very severe impairment (Berlin: severe ARDS)"

        return SOFAComponent(
            organ_system=OrganSystem.RESPIRATION,
            score=score,
            value=ratio,
            unit="PaO2/FiO2 ratio",
            interpretation=interpretation,
        )

    def _calculate_coagulation(self, platelets: float) -> SOFAComponent:
        """Calculate coagulation component based on platelet count."""
        if platelets >= 150:
            score, interpretation = 0, "Normal platelet count"
        elif platelets >= 100:
            score, interpretation = 1, "Mild thrombocytopenia"
        elif platelets >= 50:
            score, interpretation = 2, "Moderate thrombocytopenia"
        elif platelets >= 20:
            score, interpretation = 3, "Severe thrombocytopenia - bleeding risk"
        else:
            score, interpretation = 4, "Very severe thrombocytopenia - high bleeding risk"

        return SOFAComponent(
            organ_system=OrganSystem.COAGULATION,
            score=score,
            value=platelets,
            unit="×10³/µL",
            interpretation=interpretation,
        )

    def _calculate_liver(self, bilirubin: float) -> SOFAComponent:
        """Calculate liver component based on bilirubin."""
        if bilirubin < 1.2:
            score, interpretation = 0, "Normal bilirubin"
        elif bilirubin < 2.0:
            score, interpretation = 1, "Mild hyperbilirubinemia"
        elif bilirubin < 6.0:
            score, interpretation = 2, "Moderate hyperbilirubinemia"
        elif bilirubin < 12.0:
            score, interpretation = 3, "Severe hyperbilirubinemia"
        else:
            score, interpretation = 4, "Very severe hyperbilirubinemia - hepatic failure"

        return SOFAComponent(
            organ_system=OrganSystem.LIVER,
            score=score,
            value=bilirubin,
            unit="mg/dL",
            interpretation=interpretation,
        )

    def _calculate_cardiovascular(
        self,
        map_value: Optional[float],
        vasopressors: List[str],
    ) -> SOFAComponent:
        """Calculate cardiovascular component based on MAP and vasopressors."""
        # Normalize vasopressor names
        vasopressors_lower = [v.lower() for v in vasopressors]

        # Check for high-dose vasopressors
        high_dose_vasopressors = any(
            v in vasopressors_lower
            for v in ["norepinephrine", "epinephrine", "dopamine_high", "dobutamine"]
        )
        low_dose_vasopressors = any(
            v in vasopressors_lower
            for v in ["dopamine_low", "dopamine", "dobutamine_low"]
        )

        if high_dose_vasopressors:
            score, interpretation = 4, "Severe cardiovascular dysfunction - high-dose vasopressors"
        elif low_dose_vasopressors or (map_value is not None and map_value < 70):
            score, interpretation = 3, "Cardiovascular dysfunction - vasopressors or hypotension"
        elif map_value is not None and map_value < 70:
            score, interpretation = 1, "Mild hypotension"
        else:
            score, interpretation = 0, "Normal cardiovascular function"

        value = map_value if map_value is not None else 0

        return SOFAComponent(
            organ_system=OrganSystem.CARDIOVASCULAR,
            score=score,
            value=value,
            unit="mmHg",
            interpretation=interpretation,
        )

    def _calculate_cns(self, gcs: int) -> SOFAComponent:
        """Calculate CNS component based on Glasgow Coma Scale."""
        if gcs >= 15:
            score, interpretation = 0, "Normal consciousness"
        elif gcs >= 13:
            score, interpretation = 1, "Mild confusion"
        elif gcs >= 10:
            score, interpretation = 2, "Moderate CNS depression"
        elif gcs >= 6:
            score, interpretation = 3, "Severe CNS depression"
        else:
            score, interpretation = 4, "Coma or deep unconsciousness"

        return SOFAComponent(
            organ_system=OrganSystem.CNS,
            score=score,
            value=gcs,
            unit="GCS",
            interpretation=interpretation,
        )

    def _calculate_renal(
        self,
        creatinine: Optional[float],
        urine_output: Optional[float],
    ) -> SOFAComponent:
        """Calculate renal component based on creatinine or urine output."""
        # Prefer creatinine if available
        if creatinine is not None:
            if creatinine < 1.2:
                score, interpretation = 0, "Normal renal function"
            elif creatinine < 2.0:
                score, interpretation = 1, "Mild kidney injury (AKI Stage 1)"
            elif creatinine < 3.5:
                score, interpretation = 2, "Moderate kidney injury (AKI Stage 2)"
            elif creatinine < 5.0:
                score, interpretation = 3, "Severe kidney injury (AKI Stage 3)"
            else:
                score, interpretation = 4, "Kidney failure"

            return SOFAComponent(
                organ_system=OrganSystem.RENAL,
                score=score,
                value=creatinine,
                unit="mg/dL",
                interpretation=interpretation,
            )

        # Use urine output if creatinine not available
        if urine_output is not None:
            if urine_output >= 500:
                score, interpretation = 0, "Normal urine output"
            elif urine_output >= 200:
                score, interpretation = 3, "Oliguria"
            else:
                score, interpretation = 4, "Anuria"

            return SOFAComponent(
                organ_system=OrganSystem.RENAL,
                score=score,
                value=urine_output,
                unit="mL/24h",
                interpretation=interpretation,
            )

        # Default if no data
        return SOFAComponent(
            organ_system=OrganSystem.RENAL,
            score=0,
            value=0,
            unit="unknown",
            interpretation="Insufficient data",
        )

    def _get_mortality_risk(self, total_score: int) -> Dict[str, str]:
        """Get mortality risk based on total SOFA score."""
        for (low, high), info in self.MORTALITY_RANGES.items():
            if low <= total_score <= high:
                return info
        return {"risk": "unknown", "mortality": "unknown", "interpretation": "Unable to assess"}

    def _generate_recommendations(
        self,
        total_score: int,
        components: List[SOFAComponent],
        has_sepsis: bool,
    ) -> List[str]:
        """Generate clinical recommendations based on SOFA score."""
        recommendations = []

        if has_sepsis:
            recommendations.append("⚠️ SEPSIS DIAGNOSED - Initiate sepsis bundle immediately")
            recommendations.append("• Blood cultures before antibiotics")
            recommendations.append("• Broad-spectrum antibiotics within 1 hour")
            recommendations.append("• Lactate level measurement")
            recommendations.append("• 30 mL/kg crystalloid for hypotension or lactate ≥4")

        if total_score >= 2:
            recommendations.append("ICU monitoring recommended")

        # Organ-specific recommendations
        for component in components:
            if component.score >= 3:
                if component.organ_system == OrganSystem.RESPIRATION:
                    recommendations.append("Respiratory: Consider mechanical ventilation, optimize PEEP")
                elif component.organ_system == OrganSystem.COAGULATION:
                    recommendations.append("Coagulation: Consider platelet transfusion, evaluate for DIC")
                elif component.organ_system == OrganSystem.LIVER:
                    recommendations.append("Liver: Evaluate for hepatic failure, consider hepatology consult")
                elif component.organ_system == OrganSystem.CARDIOVASCULAR:
                    recommendations.append("Cardiovascular: Hemodynamic monitoring, vasopressor support")
                elif component.organ_system == OrganSystem.CNS:
                    recommendations.append("CNS: Neurologic evaluation, consider CT head")
                elif component.organ_system == OrganSystem.RENAL:
                    recommendations.append("Renal: Consider renal replacement therapy (CRRT)")

        if total_score >= 10:
            recommendations.append("⚠️ HIGH MORTALITY RISK - Consider goals of care discussion")

        return recommendations


# Singleton instance
_sofa_calculator: Optional[SOFAScoreCalculator] = None


def get_sofa_calculator() -> SOFAScoreCalculator:
    """Get SOFA calculator singleton."""
    global _sofa_calculator
    if _sofa_calculator is None:
        _sofa_calculator = SOFAScoreCalculator()
    return _sofa_calculator
