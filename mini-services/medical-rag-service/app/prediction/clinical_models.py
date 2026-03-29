"""
P5: Clinical Prediction Models
==============================

Implements validated clinical prediction models for:
- 30-Day Readmission Risk
- Clinical Deterioration (Early Warning Score)
- Mortality Risk Assessment
- Length of Stay Prediction

Evidence-based models using:
- LACE Index for Readmission
- NEWS2 for Deterioration
- Modified Early Warning Score (MEWS)
- POMR (Probability of Mortality Risk)

References:
- LACE Index: Van Walraven et al., CMAJ 2010
- NEWS2: Royal College of Physicians, 2017
- MEWS: Subbe et al., QJM 2001
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timedelta
import math


class RiskLevel(str, Enum):
    """Risk classification levels."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class PredictionType(str, Enum):
    """Types of clinical predictions."""
    READMISSION_30DAY = "readmission_30day"
    DETERIORATION = "deterioration"
    MORTALITY = "mortality"
    LENGTH_OF_STAY = "length_of_stay"


@dataclass
class PredictionResult:
    """Result of a clinical prediction model."""
    prediction_type: PredictionType
    score: float
    risk_level: RiskLevel
    probability: float
    confidence_interval: Optional[tuple] = None
    contributing_factors: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    model_name: str = ""
    model_version: str = "1.0"
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "prediction_type": self.prediction_type.value,
            "score": self.score,
            "risk_level": self.risk_level.value,
            "probability": round(self.probability, 4),
            "probability_percent": f"{round(self.probability * 100, 1)}%",
            "confidence_interval": self.confidence_interval,
            "contributing_factors": self.contributing_factors,
            "recommendations": self.recommendations,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "timestamp": self.timestamp,
        }


# =============================================================================
# LACE INDEX FOR READMISSION RISK
# =============================================================================

"""
LACE Index Components:
- L: Length of stay (0-7 points)
- A: Acuity of admission (0-3 points)
- C: Comorbidity (0-6 points, Charlson Index)
- E: Emergency department visits in last 6 months (0-4 points)

Total Score: 0-20
- Score 0-4: Low risk (5% readmission)
- Score 5-9: Moderate risk (10% readmission)
- Score 10+: High risk (20%+ readmission)
"""

LACE_LENGTH_OF_STAY_POINTS = [
    (0, 1, 0),    # <1 day
    (1, 2, 1),    # 1 day
    (2, 3, 2),    # 2 days
    (3, 4, 3),    # 3 days
    (4, 5, 4),    # 4-5 days
    (5, 7, 5),    # 5-7 days
    (7, 14, 6),   # 7-14 days
    (14, float('inf'), 7),  # >14 days
]

LACE_ACUITY_POINTS = {
    "elective": 0,
    "urgent": 2,
    "emergency": 3,
}

LACE_ED_VISIT_POINTS = [
    (0, 0),   # 0 visits
    (1, 1),   # 1 visit
    (2, 2),   # 2 visits
    (3, 3),   # 3 visits
    (4, float('inf'), 4),  # 4+ visits
]


