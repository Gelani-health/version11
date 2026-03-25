/**
 * SOAP Note Addendum API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - POST: soap_note:amend
 * - GET: soap_note:read
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { authenticateRequest, AuthenticatedUser, checkPermission } from '@/lib/auth-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/soap-notes/[id]/addendum - Add addendum
 * Permission: soap_note:amend
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'soap_note:amend')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:amend required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { addendumText, reason } = body;

    // Validate required fields
    if (!addendumText) {
      return NextResponse.json(
        { success: false, error: 'Addendum text is required' },
        { status: 400 }
      );
    }

    // Get existing SOAP note
    const existingNote = await db.soapNote.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
    });

    if (!existingNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Addendum can only be added to signed notes
    if (existingNote.status !== 'signed') {
      return NextResponse.json(
        { success: false, error: 'Addendum can only be added to signed SOAP notes' },
        { status: 400 }
      );
    }

    // Create addendum with authenticated user
    const addendum = await db.soapAddendum.create({
      data: {
        soapNoteId: id,
        addendumText,
        reason,
        authoredBy: user.employeeId,
      },
    });

    // Update SOAP note status to amended
    await db.soapNote.update({
      where: { id },
      data: {
        status: 'amended',
        lockVersion: { increment: 1 },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'amend',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
      fieldChanged: 'addendum',
      newValue: addendumText,
    });

    // Log PHI access
    await logPHIAccess(user, 'AMEND', 'soap_note', id, { addendumId: addendum.id });

    return NextResponse.json({
      success: true,
      data: addendum,
      message: 'Addendum added successfully',
      meta: {
        authoredBy: user.employeeId,
        authoredAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding addendum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add addendum' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/soap-notes/[id]/addendum - Get addenda for a SOAP note
 * Permission: soap_note:read
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'soap_note:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:read required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const addenda = await db.soapAddendum.findMany({
      where: { soapNoteId: id },
      include: {
        author: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
          },
        },
      },
      orderBy: { authoredAt: 'desc' },
    });

    // Log PHI access
    await logPHIAccess(user, 'READ', 'soap_note_addenda', id, { count: addenda.length });

    return NextResponse.json({
      success: true,
      data: addenda,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching addenda:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch addenda' },
      { status: 500 }
    );
  }
}

/**
 * Log PHI access for HIPAA compliance
 */
async function logPHIAccess(
  user: AuthenticatedUser,
  action: string,
  resource: string,
  resourceId: string | number,
  details?: any
): Promise<void> {
  try {
    await db.aIInteraction.create({
      data: {
        interactionType: 'phi_access',
        prompt: `${action} ${resource}`,
        response: JSON.stringify({
          resourceId,
          details,
          userRole: user.role,
        }),
        humanReviewed: false,
        modelUsed: 'audit-system',
        patientId: typeof resourceId === 'string' ? resourceId : null,
      },
    });

    console.log(`[PHI AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: ${action} | Resource: ${resource}:${resourceId}`);
  } catch (error) {
    console.error('Failed to log PHI access:', error);
  }
}
