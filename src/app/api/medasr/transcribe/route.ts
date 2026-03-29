/**
 * MedASR Transcribe Route - Backward Compatibility Layer
 * 
 * This route forwards requests to the unified /api/asr endpoint.
 * The unified API uses:
 * - Primary: z-ai-web-dev-sdk (cloud ASR)
 * - Fallback: MedASR Python service (port 3033)
 * - Final fallback: Web Speech API (client-side)
 * 
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }
  
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json(
      { success: false, error: 'Forbidden - AI usage not permitted' },
      { status: 403 }
    );
  }
  
  try {
    const body = await request.json();
    
    // Forward to unified ASR API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? 
                    `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/asr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward authorization
        "Cookie": request.headers.get("cookie") || "",
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    // Transform response to match expected format
    return NextResponse.json({
      transcription: data.transcription || "",
      confidence: data.confidence || 0,
      word_count: data.wordCount || data.word_count || 0,
      processing_time_ms: data.processingTimeMs || data.processing_time_ms || 0,
      medical_terms_detected: data.medicalTermsDetected || data.medical_terms_detected || [],
      segments: data.segments || [],
      engine: data.engine || "unknown",
      success: data.success,
    });
    
  } catch (error) {
    console.error("MedASR API error:", error);
    
    return NextResponse.json(
      {
        success: false,
        transcription: "",
        confidence: 0,
        word_count: 0,
        processing_time_ms: 0,
        medical_terms_detected: [],
        segments: [],
        engine: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Forward to unified ASR API health check
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? 
                    `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/asr`, {
      headers: {
        "Cookie": request.headers.get("cookie") || "",
      },
    });
    
    const data = await response.json();
    
    return NextResponse.json({
      status: data.status || "unknown",
      model_loaded: data.engines?.primary?.status === "ready" || false,
      gpu_available: data.engines?.fallback?.details?.gpu_available || false,
      engine: data.engines?.primary?.name || "unknown",
      version: "2.0.0",
    });
    
  } catch {
    return NextResponse.json({
      status: "degraded",
      model_loaded: false,
      gpu_available: false,
      engine: "unavailable",
    });
  }
}
