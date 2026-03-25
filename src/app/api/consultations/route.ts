/**
 * Consultations API Route - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: clinical_order:read
 * - POST: clinical_order:write
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, AuthenticatedUser, checkPermission } from "@/lib/auth-middleware";

/**
 * GET /api/consultations - List consultations
 * Permission: clinical_order:read
 */
export async function GET(request: NextRequest) {
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
    if (!checkPermission(user, 'clinical_order:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:read required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const whereClause: Record<string, unknown> = {};

    if (patientId) {
      whereClause.patientId = patientId;
    }

    if (status) {
      whereClause.status = status;
    }

    const consultations = await db.consultation.findMany({
      where: whereClause,
      take: limit,
      orderBy: { consultationDate: "desc" },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        diagnoses: true,
        medications: true,
      },
    });

    const total = await db.consultation.count({ where: whereClause });

    // Log PHI access
    await logPHIAccess(user, 'READ', 'consultations', consultations.length);

    return NextResponse.json({
      success: true,
      data: {
        consultations,
        total,
      },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Consultations Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch consultations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultations - Create new consultation
 * Permission: clinical_order:write
 */
export async function POST(request: NextRequest) {
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
    if (!checkPermission(user, 'clinical_order:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: clinical_order:write required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      patientId,
      consultationType,
      chiefComplaint,
      subjectiveNotes,
      objectiveNotes,
      assessment,
      plan,
      providerName,
      department,
    } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "Patient ID is required" },
        { status: 400 }
      );
    }

    const consultation = await db.consultation.create({
      data: {
        patientId,
        consultationType: consultationType || "outpatient",
        consultationDate: new Date(),
        chiefComplaint,
        subjectiveNotes,
        objectiveNotes,
        assessment,
        plan,
        providerName: providerName || user.name,
        department,
        status: "in-progress",
      },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log PHI creation
    await logPHIAccess(user, 'CREATE', 'consultation', consultation.id, { 
      patientId,
      consultationType: consultation.consultationType 
    });

    return NextResponse.json({
      success: true,
      data: consultation,
      message: "Consultation created successfully",
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create consultation" },
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
