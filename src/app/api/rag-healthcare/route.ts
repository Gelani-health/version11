import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { routeLLMRequest } from '@/lib/llm/provider-manager';
import { authenticateRequest } from '@/lib/auth-middleware';
import {
  semanticKnowledgeSearch,
  semanticDrugInteractionSearch,
  semanticSymptomSearch,
  comprehensiveRAGSearch,
  storeKnowledgeEmbedding,
  type KnowledgeSearchResult,
  type DrugInteractionSearchResult,
  type SymptomSearchResult,
} from '@/lib/embeddings/vector-search';
import { generateEmbedding } from '@/lib/embeddings/service';

// RAG Healthcare API - Semantic Search with Vector Embeddings

interface EnhancedKnowledgeResult {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  similarity: number;
  keywordScore: number;
  combinedScore: number;
  source: string | null;
}

// Generate RAG-enhanced AI response
async function generateRAGResponse(
  query: string,
  knowledge: KnowledgeSearchResult[],
  drugInteractions: DrugInteractionSearchResult[],
  symptomResults: SymptomSearchResult[],
  patientContext?: {
    name: string;
    age: number;
    gender: string;
    allergies: string[];
    medications: string[];
    conditions: string[];
  },
  providerId?: string
): Promise<{ response: string; sources: string[]; provider?: string; model?: string }> {
  // Build context from retrieved knowledge
  const knowledgeContext = knowledge
    .map((k, i) => `[${i + 1}] ${k.title} (Relevance: ${Math.round(k.combinedScore * 100)}%):\n${k.content.slice(0, 1500)}`)
    .join('\n\n---\n\n');

  const sources = knowledge.map(k => k.title);

  // Build drug interaction context
  const drugContext = drugInteractions.length > 0
    ? `\n\nDRUG INTERACTIONS IDENTIFIED:\n${drugInteractions.map(di =>
        `- ${di.drug1Name} + ${di.drug2Name}: ${di.severity.toUpperCase()} - ${di.description}`
      ).join('\n')}`
    : '';

  // Build symptom mapping context
  const symptomContext = symptomResults.length > 0
    ? `\n\nDIFFERENTIAL DIAGNOSIS:\n${symptomResults.map(sr =>
        `For "${sr.symptomName}":\n${sr.conditions.slice(0, 5).map(c =>
          `- ${c.condition} (${c.icdCode}): ${Math.round(c.probability * 100)}% probability, ${c.urgency} urgency`
        ).join('\n')}`
      ).join('\n\n')}`
    : '';

  // Build patient context if provided
  const patientInfo = patientContext
    ? `\n\nPATIENT CONTEXT:
- Name: ${patientContext.name}
- Age: ${patientContext.age} years, ${patientContext.gender}
- Allergies: ${patientContext.allergies.length > 0 ? patientContext.allergies.join(', ') : 'None reported'}
- Current Medications: ${patientContext.medications.length > 0 ? patientContext.medications.join(', ') : 'None'}
- Known Conditions: ${patientContext.conditions.length > 0 ? patientContext.conditions.join(', ') : 'None reported'}`
    : '';

  const systemPrompt = `You are an AI Healthcare Assistant with RAG (Retrieval-Augmented Generation) capabilities powered by semantic vector search.
You have access to a medical knowledge base and should use the provided context to give accurate, evidence-based responses.

IMPORTANT GUIDELINES:
1. Always use the provided knowledge context when available
2. Clearly state when information comes from the knowledge base vs general medical knowledge
3. Always recommend consulting a healthcare professional for clinical decisions
4. Be specific about diagnostic criteria, drug dosages, and treatment protocols when available in context
5. Highlight any drug interactions, contraindications, or safety concerns prominently
6. If patient context is provided, tailor recommendations to the specific patient
7. Cite sources from the knowledge base in your response
8. Use the similarity scores to indicate confidence in retrieved information

RESPONSE FORMAT:
- Start with the most relevant finding
- Include specific data from knowledge base (dosages, criteria, etc.)
- List differential diagnoses with probabilities when applicable
- Include red flags or urgent findings to watch for
- End with recommended next steps or when to seek immediate care
- Note the confidence level based on retrieval scores`;

  const userMessage = `QUERY: ${query}

RETRIEVED KNOWLEDGE CONTEXT (Semantic Search Results):
${knowledgeContext || 'No specific knowledge base entries found for this query.'}${drugContext}${symptomContext}${patientInfo}

Please provide a comprehensive clinical response using the available knowledge. Include specific medical information, cite sources from the knowledge base, and provide actionable recommendations. Note the relevance scores for the retrieved information.`;

  try {
    const result = await routeLLMRequest({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      providerId,
      thinking: { type: 'disabled' }
    });

    if (result.success && result.content) {
      return {
        response: result.content,
        sources,
        provider: result.provider,
        model: result.model
      };
    }

    throw new Error(result.error || 'Failed to generate response');
  } catch (error) {
    console.error('LLM Error:', error);

    // Fallback response with knowledge
    if (knowledge.length > 0) {
      const fallbackResponse = `Based on the medical knowledge base (Semantic Search Results):\n\n` +
        knowledge.map(k => `**${k.title}** (${Math.round(k.combinedScore * 100)}% relevance)\n${k.summary || k.content.slice(0, 800)}...`).join('\n\n') +
        `\n\n*Note: AI generation failed. This is a direct knowledge base retrieval using semantic search. Please consult a healthcare professional for clinical decisions.*`;
      return { response: fallbackResponse, sources };
    }

    return {
      response: 'I apologize, but I encountered an error processing your query. Please try again or consult a healthcare professional directly.',
      sources: []
    };
  }
}

