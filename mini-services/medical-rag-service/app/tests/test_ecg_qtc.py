"""
Pytest Tests for ECG QTc Calculation and QRS Range Fix
=======================================================

Tests for evidence-based QTc calculation with all four validated formulas
and gender-aware thresholds.

Test Cases Required:
1. HR=60, QT=440ms: All formulas return ~440ms (baseline verification)
2. HR=120, QT=340ms: Verify Fridericia is used as primary (differs from Bazett)
3. Female with QTc=455ms → borderline; Male with same → prolonged
4. QRS range: 120ms is normal, >120ms is abnormal
5. QTc >500ms → critical alert for both genders

References:
- Rautaharju PM et al. AHA/ACCF/HRS 2009 Recommendations
- Bazett HC. Heart 1920;7:353-370
- Fridericia LS. Acta Med Scand 1920;54:467-486
- Hodges M. Noninvasive Electrocardiology 1992
- Sagie A et al. Circulation 1992;86:663-667

Run with: pytest app/tests/test_ecg_qtc.py -v
"""

import pytest
import sys
import os
import math

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ecg.ecg_analyzer import (
    ECGAnalyzer,
    QTcFormulas,
    QTcStatus,
    RhythmType,
    ClinicalSignificance,
)


class TestQTcFormulas:
    """Tests for QTc formula calculations."""
    
    @pytest.fixture
    def analyzer(self):
        """Create ECG analyzer instance."""
        return ECGAnalyzer()
    
    def test_qtc_at_hr_60_all_formulas_equal(self, analyzer):
        """
        TEST CASE 1: HR=60, QT=440ms → All formulas return ~440ms
        
        At heart rate of 60 bpm, RR = 1 second.
        All QTc formulas should return approximately the same value as the raw QT.
        
        Bazett:  440 / sqrt(1.0) = 440ms
        Fridericia: 440 / cbrt(1.0) = 440ms
        Hodges:  440 + 1.75 * (60-60) = 440ms
        Framingham: 440 + 0.154 * (1-1) * 1000 = 440ms
        """
        hr = 60
        qt = 440
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            rhythm="sinus",
        )
        
        # Find QTc interval
        qtc_interval = None
        for interval in result.intervals:
            if interval.name == "QTc":
                qtc_interval = interval
                break
        
        assert qtc_interval is not None, "QTc interval should be calculated"
        assert qtc_interval.qtc_formulas is not None, "QTcFormulas should be present"
        
        formulas = qtc_interval.qtc_formulas
        
        # All formulas should return ~440ms at HR=60
        assert abs(formulas.bazett - 440) < 1, \
            f"Bazett should be ~440ms at HR=60, got {formulas.bazett}"
        assert abs(formulas.fridericia - 440) < 1, \
            f"Fridericia should be ~440ms at HR=60, got {formulas.fridericia}"
        assert abs(formulas.hodges - 440) < 1, \
            f"Hodges should be ~440ms at HR=60, got {formulas.hodges}"
        assert abs(formulas.framingham - 440) < 1, \
            f"Framingham should be ~440ms at HR=60, got {formulas.framingham}"
        
        # Primary should be Fridericia
        assert formulas.primary_formula == "Fridericia"
        assert abs(formulas.primary - 440) < 1
    
    def test_qtc_at_hr_120_fridericia_primary(self, analyzer):
        """
        TEST CASE 2: HR=120, QT=340ms → Fridericia differs from Bazett
        
        At high heart rates, Bazett over-corrects QTc.
        Fridericia is more accurate and should be used as primary.
        
        RR = 60/120 = 0.5 seconds
        Bazett: 340 / sqrt(0.5) = 340 / 0.707 = ~480.8ms (over-corrected)
        Fridericia: 340 / cbrt(0.5) = 340 / 0.794 = ~428ms (more accurate)
        
        This test verifies Fridericia is used as primary QTc.
        """
        hr = 120
        qt = 340
        rr = 60.0 / hr
        
        # Expected values
        expected_bazett = qt / math.sqrt(rr)
        expected_fridericia = qt / (rr ** (1/3))
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            rhythm="sinus",
        )
        
        # Find QTc interval
        qtc_interval = None
        for interval in result.intervals:
            if interval.name == "QTc":
                qtc_interval = interval
                break
        
        assert qtc_interval is not None
        formulas = qtc_interval.qtc_formulas
        
        # Verify Bazett over-corrects at high HR
        assert abs(formulas.bazett - expected_bazett) < 1, \
            f"Bazett should be ~{expected_bazett:.1f}ms at HR=120, got {formulas.bazett}"
        
        # Verify Fridericia gives lower (more accurate) value
        assert abs(formulas.fridericia - expected_fridericia) < 1, \
            f"Fridericia should be ~{expected_fridericia:.1f}ms at HR=120, got {formulas.fridericia}"
        
        # CRITICAL: Verify Fridericia is used as primary
        assert formulas.primary == formulas.fridericia, \
            "Fridericia should be used as primary QTc"
        assert qtc_interval.value_ms == formulas.fridericia, \
            "Reported QTc value should be Fridericia"
        
        # At HR=120, Bazett should be significantly higher than Fridericia
        assert formulas.bazett > formulas.fridericia, \
            f"At HR=120, Bazett ({formulas.bazett:.0f}ms) should exceed Fridericia ({formulas.fridericia:.0f}ms)"
    
    def test_qtc_formulas_at_low_hr(self, analyzer):
        """
        Test QTc formulas at low heart rate (bradycardia).
        
        At HR=40, RR=1.5 seconds:
        Bazett under-corrects at low HR (gives lower QTc)
        Fridericia remains more accurate.
        """
        hr = 40
        qt = 450
        rr = 60.0 / hr
        
        expected_bazett = qt / math.sqrt(rr)
        expected_fridericia = qt / (rr ** (1/3))
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        
        formulas = qtc_interval.qtc_formulas
        assert formulas is not None
        
        # At low HR, Bazett under-corrects (gives lower value than Fridericia)
        assert formulas.bazett < formulas.fridericia, \
            f"At HR=40, Bazett ({formulas.bazett:.0f}ms) should be less than Fridericia ({formulas.fridericia:.0f}ms)"


