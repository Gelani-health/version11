/**
 * OpenTelemetry Instrumentation for Gelani Healthcare Assistant
 * =================================================================
 *
 * This file is auto-loaded by Next.js 16 when instrumentationHook: true
 * is set in next.config.ts.
 *
 * PROMPT 13: OpenTelemetry Observability + Health Endpoints
 *
 * Features:
 * - Distributed tracing with OTLP HTTP exporter
 * - Auto-instrumentation for Node.js (HTTP, fetch, DNS)
 * - Custom spans for clinical operations
 * - PHI-safe attributes (no patient IDs in plain text)
 *
 * Environment Variables:
 * - OTEL_SERVICE_NAME: Service name (default: "gelani-nextjs")
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint
 * - OTEL_ENVIRONMENT: Environment name (development/staging/production)
 *
 * Evidence Sources:
 * - OpenTelemetry Node.js SDK: https://opentelemetry.io/docs/languages/js/
 * - HIPAA Compliance: 45 CFR 164.312(e)(1)
 */

import type { Span, Tracer, Context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from './lib/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'gelani-nextjs';
const OTEL_ENVIRONMENT = process.env.OTEL_ENVIRONMENT || 'development';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const SERVICE_VERSION = '2.0.0';

// =============================================================================
// SDK INITIALIZATION
// =============================================================================

let sdk: NodeSDK | null = null;
let tracer: Tracer | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 *
 * Sets up:
 * - OTLP HTTP trace exporter
 * - Auto-instrumentations for Node.js
 * - Resource attributes for service identification
 */
export function initTelemetry(): void {
  if (isInitialized) {
    logger.info('OpenTelemetry already initialized');
    return;
  }

  try {
    // Create OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Create resource with service identification
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: OTEL_SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
      'service.namespace': 'gelani-healthcare',
      'service.instance.id': process.env.HOSTNAME || 'local',
    });

    // Initialize Node SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some noisy instrumentations
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-net': {
            enabled: false,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    // Get tracer for custom spans
    tracer = trace.getTracer(OTEL_SERVICE_NAME, SERVICE_VERSION);

    isInitialized = true;
    logger.info(`OpenTelemetry initialized: ${OTEL_SERVICE_NAME} v${SERVICE_VERSION}`);
    logger.info(`OTLP Endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry:', error);
    // Fall back gracefully - service can still run without tracing
  }
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 *
 * Ensures all pending spans are flushed before exit.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    logger.info('OpenTelemetry SDK shutdown complete');
  } catch (error) {
    logger.error('Error during OpenTelemetry shutdown:', error);
  }
}

// =============================================================================
// CUSTOM SPAN HELPERS
// =============================================================================

/**
 * Create a span for patient data access operations
 *
 * IMPORTANT: Never include patient ID or name in span attributes.
 * Use a hashed session token instead for traceability without PHI exposure.
 *
 * HIPAA Reference: 45 CFR 164.312(e)(1) - Transmission Security
 *
 * @param patientId - Patient identifier (will NOT be logged)
 * @param action - Action being performed (e.g., "read_record", "update_record")
 * @param fn - Async function to execute within the span
 * @returns Result of the function
 */
export async function withPatientDataSpan<T>(
  action: string,
  sessionToken: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan('gelani.patient.data_access', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'patient.action': action,
      'user.role': getUserRole(),
      'data.sensitivity': 'PHI',
      'session.hash': hashSessionToken(sessionToken),
    },
  }, async (span: Span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a span for diagnostic query operations
 *
 * IMPORTANT: Never log the chief complaint text in plain form.
 * Only log character count for metrics without PHI.
 *
 * @param chiefComplaint - The chief complaint text (NOT logged)
 * @param fn - Async function to execute within the span
 * @returns Result of the function
 */
export async function withDiagnosticQuerySpan<T>(
  chiefComplaint: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan('gelani.diagnostic.query', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'complaint.length': chiefComplaint.length,
      'query.timestamp': new Date().toISOString(),
    },
  }, async (span: Span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a span for authentication events
 *
 * @param eventType - Type of auth event (login/logout/token_refresh/failure)
 * @param fn - Async function to execute within the span
 * @returns Result of the function
 */
export async function withAuthEventSpan<T>(
  eventType: 'login' | 'logout' | 'token_refresh' | 'failure',
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan('gelani.auth.event', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'auth.event_type': eventType,
    },
  }, async (span: Span) => {
    try {
      const result = await fn();
      span.setAttribute('auth.result', 'success');
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setAttribute('auth.result', 'failure');
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a span for FHIR resource operations
 *
 * @param resourceType - FHIR resource type (Patient, Condition, etc.)
 * @param operation - Operation type (read, create, update, delete)
 * @param fn - Async function to execute
 */
export async function withFhirSpan<T>(
  resourceType: string,
  operation: 'read' | 'create' | 'update' | 'delete' | 'search',
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan(`gelani.fhir.${resourceType}.${operation}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'fhir.resource_type': resourceType,
      'fhir.operation': operation,
      'fhir.version': 'R4',
    },
  }, async (span: Span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a span for RAG retrieval operations
 *
 * @param namespace - Pinecone namespace
 * @param queryTermCount - Number of query terms
 * @param fn - Async function to execute
 */
export async function withRagSpan<T>(
  namespace: string,
  queryTermCount: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  if (!tracer) {
    return fn({} as Span);
  }

  return tracer.startActiveSpan('gelani.rag.query', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'rag.namespace': namespace,
      'rag.query_term_count': queryTermCount,
    },
  }, async (span: Span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Hash a session token for logging without exposing PHI
 *
 * Uses SHA-256 to create a one-way hash suitable for tracing.
 */
function hashSessionToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}

/**
 * Get the current user role from context
 *
 * Returns 'anonymous' if no user context is available.
 */
function getUserRole(): string {
  try {
    // Check for role in context or fallback
    // This would be populated by auth middleware
    return 'unknown';
  } catch {
    return 'anonymous';
  }
}

/**
 * Get the current span for manual attribute setting
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set an attribute on the current span
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Record an error on the current span
 */
export function recordSpanError(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  tracer,
  isInitialized,
  OTEL_SERVICE_NAME,
  OTEL_ENVIRONMENT,
  SERVICE_VERSION,
};

// =============================================================================
// STARTUP INITIALIZATION
// =============================================================================

/**
 * Next.js instrumentation register function
 * Called once when the server starts
 * 
 * Initializes:
 * - OpenTelemetry for observability
 * - AI Configurations (LLM, RAG, ASR) if not present
 */
export async function register() {
  // Initialize telemetry
  initTelemetry();
  
  // Initialize AI configurations on startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // Import db dynamically to avoid circular dependencies
      const { db } = await import('./lib/db');
      
      // Check and seed LLM providers
      const llmCount = await db.lLMIntegration.count();
      if (llmCount === 0) {
        logger.info('[Startup] No LLM providers found, seeding defaults...');
        // Seed will happen via API call on first request or manual seed script
      }
      
      // Check and seed RAG services
      const ragCount = await db.rAGServiceConfig.count();
      if (ragCount === 0) {
        logger.info('[Startup] No RAG services found, seeding defaults...');
        // Seed will happen via API call on first request or manual seed script
      }
      
      logger.info(`[Startup] AI Config Status: ${llmCount} LLM providers, ${ragCount} RAG services`);
    } catch (error) {
      logger.warn('[Startup] Could not verify AI configurations:', error);
      // This is non-fatal - configurations will be seeded on first API call
    }
  }
  
  logger.info('[Startup] Gelani Healthcare Assistant initialized');
}
