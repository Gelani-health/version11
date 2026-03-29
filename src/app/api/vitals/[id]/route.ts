/**
 * Single Vitals API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: vitals:read
 * - PUT: vitals:write
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { authenticateRequest, AuthenticatedUser, checkPermission } from '@/lib/auth-middleware';
import { validateVitals, calculateVitalsStatuses, calculateBMI, type VitalsInput } from '@/lib/vitals-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vitals/[id] - Get single vitals record
 * Permission: vitals:read
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'vitals:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: vitals:read required" },
        { status: 403 }
      );
    }

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

    // Log PHI access
    await logPHIAccess(user, 'READ', 'vitals', id, { patientId: vitals.patientId });

    return NextResponse.json({
      success: true,
      data: vitals,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vitals record' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vitals/[id] - Update vitals (creates amendment)
 * Permission: vitals:write
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'vitals:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: vitals:write required" },
        { status: 403 }
      );
    }

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
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'amend',
      resourceType: 'vitals',
      resourceId: id,
      patientMrn: existingVitals.patient?.mrn || undefined,
      fieldChanged: 'multiple',
      oldValue: JSON.stringify(existingVitals),
      newValue: JSON.stringify(updatedVitals),
    });

    // Log PHI access
    await logPHIAccess(user, 'UPDATE', 'vitals', id, { amendmentReason });

    return NextResponse.json({
      success: true,
      data: updatedVitals,
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update vitals record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vitals/[id] - Delete vitals (soft delete by marking as amendment)
 * Permission: vitals:write
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: authResult.statusCode || 401 }
      );
    }

    const user = authResult.user;

    // Check permissions
    if (!checkPermission(user, 'vitals:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: vitals:write required" },
        { status: 403 }
      );
    }

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
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'delete',
      resourceType: 'vitals',
      resourceId: id,
      patientMrn: vitals.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'DELETE', 'vitals', id);

    return NextResponse.json({
      success: true,
      message: 'Vitals record deleted',
      meta: {
        deletedBy: user.employeeId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error deleting vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete vitals record' },
      { status: 500 }
    );
  }
}

/**
 * Log PHI access for HIPAA compliance
 */
async function logPHIAccess(
  user: AuthenticatedUser,
  action: string,
  resource: string,
  resourceId: string | number,
  details?: any
): Promise<void> {
  try {
    await db.aIInteraction.create({
      data: {
        interactionType: 'phi_access',
        prompt: `${action} ${resource}`,
        response: JSON.stringify({
          resourceId,
          details,
          userRole: user.role,
        }),
        humanReviewed: false,
        modelUsed: 'audit-system',
        patientId: typeof resourceId === 'string' ? resourceId : null,
      },
    });

    console.log(`[PHI AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Action: ${action} | Resource: ${resource}:${resourceId}`);
  } catch (error) {
    console.error('Failed to log PHI access:', error);
  }
}
