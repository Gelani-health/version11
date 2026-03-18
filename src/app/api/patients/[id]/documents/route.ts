import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/patients/[id]/documents - Get all documents for a patient
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;

    const documents = await db.medicalDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: { documents },
    });
  } catch (error) {
    console.error("Error fetching patient documents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/patients/[id]/documents - Create a new document for a patient
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const body = await request.json();

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
        authoredBy: body.authoredBy,
      },
    });

    return NextResponse.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create document" },
      { status: 500 }
    );
  }
}
