/**
 * Vitals API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: vitals:read
 * - POST: vitals:write
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { authenticateRequest, AuthenticatedUser, checkPermission } from '@/lib/auth-middleware';
import {
  validateVitals,
  calculateVitalsStatuses,
  calculateBMI,
  type VitalsInput
} from '@/lib/vitals-utils';

/**
 * GET /api/vitals - List vitals
 * Permission: vitals:read
 */
export async function GET(request: NextRequest) {
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

    // Log PHI access
    await logPHIAccess(user, 'READ', 'vitals', vitals.length);

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
      { success: false, error: 'Failed to fetch vitals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vitals - Create vitals record
 * Permission: vitals:write
 */
export async function POST(request: NextRequest) {
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
      notes,
    } = body;

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID is required' },
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

    // Create vitals record with authenticated user
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
        recordedBy: user.employeeId,
        recordedByName: user.name,
        recordedByRole: user.role,
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
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'create',
      resourceType: 'vitals',
      resourceId: vitals.id,
      patientMrn: patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'CREATE', 'vitals', vitals.id, { patientId });

    return NextResponse.json({
      success: true,
      data: vitals,
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating vitals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vitals record' },
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
