"""
FHIR R4 Export Implementation Test
===================================

Test file to verify PROMPT 12 — FHIR R4 Export implementation.

This test validates:
1. FHIR resource mappers produce valid FHIR R4 JSON
2. GET /api/fhir/Patient/{id}/$everything returns valid Bundle
3. Bundle contains at least one Patient entry
4. All entries have valid resourceType fields

Evidence Sources:
- HL7 FHIR R4 Specification: https://hl7.org/fhir/R4/
- FHIR Validator: https://validator.fhir.org/

Run with: python -m pytest test_p12_fhir_export.py -v
"""

import json
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

# Import FHIR mappers
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

SAMPLE_DIAGNOSTIC = {
    "id": "diag-789",
    "diagnosisName": "Complete Blood Count",
    "snomedCode": "43781009",
    "icdCode": "R69",
    "status": "completed",
    "priority": "routine",
    "createdAt": "2026-03-28T09:00:00Z",
}

SAMPLE_ASSESSMENT_ITEM = {
    "id": "condition-001",
    "diagnosis": "Essential hypertension",
    "icdCode": "I10",
    "snomedCode": "59621000",
    "status": "active",
    "isPrimary": True,
    "confidence": 0.9,
    "notes": "Well-controlled on current medication",
    "createdAt": "2026-01-15T08:00:00Z",
}


# =============================================================================
# Mapper Tests
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

    def test_includes_name(self):
        """Test that name is properly formatted."""
        fhir_patient = patient_to_fhir(SAMPLE_PATIENT)

        name = fhir_patient["name"][0]
        assert name["family"] == "Doe"
        assert "John" in name["given"]
        assert "William" in name["given"]
        assert name["use"] == "official"

    def test_includes_telecom(self):
        """Test that telecom is included."""
        fhir_patient = patient_to_fhir(SAMPLE_PATIENT)

        assert "telecom" in fhir_patient
        phone = next((t for t in fhir_patient["telecom"] if t["system"] == "phone"), None)
        email = next((t for t in fhir_patient["telecom"] if t["system"] == "email"), None)
        assert phone is not None
        assert phone["value"] == "555-123-4567"
        assert email is not None
        assert email["value"] == "john.doe@email.com"

    def test_gender_mapping(self):
        """Test gender mapping to FHIR values."""
        # Test male
        fhir_patient = patient_to_fhir({**SAMPLE_PATIENT, "gender": "male"})
        assert fhir_patient["gender"] == "male"

        # Test female
        fhir_patient = patient_to_fhir({**SAMPLE_PATIENT, "gender": "female"})
        assert fhir_patient["gender"] == "female"

        # Test unknown
        fhir_patient = patient_to_fhir({**SAMPLE_PATIENT, "gender": "unknown"})
        assert fhir_patient["gender"] == "unknown"

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

    def test_status_mapping(self):
        """Test status mapping from internal to FHIR."""
        # Draft -> preliminary
        fhir_composition = soap_note_to_fhir({**SAMPLE_SOAP_NOTE, "status": "draft"}, "patient-123")
        assert fhir_composition["status"] == "preliminary"

        # Signed -> final
        fhir_composition = soap_note_to_fhir({**SAMPLE_SOAP_NOTE, "status": "signed"}, "patient-123")
        assert fhir_composition["status"] == "final"

        # Amended -> amended
        fhir_composition = soap_note_to_fhir({**SAMPLE_SOAP_NOTE, "status": "amended"}, "patient-123")
        assert fhir_composition["status"] == "amended"

    def test_validation_passes(self):
        """Test that the generated Composition passes validation."""
        fhir_composition = soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123")
        is_valid, errors = validate_fhir_resource(fhir_composition)
        assert is_valid, f"Validation errors: {errors}"


