/**
 * Unified ASR API - Primary Speech-to-Text Endpoint for Gelani Healthcare
 * 
 * Features:
 * - Primary: z-ai-web-dev-sdk (cloud-based, high accuracy)
 * - Fallback 1: Local MedASR Python service (port 3033)
 * - Fallback 2: Web Speech API (browser-based, handled client-side)
 * 
 * Medical term post-processing with comprehensive dictionary
 * 
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { authenticateRequest } from '@/lib/auth-middleware';
import { processMedicalTerms, getDictionaryStats } from '@/lib/medical-terms-dictionary';

// ============================================
// Configuration
// ============================================

const MEDASR_SERVICE_URL = process.env.MEDASR_SERVICE_URL || 'http://localhost:3033';
const ASR_TIMEOUT_MS = 30000; // 30 seconds timeout
const MAX_AUDIO_SIZE_MB = 10; // Maximum audio file size

// ZAI instance caching for performance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiLastUsed = 0;
const ZAI_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// ZAI SDK Management
// ============================================

async function getZAI() {
  const now = Date.now();
  
  // Create new instance if none exists or cache expired
  if (!zaiInstance || (now - zaiLastUsed) > ZAI_CACHE_TTL) {
    try {
      zaiInstance = await ZAI.create();
      zaiLastUsed = now;
      console.log('[ASR] ZAI SDK initialized successfully');
    } catch (error) {
      console.error('[ASR] Failed to initialize ZAI SDK:', error);
      zaiInstance = null;
      throw error;
    }
  }
  
  return zaiInstance;
}

// ============================================
// Transcription Functions
// ============================================

interface TranscriptionResult {
  success: boolean;
  transcription: string;
  confidence: number;
  wordCount: number;
  processingTimeMs: number;
  medicalTermsDetected: string[];
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  engine: string;
  language: string;
  fallback?: boolean;
}

/**
 * Transcribe using z-ai-web-dev-sdk (primary)
 */
async function transcribeWithZAI(audioBase64: string, language: string): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  try {
    const zai = await getZAI();
    
    // Call ZAI ASR
    const response = await zai.audio.asr.create({
      file_base64: audioBase64
    });
    
    const processingTimeMs = Date.now() - startTime;
    
    // Extract transcription
    let transcription = response.text || '';
    
    // Process medical terms
    const medicalResult = processMedicalTerms(transcription);
    transcription = medicalResult.text;
    
    // Calculate word count
    const wordCount = transcription.split(/\s+/).filter(Boolean).length;
    
    return {
      success: true,
      transcription,
      confidence: 0.95, // ZAI provides high-quality transcription
      wordCount,
      processingTimeMs,
      medicalTermsDetected: medicalResult.detectedTerms,
      segments: [],
      engine: 'z-ai-asr',
      language,
    };
    
  } catch (error) {
    console.error('[ASR] ZAI transcription failed:', error);
    throw error;
  }
}

/**
 * Transcribe using local MedASR Python service (fallback)
 */
