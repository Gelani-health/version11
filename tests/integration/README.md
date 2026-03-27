# Integration Tests for Gelani Healthcare Assistant

This directory contains comprehensive integration tests for the Gelani Healthcare clinical decision support system.

## Test Groups

### 1. Diagnostic Workflow (`test_diagnostic_workflow.py`)
- **test_differential_diagnosis_completeness**: Validates differential diagnosis response completeness
- **test_critical_flag_propagation**: Ensures emergency presentations are flagged as critical
- **test_diagnostic_with_patient_context**: Tests patient context integration (allergies, medications)
- **test_diagnostic_response_schema**: Validates response schema compliance
- **test_diagnostic_latency**: Response time requirements (< 10s)

### 2. Antimicrobial Safety - Allergies (`test_antimicrobial_safety.py`)
- **test_penicillin_anaphylaxis_blocks_first_gen_cephalosporins**: First-gen cephalosporin blocking for severe penicillin allergy
- **test_no_allergy_no_block**: Control test - drugs not incorrectly blocked

### 3. Antimicrobial Safety - Drug Interactions (`test_antimicrobial_safety.py`)
- **test_linezolid_citalopram_contraindicated**: Linezolid + SSRI serotonin syndrome detection

### 4. Renal Dosing Math (`test_renal_dosing.py`)
- **test_cockcroft_gault_calculation**: Accurate CrCl with IBW adjustment for obese patients
- **test_normal_renal_function**: Normal renal function categorization
- **test_vancomycin_dose_reduction_severe_renal**: Vancomycin dose adjustment for severe impairment

### 5. ECG QTc Calculations (`test_ecg_qtc.py`)
- **test_fridericia_primary_at_elevated_hr**: Fridericia preferred at HR > 100
- **test_qtc_prolonged_female_threshold**: Gender-specific thresholds (female: >450ms)
- **test_critical_qtc_alert**: Critical alert for QTc > 500ms

### 6. Authentication Security (`test_auth_security.py`)
- **test_forged_unsigned_token_rejected**: Invalid signature detection
- **test_expired_token_rejected**: Token expiry enforcement
- **test_tampered_payload_rejected**: Payload tampering detection
- **test_valid_token_succeeds**: Valid token acceptance
- **test_missing_token_rejected**: Missing Authorization header handling
- **test_malformed_token_rejected**: Malformed token rejection

### 7. RAG Citation Integrity (`test_rag_citation_integrity.py`)
- **test_cap_query_returns_pubmed_citations**: Valid PubMed ID format (7-8 digits)
- **test_no_hallucinated_pmids_in_llm_output**: Citation hallucination detection
- **test_citation_has_required_metadata**: Required citation fields
- **test_no_duplicate_pmids**: Deduplication verification

## Prerequisites

### 1. Service Requirements
- Medical RAG service running on port 3031
- PubMed ingestion (P9) completed for citation tests
- Pinecone index populated with PubMed articles

### 2. Environment Variables
```bash
export RAG_SERVICE_URL=http://localhost:3031
export TEST_SESSION_SECRET="your-test-secret-key-at-least-32-characters"
```

### 3. Install Test Dependencies
```bash
pip install -r tests/integration/requirements-test.txt
```

## Running Tests

### Quick Run (All Tests)
```bash
make test-integration
```

### Run Specific Test File
```bash
pytest tests/integration/test_diagnostic_workflow.py -v
```

### Run with Coverage
```bash
pytest tests/integration/ --cov=mini-services --cov-report=html
```

## Test Data Fixtures

| Fixture | Description | Key Values |
|---------|-------------|------------|
| `penicillin_allergy_patient` | Severe penicillin allergy | Age 45, M, 80kg, anaphylaxis |
| `renal_patient` | Severe renal impairment | Age 70, F, CrCl ~27.8 mL/min |
| `citalopram_patient` | SSRI therapy | Age 55, F, on citalopram 20mg |
| `healthy_patient_no_allergies` | Control patient | Age 35, M, no conditions |

## Clinical References

### Renal Function
- Cockcroft DW, Gault MH. Nephron 1976;16:31-41
- Devine BJ. Drug Intell Clin Pharm 1974;8:650-655

### ECG QTc
- Bazett HC. Heart 1920;7:353-370
- Fridericia LS. Acta Med Scand 1920;54:467-486
- Rautaharju PM et al. J Am Coll Cardiol 2009;53:982-991

### Antimicrobial Safety
- IDSA Antimicrobial Stewardship Guidelines 2024
- Campagna JD et al. N Engl J Med 2012;367:2386
