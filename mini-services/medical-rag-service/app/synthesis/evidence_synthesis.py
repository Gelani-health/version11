"""
P3: Evidence Synthesis Engine for Clinical Decision Support
============================================================

Implements comprehensive multi-source evidence synthesis:
- Meta-analysis simulation across multiple studies
- Evidence conflict resolution
- Consensus building with agreement metrics
- Evidence gap identification
- Clinical recommendation synthesis

Evidence Synthesis Framework:
1. Evidence Collection → Multi-source retrieval
2. Quality Assessment → GRADE scoring integration
3. Conflict Detection → Disagreement identification
4. Consensus Building → Weighted evidence aggregation
5. Recommendation Synthesis → Clinical guidance generation

References:
- Cochrane Handbook for Systematic Reviews
- IOM Standards for Systematic Reviews
- PRISMA Guidelines
"""

import asyncio
import time
import math
import re
from typing import Optional, List, Dict, Any, Tuple, Set
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

class ConsensusLevel(Enum):
    """Levels of evidence consensus."""
    STRONG = "strong"           # >80% agreement
    MODERATE = "moderate"       # 60-80% agreement
    WEAK = "weak"               # 40-60% agreement
    NO_CONSENSUS = "no_consensus"  # <40% agreement


class ConflictType(Enum):
    """Types of evidence conflicts."""
    DIRECTION = "direction"         # Opposing effect directions
    MAGNITUDE = "magnitude"         # Significant magnitude difference
    POPULATION = "population"       # Different populations
    METHODOLOGY = "methodology"     # Methodological differences
    PUBLICATION_BIAS = "publication_bias"  # Suspected bias
    HETEROGENEITY = "heterogeneity"  # High statistical heterogeneity


class EvidenceGapType(Enum):
    """Types of evidence gaps."""
    NO_STUDIES = "no_studies"           # No studies found
    INSUFFICIENT = "insufficient"        # Insufficient evidence
    INDIRECT = "indirect"               # Indirect evidence only
    INCONSISTENT = "inconsistent"        # Inconsistent results
    IMPRECISE = "imprecise"             # Imprecise estimates
    REPORTING_BIAS = "reporting_bias"   # Suspected reporting bias


class RecommendationStrength(Enum):
    """Strength of clinical recommendations."""
    STRONG = "strong"
    CONDITIONAL = "conditional"
    WEAK = "weak"
    INSUFFICIENT = "insufficient"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class EvidenceSource:
    """A single evidence source (study/article)."""
    pmid: str
    title: str
    study_design: str
    sample_size: int
    effect_size: Optional[float] = None
    effect_direction: Optional[str] = None  # "positive", "negative", "neutral"
    confidence_interval: Optional[Tuple[float, float]] = None
    p_value: Optional[float] = None
    grade_level: str = "C"
    population: str = ""
    intervention: str = ""
    outcomes: List[str] = field(default_factory=list)
    weight: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "title": self.title,
            "study_design": self.study_design,
            "sample_size": self.sample_size,
            "effect_size": self.effect_size,
            "effect_direction": self.effect_direction,
            "confidence_interval": list(self.confidence_interval) if self.confidence_interval else None,
            "p_value": self.p_value,
            "grade_level": self.grade_level,
            "weight": self.weight,
        }


@dataclass
class EvidenceConflict:
    """Detected conflict between evidence sources."""
    conflict_type: ConflictType
    sources: List[str]  # PMIDs
    description: str
    severity: str  # "high", "medium", "low"
    resolution_suggestion: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "sources": self.sources,
            "description": self.description,
            "severity": self.severity,
            "resolution_suggestion": self.resolution_suggestion,
        }


@dataclass
class EvidenceGap:
    """Identified gap in evidence."""
    gap_type: EvidenceGapType
    description: str
    clinical_question: str
    impact: str  # "high", "medium", "low"
    research_needed: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "gap_type": self.gap_type.value,
            "description": self.description,
            "clinical_question": self.clinical_question,
            "impact": self.impact,
            "research_needed": self.research_needed,
        }


