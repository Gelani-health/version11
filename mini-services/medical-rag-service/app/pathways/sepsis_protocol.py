"""
Sepsis Protocol (SEP-1 Bundle Compliance)
=========================================

Evidence-based sepsis management protocol based on:
- Surviving Sepsis Campaign Guidelines 2021
- CMS SEP-1 Bundle Requirements
- Sepsis-3 Definitions

Key Components:
1. Screening and Recognition (qSOFA, SOFA)
2. Resuscitation Bundle (3-hour)
3. Performance Bundle (6-hour)
4. Source Control
5. Vasopressor Management
6. Adjunctive Therapies

Time Targets:
- Lactate: within 3 hours
- Blood cultures: within 3 hours
- Antibiotics: within 3 hours (1 hour preferred)
- Fluid resuscitation: 30 mL/kg within 3 hours
- Vasopressors: if refractory hypotension
- Repeat lactate: within 6 hours
- Source control: within 6-12 hours
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timedelta


class SepsisStage(str, Enum):
    """Sepsis classification stages."""
    INFECTION_ONLY = "infection"
    SEPSIS = "sepsis"  # Infection + SOFA ≥2
    SEVERE_SEPSIS = "severe_sepsis"  # Deprecated term, kept for reference
    SEPTIC_SHOCK = "septic_shock"  # Sepsis + refractory hypotension


class BundleElement(str, Enum):
    """Elements of sepsis bundles."""
    # 3-Hour Bundle
    LACTATE = "lactate"
    BLOOD_CULTURES = "blood_cultures"
    BROAD_SPECTRUM_ANTIBIOTICS = "broad_spectrum_antibiotics"
    FLUID_RESUSCITATION = "fluid_resuscitation"

    # 6-Hour Bundle
    VASOPRESSORS = "vasopressors"
    REPEAT_LACTATE = "repeat_lactate"
    SOURCE_CONTROL = "source_control"
    SEPSIS_ASSESSMENT = "sepsis_assessment"


class FluidResponse(str, Enum):
    """Response to fluid resuscitation."""
    RESPONDER = "responder"
    TRANSIENT_RESPONDER = "transient"
    NON_RESPONDER = "non_responder"


@dataclass
class BundleItem:
    """Individual bundle item tracking."""
    element: BundleElement
    required: bool = True
    completed: bool = False
    time_due: Optional[datetime] = None
    time_completed: Optional[datetime] = None
    value: Optional[Any] = None
    compliant: bool = False
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "element": self.element.value,
            "required": self.required,
            "completed": self.completed,
            "time_due": self.time_due.isoformat() if self.time_due else None,
            "time_completed": self.time_completed.isoformat() if self.time_completed else None,
            "value": str(self.value) if self.value else None,
            "compliant": self.compliant,
            "notes": self.notes,
        }


@dataclass
class SepsisAssessment:
    """Complete sepsis assessment and protocol tracking."""
    patient_id: Optional[str] = None
    sepsis_stage: SepsisStage = SepsisStage.INFECTION_ONLY
    qsofa_score: int = 0
    sofa_score: int = 0
    has_infection: bool = False
    infection_source: str = ""
    bundle_items: List[BundleItem] = field(default_factory=list)
    lactate_initial: Optional[float] = None
    lactate_repeat: Optional[float] = None
    fluid_volume_given: float = 0.0  # mL
    fluid_response: Optional[FluidResponse] = None
    on_vasopressors: bool = False
    vasopressor_type: str = ""
    antibiotics_given: List[str] = field(default_factory=list)
    time_of_recognition: Optional[datetime] = None
    time_3hr_bundle_complete: Optional[datetime] = None
    time_6hr_bundle_complete: Optional[datetime] = None
    recommendations: List[str] = field(default_factory=list)
    alerts: List[str] = field(default_factory=list)
    bundle_compliance_percent: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "sepsis_stage": self.sepsis_stage.value,
            "qsofa_score": self.qsofa_score,
            "sofa_score": self.sofa_score,
            "has_infection": self.has_infection,
            "infection_source": self.infection_source,
            "bundle_items": [b.to_dict() for b in self.bundle_items],
            "lactate_initial": self.lactate_initial,
            "lactate_repeat": self.lactate_repeat,
            "fluid_volume_given": self.fluid_volume_given,
            "fluid_response": self.fluid_response.value if self.fluid_response else None,
            "on_vasopressors": self.on_vasopressors,
            "vasopressor_type": self.vasopressor_type,
            "antibiotics_given": self.antibiotics_given,
            "time_of_recognition": self.time_of_recognition.isoformat() if self.time_of_recognition else None,
            "time_3hr_bundle_complete": self.time_3hr_bundle_complete.isoformat() if self.time_3hr_bundle_complete else None,
            "time_6hr_bundle_complete": self.time_6hr_bundle_complete.isoformat() if self.time_6hr_bundle_complete else None,
            "recommendations": self.recommendations,
            "alerts": self.alerts,
            "bundle_compliance_percent": self.bundle_compliance_percent,
        }


class SepsisProtocol:
    """
    Sepsis Protocol Manager implementing SEP-1 Bundle.
    
    Features:
    - qSOFA and SOFA score calculation
    - Bundle element tracking
    - Time-based compliance monitoring
    - Evidence-based recommendations
    """

    # qSOFA Criteria
    QSOFA_CRITERIA = {
        "altered_mentation": {"description": "GCS < 15", "points": 1},
        "respiratory_rate_high": {"description": "RR ≥ 22/min", "points": 1},
        "systolic_bp_low": {"description": "SBP ≤ 100 mmHg", "points": 1},
    }

    # Empiric Antibiotic Recommendations by Source
    EMPIRIC_ANTIBIOTICS = {
        "pneumonia_community": {
            "first_line": ["Ceftriaxone 2g IV + Azithromycin 500mg IV"],
            "allergy": ["Levofloxacin 750mg IV or Moxifloxacin 400mg IV"],
            "notes": "Add vancomycin if MRSA risk factors",
        },
        "pneumonia_hap_vap": {
            "first_line": ["Piperacillin-Tazobactam 4.5g IV q6h OR Cefepime 2g IV q8h"],
            "add_vancomycin": True,
            "notes": "Consider aminoglycoside for Pseudomonas coverage",
        },
        "uti": {
            "first_line": ["Ceftriaxone 1g IV or Ciprofloxacin 400mg IV"],
            "notes": "Add vancomycin if catheter-associated or recent healthcare exposure",
        },
        "intraabdominal": {
            "first_line": ["Piperacillin-Tazobactam 4.5g IV q6h OR Meropenem 1g IV q8h"],
            "add_vancomycin": True,
            "notes": "Surgical source control critical",
        },
        "skin_soft_tissue": {
            "first_line": ["Vancomycin 15-20mg/kg IV q8-12h"],
            "necrotizing": ["Meropenem + Vancomycin + Clindamycin"],
            "notes": "Consider surgical debridement",
        },
        "unknown_source": {
            "first_line": ["Piperacillin-Tazobactam 4.5g IV q6h + Vancomycin"],
            "alternative": ["Meropenem 1g IV q8h + Vancomycin"],
            "notes": "Broad spectrum coverage, narrow once source identified",
        },
        "catheter_related": {
            "first_line": ["Vancomycin IV"],
            "add_gentamicin": "If gram-negative concern",
            "notes": "Remove catheter if possible",
        },
    }

    # Vasopressor Recommendations
    VASOPRESSOR_PROTOCOL = {
        "first_line": "Norepinephrine",
        "dose_range": "0.01-3 mcg/kg/min",
        "target_map": 65,  # mmHg
        "add_on": {
            "vasopressin": "0.03-0.04 units/min (add to reduce norepinephrine dose)",
            "epinephrine": "0.01-0.5 mcg/kg/min (if cardiac dysfunction)",
            "dobutamine": "2.5-20 mcg/kg/min (if low cardiac output)",
            "hydrocortisone": "200mg/day if refractory shock",
        },
    }

    def assess(
        self,
        patient_id: Optional[str] = None,
        has_suspected_infection: bool = False,
        infection_source: str = "unknown",
        qsofa_altered_mentation: bool = False,
        qsofa_rr_high: bool = False,
        qsofa_sbp_low: bool = False,
        sofa_score: int = 0,
        lactate: Optional[float] = None,
        map: Optional[float] = None,
        fluid_resuscitated: bool = False,
        time_of_recognition: Optional[datetime] = None,
    ) -> SepsisAssessment:
        """
        Assess patient for sepsis and initiate protocol.
        
        Args:
            patient_id: Patient identifier
            has_suspected_infection: Whether infection is suspected/confirmed
            infection_source: Source of infection
            qsofa_altered_mentation: GCS < 15
            qsofa_rr_high: RR ≥ 22
            qsofa_sbp_low: SBP ≤ 100
            sofa_score: Calculated SOFA score
            lactate: Initial lactate level (mmol/L)
            map: Mean arterial pressure
            fluid_resuscitated: Already received fluid resuscitation
            time_of_recognition: Time sepsis recognized
        
        Returns:
            SepsisAssessment with protocol steps and recommendations
        """
        time_of_recognition = time_of_recognition or datetime.utcnow()

        # Calculate qSOFA score
        qsofa_score = sum([
            1 if qsofa_altered_mentation else 0,
            1 if qsofa_rr_high else 0,
            1 if qsofa_sbp_low else 0,
        ])

        # Determine sepsis stage
        sepsis_stage = self._determine_sepsis_stage(
            has_suspected_infection,
            sofa_score,
            lactate,
            map,
            fluid_resuscitated,
        )

        # Generate bundle items
        bundle_items = self._create_bundle_items(
            sepsis_stage,
            time_of_recognition,
            lactate,
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            sepsis_stage,
            infection_source,
            lactate,
            sofa_score,
        )

        # Generate alerts
        alerts = self._generate_alerts(
            sepsis_stage,
            qsofa_score,
            lactate,
            map,
        )

        return SepsisAssessment(
            patient_id=patient_id,
            sepsis_stage=sepsis_stage,
            qsofa_score=qsofa_score,
            sofa_score=sofa_score,
            has_infection=has_suspected_infection,
            infection_source=infection_source,
            bundle_items=bundle_items,
            lactate_initial=lactate,
            time_of_recognition=time_of_recognition,
            recommendations=recommendations,
            alerts=alerts,
        )

    def _determine_sepsis_stage(
        self,
        has_infection: bool,
        sofa_score: int,
        lactate: Optional[float],
        map: Optional[float],
        fluid_resuscitated: bool,
    ) -> SepsisStage:
        """Determine sepsis stage based on criteria."""
        if not has_infection:
            return SepsisStage.INFECTION_ONLY

        # Sepsis: Infection + organ dysfunction (SOFA ≥ 2)
        if sofa_score < 2 and (lactate is None or lactate < 2):
            return SepsisStage.INFECTION_ONLY

        # Septic shock: Sepsis + refractory hypotension or lactate > 2
        if map and map < 65 and fluid_resuscitated:
            return SepsisStage.SEPTIC_SHOCK
        if lactate and lactate > 2:
            return SepsisStage.SEPTIC_SHOCK

        return SepsisStage.SEPSIS

    def _create_bundle_items(
        self,
        stage: SepsisStage,
        time_recognition: datetime,
        lactate: Optional[float],
    ) -> List[BundleItem]:
        """Create bundle tracking items."""
        items = []

        # 3-hour bundle elements
        items.append(BundleItem(
            element=BundleElement.LACTATE,
            required=True,
            time_due=time_recognition + timedelta(hours=3),
            value=lactate,
            completed=lactate is not None,
        ))

        items.append(BundleItem(
            element=BundleElement.BLOOD_CULTURES,
            required=True,
            time_due=time_recognition + timedelta(hours=3),
            notes="Draw before antibiotics, at least 2 sets from different sites",
        ))

        items.append(BundleItem(
            element=BundleElement.BROAD_SPECTRUM_ANTIBIOTICS,
            required=True,
            time_due=time_recognition + timedelta(hours=1),  # 1 hour preferred
            notes="Broad spectrum, empiric coverage for likely source",
        ))

        items.append(BundleItem(
            element=BundleElement.FLUID_RESUSCITATION,
            required=True,
            time_due=time_recognition + timedelta(hours=3),
            value="30 mL/kg crystalloid",
            notes="Normal saline or Lactated Ringer's",
        ))

        # 6-hour bundle elements (for sepsis/septic shock)
        if stage in [SepsisStage.SEPSIS, SepsisStage.SEPTIC_SHOCK]:
            items.append(BundleItem(
                element=BundleElement.VASOPRESSORS,
                required=stage == SepsisStage.SEPTIC_SHOCK,
                time_due=time_recognition + timedelta(hours=6),
                notes="If MAP < 65 after fluid resuscitation, start norepinephrine",
            ))

            items.append(BundleItem(
                element=BundleElement.REPEAT_LACTATE,
                required=True,
                time_due=time_recognition + timedelta(hours=6),
                notes="To assess clearance/response to resuscitation",
            ))

            items.append(BundleItem(
                element=BundleElement.SOURCE_CONTROL,
                required=True,
                time_due=time_recognition + timedelta(hours=6),
                notes="Drainage, debridement, device removal as indicated",
            ))

        return items

    def _generate_recommendations(
        self,
        stage: SepsisStage,
        infection_source: str,
        lactate: Optional[float],
        sofa_score: int,
    ) -> List[str]:
        """Generate evidence-based recommendations."""
        recommendations = []

        if stage == SepsisStage.INFECTION_ONLY:
            recommendations.append("Continue monitoring for signs of organ dysfunction")
            recommendations.append("Repeat assessment if clinical status changes")
            return recommendations

        # Core sepsis recommendations
        recommendations.append("🚨 SEPSIS PROTOCOL INITIATED")
        recommendations.append("")
        recommendations.append("=== 3-HOUR BUNDLE (Complete within 3 hours) ===")
        recommendations.append("1. ✓ Measure lactate level")
        recommendations.append("2. ✓ Obtain blood cultures BEFORE antibiotics")
        recommendations.append("3. ✓ Administer broad-spectrum antibiotics")
        recommendations.append("4. ✓ Begin rapid fluid resuscitation: 30 mL/kg crystalloid")

        # Antibiotic recommendations by source
        if infection_source:
            abx_rec = self.EMPIRIC_ANTIBIOTICS.get(infection_source, self.EMPIRIC_ANTIBIOTICS["unknown_source"])
            recommendations.append("")
            recommendations.append(f"=== EMPIRIC ANTIBIOTICS ({infection_source}) ===")
            for abx in abx_rec.get("first_line", []):
                recommendations.append(f"  • {abx}")
            if abx_rec.get("add_vancomycin"):
                recommendations.append("  • + Vancomycin 15-20mg/kg IV q8-12h")
            if abx_rec.get("notes"):
                recommendations.append(f"  Note: {abx_rec['notes']}")

        # Septic shock specific
        if stage == SepsisStage.SEPTIC_SHOCK:
            recommendations.append("")
            recommendations.append("=== SEPTIC SHOCK MANAGEMENT ===")
            recommendations.append("⚠️ This patient meets criteria for SEPTIC SHOCK")

            if lactate and lactate > 2:
                recommendations.append(f"  • Lactate {lactate} mmol/L - indicates tissue hypoperfusion")

            recommendations.append("")
            recommendations.append("=== 6-HOUR BUNDLE ===")
            recommendations.append("5. Start norepinephrine if MAP < 65 after 30 mL/kg fluids")
            recommendations.append(f"   Target MAP: ≥65 mmHg")
            recommendations.append("   Start via peripheral IV if central line not available")
            recommendations.append("6. Repeat lactate to assess clearance")
            recommendations.append("7. Achieve source control within 6-12 hours")
            recommendations.append("8. Reassess volume status and tissue perfusion")

            recommendations.append("")
            recommendations.append("=== VASOPRESSOR PROTOCOL ===")
            recommendations.append("  • Norepinephrine: First-line (0.01-3 mcg/kg/min)")
            recommendations.append("  • Vasopressin: Add at 0.03-0.04 units/min")
            recommendations.append("  • Hydrocortisone 200mg/day if refractory to vasopressors")

        # Monitoring recommendations
        recommendations.append("")
        recommendations.append("=== MONITORING ===")
        recommendations.append("  • Continuous hemodynamic monitoring")
        recommendations.append("  • Serial lactate every 2-4 hours")
        recommendations.append("  • Urine output monitoring (target > 0.5 mL/kg/hr)")
        recommendations.append("  • Central venous oxygen saturation if available")
        recommendations.append("  • Consider ICU admission")

        return recommendations

    def _generate_alerts(
        self,
        stage: SepsisStage,
        qsofa_score: int,
        lactate: Optional[float],
        map: Optional[float],
    ) -> List[str]:
        """Generate clinical alerts."""
        alerts = []

        if stage == SepsisStage.SEPTIC_SHOCK:
            alerts.append("🚨 CRITICAL: SEPTIC SHOCK - High mortality risk")
        elif stage == SepsisStage.SEPSIS:
            alerts.append("⚠️ ALERT: SEPSIS - Initiate protocol")

        if qsofa_score >= 2:
            alerts.append(f"⚠️ qSOFA Score {qsofa_score}/3 - High risk of poor outcome")

        if lactate and lactate > 4:
            alerts.append("🚨 SEVERE HYPERLACTATEMIA - Aggressive resuscitation required")
        elif lactate and lactate > 2:
            alerts.append(f"⚠️ Elevated lactate ({lactate} mmol/L) - Tissue hypoperfusion")

        if map and map < 65:
            alerts.append(f"⚠️ Hypotension (MAP {map} mmHg) - Vasopressors may be needed")

        return alerts

    def get_antibiotic_recommendations(self, source: str) -> Dict[str, Any]:
        """Get empiric antibiotic recommendations for a source."""
        return self.EMPIRIC_ANTIBIOTICS.get(source, self.EMPIRIC_ANTIBIOTICS["unknown_source"])

    def calculate_fluid_dose(self, weight_kg: float) -> Dict[str, Any]:
        """Calculate fluid resuscitation dose."""
        volume_ml = 30 * weight_kg
        return {
            "weight_kg": weight_kg,
            "fluid_volume_ml": volume_ml,
            "fluid_type": "Crystalloid (NS or LR)",
            "infusion_time": "Rapid bolus over 15-30 minutes",
            "reassess_after": "Check for fluid responsiveness",
        }


# Singleton
_sepsis_protocol: Optional[SepsisProtocol] = None


def get_sepsis_protocol() -> SepsisProtocol:
    """Get sepsis protocol singleton."""
    global _sepsis_protocol
    if _sepsis_protocol is None:
        _sepsis_protocol = SepsisProtocol()
    return _sepsis_protocol
