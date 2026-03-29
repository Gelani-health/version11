/**
 * Patient Medication by ID API Route - HIPAA Compliant
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
 * GET /api/patients/medications/[medicationId] - Get medication by ID
 * Permission: patient:read
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
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
    const { medicationId } = await params;

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: READ | Resource: medication:${medicationId}`);

    const medication = await db.patientMedication.findUnique({
      where: { id: medicationId },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            allergies: true,
          },
        },
      },
    });

    if (!medication) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: medication,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch medication" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patients/medications/[medicationId] - Update medication
 * Permission: patient:write
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
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
    const { medicationId } = await params;
    const body = await request.json();

    // Check if medication exists
    const existingMedication = await db.patientMedication.findUnique({
      where: { id: medicationId },
    });

    if (!existingMedication) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: UPDATE | Resource: medication:${medicationId} | UpdatedFields: ${Object.keys(body).join(',')}`);

    const medication = await db.patientMedication.update({
      where: { id: medicationId },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: medication,
      message: "Medication updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update medication" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patients/medications/[medicationId] - Discontinue medication (soft delete)
 * Permission: patient:delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
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
    const { medicationId } = await params;

    // Check if medication exists
    const existingMedication = await db.patientMedication.findUnique({
      where: { id: medicationId },
    });

    if (!existingMedication) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: DELETE | Resource: medication:${medicationId} | Medication: ${existingMedication.medicationName}`);

    // Soft delete by updating status to discontinued
    const medication = await db.patientMedication.update({
      where: { id: medicationId },
      data: {
        status: "discontinued",
        endDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Medication discontinued successfully",
      data: medication,
      meta: {
        discontinuedBy: user.employeeId,
        discontinuedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Discontinue Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to discontinue medication" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/patients/medications/[medicationId] - Partial update medication
 * Permission: patient:write
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
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
    const { medicationId } = await params;
    const body = await request.json();

    // Check if medication exists
    const existingMedication = await db.patientMedication.findUnique({
      where: { id: medicationId },
    });

    if (!existingMedication) {
      return NextResponse.json(
        { success: false, error: "Medication not found" },
        { status: 404 }
      );
    }

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: PATCH | Resource: medication:${medicationId} | UpdatedFields: ${Object.keys(body).join(',')}`);

    const medication = await db.patientMedication.update({
      where: { id: medicationId },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: medication,
      message: "Medication updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update medication" },
      { status: 500 }
    );
  }
}
