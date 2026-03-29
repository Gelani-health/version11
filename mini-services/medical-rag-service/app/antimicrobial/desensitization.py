"""
Antibiotic Desensitization Protocols
=====================================

Evidence-based desensitization protocols for antibiotic allergies,
enabling use of first-line antibiotics in patients with documented allergies
when no suitable alternatives exist.

Features:
- Beta-lactam allergy desensitization protocols
- Step-by-step incremental dosing schedules
- Monitoring requirements
- Contraindications and safety considerations
- Alternative antibiotic recommendations

References:
- Castells M, et al. N Engl J Med 2019;381:2338-2351
- Solensky R, et al. J Allergy Clin Immunol Pract 2020
- Joint Task Force on Practice Parameters
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import timedelta


class DesensitizationType(Enum):
    """Type of desensitization protocol."""
    ORAL = "oral"
    IV_RAPID = "iv_rapid"          # ~4-6 hours
    IV_STANDARD = "iv_standard"     # ~12-24 hours
    IV_SLOW = "iv_slow"             # Over days


class RiskLevel(Enum):
    """Risk level for desensitization."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class DesensitizationStatus(Enum):
    """Status of desensitization process."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REACTION_OCCURRED = "reaction_occurred"


@dataclass
class DesensitizationStep:
    """Single step in a desensitization protocol."""
    step_number: int
    concentration: str          # e.g., "0.1 mg/mL"
    rate_or_dose: str           # e.g., "2 mL/hr" or "0.1 mg"
    dose_delivered: str         # Cumulative dose at this step
    duration_minutes: int
    cumulative_time_minutes: int
    instructions: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_number": self.step_number,
            "concentration": self.concentration,
            "rate_or_dose": self.rate_or_dose,
            "dose_delivered": self.dose_delivered,
            "duration_minutes": self.duration_minutes,
            "cumulative_time_minutes": self.cumulative_time_minutes,
            "instructions": self.instructions,
        }


@dataclass
class DesensitizationProtocol:
    """Complete desensitization protocol for an antibiotic."""
    drug_name: str
    drug_class: str
    desensitization_type: DesensitizationType
    target_dose: str
    total_duration_hours: float
    risk_level: RiskLevel
    steps: List[DesensitizationStep]
    prerequisites: List[str]
    monitoring_requirements: List[str]
    emergency_medications: List[str]
    contraindications: List[str]
    stop_criteria: List[str]
    post_desensitization_instructions: List[str]
    notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "drug_class": self.drug_class,
            "desensitization_type": self.desensitization_type.value,
            "target_dose": self.target_dose,
            "total_duration_hours": self.total_duration_hours,
            "risk_level": self.risk_level.value,
            "steps": [s.to_dict() for s in self.steps],
            "prerequisites": self.prerequisites,
            "monitoring_requirements": self.monitoring_requirements,
            "emergency_medications": self.emergency_medications,
            "contraindications": self.contraindications,
            "stop_criteria": self.stop_criteria,
            "post_desensitization_instructions": self.post_desensitization_instructions,
            "notes": self.notes,
        }


# =============================================================================
# PENICILLIN DESENSITIZATION PROTOCOLS
# =============================================================================

PENICILLIN_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Penicillin G",
    drug_class="Penicillin",
    desensitization_type=DesensitizationType.IV_RAPID,
    target_dose="24 million units/24 hours",
    total_duration_hours=4.5,
    risk_level=RiskLevel.MODERATE,
    steps=[
        # Standard 12-step IV desensitization protocol
        # Solution 1: 1000 units/mL (dilute 1 million units in 1000 mL)
        DesensitizationStep(1, "1000 units/mL", "2 mL/hr", "100 units", 15, 15, "Start infusion"),
        DesensitizationStep(2, "1000 units/mL", "4 mL/hr", "200 units", 15, 30, "Double rate"),
        DesensitizationStep(3, "1000 units/mL", "8 mL/hr", "400 units", 15, 45, "Double rate"),
        DesensitizationStep(4, "1000 units/mL", "16 mL/hr", "800 units", 15, 60, "Double rate"),
        DesensitizationStep(5, "1000 units/mL", "32 mL/hr", "1600 units", 15, 75, "Double rate"),
        DesensitizationStep(6, "1000 units/mL", "64 mL/hr", "3200 units", 15, 90, "Double rate"),
        # Solution 2: 10,000 units/mL (dilute 10 million units in 1000 mL)
        DesensitizationStep(7, "10,000 units/mL", "6 mL/hr", "6000 units", 15, 105, "Switch to more concentrated solution"),
        DesensitizationStep(8, "10,000 units/mL", "12 mL/hr", "12,000 units", 15, 120, "Double rate"),
        DesensitizationStep(9, "10,000 units/mL", "24 mL/hr", "24,000 units", 15, 135, "Double rate"),
        DesensitizationStep(10, "10,000 units/mL", "48 mL/hr", "48,000 units", 15, 150, "Double rate"),
        # Solution 3: 100,000 units/mL (full concentration)
        DesensitizationStep(11, "100,000 units/mL", "10 mL/hr", "100,000 units", 15, 165, "Switch to full concentration"),
        DesensitizationStep(12, "100,000 units/mL", "20 mL/hr", "200,000 units", 15, 180, "Continue at therapeutic rate"),
    ],
    prerequisites=[
        "Documented IgE-mediated penicillin allergy",
        "Skin testing recommended to confirm IgE-mediated allergy",
        "Informed consent obtained",
        "No alternative antibiotic available or appropriate",
        "IV access established (2 lines preferred)",
        "Emergency medications at bedside",
        "ICU or monitored setting available",
        "Physician present throughout procedure",
    ],
    monitoring_requirements=[
        "Continuous vital sign monitoring",
        "Continuous cardiac monitoring",
        "Pulse oximetry",
        "Assess for: pruritus, urticaria, flushing, angioedema",
        "Monitor for: hypotension, bronchospasm, dyspnea",
        "Document observations every 15 minutes",
    ],
    emergency_medications=[
        "Epinephrine 1:1000 (0.3-0.5 mg IM) - for anaphylaxis",
        "Epinephrine infusion - for refractory hypotension",
        "Diphenhydramine 50 mg IV - for urticaria/pruritus",
        "Methylprednisolone 125 mg IV - for severe reactions",
        "Albuterol nebulizer - for bronchospasm",
        "Normal saline for hypotension",
        "Glucagon - for patients on beta-blockers",
    ],
    contraindications=[
        "History of Stevens-Johnson syndrome (SJS)",
        "History of toxic epidermal necrolysis (TEN)",
        "History of drug reaction with eosinophilia and systemic symptoms (DRESS)",
        "History of acute interstitial nephritis",
        "Severe uncontrolled asthma",
        "Current beta-blocker use (relative - requires glucagon availability)",
        "Pregnancy (relative - consider alternatives first)",
    ],
    stop_criteria=[
        "Hypotension (SBP <90 mmHg or drop >20 mmHg)",
        "Bronchospasm with wheezing or SpO2 <92%",
        "Angioedema",
        "Generalized urticaria",
        "Severe pruritus",
        "Patient request",
    ],
    post_desensitization_instructions=[
        "Continue penicillin without interruption",
        "If treatment interrupted >24 hours, repeat desensitization",
        "Monitor for delayed reactions (serum sickness-like reactions)",
        "Document desensitization in allergy record",
        "Provide patient with documentation for future reference",
    ],
    notes=[
        "Temporarily induces tolerance by exhausting mediator stores",
        "Must continue drug without interruption to maintain tolerance",
        "Cross-reactivity with other beta-lactams after desensitization uncertain",
        "Consider skin testing first to confirm IgE-mediated allergy",
    ]
)

AMOXICILLIN_ORAL_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Amoxicillin",
    drug_class="Penicillin",
    desensitization_type=DesensitizationType.ORAL,
    target_dose="500 mg every 8 hours",
    total_duration_hours=4,
    risk_level=RiskLevel.LOW,
    steps=[
        # Oral desensitization protocol
        # Prepare solutions: 0.1 mg/mL, 1 mg/mL, 10 mg/mL, 100 mg/mL
        DesensitizationStep(1, "0.1 mg/mL", "0.1 mg (1 mL)", "0.1 mg", 15, 15, "Oral administration"),
        DesensitizationStep(2, "0.1 mg/mL", "0.2 mg (2 mL)", "0.3 mg", 15, 30, "Double dose"),
        DesensitizationStep(3, "0.1 mg/mL", "0.4 mg (4 mL)", "0.7 mg", 15, 45, "Double dose"),
        DesensitizationStep(4, "0.1 mg/mL", "0.8 mg (8 mL)", "1.5 mg", 15, 60, "Double dose"),
        DesensitizationStep(5, "1 mg/mL", "1.5 mg (1.5 mL)", "3 mg", 15, 75, "Switch to higher concentration"),
        DesensitizationStep(6, "1 mg/mL", "3 mg (3 mL)", "6 mg", 15, 90, "Double dose"),
        DesensitizationStep(7, "1 mg/mL", "6 mg (6 mL)", "12 mg", 15, 105, "Double dose"),
        DesensitizationStep(8, "10 mg/mL", "12 mg (1.2 mL)", "24 mg", 15, 120, "Switch to higher concentration"),
        DesensitizationStep(9, "10 mg/mL", "25 mg (2.5 mL)", "49 mg", 15, 135, "Double dose"),
        DesensitizationStep(10, "10 mg/mL", "50 mg (5 mL)", "99 mg", 15, 150, "Double dose"),
        DesensitizationStep(11, "100 mg/mL", "100 mg (1 mL)", "199 mg", 15, 165, "Switch to standard concentration"),
        DesensitizationStep(12, "100 mg/mL", "200 mg (2 mL)", "399 mg", 15, 180, "Double dose"),
        DesensitizationStep(13, "500 mg tablet", "500 mg (1 tablet)", "500 mg", 15, 195, "Full therapeutic dose"),
    ],
    prerequisites=[
        "Documented penicillin allergy",
        "No contraindications to oral intake",
        "Mild to moderate infection suitable for oral therapy",
        "Emergency medications available",
        "Physician availability for 2 hours after completion",
    ],
    monitoring_requirements=[
        "Vital signs before start and every 30 minutes",
        "Continuous observation during procedure",
        "Monitor for: urticaria, angioedema, hypotension, wheezing",
    ],
    emergency_medications=[
        "Epinephrine auto-injector or 1:1000 for IM injection",
        "Diphenhydramine 25-50 mg PO/IM",
        "Access to emergency services",
    ],
    contraindications=[
        "History of SJS/TEN",
        "History of DRESS",
        "Unable to tolerate oral intake",
        "Severe IgE-mediated allergy requiring IV desensitization",
    ],
    stop_criteria=[
        "Urticaria",
        "Angioedema",
        "Hypotension",
        "Wheezing",
        "Severe GI symptoms",
    ],
    post_desensitization_instructions=[
        "Continue amoxicillin without interruption",
        "Complete full course of therapy",
        "If interrupted >24 hours, repeat desensitization",
    ],
    notes=[
        "Oral route generally safer than IV",
        "Suitable for outpatient setting with proper precautions",
        "May be preferred for patients with less severe allergy history",
    ]
)

# =============================================================================
# CEPHALOSPORIN DESENSITIZATION PROTOCOLS
# =============================================================================

CEFTRIAXONE_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Ceftriaxone",
    drug_class="Cephalosporin (3rd generation)",
    desensitization_type=DesensitizationType.IV_RAPID,
    target_dose="2 g daily",
    total_duration_hours=4,
    risk_level=RiskLevel.MODERATE,
    steps=[
        # 12-step IV desensitization for ceftriaxone
        # Solution 1: 0.1 mg/mL
        DesensitizationStep(1, "0.1 mg/mL", "2 mL/hr", "0.2 mg", 15, 15, "Start infusion"),
        DesensitizationStep(2, "0.1 mg/mL", "4 mL/hr", "0.4 mg", 15, 30, "Double rate"),
        DesensitizationStep(3, "0.1 mg/mL", "8 mL/hr", "0.8 mg", 15, 45, "Double rate"),
        DesensitizationStep(4, "0.1 mg/mL", "16 mL/hr", "1.6 mg", 15, 60, "Double rate"),
        DesensitizationStep(5, "0.1 mg/mL", "32 mL/hr", "3.2 mg", 15, 75, "Double rate"),
        DesensitizationStep(6, "0.1 mg/mL", "64 mL/hr", "6.4 mg", 15, 90, "Double rate"),
        # Solution 2: 1 mg/mL
        DesensitizationStep(7, "1 mg/mL", "12 mL/hr", "12 mg", 15, 105, "Switch to more concentrated"),
        DesensitizationStep(8, "1 mg/mL", "24 mL/hr", "24 mg", 15, 120, "Double rate"),
        DesensitizationStep(9, "1 mg/mL", "48 mL/hr", "48 mg", 15, 135, "Double rate"),
        DesensitizationStep(10, "1 mg/mL", "96 mL/hr", "96 mg", 15, 150, "Double rate"),
        # Solution 3: 20 mg/mL (standard concentration)
        DesensitizationStep(11, "20 mg/mL", "25 mL/hr", "500 mg", 15, 165, "Switch to full concentration"),
        DesensitizationStep(12, "20 mg/mL", "50 mL/hr (100 mL over 30 min)", "1000 mg", 30, 195, "Half dose over 30 min"),
        DesensitizationStep(13, "20 mg/mL", "100 mL over 30 min", "2000 mg", 30, 225, "Full therapeutic dose"),
    ],
    prerequisites=[
        "Documented severe penicillin allergy (anaphylaxis type)",
        "Ceftriaxone is drug of choice (e.g., meningitis, gonorrhea)",
        "No suitable alternative available",
        "Informed consent",
        "ICU or monitored setting",
        "Emergency medications at bedside",
    ],
    monitoring_requirements=[
        "Continuous vital signs",
        "Cardiac monitoring",
        "Pulse oximetry",
        "Observe for signs of allergic reaction",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg IV",
        "Methylprednisolone 125 mg IV",
        "Normal saline",
        "Albuterol nebulizer",
    ],
    contraindications=[
        "Previous SJS/TEN with cephalosporins",
        "Previous DRESS",
        "Known cephalosporin-specific IgE allergy (rare)",
    ],
    stop_criteria=[
        "Any sign of allergic reaction",
        "Hypotension",
        "Bronchospasm",
        "Urticaria",
        "Angioedema",
    ],
    post_desensitization_instructions=[
        "Continue ceftriaxone without interruption",
        "If dose delayed >24 hours, repeat desensitization",
        "Document in medical record",
    ],
    notes=[
        "Lower cross-reactivity with 3rd gen cephalosporins (<1%)",
        "Consider direct graded challenge if penicillin allergy was not anaphylaxis",
        "Skin testing to cephalosporins not well validated",
    ]
)

CEFTAZIDIME_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Ceftazidime",
    drug_class="Cephalosporin (3rd generation, anti-Pseudomonas)",
    desensitization_type=DesensitizationType.IV_RAPID,
    target_dose="2 g every 8 hours",
    total_duration_hours=4,
    risk_level=RiskLevel.MODERATE,
    steps=[
        # Similar 12-step protocol adjusted for ceftazidime
        DesensitizationStep(1, "0.1 mg/mL", "2 mL/hr", "0.2 mg", 15, 15, "Start infusion"),
        DesensitizationStep(2, "0.1 mg/mL", "4 mL/hr", "0.4 mg", 15, 30, "Double rate"),
        DesensitizationStep(3, "0.1 mg/mL", "8 mL/hr", "0.8 mg", 15, 45, "Double rate"),
        DesensitizationStep(4, "0.1 mg/mL", "16 mL/hr", "1.6 mg", 15, 60, "Double rate"),
        DesensitizationStep(5, "0.1 mg/mL", "32 mL/hr", "3.2 mg", 15, 75, "Double rate"),
        DesensitizationStep(6, "0.1 mg/mL", "64 mL/hr", "6.4 mg", 15, 90, "Double rate"),
        DesensitizationStep(7, "1 mg/mL", "12 mL/hr", "12 mg", 15, 105, "Switch to more concentrated"),
        DesensitizationStep(8, "1 mg/mL", "24 mL/hr", "24 mg", 15, 120, "Double rate"),
        DesensitizationStep(9, "1 mg/mL", "48 mL/hr", "48 mg", 15, 135, "Double rate"),
        DesensitizationStep(10, "1 mg/mL", "96 mL/hr", "96 mg", 15, 150, "Double rate"),
        DesensitizationStep(11, "20 mg/mL", "50 mL/hr", "1000 mg", 30, 180, "Switch to full concentration"),
        DesensitizationStep(12, "20 mg/mL", "100 mL over 30 min", "2000 mg", 30, 210, "Full therapeutic dose"),
    ],
    prerequisites=[
        "Severe penicillin allergy",
        "Ceftazidime required for Pseudomonas infection",
        "No suitable alternative (e.g., aztreonam not available or contraindicated)",
        "Informed consent",
        "ICU/monitored setting",
    ],
    monitoring_requirements=[
        "Continuous vital signs",
        "Cardiac monitoring",
        "Pulse oximetry",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg IV",
        "Methylprednisolone 125 mg IV",
    ],
    contraindications=[
        "SJS/TEN history with cephalosporins",
        "DRESS history",
    ],
    stop_criteria=["Hypotension", "Bronchospasm", "Urticaria", "Angioedema"],
    post_desensitization_instructions=[
        "Continue without interruption",
        "Repeat desensitization if dose delayed >24 hours",
    ],
    notes=[
        "Consider aztreonam as alternative - no cross-reactivity with beta-lactams except ceftazidime",
    ]
)

# =============================================================================
# CARBAPENEM DESENSITIZATION PROTOCOLS
# =============================================================================

MEROPENEM_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Meropenem",
    drug_class="Carbapenem",
    desensitization_type=DesensitizationType.IV_RAPID,
    target_dose="1 g every 8 hours",
    total_duration_hours=4.5,
    risk_level=RiskLevel.MODERATE,
    steps=[
        # Standard 12-step protocol for meropenem
        DesensitizationStep(1, "0.01 mg/mL", "2 mL/hr", "0.02 mg", 15, 15, "Start at very low dose"),
        DesensitizationStep(2, "0.01 mg/mL", "4 mL/hr", "0.04 mg", 15, 30, "Double rate"),
        DesensitizationStep(3, "0.01 mg/mL", "8 mL/hr", "0.08 mg", 15, 45, "Double rate"),
        DesensitizationStep(4, "0.01 mg/mL", "16 mL/hr", "0.16 mg", 15, 60, "Double rate"),
        DesensitizationStep(5, "0.01 mg/mL", "32 mL/hr", "0.32 mg", 15, 75, "Double rate"),
        DesensitizationStep(6, "0.01 mg/mL", "64 mL/hr", "0.64 mg", 15, 90, "Double rate"),
        DesensitizationStep(7, "0.1 mg/mL", "13 mL/hr", "1.3 mg", 15, 105, "Switch concentration"),
        DesensitizationStep(8, "0.1 mg/mL", "26 mL/hr", "2.6 mg", 15, 120, "Double rate"),
        DesensitizationStep(9, "0.1 mg/mL", "52 mL/hr", "5.2 mg", 15, 135, "Double rate"),
        DesensitizationStep(10, "0.1 mg/mL", "104 mL/hr", "10.4 mg", 15, 150, "Double rate"),
        DesensitizationStep(11, "10 mg/mL", "10 mL/hr", "100 mg", 15, 165, "Switch to standard concentration"),
        DesensitizationStep(12, "10 mg/mL", "20 mL/hr", "200 mg", 15, 180, "Continue increase"),
        DesensitizationStep(13, "10 mg/mL", "50 mL/hr", "500 mg", 30, 210, "Half dose"),
        DesensitizationStep(14, "10 mg/mL", "100 mL over 30 min", "1000 mg", 30, 240, "Full therapeutic dose"),
    ],
    prerequisites=[
        "Documented severe beta-lactam allergy",
        "Carbapenem required (ESBL, resistant organisms)",
        "Informed consent",
        "ICU/monitored setting",
        "Emergency medications available",
    ],
    monitoring_requirements=[
        "Continuous vital signs",
        "Cardiac monitoring",
        "Pulse oximetry",
        "Monitor for seizure risk at high doses",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg IV",
        "Methylprednisolone 125 mg IV",
        "Lorazepam or levetiracetam (for seizures)",
    ],
    contraindications=[
        "SJS/TEN history with carbapenems",
        "DRESS history",
        "Severe seizure disorder (relative - meropenem can lower threshold)",
    ],
    stop_criteria=[
        "Hypotension",
        "Bronchospasm", 
        "Urticaria",
        "Angioedema",
        "Seizure",
    ],
    post_desensitization_instructions=[
        "Continue meropenem without interruption",
        "Repeat desensitization if >24 hour gap",
        "Monitor for delayed reactions",
    ],
    notes=[
        "Cross-reactivity between penicillin and carbapenems ~1%",
        "Consider direct challenge first if non-anaphylactic history",
        "Meropenem preferred over imipenem for lower seizure risk",
    ]
)

# =============================================================================
# VANCOMYCIN DESENSITIZATION (Red Man Syndrome)
# =============================================================================

VANCOMYCIN_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Vancomycin",
    drug_class="Glycopeptide",
    desensitization_type=DesensitizationType.IV_STANDARD,
    target_dose="1 g every 12 hours",
    total_duration_hours=6,
    risk_level=RiskLevel.LOW,
    steps=[
        # Vancomycin desensitization for true allergy (rare)
        # Note: Most "vancomycin reactions" are red man syndrome (histamine release)
        # True allergy requires desensitization
        DesensitizationStep(1, "0.1 mg/mL", "2 mL/hr", "0.2 mg", 30, 30, "Very slow start"),
        DesensitizationStep(2, "0.1 mg/mL", "4 mL/hr", "0.4 mg", 30, 60, "Double rate"),
        DesensitizationStep(3, "0.1 mg/mL", "8 mL/hr", "0.8 mg", 30, 90, "Double rate"),
        DesensitizationStep(4, "0.1 mg/mL", "16 mL/hr", "1.6 mg", 30, 120, "Double rate"),
        DesensitizationStep(5, "0.1 mg/mL", "32 mL/hr", "3.2 mg", 30, 150, "Double rate"),
        DesensitizationStep(6, "1 mg/mL", "10 mL/hr", "10 mg", 30, 180, "Switch concentration"),
        DesensitizationStep(7, "1 mg/mL", "20 mL/hr", "20 mg", 30, 210, "Double rate"),
        DesensitizationStep(8, "1 mg/mL", "40 mL/hr", "40 mg", 30, 240, "Double rate"),
        DesensitizationStep(9, "1 mg/mL", "80 mL/hr", "80 mg", 30, 270, "Double rate"),
        DesensitizationStep(10, "5 mg/mL", "40 mL/hr", "200 mg", 30, 300, "Switch to standard"),
        DesensitizationStep(11, "5 mg/mL", "80 mL/hr", "400 mg", 30, 330, "Continue increase"),
        DesensitizationStep(12, "5 mg/mL", "100 mL/hr", "500 mg", 60, 390, "Half dose over 1 hour"),
        DesensitizationStep(13, "5 mg/mL", "200 mL over 2 hours", "1000 mg", 120, 510, "Full dose over 2 hours"),
    ],
    prerequisites=[
        "Documented true vancomycin allergy (not red man syndrome)",
        "Vancomycin is drug of choice (MRSA, VRE)",
        "Informed consent",
        "Alternative agents considered and ruled out",
    ],
    monitoring_requirements=[
        "Continuous vital signs",
        "Cardiac monitoring",
        "Pulse oximetry",
        "Monitor for red man syndrome (flushing, pruritus, hypotension)",
        "Vancomycin trough levels after steady state",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg IV",
        "Methylprednisolone 125 mg IV",
        "Normal saline for hypotension",
    ],
    contraindications=[
        "Previous SJS/TEN",
        "Previous DRESS",
    ],
    stop_criteria=[
        "Anaphylaxis",
        "Severe hypotension not responsive to fluids",
        "Bronchospasm",
        "Angioedema",
    ],
    post_desensitization_instructions=[
        "Continue vancomycin without interruption",
        "Infuse over 2 hours to minimize red man syndrome",
        "Consider premedication with diphenhydramine",
        "Repeat desensitization if >24 hour gap",
    ],
    notes=[
        "Most vancomycin reactions are red man syndrome (histamine-mediated, not IgE)",
        "Red man syndrome prevented by slower infusion rate",
        "True IgE allergy to vancomycin is rare",
        "If red man syndrome: slow infusion, premedicate with H1/H2 blockers",
    ]
)

# =============================================================================
# SULFONAMIDE DESENSITIZATION
# =============================================================================

TMP_SMX_ORAL_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Trimethoprim-Sulfamethoxazole (TMP-SMX)",
    drug_class="Sulfonamide antibiotic",
    desensitization_type=DesensitizationType.ORAL,
    target_dose="1 DS tablet (800/160 mg) every 12 hours",
    total_duration_hours=5,
    risk_level=RiskLevel.MODERATE,
    steps=[
        # 3-day oral desensitization protocol (can be compressed)
        # Day 1 - Very low doses
        DesensitizationStep(1, "0.04/0.8 mg", "0.04/0.8 mg", "0.04/0.8 mg", 0, 0, "Take as single dose"),
        DesensitizationStep(2, "0.4/0.8 mg", "0.4/0.8 mg", "0.44/1.6 mg cumulative", 0, 60, "Wait 1 hour, then take"),
        DesensitizationStep(3, "4/0.8 mg", "4/0.8 mg", "4.44/2.4 mg cumulative", 0, 120, "Wait 1 hour, then take"),
        # Day 1 continued - escalating
        DesensitizationStep(4, "40/8 mg", "40/8 mg", "44.4/10.4 mg", 0, 180, "Wait 1 hour"),
        DesensitizationStep(5, "80/16 mg (pediatric suspension)", "80/16 mg", "124.4/26.4 mg", 0, 240, "Wait 1 hour"),
        DesensitizationStep(6, "160/32 mg", "160/32 mg", "284.4/58.4 mg", 0, 300, "Wait 1 hour"),
        # Day 1 final - approaching target
        DesensitizationStep(7, "400/80 mg (single strength)", "400/80 mg", "684.4/138.4 mg", 0, 360, "End day 1"),
        # Day 2
        DesensitizationStep(8, "400/80 mg SS", "1 tablet SS", "1 tablet SS", 0, 0, "Morning of Day 2"),
        DesensitizationStep(9, "400/80 mg SS", "2 tablets SS", "2 tablets SS total", 0, 360, "6 hours later"),
        # Day 3
        DesensitizationStep(10, "800/160 mg DS", "1 tablet DS", "1 tablet DS", 0, 0, "Morning of Day 3 - target dose"),
    ],
    prerequisites=[
        "Documented sulfonamide allergy",
        "TMP-SMX required (PCP prophylaxis, MRSA, Nocardia, etc.)",
        "No history of SJS/TEN or DRESS",
        "Informed consent",
        "Monitoring available",
    ],
    monitoring_requirements=[
        "Vital signs before each dose",
        "Monitor for rash, fever, lymphadenopathy",
        "Watch for delayed hypersensitivity reactions",
        "LFTs if prolonged use planned",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg",
        "Methylprednisolone 125 mg",
    ],
    contraindications=[
        "History of SJS/TEN with sulfonamides",
        "History of DRESS",
        "G6PD deficiency (relative - risk of hemolysis)",
        "Severe hepatic impairment",
    ],
    stop_criteria=[
        "Rash",
        "Fever",
        "Lymphadenopathy",
        "Eosinophilia",
        "Hepatitis",
        "Any sign of systemic hypersensitivity",
    ],
    post_desensitization_instructions=[
        "Continue TMP-SMX without interruption",
        "Monitor for delayed reactions (up to 6 weeks)",
        "Stop immediately if rash or fever develops",
        "Report any new symptoms promptly",
    ],
    notes=[
        "Sulfonamide allergy can be severe (SJS/TEN)",
        "Desensitization not recommended if history of SJS/TEN",
        "HIV patients have higher rates of sulfonamide reactions",
        "Consider alternative if available (e.g., dapsone for PCP prophylaxis)",
    ]
)

# =============================================================================
# AZTREONAM DESENSITIZATION
# =============================================================================

AZTREONAM_IV_DESENSITIZATION = DesensitizationProtocol(
    drug_name="Aztreonam",
    drug_class="Monobactam",
    desensitization_type=DesensitizationType.IV_RAPID,
    target_dose="2 g every 8 hours",
    total_duration_hours=4,
    risk_level=RiskLevel.LOW,
    steps=[
        # 12-step protocol for aztreonam
        DesensitizationStep(1, "0.1 mg/mL", "2 mL/hr", "0.2 mg", 15, 15, "Start infusion"),
        DesensitizationStep(2, "0.1 mg/mL", "4 mL/hr", "0.4 mg", 15, 30, "Double rate"),
        DesensitizationStep(3, "0.1 mg/mL", "8 mL/hr", "0.8 mg", 15, 45, "Double rate"),
        DesensitizationStep(4, "0.1 mg/mL", "16 mL/hr", "1.6 mg", 15, 60, "Double rate"),
        DesensitizationStep(5, "0.1 mg/mL", "32 mL/hr", "3.2 mg", 15, 75, "Double rate"),
        DesensitizationStep(6, "0.1 mg/mL", "64 mL/hr", "6.4 mg", 15, 90, "Double rate"),
        DesensitizationStep(7, "1 mg/mL", "13 mL/hr", "13 mg", 15, 105, "Switch concentration"),
        DesensitizationStep(8, "1 mg/mL", "26 mL/hr", "26 mg", 15, 120, "Double rate"),
        DesensitizationStep(9, "1 mg/mL", "52 mL/hr", "52 mg", 15, 135, "Double rate"),
        DesensitizationStep(10, "1 mg/mL", "104 mL/hr", "104 mg", 15, 150, "Double rate"),
        DesensitizationStep(11, "20 mg/mL", "50 mL/hr", "1000 mg", 30, 180, "Half dose"),
        DesensitizationStep(12, "20 mg/mL", "100 mL over 30 min", "2000 mg", 30, 210, "Full therapeutic dose"),
    ],
    prerequisites=[
        "Documented severe beta-lactam allergy including ceftazidime",
        "Aztreonam required for Gram-negative infection",
        "Informed consent",
    ],
    monitoring_requirements=[
        "Continuous vital signs",
        "Cardiac monitoring",
        "Pulse oximetry",
    ],
    emergency_medications=[
        "Epinephrine 1:1000",
        "Diphenhydramine 50 mg IV",
        "Methylprednisolone 125 mg IV",
    ],
    contraindications=[
        "Previous severe reaction to aztreonam",
        "SJS/TEN history",
        "Note: Ceftazidime shares side chain - potential cross-reactivity",
    ],
    stop_criteria=["Hypotension", "Bronchospasm", "Urticaria", "Angioedema"],
    post_desensitization_instructions=[
        "Continue aztreonam without interruption",
        "Repeat desensitization if >24 hour gap",
    ],
    notes=[
        "No cross-reactivity with other beta-lactams except ceftazidime",
        "Preferred alternative for severe penicillin allergy when Pseudomonas coverage needed",
        "If ceftazidime allergy, cannot assume aztreonam safety",
    ]
)


# =============================================================================
# DESENSITIZATION PROTOCOL DATABASE
# =============================================================================

DESENSITIZATION_PROTOCOLS: Dict[str, DesensitizationProtocol] = {
    "penicillin_g_iv": PENICILLIN_IV_DESENSITIZATION,
    "amoxicillin_oral": AMOXICILLIN_ORAL_DESENSITIZATION,
    "ceftriaxone_iv": CEFTRIAXONE_IV_DESENSITIZATION,
    "ceftazidime_iv": CEFTAZIDIME_IV_DESENSITIZATION,
    "meropenem_iv": MEROPENEM_IV_DESENSITIZATION,
    "vancomycin_iv": VANCOMYCIN_IV_DESENSITIZATION,
    "tmp_smx_oral": TMP_SMX_ORAL_DESENSITIZATION,
    "aztreonam_iv": AZTREONAM_IV_DESENSITIZATION,
}


# =============================================================================
# ALTERNATIVE ANTIBIOTIC RECOMMENDATIONS
# =============================================================================

ALTERNATIVE_ANTIBIOTICS: Dict[str, List[Dict[str, Any]]] = {
    "penicillin_allergy": [
        {
            "alternative": "aztreonam",
            "coverage": "Gram-negative aerobes (Pseudomonas)",
            "notes": "No cross-reactivity except with ceftazidime",
            "limitations": "No gram-positive coverage"
        },
        {
            "alternative": "vancomycin",
            "coverage": "Gram-positive cocci (including MRSA)",
            "notes": "No cross-reactivity",
            "limitations": "Requires IV, nephrotoxicity"
        },
        {
            "alternative": "carbapenems",
            "coverage": "Broad spectrum",
            "notes": "Cross-reactivity ~1% (lower than other beta-lactams)",
            "limitations": "Reserve for serious infections"
        },
        {
            "alternative": "3rd/4th gen cephalosporins",
            "coverage": "Broad gram-negative, some gram-positive",
            "notes": "Cross-reactivity <1% for 3rd/4th generation",
            "limitations": "Avoid 1st gen if anaphylaxis history"
        },
        {
            "alternative": "fluoroquinolones",
            "coverage": "Broad gram-negative, some gram-positive",
            "notes": "No cross-reactivity",
            "limitations": "Side effects, resistance concerns"
        },
    ],
    "sulfa_allergy": [
        {
            "alternative": "nitrofurantoin",
            "coverage": "E. coli, Enterococcus",
            "notes": "First-line for uncomplicated UTI",
            "limitations": "Not for systemic infections"
        },
        {
            "alternative": "fosfomycin",
            "coverage": "E. coli, Enterococcus",
            "notes": "Single dose for uncomplicated UTI",
            "limitations": "Limited spectrum"
        },
        {
            "alternative": "fluoroquinolones",
            "coverage": "Broad gram-negative coverage",
            "notes": "Good tissue penetration",
            "limitations": "Side effects, resistance"
        },
        {
            "alternative": "dapsone",
            "coverage": "PCP prophylaxis",
            "notes": "Alternative for PCP prophylaxis",
            "limitations": "G6PD check required, methemoglobinemia"
        },
    ],
    "vancomycin_allergy": [
        {
            "alternative": "linezolid",
            "coverage": "MRSA, VRE",
            "notes": "Excellent bioavailability",
            "limitations": "Myelosuppression, expensive"
        },
        {
            "alternative": "daptomycin",
            "coverage": "MRSA, VRE",
            "notes": "Bactericidal",
            "limitations": "Not for pneumonia, CPK monitoring"
        },
        {
            "alternative": "tedizolid",
            "coverage": "MRSA, VRE",
            "notes": "Once daily",
            "limitations": "Limited data"
        },
        {
            "alternative": "ceftaroline",
            "coverage": "MRSA (not VRE)",
            "notes": "Beta-lactam with anti-MRSA activity",
            "limitations": "No VRE coverage"
        },
        {
            "alternative": "telavancin",
            "coverage": "MRSA",
            "notes": "Lipoglycopeptide",
            "limitations": "Nephrotoxicity, QT prolongation"
        },
    ],
}


# =============================================================================
# DESENSITIZATION ENGINE CLASS
# =============================================================================

class DesensitizationEngine:
    """
    Engine for managing antibiotic desensitization protocols.
    
    Features:
    - Multiple antibiotic desensitization protocols
    - Step-by-step dosing instructions
    - Safety monitoring requirements
    - Alternative antibiotic recommendations
    """
    
    def __init__(self):
        self._protocols = DESENSITIZATION_PROTOCOLS
        self._alternatives = ALTERNATIVE_ANTIBIOTICS
    
    def get_protocol(self, drug_name: str) -> Optional[DesensitizationProtocol]:
        """Get desensitization protocol for a specific drug."""
        drug_key = drug_name.lower().replace("-", "_").replace(" ", "_")
        
        # Direct match
        if drug_key in self._protocols:
            return self._protocols[drug_key]
        
        # Partial match
        for key, protocol in self._protocols.items():
            if drug_key in key or key in drug_key:
                return protocol
            if drug_name.lower() in protocol.drug_name.lower():
                return protocol
        
        return None
    
    def get_alternatives(self, allergy_type: str) -> List[Dict[str, Any]]:
        """Get alternative antibiotics for a given allergy type."""
        allergy_key = allergy_type.lower().replace(" ", "_")
        
        # Map common names
        allergy_map = {
            "penicillin": "penicillin_allergy",
            "pcn": "penicillin_allergy",
            "beta-lactam": "penicillin_allergy",
            "sulfa": "sulfa_allergy",
            "sulfonamide": "sulfa_allergy",
            "tmp-smx": "sulfa_allergy",
            "bactrim": "sulfa_allergy",
            "vancomycin": "vancomycin_allergy",
            "vanc": "vancomycin_allergy",
        }
        
        lookup_key = allergy_map.get(allergy_key, f"{allergy_key}_allergy")
        return self._alternatives.get(lookup_key, [])
    
    def is_desensitization_appropriate(
        self,
        drug_name: str,
        allergy_type: str,
        allergy_severity: str
    ) -> Dict[str, Any]:
        """
        Determine if desensitization is appropriate.
        
        Returns recommendation with reasoning.
        """
        protocol = self.get_protocol(drug_name)
        
        if not protocol:
            return {
                "appropriate": False,
                "reason": f"No desensitization protocol available for {drug_name}",
                "recommendation": "Consider alternative antibiotics"
            }
        
        # Check for absolute contraindications
        if allergy_severity.lower() in ["sjs", "ten", "dress", "anaphylaxis"]:
            if allergy_severity.lower() in ["sjs", "ten", "dress"]:
                return {
                    "appropriate": False,
                    "reason": f"History of {allergy_severity.upper()} is absolute contraindication for desensitization",
                    "recommendation": "Avoid this drug class entirely. See alternatives."
                }
        
        # Check for relative contraindications
        relative_contraindications = []
        
        if allergy_severity.lower() == "anaphylaxis":
            relative_contraindications.append("History of anaphylaxis requires ICU setting and experienced team")
        
        return {
            "appropriate": True,
            "protocol": protocol.to_dict() if protocol else None,
            "risk_level": protocol.risk_level.value if protocol else None,
            "relative_contraindications": relative_contraindications,
            "prerequisites": protocol.prerequisites if protocol else [],
            "alternatives": self.get_alternatives(allergy_type),
        }
    
    def calculate_current_step(
        self,
        protocol_id: str,
        current_dose_mg: float
    ) -> Dict[str, Any]:
        """
        Calculate current step in desensitization based on dose delivered.
        """
        protocol = self._protocols.get(protocol_id)
        if not protocol:
            return {"error": "Protocol not found"}
        
        current_step = None
        for step in protocol.steps:
            # This is simplified - actual implementation would parse dose strings
            current_step = step
            # Would compare current_dose_mg to step.dose_delivered
        
        remaining_steps = protocol.steps[current_step.step_number:] if current_step else []
        return {
            "current_step": current_step.to_dict() if current_step else None,
            "remaining_steps": len(protocol.steps) - (current_step.step_number if current_step else 0),
            "total_steps": len(protocol.steps),
            "estimated_remaining_time_minutes": sum(
                s.duration_minutes for s in remaining_steps
            )
        }
    
    def list_available_protocols(self) -> List[str]:
        """List all available desensitization protocols."""
        return list(self._protocols.keys())


# Singleton instance
_desensitization_engine = None

def get_desensitization_engine() -> DesensitizationEngine:
    """Get singleton DesensitizationEngine instance."""
    global _desensitization_engine
    if _desensitization_engine is None:
        _desensitization_engine = DesensitizationEngine()
    return _desensitization_engine