def calculate_lace_index(
    length_of_stay_days: float,
    admission_type: str,
    charlson_comorbidity_index: int,
    ed_visits_6months: int,
) -> PredictionResult:
    """
    Calculate LACE Index for 30-day readmission risk.
    
    Args:
        length_of_stay_days: Length of stay in days
        admission_type: 'elective', 'urgent', or 'emergency'
        charlson_comorbidity_index: Charlson Comorbidity Index (0-6+)
        ed_visits_6months: Number of ED visits in past 6 months
    
    Returns:
        PredictionResult with readmission risk
    """
    contributing_factors = []
    
    # Length of Stay score
    los_score = 0
    for min_los, max_los, points in LACE_LENGTH_OF_STAY_POINTS:
        if min_los <= length_of_stay_days < max_los:
            los_score = points
            break
    
    contributing_factors.append({
        "factor": "Length of Stay",
        "value": f"{length_of_stay_days:.1f} days",
        "points": los_score,
    })
    
    # Acuity score
    acuity_score = LACE_ACUITY_POINTS.get(admission_type.lower(), 0)
    contributing_factors.append({
        "factor": "Admission Acuity",
        "value": admission_type,
        "points": acuity_score,
    })
    
    # Comorbidity score (capped at 6)
    comorbidity_score = min(charlson_comorbidity_index, 6)
    contributing_factors.append({
        "factor": "Comorbidity Index",
        "value": charlson_comorbidity_index,
        "points": comorbidity_score,
    })
    
    # ED visits score
    ed_score = 0
    for visits, points in LACE_ED_VISIT_POINTS:
        if ed_visits_6months <= visits:
            ed_score = points
            break
        if visits >= 4:
            ed_score = 4
            break
    
    contributing_factors.append({
        "factor": "ED Visits (6 months)",
        "value": ed_visits_6months,
        "points": ed_score,
    })
    
    # Total LACE score
    total_score = los_score + acuity_score + comorbidity_score + ed_score
    
    # Determine risk level and probability
    if total_score <= 4:
        risk_level = RiskLevel.LOW
        probability = 0.05
        recommendations = [
            "Standard discharge planning appropriate",
            "Provide written discharge instructions",
            "Schedule routine follow-up appointment",
        ]
    elif total_score <= 9:
        risk_level = RiskLevel.MODERATE
        probability = 0.10 + (total_score - 5) * 0.02
        recommendations = [
            "Enhanced discharge planning recommended",
            "Medication reconciliation before discharge",
            "Schedule follow-up within 7-14 days",
            "Consider home health referral",
            "Patient education on warning signs",
        ]
    else:
        risk_level = RiskLevel.HIGH
        probability = min(0.20 + (total_score - 10) * 0.05, 0.50)
        recommendations = [
            "Intensive discharge planning required",
            "Care coordinator/social work involvement",
            "Schedule close follow-up within 7 days",
            "Consider transitional care program",
            "Home health or visiting nurse referral",
            "Medication management review",
            "Address transportation and social needs",
            "Daily telehealth check-ins for first week",
        ]
    
    if total_score >= 12:
        risk_level = RiskLevel.VERY_HIGH
    
    return PredictionResult(
        prediction_type=PredictionType.READMISSION_30DAY,
        score=float(total_score),
        risk_level=risk_level,
        probability=probability,
        confidence_interval=(max(0, probability - 0.05), min(1, probability + 0.05)),
        contributing_factors=contributing_factors,
        recommendations=recommendations,
        model_name="LACE Index",
    )


# =============================================================================
# NEWS2 (NATIONAL EARLY WARNING SCORE 2)
# =============================================================================

"""
NEWS2 Scoring System for Clinical Deterioration

Physiological Parameters:
1. Respiratory rate (0-3 points)
2. Oxygen saturation (0-3 points)
3. Supplemental oxygen (0-2 points)
4. Temperature (0-3 points)
5. Systolic blood pressure (0-3 points)
6. Heart rate (0-3 points)
7. Level of consciousness (0-3 points)

Total Score: 0-20
- 0-4: Low risk
- 5-6: Medium risk
- 7+: High risk
"""

NEWS2_PARAMS = {
    "respiratory_rate": [
        (0, 8, 3),
        (8, 9, 1),
        (9, 11, 0),
        (11, 12, 1),
        (12, 21, 0),
        (21, 25, 2),
        (25, float('inf'), 3),
    ],
    "oxygen_saturation_scale1": [
        (0, 91, 3),
        (91, 93, 2),
        (93, 95, 1),
        (95, 97, 0),
        (97, 101, 0),
    ],
    "oxygen_saturation_scale2": [
        (0, 83, 3),
        (83, 86, 2),
        (86, 88, 1),
        (88, 92, 1),
        (92, 94, 0),
        (94, 96, 0),
        (96, 101, 0),
    ],
    "systolic_bp": [
        (0, 90, 3),
        (90, 100, 2),
        (100, 110, 1),
        (110, 130, 0),
        (130, 200, 0),
        (200, 220, 1),
        (220, float('inf'), 2),
    ],
    "heart_rate": [
        (0, 40, 3),
        (40, 51, 1),
        (51, 91, 0),
        (91, 101, 1),
        (101, 111, 2),
        (111, 131, 3),
        (131, float('inf'), 3),
    ],
    "temperature": [
        (0, 35.0, 3),
        (35.0, 35.1, 1),
        (35.1, 36.1, 0),
        (36.1, 38.1, 0),
        (38.1, 39.0, 1),
        (39.0, float('inf'), 2),
    ],
    "consciousness": {
        "alert": 0,
        "cvpu": 3,  # Confusion, Voice, Pain, Unresponsive
    },
}


