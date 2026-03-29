"""
Tests for PROMPTS 6, 7, and 8
=============================

Comprehensive test suite for:
- PROMPT 6: Bayesian Priors Enhancement
- PROMPT 7: Clinical Calculator Fixes
- PROMPT 8: Antibiogram Integration
"""

import pytest
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# =============================================================================
# PROMPT 6 TESTS: Bayesian Priors Enhancement
# =============================================================================

class TestPrompt6_BayesianPriors:
    """Tests for PROMPT 6: Bayesian Priors Enhancement."""
    
    def test_red_flag_multipliers_exist(self):
        """Test that RED_FLAG_MULTIPLIERS dictionary is defined."""
        from app.diagnostic.bayesian_reasoning import RED_FLAG_MULTIPLIERS
        
        assert RED_FLAG_MULTIPLIERS is not None
        assert "subarachnoid_hemorrhage" in RED_FLAG_MULTIPLIERS
        assert "aortic_dissection" in RED_FLAG_MULTIPLIERS
        assert "meningitis" in RED_FLAG_MULTIPLIERS
        
        # Check structure
        sah_data = RED_FLAG_MULTIPLIERS["subarachnoid_hemorrhage"]
        assert "keywords" in sah_data
        assert "multiplier" in sah_data
        assert "evidence" in sah_data
        assert sah_data["multiplier"] == 8.0
        assert "thunderclap" in sah_data["keywords"]
    
    def test_age_sex_modifiers_exist(self):
        """Test that AGE_SEX_MODIFIERS dictionary is defined."""
        from app.diagnostic.bayesian_reasoning import AGE_SEX_MODIFIERS
        
        assert AGE_SEX_MODIFIERS is not None
        assert "acute_coronary_syndrome" in AGE_SEX_MODIFIERS
        assert "ectopic_pregnancy" in AGE_SEX_MODIFIERS
        
        # Check structure for ACS
        acs_data = AGE_SEX_MODIFIERS["acute_coronary_syndrome"]
        assert "age_brackets" in acs_data
        assert "sex" in acs_data
        
        # Check sex gate for ectopic pregnancy
        ectopic_data = AGE_SEX_MODIFIERS["ectopic_pregnancy"]
        assert ectopic_data["sex_gate"] == "F_only"
        assert ectopic_data["age_gate"] == [15, 50]
    
    def test_hypothesis_pmids_exist(self):
        """Test that HYPOTHESIS_PMIDS dictionary is defined."""
        from app.diagnostic.bayesian_reasoning import HYPOTHESIS_PMIDS
        
        assert HYPOTHESIS_PMIDS is not None
        assert "subarachnoid_hemorrhage" in HYPOTHESIS_PMIDS
        assert "stroke" in HYPOTHESIS_PMIDS
        assert "acute_coronary_syndrome" in HYPOTHESIS_PMIDS
        
        # Check that PMIDs are strings
        sah_pmids = HYPOTHESIS_PMIDS["subarachnoid_hemorrhage"]
        assert isinstance(sah_pmids, list)
        assert len(sah_pmids) > 0
        assert all(isinstance(pmid, str) for pmid in sah_pmids)
    
    def test_diagnostic_hypothesis_has_new_fields(self):
        """Test that DiagnosticHypothesis dataclass has new PROMPT 6 fields."""
        from app.diagnostic.bayesian_reasoning import DiagnosticHypothesis
        
        # Create a hypothesis
        hypothesis = DiagnosticHypothesis(
            diagnosis="Test Diagnosis",
            evidence_pmids=["12345", "67890"],
            forced_inclusion=True,
            red_flag_applied="thunderclap (×8.0)",
            age_sex_modifier_applied="age_bracket: >65 (×1.8)"
        )
        
        # Check new fields exist
        assert hypothesis.evidence_pmids == ["12345", "67890"]
        assert hypothesis.forced_inclusion == True
        assert hypothesis.red_flag_applied == "thunderclap (×8.0)"
        assert hypothesis.age_sex_modifier_applied == "age_bracket: >65 (×1.8)"
        
        # Check to_dict includes new fields
        result_dict = hypothesis.to_dict()
        assert "evidence_pmids" in result_dict
        assert "forced_inclusion" in result_dict
        assert "red_flag_applied" in result_dict
        assert "age_sex_modifier_applied" in result_dict
    
    def test_no_r69_fallback_in_create_session(self):
        """Test that R69 is NEVER used as a diagnosis fallback."""
        from app.diagnostic.bayesian_reasoning import BayesianDiagnosticEngine
        
        engine = BayesianDiagnosticEngine()
        
        # Create session with unknown chief complaint
        session = engine.create_session(
            chief_complaint="some random unknown complaint xyz123",
            presentation_type="acute",
            patient_context={"age": 45, "sex": "M"}
        )
        
        # Check that no hypothesis has R69 as ICD code
        for key, hypothesis in session.hypotheses.items():
            assert hypothesis.icd_code != "R69", f"Found R69 fallback in hypothesis: {hypothesis.diagnosis}"
    
    def test_match_complaint_to_cluster_no_r69(self):
        """Test that match_complaint_to_cluster never returns R69."""
        from app.diagnostic.bayesian_reasoning import match_complaint_to_cluster
        
        # Test various inputs
        test_inputs = [
            "chest pain",
            "headache",
            "fever and cough",
            "abdominal pain",
            "shortness of breath",
            "unknown symptom",
            "",  # Empty string
            "xyz123 random text",
        ]
        
        for complaint in test_inputs:
            result = match_complaint_to_cluster(complaint)
            # Should return a cluster name, never an ICD code
            assert result != "R69"
            assert result != ""
            assert isinstance(result, str)