// Log RAG query for analytics
async function logRAGQuery(
  query: string,
  queryType: string,
  knowledgeIds: string[],
  responseTime: number,
  aiResponse: string,
  patientId?: string,
  consultationId?: string
) {
  try {
    await db.rAGQuery.create({
      data: {
        queryText: query,
        queryType,
        knowledgeIds: JSON.stringify(knowledgeIds),
        retrievalCount: knowledgeIds.length,
        responseTime,
        aiResponse,
        patientId,
        consultationId,
      },
    });

    if (patientId) {
      await db.aIInteraction.create({
        data: {
          patientId,
          consultationId,
          interactionType: 'rag-healthcare-vector',
          prompt: query,
          response: aiResponse,
          modelUsed: 'semantic-rag-v1',
          processingTime: responseTime,
        },
      });
    }
  } catch (e) {
    console.error('Failed to log RAG query:', e);
  }
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

  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      query,
      queryType = 'text',
      patientContext,
      drugCheck,
      symptomCheck,
      consultationId,
      providerId,
      searchMode = 'comprehensive', // 'comprehensive', 'knowledge', 'drug', 'symptom'
    } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    let knowledge: KnowledgeSearchResult[] = [];
    let drugInteractions: DrugInteractionSearchResult[] = [];
    let symptomResults: SymptomSearchResult[] = [];

    // Perform semantic search based on mode
    if (searchMode === 'comprehensive') {
      // Comprehensive search across all knowledge sources
      const results = await comprehensiveRAGSearch(query, {
        knowledgeLimit: 5,
        drugInteractionLimit: 3,
        symptomLimit: 3,
        threshold: 0.1,
      });
      knowledge = results.knowledge;
      drugInteractions = results.drugInteractions;
      symptomResults = results.symptoms;
    } else if (searchMode === 'drug' || drugCheck?.drug1) {
      // Drug-focused search
      drugInteractions = await semanticDrugInteractionSearch(
        drugCheck?.drug1 || query,
        drugCheck?.drug2,
        { limit: 5, threshold: 0.05 }
      );
      knowledge = await semanticKnowledgeSearch(query, { limit: 3 });
    } else if (searchMode === 'symptom' || symptomCheck) {
      // Symptom-focused search
      symptomResults = await semanticSymptomSearch(symptomCheck || query, { limit: 3 });
      knowledge = await semanticKnowledgeSearch(query, { limit: 5 });
    } else {
      // Knowledge-focused search
      knowledge = await semanticKnowledgeSearch(query, { limit: 5 });
    }

    // Generate RAG-enhanced response
    const { response, sources, provider, model } = await generateRAGResponse(
      query,
      knowledge,
      drugInteractions,
      symptomResults,
      patientContext,
      providerId
    );

    const responseTime = Date.now() - startTime;

    // Log the query
    await logRAGQuery(
      query,
      queryType,
      knowledge.map(k => k.id),
      responseTime,
      response,
      patientContext?.id,
      consultationId
    );

    // Update retrieval counts
    if (knowledge.length > 0) {
      await Promise.all(
        knowledge.map(k =>
          db.healthcareKnowledge.update({
            where: { id: k.id },
            data: { retrievalCount: { increment: 1 } },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        response,
        sources,
        knowledge: knowledge.map(k => ({
          id: k.id,
          title: k.title,
          category: k.category,
          similarity: k.similarity,
          keywordScore: k.keywordScore,
          combinedScore: k.combinedScore,
        })),
        drugInteractions: drugInteractions.length > 0 ? drugInteractions.map(di => ({
          drug1: di.drug1Name,
          drug2: di.drug2Name,
          severity: di.severity,
          description: di.description,
          management: di.management,
          similarity: di.similarity,
        })) : undefined,
        symptomMapping: symptomResults.length > 0 ? {
          symptom: symptomResults[0].symptomName,
          conditions: symptomResults[0].conditions,
          riskFactors: symptomResults[0].riskFactors,
          similarity: symptomResults[0].similarity,
        } : undefined,
        metadata: {
          responseTime,
          knowledgeRetrieved: knowledge.length,
          queryType,
          searchMode,
          provider,
          model,
          vectorSearch: true,
        },
      },
    });
  } catch (error) {
    console.error('RAG API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to search knowledge base directly
export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '10');
  const mode = searchParams.get('mode') || 'semantic'; // 'semantic' or 'keyword'

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    let results;

    if (mode === 'semantic') {
      // Use semantic search
      results = await semanticKnowledgeSearch(query, {
        limit,
        category: category || undefined,
        threshold: 0.05,
      });
    } else {
      // Fallback to keyword search
      const where: any = { isActive: true };
      if (category) where.category = category;
      where.OR = [
        { title: { contains: query } },
        { content: { contains: query } },
        { keywords: { contains: query } },
      ];

      results = await db.healthcareKnowledge.findMany({
        where,
        take: limit,
        select: {
          id: true,
          title: true,
          summary: true,
          category: true,
          specialty: true,
          source: true,
          evidenceLevel: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        count: results.length,
        mode,
      },
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}
