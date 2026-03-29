"""
P3: Differential Diagnosis Engine
==================================

Implements AI-powered differential diagnosis generation:
- Symptom-based diagnosis generation
- Bayesian probability estimation
- Condition relationship mapping
- Critical diagnosis prioritization
- Age/gender-specific considerations

Reference: First Consult Differential Diagnosis Tool
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import math


class UrgencyLevel(Enum):
    """Diagnostic urgency levels."""
    EMERGENT = "emergent"      # Life-threatening, immediate action
    URGENT = "urgent"          # Serious, evaluation within hours
    SEMI_URGENT = "semi_urgent"  # Important, evaluation within days
    ROUTINE = "routine"        # Non-urgent, routine evaluation


@dataclass
class DifferentialDiagnosis:
    """A differential diagnosis entry."""
    condition: str
    icd_code: str
    probability: float  # 0-1
    probability_display: str  # "High", "Moderate", "Low"
    urgency: UrgencyLevel
    supporting_factors: List[str] = field(default_factory=list)
    contradicting_factors: List[str] = field(default_factory=list)
    required_tests: List[str] = field(default_factory=list)
    clinical_notes: str = ""
    is_critical: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "condition": self.condition,
            "icd_code": self.icd_code,
            "probability": round(self.probability, 3),
            "probability_display": self.probability_display,
            "urgency": self.urgency.value,
            "supporting_factors": self.supporting_factors,
            "contradicting_factors": self.contradicting_factors,
            "required_tests": self.required_tests,
            "clinical_notes": self.clinical_notes,
            "is_critical": self.is_critical,
        }


# =============================================================================
# SYMPTOM-DIAGNOSIS MAPPING DATABASE
# =============================================================================

SYMPTOM_DIAGNOSIS_MAP: Dict[str, Dict[str, Any]] = {
    # CHEST PAIN
    "CHEST_PAIN": {
        "presentations": {
            "acute_severe": {
                "description": "Sudden onset, severe chest pain",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Acute Myocardial Infarction (STEMI/NSTEMI)",
                        icd_code="I21",
                        probability=0.35,
                        probability_display="High",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Radiation to arm/jaw", "Diaphoresis", "Dyspnea", "History of CAD"],
                        contradicting_factors=["Young age without risk factors", "Pleuritic quality"],
                        required_tests=["ECG", "Troponin", "CBC", "BMP", "CXR"],
                        clinical_notes="Time-sensitive diagnosis. Door-to-ECG < 10 minutes.",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Pulmonary Embolism",
                        icd_code="I26",
                        probability=0.20,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Dyspnea", "Leg swelling", "Recent surgery/immobilization", "Hemoptysis"],
                        contradicting_factors=["Normal D-dimer", "Low Wells score"],
                        required_tests=["D-dimer", "CTPA or V/Q scan", "Lower extremity Doppler"],
                        clinical_notes="Consider Wells score for probability assessment",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Aortic Dissection",
                        icd_code="I71.0",
                        probability=0.05,
                        probability_display="Low",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Tearing pain", "Radiation to back", "Blood pressure differential", "Marfan syndrome"],
                        contradicting_factors=["Gradual onset", "Young age without connective tissue disorder"],
                        required_tests=["CT angiography chest/abdomen", "TEE", "D-dimer"],
                        clinical_notes="Critical diagnosis not to miss. Immediate imaging if suspected.",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Pneumothorax",
                        icd_code="J93",
                        probability=0.10,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Sudden onset", "Pleuritic pain", "Dyspnea", "COPD", "Tall thin build"],
                        contradicting_factors=["Bilateral symptoms", "Gradual onset"],
                        required_tests=["CXR (expiratory)", "Bedside ultrasound"],
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Esophageal Rupture",
                        icd_code="K22.3",
                        probability=0.02,
                        probability_display="Low",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Recent vomiting/retching", "Subcutaneous emphysema", "Sepsis"],
                        contradicting_factors=["No preceding event"],
                        required_tests=["CT chest with contrast", "Esophagram", "CXR"],
                        clinical_notes="Boerhaave syndrome - high mortality if delayed",
                        is_critical=True,
                    ),
                ],
            },
            "pleuritic": {
                "description": "Sharp, worse with inspiration",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Pleurisy",
                        icd_code="R09.1",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Recent viral illness", "Positional relief", "Fever"],
                        required_tests=["CXR", "CBC", "ESR/CRP"],
                    ),
                    DifferentialDiagnosis(
                        condition="Pericarditis",
                        icd_code="I30",
                        probability=0.20,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Positional (worse supine)", "Pericardial rub", "Recent viral illness"],
                        contradicting_factors=["No ECG changes", "No rub"],
                        required_tests=["ECG", "Echocardiogram", "ESR/CRP", "Troponin"],
                        clinical_notes="Watch for cardiac tamponade",
                    ),
                    DifferentialDiagnosis(
                        condition="Pneumonia",
                        icd_code="J18",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Fever", "Cough", "Dyspnea", "Crackles on exam"],
                        required_tests=["CXR", "CBC", "BMP", "Sputum culture"],
                    ),
                ],
            },
        },
    },
    
    # ABDOMINAL PAIN
    "ABDOMINAL_PAIN": {
        "presentations": {
            "right_lower_quadrant": {
                "description": "RLQ abdominal pain",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Acute Appendicitis",
                        icd_code="K35",
                        probability=0.40,
                        probability_display="High",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Migration from periumbilical", "Anorexia", "Nausea/vomiting", "Fever", "McBurney point tenderness"],
                        contradicting_factors=["Duration > 72 hours", "Previous appendectomy"],
                        required_tests=["CBC", "CMP", "Urinalysis", "CT abdomen/pelvis", "Pregnancy test (if applicable)"],
                        clinical_notes="Alvarado score can help with diagnosis",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Ovarian Torsion",
                        icd_code="N83.5",
                        probability=0.15,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Female", "Sudden onset", "Nausea/vomiting", "Adnexal mass"],
                        contradicting_factors=["Male", "Gradual onset"],
                        required_tests=["Pelvic ultrasound with Doppler", "Pregnancy test"],
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Ectopic Pregnancy",
                        icd_code="O00",
                        probability=0.10,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Female of reproductive age", "Missed period", "Vaginal bleeding", "Positive pregnancy test"],
                        contradicting_factors=["Negative pregnancy test", "Male"],
                        required_tests=["Quantitative hCG", "Transvaginal ultrasound"],
                        is_critical=True,
                    ),
                ],
            },
            "right_upper_quadrant": {
                "description": "RUQ abdominal pain",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Acute Cholecystitis",
                        icd_code="K81.0",
                        probability=0.35,
                        probability_display="High",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Fever", "Murphy sign", "History of gallstones", "Nausea/vomiting", "Postprandial pain"],
                        required_tests=["CBC", "LFTs", "RUQ ultrasound", "Amylase/lipase"],
                    ),
                    DifferentialDiagnosis(
                        condition="Biliary Colic",
                        icd_code="K80.2",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["History of gallstones", "Postprandial onset", "Resolves spontaneously"],
                        contradicting_factors=["Fever", "Persistent pain", "Elevated WBC"],
                        required_tests=["LFTs", "RUQ ultrasound"],
                    ),
                    DifferentialDiagnosis(
                        condition="Hepatitis",
                        icd_code="K75.9",
                        probability=0.15,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Jaundice", "Elevated LFTs", "RUQ tenderness", "Risk factors for viral hepatitis"],
                        required_tests=["LFTs", "Hepatitis panel", "PT/INR"],
                    ),
                ],
            },
            "epigastric": {
                "description": "Epigastric pain",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Acute Pancreatitis",
                        icd_code="K85",
                        probability=0.30,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Radiation to back", "Nausea/vomiting", "Alcohol use", "Gallstones", "Ranson criteria"],
                        required_tests=["Amylase", "Lipase", "CBC", "BMP", "LFTs", "CT abdomen"],
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Peptic Ulcer Disease",
                        icd_code="K27",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Burning quality", "NSAID use", "H. pylori", "Relief with food (duodenal)"],
                        contradicting_factors=["Radiation to back"],
                        required_tests=["CBC", "H. pylori test", "EGD"],
                    ),
                    DifferentialDiagnosis(
                        condition="Acute Coronary Syndrome",
                        icd_code="I21",
                        probability=0.15,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Diabetes", "Risk factors for CAD", "Diaphoresis", "Dyspnea"],
                        contradicting_factors=["Age < 40 without risk factors"],
                        required_tests=["ECG", "Troponin", "CBC", "BMP"],
                        clinical_notes="Always consider cardiac etiology in epigastric pain",
                        is_critical=True,
                    ),
                ],
            },
        },
    },
    
    # DYSPNEA
    "DYSPNEA": {
        "presentations": {
            "acute": {
                "description": "Acute onset dyspnea",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Acute Heart Failure",
                        icd_code="I50",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Orthopnea", "PND", "Edema", "JVD", "Rales", "History of HF"],
                        contradicting_factors=["Clear lungs", "No edema"],
                        required_tests=["BNP or NT-proBNP", "CXR", "ECG", "Echocardiogram", "BMP"],
                    ),
                    DifferentialDiagnosis(
                        condition="Pulmonary Embolism",
                        icd_code="I26",
                        probability=0.20,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Sudden onset", "Pleuritic chest pain", "Leg swelling", "Risk factors for VTE"],
                        required_tests=["D-dimer", "Wells score", "CTPA or V/Q scan"],
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Pneumothorax",
                        icd_code="J93",
                        probability=0.10,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Sudden onset", "Chest pain", "COPD", "Trauma"],
                        required_tests=["CXR", "Bedside ultrasound"],
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Acute Asthma Exacerbation",
                        icd_code="J45",
                        probability=0.20,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["History of asthma", "Wheezing", "Cough", "Trigger exposure"],
                        contradicting_factors=["No wheeze (silent chest - severe)", "No asthma history"],
                        required_tests=["Peak flow", "SpO2", "ABG if severe"],
                    ),
                    DifferentialDiagnosis(
                        condition="COPD Exacerbation",
                        icd_code="J44.1",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["History of COPD", "Increased sputum", "Change in sputum color", "Smoking history"],
                        required_tests=["CXR", "ABG", "CBC", "BMP", "Spirometry (baseline)"],
                    ),
                ],
            },
            "chronic_progressive": {
                "description": "Chronic progressive dyspnea",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="COPD",
                        icd_code="J44",
                        probability=0.30,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Smoking history", "Chronic cough", "Sputum production", "Gradual onset"],
                        required_tests=["Spirometry with bronchodilator", "CXR", "ABG", "BMP"],
                    ),
                    DifferentialDiagnosis(
                        condition="Heart Failure",
                        icd_code="I50",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Orthopnea", "Edema", "History of MI/HTN", "Crackles"],
                        required_tests=["BNP", "Echocardiogram", "ECG", "CXR"],
                    ),
                    DifferentialDiagnosis(
                        condition="Interstitial Lung Disease",
                        icd_code="J84",
                        probability=0.15,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Dry cough", "Fine crackles", "Occupational exposure", "Connective tissue disease"],
                        required_tests=["HRCT chest", "PFTs", "6-minute walk test"],
                    ),
                ],
            },
        },
    },
    
    # FEVER
    "FEVER": {
        "presentations": {
            "acute_ill_appearing": {
                "description": "Acute fever, ill-appearing",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Sepsis",
                        icd_code="A41",
                        probability=0.35,
                        probability_display="High",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Hypotension", "Tachycardia", "Tachypnea", "Altered mental status", "Source identified"],
                        contradicting_factors=["Stable vital signs", "Well appearance"],
                        required_tests=["CBC with diff", "BMP", "Lactate", "Blood cultures x2", "Urinalysis", "CXR", "Procalcitonin"],
                        clinical_notes="Calculate qSOFA and SOFA scores. Time to antibiotics < 1 hour.",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Meningitis",
                        icd_code="G03",
                        probability=0.10,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Headache", "Neck stiffness", "Photophobia", "Altered mental status"],
                        required_tests=["CBC", "BMP", "Blood cultures", "LP with CSF analysis", "CT head before LP if indicated"],
                        clinical_notes="Empiric antibiotics should not be delayed for LP",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Pneumonia",
                        icd_code="J18",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.URGENT,
                        supporting_factors=["Cough", "Dyspnea", "Crackles", "Sputum production"],
                        required_tests=["CXR", "CBC", "BMP", "Sputum culture"],
                    ),
                ],
            },
        },
    },
    
    # HEADACHE
    "HEADACHE": {
        "presentations": {
            "thunderclap": {
                "description": "Sudden onset severe headache",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Subarachnoid Hemorrhage",
                        icd_code="I60",
                        probability=0.25,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Worst headache of life", "Neck stiffness", "Altered mental status", "Nausea/vomiting"],
                        contradicting_factors=["Gradual onset", "Recurrent similar headaches"],
                        required_tests=["CT head without contrast", "LP if CT negative", "CTA if concern for aneurysm"],
                        clinical_notes="Time-sensitive. CT sensitivity decreases after 24 hours.",
                        is_critical=True,
                    ),
                    DifferentialDiagnosis(
                        condition="Sentinel Headache (Pre-SAH)",
                        icd_code="R51",
                        probability=0.15,
                        probability_display="Low",
                        urgency=UrgencyLevel.EMERGENT,
                        supporting_factors=["Sudden onset", "New severe headache", "Warning bleed"],
                        required_tests=["CT head", "LP"],
                        is_critical=True,
                    ),
                ],
            },
            "chronic_recurrent": {
                "description": "Chronic recurrent headaches",
                "differentials": [
                    DifferentialDiagnosis(
                        condition="Migraine",
                        icd_code="G43",
                        probability=0.40,
                        probability_display="High",
                        urgency=UrgencyLevel.ROUTINE,
                        supporting_factors=["Unilateral", "Throbbing", "Photophobia", "Phonophobia", "Nausea", "Aura"],
                        contradicting_factors=["Positional worsening", "Focal deficits", "Progressive worsening"],
                        required_tests=["Clinical diagnosis", "Neuroimaging if red flags"],
                    ),
                    DifferentialDiagnosis(
                        condition="Tension Headache",
                        icd_code="G44.2",
                        probability=0.35,
                        probability_display="Moderate",
                        urgency=UrgencyLevel.ROUTINE,
                        supporting_factors=["Bilateral", "Band-like", "Pressure quality", "No nausea/vomiting"],
                        required_tests=["Clinical diagnosis"],
                    ),
                    DifferentialDiagnosis(
                        condition="Cluster Headache",
                        icd_code="G44.0",
                        probability=0.10,
                        probability_display="Low",
                        urgency=UrgencyLevel.SEMI_URGENT,
                        supporting_factors=["Unilateral", "Periorbital", "Lacrimation", "Rhinnorrhea", "Duration 15-180 min", "Circadian pattern"],
                        required_tests=["Clinical diagnosis", "MRI brain to rule out secondary causes"],
                    ),
                ],
            },
        },
    },
}


class DifferentialDiagnosisEngine:
    """
    P3: AI-Powered Differential Diagnosis Engine.
    
    Features:
    - Symptom-based diagnosis generation
    - Bayesian probability estimation
    - Critical diagnosis prioritization
    - Age/gender-specific considerations
    - Test recommendations
    """
    
    def __init__(self):
        self.symptom_diagnosis_map = SYMPTOM_DIAGNOSIS_MAP
        
        self.stats = {
            "total_diagnoses_generated": 0,
            "critical_diagnoses_flagged": 0,
        }
    
    async def generate_differential(
        self,
        chief_complaint: str,
        presentation_type: str,
        patient_data: Optional[Dict[str, Any]] = None,
        additional_symptoms: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate differential diagnoses based on presentation.
        
        Args:
            chief_complaint: Primary symptom (e.g., "CHEST_PAIN")
            presentation_type: Subtype of presentation (e.g., "acute_severe")
            patient_data: Patient demographics, history
            additional_symptoms: Associated symptoms
        
        Returns:
            Dictionary with ranked differential diagnoses
        """
        self.stats["total_diagnoses_generated"] += 1
        patient_data = patient_data or {}
        additional_symptoms = additional_symptoms or []
        
        # Normalize input
        complaint_key = chief_complaint.upper().replace(" ", "_")
        presentation_key = presentation_type.lower().replace(" ", "_").replace("-", "_")
        
        # Get base differentials
        if complaint_key not in self.symptom_diagnosis_map:
            return {
                "error": f"Unknown chief complaint: {chief_complaint}",
                "available_complaints": list(self.symptom_diagnosis_map.keys()),
            }
        
        complaint_data = self.symptom_diagnosis_map[complaint_key]
        
        if presentation_key not in complaint_data["presentations"]:
            available = list(complaint_data["presentations"].keys())
            return {
                "error": f"Unknown presentation type: {presentation_type}",
                "available_types": available,
            }
        
        presentation = complaint_data["presentations"][presentation_key]
        differentials = presentation["differentials"]
        
        # Adjust probabilities based on patient factors
        adjusted_differentials = []
        for diff in differentials:
            adjusted_prob = self._adjust_probability(
                diff, patient_data, additional_symptoms
            )
            
            diff_dict = diff.to_dict()
            diff_dict["adjusted_probability"] = round(adjusted_prob, 3)
            diff_dict["probability_rank"] = ""
            
            if diff.is_critical:
                self.stats["critical_diagnoses_flagged"] += 1
            
            adjusted_differentials.append(diff_dict)
        
        # Sort by probability
        adjusted_differentials.sort(key=lambda x: x["adjusted_probability"], reverse=True)
        
        # Add rank
        for i, diff in enumerate(adjusted_differentials, 1):
            diff["probability_rank"] = f"#{i}"
        
        # Separate critical diagnoses
        critical_diagnoses = [d for d in adjusted_differentials if d["is_critical"]]
        
        return {
            "chief_complaint": chief_complaint,
            "presentation": presentation.get("description", presentation_type),
            "differential_diagnoses": adjusted_differentials,
            "critical_diagnoses_to_rule_out": critical_diagnoses,
            "recommended_initial_tests": self._get_initial_tests(adjusted_differentials),
            "red_flags": self._get_red_flags(complaint_key, presentation_key),
            "clinical_guidance": self._generate_clinical_guidance(adjusted_differentials, patient_data),
        }
    
    def _adjust_probability(
        self,
        differential: DifferentialDiagnosis,
        patient_data: Dict[str, Any],
        additional_symptoms: List[str],
    ) -> float:
        """Adjust probability based on patient factors."""
        base_prob = differential.probability
        adjustment_factor = 1.0
        
        age = patient_data.get("age")
        gender = patient_data.get("gender", "").lower()
        
        # Age adjustments
        if age is not None:
            # MI more common in older patients
            if "myocardial infarction" in differential.condition.lower():
                if age > 65:
                    adjustment_factor *= 1.5
                elif age < 40:
                    adjustment_factor *= 0.5
            
            # Appendicitis more common in young
            if "appendicitis" in differential.condition.lower():
                if age < 30:
                    adjustment_factor *= 1.3
                elif age > 50:
                    adjustment_factor *= 0.7
            
            # Ectopic pregnancy - reproductive age only
            if "ectopic" in differential.condition.lower():
                if age < 12 or age > 55:
                    adjustment_factor *= 0.1
        
        # Gender adjustments
        if gender:
            if "ovarian" in differential.condition.lower() and gender != "female":
                adjustment_factor *= 0.01
            if "ectopic" in differential.condition.lower() and gender != "female":
                adjustment_factor *= 0.01
            if "testicular" in differential.condition.lower() and gender != "male":
                adjustment_factor *= 0.01
        
        # Additional symptom matching
        for symptom in additional_symptoms:
            symptom_lower = symptom.lower()
            for factor in differential.supporting_factors:
                if symptom_lower in factor.lower():
                    adjustment_factor *= 1.15
        
        # Check contradicting factors
        risk_factors = patient_data.get("risk_factors", [])
        for factor in differential.contradicting_factors:
            if any(rf.lower() in factor.lower() for rf in risk_factors):
                adjustment_factor *= 0.85
        
        # Apply adjustment with bounds
        adjusted_prob = base_prob * adjustment_factor
        return min(max(adjusted_prob, 0.001), 0.95)
    
    def _get_initial_tests(self, differentials: List[Dict]) -> List[str]:
        """Get recommended initial tests."""
        all_tests = set()
        for diff in differentials[:5]:  # Top 5 diagnoses
            all_tests.update(diff.get("required_tests", []))
        
        # Prioritize common tests
        priority_order = [
            "ECG", "Troponin", "CBC", "BMP", "CXR", "D-dimer",
            "BNP", "Urinalysis", "Lipase", "CT", "MRI"
        ]
        
        sorted_tests = []
        for test in priority_order:
            matching = [t for t in all_tests if test in t]
            sorted_tests.extend(matching)
        
        # Add remaining tests
        for test in all_tests:
            if test not in sorted_tests:
                sorted_tests.append(test)
        
        return sorted_tests[:10]
    
    def _get_red_flags(self, complaint: str, presentation: str) -> List[str]:
        """Get red flags for chief complaint."""
        red_flag_map = {
            "CHEST_PAIN": [
                "Hemodynamic instability",
                "ST elevation on ECG",
                "Blood pressure differential between arms",
                "Widened mediastinum",
                "New murmur",
            ],
            "ABDOMINAL_PAIN": [
                "Peritoneal signs",
                "Hemodynamic instability",
                "Absent bowel sounds",
                "Abdominal pulsatile mass",
                "Third spacing/fluid shift",
            ],
            "HEADACHE": [
                "Thunderclap onset",
                "Worst headache of life",
                "Focal neurologic deficits",
                "Altered mental status",
                "Neck stiffness",
                "Papilledema",
            ],
            "DYSPNEA": [
                "SpO2 < 90%",
                "Respiratory rate > 30",
                "Use of accessory muscles",
                "Inability to speak in full sentences",
                "Altered mental status",
            ],
        }
        
        return red_flag_map.get(complaint, [])
    
    def _generate_clinical_guidance(
        self,
        differentials: List[Dict],
        patient_data: Dict[str, Any],
    ) -> List[str]:
        """Generate clinical guidance based on differential."""
        guidance = []
        
        # Check for critical diagnoses
        critical = [d for d in differentials if d["is_critical"] and d["adjusted_probability"] > 0.05]
        if critical:
            guidance.append(f"⚠️ Must rule out: {', '.join([d['condition'] for d in critical[:3]])}")
        
        # Add specific guidance
        top_diagnosis = differentials[0] if differentials else None
        if top_diagnosis:
            guidance.append(f"Most likely diagnosis: {top_diagnosis['condition']} ({top_diagnosis['probability_display']} probability)")
        
        # Add test priority
        guidance.append("Recommended diagnostic approach: Sequential testing based on pre-test probability")
        
        return guidance
    
    def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics."""
        return self.stats


# Singleton instance
_ddx_engine: Optional[DifferentialDiagnosisEngine] = None


def get_ddx_engine() -> DifferentialDiagnosisEngine:
    """Get or create differential diagnosis engine singleton."""
    global _ddx_engine
    
    if _ddx_engine is None:
        _ddx_engine = DifferentialDiagnosisEngine()
    
    return _ddx_engine
