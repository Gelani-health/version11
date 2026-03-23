"""
P1: Number Needed to Treat (NNT) Calculator
==========================================

Evidence-based NNT calculations for clinical decision support.
Supports absolute risk reduction, relative risk, and confidence intervals.

References:
- Cook RJ, Sackett DL. BMJ. 1995;310:492-494.
- Altman DG, Bland JM. BMJ. 1999;319:1101.

NNT = 1 / (CER - EER) = 1 / ARR
Where:
- CER = Control Event Rate
- EER = Experimental Event Rate
- ARR = Absolute Risk Reduction
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import math


class TreatmentEffectDirection(str, Enum):
    """Direction of treatment effect."""
    BENEFICIAL = "beneficial"
    HARMFUL = "harmful"
    NEUTRAL = "neutral"


class EvidenceLevel(str, Enum):
    """Level of evidence for the treatment."""
    LEVEL_1A = "1a"  # Systematic review of RCTs
    LEVEL_1B = "1b"  # Individual RCT
    LEVEL_2A = "2a"  # Systematic review of cohort studies
    LEVEL_2B = "2b"  # Individual cohort study
    LEVEL_3 = "3"    # Case-control study
    LEVEL_4 = "4"    # Case series
    LEVEL_5 = "5"    # Expert opinion


@dataclass
class NNTResult:
    """NNT calculation result."""
    nnt: float
    arr: float  # Absolute Risk Reduction
    rrr: float  # Relative Risk Reduction
    cer: float  # Control Event Rate
    eer: float  # Experimental Event Rate
    direction: TreatmentEffectDirection
    confidence_interval_95: Optional[tuple] = None
    population_risk: str = ""
    time_horizon: str = ""
    evidence_level: EvidenceLevel = EvidenceLevel.LEVEL_1B
    clinical_interpretation: str = ""
    caveats: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nnt": round(self.nnt, 1) if not math.isinf(self.nnt) else "infinity",
            "arr": f"{self.arr:.1%}",
            "rrr": f"{self.rrr:.1%}",
            "cer": f"{self.cer:.1%}",
            "eer": f"{self.eer:.1%}",
            "direction": self.direction.value,
            "confidence_interval_95": self.confidence_interval_95,
            "population_risk": self.population_risk,
            "time_horizon": self.time_horizon,
            "evidence_level": self.evidence_level.value,
            "clinical_interpretation": self.clinical_interpretation,
            "caveats": self.caveats,
            "timestamp": datetime.utcnow().isoformat(),
        }


class NNTCalculator:
    """
    Number Needed to Treat Calculator.

    Usage:
        calculator = NNTCalculator()
        result = calculator.calculate_from_rates(
            control_event_rate=0.20,
            experimental_event_rate=0.12,
            time_horizon="5 years",
        )
    """

    # Pre-calculated NNTs for common treatments (from systematic reviews)
    COMMON_NNTs = {
        "statin_primary_prevention_5yr": {
            "nnt": 60,
            "cer": 0.10,
            "eer": 0.083,
            "time_horizon": "5 years",
            "outcome": "major cardiovascular event",
            "evidence": "Cholesterol Treatment Trialists Collaboration 2012",
        },
        "statin_secondary_prevention_5yr": {
            "nnt": 20,
            "cer": 0.25,
            "eer": 0.20,
            "time_horizon": "5 years",
            "outcome": "major cardiovascular event",
            "evidence": "Cholesterol Treatment Trialists Collaboration 2012",
        },
        "aspirin_secondary_prevention_5yr": {
            "nnt": 50,
            "cer": 0.15,
            "eer": 0.13,
            "time_horizon": "5 years",
            "outcome": "major cardiovascular event",
            "evidence": "ATC Collaboration 2009",
        },
        "ace_inhibitor_heart_failure_3yr": {
            "nnt": 11,
            "cer": 0.30,
            "eer": 0.21,
            "time_horizon": "3 years",
            "outcome": "mortality",
            "evidence": "Garg R, et al. JAMA 1995",
        },
        "beta_blocker_post_mi_2yr": {
            "nnt": 25,
            "cer": 0.10,
            "eer": 0.06,
            "time_horizon": "2 years",
            "outcome": "mortality",
            "evidence": "Yusuf S, et al. JAMA 1985",
        },
        "antibiotic_strep_pharyngitis": {
            "nnt": 4,
            "cer": 0.30,
            "eer": 0.05,
            "time_horizon": "1 week",
            "outcome": "symptom resolution within 3 days",
            "evidence": "Del Mar CB, et al. Cochrane 2021",
        },
        "anticoagulant_afib_stroke_1yr": {
            "nnt": 25,
            "cer": 0.045,
            "eer": 0.018,
            "time_horizon": "1 year",
            "outcome": "stroke (high-risk AFib)",
            "evidence": "Hart RG, et al. Ann Intern Med 2007",
        },
        "bp_control_stroke_5yr": {
            "nnt": 30,
            "cer": 0.06,
            "eer": 0.04,
            "time_horizon": "5 years",
            "outcome": "stroke",
            "evidence": "Lawes CM, et al. Lancet 2003",
        },
        "smoking_cessation_therapy": {
            "nnt": 7,
            "cer": 0.05,
            "eer": 0.20,
            "time_horizon": "6 months",
            "outcome": "abstinence at 6 months",
            "evidence": "Cahill K, et al. Cochrane 2016",
        },
        "influenza_vaccine_elderly": {
            "nnt": 30,
            "cer": 0.06,
            "eer": 0.027,
            "time_horizon": "1 year",
            "outcome": "influenza infection",
            "evidence": "Jefferson T, et al. Cochrane 2018",
        },
    }

    def calculate_from_rates(
        self,
        control_event_rate: float,
        experimental_event_rate: float,
        control_n: Optional[int] = None,
        experimental_n: Optional[int] = None,
        time_horizon: str = "unspecified",
        outcome: str = "",
        population_risk: str = "average",
        evidence_level: EvidenceLevel = EvidenceLevel.LEVEL_1B,
    ) -> NNTResult:
        """
        Calculate NNT from event rates.

        Args:
            control_event_rate: Event rate in control group (0-1)
            experimental_event_rate: Event rate in treatment group (0-1)
            control_n: Number of patients in control group (for CI calculation)
            experimental_n: Number of patients in experimental group (for CI calculation)
            time_horizon: Time period for the outcome
            outcome: The clinical outcome being measured
            population_risk: Risk level of population (low/average/high)
            evidence_level: Level of evidence

        Returns:
            NNTResult with complete analysis
        """
        cer = control_event_rate
        eer = experimental_event_rate

        # Calculate absolute risk reduction
        arr = cer - eer

        # Calculate relative risk reduction
        rrr = arr / cer if cer > 0 else 0

        # Calculate NNT
        if abs(arr) < 0.0001:
            nnt = float('inf')
        else:
            nnt = 1 / abs(arr)

        # Determine direction
        if arr > 0:
            direction = TreatmentEffectDirection.BENEFICIAL
        elif arr < 0:
            direction = TreatmentEffectDirection.HARMFUL
        else:
            direction = TreatmentEffectDirection.NEUTRAL

        # Calculate confidence intervals if sample sizes provided
        ci = None
        if control_n and experimental_n:
            ci = self._calculate_ci(cer, eer, control_n, experimental_n)

        # Generate interpretation
        interpretation = self._generate_interpretation(
            nnt, arr, rrr, direction, time_horizon, outcome
        )

        # Generate caveats
        caveats = self._generate_caveats(
            nnt, arr, population_risk, time_horizon, evidence_level
        )

        return NNTResult(
            nnt=nnt,
            arr=arr,
            rrr=rrr,
            cer=cer,
            eer=eer,
            direction=direction,
            confidence_interval_95=ci,
            population_risk=population_risk,
            time_horizon=time_horizon,
            evidence_level=evidence_level,
            clinical_interpretation=interpretation,
            caveats=caveats,
        )

    def calculate_from_counts(
        self,
        control_events: int,
        control_total: int,
        experimental_events: int,
        experimental_total: int,
        time_horizon: str = "unspecified",
        outcome: str = "",
        population_risk: str = "average",
        evidence_level: EvidenceLevel = EvidenceLevel.LEVEL_1B,
    ) -> NNTResult:
        """
        Calculate NNT from event counts.

        Args:
            control_events: Number of events in control group
            control_total: Total patients in control group
            experimental_events: Number of events in treatment group
            experimental_total: Total patients in treatment group
            time_horizon: Time period for the outcome
            outcome: The clinical outcome being measured
            population_risk: Risk level of population
            evidence_level: Level of evidence

        Returns:
            NNTResult with complete analysis
        """
        cer = control_events / control_total if control_total > 0 else 0
        eer = experimental_events / experimental_total if experimental_total > 0 else 0

        return self.calculate_from_rates(
            control_event_rate=cer,
            experimental_event_rate=eer,
            control_n=control_total,
            experimental_n=experimental_total,
            time_horizon=time_horizon,
            outcome=outcome,
            population_risk=population_risk,
            evidence_level=evidence_level,
        )

    def get_nnt_for_treatment(self, treatment_key: str) -> Optional[Dict[str, Any]]:
        """Get pre-calculated NNT for common treatments."""
        return self.COMMON_NNTs.get(treatment_key)

    def adjust_for_baseline_risk(
        self,
        baseline_nnt: float,
        baseline_risk: float,
        patient_risk: float,
    ) -> float:
        """
        Adjust NNT for patient's baseline risk.

        NNT_adjusted = NNT × (Baseline Risk / Patient Risk)

        Args:
            baseline_nnt: NNT from trial
            baseline_risk: Baseline risk in trial population
            patient_risk: Patient's actual baseline risk

        Returns:
            Adjusted NNT for this patient
        """
        if patient_risk <= 0:
            return float('inf')

        relative_risk = patient_risk / baseline_risk
        return baseline_nnt / relative_risk

    def _calculate_ci(
        self,
        cer: float,
        eer: float,
        control_n: int,
        experimental_n: int,
    ) -> tuple:
        """Calculate 95% confidence interval for NNT."""
        # Standard error of ARR
        se_arr = math.sqrt(
            (cer * (1 - cer) / control_n) +
            (eer * (1 - eer) / experimental_n)
        )

        # CI for ARR
        arr = cer - eer
        arr_ci_low = arr - 1.96 * se_arr
        arr_ci_high = arr + 1.96 * se_arr

        # Convert to NNT CI
        if arr_ci_low <= 0 and arr_ci_high <= 0:
            # Harm throughout CI
            nnt_ci = (1 / abs(arr_ci_high), 1 / abs(arr_ci_low))
        elif arr_ci_low >= 0 and arr_ci_high >= 0:
            # Benefit throughout CI
            nnt_ci = (1 / arr_ci_high, 1 / arr_ci_low)
        else:
            # CI crosses 0 (not significant)
            nnt_ci = ("negative infinity", "positive infinity")

        return nnt_ci

    def _generate_interpretation(
        self,
        nnt: float,
        arr: float,
        rrr: float,
        direction: TreatmentEffectDirection,
        time_horizon: str,
        outcome: str,
    ) -> str:
        """Generate clinical interpretation."""
        if direction == TreatmentEffectDirection.NEUTRAL:
            return "Treatment has no measurable effect."

        if math.isinf(nnt):
            return "Treatment effect is negligible."

        interpretation_parts = []

        if direction == TreatmentEffectDirection.BENEFICIAL:
            interpretation_parts.append(
                f"NNT = {nnt:.1f}: You need to treat {nnt:.0f} patients "
                f"for {time_horizon} to prevent 1 {outcome}."
            )
            interpretation_parts.append(
                f"ARR = {arr:.1%}: The treatment reduces absolute risk by {arr:.1%}."
            )
            interpretation_parts.append(
                f"RRR = {rrr:.1%}: The treatment reduces relative risk by {rrr:.1%}."
            )

            if nnt < 10:
                interpretation_parts.append("This is a STRONG treatment effect.")
            elif nnt < 50:
                interpretation_parts.append("This is a MODERATE treatment effect.")
            else:
                interpretation_parts.append("This is a MODEST treatment effect.")
        else:
            nnh = abs(nnt)  # Number needed to harm
            interpretation_parts.append(
                f"NNH = {nnh:.1f}: For every {nnh:.0f} patients treated, "
                f"1 additional patient experiences harm."
            )

        return " ".join(interpretation_parts)

    def _generate_caveats(
        self,
        nnt: float,
        arr: float,
        population_risk: str,
        time_horizon: str,
        evidence_level: EvidenceLevel,
    ) -> List[str]:
        """Generate important caveats."""
        caveats = []

        caveats.append(
            f"NNT applies to populations with {population_risk} baseline risk."
        )
        caveats.append(f"Time horizon: {time_horizon}. NNT may differ for longer follow-up.")
        caveats.append(
            "NNT does not account for treatment side effects, costs, or patient preferences."
        )

        if evidence_level.value in ["4", "5"]:
            caveats.append(
                f"Evidence level {evidence_level.value}: Consider limitations of study design."
            )

        if population_risk == "low" and nnt > 100:
            caveats.append(
                "Low-risk population: Treatment benefits may not outweigh harms/costs."
            )

        return caveats


_nnt_calculator: Optional[NNTCalculator] = None


def get_nnt_calculator() -> NNTCalculator:
    """Get NNT calculator singleton."""
    global _nnt_calculator
    if _nnt_calculator is None:
        _nnt_calculator = NNTCalculator()
    return _nnt_calculator
