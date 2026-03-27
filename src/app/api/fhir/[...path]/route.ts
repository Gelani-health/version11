/**
 * FHIR R4 API Proxy Route
 * =======================
 *
 * This Next.js route proxies FHIR R4 requests to the Python Medical RAG Service.
 *
 * FHIR R4 Specification: https://hl7.org/fhir/R4/
 *
 * Supported Endpoints:
 * - GET /api/fhir/metadata - Capability Statement
 * - GET /api/fhir/Patient/{id} - Retrieve a patient
 * - GET /api/fhir/Patient/{id}/$everything - All patient resources
 * - GET /api/fhir/Composition - Search compositions (SOAP notes)
 * - GET /api/fhir/Condition - Search conditions (diagnoses)
 * - GET /api/fhir/ServiceRequest - Search service requests
 *
 * Authentication:
 * - All PHI endpoints require authentication via the auth-middleware
 * - JWT Bearer token authentication
 *
 * PROMPT 12: FHIR R4 Export Implementation
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { logAuditEvent, calculateRetainUntil } from "@/lib/audit-service";

// Python FHIR Service URL
const FHIR_SERVICE_URL = process.env.MEDICAL_RAG_SERVICE_URL || "http://localhost:3031";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Extract IP address from request
 */
function extractIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * Build the target URL for the Python FHIR service
 */
function buildFhirUrl(pathSegments: string[], searchParams: URLSearchParams): string {
  const path = pathSegments.join("/");
  const queryString = searchParams.toString();
  const url = `${FHIR_SERVICE_URL}/api/fhir/${path}${queryString ? `?${queryString}` : ""}`;
  return url;
}

