/**
 * ASR Learning Service - Continuous Learning for Medical ASR
 * 
 * This service implements a comprehensive learning system that:
 * - Collects user corrections from transcriptions
 * - Extracts learnable patterns (phonetic, abbreviation, context)
 * - Updates vocabulary and correction rules
 * - Manages speaker profiles for personalization
 * - Tracks quality metrics for continuous improvement
 * 
 * @version 2.0.0
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { processMedicalTerms } from '@/lib/medical-terms-dictionary';

// ============================================
// Types
// ============================================

export interface CorrectionFeedback {
  transcriptionId: string;
  originalText: string;
  correctedText: string;
  userId: string;
  context?: string;
  soapSection?: string;
  specialty?: string;
  feedbackType?: 'manual_edit' | 'confirmed' | 'rejected';
}

export interface ExtractedPattern {
  type: 'substitution' | 'insertion' | 'deletion' | 'reorder';
  original: string;
  corrected: string;
  position: number;
  surroundingContext: string;
  patternType?: 'phonetic' | 'abbreviation' | 'medical-term' | 'context';
}

export interface LearningStats {
  totalTranscriptions: number;
  totalCorrections: number;
  averageConfidence: number;
  medicalTermAccuracy: number;
  topCorrections: Array<{ original: string; corrected: string; count: number }>;
}

export interface SpeakerAdaptation {
  userId: string;
  commonCorrections: Record<string, string>;
  preferredAbbreviations: Record<string, string>;
  avgSpeakingRate: number;
  accentType?: string;
}

// ============================================
// Pattern Extraction
// ============================================

/**
 * Extract learnable patterns from a correction
 */
function extractPatterns(original: string, corrected: string): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = [];
  
  const origWords = original.toLowerCase().split(/\s+/);
  const corrWords = corrected.toLowerCase().split(/\s+/);
  
  // Use dynamic programming to find differences
  const matrix: number[][] = [];
  
  for (let i = 0; i <= origWords.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= corrWords.length; j++) {
      if (i === 0) {
        matrix[i][j] = j;
      } else if (j === 0) {
        matrix[i][j] = i;
      } else if (origWords[i - 1] === corrWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j - 1], // substitution
          matrix[i][j - 1],     // insertion
          matrix[i - 1][j]      // deletion
        );
      }
    }
  }
  
  // Backtrack to find specific changes
  let i = origWords.length;
  let j = corrWords.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === corrWords[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && matrix[i][j] === matrix[i - 1][j - 1] + 1) {
      // Substitution
      const start = Math.max(0, i - 2);
      const end = Math.min(origWords.length, i + 2);
      const context = origWords.slice(start, end).join(' ');
      
      const patternType = classifyPattern(origWords[i - 1], corrWords[j - 1]);
      
      patterns.unshift({
        type: 'substitution',
        original: origWords[i - 1],
        corrected: corrWords[j - 1],
        position: i - 1,
        surroundingContext: context,
        patternType,
      });
      
      i--;
      j--;
    } else if (j > 0 && matrix[i][j] === matrix[i][j - 1] + 1) {
      // Insertion
      patterns.unshift({
        type: 'insertion',
        original: '',
        corrected: corrWords[j - 1],
        position: i,
        surroundingContext: origWords.slice(Math.max(0, i - 2), i + 2).join(' '),
      });
      j--;
    } else if (i > 0 && matrix[i][j] === matrix[i - 1][j] + 1) {
      // Deletion
      patterns.unshift({
        type: 'deletion',
        original: origWords[i - 1],
        corrected: '',
        position: i - 1,
        surroundingContext: origWords.slice(Math.max(0, i - 2), i + 2).join(' '),
      });
      i--;
    } else {
      break;
    }
  }
  
  return patterns;
}

/**
 * Classify the type of correction pattern
 */
