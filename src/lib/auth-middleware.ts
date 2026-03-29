/**
 * Authentication Middleware for Healthcare API
 * HIPAA-compliant authentication with API Key and Session support
 * 
 * Security Features:
 * - API Key authentication for service-to-service
 * - Session-based authentication with HMAC-SHA256 signed tokens
 * - Token expiry enforcement (8 hours)
 * - Token refresh within 24 hours of expiry
 * - Rate limiting per user/API key
 * - Audit logging of all authenticated requests
 * - Role-Based Access Control (RBAC) integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual, randomBytes, createHash } from 'crypto';
import { db } from './db';
import { hasPermission, Permission, UserRole } from './rbac-middleware';

// API Key header name
const API_KEY_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'authorization';

// Session cookie name
const SESSION_COOKIE = 'gelani-session';

// Token configuration
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours
const TOKEN_REFRESH_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours before expiry for refresh

// Rate limiting (in-memory for dev, should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window

// HMAC Secret - MUST be set in environment
let HMAC_SECRET: string;

/**
 * Initialize HMAC secret - throws if not configured
 * This should be called at application startup
 */
export function initializeAuth(): void {
  HMAC_SECRET = process.env.SESSION_SECRET || '';
  
  if (!HMAC_SECRET || HMAC_SECRET.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable must be set with at least 32 characters. ' +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  
  console.log('[Auth] HMAC secret initialized successfully');
}

// Initialize on module load - MUST throw if SESSION_SECRET is not set
// This is a startup guard that Next.js will surface as a fatal error
// PROMPT 1 FIX: Removed try/catch to ensure process crashes at boot if SESSION_SECRET is not configured
initializeAuth();

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  role: UserRole;
  email: string;
  name: string;
  permissions: Permission[];
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
  statusCode?: number;
}

interface TokenPayload {
  userId: string;
  role: string;
  iat: number; // Issued at (Unix timestamp in seconds)
  exp: number; // Expiry (Unix timestamp in seconds)
}

interface TokenHeader {
  alg: 'HS256';
  typ: 'JWT';
}

// =============================================================================
// HMAC-SHA256 Session Token Implementation
// =============================================================================

/**
 * Base64URL encode (JWT standard - no padding, URL-safe characters)
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Create HMAC-SHA256 signature
 */
function createSignature(data: string): string {
  return createHmac('sha256', HMAC_SECRET)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a secure session token with HMAC-SHA256 signature
 * 
 * Token format: base64url(header).base64url(payload).signature
 * 
 * @param userId - User's unique identifier
 * @param role - User's role (doctor, nurse, admin, etc.)
 * @returns Signed session token
 */
export function createSessionToken(userId: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  
  const header: TokenHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };
  
  const payload: TokenPayload = {
    userId,
    role,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Create signature over header.payload
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(signatureInput);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a session token's signature and expiry
 * 
 * @param token - The session token to verify
 * @returns Parsed payload if valid, null if invalid
 */
export function verifySessionToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  // Split token into parts
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  
  const [encodedHeader, encodedPayload, providedSignature] = parts;
  
  // Decode header
  let header: TokenHeader;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch {
    return null;
  }
  
  // Verify header algorithm
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    return null;
  }
  
  // Decode payload
  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
  
  // Verify payload has required fields
  if (!payload.userId || !payload.role || !payload.iat || !payload.exp) {
    return null;
  }
  
  // Recompute signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createSignature(signatureInput);
  
  // Timing-safe comparison to prevent timing attacks
  try {
    // Convert both signatures to buffers of equal length
    const providedBuffer = Buffer.from(providedSignature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    
    // Signatures must be same length for timing-safe comparison
    if (providedBuffer.length !== expectedBuffer.length) {
      return null;
    }
    
    // Use timing-safe comparison
    const isValid = timingSafeEqual(providedBuffer, expectedBuffer);
    if (!isValid) {
      return null;
    }
  } catch {
    return null;
  }
  
  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }
  
  // Check if token was issued in the future (clock skew protection)
  // Allow 60 seconds of clock skew
  if (payload.iat > now + 60) {
    return null;
  }
  
  return payload;
}