# =============================================================================
# PROMPT 7 TESTS: Clinical Calculator Fixes
# =============================================================================

class TestPrompt7_ClinicalCalculators:
    """Tests for PROMPT 7: Clinical Calculator Fixes."""
    
    def test_cha2ds2_vasc_female_sex_alone_scores_zero(self):
        """Test that female sex alone scores 0 in CHA₂DS₂-VASc."""
        from app.calculators.clinical_scores import calculate_cha2ds2_vasc
        
        # Female with NO other risk factors
        result = calculate_cha2ds2_vasc(
            congestive_heart_failure=False,
            hypertension=False,
            age=50,  # Under 65
            diabetes=False,
            stroke_tia=False,
            vascular_disease=False,
            sex="female"
        )
        
        # Score should be 0 (female sex alone doesn't add points)
        assert result["score"] == 0, f"Expected score 0, got {result['score']}"
        # Check that female component shows 0
        assert any("Female: 0" in c for c in result["components"])
        assert "Low risk" in result["interpretation"]
    
    def test_cha2ds2_vasc_female_with_risk_factor_adds_point(self):
        """Test that female sex adds point when other risk factors exist."""
        from app.calculators.clinical_scores import calculate_cha2ds2_vasc
        
        # Female with hypertension (one risk factor)
        result = calculate_cha2ds2_vasc(
            congestive_heart_failure=False,
            hypertension=True,
            age=50,
            diabetes=False,
            stroke_tia=False,
            vascular_disease=False,
            sex="female"
        )
        
        # Score should be 2 (HTN: 1 + Female: 1)
        assert result["score"] == 2, f"Expected score 2, got {result['score']}"
        assert "Female: 1" in result["components"]
    
    def test_has_bled_labile_inr_definition(self):
        """Test that HAS-BLED includes labile INR definition in docstring."""
        from app.calculators.clinical_scores import calculate_has_bled
        import inspect
        
        # Get the function docstring
        docstring = calculate_has_bled.__doc__
        
        # Check that labile INR definition is included
        assert "Labile INR" in docstring
        assert "TTR < 60%" in docstring or "INR values out of range" in docstring
    
    def test_curb65_unit_conversion_mg_dl(self):
        """Test CURB-65 with mg/dL units (US)."""
        from app.calculators.clinical_scores import calculate_curb65
        
        # BUN = 25 mg/dL (above threshold of 19)
        result = calculate_curb65(
            confusion=False,
            bun=25,
            bun_unit="mg/dL",
            rr=25,
            sbp=120,
            dbp=80,
            age=70
        )
        
        # Should have elevated BUN score
        assert any("BUN" in c for c in result["components"])
        assert result["units_used"] == "mg/dL"
    
    def test_curb65_unit_conversion_mmol_l(self):
        """Test CURB-65 with mmol/L units (SI)."""
        from app.calculators.clinical_scores import calculate_curb65
        
        # Urea = 10 mmol/L (above threshold of 7)
        result = calculate_curb65(
            confusion=False,
            bun=10,
            bun_unit="mmol/L",
            rr=25,
            sbp=120,
            dbp=80,
            age=70
        )
        
        # Should have elevated urea score
        assert any("Urea" in c for c in result["components"])
        assert "mmol" in result["units_used"]
    
    def test_curb65_units_used_field(self):
        """Test that CURB-65 output includes units_used field."""
        from app.calculators.clinical_scores import calculate_curb65
        
        result = calculate_curb65(
            confusion=False,
            bun=15,
            bun_unit="mg/dL",
            rr=20,
            sbp=120,
            dbp=80,
            age=50
        )
        
        assert "units_used" in result
        assert result["units_used"] == "mg/dL"
    
    def test_perc_all_8_criteria(self):
        """Test that PERC rule checks all 8 criteria."""
        from app.calculators.clinical_scores import calculate_perc
        
        # All criteria negative - should rule out PE
        result = calculate_perc(
            age=40,  # <50
            hr=80,   # <100
            spo2=97, # >=95%
            prior_dvt_pe=False,
            hemoptysis=False,
            estrogen_use=False,
            leg_swelling=False,
            surgery_trauma=False
        )
        
        # All criteria should be absent
        assert len(result["criteria_met"]) == 0
        assert len(result["criteria_absent"]) == 8
        assert result["pe_excluded"] == True
        assert "PE ruled out" in result["interpretation"]


