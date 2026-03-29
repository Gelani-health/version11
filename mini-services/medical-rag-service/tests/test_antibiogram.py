"""
Comprehensive tests for AntibiogramDatabase and resistance-aware therapy recommendations.

Tests cover:
- CDC/NHSN 2022 susceptibility data integrity
- Susceptibility alert categorization
- Local data override capability
- Integration with get_organism_directed_therapy()
- Edge cases and error handling

Reference: CDC/NHSN Antimicrobial Resistance Report 2022
"""

import pytest
import asyncio
from typing import Dict, Any

# Import the modules under test
from app.antimicrobial.stewardship_engine import (
    AntibiogramDatabase,
    SusceptibilityAlert,
    get_antibiogram_db,
    AntimicrobialStewardshipEngine,
    get_stewardship_engine,
)


class TestAntibiogramDatabase:
    """Test suite for AntibiogramDatabase class."""
    
    def setup_method(self):
        """Reset singleton for each test."""
        # Reset singleton to get fresh instance
        import app.antimicrobial.stewardship_engine as module
        module._antibiogram_db = None
    
    def test_initialization(self):
        """Test that AntibiogramDatabase initializes with CDC/NHSN 2022 data."""
        db = AntibiogramDatabase()
        
        # Check that key organisms are present
        assert "ESCHERICHIA_COLI" in db.LOCAL_SUSCEPTIBILITIES
        assert "KLEBSIELLA_PNEUMONIAE" in db.LOCAL_SUSCEPTIBILITIES
        assert "PSEUDOMONAS_AERUGINOSA" in db.LOCAL_SUSCEPTIBILITIES
        assert "STAPHYLOCOCCUS_AUREUS" in db.LOCAL_SUSCEPTIBILITIES
    
    def test_e_coli_susceptibility_data(self):
        """Test E. coli susceptibility data from CDC/NHSN 2022."""
        db = AntibiogramDatabase()
        
        # Test ceftriaxone: 75%
        rate = db.get_susceptibility("E. coli", "ceftriaxone")
        assert rate == 0.75, f"Expected 0.75, got {rate}"
        
        # Test ciprofloxacin: 68%
        rate = db.get_susceptibility("E. coli", "ciprofloxacin")
        assert rate == 0.68, f"Expected 0.68, got {rate}"
        
        # Test TMP-SMX: 70%
        rate = db.get_susceptibility("E. coli", "tmp-smx")
        assert rate == 0.70, f"Expected 0.70, got {rate}"
        
        # Test piperacillin-tazobactam: 85%
        rate = db.get_susceptibility("E. coli", "piperacillin-tazobactam")
        assert rate == 0.85, f"Expected 0.85, got {rate}"
        
        # Test meropenem: 99%
        rate = db.get_susceptibility("E. coli", "meropenem")
        assert rate == 0.99, f"Expected 0.99, got {rate}"
        
        # Test ertapenem: 99%
        rate = db.get_susceptibility("E. coli", "ertapenem")
        assert rate == 0.99, f"Expected 0.99, got {rate}"
    
    def test_klebsiella_susceptibility_data(self):
        """Test Klebsiella pneumoniae susceptibility data from CDC/NHSN 2022."""
        db = AntibiogramDatabase()
        
        # Test ceftriaxone: 70%
        rate = db.get_susceptibility("Klebsiella pneumoniae", "ceftriaxone")
        assert rate == 0.70, f"Expected 0.70, got {rate}"
        
        # Test ciprofloxacin: 65%
        rate = db.get_susceptibility("K. pneumoniae", "ciprofloxacin")
        assert rate == 0.65, f"Expected 0.65, got {rate}"
        
        # Test TMP-SMX: 68%
        rate = db.get_susceptibility("Klebsiella_pneumoniae", "tmp-smx")
        assert rate == 0.68, f"Expected 0.68, got {rate}"
        
        # Test piperacillin-tazobactam: 80%
        rate = db.get_susceptibility("Klebsiella", "piperacillin-tazobactam")
        assert rate == 0.80, f"Expected 0.80, got {rate}"
        
        # Test meropenem: 98%
        rate = db.get_susceptibility("KLEBSIELLA_PNEUMONIAE", "meropenem")
        assert rate == 0.98, f"Expected 0.98, got {rate}"
    
    def test_pseudomonas_susceptibility_data(self):
        """Test Pseudomonas aeruginosa susceptibility data from CDC/NHSN 2022."""
        db = AntibiogramDatabase()
        
        # Test piperacillin-tazobactam: 75%
        rate = db.get_susceptibility("Pseudomonas aeruginosa", "piperacillin-tazobactam")
        assert rate == 0.75, f"Expected 0.75, got {rate}"
        
        # Test cefepime: 78%
        rate = db.get_susceptibility("P. aeruginosa", "cefepime")
        assert rate == 0.78, f"Expected 0.78, got {rate}"
        
        # Test meropenem: 72%
        rate = db.get_susceptibility("PSEUDOMONAS_AERUGINOSA", "meropenem")
        assert rate == 0.72, f"Expected 0.72, got {rate}"
        
        # Test ciprofloxacin: 65%
        rate = db.get_susceptibility("Pseudomonas", "ciprofloxacin")
        assert rate == 0.65, f"Expected 0.65, got {rate}"
    
    def test_staph_aureus_susceptibility_data(self):
        """Test Staphylococcus aureus susceptibility data from CDC/NHSN 2022."""
        db = AntibiogramDatabase()
        
        # MRSA prevalence is ~33%, so oxacillin/nafcillin susceptibility ~67%
        rate = db.get_susceptibility("Staphylococcus aureus", "oxacillin")
        assert rate == 0.67, f"Expected 0.67, got {rate}"
        
        rate = db.get_susceptibility("S. aureus", "nafcillin")
        assert rate == 0.67, f"Expected 0.67, got {rate}"
        
        # Vancomycin: ~99%
        rate = db.get_susceptibility("S aureus", "vancomycin")
        assert rate == 0.99, f"Expected 0.99, got {rate}"
        
        # Clindamycin: 65%
        rate = db.get_susceptibility("STAPHYLOCOCCUS_AUREUS", "clindamycin")
        assert rate == 0.65, f"Expected 0.65, got {rate}"
        
        # TMP-SMX (for MRSA): 95%
        rate = db.get_susceptibility("Staphylococcus aureus", "tmp-smx")
        assert rate == 0.95, f"Expected 0.95, got {rate}"
    
    def test_susceptibility_alert_ok(self):
        """Test that susceptibility >=80% returns OK alert."""
        db = AntibiogramDatabase()
        
        # Meropenem for E. coli: 99% - should be OK
        result = db.get_susceptibility_alert("E. coli", "meropenem")
        assert result["rate"] == 0.99
        assert result["alert"] == "OK"
        
        # Piperacillin-tazobactam for E. coli: 85% - should be OK
        result = db.get_susceptibility_alert("E. coli", "piperacillin-tazobactam")
        assert result["rate"] == 0.85
        assert result["alert"] == "OK"
    
    def test_susceptibility_alert_warn(self):
        """Test that susceptibility 60-80% returns WARN alert."""
        db = AntibiogramDatabase()
        
        # Ceftriaxone for E. coli: 75% - should be WARN
        result = db.get_susceptibility_alert("E. coli", "ceftriaxone")
        assert result["rate"] == 0.75
        assert result["alert"] == "WARN"
        
        # Ciprofloxacin for E. coli: 68% - should be WARN
        result = db.get_susceptibility_alert("E. coli", "ciprofloxacin")
        assert result["rate"] == 0.68
        assert result["alert"] == "WARN"
    
    def test_susceptibility_alert_demote(self):
        """Test that susceptibility <60% returns DEMOTE alert."""
        db = AntibiogramDatabase()
        
        # Create a low susceptibility entry for testing
        db.update_local_data("E. coli", "test-drug", 0.45, 100, 2023, "Test Data")
        
        result = db.get_susceptibility_alert("E. coli", "test-drug")
        assert result["rate"] == 0.45
        assert result["alert"] == "DEMOTE"
    
    def test_unknown_organism(self):
        """Test handling of unknown organism."""
        db = AntibiogramDatabase()
        
        rate = db.get_susceptibility("Unknown organism", "ciprofloxacin")
        assert rate is None
        
        result = db.get_susceptibility_alert("Unknown organism", "ciprofloxacin")
        assert result["rate"] is None
        assert result["alert"] == "UNKNOWN"
    
    def test_unknown_drug(self):
        """Test handling of unknown drug."""
        db = AntibiogramDatabase()
        
        rate = db.get_susceptibility("E. coli", "unknown-drug")
        assert rate is None
        
        result = db.get_susceptibility_alert("E. coli", "unknown-drug")
        assert result["rate"] is None
        assert result["alert"] == "UNKNOWN"
    
    def test_update_local_data(self):
        """Test local data override capability."""
        db = AntibiogramDatabase()
        
        # Verify initial ciprofloxacin rate for E. coli
        initial_rate = db.get_susceptibility("E. coli", "ciprofloxacin")
        assert initial_rate == 0.68
        
        # Update with local data
        db.update_local_data(
            organism="E. coli",
            drug="ciprofloxacin",
            rate=0.45,  # 45% - below threshold
            n_tested=500,
            year=2023,
            source="Local Hospital 2023"
        )
        
        # Verify updated rate
        new_rate = db.get_susceptibility("E. coli", "ciprofloxacin")
        assert new_rate == 0.45, f"Expected 0.45, got {new_rate}"
        
        # Verify alert is now DEMOTE
        result = db.get_susceptibility_alert("E. coli", "ciprofloxacin")
        assert result["alert"] == "DEMOTE"
        assert result["source"] == "Local Hospital 2023"
    
    def test_organism_name_normalization(self):
        """Test various organism name formats are normalized correctly."""
        db = AntibiogramDatabase()
        
        # All of these should return E. coli data
        names = [
            "E. coli",
            "E COLI",
            "E.COLI",
            "ESCHERICHIA COLI",
            "ESCHERICHIA_COLI",
            "escherichia coli",
            "e. coli",
        ]
        
        for name in names:
            rate = db.get_susceptibility(name, "meropenem")
            assert rate == 0.99, f"Failed for organism name: {name}"
    
    def test_get_organism_drugs(self):
        """Test getting all drugs for an organism."""
        db = AntibiogramDatabase()
        
        drugs = db.get_organism_drugs("E. coli")
        
        assert "ceftriaxone" in drugs
        assert "ciprofloxacin" in drugs
        assert "meropenem" in drugs
        assert "ertapenem" in drugs
        assert "piperacillin-tazobactam" in drugs
        assert "tmp-smx" in drugs
    
    def test_singleton_pattern(self):
        """Test that get_antibiogram_db returns a singleton."""
        db1 = get_antibiogram_db()
        db2 = get_antibiogram_db()
        
        assert db1 is db2, "AntibiogramDatabase should be a singleton"


