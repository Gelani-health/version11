/**
 * Vitals API
 * CRUD operations for vital signs with validation and status calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { 
  validateVitals, 
  calculateVitalsStatuses, 
  calculateBMI,
  type VitalsInput 
} from '@/lib/vitals-utils';

// GET /api/vitals - List vitals
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const encounterId = searchParams.get('encounterId');
    const recordedBy = searchParams.get('recordedBy');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (encounterId) where.encounterId = encounterId;
    if (recordedBy) where.recordedBy = recordedBy;

    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) (where.recordedAt as Record<string, string>).gte = startDate;
      if (endDate) (where.recordedAt as Record<string, string>).lte = endDate;
    }

    const vitals = await db.vitalSigns.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: vitals });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vitals' },
      { status: 500 }
    );
  }
}

// POST /api/vitals - Create vitals record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      encounterId,
      temperature,
      temperatureUnit,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      weight,
      weightUnit,
      height,
      heightUnit,
      bloodGlucose,
      glucoseUnit,
      glucoseType,
      painScore,
      consciousnessLevel,
      recordedBy,
      recordedByName,
      recordedByRole,
      notes,
    } = body;

    // Validate required fields
    if (!patientId || !recordedBy) {
      return NextResponse.json(
        { success: false, error: 'Patient ID and recordedBy are required' },
        { status: 400 }
      );
    }

    // Validate vitals
    const vitalsInput: VitalsInput = {
      temperature,
      temperatureUnit,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      weight,
      weightUnit,
      height,
      heightUnit,
      bloodGlucose,
      glucoseUnit,
      glucoseType,
      painScore,
      consciousnessLevel,
    };

    const validation = validateVitals(vitalsInput);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Calculate statuses
    const statuses = calculateVitalsStatuses(vitalsInput);

    // Calculate BMI if weight and height provided
    const bmi = calculateBMI(weight, height, weightUnit, heightUnit);

    // Create vitals record
    const vitals = await db.vitalSigns.create({
      data: {
        patientId,
        encounterId,
        temperature,
        temperatureUnit: temperatureUnit || 'C',
        bloodPressureSystolic,
        bloodPressureDiastolic,
        heartRate,
        respiratoryRate,
        oxygenSaturation,
        weight,
        weightUnit: weightUnit || 'kg',
        height,
        heightUnit: heightUnit || 'cm',
        bmi,
        bloodGlucose,
        glucoseUnit: glucoseUnit || 'mmol/L',
        glucoseType,
        painScore,
        consciousnessLevel,
        bpStatus: statuses.bpStatus,
        hrStatus: statuses.hrStatus,
        rrStatus: statuses.rrStatus,
        spo2Status: statuses.spo2Status,
        tempStatus: statuses.tempStatus,
        glucoseStatus: statuses.glucoseStatus,
        recordedBy,
        recordedByName,
        recordedByRole,
        notes,
      },
    });

    // Get patient MRN for audit
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { mrn: true },
    });

    // Create audit log
    await createAuditLog({
      actorId: recordedBy,
      actorName: recordedByName || 'Unknown',
      actorRole: recordedByRole || 'nurse',
      actionType: 'create',
      resourceType: 'vitals',
      resourceId: vitals.id,
      patientMrn: patient?.mrn || undefined,
    });

    return NextResponse.json({ success: true, data: vitals }, { status: 201 });
  } catch (error) {
    console.error('Error creating vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vitals record' },
      { status: 500 }
    );
  }
}
