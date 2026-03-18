import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface BahmniConfig {
  url: string;
  endpoint: string;
  authType: string;
  username?: string;
  password?: string;
  apiKey?: string;
}

interface OdooConfig {
  url: string;
  database?: string;
  authType: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

// Test connection to Bahmni HIS
async function testBahmniConnection(config: BahmniConfig): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const baseUrl = config.url.replace(/\/$/, "");
    const fhirUrl = `${baseUrl}${config.endpoint || "/openmrs/ws/fhir2/R4"}/metadata`;
    
    console.log(`Testing Bahmni connection to: ${fhirUrl}`);
    
    // Prepare headers
    const headers: Record<string, string> = {
      "Accept": "application/fhir+json",
      "Content-Type": "application/fhir+json",
    };

    // Add authentication
    if (config.authType === "basic" && config.username && config.password) {
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    } else if (config.authType === "api-key" && config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // Make request to Bahmni FHIR Capability Statement
    const response = await fetch(fhirUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      
      // Extract FHIR version and server info
      const fhirVersion = data.fhirVersion || "Unknown";
      const softwareName = data.software?.name || "Bahmni HIS";
      const softwareVersion = data.software?.version || "Unknown";

      // Update connection status in database
      const existing = await db.bahmniIntegration.findFirst();
      if (existing) {
        await db.bahmniIntegration.update({
          where: { id: existing.id },
          data: {
            connectionStatus: "connected",
            lastError: null,
          },
        });
      }

      return {
        success: true,
        message: `Successfully connected to ${softwareName}`,
        details: {
          fhirVersion,
          softwareName,
          softwareVersion,
          serverUrl: baseUrl,
          endpoint: config.endpoint,
          status: response.status,
        },
      };
    } else {
      const errorText = await response.text();
      
      // Update connection status with error
      const existing = await db.bahmniIntegration.findFirst();
      if (existing) {
        await db.bahmniIntegration.update({
          where: { id: existing.id },
          data: {
            connectionStatus: "error",
            lastError: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          },
        });
      }

      return {
        success: false,
        message: `Connection failed: HTTP ${response.status}`,
        error: errorText.slice(0, 500),
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update connection status with error
    const existing = await db.bahmniIntegration.findFirst();
    if (existing) {
      await db.bahmniIntegration.update({
        where: { id: existing.id },
        data: {
          connectionStatus: "error",
          lastError: errorMessage,
        },
      });
    }

    return {
      success: false,
      message: `Connection error: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

// Test connection to Odoo ERP
async function testOdooConnection(config: OdooConfig): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const baseUrl = config.url.replace(/\/$/, "");
    
    console.log(`Testing Odoo connection to: ${baseUrl}`);

    // Odoo external API endpoint
    // Odoo uses JSON-RPC for its external API
    const rpcUrl = `${baseUrl}/jsonrpc`;
    
    // Prepare JSON-RPC request for version check
    const rpcBody = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "version",
        args: [],
      },
      id: Date.now(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Try to get Odoo version info
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(rpcBody),
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const data = await response.json();
      
      // Check for valid Odoo response
      if (data.result) {
        const versionInfo = data.result;
        
        // If we have credentials, try to authenticate
        let authenticated = false;
        let uid = null;
        
        if (config.database && config.username && config.password) {
          try {
            const authBody = {
              jsonrpc: "2.0",
              method: "call",
              params: {
                service: "common",
                method: "authenticate",
                args: [config.database, config.username, config.password, {}],
              },
              id: Date.now() + 1,
            };
            
            const authResponse = await fetch(rpcUrl, {
              method: "POST",
              headers,
              body: JSON.stringify(authBody),
              signal: AbortSignal.timeout(15000),
            });
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              uid = authData.result;
              authenticated = !!uid;
            }
          } catch {
            // Authentication failed, but server is reachable
          }
        }

        // Update connection status in database
        const existing = await db.odooIntegration.findFirst();
        if (existing) {
          await db.odooIntegration.update({
            where: { id: existing.id },
            data: {
              connectionStatus: authenticated ? "connected" : "connected",
              lastError: null,
            },
          });
        }

        return {
          success: true,
          message: authenticated 
            ? `Successfully authenticated with Odoo ${versionInfo.server_version || ""}`
            : `Successfully connected to Odoo ${versionInfo.server_version || ""} (authentication not tested)`,
          details: {
            serverVersion: versionInfo.server_version,
            serverVersionInfo: versionInfo.server_version_info,
            databaseVersion: versionInfo.database_version,
            serverUrl: baseUrl,
            authenticated,
            uid,
          },
        };
      } else if (data.error) {
        return {
          success: false,
          message: `Odoo API error: ${data.error.message || "Unknown error"}`,
          error: JSON.stringify(data.error),
        };
      }
    }

    // Try alternative endpoint - /web/database/list (Odoo 15+)
    const webUrl = `${baseUrl}/web/database/list`;
    const webResponse = await fetch(webUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15000),
    });

    if (webResponse.ok) {
      const webData = await webResponse.json();
      
      // Update connection status
      const existing = await db.odooIntegration.findFirst();
      if (existing) {
        await db.odooIntegration.update({
          where: { id: existing.id },
          data: {
            connectionStatus: "connected",
            lastError: null,
          },
        });
      }

      return {
        success: true,
        message: "Successfully connected to Odoo server",
        details: {
          serverUrl: baseUrl,
          databases: webData.result || [],
          endpoint: "web/database/list",
        },
      };
    }

    // If both endpoints fail, check if it's an Odoo server at all
    const checkUrl = `${baseUrl}/`;
    const checkResponse = await fetch(checkUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (checkResponse.ok) {
      const html = await checkResponse.text();
      const isOdoo = html.toLowerCase().includes("odoo");
      
      if (isOdoo) {
        // Update connection status
        const existing = await db.odooIntegration.findFirst();
        if (existing) {
          await db.odooIntegration.update({
            where: { id: existing.id },
            data: {
              connectionStatus: "connected",
              lastError: "API access requires authentication",
            },
          });
        }

        return {
          success: true,
          message: "Odoo server detected, but API access requires proper authentication",
          details: {
            serverUrl: baseUrl,
            note: "Configure username/password for full API access",
          },
        };
      }
    }

    // Update connection status with error
    const existing = await db.odooIntegration.findFirst();
    if (existing) {
      await db.odooIntegration.update({
        where: { id: existing.id },
        data: {
          connectionStatus: "error",
          lastError: "Not a valid Odoo server or API not accessible",
        },
      });
    }

    return {
      success: false,
      message: "Not a valid Odoo server or API not accessible",
      error: "Server did not respond as expected for an Odoo instance",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update connection status with error
    const existing = await db.odooIntegration.findFirst();
    if (existing) {
      await db.odooIntegration.update({
        where: { id: existing.id },
        data: {
          connectionStatus: "error",
          lastError: errorMessage,
        },
      });
    }

    return {
      success: false,
      message: `Connection error: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationType, config } = body;

    if (!integrationType || !config) {
      return NextResponse.json(
        { success: false, error: "Missing integrationType or config" },
        { status: 400 }
      );
    }

    let result;

    if (integrationType === "bahmni") {
      result = await testBahmniConnection({
        url: config.bahmniUrl || config.url,
        endpoint: config.apiEndpoint || "/openmrs/ws/fhir2/R4",
        authType: config.authType || "basic",
        username: config.username,
        password: config.password,
        apiKey: config.apiKey,
      });
    } else if (integrationType === "odoo") {
      result = await testOdooConnection({
        url: config.odooUrl || config.url,
        database: config.database,
        authType: config.authType || "api-key",
        apiKey: config.apiKey,
        username: config.username,
        password: config.password,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid integration type" },
        { status: 400 }
      );
    }

    // Log the connection test
    await db.integrationSyncLog.create({
      data: {
        integrationType,
        module: "connection-test",
        syncDirection: "outbound",
        recordsSynced: result.success ? 1 : 0,
        recordsFailed: result.success ? 0 : 1,
        status: result.success ? "success" : "failed",
        errorMessage: result.error,
        completedAt: new Date(),
        duration: 0,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Connection test error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
