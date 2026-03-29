"""
FHIR R4 Export Implementation Test (P12)
=========================================

Test file to verify PROMPT 12 — FHIR R4 Export implementation.

This test validates:
1. FHIR resource mappers produce valid FHIR R4 JSON
2. SHA-256 hashing for patient IDs (never expose raw DB IDs)
3. Bayesian posterior probability extensions
4. Evidence PMID extensions
5. LOINC-coded observations
6. MedicationRequest with DDI handling
7. Bundle validation

Evidence Sources:
- HL7 FHIR R4 Specification: https://hl7.org/fhir/R4/
- FHIR Validator: https://validator.fhir.org/

Run with: python -m pytest test_p12_fhir_export.py -v
"""

import json
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

# Import FHIR mappers and extensions
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.fhir.mappers import (
    patient_to_fhir,
    soap_note_to_fhir,
    diagnostic_to_fhir,
    assessment_item_to_fhir,
    create_fhir_bundle,
    validate_fhir_resource,
    generate_uuid,
    generate_resource_id,
    hash_patient_id,
)

from app.fhir.extensions import (
    build_extension,
    build_pmid_extension,
    build_posterior_probability_extension,
    build_bayesian_rank_extension,
    build_forced_inclusion_extension,
    build_renal_bracket_extension,
    build_ddi_warning_extension,
    build_condition_extensions,
    EXT_EVIDENCE_PMID,
    EXT_POSTERIOR_PROB,
    EXT_BAYESIAN_RANK,
)

from app.fhir.bundle_builder import (
    build_encounter_bundle,
    map_patient,
    map_condition,
    map_observations,
    map_medication_request,
    LOINC_CODES,
)


# =============================================================================
# Test Data
# =============================================================================

SAMPLE_PATIENT = {
    "id": "patient-123",
    "mrn": "MRN-001",
    "nationalHealthId": "NAT-12345",
    "firstName": "John",
    "lastName": "Doe",
    "middleName": "William",
    "dateOfBirth": "1985-03-15",
    "gender": "male",
    "phone": "555-123-4567",
    "email": "john.doe@email.com",
    "address": "123 Main Street",
    "city": "Boston",
    "state": "MA",
    "postalCode": "02101",
    "country": "USA",
    "isActive": True,
}

SAMPLE_SOAP_NOTE = {
    "id": "soap-456",
    "status": "signed",
    "chiefComplaint": "Chest pain",
    "hpiNarrative": "Patient presents with substernal chest pain for 2 hours",
    "hpiOnset": "2 hours ago",
    "hpiLocation": "substernal",
    "hpiSeverity": 7,
    "rosConstitutional": "Fatigue present",
    "rosCardiovascular": "Palpitations noted",
    "peHeent": "Normal",
    "peCardiovascular": "Regular rate and rhythm",
    "primaryDiagnosisCode": "I20.9",
    "primaryDiagnosisDesc": "Angina pectoris, unspecified",
    "clinicalReasoning": "Symptoms consistent with angina",
    "investigationsOrdered": "ECG, Troponin",
    "medicationsPrescribed": "Aspirin 325mg, Nitroglycerin SL PRN",
    "followUpDate": "2026-04-05",
    "followUpMode": "cardiology clinic",
    "createdBy": "dr-smith",
    "createdAt": "2026-03-28T10:30:00Z",
    "lockVersion": 1,
    "assessmentItems": [
        {
            "id": "assessment-1",
            "diagnosis": "Angina pectoris",
            "icdCode": "I20.9",
            "isPrimary": True,
            "confidence": 0.85,
            "status": "active",
        }
    ],
    "planItems": [
        {
            "id": "plan-1",
            "category": "medication",
            "description": "Aspirin 325mg daily",
            "status": "ordered",
        }
    ],
    "differentialDiagnoses": [
        {
            "id": "ddx-1",
            "description": "Myocardial infarction",
            "icdCode": "I21.9",
            "confidence": 0.3,
            "rank": 2,
        }
    ],
}

