/**
 * Audit Logs API
 * Query audit logs (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFilteredAuditLogs, formatActionType, formatResourceType, type AuditActionType, type AuditResourceType } from '@/lib/audit-service';
import { hasPermission, type UserRole } from '@/lib/rbac-middleware';

// GET /api/audit-logs - Query audit logs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get user role from header (in production, this would come from session)
    const userRole = searchParams.get('userRole') as UserRole || 'admin';
    
    // Check if user can view audit logs
    if (!hasPermission(userRole, 'audit_log:read')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to view audit logs' },
        { status: 403 }
      );
    }

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

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
