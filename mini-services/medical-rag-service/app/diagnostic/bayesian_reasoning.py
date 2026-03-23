"""
P1: Bayesian Diagnostic Reasoning Engine
========================================

Probabilistic diagnostic reasoning using Bayes' theorem.
Supports likelihood ratios, pre-test probabilities, and differential diagnosis.
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


class BayesianDiagnosticEngine:
    """Bayesian reasoning engine for clinical diagnosis."""

    LIKELIHOOD_RATIOS = {
        "wells_pe_high": LikelihoodRatio("Wells PE High", 5.0, 0.2, "Wells 2000"),
        "d_dimer": LikelihoodRatio("D-Dimer", 2.5, 0.08, "Crawford 2022"),
        "troponin": LikelihoodRatio("Troponin", 12.0, 0.05, "Reichlin 2009"),
        "ecg_st_changes": LikelihoodRatio("ECG ST Changes", 10.0, 0.3, "Panju 1998"),
        "ct_pa_positive": LikelihoodRatio("CT-PA", 20.0, 0.05, "Stein 2007"),
        "wbc_elevated": LikelihoodRatio("Elevated WBC", 1.5, 0.6, "McGee 2018"),
        "fever": LikelihoodRatio("Fever", 2.0, 0.5, "McGee 2018"),
        "crp_elevated": LikelihoodRatio("Elevated CRP", 2.5, 0.3, "Simon 2004"),
        "procalcitonin": LikelihoodRatio("Procalcitonin", 4.0, 0.15, "Wacker 2013"),
        "bnp_elevated": LikelihoodRatio("Elevated BNP", 5.0, 0.1, "McCullough 2004"),
        "lactate_elevated": LikelihoodRatio("Elevated Lactate", 3.0, 0.3, "Bakker 1991"),
    }

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
            probs = self.PRE_TEST_PROBABILITIES[presentation.lower()].copy()
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
        """Apply a diagnostic test result."""
        if result == TestResult.INCONCLUSIVE:
            return

        if lr_positive is not None and lr_negative is not None:
            lr = lr_positive if result == TestResult.POSITIVE else lr_negative
        elif test_name.lower() in self.LIKELIHOOD_RATIOS:
            lr_info = self.LIKELIHOOD_RATIOS[test_name.lower()]
            lr = lr_info.lr_positive if result == TestResult.POSITIVE else lr_info.lr_negative
        else:
            lr = 2.0 if result == TestResult.POSITIVE else 0.5

        self.applied_tests.append({
            "test_name": test_name,
            "result": result.value,
            "lr_used": lr,
        })

        for hypothesis in self.hypotheses.values():
            new_prob = self._apply_bayes(hypothesis.post_test_probability, lr)
            hypothesis.post_test_probability = new_prob
            hypothesis.likelihood_ratios_applied.append(lr)
            hypothesis.evidence.append({
                "test": test_name,
                "result": result.value,
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
        return post_odds / (1 + post_odds)

    def analyze(self) -> BayesianAnalysisResult:
        """Analyze and return results."""
        total_prob = sum(h.post_test_probability for h in self.hypotheses.values())
        if total_prob > 0:
            for h in self.hypotheses.values():
                h.post_test_probability /= total_prob

        sorted_hypotheses = sorted(
            self.hypotheses.values(),
            key=lambda h: h.post_test_probability,
            reverse=True,
        )

        primary_diagnosis = sorted_hypotheses[0].diagnosis if sorted_hypotheses else "unknown"

        if len(sorted_hypotheses) >= 2:
            confidence = sorted_hypotheses[0].post_test_probability - sorted_hypotheses[1].post_test_probability
        else:
            confidence = sorted_hypotheses[0].post_test_probability if sorted_hypotheses else 0

        reasoning = self._generate_reasoning(sorted_hypotheses)
        warnings = self._generate_warnings(sorted_hypotheses)
        recommendations = self._recommend_tests(sorted_hypotheses)

        return BayesianAnalysisResult(
            primary_diagnosis=primary_diagnosis,
            hypotheses=sorted_hypotheses,
            confidence_level=confidence,
            recommended_tests=recommendations,
            clinical_reasoning=reasoning,
            warnings=warnings,
        )

    def _generate_reasoning(self, hypotheses: List[DiagnosticHypothesis]) -> str:
        if not hypotheses:
            return "No diagnostic hypotheses."
        top = hypotheses[0]
        return (
            f"Most likely diagnosis: {top.diagnosis} "
            f"({top.post_test_probability:.1%} probability). "
            f"Pre-test probability was {top.pre_test_probability:.1%}."
        )

    def _generate_warnings(self, hypotheses: List[DiagnosticHypothesis]) -> List[str]:
        warnings = []
        if not hypotheses:
            return ["No diagnostic hypotheses."]
        if hypotheses[0].post_test_probability < 0.40:
            warnings.append("Low confidence - additional testing recommended")
        return warnings

    def _recommend_tests(self, hypotheses: List[DiagnosticHypothesis]) -> List[Dict[str, Any]]:
        if not hypotheses:
            return []
        return [{
            "type": "confirmatory",
            "diagnosis": hypotheses[0].diagnosis,
            "priority": "high",
        }]

    def reset(self) -> None:
        self.hypotheses.clear()
        self.applied_tests.clear()
        self.presentation_type = None


_bayesian_engine: Optional[BayesianDiagnosticEngine] = None


def get_bayesian_engine() -> BayesianDiagnosticEngine:
    global _bayesian_engine
    if _bayesian_engine is None:
        _bayesian_engine = BayesianDiagnosticEngine()
    return _bayesian_engine