@dataclass
class SynthesizedEvidence:
    """Synthesized evidence from multiple sources."""
    question: str
    sources: List[EvidenceSource]
    consensus_level: ConsensusLevel
    pooled_effect_size: Optional[float]
    confidence_interval: Optional[Tuple[float, float]]
    heterogeneity_i2: float
    conflicts: List[EvidenceConflict] = field(default_factory=list)
    gaps: List[EvidenceGap] = field(default_factory=list)
    recommendation: str = ""
    recommendation_strength: RecommendationStrength = RecommendationStrength.WEAK
    confidence_score: float = 0.0
    evidence_summary: str = ""
    clinical_implications: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "question": self.question,
            "sources": [s.to_dict() for s in self.sources],
            "consensus_level": self.consensus_level.value,
            "pooled_effect_size": self.pooled_effect_size,
            "confidence_interval": list(self.confidence_interval) if self.confidence_interval else None,
            "heterogeneity_i2": round(self.heterogeneity_i2, 3),
            "conflicts": [c.to_dict() for c in self.conflicts],
            "gaps": [g.to_dict() for g in self.gaps],
            "recommendation": self.recommendation,
            "recommendation_strength": self.recommendation_strength.value,
            "confidence_score": round(self.confidence_score, 3),
            "evidence_summary": self.evidence_summary,
            "clinical_implications": self.clinical_implications,
        }


@dataclass
class SynthesisResult:
    """Complete synthesis result with all components."""
    request_id: str
    timestamp: str
    clinical_question: str
    synthesized_evidence: SynthesizedEvidence
    quality_summary: Dict[str, Any]
    processing_time_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "clinical_question": self.clinical_question,
            "synthesized_evidence": self.synthesized_evidence.to_dict(),
            "quality_summary": self.quality_summary,
            "processing_time_ms": round(self.processing_time_ms, 2),
        }


# =============================================================================
# EVIDENCE SYNTHESIS ENGINE
# =============================================================================

