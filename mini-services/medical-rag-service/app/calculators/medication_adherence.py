"""
P1: Medication Adherence Scoring System
=======================================

Evidence-based medication adherence assessment and improvement strategies.

Features:
- Multiple adherence scales (MMAS-8, Morisky, BMQ)
- Risk factors for non-adherence
- Personalized intervention recommendations
- Adherence prediction

References:
- Morisky DE, et al. J Clin Epidemiol. 2008;61:73-80. (MMAS-8)
- Horne R, et al. Psychol Health. 1999;14:1-24. (BMQ)
- Osterberg L, Blaschke T. N Engl J Med. 2005;353:487-497.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class AdherenceLevel(str, Enum):
    """Adherence classification levels."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    VERY_LOW = "very_low"


class AdherenceBarrier(str, Enum):
    """Common barriers to medication adherence."""
    FORGETFULNESS = "forgetfulness"
    COST = "cost"
    SIDE_EFFECTS = "side_effects"
    COMPLEXITY = "regimen_complexity"
    SKEPTICISM = "skepticism_about_medication"
    ASYMPTOMATIC = "feeling_well_without_symptoms"
    ACCESS = "access_issues"
    HEALTH_LITERACY = "health_literacy"
    DEPRESSION = "depression"
    COGNITIVE_IMPAIRMENT = "cognitive_impairment"


class InterventionType(str, Enum):
    """Types of adherence interventions."""
    EDUCATION = "patient_education"
    REMINDERS = "medication_reminders"
    SIMPLIFICATION = "regimen_simplification"
    COST_REDUCTION = "cost_assistance"
    SOCIAL_SUPPORT = "social_support"
    MONITORING = "adherence_monitoring"
    MOTIVATIONAL = "motivational_interviewing"
    SIDE_EFFECT_MANAGEMENT = "side_effect_management"


@dataclass
class MMAS8Result:
    """Morisky Medication Adherence Scale (8-item) result."""
    score: int  # 0-8
    adherence_level: AdherenceLevel
    responses: Dict[str, bool]
    identified_barriers: List[AdherenceBarrier]
    interpretation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scale": "MMAS-8",
            "score": self.score,
            "adherence_level": self.adherence_level.value,
            "responses": self.responses,
            "identified_barriers": [b.value for b in self.identified_barriers],
            "interpretation": self.interpretation,
        }


@dataclass
class AdherenceAssessment:
    """Complete medication adherence assessment."""
    mmass_score: Optional[MMAS8Result]
    overall_adherence_level: AdherenceLevel
    estimated_adherence_percentage: float
    high_risk_medications: List[str]
    risk_factors: List[str]
    barriers: List[AdherenceBarrier]
    recommended_interventions: List[Dict[str, Any]]
    clinical_recommendations: List[str]
    follow_up_recommendation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mmass_score": self.mmass_score.to_dict() if self.mmass_score else None,
            "overall_adherence_level": self.overall_adherence_level.value,
            "estimated_adherence_percentage": f"{self.estimated_adherence_percentage:.0%}",
            "high_risk_medications": self.high_risk_medications,
            "risk_factors": self.risk_factors,
            "barriers": [b.value for b in self.barriers],
            "recommended_interventions": self.recommended_interventions,
            "clinical_recommendations": self.clinical_recommendations,
            "follow_up_recommendation": self.follow_up_recommendation,
            "timestamp": datetime.utcnow().isoformat(),
        }