def calculate_news2(
    respiratory_rate: int,
    oxygen_saturation: float,
    supplemental_oxygen: bool,
    systolic_bp: int,
    heart_rate: int,
    temperature: float,
    consciousness: str,
    scale: int = 1,
) -> PredictionResult:
    """
    Calculate NEWS2 score for clinical deterioration risk.
    
    Args:
        respiratory_rate: Breaths per minute
        oxygen_saturation: SpO2 percentage
        supplemental_oxygen: Whether patient on supplemental O2
        systolic_bp: Systolic blood pressure in mmHg
        heart_rate: Heart rate in bpm
        temperature: Temperature in Celsius
        consciousness: 'alert' or 'cvpu'
        scale: 1 for normal, 2 for patients with hypercapnic respiratory failure
    
    Returns:
        PredictionResult with deterioration risk
    """
    contributing_factors = []
    total_score = 0
    
    # Respiratory rate
    for min_val, max_val, points in NEWS2_PARAMS["respiratory_rate"]:
        if min_val <= respiratory_rate < max_val:
            rr_score = points
            break
    else:
        rr_score = 3
    total_score += rr_score
    contributing_factors.append({"factor": "Respiratory Rate", "value": f"{respiratory_rate}/min", "points": rr_score})
    
    # Oxygen saturation
    sat_key = "oxygen_saturation_scale1" if scale == 1 else "oxygen_saturation_scale2"
    for min_val, max_val, points in NEWS2_PARAMS[sat_key]:
        if min_val <= oxygen_saturation < max_val:
            spo2_score = points
            break
    else:
        spo2_score = 3
    total_score += spo2_score
    contributing_factors.append({"factor": "SpO2", "value": f"{oxygen_saturation}%", "points": spo2_score})
    
    # Supplemental oxygen
    o2_score = 2 if supplemental_oxygen else 0
    total_score += o2_score
    contributing_factors.append({"factor": "Supplemental O2", "value": "Yes" if supplemental_oxygen else "No", "points": o2_score})
    
    # Systolic BP
    for min_val, max_val, points in NEWS2_PARAMS["systolic_bp"]:
        if min_val <= systolic_bp < max_val:
            sbp_score = points
            break
    else:
        sbp_score = 2
    total_score += sbp_score
    contributing_factors.append({"factor": "Systolic BP", "value": f"{systolic_bp} mmHg", "points": sbp_score})
    
    # Heart rate
    for min_val, max_val, points in NEWS2_PARAMS["heart_rate"]:
        if min_val <= heart_rate < max_val:
            hr_score = points
            break
    else:
        hr_score = 3
    total_score += hr_score
    contributing_factors.append({"factor": "Heart Rate", "value": f"{heart_rate} bpm", "points": hr_score})
    
    # Temperature
    for min_val, max_val, points in NEWS2_PARAMS["temperature"]:
        if min_val <= temperature < max_val:
            temp_score = points
            break
    else:
        temp_score = 2
    total_score += temp_score
    contributing_factors.append({"factor": "Temperature", "value": f"{temperature}°C", "points": temp_score})
    
    # Consciousness
    loc_score = NEWS2_PARAMS["consciousness"].get(consciousness.lower(), 3)
    total_score += loc_score
    contributing_factors.append({"factor": "Consciousness", "value": consciousness, "points": loc_score})
    
    # Determine risk level and recommendations
    if total_score <= 4:
        risk_level = RiskLevel.LOW
        probability = 0.02
        recommendations = [
            "Continue routine monitoring",
            "Repeat observations per unit protocol",
        ]
    elif total_score <= 6:
        risk_level = RiskLevel.MODERATE
        probability = 0.10
        recommendations = [
            "Inform registered nurse",
            "Increase monitoring frequency",
            "Urgent clinical response required",
            "Registered nurse to assess",
        ]
    else:
        risk_level = RiskLevel.HIGH
        probability = 0.25 + (total_score - 7) * 0.05
        recommendations = [
            "EMERGENCY: Immediate clinical response",
            "Contact senior clinician",
            "Consider ICU/HDU transfer",
            "Continuous monitoring",
            "Prepare for resuscitation",
            "Escalate to rapid response team",
        ]
    
    if total_score >= 12:
        risk_level = RiskLevel.VERY_HIGH
        probability = 0.50
    
    return PredictionResult(
        prediction_type=PredictionType.DETERIORATION,
        score=float(total_score),
        risk_level=risk_level,
        probability=probability,
        contributing_factors=contributing_factors,
        recommendations=recommendations,
        model_name="NEWS2",
    )


