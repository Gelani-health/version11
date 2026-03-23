"""
P1: Bayesian Diagnostic Reasoning Engine
========================================

Probabilistic diagnostic reasoning using Bayes' theorem.
Supports likelihood ratios, pre-test probabilities, and differential diagnosis.

Features:
- Pre-test to post-test probability calculation
- Likelihood ratio integration
- Multi-test sequential analysis
- Differential diagnosis ranking
- Evidence synthesis

Reference:
- McGee S. Evidence-Based Physical Diagnosis. 4th ed. 2018.
- Pauker SG, Kassirer JP. N Engl J Med. 1975;293:229-234.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from datetime import datetime
import math


class TestResult(str, Enum):
    """Test result types."""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    INCONCLUSIVE = "inconclusive"


class EvidenceStrength(str, Enum):
    """Strength of evidence."""
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"


@dataclass
class LikelihoodRatio:
    """Likelihood ratio for a diagnostic test."""
    test_name: str
    lr_positive: float
    lr_negative: float
    confidence_interval: Optional[Tuple[float, float]] = None
    source: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "lr_positive": self.lr_positive,
            "lr_negative": self.lr_negative,
            "confidence_interval": self.confidence_interval,
            "source": self.source,
        }


@dataclass
class DiagnosticHypothesis:
    """A diagnostic hypothesis with probability tracking."""
    diagnosis: str
    pre_test_probability: float
    post_test_probability: float = 0.0
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    likelihood_ratios_applied: List[float] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "diagnosis": self.diagnosis,
            "pre_test_probability": f"{self.pre_test_probability:.1%}",
            "post_test_probability": f"{self.post_test_probability:.1%}",
            "evidence": self.evidence,
            "likelihood_ratios_applied": self.likelihood_ratios_applied,
        }


@dataclass
class BayesianAnalysisResult:
    """Complete Bayesian analysis result."""
    primary_diagnosis: str
    hypotheses: List[DiagnosticHypothesis]
    confidence_level: float
    recommended_tests: List[Dict[str, Any]]
    clinical_reasoning: str
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_diagnosis": self.primary_diagnosis,
            "hypotheses": [h.to_dict() for h in self.hypotheses],
            "confidence_level": f"{self.confidence_level:.1%}",
            "recommended_tests": self.recommended_tests,
            "clinical_reasoning": self.clinical_reasoning,
            "warnings": self.warnings,
            "timestamp": datetime.utcnow().isoformat(),
        }


class BayesianDiagnosticEngine:
    """
    Bayesian reasoning engine for clinical diagnosis.

    Implements Bayes' theorem:
    Post-test Odds = Pre-test Odds × Likelihood Ratio
    Probability = Odds / (1 + Odds)
    """

    # Likelihood ratios for common tests (compiled from literature)
    LIKELIHOOD_RATIOS = {
        "wells_pe_high": LikelihoodRatio(
            test_name="Wells PE Score High",
            lr_positive=5.0,
            lr_negative=0.2,
            source="Wells PS, et al. Thromb Haemost 2000",
        ),
        "wells_pe_low": LikelihoodRatio(
            test_name="Wells PE Score Low",
            lr_positive=1.0,
            lr_negative=0.1,
            source="Wells PS, et al. Thromb Haemost 2000",
        ),
        "d_dimer": LikelihoodRatio(
            test_name="D-Dimer",
            lr_positive=2.5,
            lr_negative=0.08,
            source="Crawford F, et al. JAMA 2022",
        ),
        "troponin": LikelihoodRatio(
            test_name="Troponin",
            lr_positive=12.0,
            lr_negative=0.05,
            source="Reichlin T, et al. N Engl J Med 2009",
        ),
        "ecg_st_changes": LikelihoodRatio(
            test_name="ECG ST Changes",
            lr_positive=10.0,
            lr_negative=0.3,
            source="Panju AA, et al. JAMA 1998",
        ),
        "ct_pa_positive": LikelihoodRatio(
            test_name="CT-PA Positive",
            lr_positive=20.0,
            lr_negative=0.05,
            source="Stein PD, et al. Chest 2007",
        ),
        "wbc_elevated": LikelihoodRatio(
            test_name="Elevated WBC",
            lr_positive=1.5,
            lr_negative=0.6,
            source="McGee S. Evidence-Based Physical Diagnosis 2018",
        ),
        "fever": LikelihoodRatio(
            test_name="Fever",
            lr_positive=2.0,
            lr_negative=0.5,
            source="McGee S. Evidence-Based Physical Diagnosis 2018",
        ),
        "crp_elevated": LikelihoodRatio(
            test_name="Elevated CRP",
            lr_positive=2.5,
            lr_negative=0.3,
            source="Simon L, et al. Pediatr Infect Dis J 2004",
        ),
        "procalcitonin": LikelihoodRatio(
            test_name="Procalcitonin",
            lr_positive=4.0,
            lr_negative=0.15,
            source="Wacker C, et al. Lancet Infect Dis 2013",
        ),
        "bnp_elevated": LikelihoodRatio(
            test_name="Elevated BNP",
            lr_positive=5.0,
            lr_negative=0.1,
            source="McCullough PA, et al. Am J Kidney Dis 2004",
        ),
        "lactate_elevated": LikelihoodRatio(
            test_name="Elevated Lactate",
            lr_positive=3.0,
            lr_negative=0.3,
            source="Bakker J, et al. Intensive Care Med 1991",
        ),
    }

    # Pre-test probabilities for common presentations
    PRE_TEST_PROBABILITIES = {
        "chest_pain": {
            "acute_coronary_syndrome": 0.15,
            "pulmonary_embolism": 0.05,
            "pneumothorax": 0.02,
            "aortic_dissection": 0.005,
            "musculoskeletal": 0.36,
            "gastroesophageal_reflux": 0.20,
            "anxiety": 0.10,
            "other": 0.115,
        },
        "dyspnea": {
            "heart_failure": 0.25,
            "copd_exacerbation": 0.20,
            "pneumonia": 0.15,
            "pulmonary_embolism": 0.08,
            "asthma": 0.10,
            "anxiety": 0.10,
            "other": 0.12,
        },
        "syncope": {
            "vasovagal": 0.25,
            "cardiac_arrhythmia": 0.15,
            "orthostatic_hypotension": 0.10,
            "neurological": 0.05,
            "medication_related": 0.10,
            "unknown": 0.35,
        },
        "abdominal_pain_acute": {
            "appendicitis": 0.20,
            "cholecystitis": 0.10,
            "diverticulitis": 0.08,
            "kidney_stone": 0.10,
            "ovarian_pathology": 0.05,
            "gastroenteritis": 0.15,
            "nonspecific": 0.32,
        },
        "fever_unknown_source": {
            "viral_infection": 0.40,
            "bacterial_infection": 0.25,
            "uti": 0.10,
            "pneumonia": 0.08,
            "endocarditis": 0.01,
            "malignancy": 0.02,
            "connective_tissue": 0.02,
            "unknown": 0.12,
        },
    }

    def __init__(self):
        self.hypotheses: Dict[str, DiagnosticHypothesis] = {}
        self.applied_tests: List[Dict[str, Any]] = []
        self.presentation_type: Optional[str] = None

    def initialize_from_presentation(
        self,
        presentation: str,
        custom_probabilities: Optional[Dict[str, float]] = None,
    ) -> None:
        """Initialize hypotheses based on chief complaint."""
        self.presentation_type = presentation

        if presentation.lower() in self.PRE_TEST_PROBABILITIES:
            probs = self.PRE_TEST_PROBABILITIES[presentation.lower()]
        else:
            probs = {"diagnosis_1": 0.5, "diagnosis_2": 0.3, "other": 0.2}

        if custom_probabilities:
            probs.update(custom_probabilities)

        total = sum(probs.values())
        probs = {k: v / total for k, v in probs.items()}

        self.hypotheses.clear()
        for diagnosis, probability in probs.items():
            self.add_hypothesis(diagnosis, probability)

    def add_hypothesis(self, diagnosis: str, pre_test_probability: float) -> None:
        """Add a diagnostic hypothesis."""
        hypothesis = DiagnosticHypothesis(
            diagnosis=diagnosis,
            pre_test_probability=pre_test_probability,
            post_test_probability=pre_test_probability,
        )
        self.hypotheses[diagnosis] = hypothesis

    def apply_test(
        self,
        test_name: str,
        result: TestResult,
        lr_positive: Optional[float] = None,
        lr_negative: Optional[float] = None,
    ) -> None:
        """Apply a diagnostic test result to all hypotheses."""
        if result == TestResult.INCONCLUSIVE:
            return

        if lr_positive is not None and lr_negative is not None:
            lr = LikelihoodRatio(test_name, lr_positive, lr_negative)
        elif test_name.lower() in self.LIKELIHOOD_RATIOS:
            lr = self.LIKELIHOOD_RATIOS[test_name.lower()]
        else:
            lr = LikelihoodRatio(test_name, lr_positive=2.0, lr_negative=0.5)

        selected_lr = lr.lr_positive if result == TestResult.POSITIVE else lr.lr_negative

        self.applied_tests.append({
            "test_name": test_name,
            "result": result.value,
            "lr_used": selected_lr,
        })

        for diagnosis, hypothesis in self.hypotheses.items():
            new_prob = self._apply_bayes(hypothesis.post_test_probability, selected_lr)
            hypothesis.post_test_probability = new_prob
            hypothesis.likelihood_ratios_applied.append(selected_lr)
            hypothesis.evidence.append({
                "test": test_name,
                "result": result.value,
                "lr": selected_lr,
                "probability_after": new_prob,
            })

    def apply_symptom(
        self,
        symptom: str,
        present: bool,
        lr_present: float,
        lr_absent: float,
        diagnoses_affected: Optional[List[str]] = None,
    ) -> None:
        """Apply symptom finding with likelihood ratios."""
        lr = lr_present if present else lr_absent
        targets = diagnoses_affected or list(self.hypotheses.keys())

        for diagnosis in targets:
            if diagnosis in self.hypotheses:
                hypothesis = self.hypotheses[diagnosis]
                new_prob = self._apply_bayes(hypothesis.post_test_probability, lr)
                hypothesis.post_test_probability = new_prob
                hypothesis.evidence.append({
                    "symptom": symptom,
                    "present": present,
                    "lr": lr,
                    "probability_after": new_prob,
                })

    def _apply_bayes(self, pre_prob: float, lr: float) -> float:
        """Apply Bayes' theorem."""
        if pre_prob <= 0:
            return 0.0 if lr < 1 else min(0.01, lr * 0.001)
        if pre_prob >= 1:
            return 1.0

        pre_odds = pre_prob / (1 - pre_prob)
        post_odds = pre_odds * lr
        post_prob = post_odds / (1 + post_odds)
        return post_prob

    def analyze(self) -> BayesianAnalysisResult:
        """Analyze the diagnostic hypotheses and generate results."""
        total_prob = sum(h.post_test_probability for h in self.hypotheses.values())
        if total_prob > 0:
            for h in self.hypotheses.values():
                h.post_test_probability /= total_prob

        sorted_hypotheses = sorted(
            self.hypotheses.values(),
            key=lambda h: h.post_test_probability,
            reverse=True,
        )

        primary = sorted_hypotheses[0] if sorted_hypotheses else None
        primary_diagnosis = primary.diagnosis if primary else "unknown"

        if len(sorted_hypotheses) >= 2:
            confidence = sorted_hypotheses[0].post_test_probability - sorted_hypotheses[1].post_test_probability
        else:
            confidence = sorted_hypotheses[0].post_test_probability if sorted_hypotheses else 0

        recommended = self._recommend_tests(sorted_hypotheses)
        reasoning = self._generate_reasoning(sorted_hypotheses, self.applied_tests)
        warnings = self._generate_warnings(sorted_hypotheses)

        return BayesianAnalysisResult(
            primary_diagnosis=primary_diagnosis,
            hypotheses=sorted_hypotheses,
            confidence_level=confidence,
            recommended_tests=recommended,
            clinical_reasoning=reasoning,
            warnings=warnings,
        )

    def _recommend_tests(self, hypotheses: List[DiagnosticHypothesis]) -> List[Dict[str, Any]]:
        """Recommend next diagnostic tests based on current hypotheses."""
        recommendations = []
        if not hypotheses:
            return recommendations

        top_diagnosis = hypotheses[0].diagnosis
        top_prob = hypotheses[0].post_test_probability

        if top_prob > 0.80:
            recommendations.append({
                "type": "confirmatory",
                "diagnosis": top_diagnosis,
                "test": f"Gold standard test for {top_diagnosis}",
                "priority": "high",
            })
        elif top_prob > 0.50:
            recommendations.append({
                "type": "additional",
                "diagnosis": top_diagnosis,
                "test": f"Additional testing to confirm {top_diagnosis}",
                "priority": "medium",
            })
        else:
            recommendations.append({
                "type": "screening",
                "test": "Broad diagnostic panel to narrow differential",
                "priority": "high",
            })

        return recommendations

    def _generate_reasoning(
        self,
        hypotheses: List[DiagnosticHypothesis],
        tests: List[Dict[str, Any]],
    ) -> str:
        """Generate clinical reasoning narrative."""
        if not hypotheses:
            return "No diagnostic hypotheses available."

        top = hypotheses[0]
        reasoning_parts = []

        reasoning_parts.append(
            f"Based on Bayesian analysis, the most likely diagnosis is {top.diagnosis} "
            f"with a post-test probability of {top.post_test_probability:.1%}."
        )
        reasoning_parts.append(f"The pre-test probability was {top.pre_test_probability:.1%}.")

        if tests:
            reasoning_parts.append(
                f"After applying {len(tests)} test(s), the probability "
                f"{'increased' if top.post_test_probability > top.pre_test_probability else 'decreased'}."
            )

        return " ".join(reasoning_parts)

    def _generate_warnings(self, hypotheses: List[DiagnosticHypothesis]) -> List[str]:
        """Generate clinical warnings."""
        warnings = []

        if not hypotheses:
            warnings.append("No diagnostic hypotheses - insufficient clinical data")
            return warnings

        top_prob = hypotheses[0].post_test_probability

        if top_prob < 0.40:
            warnings.append("Low diagnostic confidence - consider additional history and testing")

        if len(hypotheses) >= 2:
            prob_gap = hypotheses[0].post_test_probability - hypotheses[1].post_test_probability
            if prob_gap < 0.10:
                warnings.append("Top diagnoses are closely ranked - consider differentiating tests")

        critical_diagnoses = [
            "acute_coronary_syndrome",
            "pulmonary_embolism",
            "aortic_dissection",
            "pneumothorax",
            "cardiac_arrhythmia",
            "endocarditis",
        ]

        for h in hypotheses:
            if h.diagnosis in critical_diagnoses and h.post_test_probability > 0.05:
                warnings.append(
                    f"{h.diagnosis.replace('_', ' ').title()} cannot be ruled out "
                    f"({h.post_test_probability:.1%} probability)"
                )

        return warnings

    def reset(self) -> None:
        """Reset the analysis."""
        self.hypotheses.clear()
        self.applied_tests.clear()
        self.presentation_type = None


_bayesian_engine: Optional[BayesianDiagnosticEngine] = None


def get_bayesian_engine() -> BayesianDiagnosticEngine:
    """Get Bayesian diagnostic engine singleton."""
    global _bayesian_engine
    if _bayesian_engine is None:
        _bayesian_engine = BayesianDiagnosticEngine()
    return _bayesian_engine
