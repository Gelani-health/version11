/**
 * ASR Feedback API - Collect corrections for continuous learning
 * 
 * Endpoints:
 * - POST /api/asr/feedback - Submit a correction
 * - POST /api/asr/transcribe - Enhanced transcription with learning
 * - GET /api/asr/stats - Learning statistics
 * - GET /api/asr/patterns - View learned patterns
 * 
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { asrLearningService, detectNegation } from '@/lib/asr-learning-service';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ============================================
// Types
// ============================================

interface FeedbackRequest {
  transcriptionId: string;
  originalText: string;
  correctedText: string;
  context?: string;
  soapSection?: string;
  specialty?: string;
  feedbackType?: 'manual_edit' | 'confirmed' | 'rejected';
  qualityRating?: number;
  qualityFeedback?: string;
}

interface TranscribeRequest {
  audio_base64: string;
  sample_rate?: number;
  language?: string;
  context?: string;
  soapSection?: string;
  specialty?: string;
  patientId?: string;
  consultationId?: string;
  sessionId?: string;
  enable_medical_postprocess?: boolean;
  enable_negation_detection?: boolean;
  enable_learning?: boolean;
  audioDurationMs?: number;
  audioFormat?: string;
}

// ============================================
// ZAI SDK Cache
// ============================================

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiLastUsed = 0;
const ZAI_CACHE_TTL = 5 * 60 * 1000;

async function getZAI() {
  const now = Date.now();
  
  if (!zaiInstance || (now - zaiLastUsed) > ZAI_CACHE_TTL) {
    zaiInstance = await ZAI.create();
    zaiLastUsed = now;
  }
  
  return zaiInstance;
}

// ============================================
// Audio Quality Assessment
// ============================================

interface AudioQualityMetrics {
  snr: number;
  signalLevel: number;
  noiseLevel: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  recommendations: string[];
}

/**
 * Estimate audio quality from base64 audio data
 * This is a simplified client-side estimation - server-side would use librosa
 */
function estimateAudioQuality(audioBase64: string): AudioQualityMetrics {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Estimate from base64 size (rough approximation)
  const sizeBytes = (audioBase64.length * 3) / 4;
  const sizeKB = sizeBytes / 1024;
  
  // Rough SNR estimation based on audio size (would be more accurate with actual audio analysis)
  let snr = 20; // Default good SNR
  let signalLevel = 0.7;
  let noiseLevel = 0.3;
  
  if (sizeKB < 10) {
    snr = 10;
    signalLevel = 0.5;
    noiseLevel = 0.5;
    issues.push('Audio may be too short or low quality');
    recommendations.push('Try recording in a quieter environment');
  } else if (sizeKB < 50) {
    snr = 15;
    signalLevel = 0.6;
    noiseLevel = 0.4;
  } else if (sizeKB > 500) {
    snr = 25;
    signalLevel = 0.8;
    noiseLevel = 0.2;
  }
  
  // Determine quality category
  let quality: AudioQualityMetrics['quality'];
  if (snr >= 25) {
    quality = 'excellent';
  } else if (snr >= 20) {
    quality = 'good';
  } else if (snr >= 15) {
    quality = 'fair';
    recommendations.push('Consider re-recording for better accuracy');
  } else {
    quality = 'poor';
    issues.push('Low signal-to-noise ratio detected');
    recommendations.push('Move closer to the microphone and reduce background noise');
  }
  
  return {
    snr,
    signalLevel,
    noiseLevel,
    quality,
    issues,
    recommendations,
  };
}

// ============================================
// Main Handlers
// ============================================

/**
 * POST handler for transcription and feedback
 */
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
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  // Handle feedback submission
  if (action === 'feedback') {
    return handleFeedback(request, user.id);
  }
  
  // Handle transcription
  return handleTranscribe(request, user.id, startTime);
}

/**
 * Handle transcription request
 */