/**
 * GET handler for FHIR read/search operations
 *
 * All FHIR read operations are GET requests. This handler:
 * 1. Authenticates the request (for PHI access)
 * 2. Proxies the request to the Python FHIR service
 * 3. Returns the FHIR resource response
 * 4. Logs the access for HIPAA compliance
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path: pathSegments } = await params;
  const pathString = pathSegments.join("/");

  // Allow metadata endpoint without authentication (capability statement)
  const isMetadataEndpoint = pathString === "metadata";
  const isHealthEndpoint = pathString === "health";

  if (!isMetadataEndpoint && !isHealthEndpoint) {
    // Authenticate request for PHI access
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      // Log denied access
      await logAuditEvent({
        action: "READ",
        resourceType: "FHIR",
        resourceId: pathString,
        userId: "anonymous",
        ipAddress: extractIpAddress(request),
        userAgent: request.headers.get("user-agent") || "unknown",
        outcome: "DENIED",
        metadata: { reason: authResult.error, endpoint: request.url },
        retainUntil: calculateRetainUntil(),
      });

      return NextResponse.json(
        {
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "forbidden",
              details: {
                text: authResult.error || "Authentication required for FHIR access",
              },
            },
          ],
        },
        { status: 401 }
      );
    }
  }

  try {
    // Build target URL
    const targetUrl = buildFhirUrl(pathSegments, request.nextUrl.searchParams);

    // Forward request to Python FHIR service
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // Forward authorization header if present
        ...(request.headers.get("authorization") && {
          Authorization: request.headers.get("authorization")!,
        }),
      },
    });

    // Get response body
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Log successful access for PHI resources
    if (!isMetadataEndpoint && !isHealthEndpoint) {
      const authResult = await authenticateRequest(request);
      if (authResult.authenticated && authResult.user) {
        // Extract patient ID if this is a patient-specific request
        let patientId: string | undefined;
        if (pathString.includes("Patient/")) {
          const parts = pathString.split("/");
          const patientIndex = parts.indexOf("Patient");
          if (patientIndex !== -1 && parts.length > patientIndex + 1) {
            patientId = parts[patientIndex + 1];
            // Remove $everything suffix if present
            if (patientId.includes("$")) {
              patientId = patientId.split("$")[0];
            }
          }
        }

        await logAuditEvent({
          action: "READ",
          resourceType: "FHIR",
          resourceId: pathString,
          userId: authResult.user.employeeId,
          patientId: patientId,
          ipAddress: extractIpAddress(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          outcome: "SUCCESS",
          metadata: {
            fhirResourceType: data.resourceType,
            endpoint: `/api/fhir/${pathString}`,
          },
          retainUntil: calculateRetainUntil(),
        });
      }
    }

    // Return FHIR response
    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/fhir+json",
      },
    });
  } catch (error) {
    console.error("FHIR Proxy Error:", error);

    // Return FHIR-compliant error response
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "FHIR service unavailable. Please try again later.",
            },
            diagnostics: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      },
      { status: 503 }
    );
  }
}

/**
 * POST handler for FHIR create operations
 *
 * While this implementation primarily supports read operations,
 * this handler allows for future FHIR create/update operations.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path: pathSegments } = await params;
  const pathString = pathSegments.join("/");

  // Authenticate request
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: authResult.error || "Authentication required",
            },
          },
        ],
      },
      { status: 401 }
    );
  }

  // Check for fhir:write permission
  if (!authResult.user!.permissions.includes("fhir:write")) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: "Insufficient permissions for FHIR write operations",
            },
          },
        ],
      },
      { status: 403 }
    );
  }

  try {
    const targetUrl = buildFhirUrl(pathSegments, new URLSearchParams());
    const body = await request.json();

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Log the write operation
    await logAuditEvent({
      action: "CREATE",
      resourceType: "FHIR",
      resourceId: pathString,
      userId: authResult.user!.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      outcome: response.ok ? "SUCCESS" : "FAILURE",
      metadata: {
        fhirResourceType: data.resourceType,
        endpoint: `/api/fhir/${pathString}`,
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/fhir+json",
      },
    });
  } catch (error) {
    console.error("FHIR POST Proxy Error:", error);

    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "FHIR service unavailable",
            },
          },
        ],
      },
      { status: 503 }
    );
  }
}

/**
 * PUT handler for FHIR update operations
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path: pathSegments } = await params;

  // Authenticate request
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: authResult.error || "Authentication required",
            },
          },
        ],
      },
      { status: 401 }
    );
  }

  // Check for fhir:write permission
  if (!authResult.user!.permissions.includes("fhir:write")) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: "Insufficient permissions for FHIR write operations",
            },
          },
        ],
      },
      { status: 403 }
    );
  }

  const pathString = pathSegments.join("/");

  try {
    const targetUrl = buildFhirUrl(pathSegments, new URLSearchParams());
    const body = await request.json();

    const response = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Log the update operation
    await logAuditEvent({
      action: "UPDATE",
      resourceType: "FHIR",
      resourceId: pathString,
      userId: authResult.user!.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      outcome: response.ok ? "SUCCESS" : "FAILURE",
      metadata: {
        fhirResourceType: data.resourceType,
        endpoint: `/api/fhir/${pathString}`,
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/fhir+json",
      },
    });
  } catch (error) {
    console.error("FHIR PUT Proxy Error:", error);

    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "FHIR service unavailable",
            },
          },
        ],
      },
      { status: 503 }
    );
  }
}

/**
 * DELETE handler for FHIR delete operations
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path: pathSegments } = await params;

  // Authenticate request
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: authResult.error || "Authentication required",
            },
          },
        ],
      },
      { status: 401 }
    );
  }

  // Check for fhir:delete permission
  if (!authResult.user!.permissions.includes("fhir:delete")) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "forbidden",
            details: {
              text: "Insufficient permissions for FHIR delete operations",
            },
          },
        ],
      },
      { status: 403 }
    );
  }

  const pathString = pathSegments.join("/");

  try {
    const targetUrl = buildFhirUrl(pathSegments, request.nextUrl.searchParams);

    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    // Log the delete operation
    await logAuditEvent({
      action: "DELETE",
      resourceType: "FHIR",
      resourceId: pathString,
      userId: authResult.user!.employeeId,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      outcome: response.ok ? "SUCCESS" : "FAILURE",
      metadata: {
        endpoint: `/api/fhir/${pathString}`,
      },
      retainUntil: calculateRetainUntil(),
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/fhir+json",
      },
    });
  } catch (error) {
    console.error("FHIR DELETE Proxy Error:", error);

    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "FHIR service unavailable",
            },
          },
        ],
      },
      { status: 503 }
    );
  }
}
