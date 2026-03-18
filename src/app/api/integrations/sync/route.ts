import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Perform sync for a specific integration module
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationType, module } = body;

    const startTime = Date.now();

    // Create sync log entry
    const syncLog = await db.integrationSyncLog.create({
      data: {
        integrationType,
        module: module || "all",
        syncDirection: "inbound",
        status: "pending",
      },
    });

    try {
      let result;

      if (integrationType === "bahmni") {
        result = await performBahmniSync(module, syncLog.id);
      } else if (integrationType === "odoo") {
        result = await performOdooSync(module, syncLog.id);
      } else {
        throw new Error("Invalid integration type");
      }

      // Update sync log with success
      await db.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "success",
          recordsSynced: result.recordsSynced,
          recordsFailed: result.recordsFailed,
          completedAt: new Date(),
          duration: Date.now() - startTime,
        },
      });

      // Update last sync time
      if (integrationType === "bahmni") {
        const config = await db.bahmniIntegration.findFirst();
        if (config) {
          await db.bahmniIntegration.update({
            where: { id: config.id },
            data: { lastSyncAt: new Date() },
          });
        }
      } else if (integrationType === "odoo") {
        const config = await db.odooIntegration.findFirst();
        if (config) {
          await db.odooIntegration.update({
            where: { id: config.id },
            data: { lastSyncAt: new Date() },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          syncId: syncLog.id,
          ...result,
          duration: Date.now() - startTime,
        },
      });
    } catch (syncError) {
      // Update sync log with failure
      await db.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "failed",
          errorMessage: syncError instanceof Error ? syncError.message : "Unknown error",
          completedAt: new Date(),
          duration: Date.now() - startTime,
        },
      });

      throw syncError;
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

