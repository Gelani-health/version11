"""
Confidence Calibration System
==============================

P1 Priority: Calibrated confidence scores for clinical decision support.

This module implements probability calibration techniques to ensure
that predicted confidence scores are well-calibrated and reflect
true probabilities of correctness.

Key Components:
- Temperature scaling calibration
- Reliability diagrams
- Uncertainty quantification
- Expected Calibration Error (ECE) calculation

References:
- Guo C et al. "On Calibration of Modern Neural Networks." ICML 2017.
- Niculescu-Mizil A, Caruana R. "Predicting Good Probabilities With Supervised Learning." ICML 2005.
"""

import math
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

class CalibrationMethod(Enum):
    """Calibration methods available."""
    TEMPERATURE_SCALING = "temperature_scaling"
    PLATT_SCALING = "platt_scaling"
    ISOTONIC_REGRESSION = "isotonic_regression"
    BINNING = "binning"
    NONE = "none"


class UncertaintyType(Enum):
    """Types of uncertainty."""
    ALEATORIC = "aleatoric"      # Data uncertainty (irreducible)
    EPISTEMIC = "epistemic"      # Model uncertainty (reducible)
    TOTAL = "total"              # Combined uncertainty


# Calibration bins for reliability diagram
NUM_CALIBRATION_BINS = 10


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class CalibrationBin:
    """A bin in the reliability diagram."""
    bin_lower: float
    bin_upper: float
    mean_predicted: float
    mean_observed: float
    count: int
    accuracy: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "bin_range": [self.bin_lower, self.bin_upper],
            "mean_predicted": self.mean_predicted,
            "mean_observed": self.mean_observed,
            "count": self.count,
            "accuracy": self.accuracy,
        }


@dataclass
class ReliabilityDiagram:
    """Reliability diagram for calibration visualization."""
    bins: List[CalibrationBin]
    expected_calibration_error: float
    maximum_calibration_error: float
    brier_score: float
    perfect_calibration_line: List[Tuple[float, float]] = field(default_factory=list)
    
    def __post_init__(self):
        if not self.perfect_calibration_line:
            self.perfect_calibration_line = [(0, 0), (1, 1)]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "bins": [b.to_dict() for b in self.bins],
            "expected_calibration_error": self.expected_calibration_error,
            "maximum_calibration_error": self.maximum_calibration_error,
            "brier_score": self.brier_score,
            "perfect_calibration_line": self.perfect_calibration_line,
        }


@dataclass
class CalibratedConfidence:
    """Calibrated confidence score with uncertainty quantification."""
    request_id: str
    timestamp: str
    raw_confidence: float
    calibrated_confidence: float
    calibration_method: CalibrationMethod
    temperature: float
    
    # Uncertainty quantification
    aleatoric_uncertainty: float
    epistemic_uncertainty: float
    total_uncertainty: float
    
    # Confidence intervals
    confidence_interval_95: Tuple[float, float]
    confidence_interval_90: Tuple[float, float]
    prediction_interval: Tuple[float, float]
    
    # Quality metrics
    reliability_score: float  # How well-calibrated this prediction is
    evidence_weight: float    # Weight based on evidence quality
    
    # Additional context
    calibration_history: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "raw_confidence": self.raw_confidence,
            "calibrated_confidence": self.calibrated_confidence,
            "calibration_method": self.calibration_method.value,
            "temperature": self.temperature,
            "aleatoric_uncertainty": self.aleatoric_uncertainty,
            "epistemic_uncertainty": self.epistemic_uncertainty,
            "total_uncertainty": self.total_uncertainty,
            "confidence_interval_95": list(self.confidence_interval_95),
            "confidence_interval_90": list(self.confidence_interval_90),
            "prediction_interval": list(self.prediction_interval),
            "reliability_score": self.reliability_score,
            "evidence_weight": self.evidence_weight,
            "calibration_history": self.calibration_history,
            "metadata": self.metadata,
        }


# =============================================================================
# CONFIDENCE CALIBRATOR CLASS
# =============================================================================

