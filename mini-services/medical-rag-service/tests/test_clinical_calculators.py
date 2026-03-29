"""
Pytest Tests for Clinical Calculators
======================================

Comprehensive tests for all 12 clinical scoring calculators.

Test coverage includes:
1. CHA2DS2-VASc - Stroke risk in atrial fibrillation
2. HAS-BLED - Bleeding risk with anticoagulation
3. CURB-65 - Pneumonia severity
4. PERC Rule - Pulmonary embolism rule-out
5. Wells PE - Pulmonary embolism probability
6. Wells DVT - Deep vein thrombosis probability
7. NEWS2 - National Early Warning Score 2
8. SOFA - Sequential Organ Failure Assessment
9. Glasgow-Blatchford - Upper GI bleeding risk
10. 4T Score - Heparin-induced thrombocytopenia
11. ASCVD 10-year risk - Atherosclerotic cardiovascular disease
12. Child-Pugh - Liver disease severity

Run with: pytest tests/test_clinical_calculators.py -v
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.calculators.clinical_scores import (
    calculate_cha2ds2_vasc,
    calculate_has_bled,
    calculate_curb65,
    calculate_perc,
    calculate_wells_pe,
    calculate_wells_dvt,
    calculate_news2,
    calculate_sofa,
    calculate_glasgow_blatchford,
    calculate_4t_score,
    calculate_ascvd_risk,
    calculate_child_pugh,
    get_calculator,
    list_calculators,
    CALCULATOR_REGISTRY,
)


# =============================================================================
# CHA2DS2-VASc Tests
# =============================================================================

class TestCHA2DS2VASc:
    """Tests for CHA2DS2-VASc calculator."""
    
    def test_zero_score_male(self):
        """Test zero score for healthy young male."""
        result = calculate_cha2ds2_vasc(
            congestive_heart_failure=False,
            hypertension=False,
            age=40,
            diabetes=False,
            stroke_tia=False,
            vascular_disease=False,
            sex="male",
        )
        assert result["score"] == 0
        assert "no anticoagulation" in result["recommendation"].lower()
    
    def test_high_risk_male_with_chf_htn_age_76(self):
        """
        Test case from requirements: male age 76 with CHF + HTN.
        
        Expected scoring:
        - CHF: 1 point
        - HTN: 1 point
        - Age ≥75: 2 points
        Total: 4 points → should recommend anticoagulation
        """
        result = calculate_cha2ds2_vasc(
            congestive_heart_failure=True,
            hypertension=True,
            age=76,
            diabetes=False,
            stroke_tia=False,
            vascular_disease=False,
            sex="male",
        )
        assert result["score"] >= 4
        assert "anticoagulat" in result["recommendation"].lower()
    
    def test_female_sex_adds_point(self):
        """Test that female sex adds 1 point."""
        male_result = calculate_cha2ds2_vasc(
            age=70,
            hypertension=True,
            sex="male",
        )
        female_result = calculate_cha2ds2_vasc(
            age=70,
            hypertension=True,
            sex="female",
        )
        assert female_result["score"] == male_result["score"] + 1
    
    def test_stroke_tia_2_points(self):
        """Test that stroke/TIA history adds 2 points."""
        result = calculate_cha2ds2_vasc(
            stroke_tia=True,
            age=50,
            sex="male",
        )
        assert result["score"] == 2
    
    def test_age_75_plus_2_points(self):
        """Test that age ≥75 adds 2 points."""
        result = calculate_cha2ds2_vasc(age=75, sex="male")
        assert result["score"] == 2
    
    def test_age_65_74_1_point(self):
        """Test that age 65-74 adds 1 point."""
        result = calculate_cha2ds2_vasc(age=70, sex="male")
        assert result["score"] == 1


# =============================================================================
# HAS-BLED Tests
# =============================================================================

class TestHASBLED:
    """Tests for HAS-BLED calculator."""
    
    def test_zero_score(self):
        """Test zero score for healthy young patient."""
        result = calculate_has_bled(age=30)
        assert result["score"] == 0
        assert "low" in result["interpretation"].lower()
    
    def test_high_bleeding_risk(self):
        """Test high bleeding risk (score ≥3)."""
        result = calculate_has_bled(
            hypertension_uncontrolled=True,
            renal_disease=True,
            stroke_history=True,
            age=70,
        )
        assert result["score"] >= 3
        assert "HIGH" in result["interpretation"] or "high" in result["interpretation"].lower()
    
    def test_elderly_adds_point(self):
        """Test that age >65 adds 1 point."""
        result = calculate_has_bled(age=70)
        assert result["score"] == 1


# =============================================================================
# CURB-65 Tests
# =============================================================================

class TestCURB65:
    """Tests for CURB-65 calculator."""
    
    def test_zero_score(self):
        """Test zero score for healthy patient."""
        result = calculate_curb65(confusion=False, bun=10, rr=20, sbp=120, dbp=80, age=40)
        assert result["score"] == 0
        assert "outpatient" in result["recommendation"].lower()
    
    def test_required_test_case(self):
        """
        Required test case from prompt:
        POST to /api/calculators/curb65 with {"confusion":true,"bun":22,"rr":32,"sbp":85,"age":70}
        
        Expected:
        - Confusion: 1 point
        - BUN >19: 1 point
        - RR ≥30: 1 point
        - SBP <90: 1 point
        - Age ≥65: 1 point
        Total: 5 points → ICU recommendation
        """
        result = calculate_curb65(
            confusion=True,
            bun=22,
            rr=32,
            sbp=85,
            dbp=60,
            age=70,
        )
        assert result["score"] == 5
        assert "ICU" in result["recommendation"]
    
    def test_moderate_severity(self):
        """Test moderate severity (score 2)."""
        result = calculate_curb65(
            confusion=False,
            bun=25,  # 1 point
            rr=32,   # 1 point
            sbp=120,
            dbp=80,
            age=50,
        )
        assert result["score"] == 2
        assert "hospital" in result["recommendation"].lower() or "admission" in result["recommendation"].lower()
    
    def test_bun_threshold(self):
        """Test BUN threshold (>19 mg/dL = 1 point)."""
        result_below = calculate_curb65(bun=19)
        result_above = calculate_curb65(bun=20)
        assert result_above["score"] == result_below["score"] + 1
    
    def test_rr_threshold(self):
        """Test RR threshold (≥30 = 1 point)."""
        result_below = calculate_curb65(rr=29)
        result_above = calculate_curb65(rr=30)
        assert result_above["score"] == result_below["score"] + 1


# =============================================================================
# PERC Rule Tests
# =============================================================================

class TestPERC:
    """Tests for PERC calculator."""
    
    def test_required_test_case(self):
        """
        Required test case from prompt:
        POST PERC with all criteria absent → assert "PE ruled out"
        """
        result = calculate_perc(
            age=40,
            hr=80,
            spo2=98,
            prior_dvt_pe=False,
            hemoptysis=False,
            estrogen_use=False,
            leg_swelling=False,
            surgery_trauma=False,
        )
        assert result["score"] == 0
        assert "pe ruled out" in result["interpretation"].lower() or "excluded" in result["interpretation"].lower()
        assert result["pe_excluded"] is True
    
    def test_age_criterion(self):
        """Test age ≥50 as criterion."""
        result = calculate_perc(age=50)
        assert result["score"] >= 1
        assert "Age" in str(result["criteria_met"])
    
    def test_hr_criterion(self):
        """Test HR ≥100 as criterion."""
        result = calculate_perc(hr=100)
        assert result["score"] >= 1
    
    def test_spo2_criterion(self):
        """Test SpO2 <95% as criterion."""
        result = calculate_perc(spo2=94)
        assert result["score"] >= 1
    
    def test_multiple_criteria(self):
        """Test multiple positive criteria."""
        result = calculate_perc(
            age=55,
            hr=110,
            spo2=92,
        )
        assert result["score"] >= 3
        assert result["pe_excluded"] is False


# =============================================================================
# Wells PE Tests
# =============================================================================

class TestWellsPE:
    """Tests for Wells PE calculator."""
    
    def test_zero_score(self):
        """Test zero/low score."""
        result = calculate_wells_pe()
        assert result["score"] == 0
        assert "unlikely" in result["interpretation"].lower() or "low" in result["interpretation"].lower()
    
    def test_high_probability(self):
        """Test high probability (>4 points)."""
        result = calculate_wells_pe(
            dvt_signs=True,      # 3 points
            pe_most_likely=True, # 3 points
        )
        assert result["score"] == 6
        assert "high" in result["interpretation"].lower() or "likely" in result["interpretation"].lower()
    
    def test_hr_threshold(self):
        """Test HR >100 adds 1.5 points."""
        result = calculate_wells_pe(hr=110)
        assert result["score"] == 1.5
    
    def test_malignancy_point(self):
        """Test malignancy adds 1 point."""
        result = calculate_wells_pe(malignancy=True)
        assert result["score"] == 1


# =============================================================================
# Wells DVT Tests
# =============================================================================

class TestWellsDVT:
    """Tests for Wells DVT calculator."""
    
    def test_zero_score(self):
        """Test zero/low score."""
        result = calculate_wells_dvt()
        assert result["score"] == 0
        assert "low" in result["interpretation"].lower()
    
    def test_high_probability(self):
        """Test high probability (≥2 points)."""
        result = calculate_wells_dvt(
            active_cancer=True,
            entire_leg_swollen=True,
        )
        assert result["score"] >= 2
        assert "high" in result["interpretation"].lower()
    
    def test_alternative_diagnosis_subtracts(self):
        """Test that alternative diagnosis subtracts 2 points."""
        result_without = calculate_wells_dvt(entire_leg_swollen=True)
        result_with = calculate_wells_dvt(entire_leg_swollen=True, alternative_diagnosis=True)
        assert result_with["score"] == result_without["score"] - 2


# =============================================================================
# NEWS2 Tests
# =============================================================================

class TestNEWS2:
    """Tests for NEWS2 calculator."""
    
    def test_zero_score(self):
        """Test zero score for normal vitals."""
        result = calculate_news2(
            rr=16,
            spo2=97,
            supplemental_o2=False,
            temperature=37.0,
            sbp=120,
            hr=70,
            consciousness="alert",
        )
        assert result["score"] == 0
        assert result["clinical_risk_level"] == "low"
    
    def test_high_risk(self):
        """Test high risk (score ≥7)."""
        result = calculate_news2(
            rr=30,
            spo2=90,
            supplemental_o2=True,
            temperature=39.0,
            sbp=85,
            hr=140,
            consciousness="cvpu",
        )
        assert result["score"] >= 7
        assert result["clinical_risk_level"] == "high"
    
    def test_single_parameter_escalation(self):
        """Test single parameter score of 3 triggers escalation."""
        result = calculate_news2(rr=8)  # RR ≤8 scores 3
        assert result["single_parameter_escalation"] is True


# =============================================================================
# SOFA Tests
# =============================================================================

class TestSOFA:
    """Tests for SOFA calculator."""
    
    def test_zero_score(self):
        """Test zero score for normal function."""
        result = calculate_sofa(
            pao2=400,  # PF ratio 400/0.5 = 800 → score 0
            fio2=0.5,
            platelets=200,
            bilirubin=0.8,
            map_value=80,
            vasopressors=False,
            gcs=15,
            creatinine=0.9,
        )
        assert result["score"] == 0
        assert result["has_organ_dysfunction"] is False
    
    def test_organ_dysfunction(self):
        """Test organ dysfunction detection (score ≥2)."""
        result = calculate_sofa(
            pao2=60,
            fio2=0.4,  # PF ratio 150 → score 3
            platelets=100,
            bilirubin=1.5,
            map_value=60,
            vasopressors=False,
            gcs=15,
            creatinine=1.5,
        )
        assert result["score"] >= 2
        assert result["has_organ_dysfunction"] is True
    
    def test_severe_respiratory_failure(self):
        """Test severe respiratory failure scoring."""
        result = calculate_sofa(pao2=40, fio2=0.5)  # PF ratio 80 → score 4
        assert result["organ_scores"]["respiration"] == 4


# =============================================================================
# Glasgow-Blatchford Tests
# =============================================================================

class TestGlasgowBlatchford:
    """Tests for Glasgow-Blatchford calculator."""
    
    def test_zero_score_outpatient(self):
        """Test zero score - safe for outpatient."""
        result = calculate_glasgow_blatchford(
            bun=10,
            hemoglobin=15,
            sbp=120,
            hr=70,
            melena=False,
            syncope=False,
            liver_disease=False,
            cardiac_failure=False,
            gender="male",
        )
        assert result["score"] == 0
        assert result["outpatient_eligible"] is True
    
    def test_high_risk(self):
        """Test high risk score."""
        result = calculate_glasgow_blatchford(
            bun=50,
            hemoglobin=8,
            sbp=90,
            hr=120,
            melena=True,
            syncope=True,
            liver_disease=True,
            cardiac_failure=True,
            gender="male",
        )
        assert result["score"] > 5
        assert result["outpatient_eligible"] is False


# =============================================================================
# 4T Score Tests
# =============================================================================

class Test4TScore:
    """Tests for 4T Score calculator."""
    
    def test_low_probability(self):
        """Test low HIT probability (≤3 points)."""
        result = calculate_4t_score(
            thrombocytopenia="none",
            timing="none",
            thrombosis="none",
            other_cause="definite",
        )
        assert result["score"] <= 3
        assert "low" in result["interpretation"].lower()
    
    def test_intermediate_probability(self):
        """Test intermediate HIT probability (4-5 points)."""
        result = calculate_4t_score(
            thrombocytopenia="mild",
            timing="typical",
            thrombosis="none",
            other_cause="possible",
        )
        assert 4 <= result["score"] <= 5
        assert "intermediate" in result["interpretation"].lower()
    
    def test_high_probability(self):
        """Test high HIT probability (≥6 points)."""
        result = calculate_4t_score(
            thrombocytopenia="severe",
            timing="typical",
            thrombosis="new thrombosis",
            other_cause="none",
        )
        assert result["score"] >= 6
        assert "high" in result["interpretation"].lower()


# =============================================================================
# ASCVD Tests
# =============================================================================

class TestASCVD:
    """Tests for ASCVD 10-year risk calculator."""
    
    def test_low_risk(self):
        """Test low risk patient."""
        result = calculate_ascvd_risk(
            age=35,
            sex="male",
            race="white",
            total_cholesterol=160,
            hdl=60,
            sbp=110,
            htntx=False,
            diabetes=False,
            smoker=False,
        )
        assert result["risk_percent"] < 7.5
        assert result["risk_category"] == "low"
    
    def test_high_risk(self):
        """Test high risk patient."""
        result = calculate_ascvd_risk(
            age=70,
            sex="male",
            race="white",
            total_cholesterol=280,
            hdl=30,
            sbp=160,
            htntx=True,
            diabetes=True,
            smoker=True,
        )
        assert result["risk_percent"] > 20
        assert result["risk_category"] == "high"
    
    def test_female_lower_risk(self):
        """Test that females have lower base risk."""
        male = calculate_ascvd_risk(age=50, sex="male", smoker=True)
        female = calculate_ascvd_risk(age=50, sex="female", smoker=True)
        assert female["risk_percent"] < male["risk_percent"]


# =============================================================================
# Child-Pugh Tests
# =============================================================================

class TestChildPugh:
    """Tests for Child-Pugh calculator."""
    
    def test_class_a(self):
        """Test Class A (5-6 points)."""
        result = calculate_child_pugh(
            total_bilirubin=1.0,
            albumin=4.0,
            pt_inr=1.2,
            ascites="none",
            encephalopathy="none",
        )
        assert result["score"] <= 6
        assert result["child_pugh_class"] == "A"
    
    def test_class_b(self):
        """Test Class B (7-9 points)."""
        result = calculate_child_pugh(
            total_bilirubin=2.5,
            albumin=3.0,
            pt_inr=1.8,
            ascites="mild",
            encephalopathy="none",
        )
        assert 7 <= result["score"] <= 9
        assert result["child_pugh_class"] == "B"
    
    def test_class_c(self):
        """Test Class C (10-15 points)."""
        result = calculate_child_pugh(
            total_bilirubin=5.0,
            albumin=2.5,
            pt_inr=2.5,
            ascites="severe",
            encephalopathy="grade 3-4",
        )
        assert result["score"] >= 10
        assert result["child_pugh_class"] == "C"


# =============================================================================
# Registry and Helper Tests
# =============================================================================

class TestCalculatorRegistry:
    """Tests for calculator registry and helper functions."""
    
    def test_list_calculators(self):
        """Test listing all calculators."""
        calculators = list_calculators()
        assert len(calculators) == 12
        assert any(c["id"] == "cha2ds2vasc" for c in calculators)
    
    def test_get_calculator_by_name(self):
        """Test getting calculator by various names."""
        calc = get_calculator("cha2ds2vasc")
        assert calc is not None
        assert calc["name"] == "CHA2DS2-VASc"
    
    def test_get_calculator_alternative_names(self):
        """Test getting calculator by alternative names."""
        calc1 = get_calculator("curb-65")
        calc2 = get_calculator("curb65")
        assert calc1 is not None
        assert calc2 is not None
        assert calc1["name"] == calc2["name"]
    
    def test_get_calculator_not_found(self):
        """Test getting non-existent calculator."""
        calc = get_calculator("nonexistent")
        assert calc is None
    
    def test_registry_completeness(self):
        """Test that all expected calculators are in registry."""
        expected = [
            "cha2ds2vasc", "hasbled", "curb65", "perc",
            "wells_pe", "wells_dvt", "news2", "sofa",
            "glasgow_blatchford", "4t_score", "ascvd", "child_pugh"
        ]
        for calc_id in expected:
            assert calc_id in CALCULATOR_REGISTRY, f"Missing calculator: {calc_id}"


# =============================================================================
# Integration Tests
# =============================================================================

class TestIntegration:
    """Integration tests for clinical scenarios."""
    
    def test_af_stroke_and_bleeding_risk(self):
        """
        Test calculating both CHA2DS2-VASc and HAS-BLED for AF patient.
        Common clinical scenario: balance stroke risk vs bleeding risk.
        """
        # 75-year-old male with HTN, DM, prior stroke
        stroke_risk = calculate_cha2ds2_vasc(
            age=75,
            hypertension=True,
            diabetes=True,
            stroke_tia=True,
            sex="male",
        )
        bleeding_risk = calculate_has_bled(
            age=75,
            hypertension_uncontrolled=True,
            stroke_history=True,
        )
        
        # High stroke risk should still warrant anticoagulation
        assert stroke_risk["score"] >= 4
        # Bleeding risk is moderate, should prompt risk modification
        assert bleeding_risk["score"] >= 2
    
    def test_pe_diagnostic_pathway(self):
        """
        Test PE diagnostic pathway with Wells PE and PERC.
        """
        # Low-risk patient for PERC
        perc_result = calculate_perc(
            age=35,
            hr=80,
            spo2=98,
            prior_dvt_pe=False,
            hemoptysis=False,
            estrogen_use=False,
            leg_swelling=False,
            surgery_trauma=False,
        )
        
        if perc_result["pe_excluded"]:
            # If PERC negative, no further workup needed
            assert "exclude" in perc_result["interpretation"].lower() or "ruled out" in perc_result["interpretation"].lower()
        else:
            # Otherwise, check Wells PE
            wells_pe = calculate_wells_pe()
            assert wells_pe["score"] is not None
    
    def test_sepsis_assessment(self):
        """
        Test sepsis assessment with qSOFA-like parameters and SOFA.
        """
        # Calculate SOFA for potential sepsis patient
        sofa_result = calculate_sofa(
            pao2=70,
            fio2=0.4,
            platelets=100,
            bilirubin=1.5,
            map_value=60,
            gcs=13,
            creatinine=2.0,
        )
        
        # SOFA ≥2 indicates organ dysfunction
        if sofa_result["score"] >= 2:
            assert sofa_result["has_organ_dysfunction"] is True


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
