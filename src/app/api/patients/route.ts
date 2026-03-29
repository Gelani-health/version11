/**
 * Patients API Route - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: patient:read
 * - POST: patient:write  
 * - PUT: patient:write
 * - DELETE: patient:delete
 * 
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, AuthenticatedUser, checkPermission } from "@/lib/auth-middleware";

/**
 * GET /api/patients - List patients with pagination and search
 * Permission: patient:read
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereClause: any = {};

    // Non-admin users can only see patients they've interacted with
    if (user.role !== 'admin' && user.role !== 'receptionist') {
      whereClause.OR = [
        { consultations: { some: { providerName: { contains: user.name } } } },
        { primaryCarePhysician: { contains: user.name } },
      ];
    }

    if (search) {
      whereClause.AND = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { mrn: { contains: search } },
        ],
      };
    }

    const patients = await db.patient.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        email: true,
        bloodType: true,
        allergyCritical: true,
        fallRisk: true,
        infectiousDiseaseStatus: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        consultations: {
          take: 1,
          orderBy: { consultationDate: "desc" },
          select: {
            id: true,
            consultationDate: true,
            consultationType: true,
            status: true,
          },
        },
        medications: {
          where: { status: "active" },
          take: 5,
          select: {
            id: true,
            medicationName: true,
            dosage: true,
            frequency: true,
          },
        },
      },
    });

    const total = await db.patient.count({ where: whereClause });

    // Log PHI access
    await logPHIAccess(user, 'READ', 'patients', patients.length);

    return NextResponse.json({
      success: true,
      data: {
        patients,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Patients Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['patient:read'] });

/**
 * POST /api/patients - Create new patient
 * Permission: patient:write
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      city,
      bloodType,
      allergies,
      chronicConditions,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      nationalHealthId,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: firstName, lastName, dateOfBirth, gender" },
        { status: 400 }
      );
    }

    // Generate MRN
    const mrn = `MRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const patient = await db.patient.create({
      data: {
        mrn,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        phone,
        email,
        address,
        city,
        bloodType,
        allergies: allergies ? JSON.stringify(allergies) : null,
        chronicConditions: chronicConditions ? JSON.stringify(chronicConditions) : null,
        emergencyContactName,
        emergencyContactRelation: emergencyContactRelationship,
        emergencyContactPhone,
        nationalHealthId,
        primaryCarePhysician: user.name,
      },
    });

    // Log PHI creation
    await logPHIAccess(user, 'CREATE', 'patient', patient.id, { mrn, name: `${firstName} ${lastName}` });

    return NextResponse.json({
      success: true,
      data: patient,
      message: "Patient created successfully",
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create patient" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['patient:write'] });

/**
 * PUT /api/patients - Update patient
 * Permission: patient:write
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Patient ID required" },
        { status: 400 }
      );
    }

    // Check if patient exists
    const existingPatient = await db.patient.findUnique({ where: { id } });
    if (!existingPatient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    // Transform date fields
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    // Stringify JSON fields
    if (updateData.allergies && typeof updateData.allergies !== 'string') {
      updateData.allergies = JSON.stringify(updateData.allergies);
    }
    if (updateData.chronicConditions && typeof updateData.chronicConditions !== 'string') {
      updateData.chronicConditions = JSON.stringify(updateData.chronicConditions);
    }

    const patient = await db.patient.update({
      where: { id },
      data: updateData,
    });

    // Log PHI modification
    await logPHIAccess(user, 'UPDATE', 'patient', id, { 
      updatedFields: Object.keys(updateData) 
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: "Patient updated successfully",
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update patient" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['patient:write'] });

/**
 * DELETE /api/patients - Soft delete patient
 * Permission: patient:delete (admin only)
 */
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Patient ID required" },
        { status: 400 }
      );
    }

    // Check if patient exists
    const existingPatient = await db.patient.findUnique({ 
      where: { id },
      select: { id: true, mrn: true, firstName: true, lastName: true, isActive: true }
    });
    
    if (!existingPatient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    if (!existingPatient.isActive) {
      return NextResponse.json(
        { success: false, error: "Patient already deactivated" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const patient = await db.patient.update({
      where: { id },
      data: { 
        isActive: false,
        notes: `Deactivated by ${user.employeeId} on ${new Date().toISOString()}`,
      },
    });

    // Log PHI deletion
    await logPHIAccess(user, 'DELETE', 'patient', id, { 
      mrn: existingPatient.mrn,
      name: `${existingPatient.firstName} ${existingPatient.lastName}`,
      action: 'SOFT_DELETE'
    });

    return NextResponse.json({
      success: true,
      message: "Patient deactivated successfully",
      meta: {
        deactivatedBy: user.employeeId,
        deactivatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Delete Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['patient:delete'] });

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
    // Create audit log entry
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
