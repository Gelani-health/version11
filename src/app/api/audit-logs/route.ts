/**
 * Audit Logs API - HIPAA Compliant
 * 
 * Query audit logs (admin only)
 * Permission: audit_log:read
 * 
 * All access is logged for compliance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFilteredAuditLogs, formatActionType, formatResourceType, createAuditLog, type AuditActionType, type AuditResourceType } from '@/lib/audit-service';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * GET /api/audit-logs - Query audit logs
 * Permission: audit_log:read
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      actorId: searchParams.get('actorId') || undefined,
      actionType: searchParams.get('actionType') as AuditActionType || undefined,
      resourceType: searchParams.get('resourceType') as AuditResourceType || undefined,
      patientMrn: searchParams.get('patientMrn') || undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
    };

    const { logs, total } = await getFilteredAuditLogs(filters);

    // Format logs for display
    const formattedLogs = logs.map(log => ({
      ...log,
      actionTypeDisplay: formatActionType(log.actionType as AuditActionType),
      resourceTypeDisplay: formatResourceType(log.resourceType as AuditResourceType),
    }));

    // Log access to audit logs (meta-audit)
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'read',
      resourceType: 'audit_log',
    });

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['audit_log:read'] });
