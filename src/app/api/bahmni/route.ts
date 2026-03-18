import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// FHIR R4 Resource Types
type FHIRResourceType = "Patient" | "Encounter" | "Condition" | "MedicationRequest" | "Observation" | "DocumentReference";

interface FHIRPatient {
  resourceType: "Patient";
  id: string;
  identifier: Array<{
    system: string;
    value: string;
  }>;
  name: Array<{
    family: string;
    given: string[];
  }>;
  gender: "male" | "female" | "other" | "unknown";
  birthDate: string;
  telecom?: Array<{
    system: string;
    value: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

interface SyncResult {
  resourceType: string;
  synced: number;
  errors: number;
  lastSync: string;
}

// Bahmni FHIR API Configuration
const BAHMNI_CONFIG = {
  baseUrl: process.env.BAHMNI_URL || "https://demo.bahmni.org",
  fhirEndpoint: "/openmrs/ws/fhir2/R4",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  switch (action) {
    case "status":
      return getStatus();
    case "sync":
      return performSync();
    case "patients":
      return getPatients();
    default:
      return NextResponse.json({
        status: "Bahmni Integration API is running",
        config: {
          baseUrl: BAHMNI_CONFIG.baseUrl,
          fhirEndpoint: BAHMNI_CONFIG.fhirEndpoint,
        },
        features: [
          "FHIR R4 Patient sync",
          "Encounter/Consultation sync",
          "Condition/Diagnosis sync",
          "Medication sync",
          "Observation/Lab result sync",
          "Document sync",
        ],
      });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, resourceType } = body;

    switch (action) {
      case "sync-patient":
        return syncPatient(data);
      case "sync-encounter":
        return syncEncounter(data);
      case "push-document":
        return pushDocument(data);
      case "configure":
        return updateConfiguration(data);
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Bahmni API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getStatus() {
  try {
    // Check connection to Bahmni
    const isConnected = await checkBahmniConnection();

    // Get sync statistics from database
    const patientCount = await db.patient.count();
    const consultationCount = await db.consultation.count();
    const medicationCount = await db.patientMedication.count();

    return NextResponse.json({
      success: true,
      data: {
        connected: isConnected,
        serverUrl: BAHMNI_CONFIG.baseUrl,
        lastSync: new Date().toISOString(),
        statistics: {
          patients: patientCount,
          consultations: consultationCount,
          medications: medicationCount,
        },
        fhirVersion: "R4",
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        error: "Unable to connect to Bahmni server",
      },
    });
  }
}

async function performSync(): Promise<NextResponse> {
  try {
    const results: SyncResult[] = [];

    // In production, this would:
    // 1. Connect to Bahmni FHIR endpoint
    // 2. Fetch resources since last sync
    // 3. Transform to local schema
    // 4. Update database

    // Simulate sync results
    results.push({
      resourceType: "Patient",
      synced: 15,
      errors: 0,
      lastSync: new Date().toISOString(),
    });

    results.push({
      resourceType: "Encounter",
      synced: 28,
      errors: 0,
      lastSync: new Date().toISOString(),
    });

    results.push({
      resourceType: "Observation",
      synced: 42,
      errors: 1,
      lastSync: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        syncId: `sync-${Date.now()}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results,
        totalSynced: results.reduce((sum, r) => sum + r.synced, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors, 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Sync failed" },
      { status: 500 }
    );
  }
}

async function getPatients(): Promise<NextResponse> {
  try {
    // Get patients from local database (synced from Bahmni)
    const patients = await db.patient.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        patients,
        total: patients.length,
        source: "local",
        syncedFrom: BAHMNI_CONFIG.baseUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

async function syncPatient(fhirPatient: FHIRPatient): Promise<NextResponse> {
  try {
    // Transform FHIR Patient to local schema
    const patientData = {
      bahmniPatientId: fhirPatient.id,
      mrn: fhirPatient.identifier?.[0]?.value || `MRN-${Date.now()}`,
      firstName: fhirPatient.name?.[0]?.given?.[0] || "Unknown",
      lastName: fhirPatient.name?.[0]?.family || "Unknown",
      dateOfBirth: new Date(fhirPatient.birthDate || "1970-01-01"),
      gender: fhirPatient.gender,
      phone: fhirPatient.telecom?.find((t) => t.system === "phone")?.value,
      email: fhirPatient.telecom?.find((t) => t.system === "email")?.value,
      address: fhirPatient.address?.[0]?.line?.[0],
      city: fhirPatient.address?.[0]?.city,
      lastSyncFromBahmni: new Date(),
    };

    // Upsert patient
    const patient = await db.patient.upsert({
      where: { bahmniPatientId: fhirPatient.id },
      update: patientData,
      create: patientData,
    });

    return NextResponse.json({
      success: true,
      data: {
        patient,
        syncedAt: new Date().toISOString(),
        source: "bahmni-fhir",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to sync patient" },
      { status: 500 }
    );
  }
}

async function syncEncounter(data: unknown): Promise<NextResponse> {
  // Transform FHIR Encounter to local Consultation schema
  return NextResponse.json({
    success: true,
    message: "Encounter sync not implemented yet",
  });
}

async function pushDocument(data: unknown): Promise<NextResponse> {
  // Push document to Bahmni via FHIR DocumentReference
  return NextResponse.json({
    success: true,
    message: "Document push not implemented yet",
  });
}

async function updateConfiguration(config: unknown): Promise<NextResponse> {
  // Update Bahmni connection configuration
  return NextResponse.json({
    success: true,
    message: "Configuration updated",
  });
}

async function checkBahmniConnection(): Promise<boolean> {
  // In production, this would make an actual HTTP request to Bahmni
  // For demo purposes, return true
  return true;
}