SAMPLE_DIFFERENTIAL_HYPOTHESIS = {
    "hypothesis": "Community-acquired pneumonia",
    "icd10": "J18.1",
    "rank": 1,
    "posterior_probability": 0.72,
    "is_critical": True,
    "evidence_pmids": ["15282380", "14639442"],
    "rag_namespace": "clinical-guidelines",
    "forced_inclusion": False,
}

SAMPLE_CLINICAL_DATA = {
    "heart_rate": 92,
    "systolic_bp": 128,
    "diastolic_bp": 82,
    "temperature_c": 37.8,
    "respiratory_rate": 20,
    "o2_saturation": 94,
    "serum_creatinine": 1.2,
    "qtc_fridericia_ms": 445,
    "crcl_ml_min": 65,
    "gender": "male",
}

SAMPLE_MEDICATION_RECOMMENDATION = {
    "drug_name": "Ceftriaxone",
    "dose": "1g IV q24h",
    "rxnorm_code": "2193",
    "renal_adjustment": True,
    "renal_bracket": "moderate",
    "interaction_warnings": [],
    "antibiogram_susceptibility": 92.5,
}


# =============================================================================
# SHA-256 Hashing Tests
# =============================================================================

class TestPatientIdHashing:
    """Tests for SHA-256 patient ID hashing."""

    def test_hash_patient_id_returns_32_chars(self):
        """Test that hash_patient_id returns 32-character hex string."""
        hashed = hash_patient_id("patient-123")
        assert len(hashed) == 32
        assert all(c in "0123456789abcdef" for c in hashed)

    def test_hash_patient_id_is_deterministic(self):
        """Test that same input produces same hash."""
        hash1 = hash_patient_id("patient-123")
        hash2 = hash_patient_id("patient-123")
        assert hash1 == hash2

    def test_hash_patient_id_different_inputs_different_outputs(self):
        """Test that different inputs produce different hashes."""
        hash1 = hash_patient_id("patient-123")
        hash2 = hash_patient_id("patient-456")
        assert hash1 != hash2

    def test_generate_resource_id_from_multiple_components(self):
        """Test deterministic ID generation from multiple components."""
        id1 = generate_resource_id("patient-123", "J18.1", "encounter-1")
        id2 = generate_resource_id("patient-123", "J18.1", "encounter-1")
        assert id1 == id2
        assert len(id1) == 16


# =============================================================================
# Extension Tests
# =============================================================================

