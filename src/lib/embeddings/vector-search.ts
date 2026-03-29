/**
 * Vector Search Engine for Medical RAG
 * 
 * This service provides:
 * - Semantic search using vector embeddings
 * - Hybrid search (vector + keyword)
 * - Knowledge base indexing
 * - Similarity scoring
 */

import { db } from '@/lib/db';
import { 
  generateEmbedding, 
  cosineSimilarity, 
  EMBEDDING_DIMENSION 
} from './service';

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  subcategory: string | null;
  specialty: string | null;
  similarity: number;
  keywordScore: number;
  combinedScore: number;
  source: string | null;
  evidenceLevel: string | null;
}

export interface DrugInteractionSearchResult {
  id: string;
  drug1Name: string;
  drug2Name: string;
  severity: string;
  description: string;
  management: string | null;
  similarity: number;
}

export interface SymptomSearchResult {
  id: string;
  symptomName: string;
  conditions: Array<{
    condition: string;
    icdCode: string;
    probability: number;
    urgency: string;
  }>;
  riskFactors: string[];
  similarity: number;
}

/**
 * Generate content hash for cache validation
 */
function generateContentHash(content: string): string {
  let hash = 0;
  const normalized = content.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Store embedding for a knowledge entry
 */
export async function storeKnowledgeEmbedding(knowledgeId: string): Promise<void> {
  const knowledge = await db.healthcareKnowledge.findUnique({
    where: { id: knowledgeId },
  });
  
  if (!knowledge) {
    throw new Error(`Knowledge entry not found: ${knowledgeId}`);
  }
  
  // Generate embedding from title + content
  const textForEmbedding = `${knowledge.title}\n\n${knowledge.content}`;
  const embedding = await generateEmbedding(textForEmbedding);
  const contentHash = generateContentHash(textForEmbedding);
  
  // Store in knowledge entry
  await db.healthcareKnowledge.update({
    where: { id: knowledgeId },
    data: {
      embedding: JSON.stringify(embedding),
      embeddingHash: contentHash,
      embeddingModel: 'semantic-v1',
    },
  });
  
  // Also cache in embedding cache
  await db.embeddingCache.upsert({
    where: { contentHash },
    create: {
      contentHash,
      contentType: 'healthcare-knowledge',
      contentId: knowledgeId,
      embedding: JSON.stringify(embedding),
      contentLength: textForEmbedding.length,
    },
    update: {
      embedding: JSON.stringify(embedding),
      contentLength: textForEmbedding.length,
      lastAccessed: new Date(),
    },
  });
}

/**
 * Generate embeddings for all knowledge entries (batch processing)
 */
export async function generateAllKnowledgeEmbeddings(
  onProgress?: (current: number, total: number) => void
): Promise<{ total: number; updated: number; errors: string[] }> {
  const knowledge = await db.healthcareKnowledge.findMany({
    where: { isActive: true },
    select: { id: true, title: true, content: true, embeddingHash: true },
  });
  
  const result = { total: knowledge.length, updated: 0, errors: [] as string[] };
  
  for (let i = 0; i < knowledge.length; i++) {
    const k = knowledge[i];
    
    try {
      const textForEmbedding = `${k.title}\n\n${k.content}`;
      const contentHash = generateContentHash(textForEmbedding);
      
      // Skip if embedding already exists and content hasn't changed
      if (k.embeddingHash === contentHash) {
        if (onProgress) onProgress(i + 1, knowledge.length);
        continue;
      }
      
      await storeKnowledgeEmbedding(k.id);
      result.updated++;
      
      if (onProgress) onProgress(i + 1, knowledge.length);
    } catch (error) {
      result.errors.push(`Failed to embed ${k.id}: ${error}`);
    }
  }
  
  return result;
}

/**
 * Calculate keyword score for hybrid search
 */
function calculateKeywordScore(query: string, knowledge: {
  title: string;
  content: string;
  keywords: string | null;
  drugNames: string | null;
  icdCodes: string | null;
}): number {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  let score = 0;
  
  // Title matching (high weight)
  const titleWords = knowledge.title.toLowerCase().split(/\s+/);
  const titleMatches = queryWords.filter(qw => 
    titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );
  score += (titleMatches.length / Math.max(queryWords.length, 1)) * 0.4;
  
  // Keywords matching
  if (knowledge.keywords) {
    try {
      const keywords = JSON.parse(knowledge.keywords) as string[];
      const keywordMatches = keywords.filter(kw => 
        queryLower.includes(kw.toLowerCase())
      );
      score += (keywordMatches.length / Math.max(keywords.length, 1)) * 0.3;
    } catch {}
  }
  
  // Drug names matching
  if (knowledge.drugNames) {
    try {
      const drugs = JSON.parse(knowledge.drugNames) as string[];
      const drugMatches = drugs.filter(drug => 
        queryLower.includes(drug.toLowerCase())
      );
      score += (drugMatches.length / Math.max(drugs.length, 1)) * 0.2;
    } catch {}
  }
  
  // ICD codes matching
  if (knowledge.icdCodes) {
    try {
      const codes = JSON.parse(knowledge.icdCodes) as string[];
      const codeMatches = codes.filter(code => 
        queryLower.includes(code.toLowerCase())
      );
      score += codeMatches.length * 0.1;
    } catch {}
  }
  
  // Content word overlap
  const contentLower = knowledge.content.toLowerCase();
  const contentMatches = queryWords.filter(w => contentLower.includes(w));
  score += (contentMatches.length / Math.max(queryWords.length, 1)) * 0.1;
  
  return Math.min(score, 1.0);
}

/**
 * Semantic search for healthcare knowledge
 */
export async function semanticKnowledgeSearch(
  query: string,
  options: {
    limit?: number;
    threshold?: number;
    category?: string;
    specialty?: string;
    vectorWeight?: number;
    keywordWeight?: number;
  } = {}
): Promise<KnowledgeSearchResult[]> {
  const {
    limit = 5,
    threshold = 0.1,
    category,
    specialty,
    vectorWeight = 0.7,
    keywordWeight = 0.3,
  } = options;
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Build filter
  const where: any = { isActive: true };
  if (category) where.category = category;
  if (specialty) where.specialty = specialty;
  
  // Fetch all matching knowledge entries
  const allKnowledge = await db.healthcareKnowledge.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      category: true,
      subcategory: true,
      specialty: true,
      source: true,
      evidenceLevel: true,
      keywords: true,
      drugNames: true,
      icdCodes: true,
      embedding: true,
    },
  });
  
  // Calculate scores
  const results = allKnowledge.map(k => {
    // Vector similarity
    let vectorSimilarity = 0;
    if (k.embedding) {
      try {
        const storedEmbedding = JSON.parse(k.embedding) as number[];
        vectorSimilarity = cosineSimilarity(queryEmbedding, storedEmbedding);
      } catch {}
    }
    
    // Keyword score
    const keywordScore = calculateKeywordScore(query, k);
    
    // Combined score
    const combinedScore = (vectorSimilarity * vectorWeight) + (keywordScore * keywordWeight);
    
    return {
      id: k.id,
      title: k.title,
      content: k.content,
      summary: k.summary,
      category: k.category,
      subcategory: k.subcategory,
      specialty: k.specialty,
      similarity: vectorSimilarity,
      keywordScore,
      combinedScore,
      source: k.source,
      evidenceLevel: k.evidenceLevel,
    };
  });
  
  // Filter by threshold and sort
  return results
    .filter(r => r.combinedScore >= threshold)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
}

