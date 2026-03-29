import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth-middleware';

// MedASR Service Configuration
const MEDASR_SERVICE_URL = "http://localhost:3033";

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    const { audio_base64, sample_rate = 16000, language = "en", context, enable_medical_postprocess = true } = body;
    
    if (!audio_base64) {
      return NextResponse.json(
        { error: "audio_base64 is required" },
        { status: 400 }
      );
    }
    
    // Forward to MedASR service
    const response = await fetch(`${MEDASR_SERVICE_URL}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_base64,
        sample_rate,
        language,
        context,
        enable_medical_postprocess,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("MedASR service error:", error);
      
      // Return fallback response
      return NextResponse.json({
        transcription: "",
        confidence: 0,
        word_count: 0,
        processing_time_ms: 0,
        medical_terms_detected: [],
        segments: [],
        error: "MedASR service unavailable",
      });
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("MedASR API error:", error);
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${MEDASR_SERVICE_URL}/health`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: "unavailable",
      model_loaded: false,
      gpu_available: false,
    });
  }
}
