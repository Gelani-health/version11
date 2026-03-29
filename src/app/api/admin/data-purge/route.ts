/**
 * Data Purge API - Admin Endpoint
 * ================================
 * 
 * PROMPT 12+: Admin API for data lifecycle management
 * 
 * Allows administrators to:
 * - View database statistics
 * - Estimate purge savings
 * - Trigger purge operations
 * - Configure retention policies
 * 
 * Authorization: ADMIN role required
 * 
 * All operations are logged for compliance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, checkPermission } from '@/lib/auth-middleware';
import { logAuditEvent, calculateRetainUntil } from '@/lib/audit-service';
import {
  runAllPurgeOperations,
  getDatabaseStats,
  estimatePurgeSavings,
  purgeAiInteractions,
  purgeRagQueries,
  purgeEmbeddingCache,
  purgeDraftVoiceNotes,
  compressOldSoapNoteVersions,
  DEFAULT_RETENTION_POLICIES,
} from '@/lib/data-purge';

/**
 * Extract IP address from request
 */
function extractIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

/**
 * GET /api/admin/data-purge - Get database statistics and estimates
 * 
 * Query parameters:
 * - action: 'stats' | 'estimates' | 'policies'
 */
export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = authResult.user!;

  // Permission check - only ADMIN role
  if (user.role !== 'admin') {
    await logAuditEvent({
      action: 'READ',
      resourceType: 'AuditLog',
      resourceId: 'data-purge-denied',
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: 'Insufficient permissions - ADMIN role required' },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: 'Forbidden: ADMIN role required' },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'stats';

  try {
    switch (action) {
      case 'stats':
        // Get current database statistics
        const stats = await getDatabaseStats();
        
        await logAuditEvent({
          action: 'READ',
          resourceType: 'AuditLog',
          resourceId: 'data-purge-stats',
          userId: user.employeeId,
          ipAddress: extractIpAddress(request),
          userAgent: request.headers.get('user-agent') || 'unknown',
          outcome: 'SUCCESS',
          metadata: { action: 'stats' },
          retainUntil: calculateRetainUntil(),
        });

        return NextResponse.json({
          success: true,
          data: {
            stats,
            timestamp: new Date().toISOString(),
            retentionPolicies: DEFAULT_RETENTION_POLICIES,
          },
        });

      case 'estimates':
        // Get purge savings estimates
        const estimates = await estimatePurgeSavings();
        const totalRecords = estimates.reduce((sum, e) => sum + e.estimatedRecords, 0);
        const totalKB = estimates.reduce((sum, e) => sum + e.estimatedSizeKB, 0);

        return NextResponse.json({
          success: true,
          data: {
            estimates,
            totals: {
              records: totalRecords,
              sizeKB: totalKB,
              sizeMB: (totalKB / 1024).toFixed(2),
            },
            timestamp: new Date().toISOString(),
          },
        });

      case 'policies':
        // Return current retention policies
        return NextResponse.json({
          success: true,
          data: DEFAULT_RETENTION_POLICIES,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: stats, estimates, or policies' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Data purge API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data-purge - Execute purge operations
 * 
 * Request body:
 * - action: 'purge-all' | 'purge-ai' | 'purge-rag' | 'purge-cache' | 'compress-versions'
 * - dryRun: boolean (optional, default false)
 */
export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = authResult.user!;

  // Permission check - only ADMIN role
  if (!checkPermission(user, 'employee:write') && user.role !== 'admin') {
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'AuditLog',
      resourceId: 'data-purge-denied',
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: 'Insufficient permissions - ADMIN role required' },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: 'Forbidden: ADMIN role required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const action = body.action || 'purge-all';
    const dryRun = body.dryRun === true;

    // Log the purge request
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'AuditLog',
      resourceId: `data-purge-${action}`,
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      metadata: {
        action,
        dryRun,
        timestamp: new Date().toISOString(),
      },
      retainUntil: calculateRetainUntil(),
    });

    if (dryRun) {
      // Return estimates only
      const estimates = await estimatePurgeSavings();
      return NextResponse.json({
        success: true,
        message: 'Dry run completed - no data was purged',
        data: {
          estimates,
          action,
        },
      });
    }

    // Execute purge operations
    let result;

    switch (action) {
      case 'purge-all':
        result = await runAllPurgeOperations();
        break;

      case 'purge-ai':
        result = await purgeAiInteractions();
        break;

      case 'purge-rag':
        result = await purgeRagQueries();
        break;

      case 'purge-cache':
        result = await purgeEmbeddingCache();
        break;

      case 'purge-voice':
        result = await purgeDraftVoiceNotes();
        break;

      case 'compress-versions':
        result = await compressOldSoapNoteVersions();
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Use: purge-all, purge-ai, purge-rag, purge-cache, purge-voice, or compress-versions',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Purge operation completed',
      data: result,
      performedBy: user.employeeId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data purge execution error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Purge operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
