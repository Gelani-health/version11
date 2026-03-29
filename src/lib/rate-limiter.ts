/**
 * Rate Limiting Middleware for Healthcare Platform
 * 
 * HIPAA-compliant rate limiting with:
 * - Configurable limits per endpoint type
 * - IP-based and user-based limiting
 * - Graceful degradation
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Configuration
// ============================================================================

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
}

// Default rate limits by endpoint type
export const RATE_LIMITS = {
  // AI endpoints are expensive - strict limits
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 AI requests per minute per user
  },
  // Clinical support - moderate limits
  clinical: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // RAG queries - moderate limits
  rag: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // Standard API - relaxed limits
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  // Authentication - strict limits for security
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 attempts per 15 minutes
  },
  // Public endpoints - IP-based limits
  public: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
} as const;

// ============================================================================
// In-Memory Store (Use Redis in Production)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

// Simple in-memory store
// In production, use Redis with distributed locking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

// ============================================================================
// Rate Limiting Functions
// ============================================================================

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    entry.blocked = true;
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  return `ip:${ip}`;
}

// ============================================================================
// Rate Limit Middleware
// ============================================================================

/**
 * Create rate limit middleware for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    type?: keyof typeof RATE_LIMITS;
    customConfig?: RateLimitConfig;
    identifier?: (request: NextRequest) => string;
  } = {}
) {
  const config = options.customConfig || RATE_LIMITS[options.type || 'standard'];

  return async (request: NextRequest): Promise<NextResponse> => {
    // Get identifier
    const identifier = options.identifier
      ? options.identifier(request)
      : getClientIdentifier(request);

    // Check rate limit
    const result = checkRateLimit(identifier, config);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
    };

    if (!result.allowed) {
      // Log rate limit exceeded
      console.warn(`[RateLimit] Blocked ${identifier}: ${request.method} ${request.url}`);

      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': String(result.retryAfter || 60),
          },
        }
      );
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Rate limit middleware for authenticated routes
 */
export function withAuthRateLimit(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
  options: {
    type?: keyof typeof RATE_LIMITS;
    customConfig?: RateLimitConfig;
  } = {}
) {
  const config = options.customConfig || RATE_LIMITS[options.type || 'standard'];

  return async (request: NextRequest, user: any): Promise<NextResponse> => {
    // Use user ID as identifier
    const identifier = `user:${user.id || user.employeeId}`;

    // Check rate limit
    const result = checkRateLimit(identifier, config);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
    };

    if (!result.allowed) {
      console.warn(`[RateLimit] Blocked ${identifier}: ${request.method} ${request.url}`);

      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': String(result.retryAfter || 60),
          },
        }
      );
    }

    // Execute handler
    const response = await handler(request, user);

    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// ============================================================================
// AI Endpoint Rate Limiting
// ============================================================================

/**
 * Special rate limiter for AI endpoints
 * Includes token-based limiting for expensive operations
 */
export function withAIRateLimit(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
  options: {
    tokensPerRequest?: number;
    maxTokensPerMinute?: number;
  } = {}
) {
  const config = RATE_LIMITS.ai;
  const tokensPerRequest = options.tokensPerRequest || 1;
  const maxTokensPerMinute = options.maxTokensPerMinute || config.maxRequests * 2;

  // Token tracking store
  const tokenStore = new Map<string, { tokens: number; resetTime: number }>();

  return async (request: NextRequest, user: any): Promise<NextResponse> => {
    const identifier = `ai:${user.id || user.employeeId}`;
    const now = Date.now();

    // Check request rate limit
    const requestResult = checkRateLimit(identifier, config);

    // Check token rate limit
    let tokenEntry = tokenStore.get(identifier);
    if (!tokenEntry || now > tokenEntry.resetTime) {
      tokenEntry = { tokens: 0, resetTime: now + config.windowMs };
      tokenStore.set(identifier, tokenEntry);
    }

    const tokensRemaining = maxTokensPerMinute - tokenEntry.tokens;

    if (!requestResult.allowed || tokenEntry.tokens + tokensPerRequest > maxTokensPerMinute) {
      console.warn(`[AIRateLimit] Blocked ${identifier}: Token budget exceeded`);

      return NextResponse.json(
        {
          success: false,
          error: 'AI request limit exceeded. Please try again later.',
          code: 'AI_RATE_LIMIT_EXCEEDED',
          retryAfter: requestResult.retryAfter || 60,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': String(requestResult.remaining),
            'X-AI-Tokens-Remaining': String(Math.max(0, tokensRemaining)),
            'Retry-After': String(requestResult.retryAfter || 60),
          },
        }
      );
    }

    // Consume tokens
    tokenEntry.tokens += tokensPerRequest;

    // Execute handler
    const response = await handler(request, user);

    // Add headers
    response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(requestResult.remaining));
    response.headers.set('X-AI-Tokens-Remaining', String(maxTokensPerMinute - tokenEntry.tokens));

    return response;
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { RateLimitConfig };
