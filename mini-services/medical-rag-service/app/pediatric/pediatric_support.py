"""
P3: Pediatric Clinical Decision Support
=======================================

Implements pediatric-specific clinical support:
- Weight-based dosing calculator
- Pediatric vital sign normal ranges by age
- Pediatric BMI/weight-for-age/height-for-age
- Immunization schedule checker
- Developmental milestone tracking
- Pediatric Early Warning Score (PEWS)

Reference: Harriet Lane Handbook, 22nd Edition
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
import math


class AgeGroup(Enum):
    """Pediatric age groups."""
    NEONATE = "neonate"           # 0-28 days
    INFANT = "infant"             # 1-12 months
    TODDLER = "toddler"           # 1-3 years
    PRESCHOOL = "preschool"       # 3-6 years
    SCHOOL_AGE = "school_age"     # 6-12 years
    ADOLESCENT = "adolescent"     # 12-18 years


class UrgencyLevel(Enum):
    """Clinical urgency levels."""
    STABLE = "stable"
    WATCH = "watch"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class VitalSignRange:
    """Normal vital sign range for age group."""
    age_group: str
    age_range: str
    heart_rate_min: int
    heart_rate_max: int
    respiratory_rate_min: int
    respiratory_rate_max: int
    systolic_bp_min: int
    systolic_bp_max: int
    diastolic_bp_min: int
    diastolic_bp_max: int
    temperature_min: float
    temperature_max: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "age_group": self.age_group,
            "age_range": self.age_range,
            "heart_rate": f"{self.heart_rate_min}-{self.heart_rate_max} bpm",
            "respiratory_rate": f"{self.respiratory_rate_min}-{self.respiratory_rate_max} breaths/min",
            "systolic_bp": f"{self.systolic_bp_min}-{self.systolic_bp_max} mmHg",
            "diastolic_bp": f"{self.diastolic_bp_min}-{self.diastolic_bp_max} mmHg",
            "temperature": f"{self.temperature_min}-{self.temperature_max} °C",
        }


# =============================================================================
# PEDIATRIC VITAL SIGN RANGES
# =============================================================================

PEDIATRIC_VITALS: Dict[str, VitalSignRange] = {
    "neonate": VitalSignRange(
        age_group="Neonate",
        age_range="0-28 days",
        heart_rate_min=100, heart_rate_max=180,
        respiratory_rate_min=30, respiratory_rate_max=60,
        systolic_bp_min=60, systolic_bp_max=90,
        diastolic_bp_min=30, diastolic_bp_max=60,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "infant_1_3mo": VitalSignRange(
        age_group="Infant (1-3 months)",
        age_range="1-3 months",
        heart_rate_min=100, heart_rate_max=180,
        respiratory_rate_min=30, respiratory_rate_max=60,
        systolic_bp_min=70, systolic_bp_max=90,
        diastolic_bp_min=35, diastolic_bp_max=60,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "infant_3_6mo": VitalSignRange(
        age_group="Infant (3-6 months)",
        age_range="3-6 months",
        heart_rate_min=90, heart_rate_max=150,
        respiratory_rate_min=25, respiratory_rate_max=45,
        systolic_bp_min=75, systolic_bp_max=95,
        diastolic_bp_min=40, diastolic_bp_max=60,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "infant_6_12mo": VitalSignRange(
        age_group="Infant (6-12 months)",
        age_range="6-12 months",
        heart_rate_min=80, heart_rate_max=140,
        respiratory_rate_min=20, respiratory_rate_max=40,
        systolic_bp_min=80, systolic_bp_max=100,
        diastolic_bp_min=45, diastolic_bp_max=60,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "toddler": VitalSignRange(
        age_group="Toddler",
        age_range="1-3 years",
        heart_rate_min=70, heart_rate_max=130,
        respiratory_rate_min=20, respiratory_rate_max=35,
        systolic_bp_min=85, systolic_bp_max=105,
        diastolic_bp_min=45, diastolic_bp_max=65,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "preschool": VitalSignRange(
        age_group="Preschool",
        age_range="3-6 years",
        heart_rate_min=65, heart_rate_max=120,
        respiratory_rate_min=18, respiratory_rate_max=30,
        systolic_bp_min=90, systolic_bp_max=110,
        diastolic_bp_min=50, diastolic_bp_max=70,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "school_age": VitalSignRange(
        age_group="School Age",
        age_range="6-12 years",
        heart_rate_min=60, heart_rate_max=100,
        respiratory_rate_min=16, respiratory_rate_max=24,
        systolic_bp_min=95, systolic_bp_max=115,
        diastolic_bp_min=55, diastolic_bp_max=70,
        temperature_min=36.5, temperature_max=37.5,
    ),
    "adolescent": VitalSignRange(
        age_group="Adolescent",
        age_range="12-18 years",
        heart_rate_min=55, heart_rate_max=90,
        respiratory_rate_min=12, respiratory_rate_max=20,
        systolic_bp_min=100, systolic_bp_max=125,
        diastolic_bp_min=60, diastolic_bp_max=80,
        temperature_min=36.5, temperature_max=37.5,
    ),
}


# =============================================================================
# WEIGHT-BASED DOSING DATABASE
# =============================================================================

PEDIATRIC_DOSING: Dict[str, Dict[str, Any]] = {
    "ACETAMINOPHEN": {
        "route": "PO/PR",
        "dose_mg_kg": "10-15",
        "interval_hours": "4-6",
        "max_daily_mg_kg": 75,
        "max_single_mg": 1000,
        "max_daily_mg": 4000,
        "notes": "Avoid in liver disease. PR dosing may be less reliable.",
        "weight_based": True,
    },
    "IBUPROFEN": {
        "route": "PO",
        "dose_mg_kg": "10",
        "interval_hours": "6-8",
        "max_daily_mg_kg": 40,
        "max_single_mg": 800,
        "max_daily_mg": 2400,
        "age_min_months": 6,
        "notes": "Avoid in renal disease, dehydration. Give with food.",
        "weight_based": True,
    },
    "AMOXICILLIN": {
        "route": "PO",
        "dose_mg_kg": {
            "standard": {"dose": "25-50", "interval": "8-12", "max_daily": 100},
            "otitis_media": {"dose": "80-90", "interval": "12", "max_daily": 180},
            "pneumonia": {"dose": "90-100", "interval": "12", "max_daily": 180},
        },
        "max_daily_mg": 3000,
        "notes": "High-dose for resistant infections. Adjust in renal impairment.",
        "weight_based": True,
    },
    "AZITHROMYCIN": {
        "route": "PO",
        "dose_mg_kg": {
            "standard": {"dose": "10", "interval": "daily", "days": 5},
            "strep_pharyngitis": {"dose": "12", "interval": "daily", "days": 5},
            "otitis_media": {"dose": "10 day 1, then 5 days 2-5", "interval": "daily", "days": 5},
        },
        "max_daily_mg": 500,
        "notes": "Once daily dosing improves compliance.",
        "weight_based": True,
    },
    "CEFDINIR": {
        "route": "PO",
        "dose_mg_kg": "14",
        "interval_hours": "12-24",
        "max_daily_mg": 600,
        "notes": "Good taste, good for OM. Once daily option available.",
        "weight_based": True,
    },
    "PREDNISONE": {
        "route": "PO",
        "dose_mg_kg": "1-2",
        "interval_hours": "daily",
        "max_daily_mg": 60,
        "notes": "Short courses OK for asthma. Taper if >14 days.",
        "weight_based": True,
    },
    "ALBUTEROL_SYRUP": {
        "route": "PO",
        "dose_mg_kg": "0.1-0.2",
        "interval_hours": "8",
        "max_single_mg": 4,
        "notes": "Syrup rarely used. Inhaled preferred.",
        "weight_based": True,
    },
    "DIPHENHYDRAMINE": {
        "route": "PO/IV/IM",
        "dose_mg_kg": "1-1.5",
        "interval_hours": "6-8",
        "max_single_mg": 50,
        "max_daily_mg_kg": 5,
        "max_daily_mg": 300,
        "age_min_years": 2,
        "notes": "Avoid in infants < 2 years. May cause paradoxical excitation.",
        "weight_based": True,
    },
    "ONDANSETRON": {
        "route": "PO/IV",
        "dose_mg_kg": "0.15",
        "interval_hours": "8",
        "max_single_mg": 8,
        "max_daily_mg": 24,
        "notes": "QT prolongation risk. Single dose often sufficient.",
        "weight_based": True,
    },
    "EPINEPHRINE": {
        "route": "IM",
        "dose_mg_kg": "0.01",
        "concentration": "1:1000",
        "interval_minutes": "5-15",
        "max_single_mg": 0.5,
        "notes": "Anaphylaxis. Auto-injector: 0.15mg (<25kg), 0.3mg (≥25kg)",
        "weight_based": True,
    },
}


# =============================================================================
# DEVELOPMENTAL MILESTONES
# =============================================================================

DEVELOPMENTAL_MILESTONES = {
    2: {
        "age_months": 2,
        "gross_motor": "Lifts head during tummy time",
        "fine_motor": "Opens hands briefly",
        "language": "Coos, makes gurgling sounds",
        "social": "Smiles at people, can briefly calm self",
        "cognitive": "Pays attention to faces, begins to follow things with eyes",
        "red_flags": ["No response to loud sounds", "Doesn't watch things as they move"],
    },
    4: {
        "age_months": 4,
        "gross_motor": "Holds head steady without support, pushes up on elbows",
        "fine_motor": "Brings hands to mouth, swipes at toys",
        "language": "Babbles, copies sounds",
        "social": "Smiles spontaneously, likes to play with people",
        "cognitive": "Watches faces closely, recognizes familiar objects at distance",
        "red_flags": ["Doesn't watch things as they move", "Doesn't smile at people"],
    },
    6: {
        "age_months": 6,
        "gross_motor": "Rolls over in both directions, sits with support",
        "fine_motor": "Reaches for and grasps objects, transfers objects hand to hand",
        "language": "Responds to own name, makes sounds showing joy/displeasure",
        "social": "Knows familiar faces, likes to look at self in mirror",
        "cognitive": "Looks around at things nearby, brings things to mouth",
        "red_flags": ["Doesn't try to get things in reach", "Shows no affection for caregivers"],
    },
    9: {
        "age_months": 9,
        "gross_motor": "Sits without support, crawls, stands holding on",
        "fine_motor": "Picks up small objects with thumb and finger (pincer)",
        "language": "Understands 'no', makes many different sounds",
        "social": "May be afraid of strangers, clings to familiar adults",
        "cognitive": "Watches path of falling objects, looks for hidden objects",
        "red_flags": ["Doesn't bear weight on legs with support", "Doesn't babble"],
    },
    12: {
        "age_months": 12,
        "gross_motor": "Pulls to stand, cruises, may take steps alone",
        "fine_motor": "Bangs objects together, puts objects in container",
        "language": "Says 'mama' or 'dada', tries to copy words",
        "social": "Plays games like pat-a-cake, shows fear in strange situations",
        "cognitive": "Explores things in different ways (shaking, throwing)",
        "red_flags": ["Doesn't crawl", "Can't stand with support", "Doesn't point"],
    },
    18: {
        "age_months": 18,
        "gross_motor": "Walks independently, climbs on furniture",
        "fine_motor": "Scribbles, drinks from cup without lid",
        "language": "Says several single words, points to show interest",
        "social": "Hands objects to others for play, may have temper tantrums",
        "cognitive": "Follows simple commands, looks at correct object when named",
        "red_flags": ["Can't walk", "Doesn't copy others", "Doesn't gain new words"],
    },
    24: {
        "age_months": 24,
        "gross_motor": "Runs, kicks ball, walks up/down stairs holding on",
        "fine_motor": "Stacks 4+ blocks, turns pages one at a time",
        "language": "2-word phrases, follows 2-step commands",
        "social": "Plays alongside other children, gets excited with other kids",
        "cognitive": "Sorts shapes/colors, plays simple make-believe",
        "red_flags": ["Doesn't use 2-word phrases", "Doesn't know common object functions"],
    },
}


# =============================================================================
# IMMUNIZATION SCHEDULE (CDC 2024)
# =============================================================================

IMMUNIZATION_SCHEDULE = {
    "birth": ["Hepatitis B #1"],
    "1_month": ["Hepatitis B #2"],
    "2_months": ["DTaP #1", "IPV #1", "Hib #1", "PCV15 #1", "RV #1", "Hepatitis B #2 (if not at 1 mo)"],
    "4_months": ["DTaP #2", "IPV #2", "Hib #2", "PCV15 #2", "RV #2"],
    "6_months": ["DTaP #3", "IPV #3", "Hib #3", "PCV15 #3", "RV #3", "Influenza (annual)"],
    "6_18_months": ["Hepatitis B #3"],
    "12_15_months": ["MMR #1", "Varicella #1", "Hepatitis A #1", "PCV15 #4"],
    "12_18_months": ["DTaP #4", "Hib #4"],
    "15_18_months": ["Hepatitis A #2"],
    "4_6_years": ["DTaP #5", "IPV #4", "MMR #2", "Varicella #2"],
    "11_12_years": ["Tdap", "MenACWY", "HPV series"],
    "16_years": ["MenB series", "MenACWY booster"],
}


class PediatricDecisionSupport:
    """
    P3: Pediatric Clinical Decision Support System.
    
    Features:
    - Weight-based dosing calculator
    - Vital sign normal ranges
    - BMI percentile calculation
    - Developmental milestone tracking
    - Immunization schedule checker
    - Pediatric Early Warning Score (PEWS)
    """
    
    def __init__(self):
        self.vitals = PEDIATRIC_VITALS
        self.dosing = PEDIATRIC_DOSING
        self.milestones = DEVELOPMENTAL_MILESTONES
        self.immunizations = IMMUNIZATION_SCHEDULE
        
        self.stats = {
            "dosage_calculations": 0,
            "vital_sign_assessments": 0,
            "milestone_checks": 0,
            "immunization_reviews": 0,
        }
    
    def get_age_group(self, age_months: int) -> str:
        """Determine age group based on age in months."""
        if age_months < 1:
            return "neonate"
        elif age_months <= 3:
            return "infant_1_3mo"
        elif age_months <= 6:
            return "infant_3_6mo"
        elif age_months <= 12:
            return "infant_6_12mo"
        elif age_months <= 36:
            return "toddler"
        elif age_months <= 72:
            return "preschool"
        elif age_months <= 144:
            return "school_age"
        else:
            return "adolescent"
    
    async def calculate_dose(
        self,
        medication: str,
        weight_kg: float,
        indication: Optional[str] = None,
        age_months: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculate weight-based dose for pediatric patient.
        
        Args:
            medication: Medication name
            weight_kg: Patient weight in kilograms
            indication: Specific indication (e.g., "otitis_media")
            age_months: Patient age in months
        
        Returns:
            Dose calculation with safety checks
        """
        self.stats["dosage_calculations"] += 1
        
        med_key = medication.upper().replace(" ", "_").replace("-", "_")
        
        if med_key not in self.dosing:
            return {
                "error": f"Medication not found: {medication}",
                "available_medications": list(self.dosing.keys()),
            }
        
        med_data = self.dosing[med_key]
        
        # Check age restriction
        if "age_min_months" in med_data and age_months:
            if age_months < med_data["age_min_months"]:
                return {
                    "error": f"{medication} not recommended for age < {med_data['age_min_months']} months",
                    "alternative": "Consider age-appropriate alternative",
                }
        
        if "age_min_years" in med_data and age_months:
            if age_months < med_data["age_min_years"] * 12:
                return {
                    "error": f"{medication} not recommended for age < {med_data['age_min_years']} years",
                    "alternative": "Consider age-appropriate alternative",
                }
        
        # Get dose based on indication
        dose_info = med_data.get("dose_mg_kg", {})
        
        if isinstance(dose_info, dict):
            # Use indication-specific dosing if available
            if indication and indication.lower().replace(" ", "_") in dose_info:
                dose_data = dose_info[indication.lower().replace(" ", "_")]
            else:
                dose_data = dose_info.get("standard", list(dose_info.values())[0])
        else:
            dose_data = {"dose": dose_info, "interval": med_data.get("interval_hours", "")}
        
        # Parse dose range
        dose_str = str(dose_data.get("dose", dose_data))
        if "-" in dose_str:
            dose_parts = dose_str.split("-")
            dose_min = float(dose_parts[0])
            dose_max = float(dose_parts[1])
        else:
            dose_min = dose_max = float(dose_str)
        
        # Calculate weight-based dose
        calculated_min = weight_kg * dose_min
        calculated_max = weight_kg * dose_max
        
        # Apply maximums
        max_single = med_data.get("max_single_mg")
        if max_single:
            calculated_max = min(calculated_max, max_single)
            calculated_min = min(calculated_min, max_single)
        
        # Calculate daily dose
        interval = dose_data.get("interval", med_data.get("interval_hours", ""))
        if "daily" in str(interval).lower():
            daily_dose = calculated_max
        else:
            try:
                interval_hrs = float(str(interval).replace(" hours", "").replace("hr", ""))
                daily_dose = calculated_max * (24 / interval_hrs)
            except:
                daily_dose = calculated_max * 4  # Assume QID
        
        # Check daily maximum
        max_daily_mg = med_data.get("max_daily_mg")
        if max_daily_mg and daily_dose > max_daily_mg:
            daily_dose = max_daily_mg
            adjusted = True
        else:
            adjusted = False
        
        return {
            "medication": medication,
            "weight_kg": weight_kg,
            "dose_mg_kg": dose_str,
            "calculated_dose": {
                "single_dose_mg": f"{round(calculated_min, 1)} - {round(calculated_max, 1)}",
                "frequency": f"every {interval}" if interval else "",
                "daily_dose_mg": round(daily_dose, 1),
            },
            "maximums": {
                "max_single_mg": max_single,
                "max_daily_mg": max_daily_mg,
            },
            "route": med_data.get("route"),
            "notes": med_data.get("notes"),
            "indication": indication,
            "safety_checks": self._generate_safety_checks(med_key, weight_kg, age_months),
        }
    
    def _generate_safety_checks(
        self,
        medication: str,
        weight_kg: float,
        age_months: Optional[int],
    ) -> List[str]:
        """Generate medication safety checks."""
        checks = []
        
        # Common pediatric safety checks
        if weight_kg < 3:
            checks.append("⚠️ Very low weight - use caution, consider neonatal dosing")
        
        if weight_kg > 40 and age_months and age_months < 144:
            checks.append("ℹ️ Weight above typical for age - verify weight is accurate")
        
        # Medication-specific checks
        if medication == "ACETAMINOPHEN":
            checks.append("Check for acetaminophen in other products (cold medicines)")
            checks.append("Avoid in liver disease")
        
        if medication == "IBUPROFEN":
            checks.append("Give with food")
            checks.append("Avoid in renal disease, dehydration")
            if age_months and age_months < 6:
                checks.append("⚠️ Not recommended for infants < 6 months")
        
        if medication == "DIPHENHYDRAMINE":
            if age_months and age_months < 24:
                checks.append("⚠️ Not recommended for children < 2 years")
            checks.append("May cause paradoxical excitation in children")
        
        if medication == "EPINEPHRINE":
            checks.append("Auto-injector selection: 0.15mg (<25kg), 0.3mg (≥25kg)")
        
        return checks
    
    async def assess_vital_signs(
        self,
        age_months: int,
        heart_rate: int,
        respiratory_rate: int,
        systolic_bp: int,
        diastolic_bp: int,
        temperature: float,
    ) -> Dict[str, Any]:
        """
        Assess vital signs against age-appropriate normal ranges.
        
        Returns:
            Assessment with abnormalities flagged
        """
        self.stats["vital_sign_assessments"] += 1
        
        age_group = self.get_age_group(age_months)
        normal_ranges = self.vitals.get(age_group)
        
        if not normal_ranges:
            return {
                "error": f"No vital sign ranges for age group: {age_group}",
            }
        
        assessment = {
            "age_months": age_months,
            "age_group": normal_ranges.age_group,
            "normal_ranges": normal_ranges.to_dict(),
            "assessment": {},
            "overall_status": "normal",
            "warnings": [],
        }
        
        # Assess each vital sign
        vital_checks = [
            ("heart_rate", heart_rate, normal_ranges.heart_rate_min, normal_ranges.heart_rate_max),
            ("respiratory_rate", respiratory_rate, normal_ranges.respiratory_rate_min, normal_ranges.respiratory_rate_max),
            ("systolic_bp", systolic_bp, normal_ranges.systolic_bp_min, normal_ranges.systolic_bp_max),
            ("diastolic_bp", diastolic_bp, normal_ranges.diastolic_bp_min, normal_ranges.diastolic_bp_max),
        ]
        
        for name, value, low, high in vital_checks:
            if value < low:
                assessment["assessment"][name] = "LOW"
                assessment["warnings"].append(f"⚠️ {name} below normal ({value} vs {low}-{high})")
                assessment["overall_status"] = "abnormal"
            elif value > high:
                assessment["assessment"][name] = "HIGH"
                assessment["warnings"].append(f"⚠️ {name} above normal ({value} vs {low}-{high})")
                assessment["overall_status"] = "abnormal"
            else:
                assessment["assessment"][name] = "NORMAL"
        
        # Temperature check
        if temperature < normal_ranges.temperature_min:
            assessment["assessment"]["temperature"] = "LOW"
            assessment["warnings"].append(f"⚠️ Temperature below normal ({temperature}°C)")
            assessment["overall_status"] = "abnormal"
        elif temperature > normal_ranges.temperature_max:
            assessment["assessment"]["temperature"] = "HIGH"
            if temperature > 38.5:
                assessment["warnings"].append(f"⚠️ Fever: {temperature}°C")
            assessment["overall_status"] = "abnormal"
        else:
            assessment["assessment"]["temperature"] = "NORMAL"
        
        return assessment
    
    async def check_developmental_milestones(
        self,
        age_months: int,
    ) -> Dict[str, Any]:
        """
        Get expected developmental milestones for age.
        
        Returns:
            Expected milestones and red flags
        """
        self.stats["milestone_checks"] += 1
        
        # Find closest milestone age
        milestone_ages = sorted(self.milestones.keys())
        
        current_milestone = None
        next_milestone = None
        
        for i, age in enumerate(milestone_ages):
            if age <= age_months:
                current_milestone = self.milestones[age]
            if age > age_months and next_milestone is None:
                next_milestone = self.milestones[age]
        
        result = {
            "age_months": age_months,
            "current_expected": current_milestone if current_milestone else "Age beyond tracked milestones",
            "next_milestones": next_milestone,
            "red_flags_to_assess": [],
            "clinical_guidance": [],
        }
        
        # Add relevant red flags
        if current_milestone:
            result["red_flags_to_assess"] = current_milestone.get("red_flags", [])
            result["clinical_guidance"].append(
                "Screen for developmental delays using standardized tools (ASQ-3, PEDS)"
            )
        
        if age_months >= 18 and age_months < 30:
            result["clinical_guidance"].append(
                "M-CHAT screening recommended at 18 and 24 months for autism"
            )
        
        return result
    
    async def calculate_pews(
        self,
        age_months: int,
        behavior: str,  # "normal", "sleeping", "irritable", "lethargic", "reduced_response"
        cardiovascular: str,  # "normal", "pale", "gray", "mottled"
        respiratory: str,  # "normal", "10_above_normal", "20_above_normal", "retractions", "o2_required"
    ) -> Dict[str, Any]:
        """
        Calculate Pediatric Early Warning Score (PEWS).
        
        Higher scores indicate higher risk of deterioration.
        """
        score = 0
        
        # Behavior scoring
        behavior_scores = {
            "normal": 0,
            "sleeping": 0,
            "irritable": 1,
            "lethargic": 2,
            "reduced_response": 3,
        }
        behavior_score = behavior_scores.get(behavior.lower(), 0)
        score += behavior_score
        
        # Cardiovascular scoring
        cv_scores = {
            "normal": 0,
            "pale": 1,
            "gray": 2,
            "mottled": 2,
        }
        cv_score = cv_scores.get(cardiovascular.lower(), 0)
        score += cv_score
        
        # Respiratory scoring
        resp_scores = {
            "normal": 0,
            "10_above_normal": 1,
            "20_above_normal": 2,
            "retractions": 2,
            "o2_required": 2,
        }
        resp_score = resp_scores.get(respiratory.lower(), 0)
        score += resp_score
        
        # Determine urgency
        if score <= 1:
            urgency = UrgencyLevel.STABLE
            action = "Continue routine monitoring"
        elif score <= 3:
            urgency = UrgencyLevel.WATCH
            action = "Increase monitoring frequency, notify charge nurse"
        elif score <= 5:
            urgency = UrgencyLevel.WARNING
            action = "Notify physician, consider higher level of care"
        else:
            urgency = UrgencyLevel.CRITICAL
            action = "Immediate physician assessment, consider ICU transfer"
        
        return {
            "age_months": age_months,
            "components": {
                "behavior": {"status": behavior, "score": behavior_score},
                "cardiovascular": {"status": cardiovascular, "score": cv_score},
                "respiratory": {"status": respiratory, "score": resp_score},
            },
            "total_score": score,
            "urgency": urgency.value,
            "recommended_action": action,
        }
    
    async def check_immunization_status(
        self,
        age_months: int,
        immunizations_received: List[str],
    ) -> Dict[str, Any]:
        """
        Check immunization status against recommended schedule.
        
        Returns:
            Due vaccines and catch-up recommendations
        """
        self.stats["immunization_reviews"] += 1
        
        # Normalize received vaccines
        received_lower = [v.lower().strip() for v in immunizations_received]
        
        due_vaccines = []
        overdue_vaccines = []
        
        # Check each scheduled vaccine
        for schedule_age, vaccines in self.immunizations.items():
            # Parse age range
            if "_" in schedule_age:
                parts = schedule_age.split("_")
                if len(parts) == 2:
                    try:
                        age_min = int(parts[0])
                        age_max = int(parts[1])
                        if age_months >= age_min and age_months <= age_max:
                            for vaccine in vaccines:
                                base_name = vaccine.split("#")[0].strip().lower()
                                if not any(base_name in r for r in received_lower):
                                    due_vaccines.append(vaccine)
                    except:
                        pass
            else:
                try:
                    schedule_months = int(schedule_age.replace("_months", ""))
                    if age_months >= schedule_months:
                        for vaccine in vaccines:
                            base_name = vaccine.split("#")[0].strip().lower()
                            if not any(base_name in r for r in received_lower):
                                overdue_vaccines.append(vaccine)
                except:
                    pass
        
        return {
            "age_months": age_months,
            "due_vaccines": due_vaccines,
            "overdue_vaccines": overdue_vaccines,
            "received_count": len(immunizations_received),
            "clinical_guidance": [
                "Review catch-up immunization schedule if overdue",
                "Document all immunizations in registry",
                "Provide VIS (Vaccine Information Statement) to caregiver",
            ],
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get support statistics."""
        return self.stats


# Singleton instance
_pediatric_support: Optional[PediatricDecisionSupport] = None


def get_pediatric_support() -> PediatricDecisionSupport:
    """Get or create pediatric support singleton."""
    global _pediatric_support
    
    if _pediatric_support is None:
        _pediatric_support = PediatricDecisionSupport()
    
    return _pediatric_support