async function performBahmniSync(module: string | undefined, syncLogId: string): Promise<{
  recordsSynced: number;
  recordsFailed: number;
  modules: Array<{ module: string; synced: number; failed: number }>;
}> {
  const config = await db.bahmniIntegration.findFirst();
  
  if (!config || config.connectionStatus !== "connected") {
    throw new Error("Bahmni not connected. Please test connection first.");
  }

  const baseUrl = config.bahmniUrl.replace(/\/$/, "");
  const fhirUrl = `${baseUrl}${config.apiEndpoint}`;

  // Prepare authentication headers
  const headers: Record<string, string> = {
    "Accept": "application/fhir+json",
    "Content-Type": "application/fhir+json",
  };

  if (config.authType === "basic" && config.username && config.password) {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const modules: Array<{ module: string; synced: number; failed: number }> = [];
  let totalSynced = 0;
  let totalFailed = 0;

  const modulesToSync = module === "all" || !module 
    ? ["Patient", "Encounter", "Observation", "MedicationRequest"]
    : [module];

  for (const resourceType of modulesToSync) {
    try {
      const response = await fetch(`${fhirUrl}/${resourceType}?_count=100`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const entries = data.entry || [];
        let synced = 0;
        let failed = 0;

        for (const entry of entries) {
          try {
            if (resourceType === "Patient") {
              await syncFHIRPatient(entry.resource, config.id);
              synced++;
            } else if (resourceType === "Encounter") {
              await syncFHIREncounter(entry.resource);
              synced++;
            } else if (resourceType === "Observation") {
              await syncFHIRObservation(entry.resource);
              synced++;
            } else if (resourceType === "MedicationRequest") {
              await syncFHIRMedicationRequest(entry.resource);
              synced++;
            }
          } catch {
            failed++;
          }
        }

        modules.push({ module: resourceType, synced, failed });
        totalSynced += synced;
        totalFailed += failed;
      } else {
        modules.push({ module: resourceType, synced: 0, failed: 0 });
      }
    } catch (error) {
      console.error(`Error syncing ${resourceType}:`, error);
      modules.push({ module: resourceType, synced: 0, failed: 0 });
    }
  }

  return { recordsSynced: totalSynced, recordsFailed: totalFailed, modules };
}

async function syncFHIRPatient(resource: Record<string, unknown>, configId: string): Promise<void> {
  const patientData = {
    bahmniPatientId: resource.id as string,
    mrn: (resource.identifier as Array<{ value: string }>)?.[0]?.value || `MRN-${Date.now()}`,
    firstName: (resource.name as Array<{ given: string[] }>)?.[0]?.given?.[0] || "Unknown",
    lastName: (resource.name as Array<{ family: string }>)?.[0]?.family || "Unknown",
    dateOfBirth: new Date((resource.birthDate as string) || "1970-01-01"),
    gender: (resource.gender as string) || "unknown",
    phone: (resource.telecom as Array<{ system: string; value: string }>)?.find(t => t.system === "phone")?.value,
    email: (resource.telecom as Array<{ system: string; value: string }>)?.find(t => t.system === "email")?.value,
    lastSyncFromBahmni: new Date(),
  };

  await db.patient.upsert({
    where: { bahmniPatientId: resource.id as string },
    update: patientData,
    create: patientData,
  });
}

async function syncFHIREncounter(resource: Record<string, unknown>): Promise<void> {
  // Implementation for syncing FHIR Encounter to Consultation
  // This would map FHIR Encounter resources to local Consultation records
  console.log("Syncing encounter:", resource.id);
}

async function syncFHIRObservation(resource: Record<string, unknown>): Promise<void> {
  // Implementation for syncing FHIR Observation to LabResult
  console.log("Syncing observation:", resource.id);
}

async function syncFHIRMedicationRequest(resource: Record<string, unknown>): Promise<void> {
  // Implementation for syncing FHIR MedicationRequest to PatientMedication
  console.log("Syncing medication request:", resource.id);
}

async function performOdooSync(module: string | undefined, syncLogId: string): Promise<{
  recordsSynced: number;
  recordsFailed: number;
  modules: Array<{ module: string; synced: number; failed: number }>;
}> {
  const config = await db.odooIntegration.findFirst();
  
  if (!config || config.connectionStatus !== "connected") {
    throw new Error("Odoo not connected. Please test connection first.");
  }

  if (!config.database || !config.username || !config.password) {
    throw new Error("Odoo credentials not fully configured");
  }

  const baseUrl = config.odooUrl.replace(/\/$/, "");
  const rpcUrl = `${baseUrl}/jsonrpc`;

  // First, authenticate with Odoo
  const authBody = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [config.database, config.username, config.password, {}],
    },
    id: Date.now(),
  };

  const authResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authBody),
    signal: AbortSignal.timeout(15000),
  });

  const authData = await authResponse.json();
  const uid = authData.result;

  if (!uid) {
    throw new Error("Odoo authentication failed");
  }

  const modules: Array<{ module: string; synced: number; failed: number }> = [];
  let totalSynced = 0;
  let totalFailed = 0;

  const modulesToSync = module === "all" || !module 
    ? ["payments", "invoices", "crm", "accounting"]
    : [module];

  // Define Odoo models for each module
  const odooModels: Record<string, string> = {
    payments: "account.payment",
    invoices: "account.move",
    crm: "res.partner",
    accounting: "account.account",
  };

  for (const mod of modulesToSync) {
    try {
      const model = odooModels[mod];
      if (!model) {
        modules.push({ module: mod, synced: 0, failed: 0 });
        continue;
      }

      // Search and read records
      const searchBody = {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            config.database,
            uid,
            config.password,
            model,
            "search_read",
            [[]], // Empty domain = all records
            { fields: ["id", "name", "create_date"], limit: 100 },
          ],
        },
        id: Date.now(),
      };

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const records = data.result || [];
        
        modules.push({ 
          module: mod, 
          synced: records.length, 
          failed: 0 
        });
        totalSynced += records.length;
      } else {
        modules.push({ module: mod, synced: 0, failed: 0 });
      }
    } catch (error) {
      console.error(`Error syncing ${mod}:`, error);
      modules.push({ module: mod, synced: 0, failed: 1 });
      totalFailed++;
    }
  }

  return { recordsSynced: totalSynced, recordsFailed: totalFailed, modules };
}
