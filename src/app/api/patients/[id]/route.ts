/**
 * Patient by ID API Route - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: patient:read
 * - PUT: patient:write  
 * - DELETE: patient:delete
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * GET /api/patients/[id] - Get patient by ID
 * Permission: patient:read
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:read')) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: READ | Resource: patient:${id}`);

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
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:write')) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: UPDATE | Resource: patient:${id}`);

    // Check if patient exists
    const existingPatient = await db.patient.findUnique({ where: { id } });
    if (!existingPatient) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const user = authResult.user!;

  // Permission check
  if (!user.permissions.includes('patient:delete')) {
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

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: DELETE | Resource: patient:${id} | MRN: ${existingPatient.mrn} | Name: ${existingPatient.firstName} ${existingPatient.lastName}`);

    // Soft delete by setting isActive to false
    const patient = await db.patient.update({
      where: { id },
      data: {
        isActive: false,
        notes: `Deactivated by ${user.employeeId} on ${new Date().toISOString()}`,
      },
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