class TestGenderAwareQTcThresholds:
    """Tests for gender-specific QTc thresholds."""
    
    @pytest.fixture
    def analyzer(self):
        return ECGAnalyzer()
    
    def test_female_qtc_455ms_borderline(self, analyzer):
        """
        TEST CASE 3a: Female with QTc=455ms → borderline
        
        AHA/ACCF/HRS 2009 criteria:
        - Female: Normal ≤450ms, Borderline 451-460ms, Prolonged >460ms
        
        At QTc=455ms, female should be classified as "borderline".
        """
        # Use HR=60, QT=455 to get QTc ≈ 455ms
        hr = 60
        qt = 455
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="F",
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        
        # Female with QTc=455ms should be BORDERLINE
        assert qtc_interval.qtc_status == QTcStatus.BORDERLINE, \
            f"Female with QTc=455ms should be BORDERLINE, got {qtc_interval.qtc_status}"
        
        # Should NOT be classified as prolonged
        assert qtc_interval.qtc_status != QTcStatus.PROLONGED, \
            "Female with QTc=455ms should NOT be PROLONGED"
    
    def test_male_qtc_455ms_prolonged(self, analyzer):
        """
        TEST CASE 3b: Male with QTc=455ms → prolonged
        
        AHA/ACCF/HRS 2009 criteria:
        - Male: Normal ≤440ms, Borderline 441-450ms, Prolonged >450ms
        
        At QTc=455ms, male should be classified as "prolonged".
        """
        hr = 60
        qt = 455
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="M",
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        
        # Male with QTc=455ms should be PROLONGED
        assert qtc_interval.qtc_status == QTcStatus.PROLONGED, \
            f"Male with QTc=455ms should be PROLONGED, got {qtc_interval.qtc_status}"
    
    def test_female_qtc_445ms_normal(self, analyzer):
        """Test female with QTc=445ms is normal (≤450ms threshold)."""
        hr = 60
        qt = 445
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="F",
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        assert qtc_interval.qtc_status == QTcStatus.NORMAL, \
            f"Female with QTc=445ms should be NORMAL, got {qtc_interval.qtc_status}"
    
    def test_male_qtc_445ms_borderline(self, analyzer):
        """Test male with QTc=445ms is borderline (441-450ms threshold)."""
        hr = 60
        qt = 445
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="M",
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        assert qtc_interval.qtc_status == QTcStatus.BORDERLINE, \
            f"Male with QTc=445ms should be BORDERLINE, got {qtc_interval.qtc_status}"
    
    def test_critical_qtc_505ms_both_genders(self, analyzer):
        """
        TEST CASE: QTc >500ms → CRITICAL for both genders.
        
        Critical threshold of >500ms applies to all patients regardless of gender.
        This represents high risk of Torsades de Pointes.
        """
        hr = 60
        qt = 505
        
        # Test with female
        result_f = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="F",
            rhythm="sinus",
        )
        qtc_f = next((i for i in result_f.intervals if i.name == "QTc"), None)
        assert qtc_f.qtc_status == QTcStatus.CRITICAL, \
            f"Female with QTc>500ms should be CRITICAL"
        
        # Test with male
        result_m = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="M",
            rhythm="sinus",
        )
        qtc_m = next((i for i in result_m.intervals if i.name == "QTc"), None)
        assert qtc_m.qtc_status == QTcStatus.CRITICAL, \
            f"Male with QTc>500ms should be CRITICAL"
        
        # Check that critical alert is generated
        assert any("CRITICAL" in alert for alert in result_f.alerts), \
            "CRITICAL QTc should generate alert"
    
    def test_unknown_gender_uses_male_thresholds(self, analyzer):
        """Test that unknown gender uses conservative (male) thresholds."""
        hr = 60
        qt = 455  # Would be prolonged for male, borderline for female
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender=None,  # Unknown gender
            rhythm="sinus",
        )
        
        qtc_interval = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc_interval is not None
        
        # Unknown gender should use male (conservative) thresholds
        assert qtc_interval.qtc_status == QTcStatus.PROLONGED, \
            f"Unknown gender should use male thresholds (PROLONGED for QTc=455ms)"


