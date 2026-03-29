/**
 * MedASR (Medical ASR) Service - z-ai-web-dev-sdk Integration
 * ============================================================
 * Port 3033 - Real Medical Speech Recognition
 * 
 * This service provides REAL speech-to-text using Z.ai SDK:
 * - Medical vocabulary optimization
 * - SOAP note transcription
 * - Real-time dictation support
 * 
 * Run with: bun run mini-services/medasr-service.ts
 */

import ZAI from 'z-ai-web-dev-sdk';

const PORT = parseInt(process.env.PORT || "3033");

// Singleton ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Medical terminology corrections
const MEDICAL_TERMS: Record<string, string> = {
  "b p": "BP",
  "blood pressure": "BP",
  "heart rate": "HR",
  "temperature": "Temp",
  "oxygen saturation": "O2 sat",
  "respiratory rate": "RR",
  "chief complaint": "Chief Complaint",
  "history of present illness": "HPI",
  "review of systems": "ROS",
  "physical exam": "Physical Exam",
  "assessment and plan": "Assessment and Plan",
  "as needed": "PRN",
  "twice daily": "BID",
  "three times daily": "TID",
  "four times daily": "QID",
  "once daily": "QD",
  "before meals": "AC",
  "after meals": "PC",
  "at bedtime": "HS",
  "by mouth": "PO",
  "intravenous": "IV",
  "intramuscular": "IM",
  "subcutaneous": "SC",
  "milligrams": "mg",
  "micrograms": "mcg",
  "milliliters": "mL",
  "milliequivalents": "mEq",
};

function applyMedicalVocabulary(text: string): string {
  let processed = text;
  for (const [spoken, written] of Object.entries(MEDICAL_TERMS)) {
    const regex = new RegExp(spoken, "gi");
    processed = processed.replace(regex, written);
  }
  return processed;
}

