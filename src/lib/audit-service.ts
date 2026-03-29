/**
 * PROMPT 11: Unified Audit Trail Service
 * 
 * HIPAA-compliant audit logging with:
 * - Strict TypeScript types for compile-time enforcement
 * - withAudit() higher-order function for automatic audit capture
 * - Retention policy support (7 years per HIPAA)
 * - Centralized audit event logging across all PHI-touching routes
 * 
 * Evidence Sources:
 * - HIPAA Privacy Rule 45 CFR § 164.312(b) - Audit controls
 * - HIPAA Security Rule - 7-year retention requirement
 * - HITRUST CSF - Audit logging requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { authenticateRequest, AuthenticatedUser, checkPermission } from './auth-middleware';
import { Permission } from './rbac-middleware';

// =============================================================================
// Strict TypeScript Types for Audit Events
// =============================================================================

/**
 * PROMPT 11: Strict AuditEvent type with compile-time enforcement
 * All fields are mandatory except where noted
 */
export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'AI_QUERY' | 'SIGN' | 'AMEND';

export type AuditResourceType = 
  | 'Patient' 
  | 'SoapNote' 
  | 'Diagnostic' 
  | 'User' 
  | 'AuditLog'
  | 'Vitals'
  | 'Prescription'
  | 'ClinicalOrder'
  | 'NurseTask'
  | 'Employee'
  | 'LabResult'
  | 'Imaging'
  | 'FHIR';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

/**
 * Complete audit event structure
 * This is the canonical type used throughout the application
 */
export interface AuditEvent {
  /** Action being performed */
  action: AuditAction;
  /** Type of resource being accessed */
  resourceType: AuditResourceType;
  /** ID of the specific resource (if applicable) */
  resourceId: string;
  /** User performing the action */
  userId: string;
  /** Optional: Patient ID if PHI is involved */
  patientId?: string;
  /** IP address of the request */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
  /** Outcome of the action */
  outcome: AuditOutcome;
  /** Additional metadata (JSON) */
  metadata?: Record<string, unknown>;
  /** Retention date - set to now + 7 years per HIPAA */
  retainUntil: Date;
}

/**
 * Configuration for withAudit wrapper
 */
export interface AuditConfig {
  /** Resource type being accessed */
  resourceType: AuditResourceType;
  /** Action being performed */
  action: AuditAction;
  /** Function to extract resource ID from request */
  getResourceId?: (request: NextRequest, context?: unknown) => string | Promise<string>;
  /** Function to extract patient ID from request */
  getPatientId?: (request: NextRequest, context?: unknown) => string | Promise<string | undefined>;
  /** Additional metadata to include */
  metadata?: Record<string, unknown> | ((request: NextRequest, context?: unknown) => Record<string, unknown>);
}

/**
 * Legacy audit log input (for backward compatibility)
 */
export type AuditActionType = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'sign' 
  | 'amend' 
  | 'export'
  | 'login'
  | 'logout' 
  | 'access'
  | 'ai_query';

export type LegacyAuditResourceType = 
  | 'patient' 
  | 'soap_note' 
  | 'vitals' 
  | 'prescription' 
  | 'clinical_order'
  | 'employee'
  | 'nurse_task' 
  | 'audit_log'
  | 'diagnostic';

export interface AuditLogInput {
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment?: string;
  actionType: AuditActionType;
  resourceType: LegacyAuditResourceType;
  resourceId?: string;
  patientMrn?: string;
  patientId?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Constants
// =============================================================================

/** HIPAA requires 7 years retention */
const RETENTION_YEARS = 7;

/**
 * Calculate retention date (now + 7 years)
 * Exported for use in route handlers
 */
export function calculateRetainUntil(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + RETENTION_YEARS);
  return date;
}

// =============================================================================
// Core Audit Logging Functions
// =============================================================================

