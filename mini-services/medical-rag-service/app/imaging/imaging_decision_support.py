"""
P3: Diagnostic Imaging Decision Support
=======================================

Implements ACR Appropriateness Criteria-based imaging recommendations:
- Imaging modality recommendations by clinical scenario
- Radiation dose awareness
- Contrast safety assessment
- Pregnancy imaging safety protocols
- Cost-effectiveness considerations

Reference: ACR Appropriateness Criteria 2024
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ImagingModality(Enum):
    """Imaging modalities."""
    XRAY = "xray"
    CT_WITHOUT = "ct_without_contrast"
    CT_WITH = "ct_with_contrast"
    CT_WITHOUT_WITH = "ct_without_and_with_contrast"
    MRI_WITHOUT = "mri_without_contrast"
    MRI_WITH = "mri_with_contrast"
    MRI_WITHOUT_WITH = "mri_without_and_with_contrast"
    ULTRASOUND = "ultrasound"
    PET_CT = "pet_ct"
    NUCLEAR_MEDICINE = "nuclear_medicine"
    ANGIOGRAPHY = "angiography"
    FLUOROSCOPY = "fluoroscopy"


class AppropriatenessRating(Enum):
    """ACR appropriateness rating scale."""
    USUALLY_APPROPRIATE = "usually_appropriate"  # 7-9
    MAYBE_APPROPRIATE = "maybe_appropriate"       # 4-6
    USUALLY_NOT_APPROPRIATE = "usually_not_appropriate"  # 1-3


@dataclass
class ImagingRecommendation:
    """Imaging recommendation with appropriateness."""
    modality: str
    appropriateness_score: int  # 1-9
    appropriateness_level: str
    relative_radiation_level: str
    contrast_required: bool
    pregnancy_safe: bool
    alternatives: List[str] = field(default_factory=list)
    clinical_notes: str = ""
    contraindications: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "modality": self.modality,
            "appropriateness_score": self.appropriateness_score,
            "appropriateness_level": self.appropriateness_level,
            "relative_radiation_level": self.relative_radiation_level,
            "contrast_required": self.contrast_required,
            "pregnancy_safe": self.pregnancy_safe,
            "alternatives": self.alternatives,
            "clinical_notes": self.clinical_notes,
            "contraindications": self.contraindications,
        }


# =============================================================================
# ACR APPROPRIATENESS CRITERIA DATABASE (Simplified)
# =============================================================================

ACR_CRITERIA: Dict[str, Dict[str, Any]] = {
    # HEADACHE
    "HEADACHE_ACUTE_SUDDEN_SEVERE": {
        "clinical_scenario": "Acute headache, sudden onset, severe (thunderclap)",
        "variant": "Suspect subarachnoid hemorrhage",
        "recommendations": [
            ImagingRecommendation(
                modality="CT head without contrast",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line for SAH detection. If negative, consider LP.",
            ),
            ImagingRecommendation(
                modality="MRI head without contrast",
                appropriateness_score=6,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Alternative if CT unavailable or for delayed presentation",
            ),
        ],
        "critical_action": "If SAH suspected, immediate CT. If negative, lumbar puncture.",
    },
    
    "HEADACHE_MIGRAINE_RECURRENT": {
        "clinical_scenario": "Recurrent migraine, normal exam",
        "variant": "No red flags",
        "recommendations": [
            ImagingRecommendation(
                modality="MRI brain without contrast",
                appropriateness_score=4,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Not routinely indicated if no red flags",
            ),
            ImagingRecommendation(
                modality="CT head without contrast",
                appropriateness_score=3,
                appropriateness_level="usually_not_appropriate",
                relative_radiation_level="Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Not routinely indicated for typical migraine",
            ),
        ],
        "clinical_guidance": "Neuroimaging not routinely indicated for typical migraine with normal exam",
    },
    
    # CHEST PAIN
    "CHEST_PAIN_ACUTE_CARDIAC_SUSPECTED": {
        "clinical_scenario": "Acute chest pain, suspect ACS",
        "variant": "Cardiac etiology suspected",
        "recommendations": [
            ImagingRecommendation(
                modality="ECG",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line for ACS evaluation",
            ),
            ImagingRecommendation(
                modality="Chest X-ray",
                appropriateness_score=8,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Very Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Evaluate for other causes (pneumothorax, pneumonia, dissection)",
            ),
            ImagingRecommendation(
                modality="CT coronary angiography",
                appropriateness_score=7,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="For low-intermediate risk patients with negative troponin",
            ),
        ],
    },
    
    "CHEST_PAIN_SUSPECTED_PE": {
        "clinical_scenario": "Chest pain, suspected pulmonary embolism",
        "variant": "Wells score moderate-high or positive D-dimer",
        "recommendations": [
            ImagingRecommendation(
                modality="CT pulmonary angiography (CTPA)",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="Gold standard for PE diagnosis",
                contraindications=["Severe contrast allergy", "Renal failure (Cr > 2.0)"],
            ),
            ImagingRecommendation(
                modality="V/Q scan",
                appropriateness_score=8,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Preferred in pregnancy, young patients, or contrast contraindication",
            ),
            ImagingRecommendation(
                modality="Lower extremity Doppler ultrasound",
                appropriateness_score=7,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="If DVT found, treat without CTPA in stable patient",
            ),
        ],
    },
    
    # ABDOMINAL PAIN
    "ABDOMINAL_PAIN_ACUTE_RIGHT_LOWER_QUADRANT": {
        "clinical_scenario": "Acute RLQ pain, suspect appendicitis",
        "variant": "Adult",
        "recommendations": [
            ImagingRecommendation(
                modality="CT abdomen/pelvis with contrast",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="Gold standard for appendicitis in adults",
            ),
            ImagingRecommendation(
                modality="Ultrasound abdomen",
                appropriateness_score=6,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Alternative for young, thin patients or pregnancy",
            ),
        ],
    },
    
    "ABDOMINAL_PAIN_ACUTE_PREGNANCY": {
        "clinical_scenario": "Acute abdominal pain in pregnancy",
        "variant": "Pregnant patient",
        "recommendations": [
            ImagingRecommendation(
                modality="Ultrasound abdomen/pelvis",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line imaging in pregnancy",
            ),
            ImagingRecommendation(
                modality="MRI abdomen/pelvis without contrast",
                appropriateness_score=8,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="If ultrasound non-diagnostic and clinical concern remains",
                contraindications=["First trimester (relative)", "Gadolinium contraindicated"],
            ),
            ImagingRecommendation(
                modality="CT abdomen/pelvis with contrast",
                appropriateness_score=5,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="Only if MRI unavailable and clinical urgency high. Counsel patient on risks.",
            ),
        ],
    },
    
    # LOW BACK PAIN
    "LOW_BACK_PAIN_ACUTE_NO_RED_FLAGS": {
        "clinical_scenario": "Acute low back pain, no red flags",
        "variant": "Non-radiculopathic, no trauma, no red flags",
        "recommendations": [
            ImagingRecommendation(
                modality="Lumbar X-ray",
                appropriateness_score=2,
                appropriateness_level="usually_not_appropriate",
                relative_radiation_level="Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Not routinely indicated without red flags",
            ),
            ImagingRecommendation(
                modality="MRI lumbar spine without contrast",
                appropriateness_score=2,
                appropriateness_level="usually_not_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Not indicated in first 6 weeks unless red flags present",
            ),
        ],
        "clinical_guidance": "No imaging indicated for acute LBP without red flags. Conservative management for 6 weeks.",
        "red_flags": ["Fever", "Weight loss", "Bowel/bladder dysfunction", "Progressive neurologic deficit", "History of cancer", "IV drug use", "Immunosuppression"],
    },
    
    "LOW_BACK_PAIN_WITH_RED_FLAGS": {
        "clinical_scenario": "Low back pain with red flags",
        "variant": "Concerning features present",
        "recommendations": [
            ImagingRecommendation(
                modality="MRI lumbar spine without contrast",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line for red flag evaluation",
            ),
            ImagingRecommendation(
                modality="CT lumbar spine without contrast",
                appropriateness_score=6,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="Medium",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Alternative if MRI contraindicated",
            ),
        ],
    },
    
    # STROKE
    "STROKE_ACUTE_SUSPECTED": {
        "clinical_scenario": "Acute stroke suspected",
        "variant": "Within treatment window",
        "recommendations": [
            ImagingRecommendation(
                modality="CT head without contrast",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line to rule out hemorrhage. Rapid acquisition essential.",
            ),
            ImagingRecommendation(
                modality="CT perfusion / CT angiography head/neck",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="For thrombectomy candidacy assessment",
            ),
            ImagingRecommendation(
                modality="MRI brain with diffusion",
                appropriateness_score=8,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="Most sensitive for acute ischemic stroke, but CT preferred for rapidity",
            ),
        ],
        "critical_action": "Immediate CT head for all stroke codes. If hemorrhagic, neurosurgery consult. If ischemic, assess for tPA/thrombectomy.",
    },
    
    # DYSPNEA
    "DYSPNEA_UNDETERMINED_CAUSE": {
        "clinical_scenario": "Dyspnea, undetermined etiology",
        "variant": "Initial evaluation",
        "recommendations": [
            ImagingRecommendation(
                modality="Chest X-ray PA and lateral",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Very Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line for dyspnea evaluation",
            ),
            ImagingRecommendation(
                modality="CT chest without contrast",
                appropriateness_score=7,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="If CXR abnormal or clinical suspicion for interstitial lung disease",
            ),
            ImagingRecommendation(
                modality="CT chest with contrast",
                appropriateness_score=7,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Medium",
                contrast_required=True,
                pregnancy_safe=False,
                clinical_notes="If mass, effusion, or vascular abnormality suspected",
            ),
        ],
    },
    
    # SUSPECTED FRACTURE
    "TRAUMA_SUSPECTED_FRACTURE_EXTREMITY": {
        "clinical_scenario": "Trauma, suspected extremity fracture",
        "variant": "Adult, acute trauma",
        "recommendations": [
            ImagingRecommendation(
                modality="X-ray of affected area",
                appropriateness_score=9,
                appropriateness_level="usually_appropriate",
                relative_radiation_level="Very Low",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="First-line for suspected fracture",
            ),
            ImagingRecommendation(
                modality="CT of affected area without contrast",
                appropriateness_score=6,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="Medium",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="If X-ray negative but clinical suspicion high, or for surgical planning",
            ),
            ImagingRecommendation(
                modality="MRI of affected area without contrast",
                appropriateness_score=5,
                appropriateness_level="maybe_appropriate",
                relative_radiation_level="None",
                contrast_required=False,
                pregnancy_safe=True,
                clinical_notes="For suspected occult fracture or soft tissue injury",
            ),
        ],
    },
}

# RADIATION DOSE REFERENCE
RADIATION_DOSES = {
    "None": {"effective_dose_mSv": 0, "equivalent": "Background: 0 days"},
    "Very Low": {"effective_dose_mSv": "<0.1", "equivalent": "Background: <1 week"},
    "Low": {"effective_dose_mSv": "0.1-1", "equivalent": "Background: 1-6 months"},
    "Medium": {"effective_dose_mSv": "1-10", "equivalent": "Background: 6 months - 4 years"},
    "High": {"effective_dose_mSv": "10-30", "equivalent": "Background: 4-12 years"},
    "Very High": {"effective_dose_mSv": ">30", "equivalent": "Background: >12 years"},
}

# CONTRAST SAFETY PARAMETERS
CONTRAST_SAFETY = {
    "iodinated_contraindications": [
        "Previous severe allergic reaction to iodinated contrast",
        "Active hyperthyroidism (for some agents)",
    ],
    "iodinated_precautions": [
        "eGFR < 30 mL/min/1.73m² - increased nephropathy risk",
        "Metformin use - hold for 48 hours post-contrast if eGFR < 30",
        "Multiple myeloma",
        "Previous mild allergic reaction",
    ],
    "gadolinium_contraindications": [
        "Severe gadolinium allergy",
    ],
    "gadolinium_precautions": [
        "eGFR < 30 mL/min/1.73m² - NSF risk with some agents",
        "Pregnancy - avoid unless essential",
        "Breastfeeding - pump and discard for 24-48 hours (optional precaution)",
    ],
}


class ImagingDecisionSupport:
    """
    P3: Diagnostic Imaging Decision Support System.
    
    Features:
    - ACR Appropriateness Criteria-based recommendations
    - Radiation dose awareness
    - Contrast safety assessment
    - Pregnancy safety protocols
    - Cost-effectiveness guidance
    """
    
    def __init__(self):
        self.acr_criteria = ACR_CRITERIA
        self.radiation_doses = RADIATION_DOSES
        self.contrast_safety = CONTRAST_SAFETY
        
        self.stats = {
            "total_recommendations": 0,
            "appropriate_studies": 0,
            "radiation_warnings": 0,
            "contrast_safety_checks": 0,
        }
    
    async def get_imaging_recommendation(
        self,
        clinical_scenario: str,
        patient_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Get imaging recommendations based on clinical scenario.
        
        Args:
            clinical_scenario: Key from ACR_CRITERIA database
            patient_data: Patient information including pregnancy status, renal function, allergies
        
        Returns:
            Dictionary with imaging recommendations
        """
        self.stats["total_recommendations"] += 1
        patient_data = patient_data or {}
        
        key = clinical_scenario.upper()
        if key not in self.acr_criteria:
            return {
                "error": f"Unknown clinical scenario: {clinical_scenario}",
                "available_scenarios": list(self.acr_criteria.keys())[:20],
            }
        
        criteria = self.acr_criteria[key]
        
        # Process recommendations with patient-specific considerations
        processed_recommendations = []
        for rec in criteria.get("recommendations", []):
            rec_dict = rec.to_dict()
            
            # Add radiation dose details
            if rec.relative_radiation_level in self.radiation_doses:
                rec_dict["radiation_details"] = self.radiation_doses[rec.relative_radiation_level]
            
            # Check contrast safety
            if rec.contrast_required:
                self.stats["contrast_safety_checks"] += 1
                rec_dict["contrast_safety"] = self._assess_contrast_safety(patient_data)
            
            # Pregnancy warning
            if patient_data.get("pregnant") and not rec.pregnancy_safe:
                rec_dict["pregnancy_warning"] = "⚠️ Not recommended during pregnancy"
            
            # Radiation warning for pediatric
            if patient_data.get("age", 30) < 18 and rec.relative_radiation_level in ["Medium", "High", "Very High"]:
                rec_dict["pediatric_warning"] = "⚠️ Higher radiation sensitivity in pediatric patients"
                self.stats["radiation_warnings"] += 1
            
            processed_recommendations.append(rec_dict)
        
        # Sort by appropriateness score
        processed_recommendations.sort(key=lambda x: x["appropriateness_score"], reverse=True)
        
        # Count appropriate studies
        appropriate = sum(1 for r in processed_recommendations if r["appropriateness_level"] == "usually_appropriate")
        self.stats["appropriate_studies"] += appropriate
        
        return {
            "clinical_scenario": criteria.get("clinical_scenario", ""),
            "variant": criteria.get("variant", ""),
            "recommendations": processed_recommendations,
            "critical_action": criteria.get("critical_action"),
            "clinical_guidance": criteria.get("clinical_guidance"),
            "red_flags": criteria.get("red_flags", []),
        }
    
    def _assess_contrast_safety(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess contrast safety for patient."""
        warnings = []
        contraindications = []
        
        eGFR = patient_data.get("eGFR")
        allergies = patient_data.get("allergies", [])
        medications = patient_data.get("medications", [])
        conditions = patient_data.get("conditions", [])
        
        # Check renal function
        if eGFR is not None and eGFR < 30:
            warnings.append(f"⚠️ Low eGFR ({eGFR} mL/min) - Increased risk of contrast nephropathy")
            warnings.append("Consider pre-hydration and N-acetylcysteine")
        
        # Check metformin use
        if any("metformin" in m.lower() for m in medications):
            if eGFR is not None and eGFR < 30:
                warnings.append("⚠️ Metformin should be held for 48 hours post-contrast with eGFR < 30")
        
        # Check allergies
        for allergy in allergies:
            if "contrast" in allergy.lower() or "dye" in allergy.lower():
                if "severe" in allergy.lower() or "anaphylaxis" in allergy.lower():
                    contraindications.append(f"Severe contrast allergy: {allergy}")
                else:
                    warnings.append(f"Contrast allergy: {allergy} - Consider premedication")
        
        # Check thyroid conditions
        if "hyperthyroidism" in [c.lower() for c in conditions]:
            warnings.append("⚠️ Hyperthyroidism - Use caution with iodinated contrast")
        
        return {
            "warnings": warnings,
            "contraindications": contraindications,
            "safe_to_proceed": len(contraindications) == 0,
            "recommendations": self._get_contrast_recommendations(warnings, contraindications),
        }
    
    def _get_contrast_recommendations(
        self,
        warnings: List[str],
        contraindications: List[str],
    ) -> List[str]:
        """Get recommendations based on contrast safety assessment."""
        recommendations = []
        
        if contraindications:
            recommendations.append("Consider alternative imaging without contrast")
            recommendations.append("If contrast is essential, allergy/immunology consult recommended")
        
        if any("nephropathy" in w.lower() for w in warnings):
            recommendations.append("Pre-hydration with IV normal saline (1 mL/kg/hr for 6-12 hours)")
            recommendations.append("Consider N-acetylcysteine 600 mg BID day before and day of procedure")
            recommendations.append("Monitor renal function 48-72 hours post-procedure")
        
        if any("allergy" in w.lower() for w in warnings):
            recommendations.append("Premedication protocol:")
            recommendations.append("  - Prednisone 50 mg PO at 13, 7, and 1 hour before procedure")
            recommendations.append("  - Diphenhydramine 50 mg IV/IM 1 hour before procedure")
        
        return recommendations
    
    async def assess_pregnancy_imaging(
        self,
        clinical_scenario: str,
        gestational_age_weeks: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Assess imaging options for pregnant patient."""
        key = clinical_scenario.upper()
        criteria = self.acr_criteria.get(key, {})
        
        safe_options = []
        unsafe_options = []
        
        for rec in criteria.get("recommendations", []):
            if rec.pregnancy_safe:
                safe_options.append({
                    "modality": rec.modality,
                    "appropriateness_score": rec.appropriateness_score,
                    "radiation_level": rec.relative_radiation_level,
                })
            else:
                unsafe_options.append({
                    "modality": rec.modality,
                    "reason": "Radiation or contrast exposure",
                    "appropriateness_score": rec.appropriateness_score,
                })
        
        return {
            "clinical_scenario": clinical_scenario,
            "gestational_age_weeks": gestational_age_weeks,
            "safe_imaging_options": safe_options,
            "avoid_during_pregnancy": unsafe_options,
            "general_guidance": [
                "Ultrasound and MRI without contrast are preferred in pregnancy",
                "If CT is necessary, use lowest possible dose",
                "Document informed consent for any radiation exposure",
                "Avoid gadolinium unless essential for diagnosis",
            ],
            "fetal_radiation_risks": {
                "< 50 mGy": "No increased risk of malformations",
                "50-100 mGy": "Potential for small increased risk",
                "> 100 mGy": "Increased risk of malformations, consider counseling",
            },
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get imaging decision support statistics."""
        return self.stats


# Singleton instance
_imaging_support: Optional[ImagingDecisionSupport] = None


def get_imaging_support() -> ImagingDecisionSupport:
    """Get or create imaging decision support singleton."""
    global _imaging_support
    
    if _imaging_support is None:
        _imaging_support = ImagingDecisionSupport()
    
    return _imaging_support