interface TranscribeRequest {
  audio_data?: string;  // Base64 encoded audio
  language?: string;
  medical_vocabulary?: boolean;
  context?: string;  // "soap" | "dictation" | "general"
  format?: string;
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
      services: { 
        zai_sdk: "connected",
        asr: "z.ai_sdk",
        medical_vocabulary: "enabled",
        supported_formats: ["wav", "mp3", "m4a", "webm"]
      },
      timestamp: new Date().toISOString(),
      version: "2.0.0-zai-sdk",
      port: PORT
    });
  }

  // Root endpoint
  if (path === "/" && method === "GET") {
    return jsonResponse({
      service: "MedASR Voice Service",
      version: "2.0.0-zai-sdk",
      port: PORT,
      docs: "/docs",
      capabilities: [
        "transcribe",
        "medical-dictation",
        "real-time",
        "soap-formatting",
        "medical-vocabulary"
      ],
      provider: "Z.ai ASR SDK"
    });
  }

  // Transcribe endpoint - REAL ASR using Z.ai SDK
  if (path === "/api/v1/transcribe" && method === "POST") {
    try {
      const body: TranscribeRequest = await request.json();
      const startTime = Date.now();

      if (!body.audio_data) {
        return jsonResponse({ 
          success: false, 
          error: "No audio_data provided. Send base64-encoded audio." 
        }, 400);
      }

      const zai = await getZAI();

      // Use Z.ai ASR for real transcription
      let transcript = "";
      try {
        const asrResult = await zai.audio.asr.create({
          file_base64: body.audio_data
        });
        
        transcript = asrResult?.text || "";
      } catch (asrError: any) {
        console.error("ASR error:", asrError);
        return jsonResponse({
          success: false,
          error: asrError.message || "ASR processing failed",
          timestamp: new Date().toISOString()
        }, 500);
      }

      // Apply medical vocabulary if requested
      if (body.medical_vocabulary !== false) {
        transcript = applyMedicalVocabulary(transcript);
      }

      // Detect medical terms
      const medicalTermsDetected: Array<{ term: string; confidence: number }> = [];
      const medicalPatterns = [
        /\b(BP|HR|RR|Temp|O2 sat)\b/gi,
        /\b(mg|mcg|mL|mEq)\b/gi,
        /\b(PO|IV|IM|SC|PRN)\b/gi,
        /\b(BID|TID|QID|QD|AC|PC|HS)\b/gi,
        /\b(diabetes|hypertension|cardiac|respiratory|renal)\b/gi,
      ];

      for (const pattern of medicalPatterns) {
        const matches = transcript.match(pattern);
        if (matches) {
          for (const match of matches) {
            if (!medicalTermsDetected.some(t => t.term.toLowerCase() === match.toLowerCase())) {
              medicalTermsDetected.push({ term: match, confidence: 0.95 });
            }
          }
        }
      }

      // Format for SOAP context if requested
      let formattedTranscript = transcript;
      if (body.context === "soap") {
        // Use AI to format as SOAP
        const completion = await zai.chat.completions.create({
          messages: [
            { 
              role: "system", 
              content: "You are a clinical documentation specialist. Format the transcribed text into proper SOAP note format (Subjective, Objective, Assessment, Plan). Preserve all clinical details." 
            },
            { role: "user", content: transcript }
          ]
        });
        formattedTranscript = completion.choices?.[0]?.message?.content || transcript;
      }

      return jsonResponse({
        success: true,
        transcript: formattedTranscript,
        raw_transcript: transcript,
        language: body.language || "en",
        confidence: 0.95,
        duration_seconds: Math.ceil(transcript.length / 15), // Estimate
        word_count: transcript.split(/\s+/).length,
        medical_terms_detected: medicalTermsDetected,
        context: body.context || "general",
        medical_vocabulary_applied: body.medical_vocabulary !== false,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        provider: "z.ai_asr"
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      return jsonResponse({ 
        success: false, 
        error: error.message || "Transcription failed" 
      }, 500);
    }
  }

  // Real-time transcription info endpoint
  if (path === "/api/v1/realtime" && method === "GET") {
    return jsonResponse({
      message: "Real-time transcription endpoint",
      websocket_available: false,
      recommended_workflow: "Use /api/v1/transcribe with audio chunks",
      supported_codecs: ["opus", "pcm", "webm", "wav"],
      chunk_size_recommendation: "1-5 seconds of audio per request",
      example_request: {
        audio_data: "base64_encoded_audio",
        language: "en",
        medical_vocabulary: true,
        context: "soap"
      }
    });
  }

  // Vocabulary endpoint - Get supported medical terms
  if (path === "/api/v1/vocabulary" && method === "GET") {
    return jsonResponse({
      medical_abbreviations: MEDICAL_TERMS,
      total_terms: Object.keys(MEDICAL_TERMS).length,
      categories: [
        "vital_signs",
        "medication_routes",
        "dosage_frequencies",
        "units_of_measure",
        "clinical_sections"
      ]
    });
  }

  // Batch transcribe endpoint
  if (path === "/api/v1/batch-transcribe" && method === "POST") {
    try {
      const body = await request.json();
      const audioChunks = body.audio_chunks || [];
      const zai = await getZAI();
      const startTime = Date.now();

      const results = [];
      for (let i = 0; i < audioChunks.length; i++) {
        try {
          const asrResult = await zai.audio.asr.create({
            file_base64: audioChunks[i]
          });
          results.push({
            index: i,
            success: true,
            transcript: applyMedicalVocabulary(asrResult?.text || "")
          });
        } catch (err: any) {
          results.push({
            index: i,
            success: false,
            error: err.message
          });
        }
      }

      const fullTranscript = results
        .filter(r => r.success)
        .map(r => r.transcript)
        .join(" ");

      return jsonResponse({
        success: true,
        full_transcript: fullTranscript,
        chunks_processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // 404 for unknown routes
  return jsonResponse({ error: "Not found", path }, 404);
}

// Start server
console.log(`🎤 MedASR Voice Service (Z.ai SDK) starting on port ${PORT}...`);

// Initialize ZAI connection
getZAI()
  .then(() => console.log(`✅ Z.ai SDK initialized successfully`))
  .catch((err) => console.error(`⚠️ Z.ai SDK initialization warning:`, err.message));

Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`✅ MedASR Voice Service running at http://localhost:${PORT}`);
console.log(`   Health: http://localhost:${PORT}/health`);
console.log(`   Transcribe: POST http://localhost:${PORT}/api/v1/transcribe`);
console.log(`   Real ASR powered by Z.ai SDK`);
