"""
Test suite for Bayesian Prior Database (PROMPT 6)
===================================================

Tests for CLINICAL_PRIOR_DATABASE, match_complaint_to_cluster, and update_posteriors.
"""

import pytest
import sys
import os
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.diagnostic.bayesian_reasoning import (
    CLINICAL_PRIOR_DATABASE,
    match_complaint_to_cluster,
    update_posteriors,
    get_cluster_priors,
    is_cluster_critical,
)


class TestClinicalPriorDatabase:
    """Tests for CLINICAL_PRIOR_DATABASE structure and content."""
    
    def test_database_has_8_clusters(self):
        """Verify CLINICAL_PRIOR_DATABASE has exactly 8 clusters."""
        expected_clusters = {
            "chest_pain",
            "fever_and_cough", 
            "headache",
            "abdominal_pain",
            "dyspnea",
            "altered_mental_status",
            "palpitations",
            "syncope_or_presyncope"
        }
        assert set(CLINICAL_PRIOR_DATABASE.keys()) == expected_clusters
    
    def test_each_cluster_has_diagnoses(self):
        """Verify each cluster has a diagnoses list."""
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            assert "diagnoses" in cluster_data, f"Cluster {cluster_name} missing 'diagnoses'"
            assert isinstance(cluster_data["diagnoses"], list), f"Cluster {cluster_name} diagnoses is not a list"
            assert len(cluster_data["diagnoses"]) > 0, f"Cluster {cluster_name} has no diagnoses"
    
    def test_diagnosis_structure(self):
        """Verify each diagnosis has required fields."""
        required_fields = [
            "hypothesis", "icd10", "prior_probability", "is_critical",
            "age_modifiers", "sex_modifiers", "evidence_pmids", "evidence_note"
        ]
        
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for i, diagnosis in enumerate(cluster_data["diagnoses"]):
                for field in required_fields:
                    assert field in diagnosis, f"Cluster {cluster_name}, diagnosis {i} missing field '{field}'"
    
    def test_icd10_codes_valid_format(self):
        """Verify all ICD-10 codes match the pattern ^[A-Z][0-9]."""
        icd_pattern = re.compile(r'^[A-Z][0-9]')
        
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for diagnosis in cluster_data["diagnoses"]:
                icd10 = diagnosis["icd10"]
                assert icd_pattern.match(icd10), f"Invalid ICD-10 format: {icd10} in {cluster_name}"
    
    def test_prior_probabilities_in_range(self):
        """Verify all prior probabilities are between 0.0 and 1.0."""
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for diagnosis in cluster_data["diagnoses"]:
                prior = diagnosis["prior_probability"]
                assert 0.0 <= prior <= 1.0, f"Prior {prior} out of range in {cluster_name}"
    
    def test_age_modifiers_structure(self):
        """Verify age_modifiers has required brackets."""
        required_brackets = ["pediatric", "adult", "elderly"]
        
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for diagnosis in cluster_data["diagnoses"]:
                age_mods = diagnosis["age_modifiers"]
                for bracket in required_brackets:
                    assert bracket in age_mods, f"Missing age bracket '{bracket}' in {cluster_name}"
    
    def test_sex_modifiers_structure(self):
        """Verify sex_modifiers has M and F."""
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for diagnosis in cluster_data["diagnoses"]:
                sex_mods = diagnosis["sex_modifiers"]
                assert "M" in sex_mods, f"Missing sex modifier 'M' in {cluster_name}"
                assert "F" in sex_mods, f"Missing sex modifier 'F' in {cluster_name}"
    
    def test_evidence_pmids_are_strings(self):
        """Verify all PMIDs in evidence_pmids are strings."""
        for cluster_name, cluster_data in CLINICAL_PRIOR_DATABASE.items():
            for diagnosis in cluster_data["diagnoses"]:
                pmids = diagnosis["evidence_pmids"]
                assert isinstance(pmids, list), f"evidence_pmids is not a list in {cluster_name}"
                for pmid in pmids:
                    assert isinstance(pmid, str), f"PMID {pmid} is not a string in {cluster_name}"
    
    def test_total_diagnoses_count(self):
        """Count total diagnoses across all clusters."""
        total = sum(len(c["diagnoses"]) for c in CLINICAL_PRIOR_DATABASE.values())
        # Expected: chest_pain(9) + fever_and_cough(9) + headache(9) + abdominal_pain(10) + 
        #           dyspnea(10) + altered_mental_status(10) + palpitations(9) + syncope_or_presyncope(9)
        assert total >= 70, f"Expected at least 70 diagnoses, got {total}"
    
    def test_chest_pain_acs_has_evidence(self):
        """Verify ACS in chest_pain has PMID evidence."""
        chest_pain = CLINICAL_PRIOR_DATABASE["chest_pain"]
        acs = next((d for d in chest_pain["diagnoses"] if "coronary" in d["hypothesis"].lower()), None)
        assert acs is not None, "ACS not found in chest_pain cluster"
        assert "16287956" in acs["evidence_pmids"], "ACS missing Swap et al. 2005 PMID"
    
    def test_headache_has_sah_with_evidence(self):
        """Verify SAH in headache has PMID evidence."""
        headache = CLINICAL_PRIOR_DATABASE["headache"]
        sah = next((d for d in headache["diagnoses"] if "subarachnoid" in d["hypothesis"].lower()), None)
        assert sah is not None, "SAH not found in headache cluster"
        assert "21471930" in sah["evidence_pmids"], "SAH missing Perry et al. 2011 PMID"
    
    def test_altered_mental_status_is_cluster_critical(self):
        """Verify altered_mental_status cluster is marked critical."""
        assert CLINICAL_PRIOR_DATABASE["altered_mental_status"]["cluster_critical"] == True


