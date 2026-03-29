"""
P1: Acute Coronary Syndrome (ACS) Clinical Pathway
===================================================

Evidence-based pathway for evaluation and management of suspected ACS.
Based on ACC/AHA Guidelines for the Management of Patients with ACS.

Components:
1. Initial assessment and risk stratification
2. TIMI and GRACE risk scoring
3. Treatment algorithm (MONA + guideline-directed therapy)
4. Disposition and follow-up

Reference:
- Amsterdam EA, et al. Circulation. 2014;130:e344-e426.
- Thygesen K, et al. Circulation. 2012;126:2020-2035.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class ACSType(str, Enum):
    """Types of Acute Coronary Syndrome."""
    STEMI = "stemi"
    NSTEACS = "nsteacs"  # NSTE-ACS (includes NSTEMI and Unstable Angina)
    UNSTABLE_ANGINA = "unstable_angina"
    NSTEMI = "nstemi"
    UNCERTAIN = "uncertain"


class RiskLevel(str, Enum):
    """Risk stratification levels."""
    LOW = "low"
    INTERMEDIATE = "intermediate"
    HIGH = "high"
    CRITICAL = "critical"


class ECGFindings(str, Enum):
    """ECG findings relevant to ACS."""
    NORMAL = "normal"
    ST_ELEVATION = "st_elevation"
    ST_DEPRESSION = "st_depression"
    T_WAVE_INVERSION = "t_wave_inversion"
    LBBB_NEW = "lbbb_new"
    LBBB_OLD = "lbbb_old"
    Q_WAVES = "q_waves"
    NON_SPECIFIC = "non_specific"


class TroponinStatus(str, Enum):
    """Troponin result status."""
    NORMAL = "normal"
    ELEVATED = "elevated"
    RISING = "rising"
    HIGHLY_ELEVATED = "highly_elevated"


@dataclass
class TIMIRiskScore:
    """TIMI Risk Score for NSTE-ACS."""
    score: int
    risk_level: RiskLevel
    components: Dict[str, bool]
    fourteen_day_mortality: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "risk_level": self.risk_level.value,
            "components": self.components,
            "fourteen_day_mortality": f"{self.fourteen_day_mortality:.1%}",
        }


@dataclass
class ACSAssessment:
    """Complete ACS pathway assessment."""
    acs_type: ACSType
    risk_level: RiskLevel
    timi_score: Optional[TIMIRiskScore]
    grace_score: Optional[int]
    ecg_findings: List[ECGFindings]
    troponin_status: TroponinStatus
    is_stemi: bool
    time_since_onset_minutes: Optional[int]
    initial_management: List[str]
    medications: List[Dict[str, Any]]
    disposition: str
    time_to_ecg_target: int  # minutes
    time_to_cath_target: Optional[int]  # minutes for STEMI
    critical_actions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "acs_type": self.acs_type.value,
            "risk_level": self.risk_level.value,
            "timi_score": self.timi_score.to_dict() if self.timi_score else None,
            "grace_score": self.grace_score,
            "ecg_findings": [e.value for e in self.ecg_findings],
            "troponin_status": self.troponin_status.value,
            "is_stemi": self.is_stemi,
            "time_since_onset_minutes": self.time_since_onset_minutes,
            "initial_management": self.initial_management,
            "medications": self.medications,
            "disposition": self.disposition,
            "time_to_ecg_target": self.time_to_ecg_target,
            "time_to_cath_target": self.time_to_cath_target,
            "critical_actions": self.critical_actions,
            "warnings": self.warnings,
            "timestamp": datetime.utcnow().isoformat(),
        }


class ACSPathway:
    """
    Acute Coronary Syndrome Clinical Pathway.

    Usage:
        pathway = ACSPathway()
        assessment = pathway.assess(
            chest_pain_onset=datetime.now() - timedelta(hours=2),
            ecg_findings=["st_elevation"],
            troponin_result="elevated",
            age=65,
            risk_factors=["diabetes", "hypertension"],
        )
    """

    # TIMI Risk Score 14-day mortality rates
    TIMI_MORTALITY = {
        0: 0.012,
        1: 0.021,
        2: 0.041,
        3: 0.073,
        4: 0.116,
        5: 0.178,
        6: 0.263,
        7: 0.359,
    }

    # Critical time targets
    DOOR_TO_ECG_TARGET = 10  # minutes
    DOOR_TO_BALLOON_TARGET = 90  # minutes (PCI)
    DOOR_TO_NEEDLE_TARGET = 30  # minutes (fibrinolysis if no PCI)
    FIBRINOLYSIS_WINDOW = 120  # minutes from symptom onset

    def assess(
        self,
        chest_pain_onset: Optional[datetime] = None,
        current_time: Optional[datetime] = None,
        ecg_findings: List[str] = None,
        troponin_result: str = "normal",
        troponin_delta: Optional[float] = None,  # Change between values
        age: int = 50,
        gender: str = "male",
        heart_rate: int = 80,
        systolic_bp: int = 120,
        killip_class: int = 1,
        risk_factors: List[str] = None,
        prior_aspirin_use: bool = False,
        prior_cardiac_history: bool = False,
        coronary_stenosis_known: bool = False,
        st_deviation_mm: float = 0,
        symptoms_resolved: bool = False,
        contraindications_anticoagulation: bool = False,
        contraindications_fibrinolysis: bool = False,
        pci_capable_center: bool = True,
    ) -> ACSAssessment:
        """
        Assess patient with suspected ACS.

        Args:
            chest_pain_onset: Time of symptom onset
            current_time: Current time (for time calculations)
            ecg_findings: List of ECG findings
            troponin_result: Troponin result status
            troponin_delta: Change in troponin between serial values
            age: Patient age
            gender: Patient gender
            heart_rate: Heart rate in bpm
            systolic_bp: Systolic blood pressure
            killip_class: Killip classification (1-4)
            risk_factors: List of cardiac risk factors
            prior_aspirin_use: Prior aspirin use in last 7 days
            prior_cardiac_history: Prior MI, CABG, or CAD
            coronary_stenosis_known: Known coronary stenosis ≥50%
            st_deviation_mm: ST deviation in mm
            symptoms_resolved: Whether chest pain has resolved
            contraindications_anticoagulation: Contraindications to anticoagulation
            contraindications_fibrinolysis: Contraindications to fibrinolysis
            pci_capable_center: Whether at PCI-capable center

        Returns:
            ACSAssessment with complete pathway guidance
        """
        current_time = current_time or datetime.utcnow()
        ecg_findings = ecg_findings or []
        risk_factors = risk_factors or []

        # Calculate time since onset
        time_since_onset = None
        if chest_pain_onset:
            time_since_onset = (current_time - chest_pain_onset).total_seconds() / 60

        # Parse ECG findings
        parsed_ecg = self._parse_ecg_findings(ecg_findings)

        # Parse troponin status
        troponin_status = self._parse_troponin_status(troponin_result, troponin_delta)

        # Determine ACS type
        acs_type = self._determine_acs_type(
            parsed_ecg,
            troponin_status,
            symptoms_resolved,
            st_deviation_mm,
        )

        # Calculate TIMI score
        timi_score = self._calculate_timi_score(
            age=age,
            risk_factors=risk_factors,
            prior_aspirin=prior_aspirin_use,
            prior_cardiac=prior_cardiac_history,
            st_deviation=st_deviation_mm > 0.5,
            troponin_elevated=troponin_status in [TroponinStatus.ELEVATED, TroponinStatus.RISING, TroponinStatus.HIGHLY_ELEVATED],
            coronary_stenosis=coronary_stenosis_known,
        )

        # Calculate GRACE score (simplified)
        grace_score = self._calculate_grace_score(
            age=age,
            heart_rate=heart_rate,
            systolic_bp=systolic_bp,
            killip_class=killip_class,
            troponin_elevated=troponin_status != TroponinStatus.NORMAL,
            ecg_changes=len(parsed_ecg) > 0 and ECGFindings.NORMAL not in parsed_ecg,
        )

        # Determine risk level
        risk_level = self._determine_risk_level(
            acs_type,
            timi_score.score if timi_score else 0,
            grace_score,
            troponin_status,
        )

        # Generate initial management
        initial_management = self._get_initial_management(
            acs_type,
            risk_level,
            time_since_onset,
            pci_capable_center,
            contraindications_fibrinolysis,
        )

        # Generate medications
        medications = self._get_medications(
            acs_type,
            contraindications_anticoagulation,
            systolic_bp,
            heart_rate,
        )

        # Determine disposition
        disposition = self._get_disposition(acs_type, risk_level)

        # Calculate time targets
        time_to_cath = None
        if acs_type == ACSType.STEMI:
            time_to_cath = self.DOOR_TO_BALLOON_TARGET

        # Generate critical actions
        critical_actions = self._get_critical_actions(
            acs_type,
            time_since_onset,
            pci_capable_center,
            contraindications_fibrinolysis,
        )

        # Generate warnings
        warnings = self._get_warnings(
            acs_type,
            time_since_onset,
            troponin_status,
            contraindications_anticoagulation,
            systolic_bp,
            heart_rate,
        )

        return ACSAssessment(
            acs_type=acs_type,
            risk_level=risk_level,
            timi_score=timi_score,
            grace_score=grace_score,
            ecg_findings=parsed_ecg,
            troponin_status=troponin_status,
            is_stemi=acs_type == ACSType.STEMI,
            time_since_onset_minutes=int(time_since_onset) if time_since_onset else None,
            initial_management=initial_management,
            medications=medications,
            disposition=disposition,
            time_to_ecg_target=self.DOOR_TO_ECG_TARGET,
            time_to_cath_target=time_to_cath,
            critical_actions=critical_actions,
            warnings=warnings,
        )

    def _parse_ecg_findings(self, findings: List[str]) -> List[ECGFindings]:
        """Parse ECG finding strings to enums."""
        mapping = {
            "normal": ECGFindings.NORMAL,
            "st_elevation": ECGFindings.ST_ELEVATION,
            "st_depression": ECGFindings.ST_DEPRESSION,
            "t_wave_inversion": ECGFindings.T_WAVE_INVERSION,
            "lbbb_new": ECGFindings.LBBB_NEW,
            "lbbb_old": ECGFindings.LBBB_OLD,
            "q_waves": ECGFindings.Q_WAVES,
            "non_specific": ECGFindings.NON_SPECIFIC,
        }
        return [mapping.get(f.lower(), ECGFindings.NON_SPECIFIC) for f in findings]

    def _parse_troponin_status(
        self,
        result: str,
        delta: Optional[float],
    ) -> TroponinStatus:
        """Parse troponin result to status."""
        result_lower = result.lower()

        if result_lower == "highly_elevated" or result_lower == "high":
            return TroponinStatus.HIGHLY_ELEVATED
        elif result_lower == "rising":
            return TroponinStatus.RISING
        elif result_lower == "elevated":
            return TroponinStatus.ELEVATED
        else:
            return TroponinStatus.NORMAL

    def _determine_acs_type(
        self,
        ecg: List[ECGFindings],
        troponin: TroponinStatus,
        resolved: bool,
        st_deviation: float,
    ) -> ACSType:
        """Determine ACS type based on findings."""
        # Check for STEMI criteria
        if ECGFindings.ST_ELEVATION in ecg:
            return ACSType.STEMI

        # New LBBB with appropriate clinical context
        if ECGFindings.LBBB_NEW in ecg:
            return ACSType.STEMI

        # NSTE-ACS
        if troponin in [TroponinStatus.ELEVATED, TroponinStatus.RISING, TroponinStatus.HIGHLY_ELEVATED]:
            return ACSType.NSTEMI

        # ST depression or T-wave changes without troponin elevation
        if ECGFindings.ST_DEPRESSION in ecg or ECGFindings.T_WAVE_INVERSION in ecg:
            return ACSType.UNSTABLE_ANGINA

        return ACSType.UNCERTAIN

    def _calculate_timi_score(
        self,
        age: int,
        risk_factors: List[str],
        prior_aspirin: bool,
        prior_cardiac: bool,
        st_deviation: bool,
        troponin_elevated: bool,
        coronary_stenosis: bool,
    ) -> TIMIRiskScore:
        """Calculate TIMI Risk Score for NSTE-ACS."""
        components = {}
        score = 0

        # Age ≥ 65
        components["age_65_or_older"] = age >= 65
        if age >= 65:
            score += 1

        # ≥ 3 risk factors for CAD
        components["three_plus_risk_factors"] = len(risk_factors) >= 3
        if len(risk_factors) >= 3:
            score += 1

        # Prior aspirin use
        components["prior_aspirin_use"] = prior_aspirin
        if prior_aspirin:
            score += 1

        # Prior cardiac history
        components["prior_cardiac_history"] = prior_cardiac
        if prior_cardiac:
            score += 1

        # ST deviation
        components["st_deviation"] = st_deviation
        if st_deviation:
            score += 1

        # Elevated cardiac markers
        components["elevated_troponin"] = troponin_elevated
        if troponin_elevated:
            score += 1

        # Known coronary stenosis
        components["known_coronary_stenosis"] = coronary_stenosis
        if coronary_stenosis:
            score += 1

        # Determine risk level
        if score <= 2:
            risk_level = RiskLevel.LOW
        elif score <= 4:
            risk_level = RiskLevel.INTERMEDIATE
        else:
            risk_level = RiskLevel.HIGH

        # Get mortality rate
        mortality = self.TIMI_MORTALITY.get(score, 0.359)

        return TIMIRiskScore(
            score=score,
            risk_level=risk_level,
            components=components,
            fourteen_day_mortality=mortality,
        )

    def _calculate_grace_score(
        self,
        age: int,
        heart_rate: int,
        systolic_bp: int,
        killip_class: int,
        troponin_elevated: bool,
        ecg_changes: bool,
    ) -> int:
        """Calculate simplified GRACE risk score."""
        score = 0

        # Age points
        if age < 40:
            score += 0
        elif age < 50:
            score += 18
        elif age < 60:
            score += 36
        elif age < 70:
            score += 55
        elif age < 80:
            score += 73
        else:
            score += 91

        # Heart rate points
        if heart_rate < 50:
            score += 0
        elif heart_rate < 70:
            score += 6
        elif heart_rate < 90:
            score += 13
        elif heart_rate < 110:
            score += 23
        elif heart_rate < 150:
            score += 36
        else:
            score += 46

        # Systolic BP points
        if systolic_bp < 80:
            score += 63
        elif systolic_bp < 100:
            score += 53
        elif systolic_bp < 120:
            score += 43
        elif systolic_bp < 140:
            score += 28
        elif systolic_bp < 160:
            score += 14
        else:
            score += 0

        # Killip class
        score += (killip_class - 1) * 25

        # Elevated troponin
        if troponin_elevated:
            score += 15

        # ECG changes
        if ecg_changes:
            score += 14

        return score

    def _determine_risk_level(
        self,
        acs_type: ACSType,
        timi_score: int,
        grace_score: int,
        troponin: TroponinStatus,
    ) -> RiskLevel:
        """Determine overall risk level."""
        if acs_type == ACSType.STEMI:
            return RiskLevel.CRITICAL

        if grace_score >= 140:
            return RiskLevel.HIGH
        elif grace_score >= 109:
            return RiskLevel.INTERMEDIATE

        if timi_score >= 5:
            return RiskLevel.HIGH
        elif timi_score >= 3:
            return RiskLevel.INTERMEDIATE

        if troponin == TroponinStatus.HIGHLY_ELEVATED:
            return RiskLevel.HIGH

        return RiskLevel.LOW

    def _get_initial_management(
        self,
        acs_type: ACSType,
        risk: RiskLevel,
        time_onset: Optional[float],
        pci_center: bool,
        fibro_contraindicated: bool,
    ) -> List[str]:
        """Get initial management steps."""
        management = []

        # Immediate actions
        management.append("✅ 12-lead ECG within 10 minutes of arrival")
        management.append("✅ IV access x2")
        management.append("✅ Continuous cardiac monitoring")
        management.append("✅ Supplemental O2 if SpO2 < 90%")

        if acs_type == ACSType.STEMI:
            management.append("🚨 STEMI ALERT - Activate cath lab immediately")
            if pci_center:
                management.append(f"🎯 Target: Door-to-balloon < {self.DOOR_TO_BALLOON_TARGET} minutes")
            elif not fibro_contraindicated and time_onset and time_onset < self.FIBRINOLYSIS_WINDOW:
                management.append(f"🎯 Target: Door-to-needle < {self.DOOR_TO_NEEDLE_TARGET} minutes")
                management.append("📍 Transfer for rescue PCI if needed")

        # Risk-based management
        if risk == RiskLevel.HIGH:
            management.append("📋 Early invasive strategy (within 24 hours)")
        elif risk == RiskLevel.INTERMEDIATE:
            management.append("📋 Invasive strategy (within 72 hours)")

        return management

    def _get_medications(
        self,
        acs_type: ACSType,
        anticoag_contraindicated: bool,
        sbp: int,
        hr: int,
    ) -> List[Dict[str, Any]]:
        """Get medication recommendations."""
        meds = []

        # MONA protocol
        meds.append({
            "name": "Aspirin",
            "dose": "325 mg",
            "route": "chewed",
            "indication": "All suspected ACS",
            "critical": True,
        })

        if acs_type == ACSType.STEMI:
            meds.append({
                "name": "P2Y12 inhibitor",
                "dose": "Ticagrelor 180 mg OR Clopidogrel 600 mg",
                "route": "PO",
                "indication": "STEMI - Dual antiplatelet therapy",
                "critical": True,
            })

        if not anticoag_contraindicated:
            meds.append({
                "name": "Anticoagulation",
                "dose": "Heparin 60 U/kg bolus (max 4000 U)",
                "route": "IV",
                "indication": "ACS without contraindication",
                "critical": True,
            })

        # Nitroglycerin
        if sbp > 90:
            meds.append({
                "name": "Nitroglycerin",
                "dose": "0.4 mg",
                "route": "SL q5min x3",
                "indication": "Chest pain, SBP > 90",
                "critical": False,
            })

        # Beta-blocker
        if hr > 60 and sbp > 100:
            meds.append({
                "name": "Metoprolol",
                "dose": "5 mg IV q5min x3, then 25-50 mg PO",
                "route": "IV/PO",
                "indication": "Tachycardia, hypertension (if no contraindication)",
                "critical": False,
            })

        # High-intensity statin
        meds.append({
            "name": "Atorvastatin",
            "dose": "80 mg",
            "route": "PO",
            "indication": "All ACS patients",
            "critical": False,
        })

        return meds

    def _get_disposition(self, acs_type: ACSType, risk: RiskLevel) -> str:
        """Determine patient disposition."""
        if acs_type == ACSType.STEMI:
            return "Catheterization lab → CCU/ICU"

        if risk == RiskLevel.HIGH:
            return "CCU/ICU for monitoring"
        elif risk == RiskLevel.INTERMEDIATE:
            return "Telemetry bed for monitoring"
        else:
            return "Observation unit or telemetry for serial troponins"

    def _get_critical_actions(
        self,
        acs_type: ACSType,
        time_onset: Optional[float],
        pci_center: bool,
        fibro_contraindicated: bool,
    ) -> List[str]:
        """Get critical time-sensitive actions."""
        actions = []

        if acs_type == ACSType.STEMI:
            actions.append("⏱️ Time is muscle - Minimize delays")
            actions.append("📞 Activate cath lab team")

            if pci_center:
                actions.append(f"🎯 Door-to-balloon target: {self.DOOR_TO_BALLOON_TARGET} minutes")
            else:
                if time_onset and time_onset < self.FIBRINOLYSIS_WINDOW:
                    actions.append(f"💊 Consider fibrinolysis within {self.DOOR_TO_NEEDLE_TARGET} min if no PCI within 120 min")
                actions.append("🚁 Arrange transfer to PCI center")

        return actions

    def _get_warnings(
        self,
        acs_type: ACSType,
        time_onset: Optional[float],
        troponin: TroponinStatus,
        anticoag_contraindicated: bool,
        sbp: int,
        hr: int,
    ) -> List[str]:
        """Get clinical warnings."""
        warnings = []

        if time_onset and time_onset > 720:  # 12 hours
            warnings.append("⚠️ Symptom onset > 12 hours - Assess for ongoing symptoms")

        if anticoag_contraindicated:
            warnings.append("⚠️ Anticoagulation contraindicated - Weigh risks/benefits")

        if sbp < 90:
            warnings.append("⚠️ Hypotension - Hold nitrates, assess for cardiogenic shock")

        if hr < 50 or hr > 100:
            warnings.append("⚠️ Bradycardia/tachycardia - Assess for conduction disease")

        if acs_type == ACSType.UNCERTAIN:
            warnings.append("⚠️ ACS type uncertain - Serial troponins and repeat ECG needed")

        return warnings


# Singleton instance
_acs_pathway: Optional[ACSPathway] = None


def get_acs_pathway() -> ACSPathway:
    """Get ACS pathway singleton."""
    global _acs_pathway
    if _acs_pathway is None:
        _acs_pathway = ACSPathway()
    return _acs_pathway
