"""
Stroke Clinical Pathway with tPA Eligibility
============================================

Evidence-based pathway for acute stroke evaluation and management.

Based on:
- AHA/ASA Guidelines for Acute Ischemic Stroke 2019/2023
- Stroke Team Activation Protocols
- NIH Stroke Scale

Key Components:
1. Stroke Recognition (FAST, BE-FAST)
2. NIHSS Assessment
3. Imaging (Non-contrast CT ± CTA)
4. tPA Eligibility Assessment
5. Thrombectomy Eligibility
6. Post-tPA Management

Time Targets:
- Door-to-CT: < 25 minutes
- Door-to-CT-read: < 45 minutes
- Door-to-needle (tPA): < 60 minutes
- Door-to-puncture (thrombectomy): < 90 minutes

tPA Window:
- Standard: 0-4.5 hours from LKW
- Extended: Selected patients up to 9 hours (with imaging)
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timedelta


class StrokeType(str, Enum):
    """Types of stroke."""
    ISCHEMIC = "ischemic"
    HEMORRHAGIC = "hemorrhagic"
    SUBARACHNOID = "subarachnoid"
    UNKNOWN = "unknown"
    STROKE_MIMIC = "mimic"


class tPAEligibility(str, Enum):
    """tPA eligibility status."""
    ELIGIBLE = "eligible"
    ELIGIBLE_WITH_WARNINGS = "eligible_with_warnings"
    INELIGIBLE_ABSOLUTE = "ineligible_absolute"
    INELIGIBLE_RELATIVE = "ineligible_relative"
    WINDOW_EXCEEDED = "window_exceeded"


class ThrombectomyEligibility(str, Enum):
    """Mechanical thrombectomy eligibility."""
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    WINDOW_EXTENDED = "extended_window"
    NEEDS_IMAGING = "needs_imaging"


@dataclass
class NIHSSItem:
    """Individual NIH Stroke Scale item."""
    item_name: str
    item_number: int
    score: int
    max_score: int
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_name": self.item_name,
            "item_number": self.item_number,
            "score": self.score,
            "max_score": self.max_score,
            "description": self.description,
        }


@dataclass
class tPAContraindication:
    """tPA contraindication item."""
    criterion: str
    is_present: bool
    is_absolute: bool
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "criterion": self.criterion,
            "is_present": self.is_present,
            "is_absolute": self.is_absolute,
            "notes": self.notes,
        }


@dataclass
class StrokeAssessment:
    """Complete stroke pathway assessment."""
    patient_id: Optional[str] = None
    stroke_type: StrokeType = StrokeType.UNKNOWN
    last_known_well: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    onset_to_arrival_minutes: Optional[float] = None
    nihss_score: int = 0
    nihss_items: List[NIHSSItem] = field(default_factory=list)
    tpa_eligibility: tPAEligibility = tPAEligibility.INELIGIBLE_ABSOLUTE
    tpa_contraindications: List[tPAContraindication] = field(default_factory=list)
    thrombectomy_eligibility: ThrombectomyEligibility = ThrombectomyEligibility.NEEDS_IMAGING
    ct_completed: bool = False
    ct_result: str = ""
    cta_completed: bool = False
    cta_result: str = ""
    large_vessel_occlusion: bool = False
    tpa_given: bool = False
    tpa_dose: Optional[Dict[str, float]] = None
    tpa_time: Optional[datetime] = None
    thrombectomy_performed: bool = False
    pathway_steps: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    alerts: List[str] = field(default_factory=list)
    time_metrics: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "stroke_type": self.stroke_type.value,
            "last_known_well": self.last_known_well.isoformat() if self.last_known_well else None,
            "arrival_time": self.arrival_time.isoformat() if self.arrival_time else None,
            "onset_to_arrival_minutes": self.onset_to_arrival_minutes,
            "nihss_score": self.nihss_score,
            "nihss_items": [i.to_dict() for i in self.nihss_items],
            "tpa_eligibility": self.tpa_eligibility.value,
            "tpa_contraindications": [c.to_dict() for c in self.tpa_contraindications],
            "thrombectomy_eligibility": self.thrombectomy_eligibility.value,
            "ct_completed": self.ct_completed,
            "ct_result": self.ct_result,
            "cta_completed": self.cta_completed,
            "cta_result": self.cta_result,
            "large_vessel_occlusion": self.large_vessel_occlusion,
            "tpa_given": self.tpa_given,
            "tpa_dose": self.tpa_dose,
            "tpa_time": self.tpa_time.isoformat() if self.tpa_time else None,
            "thrombectomy_performed": self.thrombectomy_performed,
            "pathway_steps": self.pathway_steps,
            "recommendations": self.recommendations,
            "alerts": self.alerts,
            "time_metrics": self.time_metrics,
        }


class StrokePathway:
    """
    Stroke Clinical Pathway Manager.
    
    Features:
    - NIHSS calculation
    - tPA eligibility assessment
    - Thrombectomy eligibility
    - Time tracking
    """

    # Absolute tPA Contraindications
    ABSOLUTE_CONTRAINDICATIONS = [
        ("current_ich_history", "Current intracranial hemorrhage or history of ICH"),
        ("recent_major_surgery", "Major surgery or serious trauma within 14 days"),
        ("recent_head_trauma", "Head trauma within 3 months"),
        ("prior_stroke_3mo", "Previous stroke within 3 months"),
        ("gi_bleed_21d", "GI bleed within 21 days"),
        ("active_internal_bleeding", "Active internal bleeding"),
        ("coagulopathy", "Coagulopathy (INR > 1.7, aPTT elevated, platelets < 100K)"),
        ("current_anticoagulation", "Current anticoagulation with NOAC within 48h or warfarin INR > 1.7"),
        ("aortic_dissection", "Known or suspected aortic dissection"),
        ("sah", "Symptoms suggestive of subarachnoid hemorrhage"),
        ("bp_severe", "Blood pressure > 185/110 despite treatment"),
        ("glucose_extreme", "Blood glucose < 50 or > 400 mg/dL"),
        ("ct_hemorrhage", "CT evidence of intracranial hemorrhage"),
    ]

    # Relative tPA Contraindications (weigh risk/benefit)
    RELATIVE_CONTRAINDICATIONS = [
        ("seizure_onset", "Seizure at stroke onset (if postictal state could mimic stroke)"),
        ("major_surgery_14d", "Major surgery within 14 days (relative - can treat if benefit > risk)"),
        ("mi_3mo", "Myocardial infarction within 3 months"),
        ("pregnancy", "Pregnancy or within 14 days postpartum"),
        ("arterial_puncture", "Arterial puncture at noncompressible site within 7 days"),
        ("lumbar_puncture", "Lumbar puncture within 7 days"),
        ("rapid_improvement", "Rapidly improving or minor symptoms"),
        ("blood_pressure_high", "Blood pressure > 185/110 (treat to lower before tPA)"),
    ]

    # Time windows
    TPA_STANDARD_WINDOW_HOURS = 4.5
    TPA_EXTENDED_WINDOW_HOURS = 9.0  # With perfusion imaging
    THROMBECTOMY_STANDARD_WINDOW_HOURS = 6.0
    THROMBECTOMY_EXTENDED_WINDOW_HOURS = 24.0  # DAWN/DEFUSE-3 criteria

    # NIHSS Items
    NIHSS_ITEMS = [
        (1, "Level of Consciousness", 3),
        (2, "LOC Questions", 2),
        (3, "LOC Commands", 2),
        (4, "Best Gaze", 2),
        (5, "Visual", 3),
        (6, "Facial Palsy", 3),
        (7, "Motor Arm Left", 4),
        (8, "Motor Arm Right", 4),
        (9, "Motor Leg Left", 4),
        (10, "Motor Leg Right", 4),
        (11, "Limb Ataxia", 2),
        (12, "Sensory", 2),
        (13, "Best Language", 3),
        (14, "Dysarthria", 2),
        (15, "Extinction/Inattention", 2),
    ]

    def assess(
        self,
        patient_id: Optional[str] = None,
        last_known_well: Optional[datetime] = None,
        arrival_time: Optional[datetime] = None,
        nihss_scores: Optional[Dict[int, int]] = None,
        ct_result: str = "",
        cta_result: str = "",
        large_vessel_occlusion: bool = False,
        contraindications: Optional[Dict[str, bool]] = None,
        blood_pressure: Optional[tuple] = None,
        glucose: Optional[float] = None,
        inr: Optional[float] = None,
        platelets: Optional[float] = None,
        weight_kg: Optional[float] = None,
    ) -> StrokeAssessment:
        """
        Assess stroke patient for tPA and thrombectomy eligibility.
        
        Args:
            patient_id: Patient identifier
            last_known_well: Time patient was last known to be at baseline
            arrival_time: Time of ED arrival
            nihss_scores: Dict mapping NIHSS item number to score
            ct_result: Result of non-contrast CT
            cta_result: Result of CTA
            large_vessel_occlusion: Whether LVO is present
            contraindications: Dict of contraindication names to presence
            blood_pressure: Tuple of (systolic, diastolic) BP
            glucose: Blood glucose in mg/dL
            inr: INR value
            platelets: Platelet count
            weight_kg: Patient weight in kg
        
        Returns:
            StrokeAssessment with complete evaluation
        """
        arrival_time = arrival_time or datetime.utcnow()
        contraindications = contraindications or {}

        # Calculate onset to arrival time
        onset_to_arrival = None
        if last_known_well and arrival_time:
            delta = arrival_time - last_known_well
            onset_to_arrival = delta.total_seconds() / 60

        # Determine stroke type
        stroke_type = self._determine_stroke_type(ct_result)

        # Calculate NIHSS
        nihss_score, nihss_items = self._calculate_nihss(nihss_scores or {})

        # Assess tPA eligibility
        tpa_eligibility, tpa_contras = self._assess_tpa_eligibility(
            last_known_well,
            arrival_time,
            contraindications,
            blood_pressure,
            glucose,
            inr,
            platelets,
            ct_result,
        )

        # Assess thrombectomy eligibility
        thrombectomy_elig = self._assess_thrombectomy_eligibility(
            last_known_well,
            arrival_time,
            large_vessel_occlusion,
            nihss_score,
        )

        # Generate pathway steps
        pathway_steps = self._generate_pathway_steps(
            stroke_type,
            tpa_eligibility,
            thrombectomy_elig,
            onset_to_arrival,
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            stroke_type,
            tpa_eligibility,
            thrombectomy_elig,
            nihss_score,
            onset_to_arrival,
            weight_kg,
        )

        # Generate alerts
        alerts = self._generate_alerts(
            stroke_type,
            tpa_eligibility,
            onset_to_arrival,
            blood_pressure,
            glucose,
        )

        # Calculate tPA dose if eligible
        tpa_dose = None
        if tpa_eligibility in [tPAEligibility.ELIGIBLE, tPAEligibility.ELIGIBLE_WITH_WARNINGS]:
            if weight_kg:
                tpa_dose = self._calculate_tpa_dose(weight_kg)

        return StrokeAssessment(
            patient_id=patient_id,
            stroke_type=stroke_type,
            last_known_well=last_known_well,
            arrival_time=arrival_time,
            onset_to_arrival_minutes=onset_to_arrival,
            nihss_score=nihss_score,
            nihss_items=nihss_items,
            tpa_eligibility=tpa_eligibility,
            tpa_contraindications=tpa_contras,
            thrombectomy_eligibility=thrombectomy_elig,
            ct_completed=bool(ct_result),
            ct_result=ct_result,
            cta_completed=bool(cta_result),
            cta_result=cta_result,
            large_vessel_occlusion=large_vessel_occlusion,
            tpa_dose=tpa_dose,
            pathway_steps=pathway_steps,
            recommendations=recommendations,
            alerts=alerts,
        )

    def _determine_stroke_type(self, ct_result: str) -> StrokeType:
        """Determine stroke type from CT result."""
        ct_lower = ct_result.lower() if ct_result else ""

        if "hemorrhage" in ct_lower or "blood" in ct_lower or "ich" in ct_lower:
            return StrokeType.HEMORRHAGIC
        elif "subarachnoid" in ct_lower:
            return StrokeType.SUBARACHNOID
        elif "normal" in ct_lower or "no acute" in ct_lower:
            return StrokeType.ISCHEMIC  # Early ischemic stroke may not show on CT
        elif "ischemia" in ct_lower or "hypodensity" in ct_lower or "mca sign" in ct_lower:
            return StrokeType.ISCHEMIC
        else:
            return StrokeType.UNKNOWN

    def _calculate_nihss(
        self,
        scores: Dict[int, int],
    ) -> tuple:
        """Calculate NIHSS from item scores."""
        nihss_items = []
        total_score = 0

        for item_num, item_name, max_score in self.NIHSS_ITEMS:
            score = min(scores.get(item_num, 0), max_score)
            total_score += score

            nihss_items.append(NIHSSItem(
                item_name=item_name,
                item_number=item_num,
                score=score,
                max_score=max_score,
                description=self._get_nihss_description(item_num, score),
            ))

        return total_score, nihss_items

    def _get_nihss_description(self, item_num: int, score: int) -> str:
        """Get description for NIHSS score."""
        descriptions = {
            1: {0: "Alert", 1: "Drowsy", 2: "Stuporous", 3: "Coma"},
            2: {0: "Answers both correctly", 1: "Answers one correctly", 2: "Answers neither correctly"},
            3: {0: "Performs both tasks", 1: "Performs one task", 2: "Performs neither"},
            4: {0: "Normal", 1: "Partial gaze palsy", 2: "Forced deviation"},
            5: {0: "No visual loss", 1: "Partial hemianopia", 2: "Complete hemianopia", 3: "Bilateral hemianopia"},
            6: {0: "Normal", 1: "Minor paralysis", 2: "Partial paralysis", 3: "Complete paralysis"},
            7: {0: "No drift", 1: "Drift", 2: "Some effort vs gravity", 3: "No effort vs gravity", 4: "No movement"},
            8: {0: "No drift", 1: "Drift", 2: "Some effort vs gravity", 3: "No effort vs gravity", 4: "No movement"},
            9: {0: "No drift", 1: "Drift", 2: "Some effort vs gravity", 3: "No effort vs gravity", 4: "No movement"},
            10: {0: "No drift", 1: "Drift", 2: "Some effort vs gravity", 3: "No effort vs gravity", 4: "No movement"},
            11: {0: "Absent", 1: "Present in one limb", 2: "Present in two limbs"},
            12: {0: "Normal", 1: "Partial loss", 2: "Severe loss"},
            13: {0: "Normal", 1: "Mild aphasia", 2: "Severe aphasia", 3: "Mute/global aphasia"},
            14: {0: "Normal", 1: "Mild-moderate dysarthria", 2: "Severe dysarthria"},
            15: {0: "Normal", 1: "Partial inattention", 2: "Complete inattention"},
        }
        return descriptions.get(item_num, {}).get(score, "")

    def _assess_tpa_eligibility(
        self,
        last_known_well: Optional[datetime],
        arrival_time: datetime,
        contraindications: Dict[str, bool],
        blood_pressure: Optional[tuple],
        glucose: Optional[float],
        inr: Optional[float],
        platelets: Optional[float],
        ct_result: str,
    ) -> tuple:
        """Assess tPA eligibility."""
        tpa_contras = []

        # Check time window
        time_since_onset = None
        if last_known_well:
            time_since_onset = (arrival_time - last_known_well).total_seconds() / 3600

        if time_since_onset is None or time_since_onset > self.TPA_STANDARD_WINDOW_HOURS:
            # Extended window requires perfusion imaging
            if time_since_onset and time_since_onset > self.TPA_EXTENDED_WINDOW_HOURS:
                tpa_contras.append(tPAContraindication(
                    criterion="Time window exceeded",
                    is_present=True,
                    is_absolute=True,
                    notes=f"Onset > {self.TPA_EXTENDED_WINDOW_HOURS} hours ago ({time_since_onset:.1f}h)",
                ))
                return tPAEligibility.WINDOW_EXCEEDED, tpa_contras

        # Check absolute contraindications
        has_absolute = False
        has_relative = False

        for key, description in self.ABSOLUTE_CONTRAINDICATIONS:
            is_present = contraindications.get(key, False)
            tpa_contras.append(tPAContraindication(
                criterion=description,
                is_present=is_present,
                is_absolute=True,
            ))
            if is_present:
                has_absolute = True

        # Check relative contraindications
        for key, description in self.RELATIVE_CONTRAINDICATIONS:
            is_present = contraindications.get(key, False)
            tpa_contras.append(tPAContraindication(
                criterion=description,
                is_present=is_present,
                is_absolute=False,
            ))
            if is_present:
                has_relative = True

        # Check lab values
        if inr and inr > 1.7:
            tpa_contras.append(tPAContraindication(
                criterion="INR > 1.7",
                is_present=True,
                is_absolute=True,
                notes=f"INR = {inr}",
            ))
            has_absolute = True

        if platelets and platelets < 100000:
            tpa_contras.append(tPAContraindication(
                criterion="Platelets < 100,000",
                is_present=True,
                is_absolute=True,
                notes=f"Platelets = {platelets}",
            ))
            has_absolute = True

        if glucose and (glucose < 50 or glucose > 400):
            tpa_contras.append(tPAContraindication(
                criterion="Glucose out of range",
                is_present=True,
                is_absolute=True,
                notes=f"Glucose = {glucose} mg/dL",
            ))
            has_absolute = True

        # Check blood pressure
        if blood_pressure:
            sbp, dbp = blood_pressure
            if sbp > 185 or dbp > 110:
                tpa_contras.append(tPAContraindication(
                    criterion="BP > 185/110",
                    is_present=True,
                    is_absolute=True,
                    notes=f"BP = {sbp}/{dbp} - Treat to lower before tPA",
                ))
                # This can be treated, so it's not absolute
                has_relative = True

        # Determine eligibility
        if has_absolute:
            return tPAEligibility.INELIGIBLE_ABSOLUTE, tpa_contras
        elif has_relative:
            return tPAEligibility.ELIGIBLE_WITH_WARNINGS, tpa_contras
        else:
            return tPAEligibility.ELIGIBLE, tpa_contras

    def _assess_thrombectomy_eligibility(
        self,
        last_known_well: Optional[datetime],
        arrival_time: datetime,
        lvo: bool,
        nihss_score: int,
    ) -> ThrombectomyEligibility:
        """Assess mechanical thrombectomy eligibility."""
        if not lvo:
            return ThrombectomyEligibility.INELIGIBLE

        # Need imaging confirmation
        if last_known_well is None:
            return ThrombectomyEligibility.NEEDS_IMAGING

        time_since_onset = (arrival_time - last_known_well).total_seconds() / 3600

        # Standard window
        if time_since_onset <= self.THROMBECTOMY_STANDARD_WINDOW_HOURS:
            return ThrombectomyEligibility.ELIGIBLE
        # Extended window (DAWN/DEFUSE-3 criteria)
        elif time_since_onset <= self.THROMBECTOMY_EXTENDED_WINDOW_HOURS:
            return ThrombectomyEligibility.WINDOW_EXTENDED
        else:
            return ThrombectomyEligibility.INELIGIBLE

    def _calculate_tpa_dose(self, weight_kg: float) -> Dict[str, float]:
        """Calculate tPA (alteplase) dose."""
        total_dose_mg = weight_kg * 0.9  # 0.9 mg/kg
        max_dose_mg = 90  # Maximum 90 mg

        if total_dose_mg > max_dose_mg:
            total_dose_mg = max_dose_mg

        bolus_mg = total_dose_mg * 0.1  # 10% as bolus
        infusion_mg = total_dose_mg * 0.9  # 90% over 60 minutes

        return {
            "weight_kg": weight_kg,
            "total_dose_mg": round(total_dose_mg, 1),
            "bolus_10_percent_mg": round(bolus_mg, 1),
            "infusion_90_percent_mg": round(infusion_mg, 1),
            "infusion_duration_minutes": 60,
            "max_dose_applied": weight_kg > 100,
        }

    def _generate_pathway_steps(
        self,
        stroke_type: StrokeType,
        tpa_eligibility: tPAEligibility,
        thrombectomy_eligibility: ThrombectomyEligibility,
        onset_to_arrival: Optional[float],
    ) -> List[Dict[str, Any]]:
        """Generate pathway steps."""
        steps = []

        # Step 1: Recognition
        steps.append({
            "step": 1,
            "name": "Stroke Recognition",
            "actions": [
                "FAST screening (Face, Arm, Speech, Time)",
                "BE-FAST adds Balance, Eyes",
                "Activate stroke team",
            ],
            "time_target": "< 10 minutes from arrival",
        })

        # Step 2: Initial Assessment
        steps.append({
            "step": 2,
            "name": "Initial Assessment",
            "actions": [
                "Vital signs including glucose",
                "NIH Stroke Scale assessment",
                "Establish IV access",
                "Obtain labs (CBC, CMP, coagulation studies)",
                "Point of care glucose check",
            ],
            "time_target": "< 15 minutes from arrival",
        })

        # Step 3: Imaging
        steps.append({
            "step": 3,
            "name": "Neuroimaging",
            "actions": [
                "Non-contrast CT head (stat)",
                "CTA head and neck if candidate for thrombectomy",
                "CT perfusion if extended window candidate",
                "Radiologist notification for immediate read",
            ],
            "time_target": "CT < 25 min, Read < 45 min",
        })

        # Step 4: tPA Decision
        if stroke_type == StrokeType.ISCHEMIC:
            if tpa_eligibility == tPAEligibility.ELIGIBLE:
                steps.append({
                    "step": 4,
                    "name": "tPA Administration",
                    "actions": [
                        "🚨 tPA ELIGIBLE - Obtain consent",
                        "Administer alteplase 0.9 mg/kg (max 90mg)",
                        "10% bolus IV push over 1 minute",
                        "90% infusion over 60 minutes",
                        "Strict BP control < 185/110 before, < 180/105 after",
                        "No anticoagulation for 24 hours",
                    ],
                    "time_target": "Door-to-needle < 60 minutes",
                })
            elif tpa_eligibility == tPAEligibility.ELIGIBLE_WITH_WARNINGS:
                steps.append({
                    "step": 4,
                    "name": "tPA Decision (with warnings)",
                    "actions": [
                        "⚠️ tPA has relative contraindications",
                        "Risk-benefit discussion with patient/family",
                        "Document decision-making process",
                        "If proceeding: treat BP, then administer",
                    ],
                    "time_target": "Urgent decision needed",
                })

        # Step 5: Thrombectomy Decision
        if thrombectomy_eligibility in [ThrombectomyEligibility.ELIGIBLE, ThrombectomyEligibility.WINDOW_EXTENDED]:
            steps.append({
                "step": 5,
                "name": "Mechanical Thrombectomy",
                "actions": [
                    "🚨 LVO DETECTED - Candidate for thrombectomy",
                    "Activate neurointerventional team",
                    "Transfer to cath lab",
                    "Can be done in parallel with or after tPA",
                ],
                "time_target": "Door-to-puncture < 90 minutes",
            })

        # Step 6: Admission
        steps.append({
            "step": 6,
            "name": "Post-Acute Care",
            "actions": [
                "Admit to Stroke Unit or ICU",
                "Continuous neurologic monitoring",
                "BP management per protocol",
                "DVT prophylaxis",
                "Dysphagia screening before oral intake",
                "Secondary stroke prevention planning",
            ],
            "time_target": "Within hours of ED management",
        })

        return steps

    def _generate_recommendations(
        self,
        stroke_type: StrokeType,
        tpa_eligibility: tPAEligibility,
        thrombectomy_eligibility: ThrombectomyEligibility,
        nihss_score: int,
        onset_to_arrival: Optional[float],
        weight_kg: Optional[float],
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        # Stroke type specific
        if stroke_type == StrokeType.HEMORRHAGIC:
            recommendations.append("🚨 HEMORRHAGIC STROKE - tPA CONTRAINDICATED")
            recommendations.append("• Reverse anticoagulation if applicable")
            recommendations.append("• BP control (SBP target 140-160 mmHg)")
            recommendations.append("• Neurosurgery consultation")
            recommendations.append("• ICH score calculation")
            return recommendations

        # Ischemic stroke
        recommendations.append(f"ISCHEMIC STROKE - NIHSS Score: {nihss_score}/42")

        if nihss_score >= 10:
            recommendations.append("  • Severe stroke - high likelihood of LVO")

        # tPA recommendations
        if tpa_eligibility == tPAEligibility.ELIGIBLE:
            recommendations.append("")
            recommendations.append("✅ tPA ELIGIBLE")
            if weight_kg:
                dose = self._calculate_tpa_dose(weight_kg)
                recommendations.append(f"  • Dose: {dose['total_dose_mg']} mg total")
                recommendations.append(f"  • Bolus: {dose['bolus_10_percent_mg']} mg IV push")
                recommendations.append(f"  • Infusion: {dose['infusion_90_percent_mg']} mg over 60 min")
            recommendations.append("  • Target: Door-to-needle < 60 minutes")

        elif tpa_eligibility == tPAEligibility.WINDOW_EXCEEDED:
            recommendations.append("")
            recommendations.append("⏰ tPA window exceeded")
            recommendations.append("  • Consider extended window protocol with perfusion imaging")
            recommendations.append("  • Evaluate for thrombectomy if LVO present")

        elif tpa_eligibility == tPAEligibility.INELIGIBLE_ABSOLUTE:
            recommendations.append("")
            recommendations.append("❌ tPA INELIGIBLE - Absolute contraindication(s) present")

        # Thrombectomy recommendations
        if thrombectomy_eligibility == ThrombectomyEligibility.ELIGIBLE:
            recommendations.append("")
            recommendations.append("✅ THROMBECTOMY CANDIDATE")
            recommendations.append("  • LVO present in accessible vessel")
            recommendations.append("  • Target: Door-to-puncture < 90 minutes")

        elif thrombectomy_eligibility == ThrombectomyEligibility.WINDOW_EXTENDED:
            recommendations.append("")
            recommendations.append("⏰ EXTENDED WINDOW THROMBECTOMY")
            recommendations.append("  • CTP/MRP needed to assess tissue viability")
            recommendations.append("  • DAWN/DEFUSE-3 criteria apply")

        # General stroke management
        recommendations.append("")
        recommendations.append("=== STROKE CARE ===")
        recommendations.append("• Admit to stroke unit or ICU")
        recommendations.append("• Frequent neuro checks (q1h initially)")
        recommendations.append("• Maintain euglycemia")
        recommendations.append("• DVT prophylaxis")
        recommendations.append("• Swallow screen before oral intake")
        recommendations.append("• Early mobilization when stable")

        return recommendations

    def _generate_alerts(
        self,
        stroke_type: StrokeType,
        tpa_eligibility: tPAEligibility,
        onset_to_arrival: Optional[float],
        blood_pressure: Optional[tuple],
        glucose: Optional[float],
    ) -> List[str]:
        """Generate clinical alerts."""
        alerts = []

        if stroke_type == StrokeType.HEMORRHAGIC:
            alerts.append("🚨 HEMORRHAGIC STROKE - Do NOT give tPA")

        if tpa_eligibility == tPAEligibility.ELIGIBLE:
            if onset_to_arrival and onset_to_arrival > 180:
                alerts.append("⚠️ Time-critical: > 3 hours since onset - expedite decision")

        if blood_pressure:
            sbp, dbp = blood_pressure
            if sbp > 185 or dbp > 110:
                alerts.append(f"⚠️ BP {sbp}/{dbp} - Treat to < 185/110 before tPA")

        if glucose:
            if glucose < 50:
                alerts.append(f"⚠️ HYPOGLYCEMIA {glucose} mg/dL - Treat before tPA")
            elif glucose > 400:
                alerts.append(f"⚠️ HYPERGLYCEMIA {glucose} mg/dL - tPA contraindicated")

        return alerts


# Singleton
_stroke_pathway: Optional[StrokePathway] = None


def get_stroke_pathway() -> StrokePathway:
    """Get stroke pathway singleton."""
    global _stroke_pathway
    if _stroke_pathway is None:
        _stroke_pathway = StrokePathway()
    return _stroke_pathway