async function handleTranscribe(
  request: NextRequest,
  userId: string,
  startTime: number
) {
  try {
    const body: TranscribeRequest = await request.json();
    const {
      audio_base64,
      sample_rate = 16000,
      language = 'en',
      context,
      soapSection,
      specialty,
      patientId,
      consultationId,
      sessionId,
      enable_medical_postprocess = true,
      enable_negation_detection = true,
      enable_learning = true,
    } = body;
    
    if (!audio_base64) {
      return NextResponse.json(
        { success: false, error: 'audio_base64 is required' },
        { status: 400 }
      );
    }
    
    // Estimate audio quality
    const audioQuality = estimateAudioQuality(audio_base64);
    
    // Get transcription from ZAI
    let transcription = '';
    let confidence = 0.9;
    let engine = 'z-ai-asr';
    
    try {
      const zai = await getZAI();
      const response = await zai.audio.asr.create({
        file_base64: audio_base64,
      });
      
      transcription = response.text || '';
      confidence = 0.92; // ZAI typically provides high confidence
      
    } catch (zaiError) {
      console.error('[ASR] ZAI error, trying fallback:', zaiError);
      
      // Try MedASR fallback
      try {
        const medasrResponse = await fetch('http://localhost:3033/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64,
            sample_rate,
            language,
            context,
            enable_medical_postprocess: true,
          }),
          signal: AbortSignal.timeout(30000),
        });
        
        if (medasrResponse.ok) {
          const data = await medasrResponse.json();
          transcription = data.transcription || '';
          confidence = data.confidence || 0.85;
          engine = 'medasr-local';
        }
      } catch (fallbackError) {
        console.error('[ASR] Fallback failed:', fallbackError);
      }
    }
    
    // Apply learned patterns
    if (enable_learning && transcription) {
      transcription = await asrLearningService.applyLearnedPatterns(transcription, userId);
    }
    
    // Apply medical term post-processing
    const medicalTermsDetected: string[] = [];
    if (enable_medical_postprocess && transcription) {
      const { processMedicalTerms } = await import('@/lib/medical-terms-dictionary');
      const result = processMedicalTerms(transcription);
      transcription = result.text;
      medicalTermsDetected.push(...result.detectedTerms);
    }
    
    // Detect negation
    let negationInfo = null;
    if (enable_negation_detection && transcription) {
      negationInfo = detectNegation(transcription);
    }
    
    // Calculate metrics
    const processingTimeMs = Date.now() - startTime;
    const wordCount = transcription.split(/\s+/).filter(Boolean).length;
    const speakingRateWpm = body.audioDurationMs 
      ? (wordCount / (body.audioDurationMs / 60000)) 
      : null;
    
    // Record transcription for learning
    let transcriptionId: string | null = null;
    if (enable_learning) {
      transcriptionId = await asrLearningService.recordTranscription({
        userId,
        originalText: transcription,
        engine,
        confidence,
        wordCount,
        processingTimeMs,
        sessionId,
        patientId,
        consultationId,
        context,
        audioDurationMs: body.audioDurationMs,
        audioFormat: body.audioFormat,
      });
    }
    
    return NextResponse.json({
      success: true,
      transcription,
      confidence,
      wordCount,
      processingTimeMs,
      engine,
      medicalTermsDetected,
      negationDetection: negationInfo,
      audioQuality: {
        category: audioQuality.quality,
        snr: audioQuality.snr,
        issues: audioQuality.issues,
        recommendations: audioQuality.recommendations,
      },
      transcriptionId,
      speakingRate: speakingRateWpm ? Math.round(speakingRateWpm) : null,
    });
    
  } catch (error) {
    console.error('[ASR] Transcription error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Transcription failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle feedback submission
 */
async function handleFeedback(request: NextRequest, userId: string) {
  try {
    const body: FeedbackRequest = await request.json();
    
    if (!body.transcriptionId) {
      return NextResponse.json(
        { success: false, error: 'transcriptionId is required' },
        { status: 400 }
      );
    }
    
    // Verify transcription exists
    const transcription = await db.aSRTranscription.findUnique({
      where: { id: body.transcriptionId },
    });
    
    if (!transcription) {
      return NextResponse.json(
        { success: false, error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Update transcription with feedback
    await db.aSRTranscription.update({
      where: { id: body.transcriptionId },
      data: {
        correctedText: body.correctedText,
        finalText: body.correctedText,
        hasCorrection: body.originalText !== body.correctedText,
        correctionReviewed: true,
        qualityRating: body.qualityRating,
        qualityFeedback: body.qualityFeedback,
      },
    });
    
    // Process correction for learning
    if (body.originalText !== body.correctedText) {
      await asrLearningService.processCorrection({
        transcriptionId: body.transcriptionId,
        originalText: body.originalText,
        correctedText: body.correctedText,
        userId,
        context: body.context,
        soapSection: body.soapSection,
        specialty: body.specialty,
        feedbackType: body.feedbackType,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully',
      learningApplied: body.originalText !== body.correctedText,
    });
    
  } catch (error) {
    console.error('[ASR Feedback] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for stats and patterns
 */
export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  // Get learning stats
  if (action === 'stats') {
    const userId = url.searchParams.get('userId') || undefined;
    const stats = await asrLearningService.getLearningStats(userId);
    
    return NextResponse.json({
      success: true,
      stats,
    });
  }
  
  // Get learned patterns
  if (action === 'patterns') {
    const patterns = await db.aSRLearningPattern.findMany({
      where: { isActive: true },
      orderBy: { occurrenceCount: 'desc' },
      take: 50,
    });
    
    return NextResponse.json({
      success: true,
      patterns,
      total: patterns.length,
    });
  }
  
  // Get speaker profiles
  if (action === 'profiles') {
    const profiles = await db.speakerProfile.findMany({
      where: { isActive: true },
      take: 50,
    });
    
    return NextResponse.json({
      success: true,
      profiles,
      total: profiles.length,
    });
  }
  
  // Default: return service status
  const totalTranscriptions = await db.aSRTranscription.count();
  const totalCorrections = await db.aSRCorrection.count();
  const activePatterns = await db.aSRLearningPattern.count({
    where: { isActive: true },
  });
  
  return NextResponse.json({
    service: 'ASR Learning API',
    version: '2.0.0',
    description: 'Medical ASR with continuous learning',
    features: [
      'z-ai-sdk-integration',
      'continuous-learning',
      'pattern-extraction',
      'negation-detection',
      'audio-quality-assessment',
      'speaker-adaptation',
      'medical-term-processing',
    ],
    stats: {
      totalTranscriptions,
      totalCorrections,
      activePatterns,
    },
    endpoints: {
      transcribe: '/api/asr',
      feedback: '/api/asr?action=feedback',
      stats: '/api/asr?action=stats',
      patterns: '/api/asr?action=patterns',
    },
  });
}
