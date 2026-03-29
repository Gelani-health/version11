/**
 * Preventive Care API Route
 * 
 * TypeScript integration for USPSTF preventive care screening recommendations.
 * Proxies requests to the Python medical-rag-service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

const MEDICAL_RAG_SERVICE_URL = process.env.MEDICAL_RAG_SERVICE_URL || 'http://localhost:3032';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      const response = await fetch(`${MEDICAL_RAG_SERVICE_URL}/api/v1/preventive/all-recommendations`);
      if (!response.ok) throw new Error(`Service error: ${response.status}`);
      const data = await response.json();
      return NextResponse.json({ success: true, data });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, dateOfBirth: true, gender: true, chronicConditions: true },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    let conditions: string[] = [];
    try {
      conditions = patient.chronicConditions ? JSON.parse(patient.chronicConditions) : [];
    } catch { /* ignore */ }

    const response = await fetch(`${MEDICAL_RAG_SERVICE_URL}/api/v1/preventive/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_of_birth: patient.dateOfBirth.toISOString(),
        gender: patient.gender,
        risk_factors: conditions,
      }),
    });

    if (!response.ok) throw new Error(`Service error: ${response.status}`);
    const recommendations = await response.json();

    await prisma.aIInteraction.create({
      data: {
        patientId: patient.id,
        interactionType: 'preventive_care_screening',
        prompt: `Preventive care recommendations for patient ${patientId}`,
        response: JSON.stringify(recommendations),
        modelUsed: 'USPSTF-v2024',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        patient: {
          id: patient.id,
          age: Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
          gender: patient.gender,
        },
        recommendations,
      },
    });
  } catch (error) {
    console.error('Preventive care API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get recommendations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const { patientId, dateOfBirth, gender, riskFactors = [], smokingStatus, packYears, pregnant = false, lastScreenings = {} } = body;

    let patientData = { dateOfBirth, gender, riskFactors, smokingStatus, packYears, pregnant, lastScreenings };

    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, dateOfBirth: true, gender: true, chronicConditions: true },
      });
      if (patient) {
        patientData.dateOfBirth = patient.dateOfBirth.toISOString();
        patientData.gender = patient.gender;
        try {
          const conditions = patient.chronicConditions ? JSON.parse(patient.chronicConditions) : [];
          patientData.riskFactors = [...riskFactors, ...conditions];
        } catch { /* ignore */ }
      }
    }

    const response = await fetch(`${MEDICAL_RAG_SERVICE_URL}/api/v1/preventive/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_of_birth: patientData.dateOfBirth,
        gender: patientData.gender,
        risk_factors: patientData.riskFactors,
        smoking_status: patientData.smokingStatus,
        pack_years: patientData.packYears,
        pregnant: patientData.pregnant,
        last_screenings: patientData.lastScreenings,
      }),
    });

    if (!response.ok) throw new Error(`Service error: ${response.status}`);
    const recommendations = await response.json();

    if (patientId) {
      await prisma.aIInteraction.create({
        data: {
          patientId,
          interactionType: 'preventive_care_screening',
          prompt: 'Preventive care recommendations',
          response: JSON.stringify(recommendations),
          modelUsed: 'USPSTF-v2024',
        },
      });
    }

    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Preventive care API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get recommendations' }, { status: 500 });
  }
}
