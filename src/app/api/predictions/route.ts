/**
 * Clinical Predictions API Route
 * 
 * TypeScript integration for clinical prediction models:
 * - LACE Index (30-day readmission risk)
 * - NEWS2 (clinical deterioration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';

const MEDICAL_RAG_SERVICE_URL = process.env.MEDICAL_RAG_SERVICE_URL || 'http://localhost:3032';

// GET: List available prediction models
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'models') {
      const response = await fetch(`${MEDICAL_RAG_SERVICE_URL}/api/v1/prediction/models`);
      if (!response.ok) throw new Error(`Service error: ${response.status}`);
      const data = await response.json();
      return NextResponse.json({ success: true, data });
    }

    // Default: return model info
    return NextResponse.json({
      success: true,
      data: {
        models: [
          { name: 'LACE Index', type: 'readmission_30day', description: '30-day readmission risk' },
          { name: 'NEWS2', type: 'deterioration', description: 'Clinical deterioration risk' },
        ],
      },
    });
  } catch (error) {
    console.error('Predictions API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get prediction models' }, { status: 500 });
  }
}

// POST: Run prediction
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const { predictionType, patientId, patientData } = body;

    if (!predictionType) {
      return NextResponse.json({ success: false, error: 'Prediction type required' }, { status: 400 });
    }

    let data = patientData || {};

    // If patientId provided, fetch patient data
    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
          medications: { where: { status: 'active' } },
        },
      });

      if (!patient) {
        return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
      }

      const latestVitals = patient.vitals[0];
      const conditions: string[] = [];
      try {
        const parsed = patient.chronicConditions ? JSON.parse(patient.chronicConditions) : [];
        conditions.push(...parsed);
      } catch { /* ignore */ }

      data = {
        ...data,
        age: Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
        gender: patient.gender,
        conditions,
        medications: patient.medications.map(m => m.medicationName),
        vitals: latestVitals ? {
          respiratoryRate: latestVitals.respiratoryRate,
          oxygenSaturation: latestVitals.oxygenSaturation,
          supplementalOxygen: false,
          systolicBp: latestVitals.bloodPressureSystolic,
          diastolicBp: latestVitals.bloodPressureDiastolic,
          heartRate: latestVitals.heartRate,
          temperature: latestVitals.temperature,
        } : null,
      };
    }

    let endpoint = '';
    let payload: Record<string, unknown> = {};

    switch (predictionType) {
      case 'readmission':
        endpoint = '/api/v1/prediction/readmission-risk';
        payload = {
          length_of_stay_days: data.lengthOfStayDays || data.length_of_stay_days || 3,
          admission_type: data.admissionType || data.admission_type || 'elective',
          conditions: data.conditions || [],
          ed_visits_6months: data.edVisits6months || data.ed_visits_6months || 0,
          age: data.age,
          discharge_destination: data.dischargeDestination || data.discharge_destination,
        };
        break;

      case 'deterioration':
        endpoint = '/api/v1/prediction/deterioration-risk';
        if (!data.vitals && !data.respiratoryRate) {
          return NextResponse.json({
            success: false,
            error: 'Vital signs required for deterioration prediction',
          }, { status: 400 });
        }
        payload = {
          respiratory_rate: data.vitals?.respiratoryRate || data.respiratoryRate || data.respiratory_rate || 16,
          oxygen_saturation: data.vitals?.oxygenSaturation || data.oxygenSaturation || data.oxygen_saturation || 98,
          supplemental_oxygen: data.vitals?.supplementalOxygen || data.supplementalOxygen || data.supplemental_oxygen || false,
          systolic_bp: data.vitals?.systolicBp || data.systolicBp || data.systolic_bp || 120,
          heart_rate: data.vitals?.heartRate || data.heartRate || data.heart_rate || 72,
          temperature: data.vitals?.temperature || data.temperature || 37.0,
          consciousness: data.consciousness || 'alert',
          scale: data.scale || 1,
        };
        break;

      case 'comprehensive':
        endpoint = '/api/v1/prediction/comprehensive';
        payload = data;
        break;

      default:
        return NextResponse.json({ success: false, error: 'Unknown prediction type' }, { status: 400 });
    }

    const response = await fetch(`${MEDICAL_RAG_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service error: ${response.status} - ${errorText}`);
    }

    const prediction = await response.json();

    // Log AI interaction
    if (patientId) {
      await prisma.aIInteraction.create({
        data: {
          patientId,
          interactionType: `prediction_${predictionType}`,
          prompt: `Clinical prediction: ${predictionType}`,
          response: JSON.stringify(prediction),
          modelUsed: prediction.model_name || prediction.modelName || 'Unknown',
        },
      });
    }

    return NextResponse.json({ success: true, data: prediction });
  } catch (error) {
    console.error('Predictions API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to run prediction' }, { status: 500 });
  }
}
