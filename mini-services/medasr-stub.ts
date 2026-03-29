/**
 * MedASR (Medical ASR) Service Stub - Bun/TypeScript Version
 * Port 3033
 * 
 * Run with: bun run mini-services/medasr-stub.ts
 */

const PORT = parseInt(process.env.PORT || "3033");

interface TranscribeRequest {
  audio_data?: string;  // Base64 encoded audio
  language?: string;
  medical_vocabulary?: boolean;
  context?: string;
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
      services: { whisper: "configured", medical_vocab: "enabled" },
      timestamp: new Date().toISOString(),
      version: "1.0.0-bun-stub"
    });
  }

  // Root endpoint
  if (path === "/" && method === "GET") {
    return jsonResponse({
      service: "MedASR Voice Service",
      version: "1.0.0-bun-stub",
      port: PORT,
      docs: "/docs",
      capabilities: ["transcribe", "medical-dictation", "real-time"]
    });
  }

  // Transcribe endpoint
  if (path === "/api/v1/transcribe" && method === "POST") {
    try {
      const body: TranscribeRequest = await request.json();
      
      // Return a simulated transcription
      const sampleTranscript = body.context === "soap" 
        ? "Patient presents with chief complaint of chest pain. Onset was approximately two hours ago. Pain is described as sharp, radiating to left arm. Associated with shortness of breath and diaphoresis. No prior history of cardiac conditions. Current medications include aspirin and metformin for diabetes."
        : body.medical_vocabulary
          ? "The patient has a history of hypertension and type 2 diabetes mellitus. Current medications include lisinopril 10mg daily and metformin 500mg twice daily. Vital signs show blood pressure of 145 over 92, heart rate 78, temperature 98.6."
          : "This is a simulated transcription result for the provided audio input.";
      
      return jsonResponse({
        success: true,
        transcript: sampleTranscript,
        language: body.language || "en",
        confidence: 0.95,
        duration_seconds: 15.5,
        word_count: sampleTranscript.split(' ').length,
        medical_terms_detected: body.medical_vocabulary ? [
          { term: "hypertension", confidence: 0.98 },
          { term: "diabetes mellitus", confidence: 0.97 },
          { term: "lisinopril", confidence: 0.96 },
          { term: "metformin", confidence: 0.99 },
        ] : [],
        processing_time_ms: 850,
        timestamp: new Date().toISOString(),
      });
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // Real-time transcription WebSocket info
  if (path === "/api/v1/realtime" && method === "GET") {
    return jsonResponse({
      message: "WebSocket endpoint for real-time transcription",
      ws_url: `ws://localhost:${PORT}/ws/transcribe`,
      supported_codecs: ["opus", "pcm", "webm"],
    });
  }

  // 404 for unknown routes
  return jsonResponse({ error: "Not found" }, 404);
}

// Start server
console.log(`🎤 MedASR Voice Service (Bun Stub) starting on port ${PORT}...`);

Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`✅ MedASR Voice Service running at http://localhost:${PORT}`);
console.log(`   Health: http://localhost:${PORT}/health`);
console.log(`   Transcribe: POST http://localhost:${PORT}/api/v1/transcribe`);
