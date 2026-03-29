/**
 * Context Compression API
 * ========================
 * 
 * PROMPT Enhancement: Aggressive context compression and purging
 * 
 * Provides API endpoints for:
 * - Compressing conversation context
 * - Purging stale context
 * - Getting compression statistics
 * 
 * Authorization: Requires authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { logAuditEvent, calculateRetainUntil } from '@/lib/audit-service';
import {
  compressContext,
  compressContextAggressive,
  compressContextEssential,
  compressToSingleSummary,
  purgeStaleContext,
  needsCompression,
  estimateTokens,
  ContextMessage,
} from '@/lib/context-compression';
import {
  runAllPurgeOperations,
  getDatabaseStats,
  estimatePurgeSavings,
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
 * POST /api/context/compress - Compress context messages
 * 
 * Request body:
 * - messages: ContextMessage[] - Array of messages to compress
 * - mode: 'normal' | 'aggressive' | 'essential' | 'summary' (default: 'normal')
 * - maxTokens: number (optional, for checking if compression needed)
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const { messages, mode = 'normal', maxTokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Add tokenCount to messages if not present
    const processedMessages: ContextMessage[] = messages.map((msg, idx) => ({
      id: msg.id || `msg-${idx}`,
      role: msg.role || 'user',
      content: msg.content || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      tokenCount: msg.tokenCount || estimateTokens(msg.content || ''),
      importance: msg.importance,
      patientId: msg.patientId,
      hasClinicalData: msg.hasClinicalData,
    }));

    // Check if compression is needed
    const compressionNeeded = maxTokens 
      ? needsCompression(processedMessages, maxTokens)
      : true;

    let compressedMessages: ContextMessage[] | string;
    let tokensSaved = 0;

    switch (mode) {
      case 'aggressive':
        const aggressiveResult = compressContextAggressive(processedMessages);
        compressedMessages = aggressiveResult.compressedMessages;
        tokensSaved = aggressiveResult.tokensSaved;
        break;

      case 'essential':
        const essentialResult = compressContextEssential(processedMessages);
        compressedMessages = essentialResult.compressedMessages;
        tokensSaved = essentialResult.tokensSaved;
        break;

      case 'summary':
        compressedMessages = compressToSingleSummary(processedMessages);
        tokensSaved = processedMessages.reduce(
          (sum, msg) => sum + (msg.tokenCount || 0), 
          0
        ) - estimateTokens(compressedMessages);
        break;

      case 'normal':
      default:
        const normalResult = compressContext(processedMessages);
        compressedMessages = normalResult.compressedMessages;
        tokensSaved = normalResult.tokensSaved;
        break;
    }

    // Log the compression action
    await logAuditEvent({
      action: 'UPDATE',
      resourceType: 'Diagnostic',
      resourceId: 'context-compression',
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      metadata: {
        mode,
        originalMessages: messages.length,
        compressedMessages: typeof compressedMessages === 'string' ? 1 : compressedMessages.length,
        tokensSaved,
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json({
      success: true,
      data: {
        compressed: compressedMessages,
        stats: {
          originalCount: messages.length,
          compressedCount: typeof compressedMessages === 'string' ? 1 : compressedMessages.length,
          tokensSaved,
          compressionNeeded,
          mode,
        },
      },
    });

  } catch (error) {
    console.error('Context compression error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compress context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/context/compress - Get compression and purge statistics
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'stats';

  try {
    switch (action) {
      case 'db-stats':
        const dbStats = await getDatabaseStats();
        return NextResponse.json({
          success: true,
          data: {
            database: dbStats,
            timestamp: new Date().toISOString(),
          },
        });

      case 'estimates':
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
          },
        });

      case 'stats':
      default:
        return NextResponse.json({
          success: true,
          data: {
            compressionModes: {
              normal: {
                description: 'Standard compression with balanced retention',
                maxMessages: 20,
                targetRatio: 0.6,
              },
              aggressive: {
                description: 'Tighter limits for space-constrained scenarios',
                maxMessages: 10,
                targetRatio: 0.3,
              },
              essential: {
                description: 'Keep only critical patient information',
                maxMessages: 5,
                targetRatio: 0.15,
              },
              summary: {
                description: 'Compress all to single summary string',
                maxMessages: 1,
                targetRatio: 0.1,
              },
            },
            retentionPolicies: {
              aiInteractions: '90 days (non-patient)',
              ragQueries: '30 days',
              embeddingCache: '90 days',
              auditLogs: '7 years (HIPAA)',
              soapNotes: '7 years (HIPAA)',
            },
          },
        });
    }
  } catch (error) {
    console.error('Context stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/context/compress - Purge stale data
 */
export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = authResult.user!;

  // Only admins can trigger purge
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin role required for purge operations' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action = 'purge-all' } = body;

    // Log the purge action
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'Diagnostic',
      resourceId: `context-purge-${action}`,
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      retainUntil: calculateRetainUntil(),
    });

    if (action === 'purge-all') {
      const result = await runAllPurgeOperations();
      return NextResponse.json({
        success: true,
        message: 'Purge operations completed',
        data: result,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use: purge-all',
    }, { status: 400 });

  } catch (error) {
    console.error('Context purge error:', error);
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
