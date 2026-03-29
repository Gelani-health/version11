"""
P5: USPSTF Preventive Care Screening Recommendations
=====================================================

Evidence-based preventive care recommendations from the U.S. Preventive Services
Task Force (USPSTF) with A and B grade recommendations.

Grade Definitions:
- Grade A: The USPSTF recommends the service. There is high certainty that the
  net benefit is substantial.
- Grade B: The USPSTF recommends the service. There is high certainty that the
  net benefit is moderate or there is moderate certainty that the net benefit
  is moderate to substantial.

Reference: https://www.uspreventiveservicestaskforce.org/uspstf/
Last Updated: 2024 Recommendations
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class USPSTFGrade(str, Enum):
    """USPSTF recommendation grades."""
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    I = "I"  # Insufficient evidence


class ScreeningCategory(str, Enum):
    """Categories of screening."""
    CANCER = "cancer"
    CARDIOVASCULAR = "cardiovascular"
    INFECTIOUS_DISEASE = "infectious_disease"
    METABOLIC = "metabolic"
    MENTAL_HEALTH = "mental_health"
    REPRODUCTIVE = "reproductive"
    SENSORY = "sensory"
    MUSCULOSKELETAL = "musculoskeletal"


@dataclass
class USPSTFRecommendation:
    """A USPSTF screening recommendation."""
    id: str
    name: str
    grade: USPSTFGrade
    category: ScreeningCategory
    target_population: str
    age_range: str
    frequency: str
    description: str
    implementation_notes: str
    contraindications: List[str] = field(default_factory=list)
    shared_decision_making: bool = False
    icd10_codes: List[str] = field(default_factory=list)
    cpt_codes: List[str] = field(default_factory=list)
    last_reviewed: str = "2024"
    evidence_source: str = "USPSTF"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "grade": self.grade.value,
            "category": self.category.value,
            "target_population": self.target_population,
            "age_range": self.age_range,
            "frequency": self.frequency,
            "description": self.description,
            "implementation_notes": self.implementation_notes,
            "contraindications": self.contraindications,
            "shared_decision_making": self.shared_decision_making,
            "icd10_codes": self.icd10_codes,
            "cpt_codes": self.cpt_codes,
            "last_reviewed": self.last_reviewed,
            "evidence_source": self.evidence_source,
        }


# =============================================================================
# USPSTF A & B GRADE RECOMMENDATIONS DATABASE
# =============================================================================

USPSTF_RECOMMENDATIONS: List[USPSTFRecommendation] = [
    # CANCER SCREENING
    USPSTFRecommendation(
        id="breast-cancer-mammo",
        name="Breast Cancer Screening (Mammography)",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.CANCER,
        target_population="Women",
        age_range="50-74 years",
        frequency="Every 2 years",
        description="Screening mammography for breast cancer detection",
        implementation_notes="Biennial screening mammography for women aged 50 to 74 years. The decision to start screening mammography in women prior to age 50 years should be an individual one.",
        shared_decision_making=True,
        cpt_codes=["77067"],
        icd10_codes=["Z12.31"],
    ),
    USPSTFRecommendation(
        id="cervical-cancer",
        name="Cervical Cancer Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.CANCER,
        target_population="Women with a cervix",
        age_range="21-65 years",
        frequency="Every 3-5 years depending on age and test",
        description="Cervical cytology (Pap smear) and/or HPV testing",
        implementation_notes="Age 21-29: Cytology every 3 years. Age 30-65: Cytology every 3 years, or HPV testing every 5 years, or co-testing every 5 years.",
        cpt_codes=["88142", "88143", "87624"],
        icd10_codes=["Z12.4"],
    ),
    USPSTFRecommendation(
        id="colorectal-cancer",
        name="Colorectal Cancer Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.CANCER,
        target_population="All adults",
        age_range="45-75 years",
        frequency="Varies by test (1-10 years)",
        description="Screening for colorectal cancer using various modalities",
        implementation_notes="Options include: colonoscopy every 10 years, FIT annually, FIT-DNA every 1-3 years, CT colonography every 5 years.",
        cpt_codes=["G0105", "G0121", "82274", "81528"],
        icd10_codes=["Z12.11"],
    ),
    USPSTFRecommendation(
        id="lung-cancer-ldct",
        name="Lung Cancer Screening (Low-Dose CT)",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.CANCER,
        target_population="Adults with smoking history",
        age_range="50-80 years",
        frequency="Annual",
        description="Low-dose computed tomography for lung cancer screening",
        implementation_notes="Adults aged 50-80 years with 20+ pack-year smoking history who currently smoke or quit within past 15 years.",
        contraindications=["Less than 20 pack-year history", "Quit smoking >15 years ago"],
        shared_decision_making=True,
        cpt_codes=["71271"],
        icd10_codes=["Z12.2", "Z87.891"],
    ),
    
    # CARDIOVASCULAR
    USPSTFRecommendation(
        id="aaa-screening",
        name="Abdominal Aortic Aneurysm Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.CARDIOVASCULAR,
        target_population="Men who have ever smoked",
        age_range="65-75 years",
        frequency="One-time",
        description="One-time ultrasonography for AAA in men who have ever smoked",
        implementation_notes="One-time screening by ultrasonography in men aged 65-75 years who have ever smoked.",
        contraindications=["Never smoked"],
        cpt_codes=["G0389"],
        icd10_codes=["Z13.6"],
    ),
    USPSTFRecommendation(
        id="bp-screening",
        name="High Blood Pressure Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.CARDIOVASCULAR,
        target_population="All adults",
        age_range="18+ years",
        frequency="Annual",
        description="Screening for high blood pressure in adults",
        implementation_notes="Screen all adults for high blood pressure. Confirmatory measurement recommended outside clinical setting for diagnosis.",
        cpt_codes=["99213", "99214"],
        icd10_codes=["Z13.6"],
    ),
    USPSTFRecommendation(
        id="statin-prevention",
        name="Statin Use for CVD Prevention",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.CARDIOVASCULAR,
        target_population="Adults at increased CVD risk",
        age_range="40-75 years",
        frequency="Ongoing if prescribed",
        description="Statin therapy for primary prevention of cardiovascular disease",
        implementation_notes="Adults aged 40-75 with 1+ CVD risk factors and 10-year CVD risk >=10%.",
        shared_decision_making=True,
        icd10_codes=["Z79.399"],
    ),
    
    # INFECTIOUS DISEASE
    USPSTFRecommendation(
        id="hepatitis-b",
        name="Hepatitis B Virus Infection Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.INFECTIOUS_DISEASE,
        target_population="Adults at increased risk",
        age_range="18+ years",
        frequency="One-time",
        description="Screening for HBV infection in persons at high risk",
        implementation_notes="Screen persons at high risk: born in high-prevalence countries, injection drug users, MSM, multiple sexual partners.",
        cpt_codes=["87340", "87341"],
        icd10_codes=["Z11.59"],
    ),
    USPSTFRecommendation(
        id="hepatitis-c",
        name="Hepatitis C Virus Infection Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.INFECTIOUS_DISEASE,
        target_population="All adults",
        age_range="18-79 years",
        frequency="One-time",
        description="One-time screening for HCV infection in adults",
        implementation_notes="Screen all adults aged 18-79 years for HCV infection one time.",
        cpt_codes=["87504", "G0472"],
        icd10_codes=["Z11.59"],
    ),
    USPSTFRecommendation(
        id="hiv-screening",
        name="HIV Infection Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.INFECTIOUS_DISEASE,
        target_population="All adults",
        age_range="15-65 years",
        frequency="At least once",
        description="Screening for HIV infection",
        implementation_notes="Screen all adolescents and adults aged 15-65 for HIV infection. Repeat screening based on risk.",
        cpt_codes=["87389", "G0432"],
        icd10_codes=["Z11.4", "Z20.6"],
    ),
    USPSTFRecommendation(
        id="chlamydia-gonorrhea",
        name="Chlamydia and Gonorrhea Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.INFECTIOUS_DISEASE,
        target_population="Sexually active women",
        age_range="24 years and younger, or older if at risk",
        frequency="Annual",
        description="Screening for chlamydia and gonorrhea in sexually active women",
        implementation_notes="Screen sexually active women aged <=24, and older women at increased risk.",
        cpt_codes=["87590", "87591"],
        icd10_codes=["Z11.3"],
    ),
    USPSTFRecommendation(
        id="syphilis-screening",
        name="Syphilis Infection Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.INFECTIOUS_DISEASE,
        target_population="Pregnant women and adults at risk",
        age_range="All ages",
        frequency="Early pregnancy; repeat if risk",
        description="Screening for syphilis infection",
        implementation_notes="Screen all pregnant women at first prenatal visit. Screen adults at increased risk.",
        cpt_codes=["86780"],
        icd10_codes=["Z11.3"],
    ),
    
    # METABOLIC
    USPSTFRecommendation(
        id="prediabetes-t2dm",
        name="Prediabetes and Type 2 Diabetes Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.METABOLIC,
        target_population="Overweight or obese adults",
        age_range="35-70 years",
        frequency="Every 3 years",
        description="Screening for prediabetes and type 2 diabetes mellitus",
        implementation_notes="Screen adults aged 35-70 with overweight or obesity.",
        cpt_codes=["82947", "83036"],
        icd10_codes=["Z13.1"],
    ),
    USPSTFRecommendation(
        id="cholesterol-screening",
        name="Lipid Disorders Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.METABOLIC,
        target_population="Adults",
        age_range="40-75 years",
        frequency="Every 5 years",
        description="Screening for lipid disorders in adults",
        implementation_notes="Screen men >=35 and women >=45. Also screen younger adults with CVD risk factors.",
        cpt_codes=["80061"],
        icd10_codes=["Z13.6"],
    ),
    USPSTFRecommendation(
        id="obesity-screening",
        name="Obesity Screening and Counseling",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.METABOLIC,
        target_population="All adults",
        age_range="18+ years",
        frequency="At each visit",
        description="Screening for obesity and offering intensive behavioral interventions",
        implementation_notes="Screen all adults for obesity. Offer multicomponent interventions for BMI >=30.",
        cpt_codes=["99406", "99407", "G0447"],
        icd10_codes=["E66.9"],
    ),
    
    # MENTAL HEALTH
    USPSTFRecommendation(
        id="depression-adults",
        name="Depression Screening in Adults",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MENTAL_HEALTH,
        target_population="All adults",
        age_range="18+ years",
        frequency="At routine visits",
        description="Screening for depression in adults",
        implementation_notes="Screen all adults for depression using validated tools like PHQ-2/PHQ-9.",
        cpt_codes=["G0444"],
        icd10_codes=["Z13.31"],
    ),
    USPSTFRecommendation(
        id="depression-adolescents",
        name="Depression Screening in Adolescents",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MENTAL_HEALTH,
        target_population="Adolescents",
        age_range="12-18 years",
        frequency="Annual",
        description="Screening for major depressive disorder in adolescents",
        implementation_notes="Screen adolescents aged 12-18 for MDD when systems for treatment exist.",
        cpt_codes=["G0444"],
        icd10_codes=["Z13.31"],
    ),
    USPSTFRecommendation(
        id="anxiety-screening",
        name="Anxiety Screening in Adults",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MENTAL_HEALTH,
        target_population="All adults",
        age_range="18-65 years",
        frequency="At routine visits",
        description="Screening for anxiety in adults",
        implementation_notes="Screen adults for anxiety using validated tools like GAD-7.",
        cpt_codes=["G0444"],
        icd10_codes=["Z13.31"],
    ),
    USPSTFRecommendation(
        id="alcohol-misuse",
        name="Unhealthy Alcohol Use Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MENTAL_HEALTH,
        target_population="All adults",
        age_range="18+ years",
        frequency="At routine visits",
        description="Screening for unhealthy alcohol use in adults",
        implementation_notes="Screen all adults using validated tools like AUDIT-C. Provide brief counseling for those with unhealthy use.",
        cpt_codes=["G0442", "99408"],
        icd10_codes=["Z13.89"],
    ),
    USPSTFRecommendation(
        id="tobacco-use",
        name="Tobacco Use Screening and Cessation",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.MENTAL_HEALTH,
        target_population="All adults",
        age_range="18+ years",
        frequency="At each visit",
        description="Screening for tobacco use and cessation interventions",
        implementation_notes="Ask all adults about tobacco use. Provide cessation interventions for tobacco users.",
        cpt_codes=["99406", "99407"],
        icd10_codes=["Z13.89", "Z72.0"],
    ),
    
    # REPRODUCTIVE
    USPSTFRecommendation(
        id="folic-acid",
        name="Folic Acid Supplementation",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.REPRODUCTIVE,
        target_population="Women planning pregnancy",
        age_range="Reproductive age",
        frequency="Daily starting 1 month before conception",
        description="Folic acid supplementation to prevent neural tube defects",
        implementation_notes="All women planning pregnancy should take 0.4-0.8 mg folic acid daily starting 1 month before conception through first 2-3 months of pregnancy.",
        icd10_codes=["Z31.81"],
    ),
    USPSTFRecommendation(
        id="rh-incompatibility",
        name="Rh(D) Incompatibility Screening",
        grade=USPSTFGrade.A,
        category=ScreeningCategory.REPRODUCTIVE,
        target_population="Pregnant women",
        age_range="Reproductive age",
        frequency="First prenatal visit; 28 weeks if Rh negative",
        description="Screening for Rh(D) incompatibility in pregnancy",
        implementation_notes="Screen all pregnant women for Rh(D) blood type at first prenatal visit.",
        cpt_codes=["86900", "86901"],
        icd10_codes=["Z36"],
    ),
    USPSTFRecommendation(
        id="prenatal-preeclampsia",
        name="Preeclampsia Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.REPRODUCTIVE,
        target_population="Pregnant women",
        age_range="Reproductive age",
        frequency="Each prenatal visit",
        description="Screening for preeclampsia in pregnant women",
        implementation_notes="Screen all pregnant women with BP measurements throughout pregnancy.",
        cpt_codes=["99213", "99214"],
        icd10_codes=["O14.90"],
    ),
    
    # MUSCULOSKELETAL
    USPSTFRecommendation(
        id="fall-prevention",
        name="Falls Prevention in Older Adults",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MUSCULOSKELETAL,
        target_population="Community-dwelling older adults",
        age_range="65+ years",
        frequency="Annual",
        description="Exercise interventions to prevent falls in older adults",
        implementation_notes="Offer exercise interventions to adults >=65 at increased fall risk.",
        cpt_codes=["99406", "97110"],
        icd10_codes=["Z91.81"],
    ),
    USPSTFRecommendation(
        id="osteoporosis-screening",
        name="Osteoporosis Screening",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.MUSCULOSKELETAL,
        target_population="Women",
        age_range="65+ years",
        frequency="Every 2 years",
        description="Screening for osteoporosis with bone measurement testing",
        implementation_notes="Screen women >=65, and younger women at increased risk using FRAX assessment.",
        cpt_codes=["77080", "77081"],
        icd10_codes=["Z13.820"],
    ),
    
    # SENSORY
    USPSTFRecommendation(
        id="vision-children",
        name="Vision Screening in Children",
        grade=USPSTFGrade.B,
        category=ScreeningCategory.SENSORY,
        target_population="Children",
        age_range="3-5 years",
        frequency="At least once",
        description="Vision screening in children aged 3 to 5 years",
        implementation_notes="Screen children aged 3-5 for amblyopia at least once.",
        cpt_codes=["99173", "99174"],
        icd10_codes=["Z01.00"],
    ),
]


class USPSTFScreeningEngine:
    """
    USPSTF Preventive Care Screening Recommendation Engine.
    
    Provides evidence-based screening recommendations based on patient
    demographics and risk factors.
    """
    
    def __init__(self):
        self.recommendations = USPSTF_RECOMMENDATIONS
        self.stats = {
            "assessments_performed": 0,
            "recommendations_generated": 0,
        }
    
    async def get_recommendations_for_patient(
        self,
        date_of_birth: str,
        gender: str,
        risk_factors: Optional[List[str]] = None,
        smoking_status: Optional[str] = None,
        pack_years: Optional[float] = None,
        pregnant: bool = False,
        last_screenings: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Get personalized USPSTF recommendations for a patient.
        """
        self.stats["assessments_performed"] += 1
        
        # Calculate age
        try:
            dob = datetime.fromisoformat(date_of_birth.replace('Z', '+00:00'))
            age = (datetime.now(dob.tzinfo) - dob).days // 365
        except:
            age = None
        
        risk_factors = risk_factors or []
        last_screenings = last_screenings or {}
        gender_lower = gender.lower() if gender else 'unknown'
        
        # Build patient context
        patient_context = {
            "age": age,
            "gender": gender_lower,
            "risk_factors": risk_factors,
            "smoking_status": smoking_status,
            "pack_years": pack_years,
            "pregnant": pregnant,
        }
        
        # Get applicable recommendations
        applicable = []
        upcoming = []
        overdue = []
        
        for rec in self.recommendations:
            if self._is_applicable(rec, patient_context):
                rec_dict = rec.to_dict()
                rec_dict["patient_specific_notes"] = self._get_patient_specific_notes(rec, patient_context)
                
                last_date = last_screenings.get(rec.id)
                if last_date:
                    rec_dict["last_performed"] = last_date
                    if self._is_overdue(rec, last_date):
                        overdue.append(rec_dict)
                    else:
                        upcoming.append(rec_dict)
                else:
                    applicable.append(rec_dict)
        
        # Sort by grade
        def sort_key(r):
            return 0 if r.get("grade") == "A" else 1
        
        applicable.sort(key=sort_key)
        overdue.sort(key=sort_key)
        upcoming.sort(key=sort_key)
        
        self.stats["recommendations_generated"] += len(applicable) + len(overdue) + len(upcoming)
        
        return {
            "assessment_date": datetime.utcnow().isoformat(),
            "patient_context": {
                "age": age,
                "gender": gender,
                "smoking_status": smoking_status,
                "pregnant": pregnant,
            },
            "recommendations": {
                "due_now": applicable,
                "overdue": overdue,
                "upcoming": upcoming,
            },
            "total_recommendations": len(applicable) + len(overdue) + len(upcoming),
            "high_priority_count": sum(1 for r in applicable + overdue if r.get("grade") == "A"),
            "shared_decision_making_count": sum(1 for r in applicable + overdue if r.get("shared_decision_making")),
        }
    
    def _is_applicable(self, recommendation: USPSTFRecommendation, context: Dict[str, Any]) -> bool:
        """Determine if recommendation is applicable to patient."""
        age = context.get("age")
        gender = context.get("gender", "")
        smoking_status = context.get("smoking_status")
        pack_years = context.get("pack_years", 0)
        
        # Parse age range
        min_age, max_age = self._parse_age_range(recommendation.age_range)
        
        if age is not None:
            if min_age is not None and age < min_age:
                return False
            if max_age is not None and age > max_age:
                return False
        
        # Check gender-specific
        target_pop = recommendation.target_population.lower()
        if "women" in target_pop:
            if gender not in ["female", "f"]:
                return False
        if "men" in target_pop:
            if gender not in ["male", "m"]:
                return False
        
        # Special checks
        if recommendation.id == "lung-cancer-ldct":
            if smoking_status not in ["current", "former"]:
                return False
            if pack_years is not None and pack_years < 20:
                return False
        
        if recommendation.id == "aaa-screening":
            if smoking_status == "never":
                return False
        
        return True
    
    def _parse_age_range(self, age_range: str) -> tuple:
        """Parse age range string into min/max ages."""
        import re
        
        if "all ages" in age_range.lower() or "all adults" in age_range.lower():
            return (0, None)
        
        numbers = re.findall(r'\d+', age_range)
        
        if len(numbers) == 1:
            if "+" in age_range or "older" in age_range.lower():
                return (int(numbers[0]), None)
            return (int(numbers[0]), int(numbers[0]))
        elif len(numbers) >= 2:
            return (int(numbers[0]), int(numbers[1]))
        
        return (None, None)
    
    def _is_overdue(self, recommendation: USPSTFRecommendation, last_date: str) -> bool:
        """Check if screening is overdue."""
        try:
            last = datetime.fromisoformat(last_date.replace('Z', '+00:00'))
            months_since = (datetime.now(last.tzinfo) - last).days / 30.44
            
            freq = recommendation.frequency.lower()
            if "annual" in freq:
                return months_since > 12
            elif "2 year" in freq or "biennial" in freq:
                return months_since > 24
            elif "3 year" in freq:
                return months_since > 36
            elif "5 year" in freq:
                return months_since > 60
            elif "one-time" in freq:
                return False
        except:
            pass
        
        return False
    
    def _get_patient_specific_notes(self, recommendation: USPSTFRecommendation, context: Dict[str, Any]) -> str:
        """Generate patient-specific clinical notes."""
        notes = []
        
        if recommendation.shared_decision_making:
            notes.append("Shared decision-making recommended.")
        
        if recommendation.id == "lung-cancer-ldct":
            pack_years = context.get("pack_years", 0)
            notes.append(f"Patient has {pack_years} pack-year history.")
        
        if recommendation.id == "statin-prevention":
            notes.append("Calculate 10-year CVD risk before initiating.")
        
        return " ".join(notes) if notes else ""
    
    def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics."""
        return self.stats


# Singleton
_usptf_engine: Optional[USPSTFScreeningEngine] = None


def get_usptf_engine() -> USPSTFScreeningEngine:
    """Get USPSTF engine singleton."""
    global _usptf_engine
    if _usptf_engine is None:
        _usptf_engine = USPSTFScreeningEngine()
    return _usptf_engine
