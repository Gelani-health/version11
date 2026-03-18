import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error("Get Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}
