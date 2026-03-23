"""
Chest Pain Clinical Pathway
===========================

Evidence-based pathway for evaluation and management of patients
presenting with chest pain in the emergency department.

Based on:
- AHA/ACC Guidelines for Chest Pain Evaluation
- HEART Pathway (Mahler et al., 2015)
- American Heart Association Guidelines

Pathway Steps:
1. Initial Assessment (ABC, vitals, ECG within 10 min)
2. Risk Stratification (HEART Score)
3. Troponin Testing (serial if needed)
4. Imaging Decisions
5. Disposition
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timedelta


class ChestPainType(str, Enum):
    """Types of chest pain presentations."""
    TYPICAL_ANGINA = "typical_angina"
    ATYPICAL_ANGINA = "atypical_angina"
    NON_CARDIAC = "non_cardiac"
    UNDETERMINED = "undetermined"


class ECGFinding(str, Enum):
    """ECG findings in chest pain."""
    NORMAL = "normal"
    ST_ELEVATION = "st_elevation"  # STEMI criteria
    ST_DEPRESSION = "st_depression"
    T_WAVE_INVERSION = "t_wave_inversion"
    LBBB_NEW = "lbbb_new"
    LBBB_OLD = "lbbb_old"
    LVH = "lvh"
    NONSPECIFIC = "nonspecific"


class RiskLevel(str, Enum):
    """Risk stratification levels."""
    LOW = "low"
    INTERMEDIATE = "intermediate"
    HIGH = "high"
    STEMI = "stemi"


@dataclass
class PathwayStep:
    """A step in the clinical pathway."""
    step_number: int
    name: str
    description: str
    actions: List[str]
    time_target: Optional[str] = None
    completed: bool = False
    timestamp: Optional[datetime] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_number": self.step_number,
            "name": self.name,
            "description": self.description,
            "actions": self.actions,
            "time_target": self.time_target,
            "completed": self.completed,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "notes": self.notes,
        }


@dataclass
class ChestPainAssessment:
    """Complete chest pain pathway assessment."""
    patient_id: Optional[str] = None
    chief_complaint: str = "chest_pain"
    pain_type: ChestPainType = ChestPainType.UNDETERMINED
    ecg_finding: ECGFinding = ECGFinding.NORMAL
    ecg_time: Optional[datetime] = None
    heart_score: int = 0
    risk_level: RiskLevel = RiskLevel.INTERMEDIATE
    troponin_0h: Optional[float] = None
    troponin_3h: Optional[float] = None
    troponin_6h: Optional[float] = None
    delta_troponin: Optional[float] = None
    pathway_steps: List[PathwayStep] = field(default_factory=list)
    disposition: str = ""
    time_to_ecg_minutes: Optional[float] = None
    time_to_disposition_minutes: Optional[float] = None
    recommendations: List[str] = field(default_factory=list)
    alerts: List[str] = field(default_factory=list)
    arrival_time: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "chief_complaint": self.chief_complaint,
            "pain_type": self.pain_type.value,
            "ecg_finding": self.ecg_finding.value,
            "ecg_time": self.ecg_time.isoformat() if self.ecg_time else None,
            "heart_score": self.heart_score,
            "risk_level": self.risk_level.value,
            "troponin_0h": self.troponin_0h,
            "troponin_3h": self.troponin_3h,
            "troponin_6h": self.troponin_6h,
            "delta_troponin": self.delta_troponin,
            "pathway_steps": [s.to_dict() for s in self.pathway_steps],
            "disposition": self.disposition,
            "time_to_ecg_minutes": self.time_to_ecg_minutes,
            "time_to_disposition_minutes": self.time_to_disposition_minutes,
            "recommendations": self.recommendations,
            "alerts": self.alerts,
            "arrival_time": self.arrival_time.isoformat(),
        }


class ChestPainPathway:
    """
    Chest Pain Clinical Pathway Manager.
    
    Provides step-by-step guidance for chest pain evaluation
    based on current guidelines.
    """

    # STEMI Criteria (ECG)
    STEMI_CRITERIA = {
        "st_elevation_thresholds": {
            "all_leads_except_v2_v3": 1,  # ≥1mm in ≥2 contiguous leads
            "v2_v3_men_over_40": 2,  # ≥2mm
            "v2_v3_men_under_40": 2.5,  # ≥2.5mm
            "v2_v3_women": 1.5,  # ≥1.5mm
        },
        "new_lbbb": True,
        "posterior_mi": "ST depression V1-V3 with tall R waves",
    }

    # Time Targets (minutes from arrival)
    TIME_TARGETS = {
        "ecg": 10,
        "ecg_interpretation": 10,
        "activation_cath_lab": 60,  # Door-to-balloon
        "fibrinolysis": 30,  # Door-to-needle
    }

    def assess(
        self,
        patient_id: Optional[str] = None,
        pain_characteristics: Optional[Dict[str, Any]] = None,
        ecg_finding: str = "normal",
        heart_score: int = 0,
        troponin_0h: Optional[float] = None,
        troponin_3h: Optional[float] = None,
        vital_signs: Optional[Dict[str, float]] = None,
        arrival_time: Optional[datetime] = None,
    ) -> ChestPainAssessment:
        """
        Assess chest pain patient and generate pathway.
        
        Args:
            patient_id: Patient identifier
            pain_characteristics: Dict with pain details (location, quality, radiation, etc.)
            ecg_finding: Initial ECG finding
            heart_score: Calculated HEART score
            troponin_0h: Initial troponin (ng/mL)
            troponin_3h: 3-hour troponin (ng/mL)
            vital_signs: Vital signs dictionary
            arrival_time: Time of ED arrival
        
        Returns:
            ChestPainAssessment with pathway steps and recommendations
        """
        arrival_time = arrival_time or datetime.utcnow()
        pain_characteristics = pain_characteristics or {}

        # Determine pain type
        pain_type = self._classify_pain_type(pain_characteristics)

        # Parse ECG finding
        try:
            ecg_enum = ECGFinding(ecg_finding.lower())
        except ValueError:
            ecg_enum = ECGFinding.NORMAL

        # Determine risk level
        risk_level = self._determine_risk_level(ecg_enum, heart_score, troponin_0h)

        # Generate pathway steps
        pathway_steps = self._generate_pathway_steps(
            ecg_enum, risk_level, troponin_0h, troponin_3h, arrival_time
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            ecg_enum, risk_level, heart_score, troponin_0h, troponin_3h
        )

        # Generate alerts
        alerts = self._generate_alerts(ecg_enum, risk_level, vital_signs, troponin_0h)

        # Determine disposition
        disposition = self._determine_disposition(risk_level, heart_score, troponin_0h, troponin_3h)

        # Calculate time metrics
        time_to_ecg = None
        if arrival_time:
            time_to_ecg = 0  # Would calculate from actual ECG time

        return ChestPainAssessment(
            patient_id=patient_id,
            pain_type=pain_type,
            ecg_finding=ecg_enum,
            heart_score=heart_score,
            risk_level=risk_level,
            troponin_0h=troponin_0h,
            troponin_3h=troponin_3h,
            pathway_steps=pathway_steps,
            recommendations=recommendations,
            alerts=alerts,
            disposition=disposition,
            arrival_time=arrival_time,
        )

    def _classify_pain_type(self, characteristics: Dict[str, Any]) -> ChestPainType:
        """Classify chest pain type based on characteristics."""
        quality = characteristics.get("quality", "").lower()
        location = characteristics.get("location", "").lower()
        radiation = characteristics.get("radiation", "").lower()
        associated_symptoms = characteristics.get("associated_symptoms", [])
        exacerbating = characteristics.get("exacerbating", "").lower()
        relieving = characteristics.get("relieving", "").lower()

        # Typical angina criteria
        is_substernal = "substernal" in location or "central" in location or "retrosternal" in location
        is_pressure = any(q in quality for q in ["pressure", "tightness", "squeezing", "heaviness", "crushing"])
        radiates = any(r in radiation for r in ["arm", "jaw", "neck", "shoulder", "back"])
        exertional = "exertion" in exacerbating or "exercise" in exacerbating
        relieved_by_rest = "rest" in relieving or "nitroglycerin" in relieving or "nitro" in relieving

        typical_features = sum([is_substernal, is_pressure, radiates, exertional, relieved_by_rest])

        if typical_features >= 3:
            return ChestPainType.TYPICAL_ANGINA
        elif typical_features >= 1:
            return ChestPainType.ATYPICAL_ANGINA
        elif "pleuritic" in quality or "sharp" in quality or "positional" in characteristics:
            return ChestPainType.NON_CARDIAC
        else:
            return ChestPainType.UNDETERMINED

    def _determine_risk_level(
        self,
        ecg: ECGFinding,
        heart_score: int,
        troponin: Optional[float],
    ) -> RiskLevel:
        """Determine overall risk level."""
        # STEMI trumps everything
        if ecg == ECGFinding.ST_ELEVATION:
            return RiskLevel.STEMI

        # High-risk features
        high_risk_ecg = ecg in [ECGFinding.ST_DEPRESSION, ECGFinding.LBBB_NEW, ECGFinding.T_WAVE_INVERSION]
        if high_risk_ecg or heart_score >= 7 or (troponin and troponin > 0.1):
            return RiskLevel.HIGH

        # Intermediate risk
        if heart_score >= 4 or heart_score <= 6 or ecg == ECGFinding.NONSPECIFIC:
            return RiskLevel.INTERMEDIATE

        # Low risk
        return RiskLevel.LOW

    def _generate_pathway_steps(
        self,
        ecg: ECGFinding,
        risk_level: RiskLevel,
        troponin_0h: Optional[float],
        troponin_3h: Optional[float],
        arrival_time: datetime,
    ) -> List[PathwayStep]:
        """Generate step-by-step pathway based on risk level."""
        steps = []

        # Step 1: Initial Assessment (All patients)
        steps.append(PathwayStep(
            step_number=1,
            name="Initial Assessment",
            description="ABCs, vital signs, IV access, continuous monitoring",
            actions=[
                "Assess airway, breathing, circulation",
                "Obtain vital signs (BP, HR, RR, SpO2, Temp)",
                "Establish IV access (2 large-bore if possible)",
                "Apply cardiac monitor",
                "Give aspirin 324mg PO (if no contraindication)",
                "Oxygen if SpO2 < 90%",
            ],
            time_target="< 10 minutes",
        ))

        # Step 2: 12-Lead ECG
        steps.append(PathwayStep(
            step_number=2,
            name="12-Lead ECG",
            description="Obtain and interpret 12-lead ECG",
            actions=[
                "Perform 12-lead ECG",
                "Compare with prior ECG if available",
                "Document interpretation in chart",
                "Time from arrival: target < 10 minutes",
            ],
            time_target="< 10 minutes from arrival",
        ))

        # Step 3: Risk Stratification
        steps.append(PathwayStep(
            step_number=3,
            name="Risk Stratification",
            description="Calculate HEART score and determine risk level",
            actions=[
                "Calculate HEART score",
                "Obtain initial troponin",
                "Consider clinical risk scores (TIMI, GRACE)",
                f"Current risk level: {risk_level.value}",
            ],
            time_target="< 30 minutes",
        ))

        # Step 4: STEMI Pathway (if applicable)
        if risk_level == RiskLevel.STEMI:
            steps.append(PathwayStep(
                step_number=4,
                name="STEMI Activation",
                description="Activate STEMI protocol",
                actions=[
                    "🚨 ACTIVATE CATH LAB IMMEDIATELY",
                    "Notify interventional cardiology",
                    "Obtain consent for cardiac catheterization",
                    "Dual antiplatelet therapy (P2Y12 inhibitor + aspirin)",
                    "Consider anticoagulation (heparin/enoxaparin)",
                    "Avoid fibrinolysis if cath lab available < 120 min",
                    "Target: Door-to-balloon < 90 minutes",
                ],
                time_target="< 90 minutes door-to-balloon",
            ))

        # Step 5: Serial Troponins (Non-STEMI)
        if risk_level != RiskLevel.STEMI:
            steps.append(PathwayStep(
                step_number=5,
                name="Serial Troponin Testing",
                description="Serial troponin measurements per protocol",
                actions=[
                    "Initial troponin at presentation",
                    "Repeat troponin at 3 hours",
                    "If high sensitivity troponin: 0h and 3h",
                    "If conventional troponin: 0h, 3h, 6h",
                    "Calculate delta (change) between values",
                ],
                time_target="0h, 3h, ±6h",
            ))

        # Step 6: Imaging Decision
        steps.append(PathwayStep(
            step_number=6,
            name="Cardiac Imaging",
            description="Determine appropriate imaging strategy",
            actions=self._get_imaging_actions(risk_level),
            time_target="Varies by risk level",
        ))

        # Step 7: Disposition
        steps.append(PathwayStep(
            step_number=7,
            name="Disposition",
            description="Determine patient disposition",
            actions=[
                f"Recommended: {self._get_disposition_text(risk_level)}",
            ],
            time_target="Based on risk stratification completion",
        ))

        return steps

    def _get_imaging_actions(self, risk_level: RiskLevel) -> List[str]:
        """Get imaging recommendations based on risk level."""
        if risk_level == RiskLevel.STEMI:
            return [
                "Emergent coronary angiography",
                "Echocardiography (can be done post-cath)",
            ]
        elif risk_level == RiskLevel.HIGH:
            return [
                "Echocardiography for wall motion assessment",
                "Early invasive strategy - coronary angiography within 24h",
            ]
        elif risk_level == RiskLevel.INTERMEDIATE:
            return [
                "Echocardiography",
                "Consider stress testing if troponin negative",
                "Consider Coronary CTA if low-intermediate risk",
            ]
        else:  # LOW
            return [
                "Consider stress testing as outpatient",
                "Coronary CTA may be appropriate",
            ]

    def _generate_recommendations(
        self,
        ecg: ECGFinding,
        risk_level: RiskLevel,
        heart_score: int,
        troponin_0h: Optional[float],
        troponin_3h: Optional[float],
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        # STEMI recommendations
        if risk_level == RiskLevel.STEMI:
            recommendations.append("🚨 STEMI ALERT - Activate catheterization lab")
            recommendations.append("Target: Door-to-balloon < 90 minutes")
            recommendations.append("If cath lab unavailable > 120 min: consider fibrinolysis")
            recommendations.append("Aspirin 324mg + P2Y12 inhibitor (ticagrelor/prasugrel/clopidogrel)")
            recommendations.append("Anticoagulation: Heparin or Enoxaparin")

        # High-risk NSTEMI
        elif risk_level == RiskLevel.HIGH:
            recommendations.append("⚠️ HIGH RISK - Admit to CCU/ICU")
            recommendations.append("Early invasive strategy (catheterization within 24h)")
            recommendations.append("Dual antiplatelet therapy")
            recommendations.append("High-intensity statin (Atorvastatin 80mg)")
            recommendations.append("Beta-blocker if no contraindication")
            recommendations.append("ACE inhibitor/ARB if indicated")

        # Intermediate risk
        elif risk_level == RiskLevel.INTERMEDIATE:
            recommendations.append("Admit to observation for serial troponins")
            recommendations.append("Continuous cardiac monitoring")
            recommendations.append("Echocardiography")
            recommendations.append("Stress testing if troponin negative")
            recommendations.append("Consider early invasive vs conservative strategy")

        # Low risk
        else:
            recommendations.append("✓ LOW RISK - Consider discharge with follow-up")
            recommendations.append("HEART score ≤3 with normal troponins")
            recommendations.append("Outpatient stress testing within 72 hours")
            recommendations.append("Cardiology follow-up within 1 week")
            recommendations.append("Patient education on warning signs to return")

        return recommendations

    def _generate_alerts(
        self,
        ecg: ECGFinding,
        risk_level: RiskLevel,
        vital_signs: Optional[Dict[str, float]],
        troponin: Optional[float],
    ) -> List[str]:
        """Generate clinical alerts."""
        alerts = []

        if risk_level == RiskLevel.STEMI:
            alerts.append("🚨 CRITICAL: STEMI - Immediate cath lab activation required")

        if ecg == ECGFinding.LBBB_NEW:
            alerts.append("⚠️ ALERT: New LBBB - Consider STEMI equivalent")

        if ecg == ECGFinding.ST_DEPRESSION:
            alerts.append("⚠️ ALERT: ST depression - Possible NSTEMI")

        if vital_signs:
            if vital_signs.get("systolic_bp", 120) < 90:
                alerts.append("⚠️ ALERT: Hypotension - Consider cardiogenic shock")
            if vital_signs.get("heart_rate", 80) > 100:
                alerts.append("⚠️ Tachycardia present")
            if vital_signs.get("spo2", 98) < 90:
                alerts.append("⚠️ Hypoxemia - Supplemental oxygen indicated")

        if troponin and troponin > 0.5:
            alerts.append(f"⚠️ HIGH TROPONIN: {troponin} ng/mL - Likely acute coronary syndrome")

        return alerts

    def _determine_disposition(
        self,
        risk_level: RiskLevel,
        heart_score: int,
        troponin_0h: Optional[float],
        troponin_3h: Optional[float],
    ) -> str:
        """Determine patient disposition."""
        if risk_level == RiskLevel.STEMI:
            return "CATH LAB → CCU"
        elif risk_level == RiskLevel.HIGH:
            return "CCU/ICU"
        elif risk_level == RiskLevel.INTERMEDIATE:
            return "Observation Unit / Telemetry"
        else:
            # Check if can discharge
            if heart_score <= 3 and troponin_0h and troponin_0h < 0.04:
                if troponin_3h and troponin_3h < 0.04:
                    return "Discharge with outpatient follow-up"
            return "Observation for serial troponins"

    def _get_disposition_text(self, risk_level: RiskLevel) -> str:
        """Get disposition text for pathway step."""
        dispositions = {
            RiskLevel.STEMI: "CATH LAB → CCU",
            RiskLevel.HIGH: "Admit to CCU/ICU",
            RiskLevel.INTERMEDIATE: "Admit to Observation/Telemetry",
            RiskLevel.LOW: "Consider discharge with outpatient follow-up",
        }
        return dispositions.get(risk_level, "TBD")


# Singleton
_chest_pain_pathway: Optional[ChestPainPathway] = None


def get_chest_pain_pathway() -> ChestPainPathway:
    """Get chest pain pathway singleton."""
    global _chest_pain_pathway
    if _chest_pain_pathway is None:
        _chest_pain_pathway = ChestPainPathway()
    return _chest_pain_pathway