class MedicationAdherenceScorer:
    """
    Medication adherence scoring and intervention system.

    Usage:
        scorer = MedicationAdherenceScorer()
        result = scorer.assess(
            mmass_responses={
                "forget": True,
                "stopped_feeling_better": False,
                # ... other MMAS-8 items
            },
            medications=["metformin", "lisinopril", "atorvastatin"],
            age=65,
            has_depression=True,
        )
    """

    # MMAS-8 Questions (simplified keys)
    MMAS_QUESTIONS = {
        "forget": "Do you ever forget to take your medicine?",
        "stopped_feeling_better": "Do you ever stop taking your medicine when you feel better?",
        "stopped_feeling_worse": "Have you ever stopped taking your medicine because you felt worse?",
        "careless": "Do you ever forget to take your medicine when you're supposed to take it more than once a day?",
        "yesterday": "Did you not take your medicine yesterday?",
        "stop_sick": "When you feel like your sickness is under control, do you stop taking your medicine?",
        "hassle": "Do you ever feel hassled about sticking to your treatment plan?",
        "difficulty": "How often do you have difficulty remembering to take all your medicines?",
    }

    # Medications with high risk from non-adherence
    HIGH_RISK_MEDICATIONS = {
        "warfarin": "Anticoagulant - High bleeding/stroke risk if non-adherent",
        "insulin": "Diabetes - DKA or hyperglycemia risk",
        "clopidogrel": "Antiplatelet - Stent thrombosis risk",
        "antiretrovirals": "HIV - Resistance and treatment failure risk",
        "immunosuppressants": "Transplant - Rejection risk",
        "antiepileptics": "Seizure medications - Breakthrough seizures",
        "corticosteroids": "Chronic steroids - Adrenal insufficiency",
        "beta_blockers": "Heart rate control - Rebound tachycardia",
        "clonidine": "Blood pressure - Rebound hypertension",
        "benzodiazepines": "Anxiety/sleep - Withdrawal risk",
        "opioids": "Pain - Withdrawal and tolerance issues",
        "antidepressants": "Depression - Discontinuation syndrome",
        "digoxin": "Heart failure - Toxicity or subtherapeutic",
        "lithium": "Bipolar disorder - Toxicity or relapse",
    }

    # Risk factors for non-adherence
    RISK_FACTORS = {
        "age_over_75": {"weight": 2, "description": "Age > 75 years"},
        "age_under_30": {"weight": 1.5, "description": "Age < 30 years"},
        "polypharmacy": {"weight": 2, "description": "≥ 5 medications"},
        "low_health_literacy": {"weight": 2, "description": "Limited health literacy"},
        "depression": {"weight": 2.5, "description": "Current depression"},
        "cognitive_impairment": {"weight": 3, "description": "Cognitive impairment"},
        "cost_concerns": {"weight": 2, "description": "Financial constraints"},
        "social_isolation": {"weight": 1.5, "description": "Lives alone, limited support"},
        "complex_regimen": {"weight": 2, "description": "Dosing > 2x daily"},
        "asymptomatic_condition": {"weight": 1.5, "description": "No perceived symptoms"},
        "side_effects_history": {"weight": 2, "description": "Previous medication side effects"},
        "skepticism": {"weight": 1.5, "description": "Doubts about medication necessity"},
        "previous_non_adherence": {"weight": 3, "description": "History of non-adherence"},
        "substance_use": {"weight": 2, "description": "Active substance use disorder"},
    }

    # Evidence-based interventions
    INTERVENTIONS = {
        AdherenceBarrier.FORGETFULNESS: [
            {"type": InterventionType.REMINDERS, "description": "Set up pill reminders (app, alarm, pillbox)"},
            {"type": InterventionType.SIMPLIFICATION, "description": "Once-daily dosing if possible"},
            {"type": InterventionType.SOCIAL_SUPPORT, "description": "Family member to remind"},
        ],
        AdherenceBarrier.COST: [
            {"type": InterventionType.COST_REDUCTION, "description": "Generic alternatives"},
            {"type": InterventionType.COST_REDUCTION, "description": "Patient assistance programs"},
            {"type": InterventionType.COST_REDUCTION, "description": "90-day supply instead of 30-day"},
        ],
        AdherenceBarrier.SIDE_EFFECTS: [
            {"type": InterventionType.SIDE_EFFECT_MANAGEMENT, "description": "Review and adjust timing"},
            {"type": InterventionType.SIDE_EFFECT_MANAGEMENT, "description": "Consider alternative medications"},
            {"type": InterventionType.EDUCATION, "description": "Discuss expected vs concerning side effects"},
        ],
        AdherenceBarrier.COMPLEXITY: [
            {"type": InterventionType.SIMPLIFICATION, "description": "Consolidate medications"},
            {"type": InterventionType.SIMPLIFICATION, "description": "Combination pills if available"},
            {"type": InterventionType.SIMPLIFICATION, "description": "Synchronize refills"},
        ],
        AdherenceBarrier.SKEPTICISM: [
            {"type": InterventionType.MOTIVATIONAL, "description": "Motivational interviewing"},
            {"type": InterventionType.EDUCATION, "description": "Discuss benefits/risks with data"},
            {"type": InterventionType.EDUCATION, "description": "Shared decision making"},
        ],
        AdherenceBarrier.ASYMPTOMATIC: [
            {"type": InterventionType.EDUCATION, "description": "Explain condition and medication purpose"},
            {"type": InterventionType.MONITORING, "description": "Track lab values to show medication effect"},
        ],
        AdherenceBarrier.DEPRESSION: [
            {"type": InterventionType.MONITORING, "description": "Depression treatment if not initiated"},
            {"type": InterventionType.SOCIAL_SUPPORT, "description": "Caregiver involvement"},
            {"type": InterventionType.SIMPLIFICATION, "description": "Simplify regimen during acute phase"},
        ],
        AdherenceBarrier.COGNITIVE_IMPAIRMENT: [
            {"type": InterventionType.SOCIAL_SUPPORT, "description": "Caregiver supervision"},
            {"type": InterventionType.REMINDERS, "description": "Blister packs prepared by pharmacy"},
            {"type": InterventionType.MONITORING, "description": "Medication administration observation"},
        ],
    }

    def assess(
        self,
        mmass_responses: Optional[Dict[str, bool]] = None,
        medications: Optional[List[str]] = None,
        age: Optional[int] = None,
        has_depression: bool = False,
        has_cognitive_impairment: bool = False,
        health_literacy_low: bool = False,
        has_cost_concerns: bool = False,
        lives_alone: bool = False,
        previous_non_adherence: bool = False,
        side_effects_history: bool = False,
        substance_use: bool = False,
    ) -> AdherenceAssessment:
        """
        Perform comprehensive adherence assessment.

        Args:
            mmass_responses: Dict of MMAS-8 responses (True = adherence issue)
            medications: List of current medications
            age: Patient age
            has_depression: Current depression diagnosis
            has_cognitive_impairment: Cognitive impairment present
            health_literacy_low: Limited health literacy
            has_cost_concerns: Financial constraints
            lives_alone: Social isolation
            previous_non_adherence: History of non-adherence
            side_effects_history: Previous medication side effects
            substance_use: Active substance use

        Returns:
            AdherenceAssessment with scores and recommendations
        """
        medications = medications or []

        # Calculate MMAS-8 score if responses provided
        mmass_result = None
        if mmass_responses:
            mmass_result = self._calculate_mmass(mmass_responses)

        # Identify high-risk medications
        high_risk = self._identify_high_risk_medications(medications)

        # Calculate risk factors
        risk_factors = self._assess_risk_factors(
            age=age,
            medications=medications,
            has_depression=has_depression,
            has_cognitive_impairment=has_cognitive_impairment,
            health_literacy_low=health_literacy_low,
            has_cost_concerns=has_cost_concerns,
            lives_alone=lives_alone,
            previous_non_adherence=previous_non_adherence,
            side_effects_history=side_effects_history,
            substance_use=substance_use,
        )

        # Identify barriers
        barriers = self._identify_barriers(
            mmass_responses=mmass_responses,
            has_cost_concerns=has_cost_concerns,
            has_depression=has_depression,
            has_cognitive_impairment=has_cognitive_impairment,
        )

        # Determine overall adherence level
        overall_level = self._determine_overall_adherence(
            mmass_result,
            risk_factors,
            barriers,
        )

        # Estimate adherence percentage
        estimated_pct = self._estimate_adherence_percentage(
            overall_level,
            mmass_result,
        )

        # Generate interventions
        interventions = self._generate_interventions(barriers, medications)

        # Generate clinical recommendations
        clinical_recs = self._generate_clinical_recommendations(
            overall_level,
            high_risk,
            barriers,
        )

        # Follow-up recommendation
        follow_up = self._generate_follow_up(overall_level, high_risk)

        return AdherenceAssessment(
            mmass_score=mmass_result,
            overall_adherence_level=overall_level,
            estimated_adherence_percentage=estimated_pct,
            high_risk_medications=high_risk,
            risk_factors=risk_factors,
            barriers=barriers,
            recommended_interventions=interventions,
            clinical_recommendations=clinical_recs,
            follow_up_recommendation=follow_up,
        )

    def _calculate_mmass(self, responses: Dict[str, bool]) -> MMAS8Result:
        """Calculate MMAS-8 score."""
        # Each Yes = lower adherence (score decreases)
        # Question 8 is scaled 0-4 for "How often do you have difficulty"
        score = 8

        for key, has_issue in responses.items():
            if has_issue and key != "difficulty":
                score -= 1

        # Question 8 handling (simplified)
        if responses.get("difficulty", False):
            score -= 1  # Simplified - in real MMAS-8, this is a 5-point scale

        # Determine adherence level
        if score >= 8:
            level = AdherenceLevel.HIGH
            interpretation = "High adherence - Continue current approach"
        elif score >= 6:
            level = AdherenceLevel.MEDIUM
            interpretation = "Medium adherence - Address specific barriers"
        elif score >= 4:
            level = AdherenceLevel.LOW
            interpretation = "Low adherence - Intervention recommended"
        else:
            level = AdherenceLevel.VERY_LOW
            interpretation = "Very low adherence - Urgent intervention needed"

        # Identify barriers from responses
        barriers = []
        if responses.get("forget"):
            barriers.append(AdherenceBarrier.FORGETFULNESS)
        if responses.get("stopped_feeling_better"):
            barriers.append(AdherenceBarrier.ASYMPTOMATIC)
        if responses.get("stopped_feeling_worse"):
            barriers.append(AdherenceBarrier.SIDE_EFFECTS)

        return MMAS8Result(
            score=score,
            adherence_level=level,
            responses=responses,
            identified_barriers=barriers,
            interpretation=interpretation,
        )

    def _identify_high_risk_medications(self, medications: List[str]) -> List[str]:
        """Identify medications with high risk from non-adherence."""
        high_risk = []
        for med in medications:
            med_lower = med.lower()
            for hr_med, description in self.HIGH_RISK_MEDICATIONS.items():
                if hr_med in med_lower:
                    high_risk.append(f"{med}: {description}")
                    break
        return high_risk

    def _assess_risk_factors(
        self,
        age: Optional[int],
        medications: List[str],
        has_depression: bool,
        has_cognitive_impairment: bool,
        health_literacy_low: bool,
        has_cost_concerns: bool,
        lives_alone: bool,
        previous_non_adherence: bool,
        side_effects_history: bool,
        substance_use: bool,
    ) -> List[str]:
        """Assess risk factors for non-adherence."""
        risks = []

        if age is not None:
            if age > 75:
                risks.append(self.RISK_FACTORS["age_over_75"]["description"])
            elif age < 30:
                risks.append(self.RISK_FACTORS["age_under_30"]["description"])

        if len(medications) >= 5:
            risks.append(self.RISK_FACTORS["polypharmacy"]["description"])

        if has_depression:
            risks.append(self.RISK_FACTORS["depression"]["description"])

        if has_cognitive_impairment:
            risks.append(self.RISK_FACTORS["cognitive_impairment"]["description"])

        if health_literacy_low:
            risks.append(self.RISK_FACTORS["low_health_literacy"]["description"])

        if has_cost_concerns:
            risks.append(self.RISK_FACTORS["cost_concerns"]["description"])

        if lives_alone:
            risks.append(self.RISK_FACTORS["social_isolation"]["description"])

        if previous_non_adherence:
            risks.append(self.RISK_FACTORS["previous_non_adherence"]["description"])

        if side_effects_history:
            risks.append(self.RISK_FACTORS["side_effects_history"]["description"])

        if substance_use:
            risks.append(self.RISK_FACTORS["substance_use"]["description"])

        return risks

    def _identify_barriers(
        self,
        mmass_responses: Optional[Dict[str, bool]],
        has_cost_concerns: bool,
        has_depression: bool,
        has_cognitive_impairment: bool,
    ) -> List[AdherenceBarrier]:
        """Identify specific adherence barriers."""
        barriers = []

        if mmass_responses:
            if mmass_responses.get("forget"):
                barriers.append(AdherenceBarrier.FORGETFULNESS)
            if mmass_responses.get("stopped_feeling_better"):
                barriers.append(AdherenceBarrier.ASYMPTOMATIC)
            if mmass_responses.get("stopped_feeling_worse"):
                barriers.append(AdherenceBarrier.SIDE_EFFECTS)

        if has_cost_concerns:
            barriers.append(AdherenceBarrier.COST)

        if has_depression:
            barriers.append(AdherenceBarrier.DEPRESSION)

        if has_cognitive_impairment:
            barriers.append(AdherenceBarrier.COGNITIVE_IMPAIRMENT)

        return list(set(barriers))  # Remove duplicates

    def _determine_overall_adherence(
        self,
        mmass_result: Optional[MMAS8Result],
        risk_factors: List[str],
        barriers: List[AdherenceBarrier],
    ) -> AdherenceLevel:
        """Determine overall adherence level."""
        if mmass_result:
            base_level = mmass_result.adherence_level
        else:
            # Estimate based on risk factors
            if len(risk_factors) >= 4:
                base_level = AdherenceLevel.LOW
            elif len(risk_factors) >= 2:
                base_level = AdherenceLevel.MEDIUM
            else:
                base_level = AdherenceLevel.HIGH

        # Adjust for number of barriers
        if len(barriers) >= 3:
            if base_level == AdherenceLevel.HIGH:
                base_level = AdherenceLevel.MEDIUM
            elif base_level == AdherenceLevel.MEDIUM:
                base_level = AdherenceLevel.LOW

        return base_level

    def _estimate_adherence_percentage(
        self,
        level: AdherenceLevel,
        mmass_result: Optional[MMAS8Result],
    ) -> float:
        """Estimate actual adherence percentage."""
        estimates = {
            AdherenceLevel.HIGH: 0.90,
            AdherenceLevel.MEDIUM: 0.70,
            AdherenceLevel.LOW: 0.50,
            AdherenceLevel.VERY_LOW: 0.30,
        }

        base = estimates.get(level, 0.70)

        # Adjust based on MMAS score if available
        if mmass_result:
            adjustment = (mmass_result.score - 4) * 0.05
            base = max(0.1, min(1.0, base + adjustment))

        return base

    def _generate_interventions(
        self,
        barriers: List[AdherenceBarrier],
        medications: List[str],
    ) -> List[Dict[str, Any]]:
        """Generate personalized interventions."""
        interventions = []

        for barrier in barriers:
            if barrier in self.INTERVENTIONS:
                for intervention in self.INTERVENTIONS[barrier][:2]:  # Top 2 per barrier
                    interventions.append({
                        "barrier": barrier.value,
                        "type": intervention["type"].value,
                        "description": intervention["description"],
                        "priority": "high" if barrier in [
                            AdherenceBarrier.COGNITIVE_IMPAIRMENT,
                            AdherenceBarrier.DEPRESSION
                        ] else "medium",
                    })

        # Add regimen simplification if polypharmacy
        if len(medications) >= 5:
            interventions.append({
                "barrier": "polypharmacy",
                "type": InterventionType.SIMPLIFICATION.value,
                "description": "Medication reconciliation - consider deprescribing",
                "priority": "high",
            })

        return interventions

    def _generate_clinical_recommendations(
        self,
        level: AdherenceLevel,
        high_risk_meds: List[str],
        barriers: List[AdherenceBarrier],
    ) -> List[str]:
        """Generate clinical recommendations."""
        recs = []

        if level == AdherenceLevel.VERY_LOW:
            recs.append("Urgent: Address adherence barriers before medication changes")
            recs.append("Consider directly observed therapy for high-risk medications")

        if high_risk_meds:
            recs.append(f"High-risk medications identified: {len(high_risk_meds)}")
            recs.append("Extra monitoring needed for these medications")

        if AdherenceBarrier.DEPRESSION in barriers:
            recs.append("Screen for and treat depression to improve adherence")

        if AdherenceBarrier.COGNITIVE_IMPAIRMENT in barriers:
            recs.append("Involve caregiver in medication management")

        if AdherenceBarrier.SIDE_EFFECTS in barriers:
            recs.append("Review medications for side effect management")

        return recs

    def _generate_follow_up(
        self,
        level: AdherenceLevel,
        high_risk_meds: List[str],
    ) -> str:
        """Generate follow-up recommendation."""
        if level == AdherenceLevel.VERY_LOW or high_risk_meds:
            return "Follow up in 1-2 weeks to reassess adherence"
        elif level == AdherenceLevel.LOW:
            return "Follow up in 1 month to reassess adherence"
        elif level == AdherenceLevel.MEDIUM:
            return "Follow up in 3 months to reassess adherence"
        else:
            return "Annual adherence assessment recommended"


_adherence_scorer: Optional[MedicationAdherenceScorer] = None


def get_adherence_scorer() -> MedicationAdherenceScorer:
    """Get medication adherence scorer singleton."""
    global _adherence_scorer
    if _adherence_scorer is None:
        _adherence_scorer = MedicationAdherenceScorer()
    return _adherence_scorer