class EvidenceSynthesisEngine:
    """
    P3: Comprehensive Evidence Synthesis Engine for Clinical Decision Support.
    
    Implements systematic review methodology for synthesizing evidence from
    multiple sources into actionable clinical recommendations.
    
    Key Features:
    - Multi-source evidence aggregation
    - Meta-analysis simulation
    - Conflict detection and resolution
    - Evidence gap identification
    - Consensus-based recommendations
    """
    
    # Weight factors for different study designs
    STUDY_WEIGHTS = {
        "meta_analysis": 5.0,
        "systematic_review": 4.5,
        "rct": 3.0,
        "cohort": 2.0,
        "case_control": 1.5,
        "cross_sectional": 1.0,
        "case_series": 0.5,
        "case_report": 0.3,
        "expert_opinion": 0.2,
    }
    
    # GRADE quality weights
    GRADE_WEIGHTS = {
        "A": 1.0,
        "B": 0.8,
        "C": 0.6,
        "D": 0.3,
    }
    
    def __init__(self):
        self.settings = get_settings()
        
        self.stats = {
            "total_syntheses": 0,
            "average_sources": 0.0,
            "average_consensus": 0.0,
            "conflicts_detected": 0,
            "gaps_identified": 0,
        }
    
    def _calculate_source_weight(self, source: EvidenceSource) -> float:
        """Calculate weight for an evidence source based on quality and design."""
        design_weight = self.STUDY_WEIGHTS.get(source.study_design.lower(), 1.0)
        grade_weight = self.GRADE_WEIGHTS.get(source.grade_level.upper(), 0.5)
        
        # Sample size factor (logarithmic scaling)
        size_factor = math.log10(max(source.sample_size, 10)) / 4  # Normalize to ~0.25-1.0
        
        # Combined weight
        weight = design_weight * grade_weight * (0.5 + 0.5 * size_factor)
        
        return min(weight, 10.0)  # Cap at 10
    
    def _detect_conflicts(
        self,
        sources: List[EvidenceSource],
    ) -> List[EvidenceConflict]:
        """Detect conflicts between evidence sources."""
        conflicts = []
        
        if len(sources) < 2:
            return conflicts
        
        # Group sources by effect direction
        directions = {"positive": [], "negative": [], "neutral": []}
        for source in sources:
            if source.effect_direction:
                directions[source.effect_direction].append(source.pmid)
        
        # Check for direction conflict
        if directions["positive"] and directions["negative"]:
            conflicts.append(EvidenceConflict(
                conflict_type=ConflictType.DIRECTION,
                sources=directions["positive"] + directions["negative"],
                description=f"Evidence direction conflict: {len(directions['positive'])} positive vs {len(directions['negative'])} negative studies",
                severity="high",
                resolution_suggestion="Consider subgroup analysis or meta-regression to identify effect modifiers",
            ))
        
        # Check for magnitude conflict (significant variance in effect sizes)
        effect_sizes = [s.effect_size for s in sources if s.effect_size is not None]
        if len(effect_sizes) >= 3:
            mean_effect = sum(effect_sizes) / len(effect_sizes)
            variance = sum((e - mean_effect) ** 2 for e in effect_sizes) / len(effect_sizes)
            std_dev = variance ** 0.5
            
            # Coefficient of variation
            cv = std_dev / abs(mean_effect) if mean_effect != 0 else 0
            
            if cv > 0.5:  # High variability
                conflicts.append(EvidenceConflict(
                    conflict_type=ConflictType.MAGNITUDE,
                    sources=[s.pmid for s in sources if s.effect_size],
                    description=f"High variability in effect sizes (CV={cv:.2f})",
                    severity="medium" if cv < 1.0 else "high",
                    resolution_suggestion="Perform sensitivity analysis excluding outliers",
                ))
        
        # Check for population heterogeneity
        populations = set(s.population for s in sources if s.population)
        if len(populations) > 3:
            conflicts.append(EvidenceConflict(
                conflict_type=ConflictType.POPULATION,
                sources=[s.pmid for s in sources],
                description=f"Evidence from {len(populations)} different populations",
                severity="low",
                resolution_suggestion="Stratify results by population characteristics",
            ))
        
        return conflicts
    
    def _calculate_heterogeneity(
        self,
        sources: List[EvidenceSource],
    ) -> float:
        """
        Calculate I² heterogeneity statistic (simulated).
        
        I² represents the percentage of total variation across studies
        due to heterogeneity rather than chance.
        """
        effect_sizes = [s.effect_size for s in sources if s.effect_size is not None]
        
        if len(effect_sizes) < 2:
            return 0.0
        
        n = len(effect_sizes)
        mean_effect = sum(effect_sizes) / n
        
        # Calculate Q statistic (Cochran's Q)
        q = sum((e - mean_effect) ** 2 for e in effect_sizes)
        
        # I² calculation
        df = n - 1
        if q > df and df > 0:
            i_squared = (q - df) / q
        else:
            i_squared = 0.0
        
        return min(1.0, max(0.0, i_squared))
    
    def _calculate_pooled_effect(
        self,
        sources: List[EvidenceSource],
    ) -> Tuple[Optional[float], Optional[Tuple[float, float]]]:
        """
        Calculate pooled effect size using inverse-variance weighting.
        
        Returns:
            Tuple of (pooled_effect, confidence_interval)
        """
        valid_sources = [s for s in sources if s.effect_size is not None]
        
        if not valid_sources:
            return None, None
        
        # Calculate weights based on study quality and sample size
        weights = []
        effects = []
        
        for source in valid_sources:
            weight = source.weight
            if source.confidence_interval:
                # Use CI width as inverse precision measure
                ci_width = abs(source.confidence_interval[1] - source.confidence_interval[0])
                if ci_width > 0:
                    weight *= 1.0 / ci_width
            
            weights.append(weight)
            effects.append(source.effect_size)
        
        # Normalize weights
        total_weight = sum(weights)
        if total_weight == 0:
            return sum(effects) / len(effects), None
        
        weights = [w / total_weight for w in weights]
        
        # Weighted mean
        pooled_effect = sum(w * e for w, e in zip(weights, effects))
        
        # Calculate confidence interval
        # Use weighted variance for CI estimation
        weighted_variance = sum(w * (e - pooled_effect) ** 2 for w, e in zip(weights, effects))
        se = (weighted_variance ** 0.5) / (len(effects) ** 0.5)
        
        ci_95 = (
            pooled_effect - 1.96 * se,
            pooled_effect + 1.96 * se,
        )
        
        return pooled_effect, ci_95
    
    def _determine_consensus(
        self,
        sources: List[EvidenceSource],
        conflicts: List[EvidenceConflict],
    ) -> ConsensusLevel:
        """Determine level of consensus among evidence sources."""
        if not sources:
            return ConsensusLevel.NO_CONSENSUS
        
        # High severity conflicts reduce consensus
        high_severity = sum(1 for c in conflicts if c.severity == "high")
        if high_severity >= 2:
            return ConsensusLevel.NO_CONSENSUS
        elif high_severity == 1:
            return ConsensusLevel.WEAK
        
        # Check direction agreement
        directions = [s.effect_direction for s in sources if s.effect_direction]
        if not directions:
            return ConsensusLevel.NO_CONSENSUS
        
        # Calculate agreement percentage
        direction_counts = {}
        for d in directions:
            direction_counts[d] = direction_counts.get(d, 0) + 1
        
        max_count = max(direction_counts.values())
        agreement = max_count / len(directions)
        
        # Adjust for high heterogeneity
        i_squared = self._calculate_heterogeneity(sources)
        if i_squared > 0.75:
            agreement *= 0.7
        elif i_squared > 0.5:
            agreement *= 0.85
        
        if agreement >= 0.8:
            return ConsensusLevel.STRONG
        elif agreement >= 0.6:
            return ConsensusLevel.MODERATE
        elif agreement >= 0.4:
            return ConsensusLevel.WEAK
        else:
            return ConsensusLevel.NO_CONSENSUS
    
    def _identify_gaps(
        self,
        sources: List[EvidenceSource],
        question: str,
    ) -> List[EvidenceGap]:
        """Identify gaps in the evidence."""
        gaps = []
        
        if not sources:
            gaps.append(EvidenceGap(
                gap_type=EvidenceGapType.NO_STUDIES,
                description="No studies found addressing this clinical question",
                clinical_question=question,
                impact="high",
                research_needed="Primary research required to address this question",
            ))
            return gaps
        
        # Check for insufficient evidence
        total_sample = sum(s.sample_size for s in sources)
        if total_sample < 100:
            gaps.append(EvidenceGap(
                gap_type=EvidenceGapType.INSUFFICIENT,
                description=f"Insufficient total sample size ({total_sample} participants)",
                clinical_question=question,
                impact="medium",
                research_needed="Larger studies needed for precise estimates",
            ))
        
        # Check for high heterogeneity
        i_squared = self._calculate_heterogeneity(sources)
        if i_squared > 0.75:
            gaps.append(EvidenceGap(
                gap_type=EvidenceGapType.INCONSISTENT,
                description=f"High heterogeneity (I²={i_squared:.0%}) in results",
                clinical_question=question,
                impact="medium",
                research_needed="Subgroup analyses or meta-regression to identify sources of heterogeneity",
            ))
        
        # Check for low quality evidence
        low_quality_count = sum(1 for s in sources if s.grade_level in ["C", "D"])
        if low_quality_count > len(sources) * 0.5:
            gaps.append(EvidenceGap(
                gap_type=EvidenceGapType.INSUFFICIENT,
                description="Majority of evidence is low quality (GRADE C or D)",
                clinical_question=question,
                impact="medium",
                research_needed="High-quality RCTs needed to strengthen evidence base",
            ))
        
        return gaps
    
    def _generate_recommendation(
        self,
        evidence: SynthesizedEvidence,
    ) -> Tuple[str, RecommendationStrength]:
        """Generate clinical recommendation based on synthesized evidence."""
        
        # Determine recommendation strength based on evidence quality
        consensus = evidence.consensus_level
        conflicts = len(evidence.conflicts)
        gaps = len(evidence.gaps)
        i_squared = evidence.heterogeneity_i2
        
        # Check average GRADE level
        if evidence.sources:
            avg_grade = sum(
                self.GRADE_WEIGHTS.get(s.grade_level.upper(), 0.5)
                for s in evidence.sources
            ) / len(evidence.sources)
        else:
            avg_grade = 0.0
        
        # Generate recommendation text
        if consensus == ConsensusLevel.STRONG and conflicts == 0 and i_squared < 0.5:
            strength = RecommendationStrength.STRONG
            base_text = "Strong evidence supports"
        elif consensus in [ConsensusLevel.STRONG, ConsensusLevel.MODERATE] and conflicts <= 1:
            strength = RecommendationStrength.CONDITIONAL
            base_text = "Moderate evidence suggests"
        elif consensus == ConsensusLevel.MODERATE:
            strength = RecommendationStrength.WEAK
            base_text = "Limited evidence suggests"
        else:
            strength = RecommendationStrength.INSUFFICIENT
            base_text = "Evidence is insufficient to recommend"
        
        # Build recommendation text
        if evidence.pooled_effect_size:
            effect_text = f" (pooled effect size: {evidence.pooled_effect_size:.2f}"
            if evidence.confidence_interval:
                effect_text += f", 95% CI: [{evidence.confidence_interval[0]:.2f}, {evidence.confidence_interval[1]:.2f}]"
            effect_text += ")"
        else:
            effect_text = ""
        
        recommendation = f"{base_text} the intervention for this clinical scenario{effect_text}."
        
        # Add caveats
        if conflicts > 0:
            recommendation += f" Note: {conflicts} evidence conflict(s) identified."
        if gaps > 0:
            recommendation += f" {gaps} evidence gap(s) require further research."
        if i_squared > 0.5:
            recommendation += f" Moderate heterogeneity (I²={i_squared:.0%}) present."
        
        return recommendation, strength
    
    def _calculate_confidence_score(
        self,
        evidence: SynthesizedEvidence,
    ) -> float:
        """Calculate overall confidence score for synthesized evidence."""
        score = 0.5  # Base score
        
        # Consensus contribution
        consensus_scores = {
            ConsensusLevel.STRONG: 0.25,
            ConsensusLevel.MODERATE: 0.15,
            ConsensusLevel.WEAK: 0.05,
            ConsensusLevel.NO_CONSENSUS: -0.1,
        }
        score += consensus_scores.get(evidence.consensus_level, 0)
        
        # Quality contribution
        if evidence.sources:
            avg_quality = sum(
                self.GRADE_WEIGHTS.get(s.grade_level.upper(), 0.5)
                for s in evidence.sources
            ) / len(evidence.sources)
            score += avg_quality * 0.2
        
        # Heterogeneity penalty
        score -= evidence.heterogeneity_i2 * 0.15
        
        # Conflict penalty
        score -= len(evidence.conflicts) * 0.05
        
        # Gap penalty
        score -= len(evidence.gaps) * 0.03
        
        return max(0.0, min(1.0, score))
    
    async def synthesize(
        self,
        clinical_question: str,
        sources: List[Dict[str, Any]],
        target_population: str = "",
        target_intervention: str = "",
        target_outcome: str = "",
    ) -> SynthesisResult:
        """
        Synthesize evidence from multiple sources.
        
        Args:
            clinical_question: The clinical question to address
            sources: List of evidence source dictionaries
            target_population: Target patient population
            target_intervention: Target intervention
            target_outcome: Target outcome
            
        Returns:
            SynthesisResult with comprehensive synthesis
        """
        start_time = time.time()
        request_id = f"synth_{int(time.time() * 1000)}"
        
        self.stats["total_syntheses"] += 1
        
        # Convert to EvidenceSource objects
        evidence_sources = []
        for src in sources:
            # Determine effect direction
            effect_size = src.get("effect_size")
            if effect_size:
                if effect_size > 1.1:
                    direction = "positive"
                elif effect_size < 0.9:
                    direction = "negative"
                else:
                    direction = "neutral"
            else:
                direction = None
            
            source = EvidenceSource(
                pmid=src.get("pmid", ""),
                title=src.get("title", ""),
                study_design=src.get("study_design", "unknown"),
                sample_size=src.get("sample_size", 0),
                effect_size=effect_size,
                effect_direction=direction,
                confidence_interval=tuple(src["confidence_interval"]) if src.get("confidence_interval") else None,
                p_value=src.get("p_value"),
                grade_level=src.get("grade_level", "C"),
                population=src.get("population", ""),
                intervention=src.get("intervention", ""),
                outcomes=src.get("outcomes", []),
            )
            source.weight = self._calculate_source_weight(source)
            evidence_sources.append(source)
        
        # Calculate heterogeneity
        i_squared = self._calculate_heterogeneity(evidence_sources)
        
        # Detect conflicts
        conflicts = self._detect_conflicts(evidence_sources)
        self.stats["conflicts_detected"] += len(conflicts)
        
        # Identify gaps
        gaps = self._identify_gaps(evidence_sources, clinical_question)
        self.stats["gaps_identified"] += len(gaps)
        
        # Calculate pooled effect
        pooled_effect, ci = self._calculate_pooled_effect(evidence_sources)
        
        # Determine consensus
        consensus = self._determine_consensus(evidence_sources, conflicts)
        
        # Create synthesized evidence
        synthesized = SynthesizedEvidence(
            question=clinical_question,
            sources=evidence_sources,
            consensus_level=consensus,
            pooled_effect_size=pooled_effect,
            confidence_interval=ci,
            heterogeneity_i2=i_squared,
            conflicts=conflicts,
            gaps=gaps,
        )
        
        # Generate recommendation
        recommendation, strength = self._generate_recommendation(synthesized)
        synthesized.recommendation = recommendation
        synthesized.recommendation_strength = strength
        
        # Calculate confidence score
        synthesized.confidence_score = self._calculate_confidence_score(synthesized)
        
        # Generate evidence summary
        synthesized.evidence_summary = self._generate_evidence_summary(synthesized)
        synthesized.clinical_implications = self._generate_clinical_implications(synthesized)
        
        # Quality summary
        quality_summary = {
            "total_sources": len(evidence_sources),
            "total_participants": sum(s.sample_size for s in evidence_sources),
            "grade_distribution": self._get_grade_distribution(evidence_sources),
            "study_designs": list(set(s.study_design for s in evidence_sources)),
        }
        
        # Update stats
        self.stats["average_sources"] = (
            (self.stats["average_sources"] * (self.stats["total_syntheses"] - 1) + len(evidence_sources))
            / self.stats["total_syntheses"]
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return SynthesisResult(
            request_id=request_id,
            timestamp=datetime.utcnow().isoformat(),
            clinical_question=clinical_question,
            synthesized_evidence=synthesized,
            quality_summary=quality_summary,
            processing_time_ms=processing_time,
        )
    
    def _generate_evidence_summary(self, evidence: SynthesizedEvidence) -> str:
        """Generate human-readable evidence summary."""
        parts = []
        
        parts.append(f"This synthesis includes {len(evidence.sources)} studies")
        
        total_participants = sum(s.sample_size for s in evidence.sources)
        parts.append(f"with a total of {total_participants:,} participants.")
        
        if evidence.pooled_effect_size:
            parts.append(f"The pooled effect size is {evidence.pooled_effect_size:.2f}")
            if evidence.confidence_interval:
                parts.append(f"(95% CI: {evidence.confidence_interval[0]:.2f} to {evidence.confidence_interval[1]:.2f}).")
        
        consensus_text = {
            ConsensusLevel.STRONG: "strong consensus",
            ConsensusLevel.MODERATE: "moderate consensus",
            ConsensusLevel.WEAK: "weak consensus",
            ConsensusLevel.NO_CONSENSUS: "no clear consensus",
        }
        parts.append(f"There is {consensus_text.get(evidence.consensus_level, 'uncertain')} among the evidence.")
        
        if evidence.heterogeneity_i2 > 0.5:
            parts.append(f"Heterogeneity is substantial (I²={evidence.heterogeneity_i2:.0%}).")
        
        return " ".join(parts)
    
    def _generate_clinical_implications(self, evidence: SynthesizedEvidence) -> str:
        """Generate clinical implications text."""
        implications = []
        
        strength_text = {
            RecommendationStrength.STRONG: "This recommendation is based on strong evidence",
            RecommendationStrength.CONDITIONAL: "This recommendation is conditional",
            RecommendationStrength.WEAK: "This recommendation is based on limited evidence",
            RecommendationStrength.INSUFFICIENT: "Evidence is insufficient for a recommendation",
        }
        
        implications.append(strength_text.get(evidence.recommendation_strength, "Evidence quality is uncertain"))
        
        if evidence.conflicts:
            implications.append(f"Clinicians should be aware of {len(evidence.conflicts)} evidence conflict(s).")
        
        if evidence.gaps:
            implications.append(f"Research is needed to address {len(evidence.gaps)} evidence gap(s).")
        
        implications.append("Individual patient factors should always be considered in clinical decision-making.")
        
        return " ".join(implications)
    
    def _get_grade_distribution(self, sources: List[EvidenceSource]) -> Dict[str, int]:
        """Get distribution of GRADE levels."""
        distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
        for source in sources:
            grade = source.grade_level.upper()
            if grade in distribution:
                distribution[grade] += 1
        return distribution
    
    def get_stats(self) -> Dict[str, Any]:
        """Get synthesis statistics."""
        return self.stats


# Singleton instance
_synthesis_engine: Optional[EvidenceSynthesisEngine] = None


def get_synthesis_engine() -> EvidenceSynthesisEngine:
    """Get or create synthesis engine singleton."""
    global _synthesis_engine
    
    if _synthesis_engine is None:
        _synthesis_engine = EvidenceSynthesisEngine()
    
    return _synthesis_engine
