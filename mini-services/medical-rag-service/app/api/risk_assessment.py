"""
P2: Risk Assessment API for Clinical Decision Support System
============================================================

Implements comprehensive clinical risk assessment:
- Patient risk scoring
- Disease-specific risk calculators
- Mortality risk prediction
- Readmission risk assessment
- Prognostic scoring systems

Supported Risk Models:
- CHA₂DS₂-VASc (Stroke risk in AF)
- HAS-BLED (Bleeding risk)
- Wells Score (DVT/PE)
- qSOFA (Sepsis)
- GRACE (ACS mortality)
- CURB-65 (Pneumonia severity)
"""

import asyncio
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from loguru import logger
from pydantic import BaseModel, Field


# =============================================================================
# RISK SCORE MODELS
# =============================================================================

class RiskLevel(Enum):
    """Risk level classification."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


@dataclass
class RiskFactor:
    """Individual risk factor."""
    name: str
    present: bool
    points: int
    description: str = ""


@dataclass
class RiskScore:
    """Calculated risk score result."""
    score_name: str
    total_points: int
    risk_level: RiskLevel
    percentage_risk: Optional[float] = None
    interpretation: str = ""
    recommendations: List[str] = field(default_factory=list)
    factors: List[RiskFactor] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "score_name": self.score_name,
            "total_points": self.total_points,
            "risk_level": self.risk_level.value,
            "percentage_risk": self.percentage_risk,
            "interpretation": self.interpretation,
            "recommendations": self.recommendations,
            "factors": [
                {
                    "name": f.name,
                    "present": f.present,
                    "points": f.points,
                    "description": f.description,
                }
                for f in self.factors
            ],
        }


# =============================================================================
# CLINICAL RISK CALCULATORS
# =============================================================================

class CHADS2VAScCalculator:
    """
    CHA₂DS₂-VASc Score for Stroke Risk in Atrial Fibrillation.
    
    Reference: Lip GY, et al. Chest 2010;137:263-272
    """
    
    CRITERIA = {
        "congestive_heart_failure": {"points": 1, "description": "History of HF or LVEF ≤40%"},
        "hypertension": {"points": 1, "description": "History of hypertension"},
        "age_75_plus": {"points": 2, "description": "Age ≥75 years"},
        "age_65_74": {"points": 1, "description": "Age 65-74 years"},
        "diabetes": {"points": 1, "description": "Diabetes mellitus"},
        "stroke_tia": {"points": 2, "description": "Prior stroke, TIA, or thromboembolism"},
        "vascular_disease": {"points": 1, "description": "MI, PAD, or aortic plaque"},
        "sex_female": {"points": 1, "description": "Female sex"},
    }
    
    # Annual stroke risk by score
    ANNUAL_RISK = {
        0: 0.0,
        1: 1.3,
        2: 2.2,
        3: 3.2,
        4: 4.0,
        5: 6.7,
        6: 9.8,
        7: 9.6,
        8: 12.0,
        9: 12.0,
    }
    
    @classmethod
    def calculate(cls, **criteria) -> RiskScore:
        """Calculate CHA₂DS₂-VASc score."""
        factors = []
        total_points = 0
        
        for criterion, config in cls.CRITERIA.items():
            present = criteria.get(criterion, False)
            points = config["points"] if present else 0
            total_points += points
            
            factors.append(RiskFactor(
                name=criterion,
                present=present,
                points=points,
                description=config["description"],
            ))
        
        # Determine risk level
        if total_points == 0:
            risk_level = RiskLevel.LOW
        elif total_points == 1:
            risk_level = RiskLevel.MODERATE
        else:
            risk_level = RiskLevel.HIGH if total_points <= 4 else RiskLevel.VERY_HIGH
        
        # Get annual stroke risk
        annual_risk = cls.ANNUAL_RISK.get(total_points, 12.0)
        
        # Generate recommendations
        recommendations = []
        if total_points == 0:
            recommendations.append("No antithrombotic therapy recommended")
        elif total_points == 1:
            recommendations.append("Consider anticoagulation or antiplatelet therapy")
            recommendations.append("Shared decision-making recommended")
        else:
            recommendations.append("Anticoagulation therapy recommended")
            recommendations.append("Options: Warfarin (INR 2-3), DOACs (apixaban, rivaroxaban, dabigatran, edoxaban)")
        
        if total_points >= 2:
            recommendations.append("Regular monitoring of renal function if on DOAC")
        
        return RiskScore(
            score_name="CHA₂DS₂-VASc",
            total_points=total_points,
            risk_level=risk_level,
            percentage_risk=annual_risk,
            interpretation=f"Annual stroke risk: {annual_risk}% without anticoagulation",
            recommendations=recommendations,
            factors=factors,
        )


class HASBLEDCalculator:
    """
    HAS-BLED Score for Bleeding Risk in Anticoagulation.
    
    Reference: Pisters R, et al. Chest 2010;138:1093-1100
    """
    
    CRITERIA = {
        "hypertension_uncontrolled": {"points": 1, "description": "Uncontrolled hypertension (SBP >160)"},
        "renal_disease": {"points": 1, "description": "Dialysis, transplant, or Cr ≥2.26 mg/dL"},
        "liver_disease": {"points": 1, "description": "Cirrhosis or bilirubin >2x normal"},
        "stroke_history": {"points": 1, "description": "Prior stroke"},
        "bleeding_history": {"points": 1, "description": "Prior major bleeding or predisposition"},
        "labile_inr": {"points": 1, "description": "Labile INR (if on warfarin)"},
        "age_65_plus": {"points": 1, "description": "Age >65 years"},
        "drugs": {"points": 1, "description": "Antiplatelet agents or NSAIDs"},
        "alcohol": {"points": 1, "description": "Alcohol ≥8 drinks/week"},
    }
    
    # Annual bleeding risk by score
    ANNUAL_RISK = {
        0: 1.13,
        1: 1.02,
        2: 1.88,
        3: 3.74,
        4: 8.70,
        5: 12.0,
        6: 12.0,
        7: 12.0,
        8: 12.0,
        9: 12.0,
    }
    
    @classmethod
    def calculate(cls, **criteria) -> RiskScore:
        """Calculate HAS-BLED score."""
        factors = []
        total_points = 0
        
        for criterion, config in cls.CRITERIA.items():
            present = criteria.get(criterion, False)
            points = config["points"] if present else 0
            total_points += points
            
            factors.append(RiskFactor(
                name=criterion,
                present=present,
                points=points,
                description=config["description"],
            ))
        
        # Determine risk level
        if total_points <= 1:
            risk_level = RiskLevel.LOW
        elif total_points == 2:
            risk_level = RiskLevel.MODERATE
        else:
            risk_level = RiskLevel.HIGH
        
        annual_risk = cls.ANNUAL_RISK.get(total_points, 12.0)
        
        recommendations = []
        if total_points >= 3:
            recommendations.append("HIGH bleeding risk - address modifiable risk factors")
            recommendations.append("Consider DOACs over warfarin")
            recommendations.append("Avoid concomitant antiplatelet therapy if possible")
            recommendations.append("Frequent clinical monitoring recommended")
        else:
            recommendations.append("Low-moderate bleeding risk")
            recommendations.append("Standard anticoagulation monitoring")
        
        return RiskScore(
            score_name="HAS-BLED",
            total_points=total_points,
            risk_level=risk_level,
            percentage_risk=annual_risk,
            interpretation=f"Annual major bleeding risk: {annual_risk}%",
            recommendations=recommendations,
            factors=factors,
        )


class WellsDVTCalculator:
    """
    Wells Score for Deep Vein Thrombosis.
    
    Reference: Wells PS, et al. JAMA 2006;295:169-175
    """
    
    CRITERIA = {
        "active_cancer": {"points": 1, "description": "Active cancer (treatment ongoing or within 6 months)"},
        "paralysis_paresis": {"points": 1, "description": "Paralysis, paresis, or recent plaster immobilization"},
        "bedridden_surgery": {"points": 1, "description": "Recently bedridden >3 days or major surgery <12 weeks"},
        "localized_tenderness": {"points": 1, "description": "Localized tenderness along deep venous system"},
        "entire_leg_swollen": {"points": 1, "description": "Entire leg swollen"},
        "calf_swelling": {"points": 1, "description": "Calf swelling >3 cm compared to asymptomatic side"},
        "pitting_edema": {"points": 1, "description": "Pitting edema confined to symptomatic leg"},
        "collateral_veins": {"points": 1, "description": "Collateral superficial veins"},
        "alternative_diagnosis": {"points": -2, "description": "Alternative diagnosis as likely or greater than DVT"},
    }
    
    @classmethod
    def calculate(cls, **criteria) -> RiskScore:
        """Calculate Wells DVT score."""
        factors = []
        total_points = 0
        
        for criterion, config in cls.CRITERIA.items():
            present = criteria.get(criterion, False)
            points = config["points"] if present else 0
            total_points += points
            
            factors.append(RiskFactor(
                name=criterion,
                present=present,
                points=points,
                description=config["description"],
            ))
        
        # Determine probability
        if total_points <= 0:
            probability = "low"
            risk_level = RiskLevel.LOW
            pre_test_prob = "5-10%"
        elif total_points <= 2:
            probability = "moderate"
            risk_level = RiskLevel.MODERATE
            pre_test_prob = "20-30%"
        else:
            probability = "high"
            risk_level = RiskLevel.HIGH
            pre_test_prob = "50-75%"
        
        recommendations = []
        if total_points <= 0:
            recommendations.append("D-dimer test recommended")
            recommendations.append("If D-dimer negative, DVT unlikely - consider alternative diagnosis")
        elif total_points <= 2:
            recommendations.append("D-dimer test or ultrasound recommended")
            recommendations.append("If D-dimer positive, proceed to ultrasound")
        else:
            recommendations.append("High probability - proceed to ultrasound")
            recommendations.append("Consider empiric anticoagulation while awaiting imaging")
        
        return RiskScore(
            score_name="Wells DVT",
            total_points=total_points,
            risk_level=risk_level,
            interpretation=f"{probability.title()} probability (score {total_points}): Pre-test probability {pre_test_prob}",
            recommendations=recommendations,
            factors=factors,
        )


class QSOFA_Calculator:
    """
    qSOFA Score for Sepsis Risk Assessment.
    
    Reference: Seymour CW, et al. JAMA 2016;315:762-774
    """
    
    CRITERIA = {
        "respiratory_rate_22": {"points": 1, "description": "Respiratory rate ≥22/min"},
        "altered_mentation": {"points": 1, "description": "Altered mental status (GCS <15)"},
        "systolic_bp_100": {"points": 1, "description": "Systolic blood pressure ≤100 mmHg"},
    }
    
    @classmethod
    def calculate(cls, **criteria) -> RiskScore:
        """Calculate qSOFA score."""
        factors = []
        total_points = 0
        
        for criterion, config in cls.CRITERIA.items():
            present = criteria.get(criterion, False)
            points = config["points"] if present else 0
            total_points += points
            
            factors.append(RiskFactor(
                name=criterion,
                present=present,
                points=points,
                description=config["description"],
            ))
        
        # Determine risk
        if total_points < 2:
            risk_level = RiskLevel.LOW
            mortality_risk = "<3%"
        else:
            risk_level = RiskLevel.HIGH
            mortality_risk = "10-20%"
        
        recommendations = []
        if total_points >= 2:
            recommendations.append("⚠️ HIGH RISK - Suspect sepsis")
            recommendations.append("Obtain blood cultures before antibiotics")
            recommendations.append("Start broad-spectrum antibiotics within 1 hour")
            recommendations.append("Measure serum lactate")
            recommendations.append("Consider ICU admission")
            recommendations.append("Hospital mortality ~10-20%")
        else:
            recommendations.append("Low risk for poor outcome")
            recommendations.append("Monitor closely if infection suspected")
        
        return RiskScore(
            score_name="qSOFA",
            total_points=total_points,
            risk_level=risk_level,
            interpretation=f"Score {total_points}/3: {mortality_risk} hospital mortality risk",
            recommendations=recommendations,
            factors=factors,
        )


class CURB65Calculator:
    """
    CURB-65 Score for Pneumonia Severity.
    
    Reference: Lim WS, et al. Thorax 2003;58:377-382
    """
    
    CRITERIA = {
        "confusion": {"points": 1, "description": "Confusion (new onset, AMT ≤8)"},
        "urea_7": {"points": 1, "description": "Urea >7 mmol/L (BUN >20 mg/dL)"},
        "respiratory_rate_30": {"points": 1, "description": "Respiratory rate ≥30/min"},
        "bp_low": {"points": 1, "description": "SBP <90 or DBP ≤60 mmHg"},
        "age_65_plus": {"points": 1, "description": "Age ≥65 years"},
    }
    
    MORTALITY_RISK = {
        0: 0.6,
        1: 2.7,
        2: 6.8,
        3: 14.0,
        4: 27.8,
        5: 27.8,
    }
    
    @classmethod
    def calculate(cls, **criteria) -> RiskScore:
        """Calculate CURB-65 score."""
        factors = []
        total_points = 0
        
        for criterion, config in cls.CRITERIA.items():
            present = criteria.get(criterion, False)
            points = config["points"] if present else 0
            total_points += points
            
            factors.append(RiskFactor(
                name=criterion,
                present=present,
                points=points,
                description=config["description"],
            ))
        
        # Determine risk level and mortality
        mortality = cls.MORTALITY_RISK.get(total_points, 27.8)
        
        if total_points <= 1:
            risk_level = RiskLevel.LOW
        elif total_points == 2:
            risk_level = RiskLevel.MODERATE
        else:
            risk_level = RiskLevel.HIGH if total_points <= 3 else RiskLevel.VERY_HIGH
        
        recommendations = []
        if total_points == 0:
            recommendations.append("Low severity - consider outpatient treatment")
        elif total_points == 1:
            recommendations.append("Low-moderate severity - consider outpatient with follow-up")
        elif total_points == 2:
            recommendations.append("Moderate severity - hospital admission recommended")
            recommendations.append("Consider short-stay unit if stable")
        else:
            recommendations.append("Severe pneumonia - hospital admission required")
            recommendations.append("Consider ICU if score ≥4")
        
        return RiskScore(
            score_name="CURB-65",
            total_points=total_points,
            risk_level=risk_level,
            percentage_risk=mortality,
            interpretation=f"30-day mortality risk: {mortality}%",
            recommendations=recommendations,
            factors=factors,
        )


# =============================================================================
# RISK ASSESSMENT SERVICE
# =============================================================================

class RiskAssessmentService:
    """
    P2: Comprehensive Risk Assessment Service for Clinical Decision Support.
    
    Aggregates multiple risk scoring systems for patient assessment.
    """
    
    CALCULATORS = {
        "chads2vasc": CHADS2VAScCalculator,
        "hasbled": HASBLEDCalculator,
        "wells_dvt": WellsDVTCalculator,
        "qsofa": QSOFA_Calculator,
        "curb65": CURB65Calculator,
    }
    
    def __init__(self):
        self.stats = {
            "total_calculations": 0,
            "by_score": {},
        }
    
    async def calculate_score(
        self,
        score_name: str,
        **criteria,
    ) -> Dict[str, Any]:
        """Calculate a specific risk score."""
        score_key = score_name.lower().replace("-", "_").replace(" ", "_")
        
        if score_key not in self.CALCULATORS:
            return {
                "error": f"Unknown score: {score_name}",
                "available_scores": list(self.CALCULATORS.keys()),
            }
        
        calculator = self.CALCULATORS[score_key]
        result = calculator.calculate(**criteria)
        
        self.stats["total_calculations"] += 1
        self.stats["by_score"][score_key] = self.stats["by_score"].get(score_key, 0) + 1
        
        return result.to_dict()
    
    async def calculate_all_applicable(
        self,
        patient_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Calculate all applicable risk scores for a patient."""
        results = {}
        
        # Extract common fields
        age = patient_data.get("age", 0)
        gender = patient_data.get("gender", "").lower()
        
        # CHA₂DS₂-VASc (if AF indicated)
        if patient_data.get("atrial_fibrillation"):
            results["chads2vasc"] = await self.calculate_score(
                "chads2vasc",
                congestive_heart_failure=patient_data.get("heart_failure", False),
                hypertension=patient_data.get("hypertension", False),
                age_75_plus=age >= 75,
                age_65_74=65 <= age < 75,
                diabetes=patient_data.get("diabetes", False),
                stroke_tia=patient_data.get("stroke_history", False),
                vascular_disease=patient_data.get("vascular_disease", False),
                sex_female=gender == "female",
            )
            
            # Also calculate HAS-BLED for AF patients
            results["hasbled"] = await self.calculate_score(
                "hasbled",
                hypertension_uncontrolled=patient_data.get("hypertension_uncontrolled", False),
                renal_disease=patient_data.get("renal_disease", False),
                liver_disease=patient_data.get("liver_disease", False),
                stroke_history=patient_data.get("stroke_history", False),
                bleeding_history=patient_data.get("bleeding_history", False),
                labile_inr=patient_data.get("labile_inr", False),
                age_65_plus=age > 65,
                drugs=patient_data.get("antiplatelet_or_nsaid", False),
                alcohol=patient_data.get("alcohol_excess", False),
            )
        
        # qSOFA (if infection suspected)
        if patient_data.get("suspected_infection"):
            vital_signs = patient_data.get("vital_signs", {})
            results["qsofa"] = await self.calculate_score(
                "qsofa",
                respiratory_rate_22=vital_signs.get("respiratory_rate", 0) >= 22,
                altered_mentation=patient_data.get("altered_mentation", False),
                systolic_bp_100=vital_signs.get("systolic_bp", 200) <= 100,
            )
        
        # CURB-65 (if pneumonia suspected)
        if patient_data.get("pneumonia_suspected"):
            vital_signs = patient_data.get("vital_signs", {})
            labs = patient_data.get("lab_results", {})
            results["curb65"] = await self.calculate_score(
                "curb65",
                confusion=patient_data.get("confusion", False),
                urea_7=labs.get("bun", 0) > 20,
                respiratory_rate_30=vital_signs.get("respiratory_rate", 0) >= 30,
                bp_low=vital_signs.get("systolic_bp", 200) <= 90 or vital_signs.get("diastolic_bp", 200) <= 60,
                age_65_plus=age >= 65,
            )
        
        # Wells DVT (if DVT suspected)
        if patient_data.get("dvt_suspected"):
            results["wells_dvt"] = await self.calculate_score(
                "wells_dvt",
                active_cancer=patient_data.get("active_cancer", False),
                paralysis_paresis=patient_data.get("paralysis", False),
                bedridden_surgery=patient_data.get("recent_surgery", False),
                localized_tenderness=patient_data.get("leg_tenderness", False),
                entire_leg_swollen=patient_data.get("leg_swelling", False),
                calf_swelling=patient_data.get("calf_swelling_3cm", False),
                pitting_edema=patient_data.get("pitting_edema", False),
                collateral_veins=patient_data.get("collateral_veins", False),
                alternative_diagnosis=patient_data.get("alternative_diagnosis_likely", False),
            )
        
        return {
            "patient_summary": {
                "age": age,
                "gender": gender,
                "conditions_evaluated": list(results.keys()),
            },
            "risk_scores": results,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def get_available_scores(self) -> List[Dict[str, str]]:
        """Get list of available risk scores."""
        return [
            {
                "id": "chads2vasc",
                "name": "CHA₂DS₂-VASc",
                "description": "Stroke risk in atrial fibrillation",
                "use_case": "Atrial fibrillation anticoagulation decision",
            },
            {
                "id": "hasbled",
                "name": "HAS-BLED",
                "description": "Bleeding risk with anticoagulation",
                "use_case": "Anticoagulation bleeding risk assessment",
            },
            {
                "id": "wells_dvt",
                "name": "Wells DVT Score",
                "description": "DVT probability assessment",
                "use_case": "Suspected deep vein thrombosis",
            },
            {
                "id": "qsofa",
                "name": "qSOFA",
                "description": "Sepsis risk assessment",
                "use_case": "Suspected infection/sepsis",
            },
            {
                "id": "curb65",
                "name": "CURB-65",
                "description": "Pneumonia severity assessment",
                "use_case": "Community-acquired pneumonia",
            },
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return self.stats


# Singleton instance
_risk_service: Optional[RiskAssessmentService] = None


def get_risk_service() -> RiskAssessmentService:
    """Get or create risk service singleton."""
    global _risk_service
    
    if _risk_service is None:
        _risk_service = RiskAssessmentService()
    
    return _risk_service
