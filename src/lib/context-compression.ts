/**
 * Context Compression and Purge Utility
 * 
 * Provides intelligent compression and purging of conversation context
 * to optimize token usage and maintain relevant information.
 * 
 * Features:
 * - Summarize old messages while preserving key information
 * - Purge outdated context based on age/relevance
 * - Maintain medical-critical information
 * - Compress repeated information
 */

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  importance?: 'critical' | 'high' | 'medium' | 'low';
  patientId?: string;
  hasClinicalData?: boolean;
}

export interface CompressionResult {
  compressedMessages: ContextMessage[];
  summary: string;
  tokensSaved: number;
  purgedCount: number;
}

export interface CompressionOptions {
  maxMessages?: number;
  maxAgeMs?: number;
  preserveCritical?: boolean;
  preservePatientContext?: boolean;
  targetCompressionRatio?: number;
}

// Default compression settings
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxMessages: 20,
  maxAgeMs: 30 * 60 * 1000, // 30 minutes
  preserveCritical: true,
  preservePatientContext: true,
  targetCompressionRatio: 0.6, // Reduce to 60% of original size
};

// Keywords that indicate critical medical information
const CRITICAL_KEYWORDS = [
  'allergy', 'allergies', 'anaphylaxis', 'contraindication',
  'diagnosis', 'icd-10', 'icd10', 'critical', 'emergency',
  'urgent', 'red flag', 'warning', 'alert', 'severe',
  'life-threatening', 'immediate', 'stat', 'dobutamine',
  'medication', 'drug interaction', 'dosage', 'dose',
  'vitals', 'blood pressure', 'heart rate', 'oxygen',
  'treatment', 'prescription', 'surgery', 'procedure',
];

// Keywords that indicate patient context
const PATIENT_CONTEXT_KEYWORDS = [
  'patient', 'mrn', 'dob', 'date of birth', 'age', 'gender',
  'history', 'condition', 'chronic', 'current medication',
  'allergy', 'family history', 'social history',
];

/**
 * Estimate token count for a string (approximate)
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Check if content contains critical medical information
 */
export function hasCriticalInfo(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return CRITICAL_KEYWORDS.some(keyword => lowerContent.includes(keyword));
}

/**
 * Check if content contains patient context
 */
export function hasPatientContext(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return PATIENT_CONTEXT_KEYWORDS.some(keyword => lowerContent.includes(keyword));
}

/**
 * Determine message importance based on content
 */
export function assessImportance(message: ContextMessage): 'critical' | 'high' | 'medium' | 'low' {
  const content = message.content.toLowerCase();
  
  // Critical: Contains medical alerts, diagnoses, drug interactions
  if (hasCriticalInfo(content)) {
    return 'critical';
  }
  
  // High: Contains patient-specific information
  if (hasPatientContext(content) || message.patientId) {
    return 'high';
  }
  
  // Medium: Assistant responses with clinical data
  if (message.role === 'assistant' && message.hasClinicalData) {
    return 'medium';
  }
  
  // Low: General queries and responses
  return 'low';
}

/**
 * Compress a single message by extracting key information
 */
export function compressMessage(message: ContextMessage): string {
  const content = message.content;
  
  // If already short, return as-is
  if (content.length < 200) {
    return content;
  }
  
  // Extract key sentences (those containing important keywords)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const importantSentences: string[] = [];
  const otherSentences: string[] = [];
  
  for (const sentence of sentences) {
    if (hasCriticalInfo(sentence) || hasPatientContext(sentence)) {
      importantSentences.push(sentence.trim());
    } else {
      otherSentences.push(sentence.trim());
    }
  }
  
  // If we found important sentences, prioritize them
  if (importantSentences.length > 0) {
    // Keep all important sentences + first sentence for context
    const firstSentence = sentences[0]?.trim();
    const result = firstSentence && !importantSentences.includes(firstSentence)
      ? [firstSentence, ...importantSentences]
      : importantSentences;
    return result.join('. ') + '.';
  }
  
  // Otherwise, take first and last sentences as summary
  if (sentences.length > 2) {
    return `${sentences[0].trim()}. [${sentences.length - 2} sentences omitted] ${sentences[sentences.length - 1].trim()}.`;
  }
  
  return content;
}

/**
 * Generate a summary from multiple messages
 */
export function generateSummary(messages: ContextMessage[]): string {
  const keyPoints: string[] = [];
  const diagnoses: string[] = [];
  const medications: string[] = [];
  const alerts: string[] = [];
  
  for (const message of messages) {
    const content = message.content;
    
    // Extract diagnoses (ICD-10 codes)
    const icdMatches = content.match(/[A-Z]\d{2}(\.\d+)?/g);
    if (icdMatches) {
      diagnoses.push(...icdMatches);
    }
    
    // Extract medication mentions
    const medPatterns = [
      /prescribed?\s+(\w+)/gi,
      /medication:\s*(\w+)/gi,
      /taking\s+(\w+)/gi,
    ];
    for (const pattern of medPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) medications.push(match[1]);
      }
    }
    
    // Extract alerts/warnings
    if (content.toLowerCase().includes('alert') || 
        content.toLowerCase().includes('warning') ||
        content.toLowerCase().includes('critical')) {
      alerts.push(content.slice(0, 100));
    }
  }
  
  // Build summary
  const summaryParts: string[] = [];
  
  if (diagnoses.length > 0) {
    summaryParts.push(`Diagnoses discussed: ${[...new Set(diagnoses)].slice(0, 5).join(', ')}`);
  }
  
  if (medications.length > 0) {
    summaryParts.push(`Medications: ${[...new Set(medications)].slice(0, 5).join(', ')}`);
  }
  
  if (alerts.length > 0) {
    summaryParts.push(`Alerts: ${alerts.length} clinical alerts raised`);
  }
  
  if (summaryParts.length === 0) {
    summaryParts.push(`${messages.length} messages in conversation history`);
  }
  
  return `[CONTEXT SUMMARY] ${summaryParts.join('. ')}.`;
}

