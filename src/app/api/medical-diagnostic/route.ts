/**
 * Medical Diagnostic RAG API Route
 * 
 * Connects to the Python Medical RAG Service for:
 * - PubMed/PMC literature retrieval
 * - GLM-4.7-Flash diagnostic recommendations
 * - Evidence-based clinical decision support
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';

const RAG_SERVICE_URL = process.env.MEDICAL_RAG_SERVICE_URL || 'http://localhost:3031';

interface DiagnosticRequest {
  patient_symptoms: string;
  medical_history?: string;
  age?: number;
  gender?: string;
  current_medications?: string[];
  allergies?: string[];
  vital_signs?: Record<string, unknown>;
  lab_results?: Record<string, unknown>;
  specialty?: string;
  top_k?: number;
}

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
    const body: DiagnosticRequest = await request.json();

    // Validate required fields
    if (!body.patient_symptoms || body.patient_symptoms.length < 10) {
      return NextResponse.json(
        { error: 'Patient symptoms must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Forward request to Python RAG service
    const response = await fetch(`${RAG_SERVICE_URL}/api/v1/diagnose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patient_symptoms: body.patient_symptoms,
        medical_history: body.medical_history,
        age: body.age,
        gender: body.gender,
        current_medications: body.current_medications,
        allergies: body.allergies,
        vital_signs: body.vital_signs,
        lab_results: body.lab_results,
        specialty: body.specialty,
        top_k: body.top_k || 20,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('RAG Service Error:', response.status, errorData);
      
      // Return fallback response if RAG service is unavailable
      if (response.status === 503 || response.status === 500) {
        return NextResponse.json(generateFallbackResponse(body), { status: 200 });
      }
      
      return NextResponse.json(
        { error: errorData.detail || 'Failed to get diagnostic recommendation' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Medical Diagnostic API Error:', error);
    
    // Return fallback response on connection error
    return NextResponse.json(generateFallbackResponse({
      patient_symptoms: 'Unknown symptoms',
    }), { status: 200 });
  }
}

/**
 * Generate fallback response when RAG service is unavailable
 */
function generateFallbackResponse(body: DiagnosticRequest) {
  return {
    request_id: `fallback_${Date.now()}`,
    timestamp: new Date().toISOString(),
    summary: 'Medical RAG service is currently initializing. This is a fallback response.',
    differential_diagnoses: [
      {
        condition: 'Clinical Assessment Required',
        probability: 0.5,
        reasoning: 'The AI diagnostic service is currently unavailable. Please perform standard clinical assessment and consult relevant medical literature directly.',
        supporting_evidence: ['Service temporarily unavailable'],
        recommended_tests: ['Complete physical examination', 'Review of systems', 'Patient history review'],
      },
    ],
    evidence_summary: 'Medical literature retrieval is temporarily unavailable. Please consult PubMed directly for relevant research.',
    citations: [],
    recommended_workup: [
      'Perform thorough physical examination',
      'Review complete medical history',
      'Order appropriate diagnostic tests based on clinical judgment',
      'Consult specialist if needed',
    ],
    treatment_considerations: [],
    red_flags: [
      'AI diagnostic service unavailable - use clinical judgment',
      'Verify all findings with appropriate diagnostic testing',
    ],
    follow_up: 'Schedule appropriate follow-up based on clinical assessment. Consider consulting specialist if symptoms persist or worsen.',
    confidence_level: 'low',
    articles_retrieved: 0,
    total_latency_ms: 0,
    model_used: 'fallback',
    disclaimer: 'This is a fallback response because the AI diagnostic service is unavailable. Always consult a qualified healthcare professional for clinical decisions.',
  };
}

export async function GET() {
  return NextResponse.json({
    status: 'Medical Diagnostic RAG API',
    endpoints: {
      'POST /api/medical-diagnostic': 'Generate diagnostic recommendation',
    },
    rag_service: RAG_SERVICE_URL,
  });
}