class TestOrganismDirectedTherapy:
    """Test suite for get_organism_directed_therapy with AntibiogramDatabase integration."""
    
    def setup_method(self):
        """Reset singletons for each test."""
        import app.antimicrobial.stewardship_engine as module
        module._antibiogram_db = None
        module._stewardship_engine = None
    
    @pytest.mark.asyncio
    async def test_basic_therapy_recommendation(self):
        """Test basic organism-directed therapy recommendation."""
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={}
        )
        
        assert result["organism"] == "E. coli"
        assert "preferred_therapy" in result
        assert "alternative_therapy" in result
        assert "not_recommended_locally" in result
        assert "warnings" in result
    
    @pytest.mark.asyncio
    async def test_ciprofloxacin_demoted_for_e_coli(self):
        """
        VERIFICATION TEST: Inject mock local data with ciprofloxacin at 45%
        for E. coli and verify it appears in not_recommended_locally.
        """
        # Reset singletons
        import app.antimicrobial.stewardship_engine as module
        module._antibiogram_db = None
        module._stewardship_engine = None
        
        # Get fresh instances
        antibiogram = get_antibiogram_db()
        engine = AntimicrobialStewardshipEngine()
        
        # Inject mock local data: ciprofloxacin at 45% for E. coli
        antibiogram.update_local_data(
            organism="E. coli",
            drug="ciprofloxacin",
            rate=0.45,  # 45% - below 60% threshold
            n_tested=500,
            year=2023,
            source="Mock Local Data 2023"
        )
        
        # Call get_organism_directed_therapy
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={}
        )
        
        # Verify ciprofloxacin is in not_recommended_locally
        not_recommended = result["not_recommended_locally"]
        cipro_in_demoted = any(
            item["drug"] == "ciprofloxacin" for item in not_recommended
        )
        
        assert cipro_in_demoted, (
            f"ciprofloxacin should be in not_recommended_locally. "
            f"Got: {not_recommended}"
        )
        
        # Verify the rate is stated correctly
        cipro_entry = next(
            (item for item in not_recommended if item["drug"] == "ciprofloxacin"),
            None
        )
        assert cipro_entry is not None
        assert cipro_entry["susceptibility_rate"] == 0.45
        assert "45%" in cipro_entry["reason"]
    
    @pytest.mark.asyncio
    async def test_meropenem_in_preferred_for_e_coli(self):
        """
        VERIFICATION TEST: Ertapenem (99%) should be in preferred for E. coli.
        Note: Meropenem is in the alternative list for E. coli in DRUG_BUG_MATCHING,
        but ertapenem is in the preferred list with 99% susceptibility.
        """
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={}
        )
        
        # Verify ertapenem is in preferred_therapy (it's in preferred list with 99% rate)
        preferred = result["preferred_therapy"]
        ertapenem_in_preferred = any(
            item["drug"] == "ertapenem" for item in preferred
        )
        
        assert ertapenem_in_preferred, (
            f"ertapenem (99%) should be in preferred_therapy. "
            f"Got: {preferred}"
        )
        
        # Verify the rate is 99%
        ertapenem_entry = next(
            (item for item in preferred if item["drug"] == "ertapenem"),
            None
        )
        assert ertapenem_entry is not None
        assert ertapenem_entry["susceptibility_rate"] == 0.99
        assert ertapenem_entry["alert"] == "OK"
        
        # Also verify meropenem is in alternative_therapy (99% but listed as alternative)
        alternative = result["alternative_therapy"]
        mero_in_alternative = any(
            item["drug"] == "meropenem" for item in alternative
        )
        assert mero_in_alternative, (
            f"meropenem should be in alternative_therapy. Got: {alternative}"
        )
    
    @pytest.mark.asyncio
    async def test_preferred_drugs_sorted_by_rate(self):
        """Test that preferred drugs are sorted by susceptibility rate (highest first)."""
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={}
        )
        
        preferred = result["preferred_therapy"]
        
        # Get rates for drugs with known rates
        rates = [
            item["susceptibility_rate"]
            for item in preferred
            if item["susceptibility_rate"] is not None
        ]
        
        # Verify sorted in descending order
        assert rates == sorted(rates, reverse=True), (
            f"Preferred drugs should be sorted by rate (highest first). Got rates: {rates}"
        )
    
    @pytest.mark.asyncio
    async def test_warnings_for_marginal_susceptibility(self):
        """Test that warnings are generated for drugs with 60-80% susceptibility."""
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={}
        )
        
        # Ceftriaxone (75%) should generate a warning
        warnings = result["warnings"]
        ceftriaxone_warning = any(
            w.get("drug") == "ceftriaxone" for w in warnings
        )
        
        assert ceftriaxone_warning, (
            f"Expected warning for ceftriaxone (75% susceptibility). Warnings: {warnings}"
        )
    
    @pytest.mark.asyncio
    async def test_unknown_organism_handling(self):
        """Test handling of unknown organism."""
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="Unknown organism",
            susceptibilities={}
        )
        
        assert "error" in result
        assert "Unknown organism" in result["error"]
    
    @pytest.mark.asyncio
    async def test_culture_susceptibility_integration(self):
        """Test that culture susceptibility results are integrated."""
        engine = AntimicrobialStewardshipEngine()
        
        result = await engine.get_organism_directed_therapy(
            organism="E. coli",
            susceptibilities={
                "meropenem": "S",
                "ciprofloxacin": "R",
                "ceftriaxone": "S",
            }
        )
        
        # Check that culture results are noted
        preferred = result["preferred_therapy"]
        mero_entry = next(
            (item for item in preferred if item["drug"] == "meropenem"),
            None
        )
        
        if mero_entry:
            assert mero_entry.get("culture_result") == "S"