/**
 * Main compression function
 * Compresses message history while preserving critical information
 */
export function compressContext(
  messages: ContextMessage[],
  options: CompressionOptions = {}
): CompressionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = Date.now();
  let tokensSaved = 0;
  let purgedCount = 0;
  
  // Assess importance for each message
  const assessedMessages = messages.map(msg => ({
    ...msg,
    importance: assessImportance(msg),
    tokenCount: msg.tokenCount || estimateTokens(msg.content),
    hasClinicalData: hasCriticalInfo(msg.content),
  }));
  
  // Separate messages by handling strategy
  const criticalMessages: ContextMessage[] = [];
  const recentMessages: ContextMessage[] = [];
  const oldMessages: ContextMessage[] = [];
  
  for (const msg of assessedMessages) {
    const age = now - new Date(msg.timestamp).getTime();
    
    if (msg.importance === 'critical' && opts.preserveCritical) {
      criticalMessages.push(msg);
    } else if (age < opts.maxAgeMs) {
      recentMessages.push(msg);
    } else {
      oldMessages.push(msg);
    }
  }
  
  // Process old messages: compress or purge
  const compressedOldMessages: ContextMessage[] = [];
  
  if (oldMessages.length > 0) {
    // Create a summary of old messages
    const summary = generateSummary(oldMessages);
    const summaryTokens = estimateTokens(summary);
    const originalTokens = oldMessages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
    
    // Only add summary if it saves tokens
    if (summaryTokens < originalTokens * 0.5) {
      compressedOldMessages.push({
        id: `summary-${Date.now()}`,
        role: 'system',
        content: summary,
        timestamp: new Date(),
        tokenCount: summaryTokens,
        importance: 'medium',
      });
      tokensSaved += originalTokens - summaryTokens;
      purgedCount = oldMessages.length - 1;
    }
  }
  
  // Combine and limit messages
  let finalMessages = [...criticalMessages, ...compressedOldMessages, ...recentMessages];
  
  // If still too many messages, trim oldest non-critical
  if (finalMessages.length > opts.maxMessages) {
    const toRemove = finalMessages.length - opts.maxMessages;
    const nonCritical = finalMessages.filter(m => m.importance !== 'critical');
    
    if (nonCritical.length >= toRemove) {
      // Remove oldest non-critical messages
      const removedTokens = nonCritical
        .slice(0, toRemove)
        .reduce((sum, m) => sum + (m.tokenCount || 0), 0);
      tokensSaved += removedTokens;
      purgedCount += toRemove;
      
      finalMessages = [
        ...criticalMessages,
        ...finalMessages.filter(m => m.importance !== 'critical').slice(toRemove),
      ];
    }
  }
  
  // Sort by timestamp
  finalMessages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  return {
    compressedMessages: finalMessages,
    summary: generateSummary(oldMessages),
    tokensSaved,
    purgedCount,
  };
}

/**
 * Purge old conversation history from database
 */
export async function purgeOldConversations(
  prismaClient: any,
  options: {
    olderThanDays?: number;
    keepPatientRelated?: boolean;
    keepCriticalInteractions?: boolean;
  } = {}
): Promise<{ purged: number; retained: number }> {
  const {
    olderThanDays = 30,
    keepPatientRelated = true,
    keepCriticalInteractions = true,
  } = options;
  
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  let purged = 0;
  let retained = 0;
  
  try {
    // Get old interactions
    const oldInteractions = await prismaClient.aIInteraction.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        patientId: true,
        interactionType: true,
        prompt: true,
        response: true,
      },
    });
    
    for (const interaction of oldInteractions) {
      const hasPatient = !!interaction.patientId;
      const hasCritical = hasCriticalInfo(interaction.prompt) || 
                          hasCriticalInfo(interaction.response || '');
      
      // Decide whether to keep or purge
      const shouldKeep = (keepPatientRelated && hasPatient) || 
                         (keepCriticalInteractions && hasCritical);
      
      if (shouldKeep) {
        retained++;
      } else {
        // Delete the interaction
        await prismaClient.aIInteraction.delete({
          where: { id: interaction.id },
        });
        purged++;
      }
    }
    
    // Also purge old RAG queries without patient association
    const deletedRagQueries = await prismaClient.rAGQuery.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        patientId: null,
      },
    });
    
    purged += deletedRagQueries.count;
    
    return { purged, retained };
  } catch (error) {
    console.error('Error purging old conversations:', error);
    throw error;
  }
}

/**
 * Schedule periodic context compression
 */
export function scheduleCompression(
  callback: () => Promise<void>,
  intervalMs: number = 60 * 60 * 1000 // Default: 1 hour
): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await callback();
    } catch (error) {
      console.error('Scheduled compression error:', error);
    }
  }, intervalMs);
}

export default {
  compressContext,
  compressMessage,
  generateSummary,
  estimateTokens,
  hasCriticalInfo,
  hasPatientContext,
  assessImportance,
  purgeOldConversations,
  scheduleCompression,
  CRITICAL_KEYWORDS,
  PATIENT_CONTEXT_KEYWORDS,
};