class TestExtensions:
    """Tests for FHIR extension builders."""

    def test_build_extension_value_string(self):
        """Test building extension with valueString."""
        ext = build_extension("http://example.org/ext", "valueString", "test-value")
        assert ext["url"] == "http://example.org/ext"
        assert ext["valueString"] == "test-value"

    def test_build_extension_value_decimal(self):
        """Test building extension with valueDecimal."""
        ext = build_extension("http://example.org/ext", "valueDecimal", 0.72345)
        assert ext["valueDecimal"] == 0.7235  # Rounded to 4 decimal places

    def test_build_extension_value_boolean(self):
        """Test building extension with valueBoolean."""
        ext = build_extension("http://example.org/ext", "valueBoolean", True)
        assert ext["valueBoolean"] is True

    def test_build_extension_value_integer(self):
        """Test building extension with valueInteger."""
        ext = build_extension("http://example.org/ext", "valueInteger", 5)
        assert ext["valueInteger"] == 5

    def test_build_pmid_extension(self):
        """Test PMID extension format."""
        ext = build_pmid_extension("15282380")
        assert ext["url"] == EXT_EVIDENCE_PMID
        assert ext["valueString"] == "PMID:15282380"

    def test_build_pmid_extension_with_prefix(self):
        """Test PMID extension with existing prefix."""
        ext = build_pmid_extension("PMID:15282380")
        assert ext["valueString"] == "PMID:15282380"

    def test_build_posterior_probability_extension(self):
        """Test posterior probability extension."""
        ext = build_posterior_probability_extension(0.723)
        assert ext["url"] == EXT_POSTERIOR_PROB
        assert 0.7229 < ext["valueDecimal"] < 0.7231

    def test_build_posterior_probability_clamped(self):
        """Test posterior probability is clamped to [0, 1]."""
        ext_high = build_posterior_probability_extension(1.5)
        assert ext_high["valueDecimal"] == 1.0
        
        ext_low = build_posterior_probability_extension(-0.5)
        assert ext_low["valueDecimal"] == 0.0

    def test_build_bayesian_rank_extension(self):
        """Test Bayesian rank extension."""
        ext = build_bayesian_rank_extension(1)
        assert ext["url"] == EXT_BAYESIAN_RANK
        assert ext["valueInteger"] == 1

    def test_build_forced_inclusion_extension(self):
        """Test forced inclusion extension."""
        ext = build_forced_inclusion_extension(True)
        assert ext["valueBoolean"] is True

    def test_build_renal_bracket_extension(self):
        """Test renal bracket extension."""
        ext = build_renal_bracket_extension("moderate")
        assert ext["valueString"] == "moderate"

    def test_build_ddi_warning_extension(self):
        """Test DDI warning extension."""
        ext = build_ddi_warning_extension(
            drug_a="Warfarin",
            drug_b="Amiodarone",
            severity="MAJOR",
            mechanism="CYP2C9 inhibition increases warfarin levels"
        )
        assert "Warfarin + Amiodarone" in ext["valueString"]
        assert "MAJOR" in ext["valueString"]

    def test_build_condition_extensions(self):
        """Test building all condition extensions from hypothesis."""
        hypothesis = {
            "posterior_probability": 0.85,
            "rank": 1,
            "evidence_pmids": ["15282380"],
            "rag_namespace": "clinical-guidelines",
        }
        extensions = build_condition_extensions(hypothesis)
        
        # Should have at least 4 extensions
        assert len(extensions) >= 4
        
        # Check for required extensions
        urls = [e["url"] for e in extensions]
        assert EXT_POSTERIOR_PROB in urls
        assert EXT_BAYESIAN_RANK in urls
        assert EXT_EVIDENCE_PMID in urls


# =============================================================================
# Bundle Builder Tests
# =============================================================================

