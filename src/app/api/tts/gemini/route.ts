import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini TTS API - Text to Speech using Gemini 2.5 Flash
// Requires GEMINI_API_KEY environment variable

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini TTS voices
const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Professional female voice' },
  { id: 'Charon', name: 'Charon', description: 'Professional male voice' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Warm male voice' },
  { id: 'Aoede', name: 'Aoede', description: 'Gentle female voice' },
];

// Check if API key is configured
function checkApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
}

// Prepare text for TTS
function prepareTextForTTS(text: string): string {
  // Remove markdown formatting
  text = text.replace(/[#*_`~\[\]]/g, '');
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Expand common medical abbreviations
  const abbreviations: Record<string, string> = {
    'Dr.': 'Doctor ',
    'Dr ': 'Doctor ',
    'Pt.': 'Patient ',
    'pt.': 'patient ',
    'BP': 'Blood Pressure',
    'HR': 'Heart Rate',
    'RR': 'Respiratory Rate',
    'Temp': 'Temperature',
    'O2': 'Oxygen',
    'SpO2': 'Oxygen Saturation',
    'IV': 'Intravenous',
    'IM': 'Intramuscular',
    'PO': 'by mouth',
    'PRN': 'as needed',
    'BID': 'twice daily',
    'TID': 'three times daily',
    'QID': 'four times daily',
    'QD': 'once daily',
    'HS': 'at bedtime',
    'STAT': 'immediately',
    'N/V': 'nausea and vomiting',
    'SOB': 'shortness of breath',
    'CP': 'chest pain',
    'HA': 'headache',
    'F/U': 'follow up',
    'Dx': 'diagnosis',
    'Tx': 'treatment',
    'Hx': 'history',
    'Px': 'prognosis',
    'Sx': 'symptoms',
    'Rx': 'prescription',
    'mg': 'milligrams',
    'mL': 'milliliters',
    'kg': 'kilograms',
    'mmHg': 'millimeters mercury',
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    text = text.replace(regex, full);
  }
  
  return text;
}

export async function POST(request: NextRequest) {
  try {
    checkApiKey();

    const body = await request.json();
    const { 
      text, 
      voice = 'Kore',
      model = 'gemini-2.5-flash-preview-tts',
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate voice
    if (!GEMINI_VOICES.find(v => v.id === voice)) {
      return NextResponse.json(
        { success: false, error: `Invalid voice. Available: ${GEMINI_VOICES.map(v => v.id).join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare text
    const preparedText = prepareTextForTTS(text);

    // Initialize Gemini client
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Generate TTS using Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: preparedText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });

    // Extract audio data from response
    const audioData = response.candidates?.[0]?.content?.parts?.[0];
    
    if (!audioData || !('inlineData' in audioData)) {
      return NextResponse.json(
        { success: false, error: 'No audio data received from Gemini' },
        { status: 500 }
      );
    }

    const inlineData = audioData.inlineData as { mimeType: string; data: string };
    const audioBuffer = Buffer.from(inlineData.data, 'base64');
    const mimeType = inlineData.mimeType || 'audio/mp3';

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
        'X-Voice': voice,
        'X-Model': model,
        'X-Text-Length': preparedText.length.toString(),
      },
    });
  } catch (error) {
    console.error('Gemini TTS API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    
    // Check for specific error types
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing Gemini API key' },
        { status: 401 }
      );
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return NextResponse.json(
        { success: false, error: 'Gemini API quota exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint to get available voices and check status
export async function GET() {
  try {
    checkApiKey();
    
    return NextResponse.json({
      success: true,
      provider: 'Gemini 2.5 Flash TTS',
      voices: GEMINI_VOICES,
      models: [
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
      ],
      constraints: {
        maxTextLength: 5000,
        supportedFormats: ['mp3', 'wav', 'pcm'],
      },
      apiKeyConfigured: !!GEMINI_API_KEY,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKeyConfigured: !!GEMINI_API_KEY,
    });
  }
}
