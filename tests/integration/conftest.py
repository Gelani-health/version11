"""
Integration Tests Configuration and Fixtures
=============================================

Provides pytest fixtures for integration testing:
- async_client: Session-scoped httpx.AsyncClient with test JWT
- Patient fixtures with various clinical scenarios
- JWT token generation using HMAC-SHA256

Environment Variables:
- RAG_SERVICE_URL: Base URL for medical-rag-service (default: http://localhost:3031)
- TEST_SESSION_SECRET: HMAC secret for test JWT generation

References:
- P1 Auth: HMAC-SHA256 signed tokens
- P2 Renal: Cockcroft-Gault with IBW adjustment
- P3 Antimicrobial: Allergy cross-reactivity database
"""

import os
import asyncio
import time
import hashlib
import hmac
import base64
import json
from typing import Dict, Any, Optional, AsyncGenerator

import httpx
import pytest


# =============================================================================
# CONFIGURATION
# =============================================================================

RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:3031")
TEST_SESSION_SECRET = os.getenv("TEST_SESSION_SECRET", "test-secret-key-for-integration-tests-min-32-chars")

# Token configuration (matches auth-middleware.ts)
TOKEN_EXPIRY_SECONDS = 8 * 60 * 60  # 8 hours


# =============================================================================
# JWT TOKEN GENERATION (Python implementation of auth-middleware.ts)
# =============================================================================

def base64url_encode(data: str) -> str:
    """Base64URL encode without padding."""
    return base64.urlsafe_b64encode(data.encode()).rstrip(b'=').decode()


def base64url_decode(data: str) -> str:
    """Base64URL decode with padding restoration."""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data).decode()