class TestMatchComplaintToCluster:
    """Tests for match_complaint_to_cluster function."""
    
    def test_chest_pain_match(self):
        """Test chest pain complaints match to chest_pain cluster."""
        assert match_complaint_to_cluster("chest pain") == "chest_pain"
        assert match_complaint_to_cluster("I have chest discomfort") == "chest_pain"
        assert match_complaint_to_cluster("cardiac chest pain") == "chest_pain"
        assert match_complaint_to_cluster("precordial pain") == "chest_pain"
    
    def test_fever_and_cough_match(self):
        """Test fever/cough complaints match to fever_and_cough cluster."""
        assert match_complaint_to_cluster("fever and cough") == "fever_and_cough"
        assert match_complaint_to_cluster("productive cough with fever") == "fever_and_cough"
        assert match_complaint_to_cluster("chills and temperature") == "fever_and_cough"
    
    def test_headache_match(self):
        """Test headache complaints match to headache cluster."""
        assert match_complaint_to_cluster("headache") == "headache"
        assert match_complaint_to_cluster("migraine attack") == "headache"
        assert match_complaint_to_cluster("worst headache of my life") == "headache"
        assert match_complaint_to_cluster("thunderclap headache") == "headache"
    
    def test_abdominal_pain_match(self):
        """Test abdominal pain complaints match to abdominal_pain cluster."""
        assert match_complaint_to_cluster("abdominal pain") == "abdominal_pain"
        assert match_complaint_to_cluster("stomach pain") == "abdominal_pain"
        assert match_complaint_to_cluster("nausea and vomiting") == "abdominal_pain"
        assert match_complaint_to_cluster("epigastric pain") == "abdominal_pain"
    
    def test_dyspnea_match(self):
        """Test dyspnea complaints match to dyspnea cluster."""
        assert match_complaint_to_cluster("shortness of breath") == "dyspnea"
        assert match_complaint_to_cluster("dyspnea") == "dyspnea"
        assert match_complaint_to_cluster("difficulty breathing") == "dyspnea"
        assert match_complaint_to_cluster("wheezing") == "dyspnea"
    
    def test_altered_mental_status_match(self):
        """Test AMS complaints match to altered_mental_status cluster."""
        assert match_complaint_to_cluster("confusion") == "altered_mental_status"
        assert match_complaint_to_cluster("altered mental status") == "altered_mental_status"
        assert match_complaint_to_cluster("patient is disoriented") == "altered_mental_status"
        assert match_complaint_to_cluster("delirium") == "altered_mental_status"
    
    def test_palpitations_match(self):
        """Test palpitations complaints match to palpitations cluster."""
        assert match_complaint_to_cluster("palpitations") == "palpitations"
        assert match_complaint_to_cluster("racing heart") == "palpitations"
        assert match_complaint_to_cluster("irregular heartbeat") == "palpitations"
        assert match_complaint_to_cluster("heart flutter") == "palpitations"
    
    def test_syncope_match(self):
        """Test syncope complaints match to syncope_or_presyncope cluster."""
        assert match_complaint_to_cluster("fainting") == "syncope_or_presyncope"
        assert match_complaint_to_cluster("syncope") == "syncope_or_presyncope"
        assert match_complaint_to_cluster("passed out") == "syncope_or_presyncope"
        assert match_complaint_to_cluster("lightheaded") == "syncope_or_presyncope"
    
    def test_empty_complaint_returns_default(self):
        """Test empty complaint returns safest default."""
        assert match_complaint_to_cluster("") == "fever_and_cough"
        assert match_complaint_to_cluster(None) == "fever_and_cough"
    
    def test_unknown_complaint_returns_default(self):
        """Test unknown complaint returns safest default."""
        assert match_complaint_to_cluster("xyzabc unknown symptom") == "fever_and_cough"
    
    def test_no_r69_code_returned(self):
        """Verify R69 is never returned as a cluster or fallback."""
        for complaint in ["", None, "unknown", "chest pain", "headache"]:
            result = match_complaint_to_cluster(complaint)
            assert result != "R69", f"R69 returned for complaint: {complaint}"
            assert "R69" not in result, f"R69 in result for complaint: {complaint}"


