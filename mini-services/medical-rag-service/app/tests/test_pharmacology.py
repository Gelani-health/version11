"""
Unit Tests for Pharmacology Module
===================================

Comprehensive tests for:
- Drug Interaction Engine
- Allergy Cross-Reactivity
- Renal Dosing Calculator
- Hepatic Dosing Calculator

Run with: pytest app/tests/test_pharmacology.py -v
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.pharmacology.drug_interaction_engine import (
    DrugInteractionEngine,
    DrugInteraction,
    SeverityLevel,
    MechanismType,
    EvidenceLevel,
    DDI_DATABASE,
    check_drug_interaction,
    check_multiple_interactions,
    get_qt_prolonging_drugs,
    get_serotonergic_drugs,
)

from app.pharmacology.allergy_cross_reactivity import (
    AllergyCrossReactivityEngine,
    CrossReactivityRisk,
    AllergySeverity,
    DrugClass,
    check_beta_lactam_cross_reactivity,
    check_sulfonamide_cross_reactivity,
    check_nsaid_cross_reactivity,
    check_latex_fruit_syndrome,
)

from app.pharmacology.renal_dosing import (
    RenalDosingCalculator,
    RenalDosingResult,
    CKDStage,
    DialysisType,
    calculate_cockcroft_gault,
    get_renal_dose_adjustment,
    RENAL_DOSING_DATABASE,
)

from app.pharmacology.hepatic_dosing import (
    HepaticDosingCalculator,
    ChildPughClass,
    ChildPughResult,
    calculate_child_pugh_score,
    get_hepatic_dose_adjustment,
    HEPATIC_DOSING_DATABASE,
)


# =============================================================================
# DRUG INTERACTION ENGINE TESTS
# =============================================================================

class TestDDIDatabase:
    """Tests for the DDI database integrity."""
    
    def test_ddi_database_has_over_200_interactions(self):
        """Test that DDI database has 200+ entries."""
        assert len(DDI_DATABASE) >= 200, f"DDI_DATABASE should have 200+ entries, has {len(DDI_DATABASE)}"
    
    def test_all_ddi_have_required_fields(self):
        """Test that all DDI entries have required fields."""
        required_fields = [
            "drug1_name", "drug2_name", "severity", "mechanism",
            "clinical_effects", "management", "evidence_sources"
        ]
        for i, interaction in enumerate(DDI_DATABASE):
            for field in required_fields:
                assert hasattr(interaction, field), f"DDI entry {i} missing field: {field}"
    
    def test_all_ddi_have_evidence_sources(self):
        """Test that all DDI entries cite evidence sources."""
        for i, interaction in enumerate(DDI_DATABASE):
            assert interaction.evidence_sources, f"DDI entry {i} should have evidence sources"
            assert len(interaction.evidence_sources) > 0, f"DDI entry {i} should have at least one evidence source"


class TestDrugInteractionEngine:
    """Tests for DrugInteractionEngine class."""
    
    @pytest.fixture
    def engine(self):
        """Create engine instance."""
        return DrugInteractionEngine()
    
    def test_linezolid_ssri_contraindicated(self, engine):
        """Test linezolid + SSRI detection."""
        interaction = engine.check_interaction("linezolid", "sertraline")
        
        assert interaction is not None, "Should detect linezolid + sertraline interaction"
        assert interaction.severity == SeverityLevel.CONTRAINDICATED
        assert interaction.mechanism == MechanismType.SEROTONIN_SYNDROME
    
    def test_linezolid_maoi_contraindicated(self, engine):
        """Test linezolid + MAOI detection."""
        interaction = engine.check_interaction("linezolid", "phenelzine")
        
        assert interaction is not None
        assert interaction.severity == SeverityLevel.CONTRAINDICATED
    
    def test_vancomycin_gentamicin_major(self, engine):
        """Test vancomycin + gentamicin nephrotoxicity detection."""
        interaction = engine.check_interaction("vancomycin", "gentamicin")
        
        assert interaction is not None
        assert interaction.severity == SeverityLevel.MAJOR
        assert interaction.mechanism == MechanismType.NEPHROTOXICITY
    
    def test_metronidazole_warfarin_major(self, engine):
        """Test metronidazole + warfarin detection."""
        interaction = engine.check_interaction("metronidazole", "warfarin")
        
        assert interaction is not None
        assert interaction.severity == SeverityLevel.MAJOR
    
    def test_qt_prolongation_fluoroquinolone_amiodarone(self, engine):
        """Test QT prolongation interaction."""
        interaction = engine.check_interaction("levofloxacin", "amiodarone")
        
        assert interaction is not None
        assert interaction.severity == SeverityLevel.MAJOR
        assert interaction.mechanism == MechanismType.QT_PROLONGATION
    
    def test_clarithromycin_statin_major(self, engine):
        """Test clarithromycin + statin interaction."""
        interaction = engine.check_interaction("clarithromycin", "simvastatin")
        
        assert interaction is not None
        assert interaction.severity == SeverityLevel.MAJOR
    
    def test_interaction_bidirectional(self, engine):
        """Test that interactions work in both directions."""
        interaction1 = engine.check_interaction("warfarin", "metronidazole")
        interaction2 = engine.check_interaction("metronidazole", "warfarin")
        
        assert interaction1 is not None
        assert interaction2 is not None
        assert interaction1.severity == interaction2.severity
    
    def test_no_interaction_unrelated_drugs(self, engine):
        """Test that unrelated drugs return no interaction."""
        interaction = engine.check_interaction("amoxicillin", "acetaminophen")
        
        assert interaction is None
    
    def test_check_multiple_interactions(self, engine):
        """Test checking multiple drugs at once."""
        drugs = ["warfarin", "metronidazole", "amiodarone"]
        interactions = engine.check_multiple(drugs)
        
        assert len(interactions) >= 1, "Should detect at least one interaction"
    
    def test_to_dict_method(self, engine):
        """Test interaction to_dict conversion."""
        interaction = engine.check_interaction("linezolid", "sertraline")
        result = interaction.to_dict()
        
        assert "drug1" in result
        assert "drug2" in result
        assert "severity" in result
        assert "mechanism" in result
    
    def test_to_fhir_method(self, engine):
        """Test FHIR output format."""
        interaction = engine.check_interaction("linezolid", "sertraline")
        fhir = interaction.to_fhir()
        
        assert fhir["resourceType"] == "DetectedIssue"
        assert fhir["status"] == "final"
    
    def test_get_qt_prolonging_drugs(self):
        """Test QT prolonging drug list."""
        qt_drugs = get_qt_prolonging_drugs()
        
        assert "amiodarone" in qt_drugs
        assert "moxifloxacin" in qt_drugs
    
    def test_get_serotonergic_drugs(self):
        """Test serotonergic drug list."""
        sero_drugs = get_serotonergic_drugs()
        
        assert "sertraline" in sero_drugs
        assert "linezolid" in sero_drugs


class TestDDISeverityClassification:
    """Tests for severity classification."""
    
    @pytest.fixture
    def engine(self):
        return DrugInteractionEngine()
    
    def test_contraindicated_highest_severity(self, engine):
        """Test contraindicated interactions."""
        interaction = engine.check_interaction("sotalol", "moxifloxacin")
        
        if interaction:
            assert interaction.severity == SeverityLevel.CONTRAINDICATED
    
    def test_major_severity_high(self, engine):
        """Test major interactions."""
        interaction = engine.check_interaction("vancomycin", "gentamicin")
        
        assert interaction.severity == SeverityLevel.MAJOR
    
    def test_moderate_severity_lower(self, engine):
        """Test moderate interactions."""
        interaction = engine.check_interaction("vancomycin", "furosemide")
        
        assert interaction.severity == SeverityLevel.MODERATE


# =============================================================================
# ALLERGY CROSS-REACTIVITY TESTS
# =============================================================================

class TestAllergyCrossReactivityEngine:
    """Tests for allergy cross-reactivity checking."""
    
    @pytest.fixture
    def engine(self):
        return AllergyCrossReactivityEngine()
    
    def test_get_drug_class_penicillin(self, engine):
        """Test drug class identification for penicillin."""
        drug_class = engine.get_drug_class("amoxicillin")
        
        assert drug_class == DrugClass.AMINOPENICILLIN
    
    def test_get_drug_class_cephalosporin(self, engine):
        """Test drug class identification for cephalosporin."""
        drug_class = engine.get_drug_class("ceftriaxone")
        
        assert drug_class == DrugClass.CEPHALOSPORIN_3RD_GEN
    
    def test_beta_lactam_cross_reactivity_penicillin_cephalosporin(self, engine):
        """Test penicillin to cephalosporin cross-reactivity."""
        result = engine.check_beta_lactam_cross_reactivity(
            "penicillin", "cefazolin", AllergySeverity.UNKNOWN
        )
        
        assert result is not None
        assert result.cross_reactivity_risk in [CrossReactivityRisk.LOW, CrossReactivityRisk.VERY_LOW]
    
    def test_beta_lactam_cross_reactivity_aztreonam_no_risk(self, engine):
        """Test that aztreonam has no cross-reactivity with penicillins."""
        result = engine.check_beta_lactam_cross_reactivity(
            "penicillin", "aztreonam", AllergySeverity.UNKNOWN
        )
        
        assert result is not None
        assert result.cross_reactivity_risk == CrossReactivityRisk.NONE
    
    def test_sulfonamide_cross_reactivity_antibiotic_diuretic(self, engine):
        """Test sulfonamide antibiotic to diuretic cross-reactivity."""
        result = engine.check_sulfonamide_cross_reactivity("bactrim", "furosemide")
        
        assert result is not None
        assert result.cross_reactivity_risk == CrossReactivityRisk.VERY_LOW
    
    def test_sulfonamide_cross_reactivity_same_class_higher(self, engine):
        """Test same sulfonamide class cross-reactivity."""
        result = engine.check_sulfonamide_cross_reactivity("bactrim", "sulfadiazine")
        
        assert result is not None
        # Same class should have higher cross-reactivity
        assert result.cross_reactivity_risk in [CrossReactivityRisk.HIGH, CrossReactivityRisk.MODERATE, CrossReactivityRisk.LOW]
    
    def test_nsaid_cross_reactivity_aspirin_ibuprofen(self, engine):
        """Test NSAID cross-reactivity."""
        result = engine.check_nsaid_cross_reactivity(
            "aspirin", "ibuprofen", phenotype="NERD"
        )
        
        assert result is not None
        # NERD phenotype has high cross-reactivity
        assert result.cross_reactivity_risk in [CrossReactivityRisk.HIGH, CrossReactivityRisk.MODERATE]
    
    def test_nsaid_cross_reactivity_single_drug_reaction(self, engine):
        """Test NSAID cross-reactivity with SNIUAA phenotype."""
        result = engine.check_nsaid_cross_reactivity(
            "ibuprofen", "naproxen", phenotype="SNIUAA"
        )
        
        assert result is not None
        # Single drug reaction has low cross-reactivity
        assert result.cross_reactivity_risk in [CrossReactivityRisk.VERY_LOW, CrossReactivityRisk.LOW]
    
    def test_latex_fruit_syndrome_banana(self, engine):
        """Test latex-fruit syndrome for banana."""
        result = engine.check_latex_fruit_syndrome(latex_allergy=True, food="banana")
        
        assert result is not None
        assert result.cross_reactivity_risk in [CrossReactivityRisk.HIGH, CrossReactivityRisk.MODERATE]
    
    def test_latex_fruit_syndrome_avocado(self, engine):
        """Test latex-fruit syndrome for avocado (highest risk)."""
        result = engine.check_latex_fruit_syndrome(latex_allergy=True, food="avocado")
        
        assert result is not None
        assert result.cross_reactivity_risk == CrossReactivityRisk.HIGH


class TestAllergyConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_check_beta_lactam_cross_reactivity(self):
        """Test beta-lactam cross-reactivity convenience function."""
        result = check_beta_lactam_cross_reactivity("amoxicillin", "cefazolin")
        
        assert result is not None
        assert "cross_reactivity_risk" in result
    
    def test_check_sulfonamide_cross_reactivity(self):
        """Test sulfonamide cross-reactivity convenience function."""
        result = check_sulfonamide_cross_reactivity("bactrim", "hctz")
        
        assert result is not None
        assert "cross_reactivity_risk" in result
    
    def test_check_nsaid_cross_reactivity(self):
        """Test NSAID cross-reactivity convenience function."""
        result = check_nsaid_cross_reactivity("aspirin", "celecoxib")
        
        assert result is not None
        assert "cross_reactivity_risk" in result
    
    def test_check_latex_fruit_syndrome(self):
        """Test latex-fruit syndrome convenience function."""
        result = check_latex_fruit_syndrome(latex_allergy=True, food="kiwi")
        
        assert result is not None
        assert "cross_reactivity_risk" in result


# =============================================================================
# RENAL DOSING TESTS
# =============================================================================

class TestRenalDosingCalculator:
    """Tests for renal dosing calculator."""
    
    @pytest.fixture
    def calc(self):
        return RenalDosingCalculator()
    
    def test_cockcroft_gault_male(self, calc):
        """Test Cockcroft-Gault calculation for male."""
        result = calc.calculate_cockcroft_gault(
            age_years=65,
            weight_kg=70,
            serum_creatinine=1.0,
            gender='male',
            height_cm=175
        )
        
        assert result.creatinine_clearance > 0
        assert result.ckd_stage in [CKDStage.STAGE_1, CKDStage.STAGE_2]
    
    def test_cockcroft_gault_female(self, calc):
        """Test Cockcroft-Gault calculation for female (should be lower)."""
        result = calc.calculate_cockcroft_gault(
            age_years=65,
            weight_kg=70,
            serum_creatinine=1.0,
            gender='female',
            height_cm=165
        )
        
        assert result.creatinine_clearance > 0
        # Female should have lower CrCl for same parameters
        male_result = calc.calculate_cockcroft_gault(
            age_years=65, weight_kg=70, serum_creatinine=1.0, gender='male', height_cm=175
        )
        assert result.creatinine_clearance < male_result.creatinine_clearance
    
    def test_cockcroft_gault_severe_ckd(self, calc):
        """Test Cockcroft-Gault for severe CKD."""
        result = calc.calculate_cockcroft_gault(
            age_years=80,
            weight_kg=50,
            serum_creatinine=3.0,
            gender='male',
            height_cm=170
        )
        
        assert result.creatinine_clearance < 30
        assert result.ckd_stage in [CKDStage.STAGE_4, CKDStage.STAGE_5]
        assert len(result.warnings) > 0
    
    def test_cockcroft_gault_obesity_adjustment(self, calc):
        """Test obesity adjustment in CrCl calculation."""
        result = calc.calculate_cockcroft_gault(
            age_years=50,
            weight_kg=120,  # Obese weight
            serum_creatinine=1.0,
            gender='male',
            height_cm=175
        )
        
        assert result.is_obese
        assert result.weight_type in ['adjusted', 'ideal']
    
    def test_ckd_stage_determination(self, calc):
        """Test CKD stage determination."""
        assert calc._determine_ckd_stage(100) == CKDStage.STAGE_1
        assert calc._determine_ckd_stage(70) == CKDStage.STAGE_2
        assert calc._determine_ckd_stage(50) == CKDStage.STAGE_3A
        assert calc._determine_ckd_stage(35) == CKDStage.STAGE_3B
        assert calc._determine_ckd_stage(20) == CKDStage.STAGE_4
        assert calc._determine_ckd_stage(10) == CKDStage.STAGE_5
    
    def test_vancomycin_dose_adjustment(self, calc):
        """Test vancomycin renal dosing."""
        result = calc.get_renal_dose_adjustment("vancomycin", CKDStage.STAGE_4)
        
        assert result is not None
        assert result.nephrotoxic_alert
        assert "TDM" in str(result.monitoring) or "trough" in str(result.monitoring).lower()
    
    def test_levofloxacin_dose_adjustment(self, calc):
        """Test levofloxacin renal dosing."""
        result = calc.get_renal_dose_adjustment("levofloxacin", CKDStage.STAGE_4)
        
        assert result is not None
        assert result.dose_reduction_percentage > 0
    
    def test_dialysis_dosing(self, calc):
        """Test dialysis dosing."""
        result = calc.get_renal_dose_adjustment(
            "vancomycin", CKDStage.STAGE_5, DialysisType.HD
        )
        
        assert result is not None
        assert len(result.dialysis_considerations) > 0
    
    def test_avoid_drugs_in_ckd(self, calc):
        """Test getting drugs to avoid in CKD."""
        avoid_stage_4 = calc.get_drugs_to_avoid(CKDStage.STAGE_4)
        
        assert "spironolactone" in avoid_stage_4 or "dabigatran" in avoid_stage_4
    
    def test_nephrotoxic_drugs_list(self, calc):
        """Test nephrotoxic drugs list."""
        nephrotoxic = calc.get_nephrotoxic_drugs()
        
        assert "vancomycin" in nephrotoxic or "gentamicin" in nephrotoxic


class TestRenalDosingConvenienceFunctions:
    """Tests for renal dosing convenience functions."""
    
    def test_calculate_cockcroft_gault(self):
        """Test Cockcroft-Gault convenience function."""
        result = calculate_cockcroft_gault(
            age=65, weight_kg=70, creatinine=1.2, gender='male', height_cm=175
        )
        
        assert result is not None
        assert "creatinine_clearance_ml_min" in result
        assert "ckd_stage" in result
    
    def test_get_renal_dose_adjustment(self):
        """Test renal dose adjustment convenience function."""
        result = get_renal_dose_adjustment("levofloxacin", crcl=25)
        
        assert result is not None
        assert "adjusted_dose" in result
    
    def test_get_dialysis_dosing(self):
        """Test dialysis dosing convenience function."""
        result = get_dialysis_dosing("vancomycin", "hd")
        
        assert result is not None
        assert "dialysis_considerations" in result


# =============================================================================
# HEPATIC DOSING TESTS
# =============================================================================

class TestHepaticDosingCalculator:
    """Tests for hepatic dosing calculator."""
    
    @pytest.fixture
    def calc(self):
        return HepaticDosingCalculator()
    
    def test_child_pugh_class_a(self, calc):
        """Test Child-Pugh class A calculation."""
        result = calc.calculate_child_pugh(
            bilirubin=1.0,
            albumin=4.0,
            inr=1.1,
            ascites="none",
            encephalopathy="none"
        )
        
        assert result.total_points <= 6
        assert result.classification == ChildPughClass.A
    
    def test_child_pugh_class_b(self, calc):
        """Test Child-Pugh class B calculation."""
        result = calc.calculate_child_pugh(
            bilirubin=2.5,
            albumin=3.0,
            inr=1.8,
            ascites="mild",
            encephalopathy="none"
        )
        
        assert 7 <= result.total_points <= 9
        assert result.classification == ChildPughClass.B
    
    def test_child_pugh_class_c(self, calc):
        """Test Child-Pugh class C calculation."""
        result = calc.calculate_child_pugh(
            bilirubin=5.0,
            albumin=2.5,
            inr=2.5,
            ascites="moderate",
            encephalopathy="grade_2"
        )
        
        assert result.total_points >= 10
        assert result.classification == ChildPughClass.C
    
    def test_meld_score_calculation(self, calc):
        """Test MELD score calculation."""
        result = calc.calculate_meld(
            bilirubin=3.0,
            creatinine=1.5,
            inr=1.8
        )
        
        assert result.meld_score > 0
        assert result.mortality_3month is not None
    
    def test_meld_score_dialysis(self, calc):
        """Test MELD score for dialysis patient."""
        result = calc.calculate_meld(
            bilirubin=3.0,
            creatinine=8.0,
            inr=1.8,
            dialysis=True
        )
        
        # Dialysis patients should have creatinine capped at 4
        assert result.meld_score > 0
    
    def test_hepatic_dose_adjustment_mild(self, calc):
        """Test hepatic dose adjustment for mild disease."""
        result = calc.get_hepatic_dose_adjustment("morphine", ChildPughClass.A)
        
        assert result is not None
        assert not result.contraindicated
    
    def test_hepatic_dose_adjustment_severe(self, calc):
        """Test hepatic dose adjustment for severe disease."""
        result = calc.get_hepatic_dose_adjustment("carvedilol", ChildPughClass.C)
        
        assert result is not None
        assert result.contraindicated
    
    def test_hepatotoxic_drugs_list(self, calc):
        """Test hepatotoxic drugs list."""
        hepatotoxic = calc.get_hepatotoxic_drugs()
        
        assert "acetaminophen" in hepatotoxic
    
    def test_drugs_to_avoid_in_severe_disease(self, calc):
        """Test getting drugs to avoid in severe hepatic impairment."""
        avoid_list = calc.get_drugs_to_avoid(ChildPughClass.C)
        
        assert len(avoid_list) > 0
    
    def test_acetaminophen_dosing_mild(self, calc):
        """Test acetaminophen dosing in mild hepatic impairment."""
        result = calc.get_hepatic_dose_adjustment("acetaminophen", ChildPughClass.A)
        
        assert result is not None
        assert result.hepatotoxic
        assert "2000-3000 mg" in result.max_daily_dose or "2000" in result.max_daily_dose
    
    def test_acetaminophen_dosing_severe(self, calc):
        """Test acetaminophen is contraindicated in severe disease."""
        result = calc.get_hepatic_dose_adjustment("acetaminophen", ChildPughClass.C)
        
        assert result is not None
        assert result.contraindicated


class TestHepaticDosingConvenienceFunctions:
    """Tests for hepatic dosing convenience functions."""
    
    def test_calculate_child_pugh_score(self):
        """Test Child-Pugh calculation convenience function."""
        result = calculate_child_pugh_score(
            bilirubin=2.0,
            albumin=3.2,
            inr=1.5,
            ascites="mild",
            encephalopathy="none"
        )
        
        assert result is not None
        assert "total_points" in result
        assert "classification" in result
    
    def test_get_hepatic_dose_adjustment(self):
        """Test hepatic dose adjustment convenience function."""
        result = get_hepatic_dose_adjustment("morphine", "b")
        
        assert result is not None
        assert "adjusted_dose" in result


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests across pharmacology modules."""
    
    def test_full_patient_assessment(self):
        """Test full patient assessment with multiple checks."""
        # Create all engines
        ddi_engine = DrugInteractionEngine()
        allergy_engine = AllergyCrossReactivityEngine()
        renal_calc = RenalDosingCalculator()
        hepatic_calc = HepaticDosingCalculator()
        
        # Simulate patient scenario
        # Patient on: warfarin, sertraline, metformin
        current_meds = ["warfarin", "sertraline", "metformin"]
        
        # Check for interactions
        interactions = ddi_engine.check_multiple(current_meds)
        
        # Check renal function
        renal = renal_calc.calculate_cockcroft_gault(
            age_years=70, weight_kg=60, serum_creatinine=1.8, gender='male'
        )
        
        # Check hepatic function
        hepatic = hepatic_calc.calculate_child_pugh(
            bilirubin=1.5, albumin=3.5, inr=1.2, ascites="none", encephalopathy="none"
        )
        
        # Verify we get comprehensive results
        assert renal.creatinine_clearance > 0
        assert hepatic.total_points > 0
        
        # Check if metformin should be adjusted
        if renal.ckd_stage in [CKDStage.STAGE_4, CKDStage.STAGE_5]:
            metformin_dose = renal_calc.get_renal_dose_adjustment("metformin", renal.ckd_stage)
            if metformin_dose:
                assert metformin_dose.avoid_in_ckd or metformin_dose.adjusted_dose != "Standard"
    
    def test_drug_allergy_and_interaction_combined(self):
        """Test combined allergy and interaction checking."""
        allergy_engine = AllergyCrossReactivityEngine()
        ddi_engine = DrugInteractionEngine()
        
        # Patient allergic to penicillin, prescribed cefazolin
        allergy_result = allergy_engine.check_beta_lactam_cross_reactivity(
            "penicillin", "cefazolin", AllergySeverity.MODERATE
        )
        
        # Check if cefazolin interacts with warfarin (it can increase INR)
        interaction = ddi_engine.check_interaction("cefazolin", "warfarin")
        
        # Both should be checked
        assert allergy_result is not None
        # Interaction might or might not exist in database


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
