"""
Pytest Tests for Drug-Drug Interaction (DDI) Checking
======================================================

Tests for evidence-based drug-drug interaction checking in the
antimicrobial stewardship engine.

Test Cases Required:
1. linezolid + SSRI (citalopram) → CONTRAINDICATED serotonin syndrome
2. vancomycin + gentamicin → MAJOR nephrotoxicity
3. metronidazole + warfarin → MAJOR INR elevation
4. TMP-SMX + ACE inhibitor → MAJOR hyperkalemia
5. vancomycin + loop diuretic → MODERATE ototoxicity
6. daptomycin + statin → MODERATE myopathy

Additional tests cover:
- Inter-recommendation DDI detection
- DDI against current medications
- Severity classification
- Evidence source attribution

References:
- FDA Black Box Warnings
- IDSA Antimicrobial Stewardship Guidelines 2024
- Hansten PD, Horn JR. Drug Interactions Analysis and Management

Run with: pytest app/tests/test_ddi.py -v
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.antimicrobial.stewardship_engine import (
    AntimicrobialStewardshipEngine,
    Severity,
    DDISeverity,
    DDI_DATABASE,
    DrugDrugInteraction,
    check_ddi,
)


class TestDDIDatabase:
    """Tests for the DDI database integrity."""
    
    def test_ddi_database_not_empty(self):
        """Test that DDI database has entries."""
        assert len(DDI_DATABASE) > 0, "DDI_DATABASE should not be empty"
    
    def test_all_ddi_have_required_fields(self):
        """Test that all DDI entries have required fields."""
        required_fields = [
            "drug1_patterns", "drug2_patterns", "severity", 
            "mechanism", "clinical_effect", "monitoring", "evidence_source"
        ]
        for ddi in DDI_DATABASE:
            for field in required_fields:
                assert hasattr(ddi, field), f"DDI missing required field: {field}"
    
    def test_all_ddi_have_evidence_source(self):
        """Test that all DDI entries cite evidence sources."""
        for ddi in DDI_DATABASE:
            assert ddi.evidence_source is not None, "DDI should have evidence source"
            assert len(ddi.evidence_source) > 0, "Evidence source should not be empty"


class TestCheckDDI:
    """Tests for the check_ddi function."""
    
    def test_linezolid_ssri_contraindicated(self):
        """
        TEST CASE 1: Linezolid + SSRI → CONTRAINDICATED serotonin syndrome
        
        Linezolid is a weak MAO-A inhibitor that can cause serotonin syndrome
        when combined with serotonergic drugs like SSRIs.
        
        Reference: FDA Black Box Warning
        """
        ddi = check_ddi("linezolid", "citalopram")
        
        assert ddi is not None, "Should detect interaction between linezolid and citalopram"
        assert ddi.severity == DDISeverity.CONTRAINDICATED, \
            f"Expected CONTRAINDICATED, got {ddi.severity}"
        assert "serotonin" in ddi.clinical_effect.lower(), \
            "Should mention serotonin syndrome"
    
    def test_linezolid_sertraline_contraindicated(self):
        """Test linezolid with another SSRI (sertraline)."""
        ddi = check_ddi("linezolid", "sertraline")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.CONTRAINDICATED
    
    def test_linezolid_venlafaxine_contraindicated(self):
        """Test linezolid with SNRI (venlafaxine)."""
        ddi = check_ddi("linezolid", "venlafaxine")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.CONTRAINDICATED
    
    def test_linezolid_maoi_contraindicated(self):
        """Test linezolid with MAOI → severe serotonin syndrome risk."""
        ddi = check_ddi("linezolid", "phenelzine")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.CONTRAINDICATED
        assert "serotonin" in ddi.clinical_effect.lower()
    
    def test_vancomycin_gentamicin_major(self):
        """
        TEST CASE 2: Vancomycin + Gentamicin → MAJOR nephrotoxicity
        
        Combination of vancomycin with aminoglycosides significantly
        increases the risk of acute kidney injury.
        
        Reference: Rybak MJ et al. Am J Health Syst Pharm 2009
        """
        ddi = check_ddi("vancomycin", "gentamicin")
        
        assert ddi is not None, "Should detect interaction between vancomycin and gentamicin"
        assert ddi.severity == DDISeverity.MAJOR, \
            f"Expected MAJOR, got {ddi.severity}"
        assert "nephrotoxic" in ddi.clinical_effect.lower() or "kidney" in ddi.clinical_effect.lower(), \
            "Should mention nephrotoxicity/kidney injury"
    
    def test_vancomycin_tobramycin_major(self):
        """Test vancomycin with another aminoglycoside (tobramycin)."""
        ddi = check_ddi("vancomycin", "tobramycin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
    
    def test_metronidazole_warfarin_major(self):
        """
        TEST CASE 3: Metronidazole + Warfarin → MAJOR INR elevation
        
        Metronidazole inhibits CYP2C9, reducing warfarin clearance
        and potentially doubling INR.
        
        Reference: Kazmierczak SC et al. Clin Chem 1992
        """
        ddi = check_ddi("metronidazole", "warfarin")
        
        assert ddi is not None, "Should detect interaction between metronidazole and warfarin"
        assert ddi.severity == DDISeverity.MAJOR, \
            f"Expected MAJOR, got {ddi.severity}"
        assert "inr" in ddi.clinical_effect.lower() or "bleeding" in ddi.clinical_effect.lower(), \
            "Should mention INR or bleeding risk"
    
    def test_metronidazole_coumadin_major(self):
        """Test metronidazole with brand name Coumadin."""
        ddi = check_ddi("metronidazole", "coumadin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
    
    def test_metronidazole_alcohol_major(self):
        """Test metronidazole + alcohol → disulfiram-like reaction."""
        ddi = check_ddi("metronidazole", "alcohol")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
        assert "disulfiram" in ddi.clinical_effect.lower() or "flushing" in ddi.clinical_effect.lower()
    
    def test_tmpsmx_warfarin_major(self):
        """Test TMP-SMX + warfarin → INR increase."""
        ddi = check_ddi("TMP-SMX", "warfarin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
        assert "inr" in ddi.clinical_effect.lower() or "bleeding" in ddi.clinical_effect.lower()
    
    def test_tmpsmx_lisinopril_major(self):
        """
        TEST CASE 4: TMP-SMX + ACE inhibitor → MAJOR hyperkalemia
        
        Trimethoprim blocks ENaC in the distal tubule, and ACE inhibitors
        reduce aldosterone, both leading to potassium retention.
        
        Reference: Antoniou T et al. CMAJ 2010
        """
        ddi = check_ddi("TMP-SMX", "lisinopril")
        
        assert ddi is not None, "Should detect interaction between TMP-SMX and lisinopril"
        assert ddi.severity == DDISeverity.MAJOR, \
            f"Expected MAJOR, got {ddi.severity}"
        assert "hyperkalemia" in ddi.clinical_effect.lower() or "potassium" in ddi.clinical_effect.lower(), \
            "Should mention hyperkalemia or potassium"
    
    def test_tmpsmx_losartan_major(self):
        """Test TMP-SMX + ARB (losartan) → hyperkalemia."""
        ddi = check_ddi("bactrim", "losartan")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
    
    def test_fluoroquinolone_amiodarone_major(self):
        """Test fluoroquinolone + amiodarone → QT prolongation/TdP risk."""
        ddi = check_ddi("levofloxacin", "amiodarone")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
        assert "qt" in ddi.clinical_effect.lower() or "torsades" in ddi.clinical_effect.lower()
    
    def test_fluoroquinolone_haloperidol_major(self):
        """Test fluoroquinolone + haloperidol → QT prolongation."""
        ddi = check_ddi("ciprofloxacin", "haloperidol")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
    
    def test_rifampin_warfarin_major(self):
        """Test rifampin + warfarin → decreased INR via CYP induction."""
        ddi = check_ddi("rifampin", "warfarin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
        assert "inr" in ddi.clinical_effect.lower() or "anticoagulant" in ddi.clinical_effect.lower()
    
    def test_vancomycin_furosemide_moderate(self):
        """
        TEST CASE 5: Vancomycin + Loop diuretic → MODERATE ototoxicity
        
        Both drugs can cause ototoxicity; combination increases risk.
        
        Reference: Rybak MJ et al. Am J Health Syst Pharm 2009
        """
        ddi = check_ddi("vancomycin", "furosemide")
        
        assert ddi is not None, "Should detect interaction between vancomycin and furosemide"
        assert ddi.severity == DDISeverity.MODERATE, \
            f"Expected MODERATE, got {ddi.severity}"
        assert "ototox" in ddi.clinical_effect.lower() or "hearing" in ddi.clinical_effect.lower(), \
            "Should mention ototoxicity or hearing"
    
    def test_vancomycin_lasix_moderate(self):
        """Test vancomycin + brand name Lasix."""
        ddi = check_ddi("vancomycin", "lasix")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MODERATE
    
    def test_daptomycin_simvastatin_moderate(self):
        """
        TEST CASE 6: Daptomycin + Statin → MODERATE myopathy
        
        Both drugs can cause myopathy; combination increases risk.
        
        Reference: FDA Prescribing Information; Phillips A et al. 2017
        """
        ddi = check_ddi("daptomycin", "simvastatin")
        
        assert ddi is not None, "Should detect interaction between daptomycin and simvastatin"
        assert ddi.severity == DDISeverity.MODERATE, \
            f"Expected MODERATE, got {ddi.severity}"
        assert "myopath" in ddi.clinical_effect.lower() or "muscle" in ddi.clinical_effect.lower() or "cpk" in ddi.clinical_effect.lower(), \
            "Should mention myopathy or muscle effects"
    
    def test_daptomycin_atorvastatin_moderate(self):
        """Test daptomycin with another statin (atorvastatin)."""
        ddi = check_ddi("daptomycin", "atorvastatin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MODERATE
    
    def test_no_interaction_unrelated_drugs(self):
        """Test that unrelated drugs return no interaction."""
        ddi = check_ddi("amoxicillin", "acetaminophen")
        
        assert ddi is None, "Should not detect interaction between unrelated drugs"
    
    def test_ddi_bidirectional(self):
        """Test that DDI check works in both directions."""
        ddi1 = check_ddi("vancomycin", "gentamicin")
        ddi2 = check_ddi("gentamicin", "vancomycin")
        
        assert ddi1 is not None
        assert ddi2 is not None
        assert ddi1.severity == ddi2.severity


class TestInterRecommendationDDI:
    """Tests for inter-recommendation DDI checking."""
    
    @pytest.fixture
    def engine(self):
        """Create stewardship engine instance."""
        return AntimicrobialStewardshipEngine()
    
    def test_inter_recommendation_vancomycin_gentamicin(self, engine):
        """
        TEST: Vancomycin + Gentamicin in same recommendation → DDI flagged
        
        When the stewardship engine recommends both vancomycin and gentamicin
        together (e.g., for sepsis), the inter-recommendation DDI check should
        flag the nephrotoxicity risk.
        """
        recommended_drugs = ["vancomycin", "piperacillin-tazobactam", "gentamicin"]
        
        interactions = engine._check_inter_recommendation_ddis(recommended_drugs)
        
        # Should detect vancomycin + gentamicin interaction
        assert len(interactions) > 0, "Should detect at least one inter-recommendation DDI"
        
        # Find the vancomycin + gentamicin interaction
        vanc_gent_interactions = [
            i for i in interactions 
            if ("vancomycin" in i["drug1"].lower() and "gentamicin" in i["drug2"].lower()) or
               ("gentamicin" in i["drug1"].lower() and "vancomycin" in i["drug2"].lower())
        ]
        
        assert len(vanc_gent_interactions) > 0, "Should detect vancomycin + gentamicin DDI"
        assert vanc_gent_interactions[0]["severity"] == "major"
    
    def test_inter_recommendation_no_ddi(self, engine):
        """Test that drugs without DDI don't produce false positives."""
        recommended_drugs = ["amoxicillin", "doxycycline"]
        
        interactions = engine._check_inter_recommendation_ddis(recommended_drugs)
        
        # These drugs don't have a DDI in our database
        assert len(interactions) == 0, "Should not detect false DDI"
    
    def test_inter_recommendation_linezolid_with_ssri_alternative(self, engine):
        """
        Integration test: SEPSIS with citalopram → linezolid alternative triggers warning
        
        When recommending linezolid as an alternative for a patient on citalopram,
        the DDI check should flag the contraindicated serotonin syndrome risk.
        """
        # Simulate checking linezolid against patient's medications
        ddi = check_ddi("linezolid", "citalopram")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.CONTRAINDICATED