class TestUpdatePosteriors:
    """Tests for update_posteriors function."""
    
    def test_basic_update(self):
        """Test basic posterior update with patient info."""
        priors = get_cluster_priors("chest_pain")
        clinical_findings = {
            "patient": {"age": 45, "sex": "M"},
            "chief_complaint": "chest pain"
        }
        
        results = update_posteriors(priors, clinical_findings)
        
        assert len(results) == len(priors)
        assert all("posterior_probability" in r for r in results)
        assert all("rank" in r for r in results)
        assert all("forced_inclusion" in r for r in results)
    
    def test_posteriors_sum_to_one(self):
        """Verify posteriors sum to approximately 1.0."""
        priors = get_cluster_priors("headache")
        clinical_findings = {
            "patient": {"age": 35, "sex": "F"},
            "chief_complaint": "headache"
        }
        
        results = update_posteriors(priors, clinical_findings)
        total = sum(r["posterior_probability"] for r in results)
        
        assert abs(total - 1.0) < 0.001, f"Posteriors sum to {total}, not 1.0"
    
    def test_sorted_by_posterior_descending(self):
        """Verify results are sorted by posterior descending."""
        priors = get_cluster_priors("chest_pain")
        clinical_findings = {
            "patient": {"age": 45, "sex": "M"},
            "chief_complaint": "chest pain"
        }
        
        results = update_posteriors(priors, clinical_findings)
        posteriors = [r["posterior_probability"] for r in results]
        
        assert posteriors == sorted(posteriors, reverse=True)
    
    def test_critical_diagnoses_never_dropped(self):
        """Verify critical diagnoses are never dropped."""
        priors = get_cluster_priors("chest_pain")
        clinical_findings = {
            "patient": {"age": 5, "sex": "M"},  # Pediatric - very low ACS prior
            "chief_complaint": "chest pain"
        }
        
        results = update_posteriors(priors, clinical_findings)
        
        # Find ACS in results
        acs = next((r for r in results if "coronary" in r["hypothesis"].lower()), None)
        assert acs is not None, "ACS dropped from results"
        assert acs["is_critical"] == True
        assert acs["posterior_probability"] > 0, "ACS has zero posterior"
    
    def test_age_modifier_applied(self):
        """Test that age modifiers affect posteriors."""
        priors = get_cluster_priors("chest_pain")
        
        # Young adult (25)
        findings_young = {"patient": {"age": 25, "sex": "M"}, "chief_complaint": "chest pain"}
        results_young = update_posteriors(priors, findings_young)
        acs_young = next(r for r in results_young if "coronary" in r["hypothesis"].lower())
        
        # Elderly (70)
        findings_old = {"patient": {"age": 70, "sex": "M"}, "chief_complaint": "chest pain"}
        results_old = update_posteriors(priors, findings_old)
        acs_old = next(r for r in results_old if "coronary" in r["hypothesis"].lower())
        
        # Elderly should have higher ACS posterior than young adult
        assert acs_old["posterior_probability"] > acs_young["posterior_probability"], \
            "Elderly ACS posterior not higher than young adult"
    
    def test_sex_modifier_applied(self):
        """Test that sex modifiers affect posteriors."""
        priors = get_cluster_priors("chest_pain")
        
        # Male
        findings_m = {"patient": {"age": 50, "sex": "M"}, "chief_complaint": "chest pain"}
        results_m = update_posteriors(priors, findings_m)
        acs_m = next(r for r in results_m if "coronary" in r["hypothesis"].lower())
        
        # Female
        findings_f = {"patient": {"age": 50, "sex": "F"}, "chief_complaint": "chest pain"}
        results_f = update_posteriors(priors, findings_f)
        acs_f = next(r for r in results_f if "coronary" in r["hypothesis"].lower())
        
        # Male should have higher ACS posterior than female at same age
        assert acs_m["posterior_probability"] > acs_f["posterior_probability"], \
            "Male ACS posterior not higher than female"
    
    def test_sah_thunderclap_multiplier(self):
        """Test SAH posterior elevation with thunderclap keywords."""
        priors = get_cluster_priors("headache")
        
        # Without thunderclap
        findings_normal = {"patient": {"age": 40, "sex": "F"}, "chief_complaint": "headache"}
        results_normal = update_posteriors(priors, findings_normal)
        sah_normal = next(r for r in results_normal if "subarachnoid" in r["hypothesis"].lower())
        
        # With thunderclap keywords
        findings_thunderclap = {"patient": {"age": 40, "sex": "F"}, 
                               "chief_complaint": "sudden onset worst headache of my life"}
        results_thunderclap = update_posteriors(priors, findings_thunderclap)
        sah_thunderclap = next(r for r in results_thunderclap if "subarachnoid" in r["hypothesis"].lower())
        
        # Thunderclap should have much higher SAH posterior
        assert sah_thunderclap["posterior_probability"] > sah_normal["posterior_probability"], \
            "SAH posterior not elevated with thunderclap keywords"
        assert sah_thunderclap["posterior_probability"] > 0.01, \
            "SAH posterior not elevated above base 0.01"
    
    def test_ectopic_pregnancy_sex_age_gate(self):
        """Test ectopic pregnancy prior is 0 for males."""
        priors = get_cluster_priors("abdominal_pain")
        
        # Male patient
        findings_male = {"patient": {"age": 30, "sex": "M"}, "chief_complaint": "abdominal pain"}
        results_male = update_posteriors(priors, findings_male)
        ectopic_male = next((r for r in results_male if "ectopic" in r["hypothesis"].lower()), None)
        
        assert ectopic_male is not None, "Ectopic pregnancy not in results"
        assert ectopic_male["posterior_probability"] == 0.0, \
            f"Ectopic pregnancy prior not 0 for male: {ectopic_male['posterior_probability']}"
    
    def test_ectopic_pregnancy_female_reproductive_age(self):
        """Test ectopic pregnancy has non-zero prior for female in reproductive age."""
        priors = get_cluster_priors("abdominal_pain")
        
        # Female patient in reproductive age
        findings_female = {"patient": {"age": 30, "sex": "F"}, "chief_complaint": "abdominal pain"}
        results_female = update_posteriors(priors, findings_female)
        ectopic_female = next((r for r in results_female if "ectopic" in r["hypothesis"].lower()), None)
        
        assert ectopic_female is not None, "Ectopic pregnancy not in results"
        assert ectopic_female["posterior_probability"] > 0.0, \
            f"Ectopic pregnancy prior is 0 for reproductive-age female"
    
    def test_ectopic_pregnancy_female_pediatric(self):
        """Test ectopic pregnancy prior is 0 for pediatric female."""
        priors = get_cluster_priors("abdominal_pain")
        
        # Pediatric female (age 10)
        findings_pediatric = {"patient": {"age": 10, "sex": "F"}, "chief_complaint": "abdominal pain"}
        results_pediatric = update_posteriors(priors, findings_pediatric)
        ectopic_pediatric = next((r for r in results_pediatric if "ectopic" in r["hypothesis"].lower()), None)
        
        assert ectopic_pediatric is not None, "Ectopic pregnancy not in results"
        assert ectopic_pediatric["posterior_probability"] == 0.0, \
            f"Ectopic pregnancy prior not 0 for pediatric female"
    
    def test_ectopic_pregnancy_female_elderly(self):
        """Test ectopic pregnancy prior is 0 for elderly female."""
        priors = get_cluster_priors("abdominal_pain")
        
        # Elderly female (age 70)
        findings_elderly = {"patient": {"age": 70, "sex": "F"}, "chief_complaint": "abdominal pain"}
        results_elderly = update_posteriors(priors, findings_elderly)
        ectopic_elderly = next((r for r in results_elderly if "ectopic" in r["hypothesis"].lower()), None)
        
        assert ectopic_elderly is not None, "Ectopic pregnancy not in results"
        assert ectopic_elderly["posterior_probability"] == 0.0, \
            f"Ectopic pregnancy prior not 0 for elderly female"
    
    def test_r69_not_top_hypothesis(self):
        """Verify R69 is never the top/sole hypothesis."""
        for cluster_name in CLINICAL_PRIOR_DATABASE.keys():
            priors = get_cluster_priors(cluster_name)
            clinical_findings = {
                "patient": {"age": 45, "sex": "M"},
                "chief_complaint": cluster_name.replace("_", " ")
            }
            results = update_posteriors(priors, clinical_findings)
            
            assert len(results) > 0, f"No results for cluster {cluster_name}"
            
            # Check no diagnosis has R69 as ICD-10
            for r in results:
                assert not r["icd10"].startswith("R69"), \
                    f"R69 code found in {cluster_name}: {r['hypothesis']}"


