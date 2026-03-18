import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// AI Interactions API - Save and retrieve AI interactions for patient data consistency

// POST: Save a new AI interaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      consultationId,
      interactionType, // 'symptom-analysis', 'risk-calculation', 'lab-interpretation', 'drug-check', 'clinical-support'
      prompt,
      response,
      modelUsed,
      processingTime,
      metadata, // Additional JSON data (e.g., results, scores, interpretations)
    } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    if (!interactionType || !prompt) {
      return NextResponse.json(
        { success: false, error: 'Interaction type and prompt are required' },
        { status: 400 }
      );
    }

    // Save the AI interaction
    const interaction = await db.aIInteraction.create({
      data: {
        patientId,
        consultationId,
        interactionType,
        prompt,
        response: response || '',
        modelUsed: modelUsed || 'healthcare-ai',
        processingTime,
        safetyFlags: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: interaction.id,
        createdAt: interaction.createdAt,
      },
    });
  } catch (error) {
    console.error('Save AI interaction error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save AI interaction' },
      { status: 500 }
    );
  }
}

// GET: Retrieve AI interactions for a patient
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const consultationId = searchParams.get('consultationId');
    const interactionType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeResponse = searchParams.get('includeResponse') === 'true';

    if (!patientId && !consultationId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID or Consultation ID is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};
    if (patientId) where.patientId = patientId;
    if (consultationId) where.consultationId = consultationId;
    if (interactionType) where.interactionType = interactionType;

    const interactions = await db.aIInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        interactionType: true,
        prompt: true,
        response: includeResponse,
        modelUsed: true,
        processingTime: true,
        humanReviewed: true,
        safetyFlags: true,
        createdAt: true,
        consultation: {
          select: {
            id: true,
            consultationDate: true,
            consultationType: true,
            chiefComplaint: true,
          },
        },
      },
    });

    // Get total count
    const total = await db.aIInteraction.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        interactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Get AI interactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve AI interactions' },
      { status: 500 }
    );
  }
}