/**
 * PROMPT 11: Log an audit event with strict typing
 * This is the primary function for logging audit events
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    // Get user info for logging
    const employee = await db.employee.findUnique({
      where: { employeeId: event.userId },
      select: { firstName: true, lastName: true, role: true, department: true },
    });

    await db.auditLog.create({
      data: {
        actorId: event.userId,
        actorName: employee ? `${employee.firstName} ${employee.lastName}` : event.userId,
        actorRole: employee?.role || 'unknown',
        actorDepartment: employee?.department,
        actionType: mapActionToLegacy(event.action),
        resourceType: mapResourceToLegacy(event.resourceType),
        resourceId: event.resourceId,
        patientId: event.patientId,
        patientMrn: event.patientId ? await getPatientMrn(event.patientId) : null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        outcome: event.outcome,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        retainUntil: event.retainUntil,
      },
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[AUDIT] ${new Date().toISOString()} | ${event.action} | ${event.resourceType}:${event.resourceId} | User: ${event.userId} | Outcome: ${event.outcome}`
      );
    }
  } catch (error) {
    console.error('[AUDIT] Failed to log audit event:', error);
    // Don't throw - audit logs should not break the main flow
    // But in production, this should trigger an alert
  }
}

/**
 * PROMPT 11: Higher-order function that wraps Next.js route handlers
 * Automatically captures and logs audit events
 * 
 * @param handler - The Next.js route handler function
 * @param config - Audit configuration
 * @returns Wrapped handler with automatic audit logging
 */
export function withAudit(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: unknown
  ) => Promise<NextResponse>,
  config: AuditConfig
): (request: NextRequest, context?: unknown) => Promise<NextResponse> {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const startTime = Date.now();
    let outcome: AuditOutcome = 'SUCCESS';
    let resourceId = 'unknown';
    let patientId: string | undefined;
    let user: AuthenticatedUser | null = null;

    // Extract IP address and user agent
    const ipAddress = extractIpAddress(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      // Authenticate the request
      const authResult = await authenticateRequest(request);

      if (!authResult.authenticated || !authResult.user) {
        // Log denied access attempt
        await logAuditEvent({
          action: config.action,
          resourceType: config.resourceType,
          resourceId: 'access-denied',
          userId: 'anonymous',
          ipAddress,
          userAgent,
          outcome: 'DENIED',
          metadata: {
            reason: authResult.error,
            endpoint: request.url,
          },
          retainUntil: calculateRetainUntil(),
        });

        return NextResponse.json(
          {
            success: false,
            error: authResult.error || 'Authentication required',
            code: 'UNAUTHORIZED',
          },
          { status: authResult.statusCode || 401 }
        );
      }

      user = authResult.user;

      // Extract resource ID if configured
      if (config.getResourceId) {
        try {
          resourceId = await config.getResourceId(request, context);
        } catch (e) {
          resourceId = 'extraction-failed';
        }
      }

      // Extract patient ID if configured
      if (config.getPatientId) {
        try {
          patientId = await config.getPatientId(request, context);
        } catch (e) {
          // Patient ID extraction is optional
        }
      }

      // Execute the handler
      const response = await handler(request, user, context);

      // Determine outcome based on response status
      if (response.status >= 400) {
        outcome = 'FAILURE';
      }

      // Log successful/failed action
      const metadata: Record<string, unknown> = {
        method: request.method,
        endpoint: new URL(request.url).pathname,
        statusCode: response.status,
        durationMs: Date.now() - startTime,
      };

      if (typeof config.metadata === 'function') {
        Object.assign(metadata, config.metadata(request, context));
      } else if (config.metadata) {
        Object.assign(metadata, config.metadata);
      }

      await logAuditEvent({
        action: config.action,
        resourceType: config.resourceType,
        resourceId,
        userId: user.employeeId,
        patientId,
        ipAddress,
        userAgent,
        outcome,
        metadata,
        retainUntil: calculateRetainUntil(),
      });

      return response;
    } catch (error) {
      outcome = 'FAILURE';

      // Log the error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await logAuditEvent({
        action: config.action,
        resourceType: config.resourceType,
        resourceId,
        userId: user?.employeeId || 'unknown',
        patientId,
        ipAddress,
        userAgent,
        outcome,
        metadata: {
          error: errorMessage,
          endpoint: request.url,
          method: request.method,
        },
        retainUntil: calculateRetainUntil(),
      });

      // Re-throw the error to be handled by Next.js
      throw error;
    }
  };
}

/**
 * PROMPT 11: withAuditAndAuth - Combined authentication and audit wrapper
 * Wraps authentication, permission checking, and audit logging in one function
 */
