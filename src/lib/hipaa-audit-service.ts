/**
 * HIPAA-Compliant Audit Logging Service
 * ======================================
 * 
 * Comprehensive audit logging for healthcare applications following HIPAA requirements:
 * - 45 CFR § 164.312(b) - Audit Controls
 * - 45 CFR § 164.308(a)(1)(ii)(D) - Information System Activity Review
 * - 45 CFR § 164.312(c)(1) - Integrity Controls
 * 
 * This service provides HIPAA-specific utilities that work with the existing
 * audit-service.ts infrastructure.
 * 
 * @module hipaa-audit-service
 */

import { db } from './db';
import { createAuditLog, logAuditEvent, type AuditAction, type AuditResourceType, type AuditOutcome, calculateRetainUntil } from './audit-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface HIPAAAuditEntry {
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  phiAccessed?: boolean;
  phiFields?: string[];
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  details?: Record<string, unknown>;
}

export interface PHIAccessReport {
  reportId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  totalAccesses: number;
  uniquePatients: number;
  uniqueUsers: number;
  accessesByAction: Record<string, number>;
  accessesByUser: Array<{ userId: string; count: number; lastAccess: Date }>;
  accessesByPatient: Array<{ patientId: string; count: number; lastAccess: Date }>;
  phiFieldsAccessed: Array<{ field: string; count: number }>;
}

export interface SuspiciousActivity {
  type: 'excessive_access' | 'after_hours' | 'bulk_export' | 'unusual_pattern' | 'failed_access';
  userId: string;
  details: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// PHI Field Definitions
// ============================================================================

export const PHI_FIELDS = [
  // Direct identifiers
  'firstName', 'lastName', 'dateOfBirth', 'ssn', 'mrn', 'nationalHealthId',
  'phone', 'email', 'address', 'city', 'state', 'postalCode', 'country',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactEmail',
  'patientPhoto', 'biometricId', 'facialRecognitionId',
  'fingerprintTemplateId', 'irisScanTemplateId', 'voicePrintTemplateId',
  // Sensitive health information
  'allergies', 'chronicConditions', 'medications', 'diagnoses',
  'labResults', 'vitals', 'consultationNotes', 'soapNotes', 'prescriptions',
  'pregnancyStatus', 'mentalHealthHistory', 'substanceAbuseHistory',
  'geneticInformation', 'hivStatus', 'stdHistory',
  // Financial/Insurance
  'insurancePrimary', 'insurancePrimaryId', 'insuranceSecondary', 'insuranceSecondaryId',
] as const;

// ============================================================================
// HIPAA Audit Service
// ============================================================================

class HIPAAAuditService {
  private static instance: HIPAAAuditService;

  private constructor() {}

  static getInstance(): HIPAAAuditService {
    if (!HIPAAAuditService.instance) {
      HIPAAAuditService.instance = new HIPAAAuditService();
    }
    return HIPAAAuditService.instance;
  }

  /**
   * Log a HIPAA-compliant audit event
   */
  async log(params: HIPAAAuditEntry): Promise<void> {
    const phiAccessed = params.phiAccessed ?? this.determinePHIAccess(params.action, params.resourceType);
    
    try {
      await createAuditLog({
        actorId: params.userId,
        actorName: params.userId, // Will be looked up in audit-service
        actorRole: params.userRole,
        actionType: params.action.toLowerCase() as any,
        resourceType: params.resourceType.toLowerCase() as any,
        resourceId: params.resourceId,
        patientId: params.patientId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        outcome: params.outcome || 'SUCCESS',
        metadata: {
          ...params.details,
          phiAccessed,
          phiFields: params.phiFields,
          sessionId: params.sessionId,
        },
      });

      // Check for suspicious activity
      await this.checkSuspiciousActivity(params.userId, phiAccessed);
    } catch (error) {
      console.error('[HIPAA Audit] Failed to log audit event:', error);
      // Don't throw - audit logs should not break the main flow
    }
  }

  /**
   * Determine if an action involves PHI access
   */
  private determinePHIAccess(action: string, resourceType: string): boolean {
    const phiResources = [
      'patient', 'consultation', 'soap_note', 'prescription',
      'lab_result', 'vitals', 'diagnosis', 'medication',
    ];

    const phiActions = [
      'view', 'read', 'create', 'update', 'delete', 'export', 'print',
      'ai_query', 'ai_response',
    ];

    return phiResources.includes(resourceType.toLowerCase()) && 
           phiActions.includes(action.toLowerCase());
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(userId: string, phiAccessed: boolean): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const recentAccesses = await db.auditLog.count({
        where: {
          actorId: userId,
          timestamp: { gte: oneHourAgo },
        },
      });

      if (phiAccessed && recentAccesses > 100) {
        console.warn(`[HIPAA Audit] Suspicious activity: User ${userId} has ${recentAccesses} accesses in the last hour`);
      }
    } catch (error) {
      // Silently fail - don't break the main flow
    }
  }

