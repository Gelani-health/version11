/**
 * Patient by ID API Route - HIPAA Compliant
 * PROMPT 11: Updated with withAudit wrapper for unified audit trail
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: patient:read
 * - PUT: patient:write  
 * - DELETE: patient:delete
 * 
 * Audit trail is automatically captured via withAudit wrapper.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, AuthenticatedUser } from "@/lib/auth-middleware";
import { logAuditEvent, calculateRetainUntil } from "@/lib/audit-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
 * GET /api/patients/[id] - Get patient by ID
 * Permission: patient:read
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    // PROMPT 11: Log denied access
    await logAuditEvent({
      action: 'READ',
      resourceType: 'Patient',
      resourceId: 'access-denied',
      userId: 'anonymous',
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: authResult.error, endpoint: request.url },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:read')) {
    // PROMPT 11: Log denied access
    const { id } = await params;
    await logAuditEvent({
      action: 'READ',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: 'Insufficient permissions', endpoint: request.url },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        consultations: {
          take: 5,
          orderBy: { consultationDate: "desc" },
        },
        medications: {
          where: { status: "active" },
          take: 10,
        },
        diagnoses: {
          where: { status: "active" },
          take: 10,
        },
        vitals: {
          take: 1,
          orderBy: { recordedAt: "desc" },
        },
      },
    });

    if (!patient) {
      // PROMPT 11: Log failed read (not found)
      await logAuditEvent({
        action: 'READ',
        resourceType: 'Patient',
        resourceId: id,
        userId: user.employeeId,
        ipAddress: extractIpAddress(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        outcome: 'FAILURE',
        metadata: { reason: 'Patient not found' },
        retainUntil: calculateRetainUntil(),
      });

      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    // PROMPT 11: Log successful read
    await logAuditEvent({
      action: 'READ',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      patientId: id,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      metadata: {
        mrn: patient.mrn,
        patientName: `${patient.firstName} ${patient.lastName}`,
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json({
      success: true,
      data: patient,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patients/[id] - Update patient by ID
 * Permission: patient:write
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    await logAuditEvent({
      action: 'UPDATE',
      resourceType: 'Patient',
      resourceId: 'access-denied',
      userId: 'anonymous',
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: authResult.error },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:write')) {
    const { id } = await params;
    await logAuditEvent({
      action: 'UPDATE',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: 'Insufficient permissions' },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if patient exists
    const existingPatient = await db.patient.findUnique({ where: { id } });
    if (!existingPatient) {
      await logAuditEvent({
        action: 'UPDATE',
        resourceType: 'Patient',
        resourceId: id,
        userId: user.employeeId,
        ipAddress: extractIpAddress(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        outcome: 'FAILURE',
        metadata: { reason: 'Patient not found' },
        retainUntil: calculateRetainUntil(),
      });

      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    // Transform date fields
    if (body.dateOfBirth) {
      body.dateOfBirth = new Date(body.dateOfBirth);
    }

    // Stringify JSON fields
    if (body.allergies && typeof body.allergies !== 'string') {
      body.allergies = JSON.stringify(body.allergies);
    }
    if (body.chronicConditions && typeof body.chronicConditions !== 'string') {
      body.chronicConditions = JSON.stringify(body.chronicConditions);
    }

    const patient = await db.patient.update({
      where: { id },
      data: body,
    });

    // PROMPT 11: Log successful update
    await logAuditEvent({
      action: 'UPDATE',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      patientId: id,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      metadata: {
        mrn: patient.mrn,
        updatedFields: Object.keys(body),
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: "Patient updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update patient" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patients/[id] - Soft delete patient by ID
 * Permission: patient:delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'Patient',
      resourceId: 'access-denied',
      userId: 'anonymous',
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: authResult.error },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:delete')) {
    const { id } = await params;
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'DENIED',
      metadata: { reason: 'Insufficient permissions' },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Check if patient exists
    const existingPatient = await db.patient.findUnique({
      where: { id },
      select: { id: true, mrn: true, firstName: true, lastName: true, isActive: true }
    });

    if (!existingPatient) {
      await logAuditEvent({
        action: 'DELETE',
        resourceType: 'Patient',
        resourceId: id,
        userId: user.employeeId,
        ipAddress: extractIpAddress(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        outcome: 'FAILURE',
        metadata: { reason: 'Patient not found' },
        retainUntil: calculateRetainUntil(),
      });

      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    if (!existingPatient.isActive) {
      return NextResponse.json(
        { success: false, error: "Patient already deactivated" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const patient = await db.patient.update({
      where: { id },
      data: {
        isActive: false,
        notes: `Deactivated by ${user.employeeId} on ${new Date().toISOString()}`,
      },
    });

    // PROMPT 11: Log successful delete (soft delete)
    await logAuditEvent({
      action: 'DELETE',
      resourceType: 'Patient',
      resourceId: id,
      userId: user.employeeId,
      patientId: id,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      outcome: 'SUCCESS',
      metadata: {
        mrn: existingPatient.mrn,
        patientName: `${existingPatient.firstName} ${existingPatient.lastName}`,
        deletionType: 'soft',
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json({
      success: true,
      message: "Patient deactivated successfully",
      meta: {
        deactivatedBy: user.employeeId,
        deactivatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Delete Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}
