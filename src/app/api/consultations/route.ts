import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      data: {
        consultations,
        total,
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

export async function POST(request: NextRequest) {
  try {
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
        providerName,
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

    return NextResponse.json({
      success: true,
      data: consultation,
      message: "Consultation created successfully",
    });
  } catch (error) {
    console.error("Create Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create consultation" },
      { status: 500 }
    );
  }
}