class TestBundleBuilder:
    """Tests for the bundle builder."""

    def test_map_patient_hashes_id(self):
        """Test that map_patient hashes the patient ID."""
        fhir_patient = map_patient(SAMPLE_PATIENT)
        
        # ID should be a hash, not the raw ID
        assert fhir_patient["id"] != "patient-123"
        assert len(fhir_patient["id"]) == 32

    def test_map_patient_us_core_profile(self):
        """Test that Patient has US Core profile."""
        fhir_patient = map_patient(SAMPLE_PATIENT)
        
        profiles = fhir_patient["meta"]["profile"]
        assert any("us-core-patient" in p for p in profiles)

    def test_map_patient_gender_mapping(self):
        """Test gender mapping from internal to FHIR."""
        fhir_patient = map_patient(SAMPLE_PATIENT)
        assert fhir_patient["gender"] == "male"
        
        female_patient = map_patient({**SAMPLE_PATIENT, "gender": "F"})
        assert female_patient["gender"] == "female"

    def test_map_condition_includes_extensions(self):
        """Test that Condition includes Bayesian extensions."""
        patient_ref = hash_patient_id("patient-123")
        
        fhir_condition = map_condition(
            hypothesis=SAMPLE_DIFFERENTIAL_HYPOTHESIS,
            patient_ref=patient_ref
        )
        
        # Check for extensions
        assert "extension" in fhir_condition
        extensions = fhir_condition["extension"]
        
        urls = [e["url"] for e in extensions]
        assert EXT_POSTERIOR_PROB in urls
        assert EXT_BAYESIAN_RANK in urls
        assert EXT_EVIDENCE_PMID in urls

    def test_map_condition_severity_critical(self):
        """Test that critical conditions have SNOMED Severe severity."""
        patient_ref = hash_patient_id("patient-123")
        
        critical_hypothesis = {**SAMPLE_DIFFERENTIAL_HYPOTHESIS, "is_critical": True}
        fhir_condition = map_condition(
            hypothesis=critical_hypothesis,
            patient_ref=patient_ref
        )
        
        assert "severity" in fhir_condition
        assert fhir_condition["severity"]["coding"][0]["code"] == "24484000"

    def test_map_condition_verification_status(self):
        """Test verification status based on rank."""
        patient_ref = hash_patient_id("patient-123")
        
        # Rank 1 should be provisional
        rank1 = map_condition(
            hypothesis={**SAMPLE_DIFFERENTIAL_HYPOTHESIS, "rank": 1},
            patient_ref=patient_ref
        )
        assert rank1["verificationStatus"]["coding"][0]["code"] == "provisional"
        
        # Rank > 1 should be differential
        rank2 = map_condition(
            hypothesis={**SAMPLE_DIFFERENTIAL_HYPOTHESIS, "rank": 2},
            patient_ref=patient_ref
        )
        assert rank2["verificationStatus"]["coding"][0]["code"] == "differential"

    def test_map_observations_loinc_codes(self):
        """Test that observations have LOINC codes."""
        patient_ref = hash_patient_id("patient-123")
        
        observations = map_observations(SAMPLE_CLINICAL_DATA, patient_ref)
        
        assert len(observations) > 0
        
        # Check each observation has LOINC code
        for obs in observations:
            assert obs["code"]["coding"][0]["system"] == "http://loinc.org"
            assert "code" in obs["code"]["coding"][0]

    def test_map_observations_qtc_interpretation(self):
        """Test QTc interpretation for gender-specific thresholds."""
        patient_ref = hash_patient_id("patient-123")
        
        # Male with QTc 445ms (borderline high, >= 440)
        obs_male = map_observations(
            {"qtc_fridericia_ms": 445, "gender": "male"},
            patient_ref
        )
        qtc_obs = next(o for o in obs_male if "8634-8" in o["code"]["coding"][0]["code"])
        assert qtc_obs["interpretation"][0]["coding"][0]["code"] == "H"

    def test_map_observations_qtc_critical_note(self):
        """Test QTc > 500ms adds critical warning note."""
        patient_ref = hash_patient_id("patient-123")
        
        obs = map_observations(
            {"qtc_fridericia_ms": 510, "gender": "male"},
            patient_ref
        )
        qtc_obs = obs[0]
        
        assert "note" in qtc_obs
        assert "torsades" in qtc_obs["note"][0]["text"].lower()

    def test_map_observations_crcl_renal_bracket(self):
        """Test CrCl observation includes renal bracket extension."""
        patient_ref = hash_patient_id("patient-123")
        
        obs = map_observations(
            {"crcl_ml_min": 45, "gender": "male"},
            patient_ref
        )
        crcl_obs = obs[0]
        
        assert "extension" in crcl_obs
        assert any("renal-dose-bracket" in e["url"] for e in crcl_obs["extension"])

    def test_map_medication_request_intent_proposal(self):
        """Test MedicationRequest intent is 'proposal' (CDSS suggestion)."""
        patient_ref = hash_patient_id("patient-123")
        
        med_request = map_medication_request(
            recommendation=SAMPLE_MEDICATION_RECOMMENDATION,
            patient_ref=patient_ref,
            condition_refs=["condition-1"]
        )
        
        assert med_request["intent"] == "proposal"

    def test_map_medication_request_stopped_for_contraindicated(self):
        """Test MedicationRequest status is 'stopped' for CONTRAINDICATED DDI."""
        patient_ref = hash_patient_id("patient-123")
        
        rec_with_ddi = {
            **SAMPLE_MEDICATION_RECOMMENDATION,
            "interaction_warnings": [{
                "drug_a": "DrugA",
                "drug_b": "DrugB",
                "severity": "CONTRAINDICATED",
                "mechanism": "Test"
            }]
        }
        
        med_request = map_medication_request(
            recommendation=rec_with_ddi,
            patient_ref=patient_ref,
            condition_refs=[]
        )
        
        assert med_request["status"] == "stopped"
        assert "statusReason" in med_request

    def test_map_medication_request_renal_adjustment_note(self):
        """Test MedicationRequest includes renal adjustment note."""
        patient_ref = hash_patient_id("patient-123")
        
        med_request = map_medication_request(
            recommendation=SAMPLE_MEDICATION_RECOMMENDATION,
            patient_ref=patient_ref,
            condition_refs=[]
        )
        
        assert "note" in med_request
        assert "renal impairment" in med_request["note"][0]["text"].lower()

    def test_build_encounter_bundle_composition_author(self):
        """Test Composition author is Gelani AI System, not human."""
        clinical_session = {
            "encounter_id": "enc-1",
            "chief_complaint": "Chest pain",
            "differential": [SAMPLE_DIFFERENTIAL_HYPOTHESIS],
            "observations": {},
            "recommendations": [],
            "rag_sources": [],
            "audit_session_hash": "test-hash",
        }
        
        bundle = build_encounter_bundle(SAMPLE_PATIENT, clinical_session)
        
        # Find Composition
        composition = next(
            (e["resource"] for e in bundle["entry"] 
             if e["resource"]["resourceType"] == "Composition"),
            None
        )
        
        assert composition is not None
        author_display = composition["author"][0]["display"]
        assert author_display.startswith("Gelani Healthcare AI System")

    def test_build_encounter_bundle_type_document(self):
        """Test Bundle type is 'document'."""
        clinical_session = {
            "encounter_id": "enc-1",
            "chief_complaint": "Chest pain",
            "differential": [SAMPLE_DIFFERENTIAL_HYPOTHESIS],
            "observations": SAMPLE_CLINICAL_DATA,
            "recommendations": [SAMPLE_MEDICATION_RECOMMENDATION],
            "rag_sources": [],
            "audit_session_hash": "test-hash",
        }
        
        bundle = build_encounter_bundle(SAMPLE_PATIENT, clinical_session)
        
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "document"

    def test_build_encounter_bundle_cdss_tag(self):
        """Test Bundle has CDSS-generated tag."""
        clinical_session = {
            "encounter_id": "enc-1",
            "chief_complaint": "Chest pain",
            "differential": [SAMPLE_DIFFERENTIAL_HYPOTHESIS],
            "observations": {},
            "recommendations": [],
            "rag_sources": [],
            "audit_session_hash": "test-hash",
        }
        
        bundle = build_encounter_bundle(SAMPLE_PATIENT, clinical_session)
        
        tags = bundle["meta"]["tag"]
        cdss_tag = next((t for t in tags if t["code"] == "cdss-generated"), None)
        
        assert cdss_tag is not None
        assert "requires clinician review" in cdss_tag["display"].lower()

    def test_build_encounter_bundle_no_raw_patient_ids(self):
        """Test that no raw patient IDs appear in the bundle."""
        clinical_session = {
            "encounter_id": "enc-1",
            "chief_complaint": "Chest pain",
            "differential": [SAMPLE_DIFFERENTIAL_HYPOTHESIS],
            "observations": {},
            "recommendations": [],
            "rag_sources": [],
            "audit_session_hash": "test-hash",
        }
        
        bundle = build_encounter_bundle(SAMPLE_PATIENT, clinical_session)
        bundle_json = json.dumps(bundle)
        
        # Raw patient ID should not appear
        assert "patient-123" not in bundle_json
        assert "MRN-001" not in bundle_json


