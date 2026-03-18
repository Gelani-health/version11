import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// TTS API - Text to Speech for Healthcare
// Converts text to natural-sounding speech audio

// Available voices
const AVAILABLE_VOICES = [
  { id: 'tongtong', name: 'Tong Tong', description: 'Warm and friendly' },
  { id: 'chuichui', name: 'Chui Chui', description: 'Lively and cute' },
  { id: 'xiaochen', name: 'Xiao Chen', description: 'Calm and professional' },
  { id: 'jam', name: 'Jam', description: 'British gentleman' },
  { id: 'kazi', name: 'Kazi', description: 'Clear and standard' },
  { id: 'douji', name: 'Dou Ji', description: 'Natural and smooth' },
  { id: 'luodo', name: 'Luo Do', description: 'Expressive' },
];

// Split text into chunks for TTS (max 1024 characters per request)
function splitTextIntoChunks(text: string, maxLength: number = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      // If single sentence is too long, split by words
      if (sentence.length > maxLength) {
        const words = sentence.split(/\s+/);
        let wordChunk = '';
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk.trim());
            wordChunk = word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
        else currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks.filter(chunk => chunk.length > 0);
}

// Prepare text for TTS (clean up medical text for better pronunciation)
function prepareTextForTTS(text: string): string {
  // Remove markdown formatting
  text = text.replace(/[#*_`~\[\]]/g, '');
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Expand common medical abbreviations for better pronunciation
  const abbreviations: Record<string, string> = {
    'Dr.': 'Doctor',
    'Dr': 'Doctor',
    'Pt.': 'Patient',
    'pt.': 'patient',
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
    'ICD': 'I C D',
    'mg': 'milligrams',
    'mL': 'milliliters',
    'kg': 'kilograms',
    'mmHg': 'millimeters mercury',
    'kg/m2': 'kilograms per meter squared',
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    text = text.replace(regex, full);
  }
  
  return text;
}

// Singleton ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAIInstance() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      text, 
      voice = 'tongtong', 
      speed = 1.0,
      volume = 1.0,
      returnBase64 = false,
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate parameters
    if (speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { success: false, error: 'Speed must be between 0.5 and 2.0' },
        { status: 400 }
      );
    }

    if (volume <= 0 || volume > 10) {
      return NextResponse.json(
        { success: false, error: 'Volume must be greater than 0 and up to 10' },
        { status: 400 }
      );
    }

    if (!AVAILABLE_VOICES.find(v => v.id === voice)) {
      return NextResponse.json(
        { success: false, error: `Invalid voice. Available: ${AVAILABLE_VOICES.map(v => v.id).join(', ')}` },
        { status: 400 }
      );
    }

    // Prepare text
    const preparedText = prepareTextForTTS(text);
    
    // Check if text needs to be split
    if (preparedText.length > 1024) {
      // For long text, we'll process the first chunk only in this request
      // The client should handle splitting for long content
      const chunks = splitTextIntoChunks(preparedText);
      
      return NextResponse.json({
        success: true,
        requiresChunking: true,
        totalChunks: chunks.length,
        chunks: chunks,
        message: 'Text exceeds 1024 characters. Use chunked processing.',
      });
    }

    // Get ZAI instance
    const zai = await getZAIInstance();

    // Generate TTS audio
    const response = await zai.audio.tts.create({
      input: preparedText,
      voice: voice,
      speed: speed,
      volume: volume,
      response_format: 'wav',
      stream: false,
    });

    // Get array buffer from Response object
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    if (returnBase64) {
      // Return as base64 for client-side playback
      const base64 = buffer.toString('base64');
      return NextResponse.json({
        success: true,
        audio: base64,
        format: 'wav',
        mimeType: 'audio/wav',
        textLength: preparedText.length,
        voice,
        speed,
      });
    }

    // Return audio as binary response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
        'X-Voice': voice,
        'X-Speed': speed.toString(),
        'X-Text-Length': preparedText.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate speech',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to get available voices
export async function GET() {
  return NextResponse.json({
    success: true,
    voices: AVAILABLE_VOICES,
    constraints: {
      maxTextLength: 1024,
      speedRange: { min: 0.5, max: 2.0, default: 1.0 },
      volumeRange: { min: 0.01, max: 10, default: 1.0 },
      supportedFormats: ['wav', 'mp3', 'pcm'],
    },
  });
}
