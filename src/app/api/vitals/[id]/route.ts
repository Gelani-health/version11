/**
 * Single Vitals API
 * Operations for individual vitals records
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { validateVitals, calculateVitalsStatuses, calculateBMI, type VitalsInput } from '@/lib/vitals-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/vitals/[id] - Get single vitals record
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const vitals = await db.vitalSigns.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        recorder: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
          },
        },
      },
    });

    if (!vitals) {
      return NextResponse.json(
        { success: false, error: 'Vitals record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: vitals });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vitals record' },
      { status: 500 }
    );
  }
}

// PUT /api/vitals/[id] - Update vitals (creates amendment)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get existing vitals
    const existingVitals = await db.vitalSigns.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
    });

    if (!existingVitals) {
      return NextResponse.json(
        { success: false, error: 'Vitals record not found' },
        { status: 404 }
      );
    }

    const {
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
      amendmentReason,
      notes,
    } = body;

    // Validate vitals
    const vitalsInput: VitalsInput = {
      temperature: temperature ?? existingVitals.temperature,
      temperatureUnit: temperatureUnit ?? existingVitals.temperatureUnit ?? 'C',
      bloodPressureSystolic: bloodPressureSystolic ?? existingVitals.bloodPressureSystolic,
      bloodPressureDiastolic: bloodPressureDiastolic ?? existingVitals.bloodPressureDiastolic,
      heartRate: heartRate ?? existingVitals.heartRate,
      respiratoryRate: respiratoryRate ?? existingVitals.respiratoryRate,
      oxygenSaturation: oxygenSaturation ?? existingVitals.oxygenSaturation,
      weight: weight ?? existingVitals.weight,
      weightUnit: weightUnit ?? existingVitals.weightUnit ?? 'kg',
      height: height ?? existingVitals.height,
      heightUnit: heightUnit ?? existingVitals.heightUnit ?? 'cm',
      bloodGlucose: bloodGlucose ?? existingVitals.bloodGlucose,
      glucoseUnit: glucoseUnit ?? existingVitals.glucoseUnit ?? 'mmol/L',
      glucoseType: glucoseType ?? existingVitals.glucoseType,
      painScore: painScore ?? existingVitals.painScore,
      consciousnessLevel: consciousnessLevel ?? existingVitals.consciousnessLevel,
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

    // Calculate BMI
    const bmi = calculateBMI(vitalsInput.weight, vitalsInput.height, vitalsInput.weightUnit, vitalsInput.heightUnit);

    // Update vitals as amendment
    const updatedVitals = await db.vitalSigns.update({
      where: { id },
      data: {
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
        bmi,
        bloodGlucose,
        glucoseUnit,
        glucoseType,
        painScore,
        consciousnessLevel,
        bpStatus: statuses.bpStatus,
        hrStatus: statuses.hrStatus,
        rrStatus: statuses.rrStatus,
        spo2Status: statuses.spo2Status,
        tempStatus: statuses.tempStatus,
        glucoseStatus: statuses.glucoseStatus,
        isAmendment: true,
        amendmentReason,
        notes,
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: existingVitals.recordedBy,
      actorName: existingVitals.recordedByName || 'Unknown',
      actorRole: existingVitals.recordedByRole || 'nurse',
      actionType: 'amend',
      resourceType: 'vitals',
      resourceId: id,
      patientMrn: existingVitals.patient?.mrn || undefined,
      fieldChanged: 'multiple',
      oldValue: JSON.stringify(existingVitals),
      newValue: JSON.stringify(updatedVitals),
    });

    return NextResponse.json({ success: true, data: updatedVitals });
  } catch (error) {
    console.error('Error updating vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update vitals record' },
      { status: 500 }
    );
  }
}

// DELETE /api/vitals/[id] - Delete vitals (soft delete by marking as amendment)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const vitals = await db.vitalSigns.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
    });

    if (!vitals) {
      return NextResponse.json(
        { success: false, error: 'Vitals record not found' },
        { status: 404 }
      );
    }

    // In healthcare, we typically don't hard delete
    // Instead, mark as amendment with deletion reason
    await db.vitalSigns.update({
      where: { id },
      data: {
        isAmendment: true,
        amendmentReason: 'Record deleted',
        notes: `[DELETED] ${vitals.notes || ''}`,
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: vitals.recordedBy,
      actorName: vitals.recordedByName || 'Unknown',
      actorRole: vitals.recordedByRole || 'nurse',
      actionType: 'delete',
      resourceType: 'vitals',
      resourceId: id,
      patientMrn: vitals.patient?.mrn || undefined,
    });

    return NextResponse.json({ success: true, message: 'Vitals record deleted' });
  } catch (error) {
    console.error('Error deleting vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete vitals record' },
      { status: 500 }
    );
  }
}
