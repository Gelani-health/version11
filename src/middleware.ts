/**
 * Next.js Middleware for Healthcare API Authentication
 * Intercepts all API requests and enforces authentication
 * 
 * HIPAA Compliance:
 * - All PHI endpoints require authentication
 * - Audit logging of all access attempts
 * - Rate limiting to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for middleware to access database
// This is required for database-backed authentication
export const runtime = 'nodejs';

// Dynamic import for database access (only loaded when needed)
let _db: typeof import('./lib/db').db | null = null;
async function getDb() {
  if (!_db) {
    const { db } = await import('./lib/db');
    _db = db;
  }
  return _db;
}

// Dynamic import for auth functions
let _auth: typeof import('./lib/auth-middleware') | null = null;
async function getAuth() {
  if (!_auth) {
    _auth = await import('./lib/auth-middleware');
  }
  return _auth;
}

// Routes that require specific permissions
const ROUTE_PERMISSIONS: Record<string, { method: string; permission: string }[]> = {
  '/api/patients': [
    { method: 'GET', permission: 'patient:read' },
    { method: 'POST', permission: 'patient:write' },
    { method: 'PUT', permission: 'patient:write' },
    { method: 'DELETE', permission: 'patient:delete' },
  ],
  '/api/soap-notes': [
    { method: 'GET', permission: 'soap_note:read' },
    { method: 'POST', permission: 'soap_note:write' },
    { method: 'PUT', permission: 'soap_note:write' },
  ],
  '/api/vitals': [
    { method: 'GET', permission: 'vitals:read' },
    { method: 'POST', permission: 'vitals:write' },
    { method: 'PUT', permission: 'vitals:write' },
  ],
  '/api/drug-interaction': [
    { method: 'GET', permission: 'prescription:read' },
    { method: 'POST', permission: 'prescription:read' },
  ],
  '/api/employees': [
    { method: 'GET', permission: 'employee:read' },
    { method: 'POST', permission: 'employee:write' },
  ],
  '/api/audit-logs': [
    { method: 'GET', permission: 'audit_log:read' },
  ],
  '/api/medical-diagnostic': [
    { method: 'POST', permission: 'ai:use' },
  ],
  '/api/clinical-support': [
    { method: 'POST', permission: 'ai:use' },
  ],
  '/api/asr': [
    { method: 'POST', permission: 'ai:use' },
  ],
  '/api/tts': [
    { method: 'POST', permission: 'ai:use' },
  ],
  '/api/image-analysis': [
    { method: 'POST', permission: 'ai:use' },
  ],
};

// Security headers for all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);
  
  // Apply security headers to all responses
  const response = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Skip authentication for non-API routes (static files, pages, etc.)
  if (!pathname.startsWith('/api')) {
    return response;
  }

  // Get auth module dynamically
  const auth = await getAuth();

  // Skip authentication for public endpoints (method-specific check)
  if (auth.isPublicEndpoint(pathname, request.method)) {
    return response;
  }

  // Skip authentication for OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 204,
      headers: {
        ...SECURITY_HEADERS,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      },
    });
  }

  // Authenticate the request
  const authResult = await auth.authenticateRequest(request);

  if (!authResult.authenticated) {
    // Log failed authentication attempt
    console.warn(`[AUTH FAILED] ${new Date().toISOString()} | ${request.method} ${pathname} | ${authResult.error}`);
    
    return NextResponse.json(
      {
        success: false,
        error: authResult.error || 'Authentication required',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      },
      { 
        status: authResult.statusCode || 401,
        headers: SECURITY_HEADERS,
      }
    );
  }

  const user = authResult.user!;

  // Check route-specific permissions
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS).find(route => 
    pathname.startsWith(route)
  );

  if (matchingRoute) {
    const permissions = ROUTE_PERMISSIONS[matchingRoute];
    const requiredPermission = permissions.find(p => p.method === request.method);
    
    if (requiredPermission && !user.permissions.includes(requiredPermission.permission as any)) {
      console.warn(`[AUTH FORBIDDEN] ${new Date().toISOString()} | User: ${user.employeeId} | ${request.method} ${pathname} | Required: ${requiredPermission.permission}`);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions for this operation',
          code: 'FORBIDDEN',
          requiredPermission: requiredPermission.permission,
          userRole: user.role,
          timestamp: new Date().toISOString(),
        },
        { 
          status: 403,
          headers: SECURITY_HEADERS,
        }
      );
    }
  }

  // Add user info to request headers for downstream handlers
  response.headers.set('x-user-id', user.id);
  response.headers.set('x-user-role', user.role);
  response.headers.set('x-user-email', user.email);

  // Log successful authentication
  console.log(`[AUTH OK] ${new Date().toISOString()} | User: ${user.employeeId} (${user.role}) | ${request.method} ${pathname}`);

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
