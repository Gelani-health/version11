/**
 * Patient Medications API Route - HIPAA Compliant
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
 * GET /api/patients/[id]/medications - Get patient medications
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
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: READ | Resource: patient-medications:${patientId}`);

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
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
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

/**
 * POST /api/patients/[id]/medications - Add medication for patient
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
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: CREATE | Resource: patient-medication:${patientId} | Medication: ${body.medicationName || 'unknown'}`);

    const {
      medicationName,
      genericName,
      dosage,
      frequency,
      route,
      duration,
      prescribedBy,
    } = body;

    if (!medicationName) {
      return NextResponse.json(
        { success: false, error: "Medication name is required" },
        { status: 400 }
      );
    }

    // Check for potential interactions with existing medications
    const existingMeds = await db.patientMedication.findMany({
      where: {
        patientId,
        status: "active",
      },
    });

    // Simple interaction check (in production, this would use a proper drug database)
    const interactionAlerts: string[] = [];

    // Warfarin interactions
    if (medicationName.toLowerCase().includes("warfarin")) {
      const hasNSAID = existingMeds.some(m =>
        ["ibuprofen", "aspirin", "naproxen"].some(n =>
          m.medicationName.toLowerCase().includes(n)
        )
      );
      if (hasNSAID) {
        interactionAlerts.push("WARNING: NSAID + Warfarin increases bleeding risk");
      }
    }

    // ACE inhibitor + NSAID
    if (["lisinopril", "enalapril", "ramipril"].some(n => medicationName.toLowerCase().includes(n))) {
      const hasNSAID = existingMeds.some(m =>
        ["ibuprofen", "naproxen", "diclofenac"].some(n =>
          m.medicationName.toLowerCase().includes(n)
        )
      );
      if (hasNSAID) {
        interactionAlerts.push("CAUTION: ACE inhibitor + NSAID may reduce efficacy");
      }
    }

    const medication = await db.patientMedication.create({
      data: {
        patientId,
        medicationName,
        genericName,
        dosage,
        frequency,
        route: route || "oral",
        duration,
        prescribedBy: prescribedBy || user.name,
        prescribedDate: new Date(),
        status: "active",
        startDate: new Date(),
        interactionAlerts: interactionAlerts.length > 0 ? JSON.stringify(interactionAlerts) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: medication,
      message: "Medication added successfully",
      alerts: interactionAlerts,
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Add Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add medication" },
      { status: 500 }
    );
  }
}
