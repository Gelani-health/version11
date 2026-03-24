/**
 * Patient Documents API Route - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: patient:read
 * - POST: patient:write
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * GET /api/patients/[id]/documents - Get all documents for a patient
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
    const { id: patientId } = await params;

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: READ | Resource: patient-documents:${patientId}`);

    const documents = await db.medicalDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: { documents },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching patient documents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patients/[id]/documents - Create a new document for a patient
 * Permission: patient:write
 */
export async function POST(
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
    const { id: patientId } = await params;
    const body = await request.json();

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: CREATE | Resource: patient-document:${patientId} | DocumentType: ${body.documentType || 'clinical-note'} | Title: ${body.title || 'Untitled'}`);

    const document = await db.medicalDocument.create({
      data: {
        patientId,
        documentType: body.documentType || "clinical-note",
        title: body.title || "Untitled Document",
        content: body.content || "",
        consultationId: body.consultationId,
        fileUrl: body.fileUrl,
        fileType: body.fileType,
        aiGenerated: body.aiGenerated || false,
        aiModelUsed: body.aiModelUsed,
        authoredBy: body.authoredBy || user.name,
      },
    });

    return NextResponse.json({
      success: true,
      data: { document },
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create document" },
      { status: 500 }
    );
  }
}