# =============================================================================
# Mapper Tests (Legacy)
# =============================================================================

class TestPatientToFhir:
    """Tests for patient_to_fhir mapper."""

    def test_creates_valid_fhir_patient(self):
        """Test that patient_to_fhir creates a valid FHIR Patient resource."""
        fhir_patient = patient_to_fhir(SAMPLE_PATIENT)

        # Check required FHIR fields
        assert fhir_patient["resourceType"] == "Patient"
        assert fhir_patient["id"] == "patient-123"
        assert fhir_patient["gender"] == "male"
        assert "birthDate" in fhir_patient
        assert "name" in fhir_patient
        assert len(fhir_patient["name"]) > 0

    def test_includes_mrn_identifier(self):
        """Test that MRN is included as an identifier."""
        fhir_patient = patient_to_fhir(SAMPLE_PATIENT)

        assert "identifier" in fhir_patient
        identifiers = fhir_patient["identifier"]
        mrn_identifier = next(
            (i for i in identifiers if i.get("type", {}).get("text") == "Medical Record Number"),
            None
        )
        assert mrn_identifier is not None
        assert mrn_identifier["value"] == "MRN-001"

    def test_validation_passes(self):
        """Test that the generated Patient passes validation."""
        fhir_patient = patient_to_fhir(SAMPLE_PATIENT)
        is_valid, errors = validate_fhir_resource(fhir_patient)
        assert is_valid, f"Validation errors: {errors}"