/**
 * Search for drug interactions using semantic search
 */
export async function semanticDrugInteractionSearch(
  drug1: string,
  drug2?: string,
  options: { limit?: number; threshold?: number } = {}
): Promise<DrugInteractionSearchResult[]> {
  const { limit = 10, threshold = 0.1 } = options;
  
  // Build query for embedding
  const query = drug2 
    ? `${drug1} ${drug2} drug interaction`
    : `${drug1} drug interactions`;
  
  const queryEmbedding = await generateEmbedding(query);
  
  // Fetch all drug interactions
  const where: any = { isActive: true };
  const drug1Lower = drug1.toLowerCase();
  
  // Search for the specific drug
  const allInteractions = await db.drugInteractionKnowledge.findMany({
    where: {
      isActive: true,
      OR: [
        { drug1Name: { contains: drug1Lower } },
        { drug1Generic: { contains: drug1Lower } },
        { drug2Name: { contains: drug1Lower } },
        { drug2Generic: { contains: drug1Lower } },
      ],
    },
  });
  
  // If drug2 is specified, filter for interactions between both drugs
  let filteredInteractions = allInteractions;
  if (drug2) {
    const drug2Lower = drug2.toLowerCase();
    filteredInteractions = allInteractions.filter(i =>
      i.drug1Name.toLowerCase().includes(drug2Lower) ||
      i.drug1Generic?.toLowerCase().includes(drug2Lower) ||
      i.drug2Name.toLowerCase().includes(drug2Lower) ||
      i.drug2Generic?.toLowerCase().includes(drug2Lower)
    );
  }
  
  // Calculate similarity scores
  const results = filteredInteractions.map(i => {
    let similarity = 0;
    if (i.embedding) {
      try {
        const storedEmbedding = JSON.parse(i.embedding) as number[];
        similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
      } catch {}
    }
    
    // Boost score for exact drug matches
    const exactMatchBonus = 
      (i.drug1Name.toLowerCase() === drug1Lower || i.drug1Generic?.toLowerCase() === drug1Lower ? 0.1 : 0) +
      (drug2 && (i.drug2Name.toLowerCase() === drug2.toLowerCase().toLowerCase() || 
        i.drug2Generic?.toLowerCase() === drug2.toLowerCase().toLowerCase()) ? 0.1 : 0);
    
    return {
      id: i.id,
      drug1Name: i.drug1Name,
      drug2Name: i.drug2Name,
      severity: i.severity,
      description: i.description,
      management: i.management,
      similarity: similarity + exactMatchBonus,
    };
  });
  
  return results
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Search for symptom-condition mappings using semantic search
 */
export async function semanticSymptomSearch(
  symptom: string,
  options: { limit?: number; threshold?: number } = {}
): Promise<SymptomSearchResult[]> {
  const { limit = 5, threshold = 0.1 } = options;
  
  const queryEmbedding = await generateEmbedding(symptom);
  
  const allMappings = await db.symptomConditionMapping.findMany({
    where: { isActive: true },
  });
  
  const results = allMappings.map(m => {
    // Calculate similarity based on symptom name
    const symptomText = `${m.symptomName} ${m.symptomCategory || ''}`;
    let similarity = 0;
    
    // Simple text matching for symptom name
    const symptomLower = symptom.toLowerCase();
    if (m.symptomName.toLowerCase().includes(symptomLower) || 
        symptomLower.includes(m.symptomName.toLowerCase())) {
      similarity = 0.9;
    }
    
    return {
      id: m.id,
      symptomName: m.symptomName,
      conditions: JSON.parse(m.conditions),
      riskFactors: m.riskFactors ? JSON.parse(m.riskFactors) : [],
      similarity,
    };
  });
  
  return results
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Comprehensive RAG search combining all knowledge sources
 */
export async function comprehensiveRAGSearch(
  query: string,
  options: {
    knowledgeLimit?: number;
    drugInteractionLimit?: number;
    symptomLimit?: number;
    threshold?: number;
  } = {}
): Promise<{
  knowledge: KnowledgeSearchResult[];
  drugInteractions: DrugInteractionSearchResult[];
  symptoms: SymptomSearchResult[];
}> {
  const {
    knowledgeLimit = 5,
    drugInteractionLimit = 3,
    symptomLimit = 3,
    threshold = 0.1,
  } = options;
  
  // Extract potential drug names from query
  const drugPatterns = [
    /\b(metformin|lisinopril|aspirin|warfarin|insulin|amoxicillin|azithromycin|prednisone|ibuprofen|acetaminophen|amlodipine|losartan|atenolol|metoprolol|omeprazole|pantoprazole|simvastatin|atorvastatin)\b/gi,
  ];
  
  const drugs: string[] = [];
  for (const pattern of drugPatterns) {
    const matches = query.match(pattern);
    if (matches) {
      drugs.push(...matches.map(d => d.toLowerCase()));
    }
  }
  
  // Extract potential symptoms
  const symptomPatterns = [
    /\b(chest pain|headache|abdominal pain|fever|shortness of breath|cough|fatigue|nausea|vomiting|dizziness|back pain|joint pain)\b/gi,
  ];
  
  const symptoms: string[] = [];
  for (const pattern of symptomPatterns) {
    const matches = query.match(pattern);
    if (matches) {
      symptoms.push(...matches.map(s => s.toLowerCase()));
    }
  }
  
  // Run searches in parallel
  const [knowledge, drugInteractions, symptomResults] = await Promise.all([
    semanticKnowledgeSearch(query, { limit: knowledgeLimit, threshold }),
    drugs.length > 0 
      ? semanticDrugInteractionSearch(drugs[0], drugs[1], { limit: drugInteractionLimit, threshold })
      : Promise.resolve([]),
    symptoms.length > 0
      ? semanticSymptomSearch(symptoms[0], { limit: symptomLimit, threshold })
      : Promise.resolve([]),
  ]);
  
  return {
    knowledge,
    drugInteractions,
    symptoms: symptomResults,
  };
}
