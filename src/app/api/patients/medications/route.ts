import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Add a new medication for a patient
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      medicationName,
      genericName,
      dosage,
      frequency,
      route,
      duration,
      prescribedBy,
    } = body;

    if (!patientId || !medicationName) {
      return NextResponse.json(
        { success: false, error: "Patient ID and medication name are required" },
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
        prescribedBy,
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
    });
  } catch (error) {
    console.error("Add Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add medication" },
      { status: 500 }
    );
  }
}
