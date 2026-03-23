"""
ECG Waveform Analysis Module
============================

AI-assisted ECG interpretation for clinical decision support.

Features:
- Automated rhythm detection
- Interval measurement
- STEMI criteria evaluation
- Arrhythmia detection
- Clinical correlation

Based on:
- AHA/ACC/HRS Guidelines
- Minnesota Code Classification
- Clinical ECG standards

Note: This is a clinical decision support tool.
All ECG interpretations should be verified by qualified clinicians.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from datetime import datetime
import math


class RhythmType(str, Enum):
    """Cardiac rhythm classifications."""
    SINUS = "sinus_rhythm"
    SINUS_TACHYCARDIA = "sinus_tachycardia"
    SINUS_BRADYCARDIA = "sinus_bradycardia"
    ATRIAL_FIBRILLATION = "atrial_fibrillation"
    ATRIAL_FLUTTER = "atrial_flutter"
    SVT = "supraventricular_tachycardia"
    JUNCTIONAL = "junctional_rhythm"
    VENTRICULAR_TACHYCARDIA = "ventricular_tachycardia"
    VENTRICULAR_FIBRILLATION = "ventricular_fibrillation"
    IDIOVENTRICULAR = "idioventricular_rhythm"
    PACED = "paced_rhythm"
    UNKNOWN = "unknown"


class STSegmentFinding(str, Enum):
    """ST segment abnormalities."""
    NORMAL = "normal"
    ELEVATION = "elevation"
    DEPRESSION = "depression"
    EARLY_REPOLARIZATION = "early_repolarization"


class ClinicalSignificance(str, Enum):
    """Clinical significance levels."""
    CRITICAL = "critical"  # STEMI, VF, VT
    URGENT = "urgent"  # NSTEMI, new arrhythmia
    ABNORMAL = "abnormal"  # Any abnormality
    BORDERLINE = "borderline"  # Equivocal findings
    NORMAL = "normal"  # Within normal limits


@dataclass
class ECGInterval:
    """ECG interval measurement."""
    name: str
    value_ms: float
    normal_range: Tuple[float, float]
    is_normal: bool
    interpretation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value_ms": self.value_ms,
            "normal_range": list(self.normal_range),
            "is_normal": self.is_normal,
            "interpretation": self.interpretation,
        }


@dataclass
class STSegment:
    """ST segment analysis for a lead."""
    lead: str
    deviation_mm: float
    finding: STSegmentFinding
    morphology: str
    clinical_significance: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lead": self.lead,
            "deviation_mm": self.deviation_mm,
            "finding": self.finding.value,
            "morphology": self.morphology,
            "clinical_significance": self.clinical_significance,
        }


@dataclass
class STEMIAssessment:
    """STEMI criteria assessment."""
    is_stemi: bool
    territory: str
    affected_leads: List[str]
    elevation_mm: float
    reciprocal_changes: bool
    criteria_met: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_stemi": self.is_stemi,
            "territory": self.territory,
            "affected_leads": self.affected_leads,
            "elevation_mm": self.elevation_mm,
            "reciprocal_changes": self.reciprocal_changes,
            "criteria_met": self.criteria_met,
        }


@dataclass
class ECGAnalysisResult:
    """Complete ECG analysis result."""
    rhythm: RhythmType
    heart_rate: int
    axis: str
    intervals: List[ECGInterval]
    st_segments: List[STSegment]
    stemi_assessment: Optional[STEMIAssessment]
    findings: List[str]
    clinical_significance: ClinicalSignificance
    recommendations: List[str]
    alerts: List[str]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    confidence_score: float = 0.0
    needs_clinician_review: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rhythm": self.rhythm.value,
            "heart_rate": self.heart_rate,
            "axis": self.axis,
            "intervals": [i.to_dict() for i in self.intervals],
            "st_segments": [s.to_dict() for s in self.st_segments],
            "stemi_assessment": self.stemi_assessment.to_dict() if self.stemi_assessment else None,
            "findings": self.findings,
            "clinical_significance": self.clinical_significance.value,
            "recommendations": self.recommendations,
            "alerts": self.alerts,
            "timestamp": self.timestamp.isoformat(),
            "confidence_score": self.confidence_score,
            "needs_clinician_review": self.needs_clinician_review,
        }


class ECGAnalyzer:
    """
    ECG Waveform Analysis Engine.
    
    Provides automated ECG interpretation with clinical context.
    """

    # Normal interval ranges (ms)
    INTERVAL_RANGES = {
        "PR": (120, 200),
        "QRS": (80, 100),
        "QT": (350, 450),  # QTc, varies by HR
        "QTc": (350, 450),
    }

    # STEMI criteria by territory
    STEMI_TERRITORIES = {
        "anterior": {
            "leads": ["V1", "V2", "V3", "V4"],
            "elevation_threshold": 2,  # mm (≥2 in V2-V3 men, ≥1.5 women)
            "reciprocal": ["II", "III", "aVF"],
            "culprit": "LAD",
        },
        "lateral": {
            "leads": ["I", "aVL", "V5", "V6"],
            "elevation_threshold": 1,  # mm
            "reciprocal": ["II", "III", "aVF"],
            "culprit": "LCx or diagonal",
        },
        "inferior": {
            "leads": ["II", "III", "aVF"],
            "elevation_threshold": 1,  # mm
            "reciprocal": ["I", "aVL"],
            "culprit": "RCA or LCx",
        },
        "posterior": {
            "leads": ["V7", "V8", "V9"],  # Posterior leads
            "elevation_threshold": 0.5,  # mm
            "reciprocal": ["V1", "V2", "V3"],  # ST depression in V1-V3
            "culprit": "RCA or LCx",
        },
        "right_ventricular": {
            "leads": ["V3R", "V4R"],  # Right-sided leads
            "elevation_threshold": 1,  # mm
            "reciprocal": [],
            "culprit": "Proximal RCA",
        },
    }

    # STEMI thresholds by lead group
    STEMI_THRESHOLDS = {
        "V2_V3_men_over_40": 2.0,
        "V2_V3_men_under_40": 2.5,
        "V2_V3_women": 1.5,
        "other_leads": 1.0,
        "aVR": 1.0,
    }

    def analyze(
        self,
        heart_rate: int,
        rhythm: str = "sinus",
        pr_interval: Optional[float] = None,
        qrs_duration: Optional[float] = None,
        qt_interval: Optional[float] = None,
        axis: Optional[str] = None,
        st_measurements: Optional[Dict[str, float]] = None,
        t_wave_findings: Optional[Dict[str, str]] = None,
        q_waves: Optional[List[str]] = None,
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        symptoms: Optional[str] = None,
    ) -> ECGAnalysisResult:
        """
        Analyze ECG and provide interpretation.
        
        Args:
            heart_rate: Heart rate in bpm
            rhythm: Rhythm description
            pr_interval: PR interval in ms
            qrs_duration: QRS duration in ms
            qt_interval: QT interval in ms
            axis: QRS axis description
            st_measurements: Dict mapping leads to ST deviation (mm)
            t_wave_findings: Dict mapping leads to T wave findings
            q_waves: List of leads with pathological Q waves
            patient_age: Patient age
            patient_gender: Patient gender (M/F)
            symptoms: Clinical symptoms/presentation
        
        Returns:
            ECGAnalysisResult with complete interpretation
        """
        st_measurements = st_measurements or {}
        t_wave_findings = t_wave_findings or {}
        q_waves = q_waves or []

        # Parse rhythm
        rhythm_type = self._parse_rhythm(rhythm, heart_rate)

        # Analyze intervals
        intervals = self._analyze_intervals(
            pr_interval, qrs_duration, qt_interval, heart_rate
        )

        # Analyze ST segments
        st_segments = self._analyze_st_segments(st_measurements, t_wave_findings)

        # Assess for STEMI
        stemi_assessment = self._assess_stemi(
            st_measurements,
            patient_age,
            patient_gender,
        )

        # Generate findings
        findings = self._generate_findings(
            rhythm_type,
            heart_rate,
            intervals,
            st_segments,
            stemi_assessment,
            q_waves,
            axis,
        )

        # Determine clinical significance
        clinical_sig = self._determine_significance(
            rhythm_type,
            stemi_assessment,
            st_segments,
            intervals,
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            clinical_sig,
            stemi_assessment,
            rhythm_type,
            symptoms,
        )

        # Generate alerts
        alerts = self._generate_alerts(
            clinical_sig,
            stemi_assessment,
            rhythm_type,
            heart_rate,
            intervals,
        )

        # Calculate confidence
        confidence = self._calculate_confidence(
            st_measurements,
            intervals,
            rhythm_type,
        )

        return ECGAnalysisResult(
            rhythm=rhythm_type,
            heart_rate=heart_rate,
            axis=axis or "Normal",
            intervals=intervals,
            st_segments=st_segments,
            stemi_assessment=stemi_assessment,
            findings=findings,
            clinical_significance=clinical_sig,
            recommendations=recommendations,
            alerts=alerts,
            confidence_score=confidence,
        )

    def _parse_rhythm(self, rhythm: str, hr: int) -> RhythmType:
        """Parse rhythm description into type."""
        rhythm_lower = rhythm.lower()

        if "vf" in rhythm_lower or "ventricular fibrillation" in rhythm_lower:
            return RhythmType.VENTRICULAR_FIBRILLATION
        elif "vt" in rhythm_lower or "ventricular tachycardia" in rhythm_lower:
            return RhythmType.VENTRICULAR_TACHYCARDIA
        elif "afib" in rhythm_lower or "atrial fibrillation" in rhythm_lower:
            return RhythmType.ATRIAL_FIBRILLATION
        elif "aflutter" in rhythm_lower or "atrial flutter" in rhythm_lower:
            return RhythmType.ATRIAL_FLUTTER
        elif "svt" in rhythm_lower:
            return RhythmType.SVT
        elif "paced" in rhythm_lower:
            return RhythmType.PACED
        elif "junctional" in rhythm_lower:
            return RhythmType.JUNCTIONAL
        elif "sinus" in rhythm_lower:
            if hr > 100:
                return RhythmType.SINUS_TACHYCARDIA
            elif hr < 60:
                return RhythmType.SINUS_BRADYCARDIA
            return RhythmType.SINUS

        return RhythmType.UNKNOWN

    def _analyze_intervals(
        self,
        pr: Optional[float],
        qrs: Optional[float],
        qt: Optional[float],
        hr: int,
    ) -> List[ECGInterval]:
        """Analyze ECG intervals."""
        intervals = []

        # PR interval
        if pr is not None:
            is_normal = self.INTERVAL_RANGES["PR"][0] <= pr <= self.INTERVAL_RANGES["PR"][1]
            if is_normal:
                interp = "Normal PR interval"
            elif pr < self.INTERVAL_RANGES["PR"][0]:
                interp = "Short PR interval - consider pre-excitation"
            else:
                interp = "Prolonged PR interval - first-degree AV block"

            intervals.append(ECGInterval(
                name="PR",
                value_ms=pr,
                normal_range=self.INTERVAL_RANGES["PR"],
                is_normal=is_normal,
                interpretation=interp,
            ))

        # QRS duration
        if qrs is not None:
            is_normal = qrs <= self.INTERVAL_RANGES["QRS"][1]
            if is_normal:
                interp = "Normal QRS duration"
            elif qrs <= 120:
                interp = "Incomplete bundle branch block"
            elif qrs <= 140:
                interp = "Incomplete bundle branch block or IVCD"
            else:
                interp = "Wide QRS - consider BBB, hyperkalemia, or pacing"

            intervals.append(ECGInterval(
                name="QRS",
                value_ms=qrs,
                normal_range=self.INTERVAL_RANGES["QRS"],
                is_normal=is_normal,
                interpretation=interp,
            ))

        # QT interval (QTc)
        if qt is not None and hr > 0:
            # Calculate QTc using Bazett's formula
            qtc = qt / math.sqrt(60 / hr)
            is_normal = self.INTERVAL_RANGES["QTc"][0] <= qtc <= self.INTERVAL_RANGES["QTc"][1]

            if is_normal:
                interp = "Normal QTc"
            elif qtc < self.INTERVAL_RANGES["QTc"][0]:
                interp = "Short QTc - consider hypercalcemia, digoxin"
            else:
                interp = f"Prolonged QTc ({qtc:.0f}ms) - increased arrhythmia risk"

            intervals.append(ECGInterval(
                name="QTc",
                value_ms=qtc,
                normal_range=self.INTERVAL_RANGES["QTc"],
                is_normal=is_normal,
                interpretation=interp,
            ))

        return intervals

    def _analyze_st_segments(
        self,
        st_measurements: Dict[str, float],
        t_waves: Dict[str, str],
    ) -> List[STSegment]:
        """Analyze ST segments."""
        segments = []

        for lead, deviation in st_measurements.items():
            # Determine finding
            if abs(deviation) < 0.5:
                finding = STSegmentFinding.NORMAL
                sig = "Normal"
                morphology = "Isoelectric"
            elif deviation > 0:
                finding = STSegmentFinding.ELEVATION
                sig = "Abnormal" if deviation >= 1 else "Borderline"
                morphology = self._determine_st_morphology_elevation(deviation)
            else:
                finding = STSegmentFinding.DEPRESSION
                sig = "Abnormal" if deviation <= -1 else "Borderline"
                morphology = self._determine_st_morphology_depression(deviation)

            segments.append(STSegment(
                lead=lead,
                deviation_mm=deviation,
                finding=finding,
                morphology=morphology,
                clinical_significance=sig,
            ))

        return segments

    def _determine_st_morphology_elevation(self, deviation: float) -> str:
        """Determine ST elevation morphology."""
        if deviation >= 2:
            return "Marked ST elevation"
        elif deviation >= 1:
            return "ST elevation"
        else:
            return "Minimal ST elevation"

    def _determine_st_morphology_depression(self, deviation: float) -> str:
        """Determine ST depression morphology."""
        if deviation <= -2:
            return "Marked ST depression"
        elif deviation <= -1:
            return "ST depression - consider ischemia"
        else:
            return "Minimal ST depression"

    def _assess_stemi(
        self,
        st_measurements: Dict[str, float],
        age: Optional[int],
        gender: Optional[str],
    ) -> Optional[STEMIAssessment]:
        """Assess for STEMI criteria."""
        if not st_measurements:
            return None

        # Determine thresholds based on demographics
        threshold_v2_v3 = 2.0  # Default
        if gender and gender.upper() == "F":
            threshold_v2_v3 = 1.5
        elif age and age >= 40:
            threshold_v2_v3 = 2.0
        else:
            threshold_v2_v3 = 2.5

        # Check each territory
        for territory, criteria in self.STEMI_TERRITORIES.items():
            affected = []
            max_elevation = 0

            for lead in criteria["leads"]:
                if lead in st_measurements:
                    elevation = st_measurements[lead]

                    # Determine threshold for this lead
                    if lead in ["V2", "V3"]:
                        threshold = threshold_v2_v3
                    else:
                        threshold = 1.0

                    if elevation >= threshold:
                        affected.append(lead)
                        max_elevation = max(max_elevation, elevation)

            # Need ≥2 contiguous leads with elevation
            if len(affected) >= 2:
                # Check for reciprocal changes
                reciprocal = False
                for rec_lead in criteria.get("reciprocal", []):
                    if rec_lead in st_measurements and st_measurements[rec_lead] < 0:
                        reciprocal = True
                        break

                return STEMIAssessment(
                    is_stemi=True,
                    territory=territory,
                    affected_leads=affected,
                    elevation_mm=max_elevation,
                    reciprocal_changes=reciprocal,
                    criteria_met=[
                        f"ST elevation ≥{threshold}mm in {', '.join(affected)}",
                        f"Territory: {territory.upper()}",
                        f"Suspected culprit: {criteria['culprit']}",
                    ],
                )

        return STEMIAssessment(
            is_stemi=False,
            territory="",
            affected_leads=[],
            elevation_mm=0,
            reciprocal_changes=False,
            criteria_met=["STEMI criteria not met"],
        )

    def _generate_findings(
        self,
        rhythm: RhythmType,
        hr: int,
        intervals: List[ECGInterval],
        st_segments: List[STSegment],
        stemi: Optional[STEMIAssessment],
        q_waves: List[str],
        axis: Optional[str],
    ) -> List[str]:
        """Generate ECG findings list."""
        findings = []

        # Rhythm and rate
        findings.append(f"Rhythm: {rhythm.value.replace('_', ' ').title()}")
        findings.append(f"Heart Rate: {hr} bpm")

        # Axis
        if axis:
            findings.append(f"Axis: {axis}")

        # Interval findings
        for interval in intervals:
            if not interval.is_normal:
                findings.append(interval.interpretation)

        # ST-T findings
        elevations = [s for s in st_segments if s.finding == STSegmentFinding.ELEVATION]
        depressions = [s for s in st_segments if s.finding == STSegmentFinding.DEPRESSION]

        if elevations:
            leads = ", ".join([s.lead for s in elevations])
            findings.append(f"ST elevation in {leads}")

        if depressions:
            leads = ", ".join([s.lead for s in depressions])
            findings.append(f"ST depression in {leads}")

        # STEMI
        if stemi and stemi.is_stemi:
            findings.append(f"🚨 STEMI CRITERIA MET - {stemi.territory.upper()} MI")
            findings.append(f"   Affected leads: {', '.join(stemi.affected_leads)}")

        # Q waves
        if q_waves:
            findings.append(f"Pathological Q waves in: {', '.join(q_waves)}")

        return findings

    def _determine_significance(
        self,
        rhythm: RhythmType,
        stemi: Optional[STEMIAssessment],
        st_segments: List[STSegment],
        intervals: List[ECGInterval],
    ) -> ClinicalSignificance:
        """Determine overall clinical significance."""
        # Critical
        if rhythm in [RhythmType.VENTRICULAR_FIBRILLATION, RhythmType.VENTRICULAR_TACHYCARDIA]:
            return ClinicalSignificance.CRITICAL
        if stemi and stemi.is_stemi:
            return ClinicalSignificance.CRITICAL

        # Urgent
        if rhythm in [RhythmType.ATRIAL_FIBRILLATION, RhythmType.SVT, RhythmType.ATRIAL_FLUTTER]:
            return ClinicalSignificance.URGENT

        # Check for significant ST changes
        significant_st = any(
            abs(s.deviation_mm) >= 1.5 for s in st_segments
        )
        if significant_st:
            return ClinicalSignificance.URGENT

        # Check for prolonged QTc
        for interval in intervals:
            if interval.name == "QTc" and interval.value_ms > 500:
                return ClinicalSignificance.URGENT

        # Abnormal
        if any(not i.is_normal for i in intervals):
            return ClinicalSignificance.ABNORMAL

        if st_segments:
            return ClinicalSignificance.ABNORMAL

        return ClinicalSignificance.NORMAL

    def _generate_recommendations(
        self,
        significance: ClinicalSignificance,
        stemi: Optional[STEMIAssessment],
        rhythm: RhythmType,
        symptoms: Optional[str],
    ) -> List[str]:
        """Generate clinical recommendations."""
        recommendations = []

        if significance == ClinicalSignificance.CRITICAL:
            if stemi and stemi.is_stemi:
                recommendations.append("🚨 STEMI ALERT - Activate catheterization lab")
                recommendations.append("   Aspirin 324mg PO immediately")
                recommendations.append("   Heparin per protocol")
                recommendations.append("   Target: Door-to-balloon < 90 minutes")

            if rhythm == RhythmType.VENTRICULAR_FIBRILLATION:
                recommendations.append("🚨 VF - Begin CPR, defibrillate immediately")
                recommendations.append("   Follow ACLS VF/pulseless VT algorithm")

            if rhythm == RhythmType.VENTRICULAR_TACHYCARDIA:
                recommendations.append("🚨 VT - Assess for pulse")
                recommendations.append("   Pulseless: Begin CPR, defibrillate")
                recommendations.append("   With pulse: Consider cardioversion/amiodarone")

        elif significance == ClinicalSignificance.URGENT:
            if rhythm == RhythmType.ATRIAL_FIBRILLATION:
                recommendations.append("Atrial fibrillation:")
                recommendations.append("   Rate control: Metoprolol or Diltiazem")
                recommendations.append("   Consider anticoagulation (CHADSVASc score)")
                recommendations.append("   Consider cardioversion if new onset")

            if rhythm == RhythmType.SVT:
                recommendations.append("SVT:")
                recommendations.append("   Vagal maneuvers")
                recommendations.append("   Adenosine 6mg rapid IV push")
                recommendations.append("   Consider cardioversion if unstable")

            recommendations.append("Urgent cardiology consultation recommended")

        elif significance == ClinicalSignificance.ABNORMAL:
            recommendations.append("ECG abnormal - clinical correlation recommended")
            recommendations.append("Consider cardiology consultation")

        else:
            recommendations.append("ECG within normal limits")

        recommendations.append("")
        recommendations.append("⚠️ AI-assisted interpretation - Requires physician review")

        return recommendations

    def _generate_alerts(
        self,
        significance: ClinicalSignificance,
        stemi: Optional[STEMIAssessment],
        rhythm: RhythmType,
        hr: int,
        intervals: List[ECGInterval],
    ) -> List[str]:
        """Generate clinical alerts."""
        alerts = []

        if stemi and stemi.is_stemi:
            alerts.append(f"🚨 STEMI - {stemi.territory.upper()} territory")

        if rhythm == RhythmType.VENTRICULAR_FIBRILLATION:
            alerts.append("🚨 VENTRICULAR FIBRILLATION")
        elif rhythm == RhythmType.VENTRICULAR_TACHYCARDIA:
            alerts.append("🚨 VENTRICULAR TACHYCARDIA")

        if hr > 150:
            alerts.append(f"⚠️ Severe tachycardia: {hr} bpm")
        elif hr < 40:
            alerts.append(f"⚠️ Severe bradycardia: {hr} bpm")

        for interval in intervals:
            if interval.name == "QTc" and interval.value_ms > 500:
                alerts.append(f"⚠️ Markedly prolonged QTc: {interval.value_ms:.0f}ms")

        return alerts

    def _calculate_confidence(
        self,
        st_measurements: Dict[str, float],
        intervals: List[ECGInterval],
        rhythm: RhythmType,
    ) -> float:
        """Calculate confidence score for interpretation."""
        confidence = 0.8  # Base confidence

        # Adjust based on data completeness
        if not st_measurements:
            confidence -= 0.1

        if len(intervals) < 3:
            confidence -= 0.1

        if rhythm == RhythmType.UNKNOWN:
            confidence -= 0.2

        return max(0.0, min(1.0, confidence))


# Singleton
_ecg_analyzer: Optional[ECGAnalyzer] = None


def get_ecg_analyzer() -> ECGAnalyzer:
    """Get ECG analyzer singleton."""
    global _ecg_analyzer
    if _ecg_analyzer is None:
        _ecg_analyzer = ECGAnalyzer()
    return _ecg_analyzer