def create_hmac_signature(data: str, secret: str) -> str:
    """Create HMAC-SHA256 signature in Base64URL format."""
    signature = hmac.new(
        secret.encode(),
        data.encode(),
        hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(signature).rstrip(b'=').decode()


def create_test_jwt(
    user_id: str = "test-user-001",
    role: str = "clinician",
    expires_in_seconds: int = TOKEN_EXPIRY_SECONDS,
    issued_at: Optional[int] = None,
) -> str:
    """
    Create a valid HMAC-SHA256 signed JWT token for testing.
    
    Matches the token format from src/lib/auth-middleware.ts:
    - Header: {"alg": "HS256", "typ": "JWT"}
    - Payload: {"userId": string, "role": string, "iat": number, "exp": number}
    - Signature: HMAC-SHA256 over header.payload
    """
    now = issued_at if issued_at is not None else int(time.time())
    
    # Build header
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64url_encode(json.dumps(header))
    
    # Build payload
    payload = {
        "userId": user_id,
        "role": role,
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    encoded_payload = base64url_encode(json.dumps(payload))
    
    # Create signature
    signature_input = f"{encoded_header}.{encoded_payload}"
    signature = create_hmac_signature(signature_input, TEST_SESSION_SECRET)
    
    return f"{encoded_header}.{encoded_payload}.{signature}"


def create_unsigned_jwt(user_id: str = "test-user-001", role: str = "clinician") -> str:
    """Create a JWT without valid signature (for security testing)."""
    now = int(time.time())
    
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64url_encode(json.dumps(header))
    
    payload = {
        "userId": user_id,
        "role": role,
        "iat": now,
        "exp": now + TOKEN_EXPIRY_SECONDS,
    }
    encoded_payload = base64url_encode(json.dumps(payload))
    
    # Empty signature (old broken format)
    return f"{encoded_header}.{encoded_payload}.invalid_signature"


def create_expired_jwt(user_id: str = "test-user-001", role: str = "clinician") -> str:
    """Create a valid JWT that has already expired."""
    # Set expiration to 1 hour ago
    expired_time = int(time.time()) - 3600
    return create_test_jwt(user_id, role, expires_in_seconds=0, issued_at=expired_time - TOKEN_EXPIRY_SECONDS)


def create_tampered_jwt(original_token: str, new_role: str = "admin") -> str:
    """
    Create a tampered JWT with modified payload but original signature.
    
    This tests that signature verification catches payload tampering.
    """
    parts = original_token.split('.')
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    
    # Decode the payload
    payload = json.loads(base64url_decode(parts[1]))
    
    # Tamper with the role
    payload["role"] = new_role
    
    # Re-encode payload WITHOUT re-signing
    tampered_payload = base64url_encode(json.dumps(payload))
    
    # Return with original signature (this should fail verification)
    return f"{parts[0]}.{tampered_payload}.{parts[2]}"


# =============================================================================
# SERVICE HEALTH CHECK
# =============================================================================

async def check_service_health(base_url: str, timeout: float = 5.0) -> bool:
    """Check if the medical-rag-service is reachable."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{base_url}/health")
            return response.status_code == 200
    except Exception:
        return False


# =============================================================================
# PYTEST FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def rag_service_url() -> str:
    """Get RAG service URL from environment."""
    return RAG_SERVICE_URL


@pytest.fixture(scope="session")
def test_jwt_secret() -> str:
    """Get test JWT secret from environment."""
    return TEST_SESSION_SECRET


@pytest.fixture(scope="session")
async def service_available(rag_service_url: str) -> bool:
    """
    Check if the medical-rag-service is available.
    
    Tests will be skipped if service is unreachable.
    """
    available = await check_service_health(rag_service_url)
    if not available:
        pytest.skip(f"Medical RAG service not reachable at {rag_service_url}")
    return available


@pytest.fixture(scope="session")
async def async_client(rag_service_url: str) -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    Session-scoped HTTP client for API testing.
    
    Includes:
    - Base URL set to medical-rag-service
    - 30 second timeout
    - Valid test JWT in Authorization header
    """
    # Check if service is available first
    available = await check_service_health(rag_service_url)
    if not available:
        pytest.skip(f"Medical RAG service not reachable at {rag_service_url}")
    
    # Generate fresh JWT for this test session
    test_token = create_test_jwt(user_id="test-integration-user", role="clinician")
    
    headers = {
        "Authorization": f"Bearer {test_token}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient(
        base_url=rag_service_url,
        timeout=httpx.Timeout(30.0, connect=10.0),
        headers=headers,
    ) as client:
        yield client


# =============================================================================
# PATIENT FIXTURES
# =============================================================================

@pytest.fixture
def penicillin_allergy_patient() -> Dict[str, Any]:
    """
    Patient with severe penicillin allergy.
    
    Used to test:
    - First-gen cephalosporin blocking
    - Cross-reactivity warnings
    - Alternative antibiotic recommendations
    """
    return {
        "patient_id": "test-001",
        "allergies": [
            {
                "drug": "penicillin",
                "reaction": "anaphylaxis",
                "severity": "severe"
            }
        ],
        "age": 45,
        "sex": "M",
        "weight_kg": 80,
        "height_cm": 175,
        "serum_creatinine": 1.0,
        "medical_history": [],
        "current_medications": [],
    }


@pytest.fixture
def renal_patient() -> Dict[str, Any]:
    """
    Patient with severe renal impairment.
    
    Used to test:
    - Cockcroft-Gault calculation with IBW adjustment
    - Renal dosing category determination
    - Vancomycin dose reduction recommendations
    
    Expected CrCl: ~27.8 mL/min (severe impairment)
    Calculation:
    - IBW (female, 160cm) = 45.5 + 2.3 * (62.99 - 60) ≈ 52.4 kg
    - Actual weight 80kg / 52.4kg = 153% IBW (>130%, obese)
    - AdjBW = 52.4 + 0.4 * (80 - 52.4) = 63.4 kg
    - CrCl = [(140 - 70) * 63.4] / (72 * 1.4) * 0.85 ≈ 27.8 mL/min
    """
    return {
        "patient_id": "test-002",
        "age": 70,
        "sex": "F",
        "weight_kg": 80,
        "height_cm": 160,
        "serum_creatinine": 1.4,
        "allergies": [],
        "medical_history": ["Chronic kidney disease"],
        "current_medications": [],
    }


@pytest.fixture
def citalopram_patient() -> Dict[str, Any]:
    """
    Patient on citalopram (SSRI).
    
    Used to test:
    - Linezolid + SSRI serotonin syndrome contraindication
    - MAOI interaction warnings
    - Drug-drug interaction detection
    """
    return {
        "patient_id": "test-003",
        "age": 55,
        "sex": "F",
        "weight_kg": 65,
        "height_cm": 165,
        "serum_creatinine": 0.9,
        "allergies": [],
        "medical_history": ["Depression"],
        "current_medications": [
            {"drug": "citalopram", "dose": "20mg", "route": "oral"}
        ],
    }


@pytest.fixture
def warfarin_patient() -> Dict[str, Any]:
    """
    Patient on warfarin anticoagulation.
    
    Used to test:
    - Ciprofloxacin-warfarin interaction (increased INR)
    - Major bleeding risk warnings
    """
    return {
        "patient_id": "test-004",
        "age": 68,
        "sex": "M",
        "weight_kg": 75,
        "height_cm": 170,
        "serum_creatinine": 1.1,
        "allergies": [],
        "medical_history": ["Atrial fibrillation", "DVT"],
        "current_medications": [
            {"drug": "warfarin", "dose": "5mg", "route": "oral"}
        ],
    }


@pytest.fixture
def healthy_patient_no_allergies() -> Dict[str, Any]:
    """
    Healthy patient with no allergies or medical conditions.
    
    Used as control to verify that drugs are not incorrectly blocked.
    """
    return {
        "patient_id": "test-005",
        "age": 35,
        "sex": "M",
        "weight_kg": 80,
        "height_cm": 180,
        "serum_creatinine": 0.9,
        "allergies": [],
        "medical_history": [],
        "current_medications": [],
    }


# =============================================================================
# TEST TOKEN FIXTURES
# =============================================================================

@pytest.fixture
def valid_test_token() -> str:
    """Generate a valid test JWT token."""
    return create_test_jwt()


@pytest.fixture
def unsigned_token() -> str:
    """Generate an unsigned/invalid-signature JWT (for security testing)."""
    return create_unsigned_jwt()


@pytest.fixture
def expired_token() -> str:
    """Generate an expired JWT (for security testing)."""
    return create_expired_jwt()


@pytest.fixture
def tampered_token(valid_test_token: str) -> str:
    """Generate a tampered JWT with modified role (for security testing)."""
    return create_tampered_jwt(valid_test_token, new_role="admin")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def extract_pmids_from_text(text: str) -> list:
    """Extract all PMID references from text using regex."""
    import re
    # PMID format: 7-8 digits, sometimes prefixed with PMID:
    pattern = r'\bPMID[:\s]*(\d{7,8})\b|\b(\d{7,8})\b(?=.*?PMID)'
    matches = re.findall(pattern, text, re.IGNORECASE)
    # Flatten and deduplicate
    pmids = set()
    for match in matches:
        for group in match:
            if group and group.isdigit() and 7 <= len(group) <= 8:
                pmids.add(group)
    return list(pmids)


def is_valid_icd10(code: str) -> bool:
    """Check if a string matches ICD-10 format."""
    import re
    # ICD-10 format: Letter followed by 2 digits, optionally more characters
    pattern = r'^[A-Z][0-9]{2}(\.[A-Z0-9]{1,4})?$'
    return bool(re.match(pattern, code))


def is_valid_pmid(pmid: str) -> bool:
    """Check if a string is a valid PMID format (7-8 digits)."""
    import re
    return bool(re.match(r'^\d{7,8}$', pmid))
