"""
Evidence Quality Scoring System (GRADE)
========================================

P1 Priority: Comprehensive GRADE evidence quality assessment.

This module implements the Grading of Recommendations Assessment,
Development and Evaluation (GRADE) system for rating the quality
of evidence in clinical recommendations.

GRADE Domains:
1. Study Design (initial quality)
2. Risk of Bias
3. Inconsistency
4. Indirectness
5. Imprecision
6. Publication Bias

Evidence Levels:
- High (A): Further research very unlikely to change confidence
- Moderate (B): Further research likely to impact confidence
- Low (C): Further research very likely to impact confidence
- Very Low (D): Estimate very uncertain

References:
- GRADE Handbook (2013) - https://gdt.gradepro.org/app/handbook/handbook.html
- Guyatt GH et al. GRADE guidelines. J Clin Epidemiol. 2011
"""

import asyncio
import time
import math
import re
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

from loguru import logger
from pydantic import BaseModel, Field

from app.core.config import get_settings


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class GRADELevel(Enum):
    """GRADE evidence quality levels."""
    HIGH = "high"           # Level A
    MODERATE = "moderate"   # Level B
    LOW = "low"             # Level C
    VERY_LOW = "very_low"   # Level D
    
    @property
    def letter_grade(self) -> str:
        """Return letter grade equivalent."""
        mapping = {
            GRADELevel.HIGH: "A",
            GRADELevel.MODERATE: "B",
            GRADELevel.LOW: "C",
            GRADELevel.VERY_LOW: "D",
        }
        return mapping[self]
    
    @property
    def confidence_statement(self) -> str:
        """Return confidence statement."""
        statements = {
            GRADELevel.HIGH: "Further research is very unlikely to change our confidence in the estimate of effect.",
            GRADELevel.MODERATE: "Further research is likely to have an important impact on our confidence in the estimate of effect and may change the estimate.",
            GRADELevel.LOW: "Further research is very likely to have an important impact on our confidence in the estimate of effect and is likely to change the estimate.",
            GRADELevel.VERY_LOW: "Any estimate of effect is very uncertain.",
        }
        return statements[self]


class StudyDesignType(Enum):
    """Types of study designs."""
    RANDOMIZED_CONTROLLED_TRIAL = "rct"
    SYSTEMATIC_REVIEW_RCT = "systematic_review_rct"
    COHORT_STUDY = "cohort"
    CASE_CONTROL_STUDY = "case_control"
    CROSS_SECTIONAL = "cross_sectional"
    CASE_SERIES = "case_series"
    CASE_REPORT = "case_report"
    META_ANALYSIS = "meta_analysis"
    NARRATIVE_REVIEW = "narrative_review"
    EXPERT_OPINION = "expert_opinion"
    GUIDELINE = "guideline"