export function withAuditAndAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: unknown
  ) => Promise<NextResponse>,
  config: AuditConfig & {
    requiredPermission?: Permission;
    requiredPermissions?: Permission[];
  }
): (request: NextRequest, context?: unknown) => Promise<NextResponse> {
  return withAudit(
    async (request: NextRequest, user: AuthenticatedUser, context?: unknown) => {
      // Check permissions if required
      if (config.requiredPermission && !checkPermission(user, config.requiredPermission)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            required: config.requiredPermission,
          },
          { status: 403 }
        );
      }

      if (config.requiredPermissions) {
        const hasAll = config.requiredPermissions.every((p) => checkPermission(user, p));
        if (!hasAll) {
          return NextResponse.json(
            {
              success: false,
              error: 'Insufficient permissions',
              code: 'FORBIDDEN',
              required: config.requiredPermissions,
            },
            { status: 403 }
          );
        }
      }

      return handler(request, user, context);
    },
    config
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract IP address from request
 * Handles proxies and load balancers
 */
function extractIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first (client)
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to socket address if available (not in Edge Runtime)
  return 'unknown';
}

/**
 * Get patient MRN from patient ID
 */
async function getPatientMrn(patientId: string): Promise<string | null> {
  try {
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { mrn: true },
    });
    return patient?.mrn || null;
  } catch {
    return null;
  }
}

/**
 * Map new AuditAction to legacy action type
 */
function mapActionToLegacy(action: AuditAction): string {
  const mapping: Record<AuditAction, string> = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    EXPORT: 'export',
    AI_QUERY: 'ai_query',
    SIGN: 'sign',
    AMEND: 'amend',
  };
  return mapping[action] || action.toLowerCase();
}

/**
 * Map new AuditResourceType to legacy resource type
 */
function mapResourceToLegacy(resourceType: AuditResourceType): string {
  const mapping: Record<AuditResourceType, string> = {
    Patient: 'patient',
    SoapNote: 'soap_note',
    Diagnostic: 'diagnostic',
    User: 'employee',
    AuditLog: 'audit_log',
    Vitals: 'vitals',
    Prescription: 'prescription',
    ClinicalOrder: 'clinical_order',
    NurseTask: 'nurse_task',
    Employee: 'employee',
    LabResult: 'lab_result',
    Imaging: 'imaging',
    FHIR: 'fhir',
  };
  return mapping[resourceType] || resourceType.toLowerCase();
}

// =============================================================================
// Legacy Functions (Backward Compatibility)
// =============================================================================

/**
 * Create an immutable audit log entry (legacy function)
 * Maintained for backward compatibility with existing code
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        actorDepartment: input.actorDepartment,
        actionType: input.actionType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientId: input.patientId,
        patientMrn: input.patientMrn,
        fieldChanged: input.fieldChanged,
        oldValue: input.oldValue,
        newValue: input.newValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: input.outcome || 'SUCCESS',
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        retainUntil: calculateRetainUntil(),
      },
    });
  } catch (error) {
    console.error('[AUDIT] Failed to create audit log:', error);
    // Don't throw - audit logs should not break the main flow
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: LegacyAuditResourceType,
  resourceId: string
): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs for a patient (by MRN or ID)
 */
export async function getPatientAuditLogs(mrn: string): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      OR: [
        { patientMrn: mrn },
        { patientId: mrn },
      ],
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs for an employee
 */
export async function getEmployeeAuditLogs(employeeId: string): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      actorId: employeeId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs with filters (for admin endpoint)
 */
export interface AuditLogFilters {
  actorId?: string;
  actionType?: AuditActionType | AuditAction;
  resourceType?: LegacyAuditResourceType | AuditResourceType;
  patientMrn?: string;
  patientId?: string;
  outcome?: AuditOutcome;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function getFilteredAuditLogs(filters: AuditLogFilters): Promise<{
  logs: AuditLogData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = filters.page || 1;
  const pageSize = Math.min(filters.pageSize || 50, 100); // Max 100 per page
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.actionType) where.actionType = filters.actionType;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.patientMrn) where.patientMrn = filters.patientMrn;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.outcome) where.outcome = filters.outcome;

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) (where.timestamp as Record<string, Date>).gte = filters.startDate;
    if (filters.endDate) (where.timestamp as Record<string, Date>).lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Format action type for display
 */
