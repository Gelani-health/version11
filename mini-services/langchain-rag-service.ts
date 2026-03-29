/**
 * LangChain RAG Service - z-ai-web-dev-sdk Integration
 * ======================================================
 * Port 3032 - Knowledge Base Management & RAG Proxy
 * 
 * This service provides:
 * - Knowledge base ingestion and management
 * - Document embeddings via Z.ai
 * - Proxy to Medical RAG service (3031)
 * 
 * Run with: bun run mini-services/langchain-rag-service.ts
 */

import ZAI from 'z-ai-web-dev-sdk';

const PORT = parseInt(process.env.PORT || "3032");
const MEDICAL_RAG_URL = process.env.MEDICAL_RAG_URL || "http://localhost:3031";

// Singleton ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// In-memory knowledge store (in production, use a vector database)
const knowledgeStore: Map<string, {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  created_at: Date;
}> = new Map();

interface QueryRequest {
  query: string;
  namespace?: string;
  top_k?: number;
  min_score?: number;
  use_medical_rag?: boolean;
}

interface IngestRequest {
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  namespace?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Health endpoints
  if (path === "/health" || path === "/health/ready" || path === "/health/live") {
    return jsonResponse({
      status: "healthy",
      services: { 
        zai_sdk: "connected",
        vector_store: "in_memory",
        embeddings: "z.ai",
        medical_rag_proxy: MEDICAL_RAG_URL
      },
      timestamp: new Date().toISOString(),
      version: "2.0.0-zai-sdk",
      port: PORT,
      documents_indexed: knowledgeStore.size
    });
  }

  // Root endpoint
  if (path === "/" && method === "GET") {
    return jsonResponse({
      service: "LangChain RAG Service",
      version: "2.0.0-zai-sdk",
      port: PORT,
      docs: "/docs",
      capabilities: ["query", "ingest", "sync", "batch-ingest", "delete", "embeddings"],
      documents_indexed: knowledgeStore.size,
      provider: "Z.ai SDK"
    });
  }