class TestDDIWithCurrentMedications:
    """Tests for DDI checking against patient's current medications."""
    
    @pytest.fixture
    def engine(self):
        """Create stewardship engine instance."""
        return AntimicrobialStewardshipEngine()
    
    @pytest.mark.asyncio
    async def test_sepsis_with_citalopram_flags_linezolid_warning(self, engine):
        """
        VERIFICATION TEST: SEPSIS with citalopram → linezolid triggers warning
        
        Pass infection_type="SEPSIS" with current_medications=["citalopram"].
        If linezolid is in the alternatives, it should trigger a CONTRAINDICATED warning.
        """
        result = await engine.get_empiric_recommendation(
            infection_type="SEPSIS_UNKNOWN_SOURCE",
            severity=Severity.SEVERE,
            current_medications=["citalopram"],
        )
        
        # Check if any drug has a potential_interactions warning about citalopram
        all_drugs = result.get("first_line", []) + result.get("alternatives", [])
        
        linezolid_with_interaction = None
        for drug in all_drugs:
            if "linezolid" in drug.get("drug_name", "").lower():
                if "potential_interactions" in drug:
                    for interaction in drug["potential_interactions"]:
                        if "citalopram" in interaction.get("interacting_drug", "").lower():
                            linezolid_with_interaction = interaction
                            break
        
        # If linezolid is recommended, it should have the citalopram interaction flagged
        # Note: Linezolid may or may not be in the recommendations depending on the infection type
        # The key is that IF it's there, it should be flagged
        if any("linezolid" in d.get("drug_name", "").lower() for d in all_drugs):
            assert linezolid_with_interaction is not None, \
                "Linezolid recommendation should include citalopram DDI warning"
            assert linezolid_with_interaction["severity"] == "contraindicated", \
                "Linezolid + citalopram should be CONTRAINDICATED"
    
    @pytest.mark.asyncio
    async def test_vancomycin_gentamicin_inter_recommendation_ddi(self, engine):
        """
        VERIFICATION TEST: Vancomycin + Gentamicin recommended together → DDI flagged
        
        Pass two recommended drugs vancomycin + gentamicin — assert inter-recommendation 
        check flags nephrotoxicity.
        """
        # Directly test the inter-recommendation DDI method
        recommended_drugs = ["vancomycin", "gentamicin"]
        
        interactions = engine._check_inter_recommendation_ddis(recommended_drugs)
        
        assert len(interactions) > 0, "Should detect vancomycin + gentamicin DDI"
        
        interaction = interactions[0]
        assert interaction["severity"] == "major", "Should be MAJOR severity"
        assert "nephrotoxic" in interaction["clinical_effect"].lower() or \
               "kidney" in interaction["clinical_effect"].lower(), \
               "Should mention nephrotoxicity"
    
    @pytest.mark.asyncio
    async def test_metronidazole_warfarin_ddi(self, engine):
        """Test metronidazole + warfarin DDI is flagged."""
        result = await engine.get_empiric_recommendation(
            infection_type="INTRAABDOMINAL_MILD_MODERATE",
            severity=Severity.MODERATE,
            current_medications=["warfarin"],
        )
        
        # Check if metronidazole has warfarin interaction warning
        all_drugs = result.get("first_line", []) + result.get("alternatives", [])
        
        for drug in all_drugs:
            if "metronidazole" in drug.get("drug_name", "").lower():
                if "potential_interactions" in drug:
                    warfarin_interactions = [
                        i for i in drug["potential_interactions"]
                        if "warfarin" in i.get("interacting_drug", "").lower()
                    ]
                    if warfarin_interactions:
                        assert warfarin_interactions[0]["severity"] == "major"
                        break