class TestDiagnosticToFhir:
    """Tests for diagnostic_to_fhir mapper."""

    def test_creates_valid_fhir_service_request(self):
        """Test that diagnostic_to_fhir creates a valid FHIR ServiceRequest resource."""
        fhir_service_request = diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123")

        # Check required FHIR fields
        assert fhir_service_request["resourceType"] == "ServiceRequest"
        assert fhir_service_request["id"] == "diag-789"
        assert fhir_service_request["status"] == "completed"
        assert fhir_service_request["intent"] == "order"
        assert "code" in fhir_service_request
        assert "subject" in fhir_service_request
        assert fhir_service_request["subject"]["reference"] == "Patient/patient-123"

    def test_includes_reason_code(self):
        """Test that reasonCode includes ICD-10 code."""
        fhir_service_request = diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123")

        assert "reasonCode" in fhir_service_request
        reason = fhir_service_request["reasonCode"][0]
        coding = reason["coding"][0]
        assert coding["system"] == "http://hl7.org/fhir/sid/icd-10"
        assert coding["code"] == "R69"

    def test_validation_passes(self):
        """Test that the generated ServiceRequest passes validation."""
        fhir_service_request = diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123")
        is_valid, errors = validate_fhir_resource(fhir_service_request)
        assert is_valid, f"Validation errors: {errors}"


class TestAssessmentItemToFhir:
    """Tests for assessment_item_to_fhir mapper."""

    def test_creates_valid_fhir_condition(self):
        """Test that assessment_item_to_fhir creates a valid FHIR Condition resource."""
        fhir_condition = assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123")

        # Check required FHIR fields
        assert fhir_condition["resourceType"] == "Condition"
        assert fhir_condition["id"] == "condition-001"
        assert "code" in fhir_condition
        assert "subject" in fhir_condition
        assert fhir_condition["subject"]["reference"] == "Patient/patient-123"

    def test_includes_icd_code(self):
        """Test that ICD-10 code is included."""
        fhir_condition = assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123")

        coding = fhir_condition["code"]["coding"][0]
        assert coding["system"] == "http://hl7.org/fhir/sid/icd-10"
        assert coding["code"] == "I10"
        assert coding["display"] == "Essential hypertension"

    def test_includes_clinical_status(self):
        """Test that clinicalStatus is set."""
        fhir_condition = assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123")

        assert "clinicalStatus" in fhir_condition
        coding = fhir_condition["clinicalStatus"]["coding"][0]
        assert coding["system"] == "http://terminology.hl7.org/CodeSystem/condition-clinical"
        assert coding["code"] == "active"

    def test_includes_verification_status(self):
        """Test that verificationStatus reflects confidence."""
        # High confidence -> confirmed
        fhir_condition = assessment_item_to_fhir(
            {**SAMPLE_ASSESSMENT_ITEM, "confidence": 0.9, "isPrimary": True},
            "patient-123"
        )
        coding = fhir_condition["verificationStatus"]["coding"][0]
        assert coding["code"] == "confirmed"

        # Lower confidence -> provisional
        fhir_condition = assessment_item_to_fhir(
            {**SAMPLE_ASSESSMENT_ITEM, "confidence": 0.5, "isPrimary": False},
            "patient-123"
        )
        coding = fhir_condition["verificationStatus"]["coding"][0]
        assert coding["code"] == "provisional"

    def test_validation_passes(self):
        """Test that the generated Condition passes validation."""
        fhir_condition = assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123")
        is_valid, errors = validate_fhir_resource(fhir_condition)
        assert is_valid, f"Validation errors: {errors}"


class TestCreateFhirBundle:
    """Tests for create_fhir_bundle function."""

    def test_creates_valid_bundle(self):
        """Test that create_fhir_bundle creates a valid FHIR Bundle."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123"),
            assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123"),
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

    def test_bundle_entries_have_resource(self):
        """Test that bundle entries have resource."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123"),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")

        for entry in bundle["entry"]:
            assert "resource" in entry
            assert "resourceType" in entry["resource"]

    def test_searchset_bundle_includes_total(self):
        """Test that searchset bundles include total count."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="searchset")

        assert "total" in bundle
        assert bundle["total"] == 1

    def test_validation_passes(self):
        """Test that the generated Bundle passes validation."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123"),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")
        is_valid, errors = validate_fhir_resource(bundle)
        assert is_valid, f"Validation errors: {errors}"