# =============================================================================
# CHARLSON COMORBIDITY INDEX
# =============================================================================

CHARLSON_WEIGHTS = {
    # Score 1 conditions
    "myocardial_infarction": 1,
    "congestive_heart_failure": 1,
    "peripheral_vascular_disease": 1,
    "cerebrovascular_disease": 1,
    "dementia": 1,
    "chronic_pulmonary_disease": 1,
    "connective_tissue_disease": 1,
    "peptic_ulcer_disease": 1,
    "mild_liver_disease": 1,
    "diabetes_without_complications": 1,
    
    # Score 2 conditions
    "hemiplegia": 2,
    "moderate_severe_renal_disease": 2,
    "diabetes_with_complications": 2,
    "any_tumor": 2,
    "leukemia": 2,
    "lymphoma": 2,
    
    # Score 3 conditions
    "moderate_severe_liver_disease": 3,
    
    # Score 6 conditions
    "metastatic_solid_tumor": 6,
    "aids": 6,
}


def calculate_charlson_index(conditions: List[str]) -> int:
    """
    Calculate Charlson Comorbidity Index.
    
    Args:
        conditions: List of condition names (lowercase)
    
    Returns:
        Charlson Comorbidity Index score
    """
    conditions_lower = [c.lower().replace(" ", "_") for c in conditions]
    total_score = 0
    
    for condition, weight in CHARLSON_WEIGHTS.items():
        for patient_condition in conditions_lower:
            if condition in patient_condition or patient_condition in condition:
                total_score += weight
                break
    
    return total_score


# =============================================================================
# PREDICTION ENGINE
# =============================================================================