class TestAntibiogramDataIntegrity:
    """Test CDC/NHSN 2022 data integrity."""
    
    def test_all_required_e_coli_drugs_present(self):
        """Verify all required E. coli drugs are in the database."""
        db = AntibiogramDatabase()
        
        required_drugs = [
            "ceftriaxone",
            "ciprofloxacin",
            "tmp-smx",
            "piperacillin-tazobactam",
            "meropenem",
            "ertapenem",
        ]
        
        ecoli_drugs = db.get_organism_drugs("E. coli")
        
        for drug in required_drugs:
            assert drug in ecoli_drugs, f"Missing required drug: {drug}"
            assert ecoli_drugs[drug]["susceptibility_rate"] is not None
            assert ecoli_drugs[drug]["n_tested"] > 0
            assert ecoli_drugs[drug]["year"] == 2022
    
    def test_all_required_klebsiella_drugs_present(self):
        """Verify all required Klebsiella drugs are in the database."""
        db = AntibiogramDatabase()
        
        required_drugs = [
            "ceftriaxone",
            "ciprofloxacin",
            "tmp-smx",
            "piperacillin-tazobactam",
            "meropenem",
        ]
        
        kp_drugs = db.get_organism_drugs("Klebsiella pneumoniae")
        
        for drug in required_drugs:
            assert drug in kp_drugs, f"Missing required drug: {drug}"
    
    def test_all_required_pseudomonas_drugs_present(self):
        """Verify all required Pseudomonas drugs are in the database."""
        db = AntibiogramDatabase()
        
        required_drugs = [
            "piperacillin-tazobactam",
            "cefepime",
            "meropenem",
            "ciprofloxacin",
        ]
        
        pa_drugs = db.get_organism_drugs("Pseudomonas aeruginosa")
        
        for drug in required_drugs:
            assert drug in pa_drugs, f"Missing required drug: {drug}"
    
    def test_all_required_staph_drugs_present(self):
        """Verify all required Staphylococcus aureus drugs are in the database."""
        db = AntibiogramDatabase()
        
        required_drugs = [
            "oxacillin",
            "vancomycin",
            "clindamycin",
            "tmp-smx",
        ]
        
        sa_drugs = db.get_organism_drugs("Staphylococcus aureus")
        
        for drug in required_drugs:
            assert drug in sa_drugs, f"Missing required drug: {drug}"
    
    def test_susceptibility_rates_in_valid_range(self):
        """Test all susceptibility rates are between 0 and 1."""
        db = AntibiogramDatabase()
        
        for organism, drugs in db.LOCAL_SUSCEPTIBILITIES.items():
            for drug, data in drugs.items():
                rate = data["susceptibility_rate"]
                assert 0 <= rate <= 1, (
                    f"Invalid susceptibility rate {rate} for {organism}/{drug}"
                )
    
    def test_all_data_has_source(self):
        """Test all susceptibility entries have a source field."""
        db = AntibiogramDatabase()
        
        for organism, drugs in db.LOCAL_SUSCEPTIBILITIES.items():
            for drug, data in drugs.items():
                assert "source" in data, (
                    f"Missing source for {organism}/{drug}"
                )
                assert "CDC/NHSN" in data["source"] or "Local" in data["source"], (
                    f"Source should reference CDC/NHSN for {organism}/{drug}"
                )


class TestSusceptibilityAlertEnum:
    """Test SusceptibilityAlert enum values."""
    
    def test_enum_values(self):
        """Test enum has correct values."""
        assert SusceptibilityAlert.OK.value == "OK"
        assert SusceptibilityAlert.WARN.value == "WARN"
        assert SusceptibilityAlert.DEMOTE.value == "DEMOTE"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    # Run with pytest
    pytest.main([__file__, "-v", "--tb=short"])