class RiskOfBiasLevel(Enum):
    """Risk of bias levels."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"
    UNCLEAR = "unclear"


class InconsistencyLevel(Enum):
    """Inconsistency levels."""
    NONE = "none"
    SERIOUS = "serious"
    VERY_SERIOUS = "very_serious"


class IndirectnessLevel(Enum):
    """Indirectness levels."""
    NONE = "none"
    SERIOUS = "serious"
    VERY_SERIOUS = "very_serious"


class ImprecisionLevel(Enum):
    """Imprecision levels."""
    NONE = "none"
    SERIOUS = "serious"
    VERY_SERIOUS = "very_serious"


class PublicationBiasLevel(Enum):
    """Publication bias risk levels."""
    UNDETECTED = "undetected"
    SUSPECTED = "suspected"
    DETECTED = "detected"


# Study design quality starting points
STUDY_DESIGN_QUALITY = {
    StudyDesignType.RANDOMIZED_CONTROLLED_TRIAL: GRADELevel.HIGH,
    StudyDesignType.SYSTEMATIC_REVIEW_RCT: GRADELevel.HIGH,
    StudyDesignType.META_ANALYSIS: GRADELevel.HIGH,
    StudyDesignType.COHORT_STUDY: GRADELevel.LOW,
    StudyDesignType.CASE_CONTROL_STUDY: GRADELevel.LOW,
    StudyDesignType.CROSS_SECTIONAL: GRADELevel.LOW,
    StudyDesignType.CASE_SERIES: GRADELevel.VERY_LOW,
    StudyDesignType.CASE_REPORT: GRADELevel.VERY_LOW,
    StudyDesignType.NARRATIVE_REVIEW: GRADELevel.VERY_LOW,
    StudyDesignType.EXPERT_OPINION: GRADELevel.VERY_LOW,
    StudyDesignType.GUIDELINE: GRADELevel.MODERATE,
}

# Risk of bias domain weights
RISK_OF_BIAS_DOMAINS = {
    "randomization": {
        "description": "Random sequence generation",
        "weight": 0.2,
        "low_criteria": "Random number generation, computer randomization",
        "high_criteria": "No randomization, quasi-randomization",
    },
    "allocation_concealment": {
        "description": "Allocation concealment",
        "weight": 0.15,
        "low_criteria": "Central randomization, pharmacy-controlled",
        "high_criteria": "Open random allocation",
    },
    "blinding_participants": {
        "description": "Blinding of participants and personnel",
        "weight": 0.15,
        "low_criteria": "Double-blind, placebo-controlled",
        "high_criteria": "No blinding, open-label",
    },
    "blinding_assessment": {
        "description": "Blinding of outcome assessment",
        "weight": 0.15,
        "low_criteria": "Assessor blinded to group allocation",
        "high_criteria": "Assessor aware of group allocation",
    },
    "incomplete_outcome": {
        "description": "Incomplete outcome data",
        "weight": 0.15,
        "low_criteria": "< 10% dropout, intention-to-treat analysis",
        "high_criteria": "> 20% dropout, per-protocol only",
    },
    "selective_reporting": {
        "description": "Selective reporting",
        "weight": 0.1,
        "low_criteria": "All pre-specified outcomes reported",
        "high_criteria": "Outcomes selectively reported",
    },
    "other_bias": {
        "description": "Other sources of bias",
        "weight": 0.1,
        "low_criteria": "No other bias identified",
        "high_criteria": "Other significant bias present",
    },
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class QualityAssessment:
    """Individual quality assessment domain."""
    domain: str
    level: str  # low, moderate, high, very_high
    score: float
    justification: str
    downgrade_amount: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "level": self.level,
            "score": self.score,
            "justification": self.justification,
            "downgrade_amount": self.downgrade_amount,
        }


@dataclass
class StudyMetadata:
    """Metadata for a clinical study."""
    pmid: str
    title: str
    authors: List[str] = field(default_factory=list)
    journal: Optional[str] = None
    publication_year: Optional[int] = None
    study_design: Optional[StudyDesignType] = None
    sample_size: int = 0
    population: str = ""
    intervention: str = ""
    comparator: str = ""
    outcomes: List[str] = field(default_factory=list)
    follow_up_duration: Optional[str] = None
    funding_source: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "title": self.title,
            "authors": self.authors,
            "journal": self.journal,
            "publication_year": self.publication_year,
            "study_design": self.study_design.value if self.study_design else None,
            "sample_size": self.sample_size,
            "population": self.population,
            "intervention": self.intervention,
            "comparator": self.comparator,
            "outcomes": self.outcomes,
            "follow_up_duration": self.follow_up_duration,
            "funding_source": self.funding_source,
        }


@dataclass
class EffectEstimate:
    """Effect estimate with confidence interval."""
    effect_size: float
    effect_type: str  # "relative_risk", "odds_ratio", "hazard_ratio", "mean_difference"
    confidence_interval_lower: float
    confidence_interval_upper: float
    p_value: Optional[float] = None
    standard_error: Optional[float] = None
    number_needed_to_treat: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "effect_size": self.effect_size,
            "effect_type": self.effect_type,
            "confidence_interval": [self.confidence_interval_lower, self.confidence_interval_upper],
            "p_value": self.p_value,
            "standard_error": self.standard_error,
            "number_needed_to_treat": self.number_needed_to_treat,
        }


@dataclass
class EvidenceScore:
    """Comprehensive evidence quality score."""
    request_id: str
    timestamp: str
    pmid: str
    study_design: StudyDesignType
    initial_grade: GRADELevel
    final_grade: GRADELevel
    total_downgrades: int
    total_upgrades: int
    
    # Domain assessments
    risk_of_bias: Optional[QualityAssessment] = None
    inconsistency: Optional[QualityAssessment] = None
    indirectness: Optional[QualityAssessment] = None
    imprecision: Optional[QualityAssessment] = None
    publication_bias: Optional[QualityAssessment] = None
    
    # Upgrade factors
    upgrade_factors: List[str] = field(default_factory=list)
    
    # Study metadata
    study_metadata: Optional[StudyMetadata] = None
    effect_estimate: Optional[EffectEstimate] = None
    
    # Confidence
    confidence_score: float = 0.0
    confidence_interval: Tuple[float, float] = (0.0, 1.0)
    
    # Evidence synthesis
    evidence_summary: str = ""
    clinical_implications: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "pmid": self.pmid,
            "study_design": self.study_design.value,
            "initial_grade": self.initial_grade.value,
            "final_grade": self.final_grade.value,
            "letter_grade": self.final_grade.letter_grade,
            "total_downgrades": self.total_downgrades,
            "total_upgrades": self.total_upgrades,
            "risk_of_bias": self.risk_of_bias.to_dict() if self.risk_of_bias else None,
            "inconsistency": self.inconsistency.to_dict() if self.inconsistency else None,
            "indirectness": self.indirectness.to_dict() if self.indirectness else None,
            "imprecision": self.imprecision.to_dict() if self.imprecision else None,
            "publication_bias": self.publication_bias.to_dict() if self.publication_bias else None,
            "upgrade_factors": self.upgrade_factors,
            "study_metadata": self.study_metadata.to_dict() if self.study_metadata else None,
            "effect_estimate": self.effect_estimate.to_dict() if self.effect_estimate else None,
            "confidence_score": self.confidence_score,
            "confidence_interval": list(self.confidence_interval),
            "evidence_summary": self.evidence_summary,
            "clinical_implications": self.clinical_implications,
            "confidence_statement": self.final_grade.confidence_statement,
        }


# =============================================================================
# EVIDENCE SCORER CLASS
# =============================================================================

class EvidenceScorer:
    """
    GRADE Evidence Quality Scoring System.
    
    Implements the GRADE approach for rating evidence quality:
    1. Start with study design-based quality
    2. Downgrade for limitations (risk of bias, inconsistency, indirectness, imprecision, publication bias)
    3. Upgrade for strengths (large effect, dose-response, negative confounders)
    
    References:
    - GRADE Handbook (2013)
    - Guyatt GH et al. GRADE guidelines: 1. J Clin Epidemiol. 2011;64:383-94.
    """
    
    def __init__(self):
        self.settings = get_settings()
        
        self.stats = {
            "total_assessments": 0,
            "high_evidence_count": 0,
            "moderate_evidence_count": 0,
            "low_evidence_count": 0,
            "very_low_evidence_count": 0,
            "average_confidence": 0.0,
        }
    
    def classify_study_design(self, study_data: Dict[str, Any]) -> StudyDesignType:
        """
        Classify the study design from study metadata.
        
        Args:
            study_data: Dictionary containing study metadata
            
        Returns:
            StudyDesignType classification
        """
        # Check explicit design type
        if "study_design" in study_data:
            design_str = str(study_data["study_design"]).lower()
            
            if "randomized" in design_str or "rct" in design_str:
                return StudyDesignType.RANDOMIZED_CONTROLLED_TRIAL
            elif "systematic review" in design_str and "rct" in design_str:
                return StudyDesignType.SYSTEMATIC_REVIEW_RCT
            elif "meta-analysis" in design_str or "meta analysis" in design_str:
                return StudyDesignType.META_ANALYSIS
            elif "cohort" in design_str:
                return StudyDesignType.COHORT_STUDY
            elif "case-control" in design_str or "case control" in design_str:
                return StudyDesignType.CASE_CONTROL_STUDY
            elif "cross-sectional" in design_str:
                return StudyDesignType.CROSS_SECTIONAL
            elif "case series" in design_str:
                return StudyDesignType.CASE_SERIES
            elif "case report" in design_str:
                return StudyDesignType.CASE_REPORT
            elif "guideline" in design_str:
                return StudyDesignType.GUIDELINE
            elif "review" in design_str:
                return StudyDesignType.NARRATIVE_REVIEW
        
        # Infer from publication type
        pub_type = study_data.get("publication_type", "").lower()
        mesh_terms = [t.lower() for t in study_data.get("mesh_terms", [])]
        
        if "randomized controlled trial" in pub_type:
            return StudyDesignType.RANDOMIZED_CONTROLLED_TRIAL
        elif "meta-analysis" in pub_type:
            return StudyDesignType.META_ANALYSIS
        elif "systematic review" in pub_type:
            return StudyDesignType.SYSTEMATIC_REVIEW_RCT
        elif "cohort studies" in mesh_terms:
            return StudyDesignType.COHORT_STUDY
        elif "case-control studies" in mesh_terms:
            return StudyDesignType.CASE_CONTROL_STUDY
        elif "case reports" in mesh_terms or "case report" in pub_type:
            return StudyDesignType.CASE_REPORT
        
        # Default to expert opinion if unknown
        return StudyDesignType.EXPERT_OPINION
    
    def assess_risk_of_bias(
        self,
        study_data: Dict[str, Any],
        study_design: StudyDesignType,
    ) -> QualityAssessment:
        """
        Assess risk of bias for a study.
        
        Args:
            study_data: Study metadata
            study_design: Classified study design
            
        Returns:
            QualityAssessment for risk of bias domain
        """
        # For observational studies, risk of bias assessment differs
        if study_design in [StudyDesignType.COHORT_STUDY, StudyDesignType.CASE_CONTROL_STUDY]:
            return self._assess_observational_bias(study_data)
        
        # For RCTs, use Cochrane Risk of Bias domains
        bias_scores = {}
        justifications = []
        
        # Randomization
        randomization = study_data.get("randomization", "")
        if any(x in randomization.lower() for x in ["random", "computer", "allocation"]):
            bias_scores["randomization"] = 0
            justifications.append("Adequate randomization sequence generation")
        elif randomization:
            bias_scores["randomization"] = 1
            justifications.append("Inadequate or unclear randomization")
        else:
            bias_scores["randomization"] = 0.5  # Unclear
        
        # Allocation concealment
        allocation = study_data.get("allocation_concealment", "")
        if any(x in allocation.lower() for x in ["concealed", "central", "pharmacy"]):
            bias_scores["allocation_concealment"] = 0
            justifications.append("Adequate allocation concealment")
        else:
            bias_scores["allocation_concealment"] = 0.5
            justifications.append("Allocation concealment unclear")
        
        # Blinding
        blinding = study_data.get("blinding", "").lower()
        if "double" in blinding or "triple" in blinding:
            bias_scores["blinding"] = 0
            justifications.append("Double or triple blinding implemented")
        elif "single" in blinding or "blind" in blinding:
            bias_scores["blinding"] = 0.5
            justifications.append("Single blinding only")
        elif "open" in blinding or "no blinding" in blinding:
            bias_scores["blinding"] = 1
            justifications.append("Open-label study")
        else:
            bias_scores["blinding"] = 0.5
            justifications.append("Blinding unclear")
        
        # Incomplete outcome data
        dropout_rate = study_data.get("dropout_rate", 0)
        itt_analysis = study_data.get("intention_to_treat", False)
        
        if dropout_rate < 0.1 and itt_analysis:
            bias_scores["incomplete_outcome"] = 0
            justifications.append(f"Low dropout ({dropout_rate*100:.1f}%), ITT analysis")
        elif dropout_rate > 0.2:
            bias_scores["incomplete_outcome"] = 1
            justifications.append(f"High dropout rate ({dropout_rate*100:.1f}%)")
        else:
            bias_scores["incomplete_outcome"] = 0.5
            justifications.append("Moderate dropout, handling unclear")
        
        # Selective reporting
        selective = study_data.get("selective_reporting", "")
        if selective == "none" or "all outcomes reported" in selective.lower():
            bias_scores["selective_reporting"] = 0
            justifications.append("No selective reporting detected")
        elif selective:
            bias_scores["selective_reporting"] = 1
            justifications.append("Potential selective reporting")
        else:
            bias_scores["selective_reporting"] = 0.5
            justifications.append("Selective reporting assessment unclear")
        
        # Calculate overall risk
        weighted_score = sum(
            score * RISK_OF_BIAS_DOMAINS.get(domain, {}).get("weight", 0.1)
            for domain, score in bias_scores.items()
        )
        
        if weighted_score < 0.25:
            level = "low"
            downgrade = 0
        elif weighted_score < 0.5:
            level = "moderate"
            downgrade = 1
        elif weighted_score < 0.75:
            level = "high"
            downgrade = 2
        else:
            level = "very_high"
            downgrade = 2
        
        return QualityAssessment(
            domain="risk_of_bias",
            level=level,
            score=weighted_score,
            justification="; ".join(justifications),
            downgrade_amount=downgrade,
        )
    
    def _assess_observational_bias(self, study_data: Dict[str, Any]) -> QualityAssessment:
        """Assess risk of bias for observational studies using ROBINS-I or Newcastle-Ottawa."""
        justifications = []
        total_score = 0
        
        # Selection bias
        if study_data.get("representative_sample"):
            justifications.append("Representative sample selection")
        else:
            total_score += 0.25
            justifications.append("Potential selection bias")
        
        # Confounding
        if study_data.get("adjusted_for_confounders"):
            justifications.append("Adjusted for key confounders")
        else:
            total_score += 0.25
            justifications.append("Limited confounder adjustment")
        
        # Measurement bias
        if study_data.get("validated_outcome_measure"):
            justifications.append("Validated outcome measurement")
        else:
            total_score += 0.2
            justifications.append("Outcome measurement unclear")
        
        # Follow-up
        dropout = study_data.get("dropout_rate", 0)
        if dropout > 0.2:
            total_score += 0.2
            justifications.append(f"High attrition ({dropout*100:.1f}%)")
        else:
            justifications.append(f"Adequate follow-up ({(1-dropout)*100:.1f}%)")
        
        if total_score < 0.25:
            level = "low"
            downgrade = 0
        elif total_score < 0.5:
            level = "moderate"
            downgrade = 1
        else:
            level = "high"
            downgrade = 2
        
        return QualityAssessment(
            domain="risk_of_bias",
            level=level,
            score=total_score,
            justification="; ".join(justifications),
            downgrade_amount=downgrade,
        )
    
    def assess_inconsistency(
        self,
        effect_estimates: List[Dict[str, Any]],
        heterogeneity_stats: Optional[Dict[str, Any]] = None,
    ) -> QualityAssessment:
        """
        Assess inconsistency across studies.
        
        Args:
            effect_estimates: List of effect estimates from multiple studies
            heterogeneity_stats: Heterogeneity statistics (I², chi-square, tau²)
            
        Returns:
            QualityAssessment for inconsistency domain
        """
        justifications = []
        
        if len(effect_estimates) < 2:
            return QualityAssessment(
                domain="inconsistency",
                level="none",
                score=0.0,
                justification="Single study - inconsistency not applicable",
                downgrade_amount=0,
            )
        
        # Check for heterogeneity statistics
        i_squared = heterogeneity_stats.get("i_squared", 0) if heterogeneity_stats else 0
        
        # Calculate variability in effect estimates
        effects = [e.get("effect_size", 0) for e in effect_estimates if e.get("effect_size")]
        
        if effects:
            mean_effect = sum(effects) / len(effects)
            variance = sum((e - mean_effect) ** 2 for e in effects) / len(effects)
            std_dev = variance ** 0.5
            
            # Coefficient of variation
            cv = std_dev / abs(mean_effect) if mean_effect != 0 else 0
        else:
            cv = 0
        
        # Check direction of effects
        positive = sum(1 for e in effects if e > 1.0)  # For ratio measures
        negative = sum(1 for e in effects if e < 1.0)
        
        # Determine inconsistency level
        if i_squared < 0.3 and (positive == 0 or negative == 0):
            level = "none"
            downgrade = 0
            justifications.append(f"Low heterogeneity (I²={i_squared*100:.1f}%), consistent direction")
        elif i_squared < 0.5 and cv < 0.5:
            level = "serious"
            downgrade = 1
            justifications.append(f"Moderate heterogeneity (I²={i_squared*100:.1f}%), some variability")
        elif i_squared >= 0.5 or cv >= 0.5 or (positive > 0 and negative > 0):
            level = "very_serious"
            downgrade = 2
            justifications.append(f"High heterogeneity (I²={i_squared*100:.1f}%) or conflicting directions")
        else:
            level = "serious"
            downgrade = 1
            justifications.append("Moderate inconsistency in effect estimates")
        
        return QualityAssessment(
            domain="inconsistency",
            level=level,
            score=i_squared,
            justification="; ".join(justifications),
            downgrade_amount=downgrade,
        )
    
    def assess_indirectness(
        self,
        study_data: Dict[str, Any],
        target_population: str = "",
        target_intervention: str = "",
        target_outcome: str = "",
    ) -> QualityAssessment:
        """
        Assess indirectness (applicability to clinical question).
        
        Args:
            study_data: Study metadata
            target_population: Target patient population
            target_intervention: Target intervention
            target_outcome: Target outcome
            
        Returns:
            QualityAssessment for indirectness domain
        """
        indirectness_score = 0.0
        justifications = []
        
        # Population indirectness
        study_population = study_data.get("population", "").lower()
        if target_population:
            # Check for population match
            target_lower = target_population.lower()
            if not any(x in study_population for x in target_lower.split()):
                indirectness_score += 0.3
                justifications.append("Study population differs from target population")
            else:
                justifications.append("Study population matches target")
        else:
            justifications.append("Population indirectness not assessed (no target specified)")
        
        # Intervention indirectness
        study_intervention = study_data.get("intervention", "").lower()
        if target_intervention:
            target_lower = target_intervention.lower()
            if target_lower not in study_intervention:
                indirectness_score += 0.3
                justifications.append("Intervention differs from target")
            else:
                justifications.append("Intervention matches target")
        
        # Outcome indirectness
        study_outcomes = [o.lower() for o in study_data.get("outcomes", [])]
        if target_outcome:
            target_lower = target_outcome.lower()
            if not any(target_lower in o for o in study_outcomes):
                indirectness_score += 0.3
                justifications.append("Primary outcome differs from target")
            else:
                justifications.append("Outcome matches target")
        
        # Indirect comparison check
        if study_data.get("indirect_comparison"):
            indirectness_score += 0.2
            justifications.append("Indirect comparison used")
        
        # Determine level
        if indirectness_score < 0.2:
            level = "none"
            downgrade = 0
        elif indirectness_score < 0.5:
            level = "serious"
            downgrade = 1
        else:
            level = "very_serious"
            downgrade = 2
        
        return QualityAssessment(
            domain="indirectness",
            level=level,
            score=indirectness_score,
            justification="; ".join(justifications),
            downgrade_amount=downgrade,
        )
    
    def assess_imprecision(
        self,
        effect_estimate: Optional[Dict[str, Any]],
        sample_size: int,
        event_rate: Optional[float] = None,
        optimal_information_size: Optional[int] = None,
    ) -> QualityAssessment:
        """
        Assess imprecision in effect estimate.
        
        Args:
            effect_estimate: Effect size with confidence interval
            sample_size: Total sample size
            event_rate: Event rate for binary outcomes
            optimal_information_size: Required sample size for adequate power
            
        Returns:
            QualityAssessment for imprecision domain
        """
        justifications = []
        imprecision_score = 0.0
        
        if not effect_estimate:
            return QualityAssessment(
                domain="imprecision",
                level="very_serious",
                score=1.0,
                justification="No effect estimate available",
                downgrade_amount=2,
            )
        
        # Check confidence interval width
        ci_lower = effect_estimate.get("confidence_interval_lower", 0)
        ci_upper = effect_estimate.get("confidence_interval_upper", 1)
        
        ci_width = abs(ci_upper - ci_lower)
        ci_includes_null = ci_lower < 1.0 < ci_upper if effect_estimate.get("effect_type") in ["relative_risk", "odds_ratio", "hazard_ratio"] else ci_lower < 0 < ci_upper
        
        # For ratio measures
        if effect_estimate.get("effect_type") in ["relative_risk", "odds_ratio", "hazard_ratio"]:
            # Check if CI crosses clinically important thresholds
            if ci_includes_null:
                imprecision_score += 0.4
                justifications.append("Confidence interval crosses no effect (1.0)")
            
            # Check if CI crosses clinically important effect
            if ci_lower < 0.8 and ci_upper > 1.25:
                imprecision_score += 0.3
                justifications.append("Wide confidence interval crosses clinically important thresholds")
        else:
            # For continuous measures
            if ci_includes_null:
                imprecision_score += 0.4
                justifications.append("Confidence interval includes null effect")
        
        # Check optimal information size
        ois = optimal_information_size or self._calculate_optimal_information_size(
            effect_estimate, event_rate
        )
        
        if sample_size < ois * 0.5:
            imprecision_score += 0.3
            justifications.append(f"Sample size ({sample_size}) < 50% of optimal ({ois})")
        elif sample_size < ois:
            imprecision_score += 0.1
            justifications.append(f"Sample size ({sample_size}) below optimal ({ois})")
        else:
            justifications.append(f"Adequate sample size ({sample_size})")
        
        # Determine level
        if imprecision_score < 0.2:
            level = "none"
            downgrade = 0
        elif imprecision_score < 0.5:
            level = "serious"
            downgrade = 1
        else:
            level = "very_serious"
            downgrade = 2
        
        return QualityAssessment(
            domain="imprecision",
            level=level,
            score=imprecision_score,
            justification="; ".join(justifications),
            downgrade_amount=downgrade,
        )
    
    def _calculate_optimal_information_size(
        self,
        effect_estimate: Dict[str, Any],
        event_rate: Optional[float] = None,
    ) -> int:
        """Calculate optimal information size for adequate power."""
        # Simplified calculation - typically done with power analysis
        # Default to moderate effect size assumptions
        
        if event_rate:
            # For binary outcomes
            # Using simplified formula: n = 4 * (Z_alpha + Z_beta)^2 * p(1-p) / d^2
            # where p is event rate, d is effect size
            alpha = 0.05  # 1.96
            beta = 0.2    # 0.84 (80% power)
            z_alpha = 1.96
            z_beta = 0.84
            
            effect = abs(effect_estimate.get("effect_size", 0.5))
            if effect > 0:
                d = min(abs(effect - 1), 0.5)  # Effect size for binary
            else:
                d = 0.3
            
            n = 4 * (z_alpha + z_beta) ** 2 * event_rate * (1 - event_rate) / (d ** 2)
            return int(n * 2)  # Both groups
        
        # Default for continuous outcomes
        return 400  # Standard RCT size assumption
    
    def assess_publication_bias(
        self,
        studies: List[Dict[str, Any]],
        funnel_plot_symmetry: Optional[bool] = None,
        trim_fill_analysis: Optional[Dict[str, Any]] = None,
    ) -> QualityAssessment:
        """
        Assess likelihood of publication bias.
        
        Args:
            studies: List of studies in meta-analysis
            funnel_plot_symmetry: Whether funnel plot appears symmetric
            trim_fill_analysis: Results of trim-and-fill analysis
            
        Returns:
            QualityAssessment for publication bias domain
        """
        justifications = []
        
        if len(studies) < 10:
            # Funnel plot unreliable with few studies
            return QualityAssessment(
                domain="publication_bias",
                level="undetected",
                score=0.0,
                justification="Too few studies (<10) to assess publication bias",
                downgrade_amount=0,
            )
        
        # Check funnel plot symmetry
        if funnel_plot_symmetry is False:
            justifications.append("Funnel plot asymmetry detected")
            if trim_fill_analysis:
                adjusted_effect = trim_fill_analysis.get("adjusted_effect")
                original_effect = trim_fill_analysis.get("original_effect")
                if adjusted_effect and original_effect:
                    difference = abs(adjusted_effect - original_effect)
                    if difference > 0.1:
                        return QualityAssessment(
                            domain="publication_bias",
                            level="detected",
                            score=1.0,
                            justification=f"Publication bias detected: trim-and-fill shows {difference:.2f} difference in effect",
                            downgrade_amount=1,
                        )
            return QualityAssessment(
                domain="publication_bias",
                level="suspected",
                score=0.6,
                justification="Funnel plot asymmetry suggests possible publication bias",
                downgrade_amount=1,
            )
        
        # Check for small study effects
        small_studies = [s for s in studies if s.get("sample_size", 0) < 100]
        large_studies = [s for s in studies if s.get("sample_size", 0) >= 100]
        
        if small_studies and large_studies:
            # Compare effect estimates
            small_effects = [s.get("effect_size", 0) for s in small_studies if s.get("effect_size")]
            large_effects = [s.get("effect_size", 0) for s in large_studies if s.get("effect_size")]
            
            if small_effects and large_effects:
                small_mean = sum(small_effects) / len(small_effects)
                large_mean = sum(large_effects) / len(large_effects)
                
                if abs(small_mean - large_mean) > 0.2:
                    justifications.append("Small study effects detected - larger effects in smaller studies")
                    return QualityAssessment(
                        domain="publication_bias",
                        level="suspected",
                        score=0.7,
                        justification="; ".join(justifications),
                        downgrade_amount=1,
                    )
        
        return QualityAssessment(
            domain="publication_bias",
            level="undetected",
            score=0.0,
            justification="No evidence of publication bias",
            downgrade_amount=0,
        )
    
    def check_upgrade_factors(
        self,
        study_data: Dict[str, Any],
        effect_estimate: Optional[Dict[str, Any]],
    ) -> Tuple[int, List[str]]:
        """
        Check for factors that upgrade evidence quality.
        
        Upgrade factors for observational studies:
        1. Large magnitude of effect (RR > 2 or < 0.5)
        2. Dose-response relationship
        3. All plausible confounders would reduce effect
        
        Args:
            study_data: Study metadata
            effect_estimate: Effect size data
            
        Returns:
            Tuple of (upgrade_count, list of upgrade reasons)
        """
        upgrades = 0
        reasons = []
        
        if not effect_estimate:
            return upgrades, reasons
        
        effect_size = effect_estimate.get("effect_size", 1.0)
        
        # Large effect size check
        if effect_size > 2.0 or effect_size < 0.5:
            upgrades += 1
            reasons.append(f"Large effect size ({effect_size:.2f})")
        
        # Very large effect
        if effect_size > 5.0 or effect_size < 0.2:
            upgrades += 1
            reasons.append(f"Very large effect size ({effect_size:.2f})")
        
        # Dose-response relationship
        if study_data.get("dose_response_relationship"):
            upgrades += 1
            reasons.append("Dose-response gradient demonstrated")
        
        # Negative confounding
        if study_data.get("negative_confounding"):
            upgrades += 1
            reasons.append("Plausible confounders would reduce observed effect")
        
        return upgrades, reasons
    
    async def score_evidence(
        self,
        study_data: Dict[str, Any],
        effect_estimate: Optional[Dict[str, Any]] = None,
        heterogeneity_stats: Optional[Dict[str, Any]] = None,
        target_population: str = "",
        target_intervention: str = "",
        target_outcome: str = "",
        funnel_plot_symmetry: Optional[bool] = None,
    ) -> EvidenceScore:
        """
        Generate comprehensive GRADE evidence quality score.
        
        Args:
            study_data: Study metadata dictionary
            effect_estimate: Effect size with confidence interval
            heterogeneity_stats: Heterogeneity statistics
            target_population: Target patient population
            target_intervention: Target intervention
            target_outcome: Target clinical outcome
            funnel_plot_symmetry: Funnel plot symmetry assessment
            
        Returns:
            EvidenceScore with comprehensive GRADE assessment
        """
        start_time = time.time()
        request_id = f"grade_{int(time.time() * 1000)}"
        
        self.stats["total_assessments"] += 1
        
        # Classify study design
        study_design = self.classify_study_design(study_data)
        
        # Get initial quality level based on design
        initial_grade = STUDY_DESIGN_QUALITY.get(study_design, GRADELevel.VERY_LOW)
        
        # Build study metadata
        study_metadata = StudyMetadata(
            pmid=study_data.get("pmid", ""),
            title=study_data.get("title", ""),
            authors=study_data.get("authors", []),
            journal=study_data.get("journal"),
            publication_year=study_data.get("publication_year"),
            study_design=study_design,
            sample_size=study_data.get("sample_size", 0),
            population=study_data.get("population", ""),
            intervention=study_data.get("intervention", ""),
            comparator=study_data.get("comparator", ""),
            outcomes=study_data.get("outcomes", []),
            follow_up_duration=study_data.get("follow_up_duration"),
            funding_source=study_data.get("funding_source"),
        )
        
        # Build effect estimate
        effect_obj = None
        if effect_estimate:
            effect_obj = EffectEstimate(
                effect_size=effect_estimate.get("effect_size", 0),
                effect_type=effect_estimate.get("effect_type", "relative_risk"),
                confidence_interval_lower=effect_estimate.get("confidence_interval_lower", 0),
                confidence_interval_upper=effect_estimate.get("confidence_interval_upper", 1),
                p_value=effect_estimate.get("p_value"),
                standard_error=effect_estimate.get("standard_error"),
                number_needed_to_treat=effect_estimate.get("number_needed_to_treat"),
            )
        
        # Assess domains
        risk_of_bias = self.assess_risk_of_bias(study_data, study_design)
        inconsistency = self.assess_inconsistency(
            [effect_estimate] if effect_estimate else [],
            heterogeneity_stats,
        )
        indirectness = self.assess_indirectness(
            study_data, target_population, target_intervention, target_outcome
        )
        imprecision = self.assess_imprecision(
            effect_estimate,
            study_data.get("sample_size", 0),
            study_data.get("event_rate"),
        )
        publication_bias = self.assess_publication_bias(
            [study_data], funnel_plot_symmetry
        )
        
        # Calculate total downgrades
        total_downgrades = (
            risk_of_bias.downgrade_amount +
            inconsistency.downgrade_amount +
            indirectness.downgrade_amount +
            imprecision.downgrade_amount +
            publication_bias.downgrade_amount
        )
        
        # Check upgrade factors
        total_upgrades, upgrade_factors = self.check_upgrade_factors(
            study_data, effect_estimate
        )
        
        # Calculate final grade
        # Start from initial quality level (as numeric: 4=High, 3=Moderate, 2=Low, 1=Very Low)
        grade_values = {
            GRADELevel.HIGH: 4,
            GRADELevel.MODERATE: 3,
            GRADELevel.LOW: 2,
            GRADELevel.VERY_LOW: 1,
        }
        grade_from_value = {v: k for k, v in grade_values.items()}
        
        final_value = grade_values[initial_grade] - total_downgrades + total_upgrades
        final_value = max(1, min(4, final_value))  # Clamp to valid range
        final_grade = grade_from_value[final_value]
        
        # Calculate confidence score (0-100)
        confidence_score = self._calculate_confidence_score(
            final_grade, risk_of_bias, inconsistency, indirectness, imprecision
        )
        
        # Calculate confidence interval for confidence score
        ci_margin = 15 if final_grade in [GRADELevel.LOW, GRADELevel.VERY_LOW] else 10
        confidence_interval = (
            max(0, confidence_score - ci_margin),
            min(100, confidence_score + ci_margin),
        )
        
        # Generate evidence summary
        evidence_summary = self._generate_evidence_summary(
            study_design, final_grade, risk_of_bias, inconsistency,
            indirectness, imprecision, publication_bias, upgrade_factors
        )
        
        # Generate clinical implications
        clinical_implications = self._generate_clinical_implications(
            final_grade, effect_estimate, study_data
        )
        
        # Update stats
        if final_grade == GRADELevel.HIGH:
            self.stats["high_evidence_count"] += 1
        elif final_grade == GRADELevel.MODERATE:
            self.stats["moderate_evidence_count"] += 1
        elif final_grade == GRADELevel.LOW:
            self.stats["low_evidence_count"] += 1
        else:
            self.stats["very_low_evidence_count"] += 1
        
        self.stats["average_confidence"] = (
            (self.stats["average_confidence"] * (self.stats["total_assessments"] - 1) + confidence_score)
            / self.stats["total_assessments"]
        )
        
        return EvidenceScore(
            request_id=request_id,
            timestamp=datetime.utcnow().isoformat(),
            pmid=study_data.get("pmid", ""),
            study_design=study_design,
            initial_grade=initial_grade,
            final_grade=final_grade,
            total_downgrades=total_downgrades,
            total_upgrades=total_upgrades,
            risk_of_bias=risk_of_bias,
            inconsistency=inconsistency,
            indirectness=indirectness,
            imprecision=imprecision,
            publication_bias=publication_bias,
            upgrade_factors=upgrade_factors,
            study_metadata=study_metadata,
            effect_estimate=effect_obj,
            confidence_score=confidence_score,
            confidence_interval=confidence_interval,
            evidence_summary=evidence_summary,
            clinical_implications=clinical_implications,
        )
    
    def _calculate_confidence_score(
        self,
        final_grade: GRADELevel,
        risk_of_bias: QualityAssessment,
        inconsistency: QualityAssessment,
        indirectness: QualityAssessment,
        imprecision: QualityAssessment,
    ) -> float:
        """Calculate overall confidence score (0-100)."""
        base_scores = {
            GRADELevel.HIGH: 90,
            GRADELevel.MODERATE: 70,
            GRADELevel.LOW: 40,
            GRADELevel.VERY_LOW: 15,
        }
        
        base = base_scores[final_grade]
        
        # Adjust based on domain assessments
        adjustments = 0
        if risk_of_bias.level == "low":
            adjustments += 5
        elif risk_of_bias.level == "high":
            adjustments -= 10
        
        if inconsistency.level == "none":
            adjustments += 5
        elif inconsistency.level == "very_serious":
            adjustments -= 10
        
        if indirectness.level == "none":
            adjustments += 5
        elif indirectness.level == "very_serious":
            adjustments -= 10
        
        if imprecision.level == "none":
            adjustments += 5
        elif imprecision.level == "very_serious":
            adjustments -= 10
        
        return max(0, min(100, base + adjustments))
    
    def _generate_evidence_summary(
        self,
        study_design: StudyDesignType,
        final_grade: GRADELevel,
        risk_of_bias: QualityAssessment,
        inconsistency: QualityAssessment,
        indirectness: QualityAssessment,
        imprecision: QualityAssessment,
        publication_bias: QualityAssessment,
        upgrade_factors: List[str],
    ) -> str:
        """Generate comprehensive evidence summary."""
        parts = []
        
        parts.append(f"This {study_design.value.upper()} provides {final_grade.value} quality evidence.")
        
        # Add domain summaries
        if risk_of_bias.downgrade_amount > 0:
            parts.append(f"Quality downgraded due to {risk_of_bias.level} risk of bias.")
        
        if inconsistency.downgrade_amount > 0:
            parts.append(f"Quality downgraded due to {inconsistency.level} inconsistency.")
        
        if indirectness.downgrade_amount > 0:
            parts.append(f"Quality downgraded due to {indirectness.level} indirectness.")
        
        if imprecision.downgrade_amount > 0:
            parts.append(f"Quality downgraded due to {imprecision.level} imprecision.")
        
        if upgrade_factors:
            parts.append(f"Quality upgraded due to: {', '.join(upgrade_factors)}.")
        
        return " ".join(parts)
    
    def _generate_clinical_implications(
        self,
        final_grade: GRADELevel,
        effect_estimate: Optional[Dict[str, Any]],
        study_data: Dict[str, Any],
    ) -> str:
        """Generate clinical implications based on evidence quality."""
        implications = []
        
        if final_grade == GRADELevel.HIGH:
            implications.append(
                "This evidence can be confidently used to guide clinical decision-making. "
                "The estimate of effect is reliable and further research is unlikely to change it."
            )
        elif final_grade == GRADELevel.MODERATE:
            implications.append(
                "This evidence can be used for clinical decision-making with appropriate caution. "
                "Future research may refine the estimate of effect."
            )
        elif final_grade == GRADELevel.LOW:
            implications.append(
                "Clinical decisions should consider the limitations of this evidence. "
                "The true effect may be substantially different from the estimate. "
                "Consider additional evidence sources or clinical expertise."
            )
        else:
            implications.append(
                "Evidence is very uncertain. Clinical decisions should not be based solely "
                "on this evidence. Consider expert consultation and additional information sources."
            )
        
        if effect_estimate:
            effect = effect_estimate.get("effect_size")
            ci_lower = effect_estimate.get("confidence_interval_lower")
            ci_upper = effect_estimate.get("confidence_interval_upper")
            
            if effect and ci_lower and ci_upper:
                implications.append(
                    f"Estimated effect: {effect:.2f} (95% CI: {ci_lower:.2f} - {ci_upper:.2f})."
                )
        
        return " ".join(implications)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get evidence scoring statistics."""
        return self.stats.copy()


# =============================================================================
# BATCH PROCESSING
# =============================================================================

async def score_evidence_batch(
    studies: List[Dict[str, Any]],
    scorer: Optional[EvidenceScorer] = None,
) -> List[EvidenceScore]:
    """
    Score multiple studies in batch.
    
    Args:
        studies: List of study data dictionaries
        scorer: EvidenceScorer instance (creates new if None)
        
    Returns:
        List of EvidenceScore objects
    """
    if scorer is None:
        scorer = EvidenceScorer()
    
    results = []
    for study in studies:
        score = await scorer.score_evidence(study)
        results.append(score)
    
    return results