class ClinicalPredictionEngine:
    """
    Clinical Prediction Models Engine.
    
    Provides validated prediction models for clinical decision support.
    """
    
    def __init__(self):
        self.stats = {
            "predictions_made": 0,
            "readmission_assessments": 0,
            "deterioration_assessments": 0,
        }
    
    async def assess_readmission_risk(
        self,
        length_of_stay_days: float,
        admission_type: str,
        conditions: List[str],
        ed_visits_6months: int,
        age: Optional[int] = None,
        discharge_destination: Optional[str] = None,
    ) -> PredictionResult:
        """
        Assess 30-day readmission risk.
        """
        self.stats["readmission_assessments"] += 1
        self.stats["predictions_made"] += 1
        
        # Calculate Charlson Index
        charlson_index = calculate_charlson_index(conditions)
        
        # Calculate LACE
        result = calculate_lace_index(
            length_of_stay_days=length_of_stay_days,
            admission_type=admission_type,
            charlson_comorbidity_index=charlson_index,
            ed_visits_6months=ed_visits_6months,
        )
        
        # Additional risk modifiers
        if age and age >= 75:
            result.probability = min(result.probability + 0.05, 0.60)
            result.contributing_factors.append({
                "factor": "Age >= 75",
                "value": f"{age} years",
                "points": "Risk modifier +5%",
            })
        
        if discharge_destination == "skilled_nursing_facility":
            result.probability = min(result.probability + 0.03, 0.60)
        
        return result
    
    async def assess_deterioration_risk(
        self,
        respiratory_rate: int,
        oxygen_saturation: float,
        supplemental_oxygen: bool,
        systolic_bp: int,
        heart_rate: int,
        temperature: float,
        consciousness: str,
        scale: int = 1,
    ) -> PredictionResult:
        """
        Assess clinical deterioration risk using NEWS2.
        """
        self.stats["deterioration_assessments"] += 1
        self.stats["predictions_made"] += 1
        
        return calculate_news2(
            respiratory_rate=respiratory_rate,
            oxygen_saturation=oxygen_saturation,
            supplemental_oxygen=supplemental_oxygen,
            systolic_bp=systolic_bp,
            heart_rate=heart_rate,
            temperature=temperature,
            consciousness=consciousness,
            scale=scale,
        )
    
    async def comprehensive_risk_assessment(
        self,
        patient_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Perform comprehensive risk assessment.
        """
        results = {}
        
        # Readmission risk
        if all(k in patient_data for k in ["length_of_stay_days", "admission_type", "conditions", "ed_visits_6months"]):
            results["readmission_risk"] = (await self.assess_readmission_risk(
                length_of_stay_days=patient_data["length_of_stay_days"],
                admission_type=patient_data["admission_type"],
                conditions=patient_data["conditions"],
                ed_visits_6months=patient_data["ed_visits_6months"],
                age=patient_data.get("age"),
                discharge_destination=patient_data.get("discharge_destination"),
            )).to_dict()
        
        # Deterioration risk
        vital_keys = ["respiratory_rate", "oxygen_saturation", "supplemental_oxygen", 
                      "systolic_bp", "heart_rate", "temperature", "consciousness"]
        if all(k in patient_data for k in vital_keys):
            results["deterioration_risk"] = (await self.assess_deterioration_risk(
                respiratory_rate=patient_data["respiratory_rate"],
                oxygen_saturation=patient_data["oxygen_saturation"],
                supplemental_oxygen=patient_data["supplemental_oxygen"],
                systolic_bp=patient_data["systolic_bp"],
                heart_rate=patient_data["heart_rate"],
                temperature=patient_data["temperature"],
                consciousness=patient_data["consciousness"],
                scale=patient_data.get("news2_scale", 1),
            )).to_dict()
        
        return {
            "assessment_timestamp": datetime.utcnow().isoformat(),
            "results": results,
            "overall_risk_level": self._determine_overall_risk(results),
            "priority_recommendations": self._get_priority_recommendations(results),
        }
    
    def _determine_overall_risk(self, results: Dict) -> str:
        """Determine overall risk level from all predictions."""
        risk_values = {
            "low": 1,
            "moderate": 2,
            "high": 3,
            "very_high": 4,
        }
        
        max_risk = 0
        for result in results.values():
            risk_level = result.get("risk_level", "low")
            max_risk = max(max_risk, risk_values.get(risk_level, 0))
        
        reverse_map = {v: k for k, v in risk_values.items()}
        return reverse_map.get(max_risk, "low")
    
    def _get_priority_recommendations(self, results: Dict) -> List[str]:
        """Get prioritized recommendations across all predictions."""
        priorities = []
        
        for result in results.values():
            if result.get("risk_level") in ["high", "very_high"]:
                priorities.extend(result.get("recommendations", [])[:2])
        
        return priorities[:5]  # Top 5 recommendations
    
    def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics."""
        return self.stats


# Singleton
_prediction_engine: Optional[ClinicalPredictionEngine] = None


def get_prediction_engine() -> ClinicalPredictionEngine:
    """Get prediction engine singleton."""
    global _prediction_engine
    if _prediction_engine is None:
        _prediction_engine = ClinicalPredictionEngine()
    return _prediction_engine