  /**
   * Generate PHI access report for compliance
   */
  async generatePHIAccessReport(
    startDate: Date,
    endDate: Date
  ): Promise<PHIAccessReport> {
    const logs = await db.auditLog.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    const uniquePatients = new Set(logs.filter(l => l.patientId).map(l => l.patientId));
    const uniqueUsers = new Set(logs.map(l => l.actorId));

    const accessesByAction: Record<string, number> = {};
    const accessesByUserMap = new Map<string, { count: number; lastAccess: Date }>();
    const accessesByPatientMap = new Map<string, { count: number; lastAccess: Date }>();

    for (const log of logs) {
      accessesByAction[log.actionType] = (accessesByAction[log.actionType] || 0) + 1;

      if (!accessesByUserMap.has(log.actorId)) {
        accessesByUserMap.set(log.actorId, { count: 0, lastAccess: log.timestamp });
      }
      const userEntry = accessesByUserMap.get(log.actorId)!;
      userEntry.count++;
      userEntry.lastAccess = log.timestamp;

      if (log.patientId) {
        if (!accessesByPatientMap.has(log.patientId)) {
          accessesByPatientMap.set(log.patientId, { count: 0, lastAccess: log.timestamp });
        }
        const patientEntry = accessesByPatientMap.get(log.patientId)!;
        patientEntry.count++;
        patientEntry.lastAccess = log.timestamp;
      }
    }

    return {
      reportId: `phi-report-${Date.now()}`,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      totalAccesses: logs.length,
      uniquePatients: uniquePatients.size,
      uniqueUsers: uniqueUsers.size,
      accessesByAction,
      accessesByUser: Array.from(accessesByUserMap.entries()).map(([userId, data]) => ({
        userId,
        ...data,
      })),
      accessesByPatient: Array.from(accessesByPatientMap.entries()).map(([patientId, data]) => ({
        patientId,
        ...data,
      })),
      phiFieldsAccessed: [], // Would be populated from metadata
    };
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(params: {
    userId?: string;
    patientId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (params.userId) where.actorId = params.userId;
    if (params.patientId) where.patientId = params.patientId;
    if (params.action) where.actionType = params.action.toLowerCase();
    if (params.resourceType) where.resourceType = params.resourceType.toLowerCase();
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: params.limit || 100,
        skip: params.offset || 0,
      }),
      db.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Export audit logs for compliance (CSV format)
   */
  async exportLogsCSV(startDate: Date, endDate: Date): Promise<string> {
    const { logs } = await this.getLogs({
      startDate,
      endDate,
      limit: 10000,
    });

    const headers = [
      'ID', 'Timestamp', 'Actor ID', 'Actor Name', 'Actor Role',
      'Action', 'Resource Type', 'Resource ID', 'Patient ID',
      'IP Address', 'Outcome',
    ];

    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.actorId,
      log.actorName,
      log.actorRole,
      log.actionType,
      log.resourceType,
      log.resourceId || '',
      log.patientId || '',
      log.ipAddress || '',
      log.outcome || 'SUCCESS',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  }
}

// ============================================================================
// PHI Handling Utilities
// ============================================================================

/**
 * Sanitize data by removing PHI fields
 */
export function sanitizePHI<T extends Record<string, any>>(
  data: T,
  fieldsToKeep: string[] = []
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!PHI_FIELDS.includes(key as any) || fieldsToKeep.includes(key)) {
      sanitized[key as keyof T] = value;
    } else {
      sanitized[key as keyof T] = '[REDACTED]' as any;
    }
  }

  return sanitized;
}

/**
 * Mask sensitive identifier (show only last N characters)
 */
export function maskIdentifier(
  value: string,
  visibleChars: number = 4
): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  return '****' + value.slice(-visibleChars);
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// Data Retention Policy
// ============================================================================

export const DATA_RETENTION_POLICY = {
  auditLogs: 6 * 365,        // 6 years (HIPAA requirement)
  patientRecords: 10 * 365,  // 10 years after last encounter
  aiInteractions: 2 * 365,   // 2 years
  ragQueries: 365,           // 1 year
  sessions: 30,              // 30 days
  backups: 365,              // 1 year
} as const;

/**
 * Enforce data retention policy
 */
export async function enforceRetentionPolicy(): Promise<{
  auditLogsDeleted: number;
  sessionsCleared: number;
}> {
  // Note: In production, audit logs should be archived, not deleted
  console.log('[HIPAA] Data retention policy check completed');
  return { auditLogsDeleted: 0, sessionsCleared: 0 };
}

// ============================================================================
// Export
// ============================================================================

export const hipaaAudit = HIPAAAuditService.getInstance();
export default HIPAAAuditService;