class TestSoapNoteToFhir:
    """Tests for soap_note_to_fhir mapper."""

    def test_creates_valid_fhir_composition(self):
        """Test that soap_note_to_fhir creates a valid FHIR Composition resource."""
        fhir_composition = soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123")

        # Check required FHIR fields
        assert fhir_composition["resourceType"] == "Composition"
        assert fhir_composition["id"] == "soap-456"
        assert fhir_composition["status"] == "final"
        assert "type" in fhir_composition
        assert "subject" in fhir_composition
        assert fhir_composition["subject"]["reference"] == "Patient/patient-123"
        assert "title" in fhir_composition

    def test_includes_loinc_code(self):
        """Test that LOINC code for consultation note is included."""
        fhir_composition = soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123")

        type_coding = fhir_composition["type"]["coding"][0]
        assert type_coding["system"] == "http://loinc.org"
        assert type_coding["code"] == "11488-4"

    def test_includes_sections(self):
        """Test that SOAP sections are included."""
        fhir_composition = soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123")

        assert "section" in fhir_composition
        sections = {s["title"] for s in fhir_composition["section"]}
        assert "Subjective" in sections
        assert "Objective" in sections
        assert "Assessment" in sections
        assert "Plan" in sections


class TestCreateFhirBundle:
    """Tests for create_fhir_bundle function."""

    def test_creates_valid_bundle(self):
        """Test that create_fhir_bundle creates a valid FHIR Bundle."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123"),
            assessment_item_to_fhir({
                "id": "cond-1",
                "diagnosis": "Test",
                "icdCode": "R69",
                "status": "active",
            }, "patient-123"),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")

        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "document"
        assert "entry" in bundle
        assert len(bundle["entry"]) == 3

    def test_bundle_entries_have_fullurl(self):
        """Test that bundle entries have fullUrl."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")

        for entry in bundle["entry"]:
            assert "fullUrl" in entry
            assert entry["fullUrl"].startswith("urn:uuid:")


# =============================================================================
# Integration Test Markers
# =============================================================================

