import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;

    const medications = await db.patientMedication.findMany({
      where: {
        patientId,
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Also get patient allergies for context
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        allergies: true,
        chronicConditions: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        medications,
        patient,
      },
    });
  } catch (error) {
    console.error("Get Patient Medications Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch medications" },
      { status: 500 }
    );
  }
}