class ConfidenceCalibrator:
    """
    Confidence calibration system for clinical decision support.
    
    Implements multiple calibration techniques to ensure predicted
    confidence scores are well-calibrated and reflect true probabilities.
    
    Key Features:
    - Temperature scaling calibration
    - Reliability diagram generation
    - Expected Calibration Error (ECE) calculation
    - Uncertainty quantification
    """
    
    def __init__(
        self,
        method: CalibrationMethod = CalibrationMethod.TEMPERATURE_SCALING,
        temperature: float = 1.0,
    ):
        self.settings = get_settings()
        self.method = method
        self.temperature = temperature
        
        # Calibration parameters (learned from data)
        self._learned_temperature = 1.0
        self._platt_a = 0.0
        self._platt_b = 0.0
        self._isotonic_mapping = {}
        
        # Calibration history for tracking
        self._calibration_history: List[Dict[str, Any]] = []
        
        # Statistics
        self.stats = {
            "total_calibrations": 0,
            "average_raw_confidence": 0.0,
            "average_calibrated_confidence": 0.0,
            "average_uncertainty": 0.0,
            "ece_history": [],
        }
    
    def temperature_scale(self, confidence: float, temperature: float) -> float:
        """
        Apply temperature scaling to a confidence score.
        
        Temperature > 1: Softens predictions (more uncertain)
        Temperature < 1: Sharpens predictions (more confident)
        Temperature = 1: No change
        
        For binary probability, use: calibrated = sigmoid(logit(p) / T)
        
        Args:
            confidence: Raw confidence score (0-1)
            temperature: Temperature parameter
            
        Returns:
            Calibrated confidence score
        """
        if confidence <= 0 or confidence >= 1:
            return confidence
        
        # Convert to logit space
        logit = math.log(confidence / (1 - confidence))
        
        # Apply temperature scaling
        scaled_logit = logit / temperature
        
        # Convert back to probability
        calibrated = 1 / (1 + math.exp(-scaled_logit))
        
        return calibrated
    
    def learn_temperature(
        self,
        confidences: List[float],
        accuracies: List[bool],
        n_iter: int = 50,
        lr: float = 0.01,
    ) -> float:
        """
        Learn optimal temperature parameter using validation data.
        
        Uses negative log likelihood loss and gradient descent.
        
        Args:
            confidences: Predicted confidence scores
            accuracies: Ground truth correctness (True/False)
            n_iter: Number of iterations
            lr: Learning rate
            
        Returns:
            Learned temperature value
        """
        if len(confidences) != len(accuracies):
            raise ValueError("Confidences and accuracies must have same length")
        
        temperature = 1.0
        
        for _ in range(n_iter):
            # Calculate gradient
            gradient = 0.0
            loss = 0.0
            
            for conf, acc in zip(confidences, accuracies):
                if conf <= 0 or conf >= 1:
                    continue
                
                # Convert to logit
                logit = math.log(conf / (1 - conf))
                scaled_logit = logit / temperature
                
                # Predicted probability
                prob = 1 / (1 + math.exp(-scaled_logit))
                
                # Binary cross-entropy loss gradient
                # d(loss)/d(temperature) = -y * log(prob)/dT + (1-y) * log(1-prob)/dT
                target = 1.0 if acc else 0.0
                
                # Gradient w.r.t. scaled_logit
                d_loss_d_scaled = prob - target
                
                # Gradient w.r.t. temperature
                d_scaled_d_temp = -logit / (temperature ** 2)
                
                gradient += d_loss_d_scaled * d_scaled_d_temp
            
            # Update temperature
            temperature -= lr * gradient / len(confidences)
            temperature = max(0.1, min(10.0, temperature))  # Clamp
        
        self._learned_temperature = temperature
        logger.info(f"Learned temperature: {temperature:.4f}")
        
        return temperature
    
    def calculate_ece(
        self,
        confidences: List[float],
        accuracies: List[bool],
        n_bins: int = NUM_CALIBRATION_BINS,
    ) -> Tuple[float, List[CalibrationBin]]:
        """
        Calculate Expected Calibration Error (ECE).
        
        ECE = sum(|acc(b) - conf(b)| * n(b) / N) for all bins b
        
        Args:
            confidences: Predicted confidence scores
            accuracies: Ground truth correctness
            n_bins: Number of bins for calculation
            
        Returns:
            Tuple of (ECE, list of calibration bins)
        """
        if len(confidences) != len(accuracies):
            raise ValueError("Confidences and accuracies must have same length")
        
        n = len(confidences)
        bin_width = 1.0 / n_bins
        
        bins = []
        ece = 0.0
        
        for i in range(n_bins):
            bin_lower = i * bin_width
            bin_upper = (i + 1) * bin_width
            
            # Find samples in this bin
            bin_indices = [
                j for j, c in enumerate(confidences)
                if bin_lower <= c < bin_upper or (i == n_bins - 1 and c == 1.0)
            ]
            
            if not bin_indices:
                continue
            
            # Calculate bin statistics
            bin_count = len(bin_indices)
            bin_confidences = [confidences[j] for j in bin_indices]
            bin_accuracies = [1.0 if accuracies[j] else 0.0 for j in bin_indices]
            
            mean_conf = sum(bin_confidences) / bin_count
            mean_acc = sum(bin_accuracies) / bin_count
            
            # Create bin object
            cal_bin = CalibrationBin(
                bin_lower=bin_lower,
                bin_upper=bin_upper,
                mean_predicted=mean_conf,
                mean_observed=mean_acc,
                count=bin_count,
                accuracy=mean_acc,
            )
            bins.append(cal_bin)
            
            # Add to ECE
            ece += abs(mean_acc - mean_conf) * bin_count / n
        
        return ece, bins
    
    def calculate_brier_score(
        self,
        confidences: List[float],
        accuracies: List[bool],
    ) -> float:
        """
        Calculate Brier Score.
        
        Brier Score = mean((predicted - actual)^2)
        Lower is better (0 is perfect).
        
        Args:
            confidences: Predicted confidence scores
            accuracies: Ground truth correctness
            
        Returns:
            Brier score
        """
        if len(confidences) != len(accuracies):
            raise ValueError("Confidences and accuracies must have same length")
        
        squared_errors = []
        for conf, acc in zip(confidences, accuracies):
            actual = 1.0 if acc else 0.0
            squared_errors.append((conf - actual) ** 2)
        
        return sum(squared_errors) / len(squared_errors)
    
    def generate_reliability_diagram(
        self,
        confidences: List[float],
        accuracies: List[bool],
        n_bins: int = NUM_CALIBRATION_BINS,
    ) -> ReliabilityDiagram:
        """
        Generate reliability diagram for calibration visualization.
        
        Args:
            confidences: Predicted confidence scores
            accuracies: Ground truth correctness
            n_bins: Number of bins
            
        Returns:
            ReliabilityDiagram object
        """
        ece, bins = self.calculate_ece(confidences, accuracies, n_bins)
        brier = self.calculate_brier_score(confidences, accuracies)
        
        # Calculate Maximum Calibration Error
        mce = 0.0
        for b in bins:
            gap = abs(b.mean_predicted - b.mean_observed)
            mce = max(mce, gap)
        
        return ReliabilityDiagram(
            bins=bins,
            expected_calibration_error=ece,
            maximum_calibration_error=mce,
            brier_score=brier,
        )
    
    def quantify_uncertainty(
        self,
        confidence: float,
        evidence_quality: Optional[float] = None,
        num_evidence_sources: int = 1,
        prediction_entropy: Optional[float] = None,
    ) -> Tuple[float, float, float]:
        """
        Quantify uncertainty in predictions.
        
        Separates uncertainty into:
        - Aleatoric: Data uncertainty (irreducible)
        - Epistemic: Model uncertainty (reducible with more data)
        
        Args:
            confidence: Predicted confidence
            evidence_quality: Quality score of supporting evidence (0-1)
            num_evidence_sources: Number of evidence sources
            prediction_entropy: Entropy of prediction distribution
            
        Returns:
            Tuple of (aleatoric, epistemic, total) uncertainty
        """
        # Base aleatoric uncertainty from prediction confidence
        # Higher confidence = lower aleatoric uncertainty
        if confidence <= 0 or confidence >= 1:
            aleatoric = 0.5
        else:
            # Use entropy-based measure
            aleatoric = -(
                confidence * math.log(confidence + 1e-10) +
                (1 - confidence) * math.log(1 - confidence + 1e-10)
            ) / math.log(2)  # Normalize to [0, 1]
        
        # Adjust aleatoric based on evidence quality
        if evidence_quality is not None:
            # Lower evidence quality = more aleatoric uncertainty
            quality_factor = 1 - evidence_quality
            aleatoric = min(1.0, aleatoric * (1 + quality_factor))
        
        # Epistemic uncertainty based on evidence quantity
        # More evidence sources = lower epistemic uncertainty
        if num_evidence_sources > 0:
            epistemic = 1.0 / (1.0 + math.log(1 + num_evidence_sources))
        else:
            epistemic = 1.0
        
        # Adjust epistemic for evidence quality
        if evidence_quality is not None:
            epistemic *= (1 - evidence_quality * 0.5)
        
        # Use prediction entropy if available
        if prediction_entropy is not None:
            # High entropy suggests model uncertainty
            epistemic = max(epistemic, prediction_entropy * 0.5)
        
        # Total uncertainty (probabilistic sum)
        total = aleatoric + epistemic - aleatoric * epistemic
        
        return aleatoric, epistemic, total
    
    def calculate_confidence_intervals(
        self,
        confidence: float,
        uncertainty: float,
        sample_size: Optional[int] = None,
    ) -> Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]]:
        """
        Calculate confidence intervals for predictions.
        
        Args:
            confidence: Predicted confidence
            uncertainty: Total uncertainty estimate
            sample_size: Optional sample size for tighter intervals
            
        Returns:
            Tuple of (95% CI, 90% CI, prediction interval)
        """
        # Standard error from uncertainty
        se = uncertainty / 2  # Approximate
        
        # Adjust for sample size if provided
        if sample_size and sample_size > 0:
            se *= math.sqrt(1 / sample_size)
        
        # Z-scores
        z_95 = 1.96
        z_90 = 1.645
        
        # Calculate intervals
        ci_95 = (
            max(0.0, confidence - z_95 * se),
            min(1.0, confidence + z_95 * se),
        )
        
        ci_90 = (
            max(0.0, confidence - z_90 * se),
            min(1.0, confidence + z_90 * se),
        )
        
        # Prediction interval (wider, accounts for individual prediction variance)
        pred_factor = 1.5  # Wider interval for predictions
        pred_interval = (
            max(0.0, confidence - z_95 * se * pred_factor),
            min(1.0, confidence + z_95 * se * pred_factor),
        )
        
        return ci_95, ci_90, pred_interval
    
    async def calibrate(
        self,
        raw_confidence: float,
        evidence_quality: Optional[float] = None,
        num_evidence_sources: int = 1,
        evidence_grade: Optional[str] = None,
        prediction_entropy: Optional[float] = None,
        apply_calibration: bool = True,
    ) -> CalibratedConfidence:
        """
        Calibrate a confidence score with uncertainty quantification.
        
        Args:
            raw_confidence: Raw model confidence score (0-1)
            evidence_quality: Quality of supporting evidence (0-1)
            num_evidence_sources: Number of evidence sources
            evidence_grade: GRADE level of evidence (A/B/C/D)
            prediction_entropy: Entropy of prediction distribution
            apply_calibration: Whether to apply calibration method
            
        Returns:
            CalibratedConfidence object with full uncertainty analysis
        """
        import time
        request_id = f"calib_{int(time.time() * 1000)}"
        
        self.stats["total_calibrations"] += 1
        
        # Determine temperature
        temperature = self._learned_temperature if apply_calibration else 1.0
        
        # Apply calibration method
        if apply_calibration:
            calibrated = self.temperature_scale(raw_confidence, temperature)
        else:
            calibrated = raw_confidence
        
        # Adjust based on evidence grade
        if evidence_grade:
            grade_adjustments = {
                "A": 0.0,     # High quality - no adjustment
                "B": 0.05,    # Moderate - slight reduction
                "C": 0.15,    # Low - moderate reduction
                "D": 0.30,    # Very low - significant reduction
            }
            adjustment = grade_adjustments.get(evidence_grade.upper(), 0.1)
            calibrated = calibrated * (1 - adjustment)
        
        # Ensure bounds
        calibrated = max(0.01, min(0.99, calibrated))
        
        # Quantify uncertainty
        aleatoric, epistemic, total = self.quantify_uncertainty(
            calibrated, evidence_quality, num_evidence_sources, prediction_entropy
        )
        
        # Calculate confidence intervals
        ci_95, ci_90, pred_interval = self.calculate_confidence_intervals(
            calibrated, total
        )
        
        # Calculate reliability score
        reliability = self._calculate_reliability_score(
            raw_confidence, calibrated, total, evidence_quality
        )
        
        # Evidence weight
        evidence_weight = self._calculate_evidence_weight(
            evidence_quality, num_evidence_sources, evidence_grade
        )
        
        # Update statistics
        self.stats["average_raw_confidence"] = (
            (self.stats["average_raw_confidence"] * (self.stats["total_calibrations"] - 1) + raw_confidence)
            / self.stats["total_calibrations"]
        )
        self.stats["average_calibrated_confidence"] = (
            (self.stats["average_calibrated_confidence"] * (self.stats["total_calibrations"] - 1) + calibrated)
            / self.stats["total_calibrations"]
        )
        self.stats["average_uncertainty"] = (
            (self.stats["average_uncertainty"] * (self.stats["total_calibrations"] - 1) + total)
            / self.stats["total_calibrations"]
        )
        
        return CalibratedConfidence(
            request_id=request_id,
            timestamp=datetime.utcnow().isoformat(),
            raw_confidence=raw_confidence,
            calibrated_confidence=calibrated,
            calibration_method=self.method,
            temperature=temperature,
            aleatoric_uncertainty=aleatoric,
            epistemic_uncertainty=epistemic,
            total_uncertainty=total,
            confidence_interval_95=ci_95,
            confidence_interval_90=ci_90,
            prediction_interval=pred_interval,
            reliability_score=reliability,
            evidence_weight=evidence_weight,
            metadata={
                "evidence_grade": evidence_grade,
                "num_evidence_sources": num_evidence_sources,
            },
        )
    
    def _calculate_reliability_score(
        self,
        raw: float,
        calibrated: float,
        uncertainty: float,
        evidence_quality: Optional[float],
    ) -> float:
        """Calculate reliability score for this calibration."""
        # Base reliability from calibration stability
        stability = 1 - abs(raw - calibrated)
        
        # Uncertainty penalty
        uncertainty_penalty = uncertainty * 0.3
        
        # Evidence quality bonus
        if evidence_quality is not None:
            evidence_bonus = evidence_quality * 0.3
        else:
            evidence_bonus = 0.0
        
        reliability = stability - uncertainty_penalty + evidence_bonus
        return max(0.0, min(1.0, reliability))
    
    def _calculate_evidence_weight(
        self,
        evidence_quality: Optional[float],
        num_sources: int,
        evidence_grade: Optional[str],
    ) -> float:
        """Calculate evidence weight for decision making."""
        # Base weight from number of sources
        source_weight = min(1.0, num_sources / 5)  # Max at 5 sources
        
        # Quality weight
        if evidence_quality is not None:
            quality_weight = evidence_quality
        else:
            quality_weight = 0.5
        
        # Grade weight
        if evidence_grade:
            grade_weights = {"A": 1.0, "B": 0.8, "C": 0.6, "D": 0.4}
            grade_weight = grade_weights.get(evidence_grade.upper(), 0.5)
        else:
            grade_weight = 0.5
        
        # Combined weight
        return (source_weight + quality_weight + grade_weight) / 3
    
    def get_stats(self) -> Dict[str, Any]:
        """Get calibration statistics."""
        return {
            **self.stats,
            "learned_temperature": self._learned_temperature,
            "calibration_method": self.method.value,
        }
    
    def reset_calibration(self):
        """Reset learned calibration parameters."""
        self._learned_temperature = 1.0
        self._platt_a = 0.0
        self._platt_b = 0.0
        self._isotonic_mapping = {}
        self._calibration_history = []
        logger.info("Calibration parameters reset")


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def interpret_confidence(calibrated_confidence: CalibratedConfidence) -> str:
    """
    Generate human-readable interpretation of calibrated confidence.
    
    Args:
        calibrated_confidence: CalibratedConfidence object
        
    Returns:
        Human-readable interpretation string
    """
    conf = calibrated_confidence.calibrated_confidence
    uncertainty = calibrated_confidence.total_uncertainty
    reliability = calibrated_confidence.reliability_score
    
    parts = []
    
    # Confidence interpretation
    if conf >= 0.9:
        parts.append("Very high confidence")
    elif conf >= 0.75:
        parts.append("High confidence")
    elif conf >= 0.6:
        parts.append("Moderate confidence")
    elif conf >= 0.4:
        parts.append("Low confidence - exercise caution")
    else:
        parts.append("Very low confidence - recommend verification")
    
    # Uncertainty interpretation
    if uncertainty > 0.5:
        parts.append("High uncertainty suggests need for additional information")
    elif uncertainty > 0.3:
        parts.append("Moderate uncertainty present")
    
    # Reliability interpretation
    if reliability < 0.5:
        parts.append("Low reliability score indicates calibration uncertainty")
    
    return ". ".join(parts) + "."
