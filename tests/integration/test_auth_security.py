"""
Test Group 6: Authentication Security Tests
===========================================

Tests for authentication security properties:
- Unsigned/forged token rejection
- Expired token rejection
- Tampered payload detection
- Valid token acceptance
- Missing token handling
"""

import pytest
import time
import hashlib
import hmac
import base64
import json
from httpx import AsyncClient


# JWT Token Generation Functions
TEST_SESSION_SECRET = "test-secret-key-for-integration-tests-min-32-chars"
TOKEN_EXPIRY_SECONDS = 8 * 60 * 60


def base64url_encode(data: str) -> str:
    return base64.urlsafe_b64encode(data.encode()).rstrip(b'=').decode()


def base64url_decode(data: str) -> str:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data).decode()


def create_hmac_signature(data: str, secret: str) -> str:
    signature = hmac.new(secret.encode(), data.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(signature).rstrip(b'=').decode()


def create_test_jwt(user_id: str = "test-user-001", role: str = "clinician", 
                    expires_in_seconds: int = TOKEN_EXPIRY_SECONDS, issued_at: int = None) -> str:
    now = issued_at if issued_at is not None else int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64url_encode(json.dumps(header))
    payload = {"userId": user_id, "role": role, "iat": now, "exp": now + expires_in_seconds}
    encoded_payload = base64url_encode(json.dumps(payload))
    signature_input = f"{encoded_header}.{encoded_payload}"
    signature = create_hmac_signature(signature_input, TEST_SESSION_SECRET)
    return f"{encoded_header}.{encoded_payload}.{signature}"


def create_unsigned_jwt(user_id: str = "test-user-001", role: str = "clinician") -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64url_encode(json.dumps(header))
    payload = {"userId": user_id, "role": role, "iat": now, "exp": now + TOKEN_EXPIRY_SECONDS}
    encoded_payload = base64url_encode(json.dumps(payload))
    return f"{encoded_header}.{encoded_payload}.invalid_signature"


def create_expired_jwt(user_id: str = "test-user-001", role: str = "clinician") -> str:
    expired_time = int(time.time()) - 3600
    return create_test_jwt(user_id, role, expires_in_seconds=0, issued_at=expired_time - TOKEN_EXPIRY_SECONDS)


def create_tampered_jwt(original_token: str, new_role: str = "admin") -> str:
    parts = original_token.split('.')
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    payload = json.loads(base64url_decode(parts[1]))
    payload["role"] = new_role
    tampered_payload = base64url_encode(json.dumps(payload))
    return f"{parts[0]}.{tampered_payload}.{parts[2]}"


class TestTokenValidation:
    """Test JWT token validation security properties."""

    @pytest.mark.asyncio
    async def test_forged_unsigned_token_rejected(self, async_client: AsyncClient):
        """Test that tokens without valid HMAC signature are rejected."""
        forged_token = create_unsigned_jwt()
        headers = {"Authorization": f"Bearer {forged_token}", "Content-Type": "application/json"}
        response = await async_client.get("/api/v1/diagnose", headers=headers)
        
        assert response.status_code == 401, (
            f"Forged token should be rejected. Got status: {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self, async_client: AsyncClient):
        """Test that expired tokens are rejected."""
        expired_token = create_expired_jwt()
        headers = {"Authorization": f"Bearer {expired_token}", "Content-Type": "application/json"}
        response = await async_client.get("/api/v1/diagnose", headers=headers)
        
        assert response.status_code == 401, (
            f"Expired token should be rejected. Got status: {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_tampered_payload_rejected(self, async_client: AsyncClient):
        """Test that tampered payloads are detected and rejected."""
        valid_token = create_test_jwt(user_id="test-user", role="clinician")
        tampered_token = create_tampered_jwt(valid_token, new_role="admin")
        headers = {"Authorization": f"Bearer {tampered_token}", "Content-Type": "application/json"}
        response = await async_client.get("/api/v1/diagnose", headers=headers)
        
        assert response.status_code == 401, (
            f"Tampered token should be rejected. Got status: {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_valid_token_succeeds(self, async_client: AsyncClient):
        """Test that valid tokens are accepted."""
        valid_token = create_test_jwt(user_id="test-valid-user", role="clinician")
        headers = {"Authorization": f"Bearer {valid_token}", "Content-Type": "application/json"}
        response = await async_client.get("/health", headers=headers)
        
        assert response.status_code == 200, (
            f"Valid token should be accepted. Got status: {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_missing_token_rejected(self, async_client: AsyncClient):
        """Test that requests without Authorization header are rejected."""
        headers = {"Content-Type": "application/json"}
        response = await async_client.post("/api/v1/diagnose", json={"patient_symptoms": "test"}, headers=headers)
        
        assert response.status_code == 401, (
            f"Missing token should return 401, not {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_malformed_token_rejected(self, async_client: AsyncClient):
        """Test that malformed tokens are rejected."""
        malformed_tokens = ["not.a.valid.jwt", "tooshort", "header.payload", "a.b.c.d.e", ""]
        
        for malformed_token in malformed_tokens:
            headers = {"Authorization": f"Bearer {malformed_token}", "Content-Type": "application/json"}
            response = await async_client.get("/api/v1/diagnose", headers=headers)
            
            assert response.status_code == 401, (
                f"Malformed token '{malformed_token}' should be rejected."
            )
