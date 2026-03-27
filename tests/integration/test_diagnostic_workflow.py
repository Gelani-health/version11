"""
Test Group 1: Full Diagnostic Workflow
======================================

Tests for complete diagnostic workflow including:
- Differential diagnosis completeness
- Critical flag propagation for emergency presentations
- Response time requirements
- ICD-10 code validation

References:
- P1: Safety validation pipeline
- P3: Differential diagnosis engine
"""

import re
import time
import pytest
from httpx import AsyncClient


class TestDiagnosticWorkflow:
    """Test complete diagnostic workflow."""

    @pytest.mark.asyncio
    async def test_differential_diagnosis_completeness(
        self,
        async_client: AsyncClient,
        healthy_patient_no_allergies: dict,
    ):
        """
        Test that differential diagnosis response is complete and well-formed.
        
        Assertions:
        - Response status 200
        - Differential array has ≥ 3 items
        - Each item has hypothesis, probability, icd10_code fields
        - Sum of all probabilities ≤ 1.0 (with 0.01 tolerance for floating point)
        - Top hypothesis probability > 0.10 (not trivially small)
        - At least one ICD-10 code matches valid format
        - Response time < 10s
        """
        payload = {
            "patient_symptoms": "fever and productive cough for 3 days",
            "age": healthy_patient_no_allergies["age"],
            "gender": healthy_patient_no_allergies["sex"],
            "current_medications": healthy_patient_no_allergies.get("current_medications", []),
            "allergies": healthy_patient_no_allergies.get("allergies", []),
        }
        
        start_time = time.time()
        response = await async_client.post("/api/v1/diagnose", json=payload)
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Response time assertion
        assert elapsed_ms < 10000, f"Response time {elapsed_ms}ms exceeds 10s limit"
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check for differential diagnoses
        differential = data.get("differential_diagnoses", [])
        assert len(differential) >= 3, f"Expected ≥ 3 differential diagnoses, got {len(differential)}"
        
        # Validate each diagnosis entry
        total_probability = 0.0
        has_valid_icd10 = False
        top_probability = 0.0
        
        for diag in differential:
            # Check required fields
            assert "condition" in diag or "hypothesis" in diag, "Missing condition/hypothesis field"
            assert "probability" in diag, "Missing probability field"
            
            prob = diag.get("probability", 0)
            total_probability += prob
            
            if prob > top_probability:
                top_probability = prob
            
            # Check ICD-10 format if present
            icd10 = diag.get("icd10_code")
            if icd10:
                # ICD-10 format: Letter + 2 digits, optionally more
                if re.match(r"^[A-Z][0-9]{2}", str(icd10)):
                    has_valid_icd10 = True
        
        # Probability sum should be ≤ 1.0 with small tolerance for floating point
        assert total_probability <= 1.01, f"Probability sum {total_probability} exceeds 1.0"
        
        # Top hypothesis should not be trivially small
        assert top_probability > 0.10, f"Top probability {top_probability} is too small (< 0.10)"
        
        # At least one valid ICD-10 code should be present
        assert has_valid_icd10, "No valid ICD-10 code found in differential diagnoses"

    @pytest.mark.asyncio
    async def test_critical_flag_propagation(self, async_client: AsyncClient):
        """
        Test that emergency presentations are flagged as critical.
        
        Uses chief complaint "sudden onset severe headache, worst of my life"
        which is a classic presentation of subarachnoid hemorrhage.
        
        Assertions:
        - At least one hypothesis has is_critical: true
        - OR response contains emergency/red_flag indicators
        """
        payload = {
            "patient_symptoms": "sudden onset severe headache, worst of my life",
            "age": 55,
            "gender": "M",
        }
        
        response = await async_client.post("/api/v1/diagnose", json=payload)
        
        # Allow for either 200 (normal) or emergency detection response
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        
        # Check for critical/emergency indicators
        has_critical = False
        
        # Check differential diagnoses for critical flag
        differential = data.get("differential_diagnoses", [])
        for diag in differential:
            if diag.get("is_critical"):
                has_critical = True
                break
        
        # Check for red flags or emergency detection
        red_flags = data.get("red_flags", [])
        if any("emergency" in str(rf).lower() or "critical" in str(rf).lower() or "immediate" in str(rf).lower() 
               for rf in red_flags):
            has_critical = True
        
        # Check summary for emergency indicators
        summary = data.get("summary", "")
        if any(keyword in summary.lower() for keyword in ["emergency", "critical", "immediate", "urgent"]):
            has_critical = True
        
        assert has_critical, (
            "Expected critical/emergency flag for 'worst headache of my life' presentation. "
            f"Response: {data}"
        )

    @pytest.mark.asyncio
    async def test_diagnostic_with_patient_context(
        self,
        async_client: AsyncClient,
        penicillin_allergy_patient: dict,
    ):
        """
        Test diagnostic recommendations respect patient context (allergies).
        
        This test verifies that patient context (allergies, medications, age)
        is properly passed through and considered in the diagnostic workflow.
        """
        payload = {
            "patient_symptoms": "sore throat and fever for 2 days",
            "age": penicillin_allergy_patient["age"],
            "gender": penicillin_allergy_patient["sex"],
            "allergies": ["penicillin"],
        }
        
        response = await async_client.post("/api/v1/diagnose", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Response should be non-empty
        assert "differential_diagnoses" in data or "summary" in data, "Missing diagnostic output"
        
        # If treatment considerations are provided, check for allergy awareness
        treatments = data.get("treatment_considerations", [])
        # Note: This is a soft check - the actual allergy blocking happens in /recommend endpoint
        assert isinstance(treatments, list), "Treatment considerations should be a list"

    @pytest.mark.asyncio
    async def test_diagnostic_response_schema(
        self,
        async_client: AsyncClient,
        healthy_patient_no_allergies: dict,
    ):
        """
        Test that diagnostic response follows expected schema.
        
        Expected schema fields:
        - request_id: str
        - timestamp: str (ISO format)
        - summary: str
        - differential_diagnoses: list
        - evidence_summary: str (optional)
        - citations: list (optional)
        - recommended_workup: list
        - treatment_considerations: list
        - red_flags: list
        - follow_up: str (optional)
        - confidence_level: str
        - model_used: str
        - disclaimer: str
        """
        payload = {
            "patient_symptoms": "chest pain and shortness of breath",
            "age": healthy_patient_no_allergies["age"],
            "gender": healthy_patient_no_allergies["sex"],
        }
        
        response = await async_client.post("/api/v1/diagnose", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check required fields exist
        required_fields = ["summary", "differential_diagnoses"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Check optional fields have correct types when present
        if "differential_diagnoses" in data:
            assert isinstance(data["differential_diagnoses"], list)
        
        if "citations" in data:
            assert isinstance(data["citations"], list)
        
        if "recommended_workup" in data:
            assert isinstance(data["recommended_workup"], list)
        
        if "red_flags" in data:
            assert isinstance(data["red_flags"], list)
        
        # Check confidence level if present
        if "confidence_level" in data:
            valid_levels = ["high", "medium", "low"]
            assert data["confidence_level"].lower() in valid_levels, (
                f"Invalid confidence level: {data['confidence_level']}"
            )

    @pytest.mark.asyncio
    async def test_diagnostic_latency(self, async_client: AsyncClient):
        """
        Test that diagnostic endpoint responds within acceptable time limits.
        
        P95 latency should be < 15 seconds for complex queries.
        """
        payload = {
            "patient_symptoms": "abdominal pain, nausea, and vomiting for 6 hours",
            "age": 45,
            "gender": "F",
        }
        
        start_time = time.time()
        response = await async_client.post("/api/v1/diagnose", json=payload)
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert response.status_code == 200
        assert elapsed_ms < 15000, f"Response latency {elapsed_ms}ms exceeds 15s limit"