class TestQRSRange:
    """Tests for corrected QRS interval range."""
    
    @pytest.fixture
    def analyzer(self):
        return ECGAnalyzer()
    
    def test_qrs_120ms_is_normal(self, analyzer):
        """
        TEST CASE 4a: QRS=120ms is considered normal.
        
        The upper limit of normal QRS duration is 120ms.
        Previously, this was incorrectly set to 100ms.
        
        Reference: Rautaharju PM et al. AHA/ACCF/HRS 2009
        """
        result = analyzer.analyze(
            heart_rate=70,
            qrs_duration=120,
            rhythm="sinus",
        )
        
        qrs_interval = next((i for i in result.intervals if i.name == "QRS"), None)
        assert qrs_interval is not None
        
        # QRS of 120ms should be within normal range
        assert qrs_interval.is_normal is True, \
            f"QRS=120ms should be normal, but is_normal={qrs_interval.is_normal}"
        
        # Normal range should be (70, 120)
        assert qrs_interval.normal_range == (70, 120), \
            f"Normal QRS range should be (70, 120), got {qrs_interval.normal_range}"
    
    def test_qrs_100ms_is_normal(self, analyzer):
        """Test QRS=100ms is normal (within 70-120ms range)."""
        result = analyzer.analyze(
            heart_rate=70,
            qrs_duration=100,
            rhythm="sinus",
        )
        
        qrs_interval = next((i for i in result.intervals if i.name == "QRS"), None)
        assert qrs_interval is not None
        assert qrs_interval.is_normal is True, \
            f"QRS=100ms should be normal"
    
    def test_qrs_130ms_is_abnormal(self, analyzer):
        """
        TEST CASE 4b: QRS >120ms is abnormal.
        
        QRS duration >120ms indicates bundle branch block or IVCD.
        """
        result = analyzer.analyze(
            heart_rate=70,
            qrs_duration=130,
            rhythm="sinus",
        )
        
        qrs_interval = next((i for i in result.intervals if i.name == "QRS"), None)
        assert qrs_interval is not None
        
        # QRS of 130ms should be abnormal
        assert qrs_interval.is_normal is False, \
            f"QRS=130ms should be abnormal, but is_normal={qrs_interval.is_normal}"
        
        # Should have appropriate interpretation
        assert "incomplete" in qrs_interval.interpretation.lower() or \
               "ivcd" in qrs_interval.interpretation.lower(), \
            f"QRS=130ms should indicate incomplete BBB or IVCD"
    
    def test_qrs_70ms_is_normal_lower_bound(self, analyzer):
        """Test QRS=70ms is normal (lower bound of range)."""
        result = analyzer.analyze(
            heart_rate=70,
            qrs_duration=70,
            rhythm="sinus",
        )
        
        qrs_interval = next((i for i in result.intervals if i.name == "QRS"), None)
        assert qrs_interval is not None
        assert qrs_interval.is_normal is True, \
            f"QRS=70ms (lower bound) should be normal"
    
    def test_qrs_range_correct_in_class(self, analyzer):
        """Verify INTERVAL_RANGES has correct QRS range."""
        assert analyzer.INTERVAL_RANGES["QRS"] == (70, 120), \
            f"INTERVAL_RANGES['QRS'] should be (70, 120), got {analyzer.INTERVAL_RANGES['QRS']}"