@pytest.mark.integration
class TestFhirApiIntegration:
    """Integration tests that require a running FHIR service."""

    @pytest.mark.skip(reason="Requires running FHIR service")
    def test_get_patient_everything(self):
        """
        Integration test: GET /api/fhir/Patient/1/$everything
        
        Verification requirements:
        - Response is a JSON object with resourceType: "Bundle"
        - Contains at least one Patient entry
        - All entries have valid resourceType fields
        """
        import httpx

        response = httpx.get("http://localhost:3031/api/fhir/Patient/patient-123/$everything")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/fhir+json"

        data = response.json()
        assert data["resourceType"] == "Bundle"

        # Check for Patient entry
        patient_entries = [
            e for e in data["entry"]
            if e["resource"]["resourceType"] == "Patient"
        ]
        assert len(patient_entries) >= 1

    @pytest.mark.skip(reason="Requires running FHIR service")
    def test_bundle_validate_endpoint(self):
        """Integration test: POST /api/fhir/Bundle/$validate"""
        import httpx

        bundle = create_fhir_bundle([patient_to_fhir(SAMPLE_PATIENT)], bundle_type="document")
        
        response = httpx.post(
            "http://localhost:3031/api/fhir/Bundle/$validate",
            json=bundle,
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "valid" in data
        assert "issues" in data


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    # Run basic tests
    print("=" * 60)
    print("FHIR R4 Export - PROMPT 12 Verification Tests")
    print("=" * 60)

    # Test patient ID hashing
    print("\n1. Testing patient ID hashing...")
    hashed = hash_patient_id("patient-123")
    print(f"   Hashed ID: {hashed}")
    print(f"   Length: {len(hashed)} chars")
    assert len(hashed) == 32, "Hash should be 32 chars"
    print("   PASS: Patient ID hashing works correctly")

    # Test extensions
    print("\n2. Testing FHIR extensions...")
    ext = build_posterior_probability_extension(0.723)
    print(f"   Posterior probability extension: {ext}")
    assert ext["url"] == EXT_POSTERIOR_PROB
    print("   PASS: Extensions work correctly")

    # Test condition mapper with extensions
    print("\n3. Testing condition mapper with Bayesian extensions...")
    patient_ref = hash_patient_id("patient-123")
    condition = map_condition(SAMPLE_DIFFERENTIAL_HYPOTHESIS, patient_ref)
    print(f"   Condition ID: {condition['id']}")
    print(f"   Extensions count: {len(condition.get('extension', []))}")
    urls = [e["url"] for e in condition.get("extension", [])]
    assert EXT_POSTERIOR_PROB in urls, "Should have posterior probability extension"
    assert EXT_BAYESIAN_RANK in urls, "Should have Bayesian rank extension"
    print("   PASS: Condition mapper includes Bayesian extensions")

    # Test observations with LOINC
    print("\n4. Testing observation mapper with LOINC codes...")
    observations = map_observations(SAMPLE_CLINICAL_DATA, patient_ref)
    print(f"   Observations count: {len(observations)}")
    for obs in observations[:3]:
        code = obs["code"]["coding"][0]["code"]
        print(f"   - LOINC {code}: {obs['code']['coding'][0]['display']}")
    assert len(observations) > 0, "Should have observations"
    print("   PASS: Observations have LOINC codes")

    # Test medication request
    print("\n5. Testing medication request mapper...")
    med_request = map_medication_request(
        SAMPLE_MEDICATION_RECOMMENDATION,
        patient_ref,
        []
    )
    print(f"   Medication: {med_request['medicationCodeableConcept']['text']}")
    print(f"   Intent: {med_request['intent']}")
    print(f"   Status: {med_request['status']}")
    assert med_request["intent"] == "proposal", "CDSS suggestions should be 'proposal'"
    print("   PASS: MedicationRequest correctly configured")

    # Test full encounter bundle
    print("\n6. Testing full encounter bundle...")
    clinical_session = {
        "encounter_id": "enc-1",
        "chief_complaint": "Chest pain",
        "differential": [SAMPLE_DIFFERENTIAL_HYPOTHESIS],
        "observations": SAMPLE_CLINICAL_DATA,
        "recommendations": [SAMPLE_MEDICATION_RECOMMENDATION],
        "rag_sources": [{"pmid": "15282380", "title": "Test Article", "year": "2024"}],
        "audit_session_hash": "test-audit-hash",
    }
    
    bundle = build_encounter_bundle(SAMPLE_PATIENT, clinical_session)
    print(f"   Bundle type: {bundle['type']}")
    print(f"   Entry count: {len(bundle['entry'])}")
    
    # Count resource types
    resource_types = {}
    for entry in bundle["entry"]:
        rt = entry["resource"]["resourceType"]
        resource_types[rt] = resource_types.get(rt, 0) + 1
    print(f"   Resource types: {resource_types}")
    
    # Check for CDSS tag
    cdss_tag = next((t for t in bundle["meta"]["tag"] if t["code"] == "cdss-generated"), None)
    assert cdss_tag is not None, "Should have CDSS-generated tag"
    print("   PASS: Full encounter bundle built correctly")

    # Verify no raw patient IDs
    print("\n7. Verifying no raw patient IDs in bundle...")
    bundle_json = json.dumps(bundle)
    assert "patient-123" not in bundle_json, "Raw patient ID should not appear"
    assert "MRN-001" not in bundle_json, "Raw MRN should not appear"
    print("   PASS: No raw patient IDs exposed in bundle")

    print("\n" + "=" * 60)
    print("All P12 FHIR R4 Export tests passed!")
    print("=" * 60)