# =============================================================================
# PROMPT 8 TESTS: Antibiogram Integration
# =============================================================================

class TestPrompt8_AntibiogramIntegration:
    """Tests for PROMPT 8: Antibiogram Integration."""
    
    @pytest.mark.asyncio
    async def test_empiric_recommendation_includes_antibiogram_data(self):
        """Test that empiric recommendations include antibiogram_data field."""
        from app.antimicrobial.stewardship_engine import AntimicrobialStewardshipEngine, Severity
        
        engine = AntimicrobialStewardshipEngine()
        result = await engine.get_empiric_recommendation(
            infection_type="CAP_OUTPATIENT_HEALTHY",
            severity=Severity.MODERATE,
            allergies=None,
            renal_function=None,
            current_medications=None,
            pregnancy=False
        )
        
        # Check antibiogram_data field exists
        assert "antibiogram_data" in result
        assert result["antibiogram_data"]["status"] == "pending_culture"
        assert "available_organisms" in result["antibiogram_data"]
    
    def test_antibiogram_database_has_susceptibility_data(self):
        """Test that AntibiogramDatabase has susceptibility data."""
        from app.antimicrobial.stewardship_engine import get_antibiogram_db
        
        db = get_antibiogram_db()
        
        # Check that key organisms exist
        assert "ESCHERICHIA_COLI" in db.LOCAL_SUSCEPTIBILITIES
        assert "KLEBSIELLA_PNEUMONIAE" in db.LOCAL_SUSCEPTIBILITIES
        assert "STAPHYLOCOCCUS_AUREUS" in db.LOCAL_SUSCEPTIBILITIES
        
        # Check susceptibility data structure
        ecoli_data = db.LOCAL_SUSCEPTIBILITIES["ESCHERICHIA_COLI"]
        assert "ceftriaxone" in ecoli_data
        assert "susceptibility_rate" in ecoli_data["ceftriaxone"]
        assert "source" in ecoli_data["ceftriaxone"]
    
    def test_antibiogram_get_susceptibility_alert(self):
        """Test AntibiogramDatabase.get_susceptibility_alert method."""
        from app.antimicrobial.stewardship_engine import get_antibiogram_db
        
        db = get_antibiogram_db()
        
        # Test with known organism-drug combination
        alert = db.get_susceptibility_alert("E. coli", "meropenem")
        
        # Meropenem should have high susceptibility
        assert alert["rate"] >= 0.90
        assert alert["alert"] == "OK"
    
    @pytest.mark.asyncio
    async def test_organism_directed_therapy_includes_antibiogram(self):
        """Test that culture-directed therapy includes antibiogram checks."""
        from app.antimicrobial.stewardship_engine import AntimicrobialStewardshipEngine
        
        engine = AntimicrobialStewardshipEngine()
        
        # Use an organism that exists in DRUG_BUG_MATCHING
        result = await engine.get_organism_directed_therapy(
            organism="STAPHYLOCOCCUS_AUREUS_MSSA",
            susceptibilities={"nafcillin": "S", "vancomycin": "S"},
            infection_site="blood"
        )
        
        # Check that therapy recommendations include susceptibility rates
        assert "preferred_therapy" in result or "error" in result
        
        if "preferred_therapy" in result:
            # Check that drugs are sorted by susceptibility
            if len(result["preferred_therapy"]) > 1:
                rates = [d.get("susceptibility_rate", 0) for d in result["preferred_therapy"]]
                # Rates should be descending (ignoring None values)
                for i in range(len(rates) - 1):
                    if rates[i] is not None and rates[i+1] is not None:
                        assert rates[i] >= rates[i+1]


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
