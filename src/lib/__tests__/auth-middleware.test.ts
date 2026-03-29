/**
 * Tests for HMAC-SHA256 JWT Authentication
 * 
 * Run with: npx tsx src/lib/__tests__/auth-middleware.test.ts
 */

import {
  createSessionToken,
  verifySessionToken,
  refreshToken,
  getTokenTimeToExpiry,
  initializeAuth,
} from '../auth-middleware';

// Mock time for testing
let mockTime: number | null = null;
const originalDateNow = Date.now;

function mockDateNow(time: number) {
  mockTime = time;
  Date.now = () => mockTime!;
}

function restoreDateNow() {
  mockTime = null;
  Date.now = originalDateNow;
}

// Base64URL encode helper
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// =============================================================================
// Test Suite
// =============================================================================

async function runTests() {
  console.log('='.repeat(60));
  console.log('JWT Authentication Test Suite');
  console.log('='.repeat(60));
  
  // Set a test secret
  process.env.SESSION_SECRET = 'test-secret-key-must-be-at-least-32-characters-long-for-security';
  
  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------------------
  // Test 1: Initialization with valid secret
  // -------------------------------------------------------------------------
  console.log('\nTest 1: Initialization with valid secret');
  try {
    initializeAuth();
    console.log('  ✅ PASS: Auth initialized successfully');
    passed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Test 2: Initialization fails with short secret
  // -------------------------------------------------------------------------
  console.log('\nTest 2: Initialization fails with short secret');
  const originalSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'too-short';
  try {
    initializeAuth();
    console.log('  ❌ FAIL: Should have thrown error for short secret');
    failed++;
  } catch (error) {
    console.log('  ✅ PASS: Correctly threw error for short secret');
    passed++;
  }
  process.env.SESSION_SECRET = originalSecret;
  initializeAuth();

  // -------------------------------------------------------------------------
  // Test 3: Create valid token
  // -------------------------------------------------------------------------
  console.log('\nTest 3: Create valid session token');
  const testStartTime = Math.floor(Date.now() / 1000);
  const token = createSessionToken('user-123', 'doctor');
  
  if (!token) {
    console.log('  ❌ FAIL: Token is null or empty');
    failed++;
  } else {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log(`  ❌ FAIL: Token should have 3 parts, got ${parts.length}`);
      failed++;
    } else {
      // Decode and verify payload
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      
      if (payload.userId !== 'user-123') {
        console.log(`  ❌ FAIL: userId should be 'user-123', got '${payload.userId}'`);
        failed++;
      } else if (payload.role !== 'doctor') {
        console.log(`  ❌ FAIL: role should be 'doctor', got '${payload.role}'`);
        failed++;
      } else if (!payload.iat) {
        console.log('  ❌ FAIL: Missing iat (issued at)');
        failed++;
      } else if (!payload.exp) {
        console.log('  ❌ FAIL: Missing exp (expiry)');
        failed++;
      } else if (payload.exp !== payload.iat + 8 * 60 * 60) {
        console.log(`  ❌ FAIL: Expiry should be 8 hours from iat`);
        failed++;
      } else {
        console.log('  ✅ PASS: Valid token created with correct structure');
        passed++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Test 4: Verify valid token returns payload
  // -------------------------------------------------------------------------
  console.log('\nTest 4: Verify valid token returns payload');
  const validPayload = verifySessionToken(token);
  
  if (!validPayload) {
    console.log('  ❌ FAIL: Valid token should return payload');
    failed++;
  } else if (validPayload.userId !== 'user-123') {
    console.log(`  ❌ FAIL: userId mismatch`);
    failed++;
  } else if (validPayload.role !== 'doctor') {
    console.log(`  ❌ FAIL: role mismatch`);
    failed++;
  } else {
    console.log('  ✅ PASS: Valid token verified correctly');
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 5: Forged token (no signature) returns null
  // -------------------------------------------------------------------------
  console.log('\nTest 5: Forged token (no signature) returns null');
  
  // Create a forged token by base64-encoding JSON without signing
  const forgedPayload = {
    userId: 'admin',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: 9999999999, // Far future
  };
  
  const forgedHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const forgedPayloadEncoded = base64UrlEncode(JSON.stringify(forgedPayload));
  const forgedToken = `${forgedHeader}.${forgedPayloadEncoded}.fakesignature`;
  
  const forgedResult = verifySessionToken(forgedToken);
  
  if (forgedResult !== null) {
    console.log('  ❌ FAIL: Forged token should return null');
    console.log(`     Got: ${JSON.stringify(forgedResult)}`);
    failed++;
  } else {
    console.log('  ✅ PASS: Forged token correctly rejected');
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 6: Expired token returns null
  // -------------------------------------------------------------------------
  console.log('\nTest 6: Expired token returns null');
  
  // Create a token
  const expToken = createSessionToken('user-exp', 'nurse');
  
  // Mock time to be 9 hours in the future (past 8 hour expiry)
  const now = Date.now();
  mockDateNow(now + 9 * 60 * 60 * 1000);
  
  const expiredResult = verifySessionToken(expToken);
  
  if (expiredResult !== null) {
    console.log('  ❌ FAIL: Expired token should return null');
    failed++;
  } else {
    console.log('  ✅ PASS: Expired token correctly rejected');
    passed++;
  }
  
  restoreDateNow();

  // -------------------------------------------------------------------------
  // Test 7: Token with tampered payload returns null
  // -------------------------------------------------------------------------
  console.log('\nTest 7: Tampered payload returns null');
  
  const tamperToken = createSessionToken('user-tamper', 'nurse');
  const tamperParts = tamperToken.split('.');
  
  // Decode payload, modify role, re-encode
  const tamperedPayloadData = JSON.parse(
    Buffer.from(tamperParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
  );
  tamperedPayloadData.role = 'admin'; // Try to escalate privileges
  
  const tamperedPayloadEncoded = base64UrlEncode(JSON.stringify(tamperedPayloadData));
  const tamperedToken = `${tamperParts[0]}.${tamperedPayloadEncoded}.${tamperParts[2]}`;
  
  const tamperedResult = verifySessionToken(tamperedToken);
  
  if (tamperedResult !== null) {
    console.log('  ❌ FAIL: Tampered token should return null');
    failed++;
  } else {
    console.log('  ✅ PASS: Tampered token correctly rejected');
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 8: Token with invalid format returns null
  // -------------------------------------------------------------------------
  console.log('\nTest 8: Invalid format returns null');
  
  const invalidFormats = [
    '', // Empty
    'not.enough.parts', // Only 2 parts
    'too.many.parts.here.four', // 4 parts
    'just-a-string', // No dots
    '...', // Just dots
    'header.payload', // Missing signature
  ];
  
  let allInvalidRejected = true;
  for (const invalid of invalidFormats) {
    if (verifySessionToken(invalid) !== null) {
      console.log(`  ❌ FAIL: Invalid format '${invalid}' should return null`);
      allInvalidRejected = false;
      failed++;
    }
  }
  
  if (allInvalidRejected) {
    console.log('  ✅ PASS: All invalid formats correctly rejected');
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 9: Refresh token within window
  // -------------------------------------------------------------------------
  console.log('\nTest 9: Refresh valid token within window');
  
  const refreshableToken = createSessionToken('user-refresh', 'doctor');
  const newToken = refreshToken(refreshableToken);
  
  if (!newToken) {
    console.log('  ❌ FAIL: Should be able to refresh valid token');
    failed++;
  } else {
    const newPayload = verifySessionToken(newToken);
    if (!newPayload) {
      console.log('  ❌ FAIL: Refreshed token should be valid');
      failed++;
    } else if (newPayload.userId !== 'user-refresh') {
      console.log('  ❌ FAIL: Refreshed token should have same userId');
      failed++;
    } else {
      console.log('  ✅ PASS: Token refreshed successfully');
      passed++;
    }
  }

  // -------------------------------------------------------------------------
  // Test 10: Cannot refresh token outside window (> 24h after expiry)
  // -------------------------------------------------------------------------
  console.log('\nTest 10: Cannot refresh token outside 24h window');
  
  const oldToken = createSessionToken('user-old', 'doctor');
  
  // Mock time to be 33 hours in the future (8h expiry + 24h refresh + 1h)
  const currentTime = Date.now();
  mockDateNow(currentTime + 33 * 60 * 60 * 1000);
  
  const staleRefresh = refreshToken(oldToken);
  
  if (staleRefresh !== null) {
    console.log('  ❌ FAIL: Should not refresh token outside 24h window');
    failed++;
  } else {
    console.log('  ✅ PASS: Token outside refresh window correctly rejected');
    passed++;
  }
  
  restoreDateNow();

  // -------------------------------------------------------------------------
  // Test 11: Get token time to expiry
  // -------------------------------------------------------------------------
  console.log('\nTest 11: Get token time to expiry');
  
  const expiryToken = createSessionToken('user-expiry', 'doctor');
  const timeToExpiry = getTokenTimeToExpiry(expiryToken);
  
  // Should be close to 8 hours (28800 seconds)
  if (timeToExpiry <= 0) {
    console.log(`  ❌ FAIL: Time to expiry should be positive, got ${timeToExpiry}`);
    failed++;
  } else if (timeToExpiry > 8 * 60 * 60) {
    console.log(`  ❌ FAIL: Time to expiry should not exceed 8 hours, got ${timeToExpiry}`);
    failed++;
  } else {
    console.log(`  ✅ PASS: Time to expiry is ${timeToExpiry} seconds (within 8 hours)`);
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 12: Get token time to expiry for invalid token
  // -------------------------------------------------------------------------
  console.log('\nTest 12: Get token time to expiry for invalid token');
  
  const invalidExpiry = getTokenTimeToExpiry('invalid.token.here');
  
  if (invalidExpiry !== 0) {
    console.log(`  ❌ FAIL: Invalid token should return 0, got ${invalidExpiry}`);
    failed++;
  } else {
    console.log('  ✅ PASS: Invalid token correctly returns 0');
    passed++;
  }

  // -------------------------------------------------------------------------
  // Test 13: Token issued in future is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 13: Token issued in future is rejected');
  
  // Create token at current time
  const futureToken = createSessionToken('user-future', 'doctor');
  
  // Mock time to be in the past (before token was issued)
  mockDateNow(Date.now() - 120 * 1000); // 2 minutes in past
  
  const futureResult = verifySessionToken(futureToken);
  
  if (futureResult !== null) {
    console.log('  ❌ FAIL: Token with future iat should be rejected');
    failed++;
  } else {
    console.log('  ✅ PASS: Token with future iat correctly rejected');
    passed++;
  }
  
  restoreDateNow();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
