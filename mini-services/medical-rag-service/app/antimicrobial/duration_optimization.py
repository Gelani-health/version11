"""
Duration Optimization Module for Antimicrobial Stewardship
==========================================================

Evidence-based treatment duration recommendations including:
- Condition-specific treatment duration recommendations
- Biomarker-guided stopping rules (procalcitonin)
- IV-to-PO conversion criteria
- Early stopping criteria
- Duration reduction strategies

References:
- IDSA Clinical Practice Guidelines
- NEJM 2015; "Antibiotic Therapy for 5 Days vs 10 Days"
- Lancet 2020; "Short-course Antibiotic Therapy"
- Procalcitonin Guided Antibiotic Therapy (ProGUARD)
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta


class DurationCategory(Enum):
    """Category for treatment duration."""
    SHORT_COURSE = "short_course"       # ≤5 days
    STANDARD = "standard"               # 5-7 days
    EXTENDED = "extended"               # 7-14 days
    PROLONGED = "prolonged"             # >14 days
    VARIABLE = "variable"               # Depends on response


class ResponseCategory(Enum):
    """Clinical response category."""
    EXCELLENT = "excellent"             # Rapid improvement, afebrile <24h
    GOOD = "good"                       # Improvement, afebrile by 48h
    MODERATE = "moderate"               # Slow improvement
    POOR = "poor"                       # No improvement or worsening


class BiomarkerTrend(Enum):
    """Trend of biomarker levels."""
    RAPID_DECLINE = "rapid_decline"     # >50% decline in 24h
    DECLINE = "decline"                 # Decreasing
    STABLE = "stable"                   # No significant change
    INCREASE = "increase"               # Rising


class IVToPOEligibility(Enum):
    """IV to PO conversion eligibility."""
    ELIGIBLE = "eligible"
    ELIGIBLE_WITH_MONITORING = "eligible_with_monitoring"
    NOT_ELIGIBLE = "not_eligible"


@dataclass
class DurationRecommendation:
    """Treatment duration recommendation."""
    min_days: int
    max_days: int
    typical_days: int
    category: DurationCategory
    evidence_level: str  # "High", "Moderate", "Low"
    evidence_source: str
    exceptions: List[str] = field(default_factory=list)
    special_notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "min_days": self.min_days,
            "max_days": self.max_days,
            "typical_days": self.typical_days,
            "category": self.category.value,
            "evidence_level": self.evidence_level,
            "evidence_source": self.evidence_source,
            "exceptions": self.exceptions,
            "special_notes": self.special_notes,
        }


@dataclass
class BiomarkerThreshold:
    """Biomarker threshold for clinical decisions."""
    biomarker_name: str
    stop_threshold: float
    continue_threshold: float
    unit: str
    interpret_stopping_rule: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "biomarker_name": self.biomarker_name,
            "stop_threshold": self.stop_threshold,
            "continue_threshold": self.continue_threshold,
            "unit": self.unit,
            "interpret_stopping_rule": self.interpret_stopping_rule,
        }


@dataclass
class IVToPOCriteria:
    """Criteria for IV to PO conversion."""
    drug_name: str
    bioavailability: float
    clinical_criteria: List[str]
    contraindications: List[str]
    po_dose: str
    po_frequency: str
    notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "bioavailability": self.bioavailability,
            "clinical_criteria": self.clinical_criteria,
            "contraindications": self.contraindications,
            "po_dose": self.po_dose,
            "po_frequency": self.po_frequency,
            "notes": self.notes,
        }


# =============================================================================
# DURATION DATABASE BY CONDITION
# =============================================================================

DURATION_DATABASE: Dict[str, DurationRecommendation] = {
    # =========================================================================
    # RESPIRATORY INFECTIONS
    # =========================================================================
    
    "CAP_MILD_MODERATE": DurationRecommendation(
        min_days=5,
        max_days=7,
        typical_days=5,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA/ATS CAP Guidelines 2019; NEJM 2015",
        exceptions=[
            "Extend if slow clinical response",
            "S. aureus bacteremia: extend to 14 days",
            "Lung abscess: 3-6 weeks"
        ],
        special_notes=[
            "5 days adequate for most patients with clinical response",
            "Afebrile for 48h + clinically stable = candidate for stopping",
            "No need for prolonged courses in uncomplicated CAP"
        ]
    ),
    
    "CAP_SEVERE_ICU": DurationRecommendation(
        min_days=7,
        max_days=10,
        typical_days=7,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="IDSA/ATS CAP Guidelines 2019",
        exceptions=[
            "S. aureus: 14 days",
            "Pseudomonas: 14 days",
            "Empyema: 2-4 weeks"
        ],
        special_notes=["Monitor clinical response closely"]
    ),
    
    "HAP_VAP": DurationRecommendation(
        min_days=7,
        max_days=8,
        typical_days=7,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA HAP/VAP Guidelines 2016",
        exceptions=[
            "Non-fermenting GNR (Pseudomonas, Acinetobacter): may need longer",
            "Empyema: 2-4 weeks",
            "S. aureus bacteremia: 14 days minimum"
        ],
        special_notes=[
            "7 days usually adequate if clinical response",
            "Shorter courses reduce resistance and C. difficile risk",
            "Procalcitonin may guide earlier stopping"
        ]
    ),
    
    "BRONCHITIS_ACUTE": DurationRecommendation(
        min_days=0,
        max_days=5,
        typical_days=0,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="Cochrane Review 2017",
        exceptions=[
            "Pertussis: 5 days azithromycin or 14 days alternative",
            "COPD exacerbation with increased sputum purulence: 5 days"
        ],
        special_notes=[
            "Most acute bronchitis is viral - antibiotics NOT recommended",
            "Consider antibiotics only if pertussis or high-risk COPD"
        ]
    ),
    
    # =========================================================================
    # URINARY TRACT INFECTIONS
    # =========================================================================
    
    "UTI_UNCOMPLICATED_CYSTITIS": DurationRecommendation(
        min_days=3,
        max_days=5,
        typical_days=5,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA UTI Guidelines 2011",
        exceptions=[
            "Nitrofurantoin: 5 days",
            "TMP-SMX: 3 days",
            "Fosfomycin: single dose",
            "Fluoroquinolones: 3 days (NOT recommended for uncomplicated cystitis)"
        ],
        special_notes=[
            "Shorter courses preferred to reduce resistance",
            "Single-dose fosfomycin excellent for uncomplicated cases"
        ]
    ),
    
    "PYELONEPHRITIS_UNCOMPLICATED": DurationRecommendation(
        min_days=5,
        max_days=7,
        typical_days=7,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA UTI Guidelines 2011",
        exceptions=[
            "Fluoroquinolone: 5-7 days",
            "TMP-SMX: 14 days (if susceptible)",
            "Beta-lactam: 10-14 days"
        ],
        special_notes=[
            "5-7 days with fluoroquinolone",
            "Consider 14 days if slow response or complicated"
        ]
    ),
    
    "UTI_COMPLICATED": DurationRecommendation(
        min_days=7,
        max_days=14,
        typical_days=10,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="IDSA UTI Guidelines 2011",
        exceptions=[
            "Men with prostatitis: 4-6 weeks",
            "Renal abscess: until drain removal + 1-2 weeks",
            "Catheter-associated: 7 days after catheter removal"
        ],
        special_notes=[
            "Duration depends on source control",
            "Shorter courses if rapid clinical response"
        ]
    ),
    
    "PROSTATITIS_ACUTE": DurationRecommendation(
        min_days=14,
        max_days=28,
        typical_days=28,
        category=DurationCategory.EXTENDED,
        evidence_level="Moderate",
        evidence_source="EAU Guidelines 2023",
        exceptions=[
            "Chronic prostatitis: 4-6 weeks minimum",
            "Abscess: drain + 4 weeks"
        ],
        special_notes=["Longer courses due to poor prostate penetration"]
    ),
    
    # =========================================================================
    # SKIN AND SOFT TISSUE INFECTIONS
    # =========================================================================
    
    "CELLULITIS_NONPURULENT": DurationRecommendation(
        min_days=5,
        max_days=7,
        typical_days=5,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA SSTI Guidelines 2014",
        exceptions=[
            "Extensive/necrotizing infection: 10-14 days",
            "Diabetic foot: see separate protocol",
            "Venous stasis dermatitis mimic: no antibiotics needed"
        ],
        special_notes=[
            "5 days adequate for uncomplicated cellulitis",
            "Extend only if no improvement at 5 days"
        ]
    ),
    
    "CELLULITIS_PURULENT": DurationRecommendation(
        min_days=5,
        max_days=10,
        typical_days=7,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="IDSA SSTI Guidelines 2014",
        exceptions=[
            "Abscess: I&D primary - antibiotics may not be needed",
            "MRSA: 5-10 days based on response"
        ],
        special_notes=[
            "I&D is primary treatment for abscess",
            "Antibiotics for: extensive disease, immunocompromise, systemic symptoms"
        ]
    ),
    
    "DIABETIC_FOOT_SOFT_TISSUE": DurationRecommendation(
        min_days=7,
        max_days=14,
        typical_days=10,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="IDSA Diabetic Foot Guidelines 2012",
        exceptions=[
            "If osteomyelitis present: 4-6 weeks",
            "After surgical debridement: 2-5 days post-op may be adequate"
        ],
        special_notes=[
            "No bone involvement: 1-2 weeks",
            "With osteomyelitis: 4-6 weeks minimum"
        ]
    ),
    
    "DIABETIC_FOOT_OSTEOMYELITIS": DurationRecommendation(
        min_days=28,
        max_days=42,
        typical_days=42,
        category=DurationCategory.PROLONGED,
        evidence_level="Moderate",
        evidence_source="IDSA Diabetic Foot Guidelines 2012",
        exceptions=[
            "Complete surgical resection: may shorten to 2-5 days",
            "Chronic osteomyelitis: may need months"
        ],
        special_notes=[
            "4-6 weeks with adequate debridement",
            "Consider bone biopsy for pathogen identification"
        ]
    ),
    
    # =========================================================================
    # INTRA-ABDOMINAL INFECTIONS
    # =========================================================================
    
    "INTRAABDOMINAL_SOURCE_CONTROLLED": DurationRecommendation(
        min_days=3,
        max_days=5,
        typical_days=4,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="IDSA Intra-abdominal Guidelines 2010; STOP-IT Trial",
        exceptions=[
            "No source control: until clinical response",
            "Severe peritonitis: 5-7 days",
            "Abscess without drainage: longer duration"
        ],
        special_notes=[
            "24-48 hours after source control may be adequate",
            "Afebrile + WBC normalizing = can stop",
            "STOP-IT trial: ~4 days equivalent to ~8 days"
        ]
    ),
    
    "APPENDICITIS_UNCOMPLICATED": DurationRecommendation(
        min_days=0,
        max_days=3,
        typical_days=0,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="CODA Trial 2020; JAMA Surgery 2017",
        exceptions=[
            "Perforated appendicitis: 4-5 days",
            "Abscess: until drain removal + 2-3 days"
        ],
        special_notes=[
            "Antibiotics may be avoided entirely after appendectomy",
            "If used, stop within 24h post-op for non-perforated"
        ]
    ),
    
    "DIVERTICULITIS_UNCOMPLICATED": DurationRecommendation(
        min_days=4,
        max_days=7,
        typical_days=5,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="Moderate",
        evidence_source="NEJM 2012; JAMA Surgery 2020",
        exceptions=[
            "Abscess: drain + antibiotics until drain removal",
            "Perforation: 4-7 days after source control"
        ],
        special_notes=[
            "Uncomplicated diverticulitis may not need antibiotics",
            "SELECT trial: antibiotics not always necessary"
        ]
    ),
    
    "SPONTANEOUS_BACTERIAL_PERITONITIS": DurationRecommendation(
        min_days=5,
        max_days=7,
        typical_days=5,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="AASLD Guidelines",
        exceptions=[
            "Secondary peritonitis: see intra-abdominal protocol",
            "Slow response: extend to 10 days"
        ],
        special_notes=[
            "5 days usually adequate",
            "PMN count normalization in ascites = stopping point"
        ]
    ),
    
    # =========================================================================
    # BLOODSTREAM INFECTIONS
    # =========================================================================
    
    "BACTEREMIA_S_AUREUS_MSSA": DurationRecommendation(
        min_days=14,
        max_days=42,
        typical_days=28,
        category=DurationCategory.EXTENDED,
        evidence_level="High",
        evidence_source="IDSA S. aureus Bacteremia Guidelines 2011",
        exceptions=[
            "Uncomplicated (see criteria): 14 days",
            "Complicated (endocarditis, metastatic): 4-6 weeks",
            "Osteomyelitis: 6 weeks minimum"
        ],
        special_notes=[
            "Uncomplicated criteria: IV catheter removed, defervescence <72h, no emboli, TTE negative, negative f/u blood cultures",
            "All S. aureus bacteremia: TTE minimum, TEE if high-risk",
            "Repeat blood cultures to document clearance"
        ]
    ),
    
    "BACTEREMIA_S_AUREUS_MRSA": DurationRecommendation(
        min_days=14,
        max_days=42,
        typical_days=28,
        category=DurationCategory.EXTENDED,
        evidence_level="High",
        evidence_source="IDSA MRSA Guidelines 2011",
        exceptions=[
            "Uncomplicated: 14 days with vancomycin trough 15-20",
            "Vancomycin MIC >1.5: consider alternative",
            "Endocarditis: 6 weeks"
        ],
        special_notes=[
            "Higher failure rates with vancomycin MIC ≥2",
            "Consider daptomycin or ceftaroline for high MIC",
            "TTE minimum, TEE preferred"
        ]
    ),
    
    "BACTEREMIA_E_COLI_UNCOMPLICATED": DurationRecommendation(
        min_days=7,
        max_days=14,
        typical_days=7,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="Moderate",
        evidence_source="Clin Infect Dis 2019",
        exceptions=[
            "Urinary source: 7 days",
            "Abdominal source: 10-14 days",
            "Endocarditis: 4-6 weeks (rare)"
        ],
        special_notes=[
            "7 days may be adequate for uncomplicated gram-negative bacteremia",
            "Defervescence <72h, source controlled, no metastatic infection"
        ]
    ),
    
    "BACTEREMIA_ENTEROCOCCUS": DurationRecommendation(
        min_days=7,
        max_days=14,
        typical_days=14,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="IDSA Guidelines",
        exceptions=[
            "Endocarditis: 4-6 weeks",
            "Central line infection: 7 days after line removal",
            "Polymicrobial bacteremia: based on other organisms"
        ],
        special_notes=[
            "Repeat blood cultures to document clearance",
            "Consider combination therapy for serious infections"
        ]
    ),
    
    "CANDIDEMIA": DurationRecommendation(
        min_days=14,
        max_days=21,
        typical_days=14,
        category=DurationCategory.EXTENDED,
        evidence_level="High",
        evidence_source="IDSA Candidiasis Guidelines 2020",
        exceptions=[
            "After first negative blood culture: minimum 14 days",
            "Ophthalmologic examination before stopping",
            "Endocarditis: 6+ weeks"
        ],
        special_notes=[
            "14 days after FIRST negative blood culture",
            "Remove central lines when possible",
            "Dilated eye exam for all candidemia patients"
        ]
    ),
    
    # =========================================================================
    # CNS INFECTIONS
    # =========================================================================
    
    "MENINGITIS_BACTERIAL_ADULT": DurationRecommendation(
        min_days=10,
        max_days=21,
        typical_days=14,
        category=DurationCategory.EXTENDED,
        evidence_level="High",
        evidence_source="IDSA Meningitis Guidelines 2004",
        exceptions=[
            "N. meningitidis: 7 days",
            "H. influenzae: 7 days",
            "S. pneumoniae: 10-14 days",
            "Listeria: 21 days minimum",
            "Gram-negative bacilli: 21 days"
        ],
        special_notes=[
            "Dexamethasone with first dose for S. pneumoniae",
            "Duration pathogen-specific"
        ]
    ),
    
    "BRAIN_ABSCESS": DurationRecommendation(
        min_days=28,
        max_days=56,
        typical_days=42,
        category=DurationCategory.PROLONGED,
        evidence_level="Moderate",
        evidence_source="IDSA CNS Guidelines",
        exceptions=[
            "After surgical drainage: 4-6 weeks IV",
            "Nocardia: 6-12 months",
            "Toxoplasma: 6 weeks minimum"
        ],
        special_notes=[
            "4-8 weeks parenteral therapy",
            "May extend based on imaging response",
            "Serial imaging to document resolution"
        ]
    ),
    
    # =========================================================================
    # CARDIAC INFECTIONS
    # =========================================================================
    
    "ENDOCARDITIS_NATIVE_VALVE": DurationRecommendation(
        min_days=28,
        max_days=42,
        typical_days=28,
        category=DurationCategory.PROLONGED,
        evidence_level="High",
        evidence_source="AHA Endocarditis Guidelines 2023",
        exceptions=[
            "Viridans streptococci, MIC ≤0.12: 14 days with gentamicin, 28 days without",
            "Viridans streptococci, MIC >0.12: 28 days",
            "S. aureus: 6 weeks",
            "Enterococcus: 4-6 weeks"
        ],
        special_notes=[
            "Native valve: 4-6 weeks usually",
            "TEE essential for diagnosis",
            "Consider surgery for complications"
        ]
    ),
    
    "ENDOCARDITIS_PROSTHETIC_VALVE": DurationRecommendation(
        min_days=42,
        max_days=84,
        typical_days=42,
        category=DurationCategory.PROLONGED,
        evidence_level="High",
        evidence_source="AHA Endocarditis Guidelines 2023",
        exceptions=[
            "S. aureus: 6+ weeks",
            "Enterococcus: 6+ weeks",
            "Fungal: months"
        ],
        special_notes=[
            "Minimum 6 weeks for prosthetic valve",
            "Rifampin for S. aureus PVE",
            "Surgery often required"
        ]
    ),
    
    # =========================================================================
    # BONE AND JOINT INFECTIONS
    # =========================================================================
    
    "OSTEOMYELITIS_ACUTE": DurationRecommendation(
        min_days=28,
        max_days=42,
        typical_days=42,
        category=DurationCategory.PROLONGED,
        evidence_level="Moderate",
        evidence_source="IDSA Bone and Joint Guidelines 2015",
        exceptions=[
            "After surgical debridement: 4-6 weeks",
            "With retained hardware: longer or chronic suppression",
            "Diabetic foot osteomyelitis: 4-6 weeks"
        ],
        special_notes=[
            "4-6 weeks minimum for acute osteomyelitis",
            "Bone biopsy ideal for pathogen identification",
            "Consider oral step-down after initial IV course"
        ]
    ),
    
    "SEPTIC_ARTHRITIS": DurationRecommendation(
        min_days=14,
        max_days=28,
        typical_days=21,
        category=DurationCategory.EXTENDED,
        evidence_level="Moderate",
        evidence_source="IDSA Bone and Joint Guidelines 2015",
        exceptions=[
            "S. aureus: 3-4 weeks",
            "Gonococcal: 7 days",
            "Prosthetic joint: 6 weeks minimum + chronic suppression"
        ],
        special_notes=[
            "2-4 weeks depending on pathogen",
            "Joint drainage essential",
            "Serial joint aspiration may be needed"
        ]
    ),
    
    # =========================================================================
    # GASTROINTESTINAL INFECTIONS
    # =========================================================================
    
    "C_DIFFICILE_NONSEVERE": DurationRecommendation(
        min_days=10,
        max_days=10,
        typical_days=10,
        category=DurationCategory.STANDARD,
        evidence_level="High",
        evidence_source="IDSA C. difficile Guidelines 2017",
        exceptions=[
            "Severe: 10-14 days",
            "Fulminant: until clinical improvement",
            "First recurrence: 10-day taper/pulse vancomycin"
        ],
        special_notes=[
            "Fidaxomicin lower recurrence rate",
            "No need for extended courses for initial episode"
        ]
    ),
    
    "C_DIFFICILE_SEVERE": DurationRecommendation(
        min_days=10,
        max_days=14,
        typical_days=14,
        category=DurationCategory.STANDARD,
        evidence_level="High",
        evidence_source="IDSA C. difficile Guidelines 2017",
        exceptions=[
            "Fulminant/ICU: vancomycin PO + IV metronidazole",
            "Ileus: vancomycin rectal + IV metronidazole"
        ],
        special_notes=[
            "WBC >15,000 or Cr ≥1.5× baseline = severe",
            "Vancomycin 125 mg PO QID is first-line"
        ]
    ),
    
    # =========================================================================
    # SEXUALLY TRANSMITTED INFECTIONS
    # =========================================================================
    
    "GONORRHEA_UNCOMPLICATED": DurationRecommendation(
        min_days=1,
        max_days=1,
        typical_days=1,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="CDC STI Guidelines 2021",
        exceptions=[
            "Disseminated gonococcal: 7 days",
            "Meningitis/endocarditis: 10-14 days to 4 weeks"
        ],
        special_notes=[
            "Single dose ceftriaxone 500 mg IM",
            "Treat for concurrent chlamydia"
        ]
    ),
    
    "CHLAMYDIA_UNCOMPLICATED": DurationRecommendation(
        min_days=7,
        max_days=7,
        typical_days=7,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="CDC STI Guidelines 2021",
        exceptions=[
            "Azithromycin: single dose 1 g",
            "LGV: 21 days",
            "Pregnancy: azithromycin or amoxicillin 7 days"
        ],
        special_notes=[
            "7 days doxycycline preferred over single dose azithromycin",
            "Test of cure at 3 months for women"
        ]
    ),
    
    "SYPHILIS_PRIMARY_SECONDARY": DurationRecommendation(
        min_days=1,
        max_days=1,
        typical_days=1,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="High",
        evidence_source="CDC STI Guidelines 2021",
        exceptions=[
            "Neurosyphilis: 10-14 days IV penicillin",
            "Late latent: 3 doses 1 week apart",
            "Tertiary syphilis: 10-14 days IV"
        ],
        special_notes=[
            "Benzathine penicillin G 2.4 million units IM single dose",
            "Jarisch-Herxheimer reaction possible"
        ]
    ),
    
    # =========================================================================
    # SPECIAL CONDITIONS
    # =========================================================================
    
    "SEPSIS_SEPTIC_SHOCK": DurationRecommendation(
        min_days=7,
        max_days=10,
        typical_days=7,
        category=DurationCategory.STANDARD,
        evidence_level="Moderate",
        evidence_source="Surviving Sepsis Campaign 2021",
        exceptions=[
            "Source-dependent: follow specific infection guidelines",
            "Slow response: extend duration",
            "Pseudomonas: 14 days for bacteremia"
        ],
        special_notes=[
            "Reassess daily for de-escalation",
            "Procalcitonin may guide duration",
            "7 days usually adequate with source control"
        ]
    ),
    
    "NEUTROPENIC_FEVER_LOW_RISK": DurationRecommendation(
        min_days=3,
        max_days=7,
        typical_days=3,
        category=DurationCategory.SHORT_COURSE,
        evidence_level="Moderate",
        evidence_source="IDSA Febrile Neutropenia Guidelines 2010",
        exceptions=[
            "Documented infection: per pathogen",
            "High-risk: until ANC >500 for 48h",
            "Fungal infection: weeks to months"
        ],
        special_notes=[
            "Stop 48h after afebrile and ANC >500",
            "Oral step-down for low-risk patients"
        ]
    ),
    
    "LYME_DISEASE_EARLY": DurationRecommendation(
        min_days=10,
        max_days=21,
        typical_days=14,
        category=DurationCategory.STANDARD,
        evidence_level="High",
        evidence_source="IDSA Lyme Guidelines 2020",
        exceptions=[
            "Erythema migrans: 10 days doxycycline to 14 days amoxicillin",
            "Neurologic: 14-21 days IV ceftriaxone",
            "Cardiac: 14-21 days"
        ],
        special_notes=[
            "10-21 days depending on manifestation",
            "Oral therapy adequate for early localized disease"
        ]
    ),
}


# =============================================================================
# BIOMARKER-GUIDED STOPPING RULES
# =============================================================================

BIOMARKER_THRESHOLDS: Dict[str, BiomarkerThreshold] = {
    "procalcitonin_stop": BiomarkerThreshold(
        biomarker_name="Procalcitonin",
        stop_threshold=0.25,
        continue_threshold=0.50,
        unit="ng/mL",
        interpret_stopping_rule="Stop antibiotics if PCT <0.25 ng/mL and clinically improved, or if PCT decreased by ≥80-90% from peak"
    ),
    "procalcitonin_sepsis": BiomarkerThreshold(
        biomarker_name="Procalcitonin",
        stop_threshold=0.50,
        continue_threshold=1.00,
        unit="ng/mL",
        interpret_stopping_rule="For sepsis: stop if PCT <0.5 ng/mL or decreased by ≥80% from peak with clinical improvement"
    ),
    "crp_decline": BiomarkerThreshold(
        biomarker_name="CRP",
        stop_threshold=50.0,
        continue_threshold=100.0,
        unit="mg/L",
        interpret_stopping_rule="CRP declining >50% from peak supports stopping, but less specific than procalcitonin"
    ),
    "wbc_normalization": BiomarkerThreshold(
        biomarker_name="WBC",
        stop_threshold=11.0,
        continue_threshold=15.0,
        unit="×10⁹/L",
        interpret_stopping_rule="WBC normalizing (<11) supports stopping, but not sole criterion"
    ),
}


@dataclass
class ProcalcitoninGuidedRecommendation:
    """Procalcitonin-guided antibiotic decision."""
    should_stop: bool
    reason: str
    current_pct: float
    peak_pct: Optional[float]
    decline_percent: Optional[float]
    clinical_context: str
    recommendation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "should_stop": self.should_stop,
            "reason": self.reason,
            "current_pct": self.current_pct,
            "peak_pct": self.peak_pct,
            "decline_percent": self.decline_percent,
            "clinical_context": self.clinical_context,
            "recommendation": self.recommendation,
        }


def evaluate_procalcitonin_stopping(
    current_pct: float,
    peak_pct: Optional[float] = None,
    day_of_therapy: int = 1,
    is_sepsis: bool = False,
    clinical_improvement: bool = False
) -> ProcalcitoninGuidedRecommendation:
    """
    Evaluate procalcitonin for antibiotic stopping decision.
    
    Algorithm based on:
    - PRORATA trial
    - ProGUARD trial
    - SAPS trial
    
    Rules:
    1. PCT <0.25 ng/mL: Strong recommendation to stop
    2. PCT <0.50 ng/mL with >80% decline: Stop
    3. PCT 0.25-0.50 ng/mL: Consider stopping
    4. PCT >0.50 ng/mL: Continue
    
    Args:
        current_pct: Current procalcitonin level (ng/mL)
        peak_pct: Peak procalcitonin level during illness (ng/mL)
        day_of_therapy: Day of antibiotic therapy
        is_sepsis: Whether patient has sepsis
        clinical_improvement: Whether patient has clinically improved
    
    Returns:
        ProcalcitoninGuidedRecommendation
    """
    # Calculate decline if peak available
    decline_percent = None
    if peak_pct and peak_pct > 0:
        decline_percent = ((peak_pct - current_pct) / peak_pct) * 100
    
    # Determine stopping threshold based on context
    stop_threshold = 0.50 if is_sepsis else 0.25
    consider_threshold = 1.0 if is_sepsis else 0.50
    
    # Decision logic
    if current_pct < stop_threshold:
        should_stop = True
        reason = f"PCT {current_pct} ng/mL is below stopping threshold ({stop_threshold} ng/mL)"
        recommendation = f"STOP ANTIBIOTICS: PCT strongly suggests bacterial infection has resolved."
        if day_of_therapy < 3:
            recommendation += " CAUTION: Very early in therapy - ensure clinical assessment is reassuring."
    
    elif decline_percent and decline_percent >= 80:
        should_stop = clinical_improvement  # Only stop if clinical improvement
        reason = f"PCT has declined by {decline_percent:.0f}% from peak ({peak_pct} → {current_pct} ng/mL)"
        if clinical_improvement:
            recommendation = "STOP ANTIBIOTICS: Significant PCT decline with clinical improvement supports stopping."
        else:
            recommendation = "CONTINUE: PCT decline noted but clinical improvement not yet seen. Reassess in 24h."
    
    elif current_pct < consider_threshold:
        should_stop = False
        reason = f"PCT {current_pct} ng/mL is in 'consider stopping' range"
        recommendation = "CONSIDER STOPPING: PCT is low. If clinically improved, antibiotics may be stopped."
    
    else:
        should_stop = False
        reason = f"PCT {current_pct} ng/mL remains elevated"
        recommendation = "CONTINUE ANTIBIOTICS: PCT still elevated. Reassess in 24-48 hours."
    
    return ProcalcitoninGuidedRecommendation(
        should_stop=should_stop,
        reason=reason,
        current_pct=current_pct,
        peak_pct=peak_pct,
        decline_percent=decline_percent,
        clinical_context="sepsis" if is_sepsis else "standard",
        recommendation=recommendation
    )


# =============================================================================
# IV-TO-PO CONVERSION CRITERIA
# =============================================================================

IV_TO_PO_ELIGIBILITY_DATABASE: Dict[str, IVToPOCriteria] = {
    "fluoroquinolones": IVToPOCriteria(
        drug_name="Fluoroquinolones (Ciprofloxacin, Levofloxacin, Moxifloxacin)",
        bioavailability=0.90,
        clinical_criteria=[
            "Hemodynamically stable",
            "Able to tolerate oral intake",
            "No GI malabsorption (no ileus, obstruction)",
            "Afebrile or improving fever curve",
            "Improving clinical symptoms",
            "No ICU requirement for other reasons"
        ],
        contraindications=[
            "NPO status",
            "Ileus or bowel obstruction",
            "Severe malabsorption",
            "Inability to swallow",
            "Hemodynamic instability",
            "ICU care required for other reasons"
        ],
        po_dose="Same as IV dose",
        po_frequency="Same as IV frequency",
        notes=[
            "Bioequivalence >90%",
            "Same dose - no adjustment needed",
            "Can switch directly without overlap"
        ]
    ),
    
    "linezolid": IVToPOCriteria(
        drug_name="Linezolid",
        bioavailability=1.0,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Clinically improving",
            "No severe GI disease"
        ],
        contraindications=[
            "NPO status",
            "Severe GI malabsorption"
        ],
        po_dose="600 mg",
        po_frequency="Every 12 hours",
        notes=[
            "100% bioavailability",
            "Same dose IV and PO",
            "Excellent for step-down therapy"
        ]
    ),
    
    "clindamycin": IVToPOCriteria(
        drug_name="Clindamycin",
        bioavailability=0.90,
        clinical_criteria=[
            "Hemodynamically stable",
            "Able to tolerate oral intake",
            "Improving clinical symptoms"
        ],
        contraindications=[
            "Severe GI disease",
            "C. difficile colitis (would worsen)"
        ],
        po_dose="300-450 mg",
        po_frequency="Every 6-8 hours",
        notes=["Good oral bioavailability"]
    ),
    
    "metronidazole": IVToPOCriteria(
        drug_name="Metronidazole",
        bioavailability=1.0,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Clinically improving"
        ],
        contraindications=[
            "NPO status required",
            "Severe GI disease"
        ],
        po_dose="500 mg",
        po_frequency="Every 8 hours",
        notes=[
            "100% bioavailability",
            "Same dose IV and PO",
            "Can use for intra-abdominal step-down"
        ]
    ),
    
    "azithromycin": IVToPOCriteria(
        drug_name="Azithromycin",
        bioavailability=0.37,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Clinically improving",
            "Not critical illness"
        ],
        contraindications=[
            "Critical illness",
            "Severe GI disease"
        ],
        po_dose="500 mg day 1, then 250 mg",
        po_frequency="Daily",
        notes=[
            "IV provides higher tissue levels",
            "PO adequate for most infections",
            "Use IV for severe CAP initially"
        ]
    ),
    
    "doxycycline": IVToPOCriteria(
        drug_name="Doxycycline",
        bioavailability=0.90,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Not critical illness"
        ],
        contraindications=[
            "Severe GI disease",
            "Critical illness requiring IV"
        ],
        po_dose="100 mg",
        po_frequency="Every 12 hours",
        notes=[
            "Excellent oral bioavailability",
            "IV rarely needed"
        ]
    ),
    
    "fluconazole": IVToPOCriteria(
        drug_name="Fluconazole",
        bioavailability=0.90,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Clinically stable",
            "Not life-threatening infection"
        ],
        contraindications=[
            "Candidemia (use IV initially)",
            "Severe mucositis preventing PO",
            "Critical illness"
        ],
        po_dose="200-400 mg",
        po_frequency="Daily",
        notes=[
            ">90% bioavailability",
            "PO equivalent to IV for most indications",
            "Use IV for candidemia initially"
        ]
    ),
    
    "amoxicillin_clavulanate": IVToPOCriteria(
        drug_name="Amoxicillin-Clavulanate",
        bioavailability=0.80,
        clinical_criteria=[
            "Able to tolerate oral intake",
            "Improving clinical symptoms",
            "Infection suitable for PO therapy"
        ],
        contraindications=[
            "Bacteremia (use IV)",
            "Severe infection",
            "NPO status"
        ],
        po_dose="875/125 mg",
        po_frequency="Every 12 hours",
        notes=[
            "Good bioavailability",
            "Extended release available"
        ]
    ),
}


def check_iv_to_po_eligibility(
    drug_class: str,
    clinical_criteria: Dict[str, bool],
    infection_type: str = "standard"
) -> Dict[str, Any]:
    """
    Check if patient is eligible for IV to PO conversion.
    
    Args:
        drug_class: Drug class name (e.g., "fluoroquinolones", "linezolid")
        clinical_criteria: Dictionary of clinical criteria and their status
        infection_type: Type of infection
    
    Returns:
        Eligibility assessment and recommendations
    """
    drug_key = drug_class.lower().replace("-", "_").replace(" ", "_")
    
    if drug_key not in IV_TO_PO_ELIGIBILITY_DATABASE:
        # Try partial match
        for key in IV_TO_PO_ELIGIBILITY_DATABASE:
            if drug_class.lower() in key:
                drug_key = key
                break
        else:
            return {
                "eligible": False,
                "reason": f"Drug class '{drug_class}' not in IV-to-PO database",
                "available_classes": list(IV_TO_PO_ELIGIBILITY_DATABASE.keys())
            }
    
    drug_info = IV_TO_PO_ELIGIBILITY_DATABASE[drug_key]
    
    # Check for contraindications
    contraindications_present = []
    for contraindication in drug_info.contraindications:
        if clinical_criteria.get(contraindication.lower(), False):
            contraindications_present.append(contraindication)
    
    # Check clinical criteria
    unmet_criteria = []
    for criterion in drug_info.clinical_criteria:
        if not clinical_criteria.get(criterion.lower(), True):
            unmet_criteria.append(criterion)
    
    # Determine eligibility
    if contraindications_present:
        eligibility = IVToPOEligibility.NOT_ELIGIBLE
        reason = f"Contraindications present: {', '.join(contraindications_present)}"
    elif unmet_criteria:
        eligibility = IVToPOEligibility.ELIGIBLE_WITH_MONITORING
        reason = f"Some criteria not met: {', '.join(unmet_criteria)}"
    else:
        eligibility = IVToPOEligibility.ELIGIBLE
        reason = "All criteria met - eligible for IV to PO conversion"
    
    return {
        "drug": drug_info.drug_name,
        "eligible": eligibility.value,
        "bioavailability": f"{drug_info.bioavailability * 100:.0f}%",
        "reason": reason,
        "contraindications_present": contraindications_present,
        "unmet_criteria": unmet_criteria,
        "po_dose": drug_info.po_dose,
        "po_frequency": drug_info.po_frequency,
        "notes": drug_info.notes,
        "all_criteria": drug_info.clinical_criteria,
        "all_contraindications": drug_info.contraindications,
    }


# =============================================================================
# DURATION OPTIMIZATION ENGINE
# =============================================================================

class DurationOptimizationEngine:
    """
    Engine for optimizing antimicrobial treatment duration.
    
    Features:
    - Evidence-based duration recommendations
    - Biomarker-guided stopping rules
    - IV-to-PO conversion criteria
    - Early stopping assessments
    """
    
    def __init__(self):
        self._durations = DURATION_DATABASE
        self._biomarkers = BIOMARKER_THRESHOLDS
        self._iv_po = IV_TO_PO_ELIGIBILITY_DATABASE
    
    def get_duration_recommendation(
        self,
        condition: str,
        day_of_therapy: int = 1,
        clinical_response: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get duration recommendation for a condition."""
        condition_key = condition.upper().replace("-", "_").replace(" ", "_")
        
        if condition_key not in self._durations:
            # Try partial match
            for key in self._durations:
                if condition.lower() in key.lower() or key.lower() in condition.lower():
                    condition_key = key
                    break
            else:
                return {
                    "error": f"Condition '{condition}' not found",
                    "available_conditions": list(self._durations.keys())
                }
        
        duration_info = self._durations[condition_key]
        
        result = {
            "condition": condition_key,
            "duration": duration_info.to_dict(),
            "day_of_therapy": day_of_therapy,
            "days_remaining": max(0, duration_info.typical_days - day_of_therapy),
        }
        
        # Early stopping assessment
        if day_of_therapy >= duration_info.min_days:
            result["stopping_assessment"] = {
                "can_stop": True,
                "criteria": [
                    "Minimum duration reached",
                    "Clinical improvement documented",
                    "Afebrile for 48 hours",
                    "Source control achieved (if applicable)",
                ]
            }
        else:
            result["stopping_assessment"] = {
                "can_stop": False,
                "reason": f"Minimum duration ({duration_info.min_days} days) not yet reached",
                "days_until_can_stop": duration_info.min_days - day_of_therapy
            }
        
        return result
    
    def evaluate_biomarker_stopping(
        self,
        biomarker: str,
        current_value: float,
        peak_value: Optional[float] = None,
        is_sepsis: bool = False,
        clinical_improvement: bool = False
    ) -> Dict[str, Any]:
        """Evaluate biomarker for stopping decision."""
        if biomarker.lower() == "procalcitonin" or biomarker.lower() == "pct":
            return evaluate_procalcitonin_stopping(
                current_value, peak_value, is_sepsis=is_sepsis,
                clinical_improvement=clinical_improvement
            ).to_dict()
        
        # Generic biomarker evaluation
        biomarker_key = biomarker.lower()
        if biomarker_key in ["crp", "c_reactive_protein"]:
            threshold = self._biomarkers.get("crp_decline")
        elif biomarker_key in ["wbc", "white_blood_cell"]:
            threshold = self._biomarkers.get("wbc_normalization")
        else:
            return {"error": f"Biomarker '{biomarker}' not supported for stopping rules"}
        
        return {
            "biomarker": threshold.biomarker_name,
            "current_value": current_value,
            "stop_threshold": threshold.stop_threshold,
            "continue_threshold": threshold.continue_threshold,
            "unit": threshold.unit,
            "interpretation": threshold.interpret_stopping_rule,
            "below_stop_threshold": current_value < threshold.stop_threshold,
        }
    
    def check_iv_to_po(
        self,
        drug_class: str,
        clinical_criteria: Dict[str, bool]
    ) -> Dict[str, Any]:
        """Check IV to PO conversion eligibility."""
        return check_iv_to_po_eligibility(drug_class, clinical_criteria)
    
    def list_conditions(self) -> List[str]:
        """List all conditions in the database."""
        return list(self._durations.keys())
    
    def get_short_course_conditions(self) -> List[str]:
        """Get conditions suitable for short-course therapy."""
        return [
            condition for condition, duration in self._durations.items()
            if duration.category == DurationCategory.SHORT_COURSE
        ]


# Singleton instance
_duration_engine = None

def get_duration_engine() -> DurationOptimizationEngine:
    """Get singleton DurationOptimizationEngine instance."""
    global _duration_engine
    if _duration_engine is None:
        _duration_engine = DurationOptimizationEngine()
    return _duration_engine