class TestIntegration:
    """Integration tests combining multiple functions."""
    
    def test_full_workflow_chest_pain_elderly_male(self):
        """Test full workflow for elderly male with chest pain."""
        chief_complaint = "chest pain"
        cluster = match_complaint_to_cluster(chief_complaint)
        priors = get_cluster_priors(cluster)
        clinical_findings = {
            "patient": {"age": 70, "sex": "M"},
            "chief_complaint": chief_complaint
        }
        results = update_posteriors(priors, clinical_findings)
        
        assert cluster == "chest_pain"
        assert len(results) > 0
        
        # ACS should be relatively high for elderly male
        acs = next(r for r in results if "coronary" in r["hypothesis"].lower())
        assert acs["posterior_probability"] > 0.05, \
            f"ACS posterior too low for elderly male: {acs['posterior_probability']}"
    
    def test_full_workflow_thunderclap_headache(self):
        """Test full workflow for thunderclap headache."""
        chief_complaint = "sudden onset worst headache of my life"
        cluster = match_complaint_to_cluster(chief_complaint)
        priors = get_cluster_priors(cluster)
        clinical_findings = {
            "patient": {"age": 45, "sex": "F"},
            "chief_complaint": chief_complaint
        }
        results = update_posteriors(priors, clinical_findings)
        
        assert cluster == "headache"
        
        # SAH should be elevated
        sah = next(r for r in results if "subarachnoid" in r["hypothesis"].lower())
        assert sah["posterior_probability"] > 0.05, \
            f"SAH posterior not elevated: {sah['posterior_probability']}"
    
    def test_cluster_critical_flag(self):
        """Test cluster_critical flag detection."""
        assert is_cluster_critical("altered_mental_status") == True
        assert is_cluster_critical("chest_pain") == False
        assert is_cluster_critical("headache") == False


class TestICD10Validation:
    """Tests for ICD-10 code validation."""
    
    def test_all_icd10_codes_valid(self):
        """Verify all ICD-10 codes match the required pattern."""
        icd_pattern = re.compile(r'^[A-Z][0-9]')
        
        for cluster_name in CLINICAL_PRIOR_DATABASE:
            priors = get_cluster_priors(cluster_name)
            for prior in priors:
                icd10 = prior["icd10"]
                assert icd_pattern.match(icd10), \
                    f"Invalid ICD-10 '{icd10}' in {cluster_name}/{prior['hypothesis']}"
    
    def test_no_r69_codes_in_database(self):
        """Verify R69 (unknown cause) is not in the database."""
        for cluster_name in CLINICAL_PRIOR_DATABASE:
            priors = get_cluster_priors(cluster_name)
            for prior in priors:
                assert not prior["icd10"].startswith("R69"), \
                    f"R69 code found in {cluster_name}: {prior['hypothesis']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
