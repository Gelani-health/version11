import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAllKnowledgeEmbeddings, storeKnowledgeEmbedding } from '@/lib/embeddings/vector-search';
import { generateEmbedding } from '@/lib/embeddings/service';

// API to manage knowledge embeddings

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, knowledgeId } = body;

    if (action === 'generate-all') {
      // Generate embeddings for all knowledge entries
      const result = await generateAllKnowledgeEmbeddings((current, total) => {
        console.log(`Embedding progress: ${current}/${total}`);
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'Embedding generation complete',
          total: result.total,
          updated: result.updated,
          errors: result.errors.length,
          errorDetails: result.errors.slice(0, 10), // First 10 errors
        },
      });
    }

    if (action === 'generate-single' && knowledgeId) {
      // Generate embedding for a single knowledge entry
      await storeKnowledgeEmbedding(knowledgeId);

      return NextResponse.json({
        success: true,
        data: {
          message: 'Embedding generated',
          knowledgeId,
        },
      });
    }

    if (action === 'stats') {
      // Get embedding statistics
      const totalKnowledge = await db.healthcareKnowledge.count({
        where: { isActive: true },
      });

      const withEmbeddings = await db.healthcareKnowledge.count({
        where: {
          isActive: true,
          embedding: { not: null },
        },
      });

      const cacheCount = await db.embeddingCache.count();

      return NextResponse.json({
        success: true,
        data: {
          totalKnowledge,
          withEmbeddings,
          withoutEmbeddings: totalKnowledge - withEmbeddings,
          cacheEntries: cacheCount,
          coverage: totalKnowledge > 0 ? Math.round((withEmbeddings / totalKnowledge) * 100) : 0,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: generate-all, generate-single, or stats' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Embedding API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process embedding request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get embedding statistics
    const totalKnowledge = await db.healthcareKnowledge.count({
      where: { isActive: true },
    });

    const withEmbeddings = await db.healthcareKnowledge.count({
      where: {
        isActive: true,
        embedding: { not: null },
      },
    });

    const byCategory = await db.healthcareKnowledge.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { id: true },
    });

    const cacheCount = await db.embeddingCache.count();

    return NextResponse.json({
      success: true,
      data: {
        totalKnowledge,
        withEmbeddings,
        withoutEmbeddings: totalKnowledge - withEmbeddings,
        cacheEntries: cacheCount,
        coverage: totalKnowledge > 0 ? Math.round((withEmbeddings / totalKnowledge) * 100) : 0,
        byCategory: byCategory.map(c => ({
          category: c.category,
          count: c._count.id,
        })),
      },
    });
  } catch (error) {
    console.error('Embedding Stats Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get embedding statistics' },
      { status: 500 }
    );
  }
}