class TestPatientEverythingOperation:
    """Tests for the $everything operation response."""

    def test_bundle_contains_patient_entry(self):
        """Test that $everything bundle contains at least one Patient entry."""
        # Simulate $everything response
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123"),
            assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123"),
            diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123"),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")
        bundle["total"] = len(resources)

        # Verify Patient entry exists
        patient_entries = [
            e for e in bundle["entry"]
            if e["resource"]["resourceType"] == "Patient"
        ]
        assert len(patient_entries) >= 1

    def test_all_entries_have_valid_resourcetype(self):
        """Test that all entries have valid resourceType fields."""
        resources = [
            patient_to_fhir(SAMPLE_PATIENT),
            soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123"),
            assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123"),
            diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123"),
        ]

        bundle = create_fhir_bundle(resources, bundle_type="document")

        valid_resource_types = {"Patient", "Composition", "Condition", "ServiceRequest", "Bundle"}

        for entry in bundle["entry"]:
            resource_type = entry["resource"]["resourceType"]
            assert resource_type in valid_resource_types, f"Invalid resourceType: {resource_type}"


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

        data = response.json()
        assert data["resourceType"] == "Bundle"

        # Check for Patient entry
        patient_entries = [
            e for e in data["entry"]
            if e["resource"]["resourceType"] == "Patient"
        ]
        assert len(patient_entries) >= 1

        # Check all entries have valid resourceType
        for entry in data["entry"]:
            assert "resourceType" in entry["resource"]


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    # Run basic tests
    print("=" * 60)
    print("FHIR R4 Export - PROMPT 12 Verification Tests")
    print("=" * 60)

    # Test patient mapper
    print("\n1. Testing patient_to_fhir mapper...")
    fhir_patient = patient_to_fhir(SAMPLE_PATIENT)
    is_valid, errors = validate_fhir_resource(fhir_patient)
    print(f"   Created Patient resource: {fhir_patient['id']}")
    print(f"   Validation: {'PASS' if is_valid else 'FAIL'}")
    if errors:
        print(f"   Errors: {errors}")

    # Test soap note mapper
    print("\n2. Testing soap_note_to_fhir mapper...")
    fhir_composition = soap_note_to_fhir(SAMPLE_SOAP_NOTE, "patient-123")
    is_valid, errors = validate_fhir_resource(fhir_composition)
    print(f"   Created Composition resource: {fhir_composition['id']}")
    print(f"   Validation: {'PASS' if is_valid else 'FAIL'}")
    if errors:
        print(f"   Errors: {errors}")

    # Test diagnostic mapper
    print("\n3. Testing diagnostic_to_fhir mapper...")
    fhir_service_request = diagnostic_to_fhir(SAMPLE_DIAGNOSTIC, "patient-123")
    is_valid, errors = validate_fhir_resource(fhir_service_request)
    print(f"   Created ServiceRequest resource: {fhir_service_request['id']}")
    print(f"   Validation: {'PASS' if is_valid else 'FAIL'}")
    if errors:
        print(f"   Errors: {errors}")

    # Test assessment item mapper
    print("\n4. Testing assessment_item_to_fhir mapper...")
    fhir_condition = assessment_item_to_fhir(SAMPLE_ASSESSMENT_ITEM, "patient-123")
    is_valid, errors = validate_fhir_resource(fhir_condition)
    print(f"   Created Condition resource: {fhir_condition['id']}")
    print(f"   Validation: {'PASS' if is_valid else 'FAIL'}")
    if errors:
        print(f"   Errors: {errors}")

    # Test bundle creation
    print("\n5. Testing create_fhir_bundle...")
    resources = [
        fhir_patient,
        fhir_composition,
        fhir_condition,
        fhir_service_request,
    ]
    bundle = create_fhir_bundle(resources, bundle_type="document")
    bundle["total"] = len(resources)
    is_valid, errors = validate_fhir_resource(bundle)
    print(f"   Created Bundle with {len(bundle['entry'])} entries")
    print(f"   Bundle type: {bundle['type']}")
    print(f"   Validation: {'PASS' if is_valid else 'FAIL'}")
    if errors:
        print(f"   Errors: {errors}")

    # Print sample output for FHIR Validator
    print("\n" + "=" * 60)
    print("Sample FHIR Bundle for Validator Testing")
    print("=" * 60)
    print("Copy the JSON below to https://validator.fhir.org/ for validation:")
    print("\n" + json.dumps(bundle, indent=2)[:2000] + "\n... (truncated)")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)