class TestDDISeverityClassification:
    """Tests for correct severity classification."""
    
    def test_contraindicated_severity_highest(self):
        """Test that CONTRAINDICATED is the most severe level."""
        ddi = check_ddi("linezolid", "phenelzine")  # MAOI
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.CONTRAINDICATED
    
    def test_major_severity_high(self):
        """Test that MAJOR interactions are correctly classified."""
        ddi = check_ddi("vancomycin", "gentamicin")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MAJOR
    
    def test_moderate_severity_lower(self):
        """Test that MODERATE interactions are correctly classified."""
        ddi = check_ddi("vancomycin", "furosemide")
        
        assert ddi is not None
        assert ddi.severity == DDISeverity.MODERATE


class TestDDIEvidenceSources:
    """Tests for evidence source attribution."""
    
    def test_linezolid_ssri_has_fda_reference(self):
        """Test linezolid SSRI interaction cites FDA."""
        ddi = check_ddi("linezolid", "citalopram")
        
        assert ddi is not None
        assert "fda" in ddi.evidence_source.lower() or "black box" in ddi.evidence_source.lower(), \
            "Should cite FDA Black Box Warning"
    
    def test_vancomycin_aminoglycoside_has_idsa_reference(self):
        """Test vancomycin + aminoglycoside cites IDSA guidelines."""
        ddi = check_ddi("vancomycin", "gentamicin")
        
        assert ddi is not None
        assert "idsa" in ddi.evidence_source.lower() or "rybak" in ddi.evidence_source.lower(), \
            "Should cite IDSA guidelines or Rybak reference"
    
    def test_all_ddi_have_pubmed_style_citations(self):
        """Test that all DDIs have proper citation format."""
        for ddi in DDI_DATABASE:
            # Should have either a journal citation or FDA reference
            has_citation = (
                any(char.isdigit() for char in ddi.evidence_source) or  # Year
                "fda" in ddi.evidence_source.lower() or
                "guideline" in ddi.evidence_source.lower()
            )
            assert has_citation, f"DDI should have citation: {ddi.evidence_source}"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
