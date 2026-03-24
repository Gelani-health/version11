/**
 * Single Consultation API Route - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: clinical_order:read
 * - PUT: clinical_order:write
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, AuthenticatedUser, checkPermission } from "@/lib/auth-middleware";

/**
 * GET /api/consultations/[id] - Get single consultation
 * Permission: clinical_order:read
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!checkPermission(user, 'clinical_order:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:read required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const consultation = await db.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
        diagnoses: true,
        medications: true,
        documents: true,
        aiInteractions: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json(
        { success: false, error: "Consultation not found" },
        { status: 404 }
      );
    }

    // Log PHI access
    await logPHIAccess(user, 'READ', 'consultation', id, { 
      patientId: consultation.patientId 
    });

    return NextResponse.json({
      success: true,
      data: consultation,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch consultation" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/consultations/[id] - Update consultation
 * Permission: clinical_order:write
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!checkPermission(user, 'clinical_order:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Check if consultation exists
    const existingConsultation = await db.consultation.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });

    if (!existingConsultation) {
      return NextResponse.json(
        { success: false, error: "Consultation not found" },
        { status: 404 }
      );
    }

    const consultation = await db.consultation.update({
      where: { id },
      data: body,
    });

    // Log PHI modification
    await logPHIAccess(user, 'UPDATE', 'consultation', id, { 
      updatedFields: Object.keys(body) 
    });

    return NextResponse.json({
      success: true,
      data: consultation,
      message: "Consultation updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update consultation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/consultations/[id] - Patch consultation
 * Permission: clinical_order:write
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!checkPermission(user, 'clinical_order:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Check if consultation exists
    const existingConsultation = await db.consultation.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });

    if (!existingConsultation) {
      return NextResponse.json(
        { success: false, error: "Consultation not found" },
        { status: 404 }
      );
    }

    const consultation = await db.consultation.update({
      where: { id },
      data: body,
    });

    // Log PHI modification
    await logPHIAccess(user, 'UPDATE', 'consultation', id, { 
      updatedFields: Object.keys(body) 
    });

    return NextResponse.json({
      success: true,
      data: consultation,
      message: "Consultation updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update consultation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultations/[id] - Delete consultation
 * Permission: clinical_order:write
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!checkPermission(user, 'clinical_order:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if consultation exists
    const existingConsultation = await db.consultation.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });

    if (!existingConsultation) {
      return NextResponse.json(
        { success: false, error: "Consultation not found" },
        { status: 404 }
      );
    }

    await db.consultation.delete({
      where: { id },
    });

    // Log PHI deletion
    await logPHIAccess(user, 'DELETE', 'consultation', id, { 
      patientId: existingConsultation.patientId 
    });

    return NextResponse.json({
      success: true,
      message: "Consultation deleted successfully",
      meta: {
        deletedBy: user.employeeId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Delete Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete consultation" },
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