function classifyPattern(original: string, corrected: string): ExtractedPattern['patternType'] {
  // Check for phonetic similarity (same length, similar sounds)
  if (original.length === corrected.length && phoneticSimilarity(original, corrected) > 0.5) {
    return 'phonetic';
  }
  
  // Check for abbreviation expansion
  if (original.length < corrected.length && isAbbreviation(original, corrected)) {
    return 'abbreviation';
  }
  
  // Check for medical term correction
  const medicalTerms = processMedicalTerms(corrected);
  if (medicalTerms.detectedTerms.length > 0) {
    return 'medical-term';
  }
  
  return 'context';
}

/**
 * Calculate phonetic similarity between two words
 */
function phoneticSimilarity(word1: string, word2: string): number {
  // Simple phonetic similarity based on common sounds
  const phoneticGroups: string[][] = [
    ['a', 'e', 'i', 'o', 'u'],
    ['b', 'p'],
    ['c', 'k', 's'],
    ['d', 't'],
    ['f', 'v'],
    ['g', 'j'],
    ['m', 'n'],
    ['s', 'z'],
  ];
  
  let similar = 0;
  const maxLen = Math.max(word1.length, word2.length);
  
  for (let i = 0; i < Math.min(word1.length, word2.length); i++) {
    const c1 = word1[i];
    const c2 = word2[i];
    
    if (c1 === c2) {
      similar += 1;
    } else {
      // Check if they're in the same phonetic group
      for (const group of phoneticGroups) {
        if (group.includes(c1) && group.includes(c2)) {
          similar += 0.5;
          break;
        }
      }
    }
  }
  
  return similar / maxLen;
}

/**
 * Check if original is an abbreviation of corrected
 */
function isAbbreviation(original: string, corrected: string): boolean {
  const abbreviations: Record<string, string> = {
    'bid': 'twice daily',
    'tid': 'three times daily',
    'qid': 'four times daily',
    'prn': 'as needed',
    'qd': 'once daily',
    'hs': 'at bedtime',
    'po': 'by mouth',
    'iv': 'intravenous',
    'im': 'intramuscular',
    'sc': 'subcutaneous',
    'npo': 'nothing by mouth',
    'stat': 'immediately',
    'bp': 'blood pressure',
    'hr': 'heart rate',
    'rr': 'respiratory rate',
    'temp': 'temperature',
  };
  
  const lowerOriginal = original.toLowerCase();
  const lowerCorrected = corrected.toLowerCase();
  
  // Check if it's a known abbreviation
  if (abbreviations[lowerOriginal] === lowerCorrected) {
    return true;
  }
  
  // Check if original is initials of corrected words
  const correctedWords = lowerCorrected.split(/\s+/);
  const initials = correctedWords.map(w => w[0]).join('');
  
  return initials === lowerOriginal;
}

// ============================================
// Negation Detection
// ============================================

const NEGATION_INDICATORS = [
  'no', 'not', 'never', 'none', 'nobody', 'nothing', 'nowhere',
  'without', 'lacks', 'denies', 'denied', 'negative for',
  'absence of', 'no evidence of', 'no history of', 'no signs of',
  'free of', 'rule out', 'r/o', 'unlikely', 'ruled out'
];

const NEGATION_SCOPE_TERMINATORS = [
  'but', 'however', 'although', 'except', 'aside from',
  'patient', 'patient\'s', 'family', 'family history'
];

/**
 * Detect negation in medical text
 * Returns entities that are negated
 */
