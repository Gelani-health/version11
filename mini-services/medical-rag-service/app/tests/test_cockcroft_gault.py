"""
Pytest Tests for Cockcroft-Gault Creatinine Clearance Calculations
===================================================================

Tests cover the clinical scenarios described in the fix requirements:
1. 70kg male, height 175cm, age 65, Cr 1.2 → expected ~65 mL/min
2. 45kg elderly female, age 80, Cr 1.8 → expected ~18 mL/min (DANGEROUS if calculated as 70kg)
3. 130kg obese male → uses AdjBW not actual weight
4. Missing height → returns result with warning, not error

References:
- Cockcroft DW, Gault MH. Nephron 1976;16:31-41
- Devine BJ. Drug Intell Clin Pharm 1974;8:650-655
- Winter MA, et al. Am J Health-Syst Pharm 2012;69:293-301

Run with: pytest app/tests/test_cockcroft_gault.py -v
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.calculators.renal_calculations import (
    calculate_ideal_body_weight,
    calculate_adjusted_body_weight,
    select_weight_for_crcl,
    calculate_creatinine_clearance,
    get_renal_dosing_category,
    RenalCalculationRequest,
    create_renal_calculation_response,
    WeightType,
)


class TestIdealBodyWeight:
    """Tests for Ideal Body Weight (Devine Formula)."""
    
    def test_ibw_male_average_height(self):
        """
        Test IBW calculation for average height male.
        
        Male, 175 cm (68.9 inches):
        IBW = 50 + 2.3 × (68.9 - 60) = 50 + 20.47 ≈ 70.5 kg
        """
        ibw = calculate_ideal_body_weight(height_cm=175, gender='male')
        assert 70.0 <= ibw <= 71.0, f"Expected ~70.5 kg, got {ibw} kg"
    
    def test_ibw_female_average_height(self):
        """
        Test IBW calculation for average height female.
        
        Female, 163 cm (64.2 inches):
        IBW = 45.5 + 2.3 × (64.2 - 60) = 45.5 + 9.66 ≈ 55.2 kg
        """
        ibw = calculate_ideal_body_weight(height_cm=163, gender='female')
        assert 55.0 <= ibw <= 55.5, f"Expected ~55.2 kg, got {ibw} kg"
    
    def test_ibw_tall_male(self):
        """
        Test IBW for tall male.
        
        Male, 185 cm (72.8 inches):
        IBW = 50 + 2.3 × (72.8 - 60) = 50 + 29.44 ≈ 79.4 kg
        """
        ibw = calculate_ideal_body_weight(height_cm=185, gender='male')
        assert 79.0 <= ibw <= 80.0, f"Expected ~79.4 kg, got {ibw} kg"
    
    def test_ibw_short_female(self):
        """
        Test IBW for short female (height ≤ 60 inches).
        
        Female, 150 cm (59 inches):
        IBW = 45.5 kg (base weight, no increment)
        """
        ibw = calculate_ideal_body_weight(height_cm=150, gender='female')
        assert ibw == 45.5, f"Expected 45.5 kg for short female, got {ibw} kg"
    
    def test_ibw_very_tall_male(self):
        """
        Test IBW for very tall male.
        
        Male, 193 cm (76 inches):
        IBW = 50 + 2.3 × (76 - 60) = 50 + 36.8 = 86.8 kg
        """
        ibw = calculate_ideal_body_weight(height_cm=193, gender='male')
        assert 86.0 <= ibw <= 87.5, f"Expected ~86.8 kg, got {ibw} kg"


class TestAdjustedBodyWeight:
    """Tests for Adjusted Body Weight (obese patients)."""
    
    def test_adjbw_obese_patient(self):
        """
        Test AdjBW for obese patient.
        
        IBW = 70 kg, Actual = 130 kg
        AdjBW = 70 + 0.4 × (130 - 70) = 70 + 24 = 94 kg
        """
        adjbw = calculate_adjusted_body_weight(ideal_body_weight=70, actual_weight_kg=130)
        assert adjbw == 94.0, f"Expected 94 kg, got {adjbw} kg"
    
    def test_adjbw_morbidly_obese(self):
        """
        Test AdjBW for morbidly obese patient.
        
        IBW = 70 kg, Actual = 150 kg
        AdjBW = 70 + 0.4 × (150 - 70) = 70 + 32 = 102 kg
        """
        adjbw = calculate_adjusted_body_weight(ideal_body_weight=70, actual_weight_kg=150)
        assert adjbw == 102.0, f"Expected 102 kg, got {adjbw} kg"
    
    def test_adjbw_slightly_overweight(self):
        """
        Test AdjBW for slightly overweight patient (just above 130% IBW).
        
        IBW = 70 kg, Actual = 92 kg (131% IBW)
        AdjBW = 70 + 0.4 × (92 - 70) = 70 + 8.8 = 78.8 kg
        """
        adjbw = calculate_adjusted_body_weight(ideal_body_weight=70, actual_weight_kg=92)
        assert adjbw == 78.8, f"Expected 78.8 kg, got {adjbw} kg"


class TestWeightSelection:
    """Tests for weight selection algorithm in CrCl calculation."""
    
    def test_weight_selection_normal_weight(self):
        """
        Test weight selection for normal weight patient.
        
        Actual weight = 70 kg, IBW ≈ 70 kg
        Should use actual weight (not obese)
        """
        weight, weight_type, ibw, adjbw, is_obese, ratio = select_weight_for_crcl(
            actual_weight_kg=70,
            height_cm=175,
            gender='male',
        )
        assert weight == 70, f"Expected weight 70 kg, got {weight} kg"
        assert weight_type == WeightType.ACTUAL
        assert not is_obese
        assert ratio is not None and ratio < 1.3
    
    def test_weight_selection_obese_patient(self):
        """
        Test weight selection for obese patient (>130% IBW).
        
        Actual weight = 130 kg, IBW ≈ 70 kg (185% IBW)
        Should use adjusted body weight
        """
        weight, weight_type, ibw, adjbw, is_obese, ratio = select_weight_for_crcl(
            actual_weight_kg=130,
            height_cm=175,
            gender='male',
        )
        assert weight_type == WeightType.ADJUSTED
        assert is_obese
        assert ratio > 1.3
        assert adjbw is not None
        assert weight == adjbw  # Should use AdjBW
    
    def test_weight_selection_underweight_patient(self):
        """
        Test weight selection for underweight patient.
        
        Actual weight = 45 kg, IBW ≈ 70 kg (64% IBW)
        Should use actual weight (underweight)
        """
        weight, weight_type, ibw, adjbw, is_obese, ratio = select_weight_for_crcl(
            actual_weight_kg=45,
            height_cm=175,
            gender='male',
        )
        assert weight_type == WeightType.ACTUAL
        assert weight == 45
        assert not is_obese
        assert ratio < 1.0
    
    def test_weight_selection_no_height(self):
        """
        Test weight selection when height is not provided.
        
        Should use actual weight with appropriate warnings.
        """
        weight, weight_type, ibw, adjbw, is_obese, ratio = select_weight_for_crcl(
            actual_weight_kg=130,
            height_cm=None,
            gender='male',
        )
        assert weight == 130
        assert weight_type == WeightType.ACTUAL
        assert ibw is None  # Cannot calculate without height
        assert not is_obese  # Cannot determine obesity


class TestCockcroftGault:
    """
    Tests for Cockcroft-Gault Creatinine Clearance calculation.
    
    These tests verify the CRITICAL fix for the hardcoded weight issue.
    """
    
    def test_normal_male_average_build(self):
        """
        TEST CASE 1: 70kg male, height 175cm, age 65, Cr 1.2
        
        Expected CrCl: ~65 mL/min
        
        Calculation:
        IBW ≈ 70.5 kg (close to actual, use actual)
        CrCl = (140-65) × 70 / (72 × 1.2) = 5250 / 86.4 ≈ 60.8 mL/min
        """
        result = calculate_creatinine_clearance(
            age_years=65,
            weight_kg=70,
            serum_creatinine=1.2,
            gender='male',
            height_cm=175,
        )
        
        # CrCl should be approximately 60-65 mL/min
        assert 58 <= result.creatinine_clearance <= 68, \
            f"Expected CrCl ~62 mL/min, got {result.creatinine_clearance} mL/min"
        assert result.weight_type == WeightType.ACTUAL
        assert not result.is_obese
        assert result.ideal_body_weight is not None
        assert 70 <= result.ideal_body_weight <= 71
    
    def test_elderly_female_low_weight(self):
        """
        TEST CASE 2: 45kg elderly female, age 80, Cr 1.8
        
        CRITICAL: Previously calculated with hardcoded 70kg → ~30 mL/min
                  Correct calculation with 45kg → ~18 mL/min
                  
        This 66% error could cause VANCOMYCIN/AMINOGLYCOSIDE TOXICITY!
        
        Calculation:
        IBW ≈ 52 kg (for 155 cm), Actual = 45 kg (use actual - underweight)
        CrCl = (140-80) × 45 / (72 × 1.8) × 0.85 = 2700 / 129.6 × 0.85 ≈ 17.7 mL/min
        
        If incorrectly used 70kg:
        CrCl_wrong = (140-80) × 70 / (72 × 1.8) × 0.85 ≈ 27.5 mL/min
        """
        result = calculate_creatinine_clearance(
            age_years=80,
            weight_kg=45,
            serum_creatinine=1.8,
            gender='female',
            height_cm=155,
        )
        
        # CrCl should be approximately 17-20 mL/min (NOT ~30!)
        assert 15 <= result.creatinine_clearance <= 22, \
            f"Expected CrCl ~18 mL/min, got {result.creatinine_clearance} mL/min"
        
        # Verify we're using the actual 45kg weight, not a hardcoded 70kg
        assert result.weight_used == 45, \
            f"Expected weight_used 45 kg, got {result.weight_used} kg"
        
        # Verify this is severe renal impairment
        assert result.creatinine_clearance < 30, \
            "Elderly low-weight female should have severe renal impairment"
        
        # Should have warnings about severe impairment
        assert len(result.warnings) > 0, "Should have clinical warnings"
        assert any("SEVERE RENAL IMPAIRMENT" in w for w in result.warnings), \
            "Should warn about severe renal impairment"
    
    def test_obese_male(self):
        """
        TEST CASE 3: 130kg obese male, height 175cm, age 55, Cr 1.0
        
        Should use Adjusted Body Weight, not actual weight.
        
        Calculation:
        IBW ≈ 70.5 kg
        Actual weight = 130 kg (184% of IBW) → OBESE
        AdjBW = 70.5 + 0.4 × (130 - 70.5) = 70.5 + 23.8 = 94.3 kg
        
        CrCl with AdjBW = (140-55) × 94.3 / (72 × 1.0) ≈ 111 mL/min
        CrCl with actual = (140-55) × 130 / (72 × 1.0) ≈ 153 mL/min (WRONG!)
        """
        result = calculate_creatinine_clearance(
            age_years=55,
            weight_kg=130,
            serum_creatinine=1.0,
            gender='male',
            height_cm=175,
        )
        
        # Should use adjusted body weight
        assert result.weight_type == WeightType.ADJUSTED, \
            f"Expected ADJUSTED weight type, got {result.weight_type}"
        assert result.is_obese, "Should identify as obese"
        
        # Weight used should be AdjBW (~94 kg), not actual (130 kg)
        assert 90 <= result.weight_used <= 100, \
            f"Expected weight_used ~94 kg (AdjBW), got {result.weight_used} kg"
        
        # CrCl should be ~110 mL/min (using AdjBW), NOT ~150 mL/min
        assert 100 <= result.creatinine_clearance <= 120, \
            f"Expected CrCl ~111 mL/min (with AdjBW), got {result.creatinine_clearance} mL/min"
        
        # Should have obesity warning
        assert any("obese" in w.lower() for w in result.warnings), \
            "Should warn about obesity adjustment"
    
    def test_missing_height_warning(self):
        """
        TEST CASE 4: Missing height → returns result with warning, not error
        
        When height is not provided, IBW cannot be calculated.
        System should:
        1. Still provide CrCl estimate using actual weight
        2. Include warning about inability to adjust for obesity
        3. NOT throw an error
        """
        result = calculate_creatinine_clearance(
            age_years=65,
            weight_kg=100,  # Potentially obese
            serum_creatinine=1.2,
            gender='male',
            height_cm=None,  # Missing height!
        )
        
        # Should NOT fail - must return a result
        assert result.creatinine_clearance is not None
        assert result.creatinine_clearance > 0
        
        # Should use actual weight (no height for IBW)
        assert result.weight_type == WeightType.ACTUAL
        assert result.weight_used == 100
        
        # Should have warning about missing height
        assert len(result.warnings) > 0
        assert any("height" in w.lower() for w in result.warnings), \
            f"Should warn about missing height. Warnings: {result.warnings}"
        
        # IBW should be None
        assert result.ideal_body_weight is None
    
    def test_young_male_normal_renal_function(self):
        """
        Test young male with normal renal function.
        
        Age 30, weight 80 kg, height 180 cm, Cr 0.9
        Expected: Normal renal function (CrCl > 90)
        """
        result = calculate_creatinine_clearance(
            age_years=30,
            weight_kg=80,
            serum_creatinine=0.9,
            gender='male',
            height_cm=180,
        )
        
        assert result.creatinine_clearance > 100, \
            f"Expected normal CrCl > 100, got {result.creatinine_clearance}"
    
    def test_elderly_male_moderate_impairment(self):
        """
        Test elderly male with moderate renal impairment.
        
        Age 75, weight 70 kg, height 170 cm, Cr 1.5
        Expected: Moderate impairment (CrCl 30-59)
        """
        result = calculate_creatinine_clearance(
            age_years=75,
            weight_kg=70,
            serum_creatinine=1.5,
            gender='male',
            height_cm=170,
        )
        
        # Expected: (140-75) × 70 / (72 × 1.5) = 4550 / 108 ≈ 42 mL/min
        assert 35 <= result.creatinine_clearance <= 50, \
            f"Expected moderate impairment (30-59), got {result.creatinine_clearance}"
    
    def test_female_correction_factor(self):
        """
        Verify female correction factor (0.85) is applied.
        
        Same parameters for male and female should give different results,
        with female CrCl being 85% of male CrCl.
        """
        male_result = calculate_creatinine_clearance(
            age_years=60,
            weight_kg=70,
            serum_creatinine=1.0,
            gender='male',
            height_cm=175,
        )
        
        female_result = calculate_creatinine_clearance(
            age_years=60,
            weight_kg=70,
            serum_creatinine=1.0,
            gender='female',
            height_cm=175,
        )
        
        ratio = female_result.creatinine_clearance / male_result.creatinine_clearance
        assert 0.83 <= ratio <= 0.87, \
            f"Expected ratio ~0.85, got {ratio}"
    
    def test_esrd_patient(self):
        """
        Test patient with end-stage renal disease.
        
        Age 70, weight 60 kg, Cr 4.5
        Expected: CrCl < 15 (ESRD category)
        """
        result = calculate_creatinine_clearance(
            age_years=70,
            weight_kg=60,
            serum_creatinine=4.5,
            gender='male',
            height_cm=170,
        )
        
        assert result.creatinine_clearance < 15, \
            f"Expected CrCl < 15 for ESRD, got {result.creatinine_clearance}"
        
        # Should have critical warnings
        assert any("CRITICAL" in w or "ESRD" in w or "dialysis" in w.lower() 
                   for w in result.warnings + result.calculation_notes)


class TestRenalDosingCategory:
    """Tests for renal dosing category classification."""
    
    def test_normal_category(self):
        """CrCl >= 90 should be normal."""
        category, considerations = get_renal_dosing_category(95)
        assert category == "normal"
    
    def test_mild_category(self):
        """CrCl 60-89 should be mild."""
        category, considerations = get_renal_dosing_category(75)
        assert category == "mild"
    
    def test_moderate_category(self):
        """CrCl 30-59 should be moderate."""
        category, considerations = get_renal_dosing_category(45)
        assert category == "moderate"
        assert any("adjustment" in c.lower() or "reduction" in c.lower() 
                   for c in considerations)
    
    def test_severe_category(self):
        """CrCl 15-29 should be severe."""
        category, considerations = get_renal_dosing_category(22)
        assert category == "severe"
        assert len(considerations) > 2  # Should have multiple considerations
    
    def test_esrd_category(self):
        """CrCl < 15 should be ESRD."""
        category, considerations = get_renal_dosing_category(10)
        assert category == "esrd"
        assert any("dialysis" in c.lower() or "dialyzability" in c.lower() 
                   for c in considerations)


class TestPydanticModels:
    """Tests for Pydantic request/response models."""
    
    def test_valid_request(self):
        """Test valid RenalCalculationRequest."""
        request = RenalCalculationRequest(
            age_years=65,
            weight_kg=70,
            serum_creatinine=1.2,
            gender='male',
            height_cm=175,
        )
        assert request.age_years == 65
        assert request.weight_kg == 70
    
    def test_gender_normalization(self):
        """Test gender field normalization."""
        # Test various gender inputs
        for gender_input, expected in [('MALE', 'male'), ('M', 'male'), 
                                        ('Female', 'female'), ('f', 'female')]:
            request = RenalCalculationRequest(
                age_years=50,
                weight_kg=70,
                serum_creatinine=1.0,
                gender=gender_input,
            )
            assert request.gender == expected
    
    def test_invalid_gender(self):
        """Test that invalid gender raises validation error."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            RenalCalculationRequest(
                age_years=50,
                weight_kg=70,
                serum_creatinine=1.0,
                gender='unknown',
            )
    
    def test_extreme_creatinine_warning(self):
        """Test that very low creatinine raises validation warning."""
        with pytest.raises(Exception):  # Should fail validation
            RenalCalculationRequest(
                age_years=50,
                weight_kg=70,
                serum_creatinine=0.1,  # Suspiciously low
                gender='male',
            )
    
    def test_full_response(self):
        """Test full response creation."""
        request = RenalCalculationRequest(
            age_years=65,
            weight_kg=70,
            serum_creatinine=1.2,
            gender='male',
            height_cm=175,
        )
        
        response = create_renal_calculation_response(request)
        
        assert response.creatinine_clearance_ml_min > 0
        assert response.weight_type in ['actual', 'ideal', 'adjusted']
        assert response.renal_impairment_severity in [
            'normal', 'mild', 'moderate', 'severe', 'esrd'
        ]
        assert len(response.evidence_sources) > 0


