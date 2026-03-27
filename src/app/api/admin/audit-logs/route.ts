/**
 * PROMPT 11: Admin Audit Logs API - HIPAA Compliant
 * 
 * Query audit logs with filtering and pagination.
 * 
 * Security:
 * - Requires ADMIN role access
 * - All queries are logged for accountability
 * - Maximum 100 records per page to prevent data exfiltration
 * 
 * Evidence Sources:
 * - HIPAA Privacy Rule 45 CFR § 164.312(b) - Audit controls
 * - HITRUST CSF - Audit log access control requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, checkPermission } from '@/lib/auth-middleware';
import {
  getFilteredAuditLogs,
  formatActionType,
  formatResourceType,
  type AuditLogData,
} from '@/lib/audit-service';

/**
 * GET /api/admin/audit-logs - Query audit logs
 * Permission: audit_log:read (admin only)
 * 
 * Query Parameters:
 * - userId: Filter by user ID (employeeId)
 * - patientId: Filter by patient ID
 * - patientMrn: Filter by patient MRN
 * - action: Filter by action type (READ, CREATE, UPDATE, DELETE, etc.)
 * - resourceType: Filter by resource type (Patient, SoapNote, etc.)
 * - outcome: Filter by outcome (SUCCESS, FAILURE, DENIED)
 * - startDate: Filter from date (ISO 8601)
 * - endDate: Filter to date (ISO 8601)
 * - page: Page number (default: 1)
 * - pageSize: Records per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      // Log denied access attempt
      await logDeniedAccess(request, 'Unauthorized');
      
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check for audit_log:read permission (admin only)
    if (!checkPermission(user, 'audit_log:read')) {
      // Log denied access attempt
      await logDeniedAccess(request, 'Insufficient permissions', user.employeeId);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions: audit_log:read required',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;
    const patientId = searchParams.get('patientId') || undefined;
    const patientMrn = searchParams.get('patientMrn') || undefined;
    const action = searchParams.get('action') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const outcome = searchParams.get('outcome') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    // Parse dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid startDate format. Use ISO 8601.' },
          { status: 400 }
        );
      }
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid endDate format. Use ISO 8601.' },
          { status: 400 }
        );
      }
    }

    // Query audit logs
    const result = await getFilteredAuditLogs({
      actorId: userId,
      patientId,
      patientMrn,
      actionType: action as any,
      resourceType: resourceType as any,
      outcome: outcome as any,
      startDate,
      endDate,
      page,
      pageSize,
    });

    // Format the logs for display
    const formattedLogs = result.logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      actor: {
        id: log.actorId,
        name: log.actorName,
        role: log.actorRole,
        department: log.actorDepartment,
      },
      action: {
        type: log.actionType,
        formatted: formatActionType(log.actionType),
      },
      resource: {
        type: log.resourceType,
        formatted: formatResourceType(log.resourceType),
        id: log.resourceId,
      },
      patient: {
        id: log.patientId,
        mrn: log.patientMrn,
      },
      outcome: log.outcome || 'SUCCESS',
      change: log.fieldChanged
        ? {
            field: log.fieldChanged,
            oldValue: log.oldValue,
            newValue: log.newValue,
          }
        : undefined,
      network: {
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
      },
      metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      retainUntil: log.retainUntil,
    }));

    // Log this access for accountability
    await logAuditAccess(user.employeeId, {
      filters: { userId, patientId, patientMrn, action, resourceType, outcome, startDate, endDate },
      resultCount: result.logs.length,
      page,
    });

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
        filters: {
          userId,
          patientId,
          patientMrn,
          action,
          resourceType,
          outcome,
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('[AUDIT API] Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

/**
 * Log denied access attempt
 */
async function logDeniedAccess(
  request: NextRequest,
  reason: string,
  userId?: string
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: userId || 'anonymous',
        actorName: userId ? 'Unknown' : 'Anonymous',
        actorRole: 'unknown',
        actionType: 'READ',
        resourceType: 'AuditLog',
        resourceId: 'access-denied',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   request.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        outcome: 'DENIED',
        metadata: JSON.stringify({
          reason,
          endpoint: request.url,
          method: request.method,
        }),
        retainUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
      },
    });
  } catch (error) {
    console.error('[AUDIT API] Failed to log denied access:', error);
  }
}

/**
 * Log audit log access for accountability
 */
async function logAuditAccess(
  userId: string,
  details: {
    filters: Record<string, unknown>;
    resultCount: number;
    page: number;
  }
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: userId,
        actorName: 'Admin User',
        actorRole: 'admin',
        actionType: 'READ',
        resourceType: 'AuditLog',
        resourceId: 'query',
        outcome: 'SUCCESS',
        metadata: JSON.stringify(details),
        retainUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
      },
    });
  } catch (error) {
    console.error('[AUDIT API] Failed to log audit access:', error);
  }
}