async function transcribeWithMedASR(
  audioBase64: string,
  sampleRate: number,
  language: string,
  context?: string
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);
    
    const response = await fetch(`${MEDASR_SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: audioBase64,
        sample_rate: sampleRate,
        language,
        context,
        enable_medical_postprocess: true,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`MedASR service returned ${response.status}`);
    }
    
    const data = await response.json();
    const processingTimeMs = Date.now() - startTime;
    
    // Process medical terms again for consistency
    let transcription = data.transcription || '';
    const medicalResult = processMedicalTerms(transcription);
    transcription = medicalResult.text;
    
    return {
      success: true,
      transcription,
      confidence: data.confidence || 0.85,
      wordCount: transcription.split(/\s+/).filter(Boolean).length,
      processingTimeMs,
      medicalTermsDetected: medicalResult.detectedTerms,
      segments: data.segments || [],
      engine: 'medasr-local',
      language,
    };
    
  } catch (error) {
    console.error('[ASR] MedASR fallback failed:', error);
    throw error;
  }
}

// ============================================
// API Handlers
// ============================================

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
  
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const {
      audio_base64,
      sample_rate = 16000,
      language = 'en',
      context,
      enable_medical_postprocess = true,
    } = body;
    
    // Validate input
    if (!audio_base64) {
      return NextResponse.json(
        { success: false, error: 'audio_base64 is required' },
        { status: 400 }
      );
    }
    
    // Check audio size (base64 is ~1.37x larger than binary)
    const audioSizeMB = (audio_base64.length * 0.75) / (1024 * 1024);
    if (audioSizeMB > MAX_AUDIO_SIZE_MB) {
      return NextResponse.json(
        { success: false, error: `Audio file too large (${audioSizeMB.toFixed(2)}MB). Maximum: ${MAX_AUDIO_SIZE_MB}MB` },
        { status: 400 }
      );
    }
    
    // Try primary: z-ai-web-dev-sdk
    try {
      const result = await transcribeWithZAI(audio_base64, language);
      
      // Log successful transcription
      console.log(`[ASR] ZAI transcription successful: ${result.wordCount} words in ${result.processingTimeMs}ms`);
      
      return NextResponse.json(result);
      
    } catch (zaiError) {
      console.log('[ASR] ZAI failed, trying MedASR fallback...');
      
      // Try fallback: local MedASR service
      try {
        const result = await transcribeWithMedASR(audio_base64, sample_rate, language, context);
        result.fallback = true;
        
        console.log(`[ASR] MedASR fallback successful: ${result.wordCount} words in ${result.processingTimeMs}ms`);
        
        return NextResponse.json(result);
        
      } catch (medasrError) {
        console.log('[ASR] MedASR fallback failed, returning empty transcription for client-side fallback');
        
        // Return empty transcription - client will use Web Speech API
        return NextResponse.json({
          success: true,
          transcription: '',
          confidence: 0,
          wordCount: 0,
          processingTimeMs: Date.now() - startTime,
          medicalTermsDetected: [],
          segments: [],
          engine: 'web-speech-api-fallback',
          language,
          fallback: true,
          message: 'Cloud and local ASR unavailable. Please try again or use browser speech recognition.',
        });
      }
    }
    
  } catch (error) {
    console.error('[ASR] API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Transcription failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for service status and medical dictionary info
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  // Return medical dictionary statistics
  if (action === 'dictionary') {
    const stats = getDictionaryStats();
    return NextResponse.json({
      success: true,
      dictionary: stats,
    });
  }
  
  // Check ZAI SDK status
  let zaiStatus = 'unknown';
  try {
    await getZAI();
    zaiStatus = 'ready';
  } catch {
    zaiStatus = 'unavailable';
  }
  
  // Check MedASR service status
  let medasrStatus = 'unknown';
  let medasrDetails = null;
  try {
    const response = await fetch(`${MEDASR_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    medasrDetails = await response.json();
    medasrStatus = 'ready';
  } catch {
    medasrStatus = 'unavailable';
  }
  
  return NextResponse.json({
    service: 'Unified ASR API',
    version: '2.0.0',
    description: 'Medical Speech-to-Text with z-ai-web-dev-sdk (primary) and MedASR (fallback)',
    status: zaiStatus === 'ready' || medasrStatus === 'ready' ? 'operational' : 'degraded',
    engines: {
      primary: {
        name: 'z-ai-web-dev-sdk',
        status: zaiStatus,
        features: ['cloud-based', 'high-accuracy', 'medical-term-processing'],
      },
      fallback: {
        name: 'MedASR',
        status: medasrStatus,
        url: MEDASR_SERVICE_URL,
        details: medasrDetails,
      },
      clientFallback: {
        name: 'Web Speech API',
        status: 'browser-dependent',
        features: ['real-time', 'no-server-required'],
      },
    },
    dictionary: getDictionaryStats(),
    limits: {
      maxAudioSizeMB: MAX_AUDIO_SIZE_MB,
      timeoutMs: ASR_TIMEOUT_MS,
    },
  });
}