class TestClinicalScenarios:
    """
    Integration tests for real-world clinical scenarios.
    
    These tests verify the complete workflow for medication dosing
    decisions based on renal function.
    """
    
    def test_vancomycin_dosing_scenario(self):
        """
        Clinical scenario: Vancomycin dosing in elderly female.
        
        Patient: 80-year-old female, 50 kg, 160 cm, Cr 1.5
        
        This is a common scenario where incorrect CrCl would lead to
        vancomycin accumulation and potential nephrotoxicity.
        """
        result = calculate_creatinine_clearance(
            age_years=80,
            weight_kg=50,
            serum_creatinine=1.5,
            gender='female',
            height_cm=160,
        )
        
        # Expected: CrCl ≈ (140-80) × 50 / (72 × 1.5) × 0.85 ≈ 23.6 mL/min
        # Severe impairment - vancomycin requires significant adjustment
        assert result.creatinine_clearance < 30, \
            f"Elderly female should have severe impairment, got {result.creatinine_clearance}"
        
        # Should have severe renal warning
        assert any("SEVERE" in w for w in result.warnings)
    
    def test_dabigatran_dosing_scenario(self):
        """
        Clinical scenario: Dabigatran dosing for atrial fibrillation.
        
        Patient: 72-year-old male, 68 kg, 172 cm, Cr 1.3
        
        Dabigatran has strict CrCl-based dosing:
        - CrCl > 50: 150 mg BID
        - CrCl 30-50: 150 mg BID (or 75 mg BID if bleeding risk)
        - CrCl 15-30: 75 mg BID (avoid if CrCl < 15)
        """
        result = calculate_creatinine_clearance(
            age_years=72,
            weight_kg=68,
            serum_creatinine=1.3,
            gender='male',
            height_cm=172,
        )
        
        # Expected: CrCl ≈ (140-72) × 68 / (72 × 1.3) ≈ 49.4 mL/min
        # Borderline moderate impairment
        assert 40 <= result.creatinine_clearance <= 60, \
            f"Expected borderline moderate impairment, got {result.creatinine_clearance}"
    
    def test_metformin_contraindication_scenario(self):
        """
        Clinical scenario: Metformin eligibility.
        
        Patient: 65-year-old female, 55 kg, 158 cm, Cr 1.8
        
        Metformin is contraindicated if eGFR < 30.
        CrCl calculation is critical for this decision.
        """
        result = calculate_creatinine_clearance(
            age_years=65,
            weight_kg=55,
            serum_creatinine=1.8,
            gender='female',
            height_cm=158,
        )
        
        # Expected: CrCl ≈ (140-65) × 55 / (72 × 1.8) × 0.85 ≈ 27 mL/min
        # Should be severe impairment - metformin caution
        assert result.creatinine_clearance < 35, \
            f"Expected severe impairment for metformin caution, got {result.creatinine_clearance}"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
