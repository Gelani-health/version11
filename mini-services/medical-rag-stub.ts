/**
 * Medical RAG Service Stub - Bun/TypeScript Version
 * Port 3031
 * 
 * Run with: bun run mini-services/medical-rag-stub.ts
 */

const PORT = parseInt(process.env.PORT || "3031");

interface QueryRequest {
  query: string;
  patient_context?: Record<string, unknown>;
  specialty?: string;
  top_k?: number;
  min_score?: number;
}

interface DiagnosticRequest {
  patient_symptoms: string;
  medical_history?: string;
  age?: number;
  gender?: string;
  current_medications?: string[];
  specialty?: string;
  top_k?: number;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Health endpoints
  if (path === "/health" || path === "/health/ready" || path === "/health/live") {
    return jsonResponse({
      status: "healthy",
      services: { pinecone: "configured", llm: "configured" },
      timestamp: new Date().toISOString(),
      version: "1.0.0-bun-stub"
    });
  }

  // Root endpoint
  if (path === "/" && method === "GET") {
    return jsonResponse({
      service: "Medical RAG Service",
      version: "1.0.0-bun-stub",
      port: PORT,
      docs: "/docs"
    });
  }

  // Query endpoint
  if (path === "/api/v1/query" && method === "POST") {
    try {
      const body: QueryRequest = await request.json();
      return jsonResponse({
        query: body.query,
        expanded_query: `expanded: ${body.query}`,
        results: [{
          id: "pmid-001",
          score: 0.95,
          pmid: "12345678",
          title: "Clinical guidelines for diagnostic evaluation",
          abstract: "This systematic review provides evidence-based recommendations for clinical diagnosis and treatment protocols.",
          journal: "Journal of Clinical Medicine",
          publication_date: "2024-01-15",
        }],
        total_results: 1,
        latency_ms: 150.5,
      });
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // Diagnostic endpoint
  if (path === "/api/v1/diagnose" && method === "POST") {
    try {
      const body: DiagnosticRequest = await request.json();
      return jsonResponse({
        request_id: `diag-${Date.now()}`,
        timestamp: new Date().toISOString(),
        summary: `Based on symptoms: ${body.patient_symptoms?.substring(0, 100)}...`,
        differential_diagnoses: [{
          condition: "Clinical Assessment Required",
          probability: 0.75,
          reasoning: "Further evaluation needed based on presented symptoms",
          recommended_tests: ["Physical examination", "Laboratory workup", "Imaging if indicated"],
        }],
        recommended_workup: [
          "Complete physical examination",
          "Review of systems",
          "Baseline laboratory studies"
        ],
        red_flags: [
          "Seek immediate care if symptoms worsen",
          "Watch for fever, severe pain, or altered mental status"
        ],
        confidence_level: "medium",
        articles_retrieved: 5,
        total_latency_ms: 250.0,
        model_used: "glm-4.7-flash",
        disclaimer: "AI-generated suggestions require clinical verification by a qualified healthcare provider.",
      });
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // Specialties endpoint
  if (path === "/api/v1/specialties" && method === "GET") {
    return jsonResponse({
      specialties: [
        { code: "cardiology", name: "Cardiology" },
        { code: "neurology", name: "Neurology" },
        { code: "oncology", name: "Oncology" },
        { code: "infectious", name: "Infectious Disease" },
        { code: "nephrology", name: "Nephrology" },
        { code: "pulmonology", name: "Pulmonology" },
        { code: "emergency", name: "Emergency Medicine" },
        { code: "pharmacology", name: "Clinical Pharmacology" },
      ],
      total: 8,
    });
  }

  // 404 for unknown routes
  return jsonResponse({ error: "Not found" }, 404);
}

// Start server
console.log(`🏥 Medical RAG Service (Bun Stub) starting on port ${PORT}...`);

Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`✅ Medical RAG Service running at http://localhost:${PORT}`);
console.log(`   Health: http://localhost:${PORT}/health`);
console.log(`   Query:  POST http://localhost:${PORT}/api/v1/query`);