export function detectNegation(text: string): {
  negatedTerms: string[];
  negationPhrases: Array<{ indicator: string; negatedTerm: string }>;
} {
  const negatedTerms: string[] = [];
  const negationPhrases: Array<{ indicator: string; negatedTerm: string }> = [];
  
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Check if this word is a negation indicator
    for (const indicator of NEGATION_INDICATORS) {
      const indicatorWords = indicator.split(' ');
      const match = indicatorWords.every((iw, idx) => words[i + idx] === iw);
      
      if (match) {
        // Find the negated term(s) - typically within next 4 words
        const scope = Math.min(i + indicatorWords.length + 4, words.length);
        
        for (let j = i + indicatorWords.length; j < scope; j++) {
          const potentialTerm = words[j];
          
          // Skip common stopwords
          if (['a', 'an', 'the', 'of', 'for', 'to', 'and', 'or'].includes(potentialTerm)) {
            continue;
          }
          
          // Check for scope terminator
          if (NEGATION_SCOPE_TERMINATORS.includes(potentialTerm)) {
            break;
          }
          
          // Check if it's a medical term
          const medicalResult = processMedicalTerms(potentialTerm);
          if (medicalResult.detectedTerms.length > 0 || isMedicalWord(potentialTerm)) {
            negatedTerms.push(potentialTerm);
            negationPhrases.push({
              indicator,
              negatedTerm: potentialTerm,
            });
            break; // Only negate the first significant term
          }
        }
      }
    }
  }
  
  return { negatedTerms, negationPhrases };
}

/**
 * Check if a word is likely a medical term
 */
function isMedicalWord(word: string): boolean {
  const medicalSuffixes = ['itis', 'osis', 'emia', 'pathy', 'algia', 'ectomy', 'otomy', 'itis'];
  const medicalPrefixes = ['hyper', 'hypo', 'dys', 'poly', 'oligo', 'anti', 'neo'];
  
  const lower = word.toLowerCase();
  
  for (const suffix of medicalSuffixes) {
    if (lower.endsWith(suffix)) return true;
  }
  
  for (const prefix of medicalPrefixes) {
    if (lower.startsWith(prefix)) return true;
  }
  
  return false;
}

// ============================================
// Main Learning Service
// ============================================

class ASRLearningService {
  private correctionBuffer: CorrectionFeedback[] = [];
  private minSamplesForUpdate = 10;
  private flushInterval = 60000; // 1 minute
  
  constructor() {
    // Periodically flush the buffer
    setInterval(() => {
      if (this.correctionBuffer.length >= this.minSamplesForUpdate) {
        this.flushBuffer();
      }
    }, this.flushInterval);
  }
  
  /**
   * Process a user correction
   */
  async processCorrection(feedback: CorrectionFeedback): Promise<void> {
    try {
      // 1. Store the correction in database
      const transcription = await db.aSRTranscription.update({
        where: { id: feedback.transcriptionId },
        data: {
          correctedText: feedback.correctedText,
          finalText: feedback.correctedText,
          hasCorrection: true,
          correctionReviewed: true,
        },
      });
      
      // 2. Extract patterns from the correction
      const patterns = extractPatterns(feedback.originalText, feedback.correctedText);
      
      // 3. Store extracted patterns as corrections
      for (const pattern of patterns) {
        if (pattern.type === 'substitution' && pattern.original && pattern.corrected) {
          await db.aSRCorrection.create({
            data: {
              transcriptionId: feedback.transcriptionId,
              userId: feedback.userId,
              originalText: pattern.original,
              correctedText: pattern.corrected,
              correctionType: pattern.type,
              position: pattern.position,
              patternType: pattern.patternType,
              surroundingContext: pattern.surroundingContext,
              soapSection: feedback.soapSection,
              specialty: feedback.specialty,
            },
          });
        }
      }
      
      // 4. Update user's speaker profile
      await this.updateSpeakerProfile(feedback.userId, patterns);
      
      // 5. Add to buffer for batch learning
      this.correctionBuffer.push(feedback);
      
      // 6. Update vocabulary usage counts
      await this.updateVocabularyUsage(feedback.correctedText);
      
    } catch (error) {
      console.error('[ASR Learning] Error processing correction:', error);
    }
  }
  