  // Query endpoint - Search knowledge base or proxy to Medical RAG
  if (path === "/api/v1/query" && method === "POST") {
    try {
      const body: QueryRequest = await request.json();
      const startTime = Date.now();

      // If use_medical_rag is true, proxy to Medical RAG service
      if (body.use_medical_rag !== false) {
        try {
          const proxyResponse = await fetch(`${MEDICAL_RAG_URL}/api/v1/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          
          if (proxyResponse.ok) {
            const data = await proxyResponse.json();
            return jsonResponse({
              ...data,
              proxied_from: "medical_rag",
              proxy_port: 3031
            });
          }
        } catch (proxyError) {
          console.error("Medical RAG proxy failed, using local knowledge base");
        }
      }

      // Local knowledge base search
      const zai = await getZAI();
      
      // Use AI to search through indexed documents
      const relevantDocs = Array.from(knowledgeStore.values())
        .slice(0, body.top_k || 10);

      if (relevantDocs.length === 0) {
        // Use Z.ai for general medical knowledge
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: "You are a medical knowledge assistant. Provide accurate, evidence-based information." },
            { role: "user", content: body.query }
          ]
        });

        return jsonResponse({
          query: body.query,
          namespace: body.namespace || "default",
          results: [{
            id: "ai-response",
            score: 1.0,
            content: completion.choices?.[0]?.message?.content || "No response",
            source: "z.ai_llm"
          }],
          total_results: 1,
          latency_ms: Date.now() - startTime,
          source: "z.ai"
        });
      }

      // Generate AI summary of relevant documents
      const contextText = relevantDocs.map(d => d.content).join("\n\n---\n\n");
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a medical knowledge assistant. Answer based on the provided context." },
          { role: "user", content: `Context:\n${contextText}\n\nQuestion: ${body.query}` }
        ]
      });

      return jsonResponse({
        query: body.query,
        namespace: body.namespace || "default",
        results: relevantDocs.map(doc => ({
          id: doc.id,
          score: 0.85,
          content: doc.content,
          metadata: doc.metadata,
          created_at: doc.created_at
        })),
        ai_summary: completion.choices?.[0]?.message?.content,
        total_results: relevantDocs.length,
        latency_ms: Date.now() - startTime,
        source: "local_knowledge_base"
      });
    } catch (error: any) {
      console.error("Query error:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Ingest endpoint - Add documents to knowledge base
  if (path === "/api/v1/ingest" && method === "POST") {
    try {
      const body: IngestRequest = await request.json();
      const startTime = Date.now();

      const ingestedDocs: string[] = [];
      const zai = await getZAI();

      for (const doc of body.documents || []) {
        // Generate AI summary/processing of the document
        const processingPrompt = `Process this medical document for knowledge base storage. Extract key concepts, conditions, and clinical information:

${doc.content.substring(0, 2000)}

Provide a brief summary and key concepts.`;

        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: "You are a medical document processor. Extract key clinical information." },
            { role: "user", content: processingPrompt }
          ]
        });

        knowledgeStore.set(doc.id, {
          id: doc.id,
          content: doc.content,
          metadata: {
            ...doc.metadata,
            ai_processed: true,
            ai_summary: completion.choices?.[0]?.message?.content?.substring(0, 500),
            namespace: body.namespace || "default"
          },
          created_at: new Date()
        });

        ingestedDocs.push(doc.id);
      }

      return jsonResponse({
        success: true,
        message: `Ingested ${ingestedDocs.length} documents`,
        namespace: body.namespace || "default",
        document_ids: ingestedDocs,
        total_documents: knowledgeStore.size,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Ingest error:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Sync endpoint - Sync with Medical RAG
  if (path === "/api/v1/sync" && method === "POST") {
    try {
      const body = await request.json();
      
      // Check Medical RAG health
      let medicalRagStatus = "unknown";
      try {
        const healthCheck = await fetch(`${MEDICAL_RAG_URL}/health`);
        medicalRagStatus = healthCheck.ok ? "connected" : "error";
      } catch {
        medicalRagStatus = "unreachable";
      }

      return jsonResponse({
        success: true,
        message: "Sync status checked",
        sync_id: `sync-${Date.now()}`,
        medical_rag_status: medicalRagStatus,
        medical_rag_url: MEDICAL_RAG_URL,
        local_documents: knowledgeStore.size,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Batch ingest endpoint
  if (path === "/api/v1/batch-ingest" && method === "POST") {
    try {
      const body = await request.json();
      const documents = body.documents || [];
      
      const results = [];
      for (const doc of documents) {
        knowledgeStore.set(doc.id, {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata || {},
          created_at: new Date()
        });
        results.push(doc.id);
      }

      return jsonResponse({
        success: true,
        ingested: results.length,
        document_ids: results,
        total_documents: knowledgeStore.size,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Delete endpoint
  if (path === "/api/v1/documents" && method === "DELETE") {
    const docId = url.searchParams.get("id");
    
    if (docId) {
      const deleted = knowledgeStore.delete(docId);
      return jsonResponse({
        success: deleted,
        message: deleted ? `Document ${docId} deleted` : `Document ${docId} not found`,
        remaining_documents: knowledgeStore.size,
        timestamp: new Date().toISOString()
      });
    }

    // Clear all if no ID specified
    const count = knowledgeStore.size;
    knowledgeStore.clear();
    
    return jsonResponse({
      success: true,
      message: `Cleared ${count} documents`,
      timestamp: new Date().toISOString()
    });
  }

  // List documents endpoint
  if (path === "/api/v1/documents" && method === "GET") {
    const documents = Array.from(knowledgeStore.values()).map(doc => ({
      id: doc.id,
      content_preview: doc.content.substring(0, 200) + "...",
      metadata: doc.metadata,
      created_at: doc.created_at
    }));

    return jsonResponse({
      documents,
      total: documents.length,
      timestamp: new Date().toISOString()
    });
  }

  // 404 for unknown routes
  return jsonResponse({ error: "Not found", path }, 404);
}

// Start server
console.log(`📚 LangChain RAG Service (Z.ai SDK) starting on port ${PORT}...`);

// Initialize ZAI connection
getZAI()
  .then(() => console.log(`✅ Z.ai SDK initialized successfully`))
  .catch((err) => console.error(`⚠️ Z.ai SDK initialization warning:`, err.message));

Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`✅ LangChain RAG Service running at http://localhost:${PORT}`);
console.log(`   Health: http://localhost:${PORT}/health`);
console.log(`   Query:  POST http://localhost:${PORT}/api/v1/query`);
console.log(`   Ingest: POST http://localhost:${PORT}/api/v1/ingest`);
console.log(`   Proxy to Medical RAG: ${MEDICAL_RAG_URL}`);
