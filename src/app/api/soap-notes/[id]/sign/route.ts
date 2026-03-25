/**
 * SOAP Note Sign API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - POST: soap_note:sign
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
 * POST /api/soap-notes/[id]/sign - Sign SOAP note
 * Permission: soap_note:sign
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
    if (!checkPermission(user, 'soap_note:sign')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:sign required" },
        { status: 403 }
      );
    }

    const { id } = await params;

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

    // Check if note is already signed
    if (existingNote.status === 'signed') {
      return NextResponse.json(
        { success: false, error: 'SOAP note is already signed' },
        { status: 400 }
      );
    }

    // Validate required fields before signing
    const requiredFields = ['chiefComplaint', 'primaryDiagnosisCode', 'primaryDiagnosisDesc'];
    const missingFields = requiredFields.filter(field => !existingNote[field as keyof typeof existingNote]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Sign the SOAP note with authenticated user
    const signedNote = await db.soapNote.update({
      where: { id },
      data: {
        status: 'signed',
        signedAt: new Date(),
        signedBy: user.employeeId,
        lockVersion: { increment: 1 },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'sign',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'SIGN', 'soap_note', id);

    return NextResponse.json({
      success: true,
      data: signedNote,
      message: 'SOAP note signed successfully',
      meta: {
        signedBy: user.employeeId,
        signedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error signing SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign SOAP note' },
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