/**
 * Refresh a valid session token
 * 
 * Issues a new token if the provided token is:
 * 1. Valid signature
 * 2. Not yet expired OR within the refresh window (24 hours after expiry)
 * 
 * @param token - The current session token
 * @returns New session token if refreshable, null otherwise
 */
export function refreshToken(token: string): string | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  // Split token
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  
  const [encodedHeader, encodedPayload, providedSignature] = parts;
  
  // Decode payload
  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
  
  // Verify required fields
  if (!payload.userId || !payload.role || !payload.iat || !payload.exp) {
    return null;
  }
  
  // Verify signature (same as verifySessionToken)
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createSignature(signatureInput);
  
  try {
    const providedBuffer = Buffer.from(providedSignature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    
    if (providedBuffer.length !== expectedBuffer.length) {
      return null;
    }
    
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null;
    }
  } catch {
    return null;
  }
  
  // Check if within refresh window (24 hours after expiry)
  const now = Math.floor(Date.now() / 1000);
  const refreshDeadline = payload.exp + TOKEN_REFRESH_WINDOW_SECONDS;
  
  if (now > refreshDeadline) {
    return null;
  }
  
  // Token is refreshable - issue new token
  return createSessionToken(payload.userId, payload.role);
}

/**
 * Get remaining time until token expires (in seconds)
 * Returns 0 if token is invalid or expired
 */
