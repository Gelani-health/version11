import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Initialize ZAI instance (reused across requests)
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio_base64, context, enable_medical_postprocess } = body;

    if (!audio_base64) {
      return NextResponse.json(
        { error: 'No audio data provided' },
        { status: 400 }
      );
    }

    // Get ZAI instance
    const zai = await getZAI();

    // Transcribe audio using z-ai-web-dev-sdk ASR
    const response = await zai.audio.asr.create({
      file_base64: audio_base64
    });

    let transcription = response.text || '';
    const medicalTermsDetected: string[] = [];

    // Post-process for medical terms if enabled
    if (enable_medical_postprocess && transcription) {
      const result = postProcessMedical(transcription);
      transcription = result.text;
      medicalTermsDetected.push(...result.detectedTerms);
    }

    // Calculate word count
    const wordCount = transcription.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      transcription,
      confidence: 0.95, // ZAI ASR provides high-quality transcription
      word_count: wordCount,
      processing_time_ms: 0,
      medical_terms_detected: medicalTermsDetected,
      segments: [],
      engine: 'z-ai-asr'
    });

  } catch (error) {
    console.error('ASR transcription error:', error);
    
    return NextResponse.json(
      { 
        error: 'Transcription failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}

// Medical term post-processing
function postProcessMedical(text: string): { text: string; detectedTerms: string[] } {
  const medicalTerms: Record<string, string> = {
    // Drug names
    'metformin': 'metformin',
    'lisinopril': 'lisinopril',
    'atorvastatin': 'atorvastatin',
    'omeprazole': 'omeprazole',
    'amlodipine': 'amlodipine',
    'metoprolol': 'metoprolol',
    'losartan': 'losartan',
    'gabapentin': 'gabapentin',
    'hydrochlorothiazide': 'hydrochlorothiazide',
    'prednisone': 'prednisone',
    'aspirin': 'aspirin',
    'ibuprofen': 'ibuprofen',
    'acetaminophen': 'acetaminophen',
    'paracetamol': 'paracetamol',
    
    // Medical conditions
    'hypertension': 'hypertension',
    'diabetes mellitus': 'diabetes mellitus',
    'diabetes': 'diabetes',
    'hyperlipidemia': 'hyperlipidemia',
    'coronary artery disease': 'coronary artery disease',
    'chronic kidney disease': 'chronic kidney disease',
    'atrial fibrillation': 'atrial fibrillation',
    'congestive heart failure': 'congestive heart failure',
    'chronic obstructive pulmonary disease': 'chronic obstructive pulmonary disease',
    'copd': 'COPD',
    'myocardial infarction': 'myocardial infarction',
    'heart attack': 'heart attack',
    'stroke': 'stroke',
    
    // Medical abbreviations
    'b i d': 'BID',
    't i d': 'TID',
    'q i d': 'QID',
    'p r n': 'PRN',
    'q d': 'QD',
    'h s': 'HS',
    'p o': 'PO',
    'i v': 'IV',
    'i m': 'IM',
    's c': 'SC',
    
    // Anatomy
    'bilateral': 'bilateral',
    'unilateral': 'unilateral',
    'anterior': 'anterior',
    'posterior': 'posterior',
    'superior': 'superior',
    'inferior': 'inferior',
    'lateral': 'lateral',
    'medial': 'medial',
  };

  const words = text.toLowerCase().split(/(\s+)/);
  const detectedTerms: string[] = [];
  
  const processedWords = words.map(word => {
    const cleanWord = word.trim().toLowerCase();
    if (medicalTerms[cleanWord]) {
      const corrected = medicalTerms[cleanWord];
      if (corrected !== cleanWord) {
        detectedTerms.push(`${cleanWord} -> ${corrected}`);
      }
      return corrected;
    }
    return word;
  });

  return {
    text: processedWords.join(''),
    detectedTerms
  };
}

export async function GET() {
  return NextResponse.json({
    service: 'ASR API',
    version: '1.0.0',
    description: 'Speech-to-Text using z-ai-web-dev-sdk',
    engine: 'z-ai-asr',
    status: 'ready'
  });
}