export function formatActionType(actionType: AuditActionType | AuditAction): string {
  const actionMap: Record<string, string> = {
    CREATE: 'Created',
    READ: 'Viewed',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    SIGN: 'Signed',
    AMEND: 'Amended',
    EXPORT: 'Exported',
    LOGIN: 'Logged In',
    LOGOUT: 'Logged Out',
    AI_QUERY: 'AI Query',
    create: 'Created',
    read: 'Viewed',
    update: 'Updated',
    delete: 'Deleted',
    sign: 'Signed',
    amend: 'Amended',
    export: 'Exported',
    login: 'Logged In',
    logout: 'Logged Out',
    access: 'Accessed',
    ai_query: 'AI Query',
  };
  return actionMap[actionType] || actionType;
}

/**
 * Format resource type for display
 */
export function formatResourceType(resourceType: LegacyAuditResourceType | AuditResourceType): string {
  const resourceMap: Record<string, string> = {
    Patient: 'Patient Record',
    SoapNote: 'SOAP Note',
    Diagnostic: 'Diagnostic Report',
    User: 'User Record',
    AuditLog: 'Audit Log',
    Vitals: 'Vital Signs',
    Prescription: 'Prescription',
    ClinicalOrder: 'Clinical Order',
    NurseTask: 'Nurse Task',
    Employee: 'Employee Record',
    LabResult: 'Lab Result',
    Imaging: 'Imaging',
    FHIR: 'FHIR Resource',
    patient: 'Patient Record',
    soap_note: 'SOAP Note',
    vitals: 'Vital Signs',
    prescription: 'Prescription',
    clinical_order: 'Clinical Order',
    employee: 'Employee Record',
    nurse_task: 'Nurse Task',
    audit_log: 'Audit Log',
    diagnostic: 'Diagnostic Report',
    fhir: 'FHIR Resource',
  };
  return resourceMap[resourceType] || resourceType;
}

// Type for audit log data from database
export interface AuditLogData {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment: string | null;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  patientMrn: string | null;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  outcome: string | null;
  metadata: string | null;
  retainUntil: Date | null;
  timestamp: Date;
}

// =============================================================================
// Resource ID Extractors
// =============================================================================

/**
 * Common resource ID extractors for use with withAudit
 */
export const ResourceIdExtractors = {
  /** Extract from URL path parameter (e.g., /api/patients/[id]) */
  fromPath: (paramName: string) => {
    return (request: NextRequest, context?: unknown): string => {
      if (context && typeof context === 'object' && 'params' in context) {
        const params = (context as { params: Record<string, string> }).params;
        return params[paramName] || 'unknown';
      }
      // Try to extract from URL
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const paramIndex = segments.indexOf(paramName);
      if (paramIndex !== -1 && segments[paramIndex + 1]) {
        return segments[paramIndex + 1];
      }
      return 'unknown';
    };
  },

  /** Extract from query parameter */
  fromQuery: (paramName: string) => {
    return (request: NextRequest): string => {
      const url = new URL(request.url);
      return url.searchParams.get(paramName) || 'unknown';
    };
  },

  /** Extract from request body */
  fromBody: (fieldName: string) => {
    return async (request: NextRequest): Promise<string> => {
      try {
        const body = await request.clone().json();
        return body[fieldName] || 'unknown';
      } catch {
        return 'unknown';
      }
    };
  },
};

/**
 * Patient ID extractors
 */
export const PatientIdExtractors = {
  /** Extract patient ID from query parameter */
  fromQuery: () => {
    return (request: NextRequest): string | undefined => {
      const url = new URL(request.url);
      return url.searchParams.get('patientId') || undefined;
    };
  },

  /** Extract patient ID from request body */
  fromBody: () => {
    return async (request: NextRequest): Promise<string | undefined> => {
      try {
        const body = await request.clone().json();
        return body.patientId || undefined;
      } catch {
        return undefined;
      }
    };
  },

  /** Extract patient ID from path */
  fromPath: () => {
    return (request: NextRequest, context?: unknown): string | undefined => {
      if (context && typeof context === 'object' && 'params' in context) {
        const params = (context as { params: Record<string, string> }).params;
        return params.patientId || params.id || undefined;
      }
      return undefined;
    };
  },
};