export function getTokenTimeToExpiry(token: string): number {
  const payload = verifySessionToken(token);
  if (!payload) {
    return 0;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

// =============================================================================
// API Key Authentication
// =============================================================================

/**
 * Validate API Key from request headers.
 * 
 * PROMPT 1 FIX: Security hole fixed - employeeId is NO LONGER accepted as API key.
 * Only two valid authentication methods:
 * 1. GELANI_API_KEY master key from environment (for service-to-service auth)
 * 2. Hashed API key stored in Employee.apiKey field (for individual employee API access)
 * 
 * API keys are SHA-256 hashed before comparison to prevent timing attacks
 * and to match how they're stored in the database.
 */
async function validateApiKey(apiKey: string): Promise<AuthResult> {
  if (!apiKey || apiKey.length < 10) {
    return { authenticated: false, error: 'Invalid API key format', statusCode: 401 };
  }

  // Check master API key from environment (for service-to-service auth)
  const masterApiKey = process.env.GELANI_API_KEY;
  
  if (masterApiKey && apiKey === masterApiKey) {
    // Master API key has admin privileges
    return {
      authenticated: true,
      user: {
        id: 'system',
        employeeId: 'SYSTEM',
        role: 'admin',
        email: 'system@gelani-health.ai',
        name: 'System API',
        permissions: [
          'patient:read', 'patient:write', 'patient:delete',
          'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
          'vitals:read', 'vitals:write',
          'prescription:read', 'prescription:write', 'prescription:dispense',
          'clinical_order:read', 'clinical_order:write',
          'nurse_task:read', 'nurse_task:write',
          'audit_log:read', 'employee:read', 'employee:write', 'ai:use',
          // Lab permissions
          'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'lab:approve',
          // Imaging permissions
          'imaging:read', 'imaging:write', 'imaging:perform', 'imaging:interpret', 'imaging:approve',
        ],
      },
    };
  }

  // PROMPT 1 FIX: Check employee API keys using SHA-256 hash comparison
  // The employeeId field is NO LONGER used for authentication - this was a security hole
  // Only the dedicated apiKey field (SHA-256 hashed) is valid for employee API access
  try {
    // Hash the provided API key with SHA-256 for comparison
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');
    
    const employee = await db.employee.findFirst({
      where: { 
        isActive: true,
        apiKey: hashedKey,  // Only match against hashed apiKey field, NOT employeeId
      },
    });

    if (employee) {
      const role = employee.role as UserRole;
      return {
        authenticated: true,
        user: {
          id: employee.id,
          employeeId: employee.employeeId,
          role,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          permissions: getRolePermissions(role),
        },
      };
    }
  } catch (error) {
    console.error('Database error during API key validation:', error);
  }

  return { authenticated: false, error: 'Invalid API key', statusCode: 401 };
}

/**
 * Get permissions for a role (imported from rbac-middleware)
 */
function getRolePermissions(role: UserRole): Permission[] {
  const rolePermissions: Record<UserRole, Permission[]> = {
    doctor: ['patient:read', 'patient:write', 'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend', 'vitals:read', 'prescription:read', 'prescription:write', 'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write', 'ai:use', 'lab:read', 'lab:write', 'lab:verify', 'imaging:read', 'imaging:write'],
    nurse: ['patient:read', 'soap_note:read', 'vitals:read', 'vitals:write', 'prescription:read', 'clinical_order:read', 'nurse_task:read', 'nurse_task:write', 'lab:read', 'imaging:read'],
    admin: ['patient:read', 'patient:write', 'patient:delete', 'soap_note:read', 'soap_note:write', 'soap_note:sign', 'vitals:read', 'prescription:read', 'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write', 'audit_log:read', 'employee:read', 'employee:write', 'ai:use', 'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'lab:approve', 'imaging:read', 'imaging:write', 'imaging:perform', 'imaging:interpret', 'imaging:approve'],
    specialist: ['patient:read', 'patient:write', 'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend', 'vitals:read', 'prescription:read', 'prescription:write', 'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write', 'ai:use', 'lab:read', 'lab:write', 'lab:verify', 'imaging:read', 'imaging:write'],
    pharmacist: ['patient:read', 'prescription:read', 'prescription:dispense', 'clinical_order:read', 'lab:read'],
    receptionist: ['patient:read', 'patient:write', 'vitals:read', 'lab:read', 'imaging:read'],
    radiologist: ['patient:read', 'clinical_order:read', 'ai:use', 'imaging:read', 'imaging:write', 'imaging:interpret', 'imaging:approve', 'lab:read'],
    lab_worker: ['patient:read', 'clinical_order:read', 'ai:use', 'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'imaging:read'],
  };
  return rolePermissions[role] || [];
}

// =============================================================================
// Session Validation
// =============================================================================

/**
 * Validate session from cookies
 */
async function validateSession(sessionToken: string): Promise<AuthResult> {
  if (!sessionToken) {
    return { authenticated: false, error: 'No session token', statusCode: 401 };
  }

  // Verify the token signature and expiry
  const payload = verifySessionToken(sessionToken);
  
  if (!payload) {
    return { authenticated: false, error: 'Invalid or expired session', statusCode: 401 };
  }

  try {
    // Get employee from database
    const employee = await db.employee.findFirst({
      where: { 
        id: payload.userId,
        isActive: true,
      },
    });

    if (!employee) {
      return { authenticated: false, error: 'User not found or inactive', statusCode: 401 };
    }

    const role = employee.role as UserRole;
    return {
      authenticated: true,
      user: {
        id: employee.id,
        employeeId: employee.employeeId,
        role,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`,
        permissions: getRolePermissions(role),
      },
    };
  } catch (error) {
    console.error('Database error during session validation:', error);
    return { authenticated: false, error: 'Session validation failed', statusCode: 500 };
  }
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Check rate limit for a user/key
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// =============================================================================
// Main Authentication Functions
// =============================================================================

/**
 * Main authentication function
 * Checks API key first, then session cookie
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Check for API key in headers
  const apiKey = request.headers.get(API_KEY_HEADER) || 
                 request.headers.get(AUTHORIZATION_HEADER)?.replace('Bearer ', '');

  if (apiKey) {
    const result = await validateApiKey(apiKey);
    if (result.authenticated && result.user) {
      // Check rate limit
      if (!checkRateLimit(result.user.id)) {
        return { authenticated: false, error: 'Rate limit exceeded', statusCode: 429 };
      }
      return result;
    }
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionCookie) {
    const result = await validateSession(sessionCookie);
    if (result.authenticated && result.user) {
      if (!checkRateLimit(result.user.id)) {
        return { authenticated: false, error: 'Rate limit exceeded', statusCode: 429 };
      }
      return result;
    }
  }

  return { authenticated: false, error: 'Authentication required', statusCode: 401 };
}

/**
 * Check if user has required permission
 */
export function checkPermission(user: AuthenticatedUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user has any of the required permissions
 */
export function checkAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.some(p => user.permissions.includes(p));
}

/**
 * Higher-order function to wrap API handlers with authentication
 * Supports both regular routes and dynamic routes with params
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser, context?: any) => Promise<NextResponse>,
  options?: {
    requiredPermissions?: Permission[];
    requireAnyPermission?: Permission[];
  }
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user!;

    // Check required permissions
    if (options?.requiredPermissions) {
      const hasAll = options.requiredPermissions.every(p => checkPermission(user, p));
      if (!hasAll) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            required: options.requiredPermissions,
          },
          { status: 403 }
        );
      }
    }

    // Check any permission
    if (options?.requireAnyPermission) {
      const hasAny = checkAnyPermission(user, options.requireAnyPermission);
      if (!hasAny) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            requiredAny: options.requireAnyPermission,
          },
          { status: 403 }
        );
      }
    }

    // Log the authenticated request for audit
    await logAuthenticatedRequest(request, user);

    return handler(request, user, context);
  };
}

/**
 * Log authenticated request for HIPAA audit trail.
 * 
 * PROMPT 1 FIX: Uncommented and completed for HIPAA compliance.
 * PHI-touching requests MUST be logged - this was a HIPAA violation.
 * 
 * Logs to database with:
 * - userId, employeeId: Who performed the action
 * - action: HTTP method (GET, POST, PUT, DELETE)
 * - resource: Pathname only (not full URL which may contain PHI in query params)
 * - ipAddress, userAgent: For security tracking
 * - timestamp: When the action occurred
 * 
 * Fire-and-forget pattern with error logging to avoid blocking the request.
 */
async function logAuthenticatedRequest(request: NextRequest, user: AuthenticatedUser): Promise<void> {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | ${request.method} ${request.nextUrl.pathname}`);
    }

    // PROMPT 1 FIX: HIPAA-compliant audit logging to database
    // Use pathname only, not full URL (query params may contain PHI)
    const pathname = request.nextUrl.pathname;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
                      || request.headers.get('x-real-ip') 
                      || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Fire-and-forget to database - must not block request or silently discard errors
    db.auditLog.create({
      data: {
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionType: request.method,
        resourceType: 'API',
        resourceId: pathname,
        ipAddress,
        userAgent,
        outcome: 'SUCCESS',
        timestamp: new Date(),
      }
    }).catch(err => console.error('[AUDIT FAIL]', err));
  } catch (error) {
    console.error('Failed to log audit trail:', error);
  }
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  return 'gelani_' + randomBytes(32).toString('hex');
}

/**
 * PROMPT 1 FIX: Hash an API key for storage.
 * 
 * API keys are stored as SHA-256 hashes to prevent exposure in case of database breach.
 * This matches the comparison logic in validateApiKey().
 * 
 * @param apiKey - The plain-text API key to hash
 * @returns SHA-256 hash as hex string (64 characters)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Public endpoints that don't require authentication
 * Can be a string (all methods public) or object with specific methods
 */
export const PUBLIC_ENDPOINTS: Array<string | { path: string; methods: string[] }> = [
  '/api/health',
  '/api/ai-status',
  // RAG config GET is public for health indicator (POST/PUT/DELETE require admin auth)
  { path: '/api/rag-config', methods: ['GET'] },
  // LLM integrations GET is public for status checks
  { path: '/api/llm-integrations', methods: ['GET'] },
  // Settings GET is public for UI to read current configuration
  { path: '/api/settings', methods: ['GET'] },
  // Permissions GET is public for client-side permission checks
  { path: '/api/auth/permissions', methods: ['GET'] },
];

/**
 * Check if endpoint is public for a specific HTTP method
 */
export function isPublicEndpoint(pathname: string, method: string = 'GET'): boolean {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    if (typeof endpoint === 'string') {
      // String endpoint - all methods are public
      if (pathname.startsWith(endpoint)) {
        return true;
      }
    } else {
      // Object endpoint - only specific methods are public
      if (pathname.startsWith(endpoint.path) && endpoint.methods.includes(method.toUpperCase())) {
        return true;
      }
    }
  }
  return false;
}
