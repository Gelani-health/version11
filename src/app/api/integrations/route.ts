import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Integration API - Manage Bahmni HIS and Odoo ERP connections
// Get all integrations status
export async function GET(request: NextRequest) {
  try {
    // Get Bahmni integration config
    const bahmniConfig = await db.bahmniIntegration.findFirst();
    
    // Get Odoo integration config - check if model exists
    let odooConfig = null;
    if ('odooIntegration' in db) {
      odooConfig = await (db as unknown as { odooIntegration: { findFirst: () => Promise<unknown> } }).odooIntegration.findFirst();
    }
    
    // Get recent sync logs - check if model exists
    let recentLogs: unknown[] = [];
    if ('integrationSyncLog' in db) {
      recentLogs = await (db as unknown as { integrationSyncLog: { findMany: (args: { take: number; orderBy: { createdAt: string } }) => Promise<unknown[]> } }).integrationSyncLog.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        bahmni: {
          configured: !!bahmniConfig,
          connected: bahmniConfig?.connectionStatus === "connected",
          url: bahmniConfig?.bahmniUrl || "Not configured",
          lastSync: bahmniConfig?.lastSyncAt?.toISOString() || null,
          lastError: bahmniConfig?.lastError || null,
        },
        odoo: {
          configured: !!odooConfig,
          connected: odooConfig?.connectionStatus === "connected",
          url: odooConfig?.odooUrl || "Not configured",
          lastSync: odooConfig?.lastSyncAt?.toISOString() || null,
          lastError: odooConfig?.lastError || null,
        },
        recentLogs,
      },
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// Update integration configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationType, config } = body;

    if (integrationType === "bahmni") {
      const existing = await db.bahmniIntegration.findFirst();
      
      if (existing) {
        const updated = await db.bahmniIntegration.update({
          where: { id: existing.id },
          data: {
            bahmniUrl: config.bahmniUrl,
            apiEndpoint: config.apiEndpoint,
            authType: config.authType || "basic",
            username: config.username,
            password: config.password,
            apiKey: config.apiKey,
            syncInterval: config.syncInterval || 60,
            syncEnabled: config.syncEnabled ?? true,
          },
        });
        return NextResponse.json({ success: true, data: updated });
      } else {
        const created = await db.bahmniIntegration.create({
          data: {
            bahmniUrl: config.bahmniUrl,
            apiEndpoint: config.apiEndpoint || "/openmrs/ws/fhir2/R4",
            authType: config.authType || "basic",
            username: config.username,
            password: config.password,
            apiKey: config.apiKey,
            syncInterval: config.syncInterval || 60,
            syncEnabled: config.syncEnabled ?? true,
            connectionStatus: "disconnected",
          },
        });
        return NextResponse.json({ success: true, data: created });
      }
    } else if (integrationType === "odoo") {
      const existing = await db.odooIntegration.findFirst();
      
      if (existing) {
        const updated = await db.odooIntegration.update({
          where: { id: existing.id },
          data: {
            odooUrl: config.odooUrl,
            database: config.database,
            authType: config.authType || "api-key",
            apiKey: config.apiKey,
            username: config.username,
            password: config.password,
            syncInterval: config.syncInterval || 30,
            syncEnabled: config.syncEnabled ?? false,
            syncPayments: config.syncPayments ?? true,
            syncInvoices: config.syncInvoices ?? true,
            syncCRM: config.syncCRM ?? true,
            syncAccounting: config.syncAccounting ?? true,
            syncSales: config.syncSales ?? true,
          },
        });
        return NextResponse.json({ success: true, data: updated });
      } else {
        const created = await db.odooIntegration.create({
          data: {
            odooUrl: config.odooUrl,
            database: config.database,
            authType: config.authType || "api-key",
            apiKey: config.apiKey,
            username: config.username,
            password: config.password,
            syncInterval: config.syncInterval || 30,
            syncEnabled: config.syncEnabled ?? false,
            connectionStatus: "disconnected",
          },
        });
        return NextResponse.json({ success: true, data: created });
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid integration type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update integration" },
      { status: 500 }
    );
  }
}

// Delete/disconnect integration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationType = searchParams.get("type");

    if (integrationType === "bahmni") {
      const existing = await db.bahmniIntegration.findFirst();
      if (existing) {
        await db.bahmniIntegration.update({
          where: { id: existing.id },
          data: { connectionStatus: "disconnected" },
        });
      }
    } else if (integrationType === "odoo") {
      const existing = await db.odooIntegration.findFirst();
      if (existing) {
        await db.odooIntegration.update({
          where: { id: existing.id },
          data: { connectionStatus: "disconnected" },
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid integration type" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Integration disconnected" });
  } catch (error) {
    console.error("Error disconnecting integration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
