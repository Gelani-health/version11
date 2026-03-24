/**
 * Single SOAP Note API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: soap_note:read
 * - PUT: soap_note:write
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
 * GET /api/soap-notes/[id] - Get single SOAP note
 * Permission: soap_note:read
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 }
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

    const soapNote = await db.soapNote.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            dateOfBirth: true,
            gender: true,
            bloodType: true,
            allergies: true,
          },
        },
        author: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
            specialty: true,
          },
        },
        editor: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        signer: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        vitals: true,
        addenda: {
          include: {
            author: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: { authoredAt: 'desc' },
        },
        orders: true,
        prescriptions: true,
        nurseTasks: {
          include: {
            assigner: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            assignee: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!soapNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Log PHI access
    await logPHIAccess(user, 'READ', 'soap_note', id, { patientId: soapNote.patientId });

    return NextResponse.json({
      success: true,
      data: soapNote,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOAP note' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/soap-notes/[id] - Update SOAP note
 * Permission: soap_note:write
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'soap_note:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

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

    // Check if note is signed
    if (existingNote.status === 'signed') {
      return NextResponse.json(
        { success: false, error: 'Cannot modify signed SOAP note. Use addendum instead.' },
        { status: 400 }
      );
    }

    const { lastEditedBy, ...updateData } = body;

    // Update SOAP note with authenticated user as editor
    const updatedNote = await db.soapNote.update({
      where: { id },
      data: {
        ...updateData,
        lastEditedBy: user.employeeId,
        lockVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'update',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'UPDATE', 'soap_note', id, { 
      updatedFields: Object.keys(updateData) 
    });

    return NextResponse.json({
      success: true,
      data: updatedNote,
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SOAP note' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/soap-notes/[id] - Delete SOAP note (only drafts)
 * Permission: soap_note:write
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'soap_note:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const soapNote = await db.soapNote.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
    });

    if (!soapNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of drafts
    if (soapNote.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft SOAP notes can be deleted' },
        { status: 400 }
      );
    }

    // Delete SOAP note
    await db.soapNote.delete({
      where: { id },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'delete',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: soapNote.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'DELETE', 'soap_note', id);

    return NextResponse.json({
      success: true,
      message: 'SOAP note deleted',
      meta: {
        deletedBy: user.employeeId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error deleting SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SOAP note' },
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