class TestQTcFormulasDataclass:
    """Tests for QTcFormulas dataclass."""
    
    def test_qtc_formulas_to_dict(self):
        """Test QTcFormulas serialization."""
        formulas = QTcFormulas(
            bazett=450.5,
            fridericia=440.2,
            hodges=442.0,
            framingham=438.7,
            primary=440.2,
        )
        
        result = formulas.to_dict()
        
        assert "bazett" in result
        assert "fridericia" in result
        assert "hodges" in result
        assert "framingham" in result
        assert "primary" in result
        assert "primary_formula" in result
        
        # Values should be rounded
        assert result["bazett"] == 450.5
        assert result["fridericia"] == 440.2
        assert result["primary"] == 440.2
        assert result["primary_formula"] == "Fridericia"


class TestECGAnalysisIntegration:
    """Integration tests for complete ECG analysis."""
    
    @pytest.fixture
    def analyzer(self):
        return ECGAnalyzer()
    
    def test_complete_ecg_analysis_with_gender(self, analyzer):
        """Test complete ECG analysis with all parameters."""
        result = analyzer.analyze(
            heart_rate=85,
            rhythm="sinus",
            pr_interval=180,
            qrs_duration=95,
            qt_interval=400,
            axis="Normal",
            patient_age=55,
            patient_gender="F",
            symptoms="chest pain",
            st_measurements={"V1": 0.2, "V2": 0.1},
        )
        
        # Should have all intervals
        interval_names = [i.name for i in result.intervals]
        assert "PR" in interval_names
        assert "QRS" in interval_names
        assert "QTc" in interval_names
        
        # QTc should have formulas and status
        qtc = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc is not None
        assert qtc.qtc_formulas is not None
        assert qtc.qtc_status is not None
        assert qtc.gender == "F"
    
    def test_ecg_analysis_serialization(self, analyzer):
        """Test ECG result can be serialized to dict."""
        result = analyzer.analyze(
            heart_rate=60,
            qt_interval=440,
            patient_gender="M",
            rhythm="sinus",
        )
        
        result_dict = result.to_dict()
        
        assert "rhythm" in result_dict
        assert "heart_rate" in result_dict
        assert "intervals" in result_dict
        assert "findings" in result_dict
        
        # QTc should include all formula values
        qtc_dict = next(
            (i for i in result_dict["intervals"] if i["name"] == "QTc"),
            None
        )
        assert qtc_dict is not None
        assert "qtc_formulas" in qtc_dict
        assert "qtc_status" in qtc_dict
    
    def test_high_hr_uses_fridericia_not_bazett(self, analyzer):
        """
        Verify that at high heart rates, Fridericia is used for clinical decisions.
        
        This ensures the fix is properly integrated - the system should NOT use
        Bazett (which over-corrects) for clinical decision-making.
        """
        hr = 150  # High heart rate
        qt = 320
        
        result = analyzer.analyze(
            heart_rate=hr,
            qt_interval=qt,
            patient_gender="M",
            rhythm="sinus_tachycardia",
        )
        
        qtc = next((i for i in result.intervals if i.name == "QTc"), None)
        assert qtc is not None
        
        # Primary QTc should be Fridericia value
        assert qtc.value_ms == qtc.qtc_formulas.fridericia, \
            "Primary QTc should be Fridericia formula"
        
        # Bazett should be significantly higher at HR=150
        rr = 60.0 / hr
        expected_bazett = qt / math.sqrt(rr)
        expected_fridericia = qt / (rr ** (1/3))
        
        assert abs(qtc.qtc_formulas.bazett - expected_bazett) < 1
        assert abs(qtc.qtc_formulas.fridericia - expected_fridericia) < 1


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
