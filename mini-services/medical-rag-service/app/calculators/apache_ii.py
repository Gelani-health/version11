"""
P1: APACHE II Score Calculator
===============================

Acute Physiology and Chronic Health Evaluation II (APACHE II)
Mortality prediction for ICU patients.

Reference: Knaus WA, et al. Crit Care Med 1985;13:818-829.

Components:
1. Acute Physiology Score (APS) - 12 variables
   - Temperature
   - Mean Arterial Pressure
   - Heart Rate
   - Respiratory Rate
   - Oxygenation (A-aDO2 or PaO2)
   - Arterial pH
   - Serum Sodium
   - Serum Potassium
   - Serum Creatinine
   - Hematocrit
   - White Blood Cell Count
   - Glasgow Coma Scale

2. Age Points (0-6)

3. Chronic Health Points (0-5)

Interpretation:
- Score 0-4: ~4% mortality
- Score 5-9: ~8% mortality
- Score 10-14: ~15% mortality
- Score 15-19: ~25% mortality
- Score 20-24: ~40% mortality
- Score 25-29: ~55% mortality
- Score 30-34: ~73% mortality
- Score ≥35: ~85% mortality
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from datetime import datetime
import math


class ChronicHealthCondition(str, Enum):
    """Chronic health conditions for APACHE II."""
    NONE = "none"
    LIVER = "liver"  # Cirrhosis, portal hypertension
    CARDIOVASCULAR = "cardiovascular"  # NYHA Class IV
    RESPIRATORY = "respiratory"  # Severe COPD, home oxygen
    RENAL = "renal"  # Dialysis-dependent
    IMMUNE = "immune"  # Immunocompromised


@dataclass
class APACHEComponent:
    """Individual APACHE II component."""
    name: str
    value: float
    unit: str
    points: int
    normal_range: str
    interpretation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "points": self.points,
            "normal_range": self.normal_range,
            "interpretation": self.interpretation,
        }


@dataclass
class APACHEIIResult:
    """Complete APACHE II score result."""
    total_score: int
    acute_physiology_score: int
    age_points: int
    chronic_health_points: int
    predicted_mortality: float
    mortality_range: str
    components: List[APACHEComponent]
    icu_mortality_risk: str
    hospital_mortality_risk: str
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_score": self.total_score,
            "acute_physiology_score": self.acute_physiology_score,
            "age_points": self.age_points,
            "chronic_health_points": self.chronic_health_points,
            "predicted_mortality": f"{self.predicted_mortality:.1%}",
            "mortality_range": self.mortality_range,
            "components": [c.to_dict() for c in self.components],
            "icu_mortality_risk": self.icu_mortality_risk,
            "hospital_mortality_risk": self.hospital_mortality_risk,
            "recommendations": self.recommendations,
            "timestamp": datetime.utcnow().isoformat(),
        }


class ApacheIICalculator:
    """
    APACHE II Score Calculator for ICU mortality prediction.

    Usage:
        calculator = ApacheIICalculator()
        result = calculator.calculate(
            temperature=38.5,
            mean_arterial_pressure=65,
            heart_rate=110,
            respiratory_rate=25,
            fio2=0.6,
            pao2=60,
            ph=7.32,
            sodium=138,
            potassium=4.0,
            creatinine=1.5,
            hematocrit=35,
            wbc=15.0,
            gcs=12,
            age=65,
            chronic_health="liver",
        )
    """

    # Mortality rates by APACHE II score (ICU mortality)
    MORTALITY_TABLE = {
        (0, 4): {"mortality": 0.04, "range": "1-5%"},
        (5, 9): {"mortality": 0.08, "range": "5-12%"},
        (10, 14): {"mortality": 0.15, "range": "12-20%"},
        (15, 19): {"mortality": 0.25, "range": "20-32%"},
        (20, 24): {"mortality": 0.40, "range": "32-50%"},
        (25, 29): {"mortality": 0.55, "range": "50-65%"},
        (30, 34): {"mortality": 0.73, "range": "65-80%"},
        (35, 71): {"mortality": 0.85, "range": "80-95%"},
    }

    def calculate(
        self,
        temperature: Optional[float] = None,  # Celsius
        mean_arterial_pressure: Optional[float] = None,  # mmHg
        heart_rate: Optional[float] = None,  # bpm
        respiratory_rate: Optional[float] = None,  # breaths/min
        fio2: Optional[float] = None,  # Fraction (0-1)
        pao2: Optional[float] = None,  # mmHg
        paco2: Optional[float] = None,  # mmHg
        ph: Optional[float] = None,
        sodium: Optional[float] = None,  # mEq/L
        potassium: Optional[float] = None,  # mEq/L
        creatinine: Optional[float] = None,  # mg/dL
        hematocrit: Optional[float] = None,  # %
        wbc: Optional[float] = None,  # ×10³/µL
        gcs: Optional[int] = None,  # Glasgow Coma Scale
        age: Optional[int] = None,
        chronic_health: str = "none",
        acute_renal_failure: bool = False,
    ) -> APACHEIIResult:
        """
        Calculate APACHE II score.

        Args:
            temperature: Core temperature (°C)
            mean_arterial_pressure: MAP (mmHg)
            heart_rate: Heart rate (bpm)
            respiratory_rate: Respiratory rate (/min)
            fio2: Fraction of inspired oxygen (0-1)
            pao2: Partial pressure of oxygen (mmHg)
            paco2: Partial pressure of CO2 (mmHg)
            ph: Arterial pH
            sodium: Serum sodium (mEq/L)
            potassium: Serum potassium (mEq/L)
            creatinine: Serum creatinine (mg/dL)
            hematocrit: Hematocrit (%)
            wbc: White blood cell count (×10³/µL)
            gcs: Glasgow Coma Scale (3-15)
            age: Age in years
            chronic_health: Chronic health condition
            acute_renal_failure: Acute renal failure flag (affects creatinine scoring)

        Returns:
            APACHEIIResult with score and mortality prediction
        """
        components = []
        aps_score = 0

        # 1. Temperature
        if temperature is not None:
            temp_comp = self._score_temperature(temperature)
            components.append(temp_comp)
            aps_score += temp_comp.points

        # 2. Mean Arterial Pressure
        if mean_arterial_pressure is not None:
            map_comp = self._score_map(mean_arterial_pressure)
            components.append(map_comp)
            aps_score += map_comp.points

        # 3. Heart Rate
        if heart_rate is not None:
            hr_comp = self._score_heart_rate(heart_rate)
            components.append(hr_comp)
            aps_score += hr_comp.points

        # 4. Respiratory Rate
        if respiratory_rate is not None:
            rr_comp = self._score_respiratory_rate(respiratory_rate)
            components.append(rr_comp)
            aps_score += rr_comp.points

        # 5. Oxygenation
        if fio2 is not None and pao2 is not None:
            o2_comp = self._score_oxygenation(fio2, pao2)
            components.append(o2_comp)
            aps_score += o2_comp.points

        # 6. Arterial pH
        if ph is not None:
            ph_comp = self._score_ph(ph)
            components.append(ph_comp)
            aps_score += ph_comp.points

        # 7. Serum Sodium
        if sodium is not None:
            na_comp = self._score_sodium(sodium)
            components.append(na_comp)
            aps_score += na_comp.points

        # 8. Serum Potassium
        if potassium is not None:
            k_comp = self._score_potassium(potassium)
            components.append(k_comp)
            aps_score += k_comp.points

        # 9. Serum Creatinine
        if creatinine is not None:
            cr_comp = self._score_creatinine(creatinine, acute_renal_failure)
            components.append(cr_comp)
            aps_score += cr_comp.points

        # 10. Hematocrit
        if hematocrit is not None:
            hct_comp = self._score_hematocrit(hematocrit)
            components.append(hct_comp)
            aps_score += hct_comp.points

        # 11. White Blood Cell Count
        if wbc is not None:
            wbc_comp = self._score_wbc(wbc)
            components.append(wbc_comp)
            aps_score += wbc_comp.points

        # 12. Glasgow Coma Scale
        if gcs is not None:
            gcs_comp = self._score_gcs(gcs)
            components.append(gcs_comp)
            aps_score += gcs_comp.points

        # Age Points
        age_points = self._score_age(age) if age is not None else 0

        # Chronic Health Points
        chronic_points = self._score_chronic_health(chronic_health)

        # Total Score
        total_score = aps_score + age_points + chronic_points

        # Get mortality prediction
        mortality_info = self._get_mortality(total_score)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            total_score, chronic_health
        )

        return APACHEIIResult(
            total_score=total_score,
            acute_physiology_score=aps_score,
            age_points=age_points,
            chronic_health_points=chronic_points,
            predicted_mortality=mortality_info["mortality"],
            mortality_range=mortality_info["range"],
            components=components,
            icu_mortality_risk=mortality_info["range"],
            hospital_mortality_risk=f"{min(mortality_info['mortality'] + 0.1, 0.99):.0%}",
            recommendations=recommendations,
        )

    def _score_temperature(self, temp: float) -> APACHEComponent:
        """Score temperature (°C)."""
        if temp >= 41:
            points, interp = 4, "Severe hyperthermia"
        elif temp >= 39:
            points, interp = 3, "Moderate hyperthermia"
        elif temp >= 38.5:
            points, interp = 1, "Mild hyperthermia"
        elif temp >= 36:
            points, interp = 0, "Normal"
        elif temp >= 34:
            points, interp = 1, "Mild hypothermia"
        elif temp >= 32:
            points, interp = 2, "Moderate hypothermia"
        elif temp >= 30:
            points, interp = 3, "Severe hypothermia"
        else:
            points, interp = 4, "Profound hypothermia"

        return APACHEComponent(
            name="Temperature",
            value=temp,
            unit="°C",
            points=points,
            normal_range="36-38.4",
            interpretation=interp,
        )

    def _score_map(self, map_val: float) -> APACHEComponent:
        """Score Mean Arterial Pressure (mmHg)."""
        if map_val >= 160:
            points, interp = 4, "Severe hypertension"
        elif map_val >= 130:
            points, interp = 3, "Moderate hypertension"
        elif map_val >= 110:
            points, interp = 2, "Mild hypertension"
        elif map_val >= 70:
            points, interp = 0, "Normal"
        elif map_val >= 50:
            points, interp = 2, "Mild hypotension"
        elif map_val >= 40:
            points, interp = 3, "Moderate hypotension"
        else:
            points, interp = 4, "Severe hypotension"

        return APACHEComponent(
            name="Mean Arterial Pressure",
            value=map_val,
            unit="mmHg",
            points=points,
            normal_range="70-109",
            interpretation=interp,
        )

    def _score_heart_rate(self, hr: float) -> APACHEComponent:
        """Score heart rate (bpm)."""
        if hr >= 180:
            points, interp = 4, "Severe tachycardia"
        elif hr >= 140:
            points, interp = 3, "Moderate tachycardia"
        elif hr >= 110:
            points, interp = 2, "Mild tachycardia"
        elif hr >= 70:
            points, interp = 0, "Normal"
        elif hr >= 55:
            points, interp = 2, "Mild bradycardia"
        elif hr >= 40:
            points, interp = 3, "Moderate bradycardia"
        else:
            points, interp = 4, "Severe bradycardia"

        return APACHEComponent(
            name="Heart Rate",
            value=hr,
            unit="bpm",
            points=points,
            normal_range="70-109",
            interpretation=interp,
        )

    def _score_respiratory_rate(self, rr: float) -> APACHEComponent:
        """Score respiratory rate (/min)."""
        if rr >= 50:
            points, interp = 4, "Severe tachypnea"
        elif rr >= 35:
            points, interp = 3, "Moderate tachypnea"
        elif rr >= 25:
            points, interp = 1, "Mild tachypnea"
        elif rr >= 12:
            points, interp = 0, "Normal"
        elif rr >= 10:
            points, interp = 1, "Mild bradypnea"
        elif rr >= 6:
            points, interp = 2, "Moderate bradypnea"
        else:
            points, interp = 4, "Severe bradypnea/apnea"

        return APACHEComponent(
            name="Respiratory Rate",
            value=rr,
            unit="/min",
            points=points,
            normal_range="12-24",
            interpretation=interp,
        )

    def _score_oxygenation(self, fio2: float, pao2: float) -> APACHEComponent:
        """Score oxygenation based on A-aDO2 or PaO2."""
        if fio2 >= 0.5:
            # Calculate A-aDO2
            # A-aDO2 = (FiO2 × 713) - (PaCO2 / 0.8) - PaO2
            # Simplified: Use PaO2/FiO2 ratio approximation
            aado2 = (fio2 * 713) - pao2  # Simplified

            if aado2 >= 500:
                points, interp = 4, "Severe gas exchange impairment"
            elif aado2 >= 350:
                points, interp = 3, "Moderate gas exchange impairment"
            elif aado2 >= 200:
                points, interp = 2, "Mild gas exchange impairment"
            else:
                points, interp = 0, "Normal gas exchange"

            return APACHEComponent(
                name="A-aDO2",
                value=aado2,
                unit="mmHg",
                points=points,
                normal_range="<200",
                interpretation=interp,
            )
        else:
            # Use PaO2 directly
            if pao2 < 50:
                points, interp = 4, "Severe hypoxemia"
            elif pao2 < 60:
                points, interp = 3, "Moderate hypoxemia"
            elif pao2 < 70:
                points, interp = 1, "Mild hypoxemia"
            else:
                points, interp = 0, "Normal oxygenation"

            return APACHEComponent(
                name="PaO2",
                value=pao2,
                unit="mmHg",
                points=points,
                normal_range=">70",
                interpretation=interp,
            )

    def _score_ph(self, ph: float) -> APACHEComponent:
        """Score arterial pH."""
        if ph >= 7.7:
            points, interp = 4, "Severe alkalemia"
        elif ph >= 7.6:
            points, interp = 3, "Moderate alkalemia"
        elif ph >= 7.5:
            points, interp = 1, "Mild alkalemia"
        elif ph >= 7.33:
            points, interp = 0, "Normal"
        elif ph >= 7.25:
            points, interp = 2, "Mild acidemia"
        elif ph >= 7.15:
            points, interp = 3, "Moderate acidemia"
        else:
            points, interp = 4, "Severe acidemia"

        return APACHEComponent(
            name="Arterial pH",
            value=ph,
            unit="pH",
            points=points,
            normal_range="7.33-7.49",
            interpretation=interp,
        )

    def _score_sodium(self, na: float) -> APACHEComponent:
        """Score serum sodium (mEq/L)."""
        if na >= 180:
            points, interp = 4, "Severe hypernatremia"
        elif na >= 160:
            points, interp = 3, "Moderate hypernatremia"
        elif na >= 155:
            points, interp = 2, "Mild hypernatremia"
        elif na >= 150:
            points, interp = 1, "Borderline hypernatremia"
        elif na >= 130:
            points, interp = 0, "Normal"
        elif na >= 120:
            points, interp = 2, "Mild hyponatremia"
        elif na >= 111:
            points, interp = 3, "Moderate hyponatremia"
        else:
            points, interp = 4, "Severe hyponatremia"

        return APACHEComponent(
            name="Sodium",
            value=na,
            unit="mEq/L",
            points=points,
            normal_range="130-149",
            interpretation=interp,
        )

    def _score_potassium(self, k: float) -> APACHEComponent:
        """Score serum potassium (mEq/L)."""
        if k >= 7:
            points, interp = 4, "Severe hyperkalemia"
        elif k >= 6.5:
            points, interp = 3, "Moderate hyperkalemia"
        elif k >= 6:
            points, interp = 2, "Mild hyperkalemia"
        elif k >= 5.5:
            points, interp = 1, "Borderline hyperkalemia"
        elif k >= 3.5:
            points, interp = 0, "Normal"
        elif k >= 3:
            points, interp = 1, "Mild hypokalemia"
        elif k >= 2.5:
            points, interp = 2, "Moderate hypokalemia"
        else:
            points, interp = 4, "Severe hypokalemia"

        return APACHEComponent(
            name="Potassium",
            value=k,
            unit="mEq/L",
            points=points,
            normal_range="3.5-5.4",
            interpretation=interp,
        )

    def _score_creatinine(self, cr: float, acute_rf: bool) -> APACHEComponent:
        """Score serum creatinine (mg/dL)."""
        # Double points if acute renal failure
        multiplier = 2 if acute_rf else 1

        if cr >= 6.9:
            points, interp = 4 * multiplier, "Severe renal failure"
        elif cr >= 3.5:
            points, interp = 3 * multiplier, "Moderate renal failure"
        elif cr >= 2:
            points, interp = 2 * multiplier, "Mild renal failure"
        elif cr >= 1.5:
            points, interp = 1 * multiplier, "Borderline elevated"
        elif cr >= 0.6:
            points, interp = 0, "Normal"
        else:
            points, interp = 2, "Low creatinine"

        return APACHEComponent(
            name="Creatinine",
            value=cr,
            unit="mg/dL",
            points=points,
            normal_range="0.6-1.4",
            interpretation=interp,
        )

    def _score_hematocrit(self, hct: float) -> APACHEComponent:
        """Score hematocrit (%)."""
        if hct >= 60:
            points, interp = 4, "Severe polycythemia"
        elif hct >= 50:
            points, interp = 2, "Mild polycythemia"
        elif hct >= 30:
            points, interp = 0, "Normal"
        elif hct >= 20:
            points, interp = 2, "Mild anemia"
        else:
            points, interp = 4, "Severe anemia"

        return APACHEComponent(
            name="Hematocrit",
            value=hct,
            unit="%",
            points=points,
            normal_range="30-45.9",
            interpretation=interp,
        )

    def _score_wbc(self, wbc: float) -> APACHEComponent:
        """Score white blood cell count (×10³/µL)."""
        if wbc >= 40:
            points, interp = 4, "Severe leukocytosis"
        elif wbc >= 25:
            points, interp = 2, "Moderate leukocytosis"
        elif wbc >= 15:
            points, interp = 1, "Mild leukocytosis"
        elif wbc >= 3:
            points, interp = 0, "Normal"
        elif wbc >= 1:
            points, interp = 2, "Leukopenia"
        else:
            points, interp = 4, "Severe leukopenia"

        return APACHEComponent(
            name="WBC",
            value=wbc,
            unit="×10³/µL",
            points=points,
            normal_range="3-14.9",
            interpretation=interp,
        )

    def _score_gcs(self, gcs: int) -> APACHEComponent:
        """Score Glasgow Coma Scale (15 - GCS)."""
        points = 15 - gcs

        if gcs >= 13:
            interp = "Normal/mild impairment"
        elif gcs >= 10:
            interp = "Moderate impairment"
        elif gcs >= 6:
            interp = "Severe impairment"
        else:
            interp = "Coma"

        return APACHEComponent(
            name="GCS",
            value=gcs,
            unit="score",
            points=points,
            normal_range="15",
            interpretation=interp,
        )

    def _score_age(self, age: int) -> int:
        """Score age points."""
        if age <= 44:
            return 0
        elif age <= 54:
            return 2
        elif age <= 64:
            return 3
        elif age <= 74:
            return 5
        else:
            return 6

    def _score_chronic_health(self, condition: str) -> int:
        """Score chronic health points."""
        if condition == "none":
            return 0

        # Non-operative or emergency operative patients
        chronic_conditions = {
            "liver": 5,  # Cirrhosis with portal hypertension
            "cardiovascular": 5,  # NYHA Class IV
            "respiratory": 5,  # Severe COPD, home O2
            "renal": 5,  # Dialysis-dependent
            "immune": 5,  # Immunocompromised
        }

        return chronic_conditions.get(condition, 0)

    def _get_mortality(self, score: int) -> Dict[str, Any]:
        """Get mortality prediction based on score."""
        for (low, high), info in self.MORTALITY_TABLE.items():
            if low <= score <= high:
                return info
        return {"mortality": 0.90, "range": ">90%"}

    def _generate_recommendations(
        self,
        score: int,
        chronic_health: str,
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        if score >= 25:
            recommendations.append("⚠️ HIGH MORTALITY RISK - Consider goals of care discussion")
            recommendations.append("Intensive monitoring and aggressive supportive care indicated")
        elif score >= 15:
            recommendations.append("ICU care recommended")
            recommendations.append("Close monitoring of organ function")

        if chronic_health != "none":
            recommendations.append(f"Consider impact of chronic {chronic_health} condition on prognosis")

        if score < 10:
            recommendations.append("Lower acuity - May be appropriate for step-down care")

        return recommendations


# Singleton instance
_apache_ii_calculator: Optional[ApacheIICalculator] = None


def get_apache_ii_calculator() -> ApacheIICalculator:
    """Get APACHE II calculator singleton."""
    global _apache_ii_calculator
    if _apache_ii_calculator is None:
        _apache_ii_calculator = ApacheIICalculator()
    return _apache_ii_calculator