  /**
   * Update speaker profile with correction patterns
   */
  private async updateSpeakerProfile(userId: string, patterns: ExtractedPattern[]): Promise<void> {
    try {
      let profile = await db.speakerProfile.findUnique({
        where: { userId },
      });
      
      if (!profile) {
        profile = await db.speakerProfile.create({
          data: { userId },
        });
      }
      
      // Update common corrections
      const commonCorrections: Record<string, string> = profile.commonCorrections 
        ? JSON.parse(profile.commonCorrections) 
        : {};
      
      for (const pattern of patterns) {
        if (pattern.type === 'substitution' && pattern.original && pattern.corrected) {
          const key = pattern.original.toLowerCase();
          commonCorrections[key] = pattern.corrected.toLowerCase();
        }
      }
      
      // Update profile
      await db.speakerProfile.update({
        where: { userId },
        data: {
          commonCorrections: JSON.stringify(commonCorrections),
          correctionsCount: { increment: 1 },
        },
      });
      
    } catch (error) {
      console.error('[ASR Learning] Error updating speaker profile:', error);
    }
  }
  
  /**
   * Update vocabulary usage counts
   */
  private async updateVocabularyUsage(text: string): Promise<void> {
    try {
      const words = text.toLowerCase().split(/\s+/);
      
      for (const word of words) {
        const entry = await db.aSRVocabulary.findFirst({
          where: {
            OR: [
              { term: word },
              { canonicalForm: word },
            ],
          },
        });
        
        if (entry) {
          await db.aSRVocabulary.update({
            where: { id: entry.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }
    } catch (error) {
      console.error('[ASR Learning] Error updating vocabulary usage:', error);
    }
  }
  
  /**
   * Flush the correction buffer and apply learning
   */
  private async flushBuffer(): Promise<void> {
    if (this.correctionBuffer.length === 0) return;
    
    try {
      const buffer = [...this.correctionBuffer];
      this.correctionBuffer = [];
      
      // Group corrections by pattern
      const patternGroups = new Map<string, CorrectionFeedback[]>();
      
      for (const feedback of buffer) {
        const patterns = extractPatterns(feedback.originalText, feedback.correctedText);
        
        for (const pattern of patterns) {
          if (pattern.type === 'substitution') {
            const key = `${pattern.original}|${pattern.corrected}`;
            
            if (!patternGroups.has(key)) {
              patternGroups.set(key, []);
            }
            patternGroups.get(key)!.push(feedback);
          }
        }
      }
      
      // Create or update learning patterns for frequent corrections
      for (const [key, corrections] of patternGroups) {
        if (corrections.length >= 3) {
          const [original, corrected] = key.split('|');
          
          // Check if pattern already exists
          const existing = await db.aSRLearningPattern.findFirst({
            where: {
              originalPattern: original,
              correctedPattern: corrected,
            },
          });
          
          if (existing) {
            await db.aSRLearningPattern.update({
              where: { id: existing.id },
              data: {
                occurrenceCount: { increment: corrections.length },
                lastOccurrence: new Date(),
                successRate: (existing.successRate * existing.occurrenceCount + corrections.length) / 
                            (existing.occurrenceCount + corrections.length),
              },
            });
          } else {
            // Create new pattern
            const patterns = extractPatterns(corrections[0].originalText, corrections[0].correctedText);
            const pattern = patterns.find(p => 
              p.original === original && p.corrected === corrected
            );
            
            await db.aSRLearningPattern.create({
              data: {
                patternType: pattern?.patternType || 'context',
                patternName: `${original} → ${corrected}`,
                originalPattern: original,
                correctedPattern: corrected,
                occurrenceCount: corrections.length,
                successRate: 1.0,
                lastOccurrence: new Date(),
                isActive: true,
              },
            });
          }
        }
      }
      
      console.log(`[ASR Learning] Processed ${buffer.length} corrections, ${patternGroups.size} patterns`);
      
    } catch (error) {
      console.error('[ASR Learning] Error flushing buffer:', error);
    }
  }
  
  /**
   * Get learning statistics
   */
  async getLearningStats(userId?: string): Promise<LearningStats> {
    const whereClause = userId ? { userId } : {};
    
    const [totalTranscriptions, totalCorrections, avgConfidence] = await Promise.all([
      db.aSRTranscription.count(),
      db.aSRCorrection.count(),
      db.aSRTranscription.aggregate({
        _avg: { overallConfidence: true },
      }),
    ]);
    
    // Get top corrections
    const topCorrectionsRaw = await db.aSRCorrection.groupBy({
      by: ['originalText', 'correctedText'],
      _count: true,
      orderBy: { _count: { originalText: 'desc' } },
      take: 10,
    });
    
    return {
      totalTranscriptions,
      totalCorrections,
      averageConfidence: avgConfidence._avg.overallConfidence || 0,
      medicalTermAccuracy: 0, // TODO: Calculate from medical entities
      topCorrections: topCorrectionsRaw.map(c => ({
        original: c.originalText,
        corrected: c.correctedText,
        count: c._count,
      })),
    };
  }
  
  /**
   * Get speaker adaptation for a user
   */
  async getSpeakerAdaptation(userId: string): Promise<SpeakerAdaptation | null> {
    const profile = await db.speakerProfile.findUnique({
      where: { userId },
    });
    
    if (!profile) return null;
    
    return {
      userId: profile.userId,
      commonCorrections: profile.commonCorrections ? JSON.parse(profile.commonCorrections) : {},
      preferredAbbreviations: profile.preferredAbbreviations ? JSON.parse(profile.preferredAbbreviations) : {},
      avgSpeakingRate: profile.avgSpeakingRateWpm || 0,
      accentType: profile.accentType || undefined,
    };
  }
  
  /**
   * Apply learned patterns to improve transcription
   */
  async applyLearnedPatterns(text: string, userId?: string): Promise<string> {
    let improved = text;
    
    // Apply user-specific corrections first
    if (userId) {
      const adaptation = await this.getSpeakerAdaptation(userId);
      
      if (adaptation) {
        for (const [original, corrected] of Object.entries(adaptation.commonCorrections)) {
          const regex = new RegExp(`\\b${escapeRegExp(original)}\\b`, 'gi');
          improved = improved.replace(regex, corrected);
        }
      }
    }
    
    // Apply global learned patterns
    const patterns = await db.aSRLearningPattern.findMany({
      where: {
        isActive: true,
        applyAutomatically: true,
        successRate: { gte: 0.8 },
      },
    });
    
    for (const pattern of patterns) {
      if (pattern.regexPattern) {
        try {
          const regex = new RegExp(pattern.regexPattern, 'gi');
          improved = improved.replace(regex, pattern.correctedPattern);
        } catch {
          // Invalid regex, use simple replacement
          const regex = new RegExp(`\\b${escapeRegExp(pattern.originalPattern)}\\b`, 'gi');
          improved = improved.replace(regex, pattern.correctedPattern);
        }
      } else {
        const regex = new RegExp(`\\b${escapeRegExp(pattern.originalPattern)}\\b`, 'gi');
        improved = improved.replace(regex, pattern.correctedPattern);
      }
    }
    
    // Apply standard medical term processing
    const medicalResult = processMedicalTerms(improved);
    improved = medicalResult.text;
    
    return improved;
  }
  
  /**
   * Record a transcription for learning
   */
  async recordTranscription(data: {
    userId: string;
    originalText: string;
    engine: string;
    confidence: number;
    wordCount: number;
    processingTimeMs: number;
    sessionId?: string;
    patientId?: string;
    consultationId?: string;
    context?: string;
    audioDurationMs?: number;
    audioFormat?: string;
  }): Promise<string> {
    const transcription = await db.aSRTranscription.create({
      data: {
        userId: data.userId,
        originalText: data.originalText,
        engine: data.engine,
        overallConfidence: data.confidence,
        wordCount: data.wordCount,
        processingTimeMs: data.processingTimeMs,
        sessionId: data.sessionId,
        patientId: data.patientId,
        consultationId: data.consultationId,
        context: data.context,
        audioDurationMs: data.audioDurationMs,
        audioFormat: data.audioFormat,
      },
    });
    
    return transcription.id;
  }
}

// ============================================
// Utility Functions
// ============================================

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Export Singleton Instance
// ============================================

export const asrLearningService = new ASRLearningService();
export default asrLearningService;
