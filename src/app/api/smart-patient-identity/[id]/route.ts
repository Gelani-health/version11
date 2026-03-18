import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/smart-patient-identity/[id] - Get single patient smart identity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        consultations: {
          take: 5,
          orderBy: { consultationDate: 'desc' }
        },
        vitals: {
          take: 5,
          orderBy: { recordedAt: 'desc' }
        },
        medications: {
          where: { status: 'active' },
          take: 10
        },
        diagnoses: {
          where: { status: 'active' },
          take: 10
        },
        smartCardAccess: {
          take: 10,
          orderBy: { accessedAt: 'desc' }
        },
        _count: {
          select: {
            consultations: true,
            medications: true,
            vitals: true,
            diagnoses: true,
            labResults: true,
            documents: true
          }
        }
      }
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const parsedPatient = {
      ...patient,
      allergies: patient.allergies ? JSON.parse(patient.allergies) : [],
      chronicConditions: patient.chronicConditions ? JSON.parse(patient.chronicConditions) : [],
      implantedDevices: patient.implantedDevices ? JSON.parse(patient.implantedDevices) : [],
      highRiskMedications: patient.highRiskMedications ? JSON.parse(patient.highRiskMedications) : [],
      aiRiskFactors: patient.aiRiskFactors ? JSON.parse(patient.aiRiskFactors) : [],
      aiEmergencyAlerts: patient.aiEmergencyAlerts ? JSON.parse(patient.aiEmergencyAlerts) : [],
      disabilityStatus: patient.disabilityStatus ? JSON.parse(patient.disabilityStatus) : [],
      isolationPrecautions: patient.isolationPrecautions ? JSON.parse(patient.isolationPrecautions) : []
    };

    return NextResponse.json({
      success: true,
      data: parsedPatient
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patient' },
      { status: 500 }
    );
  }
}

// PUT /api/smart-patient-identity/[id] - Update patient smart identity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const patient = await db.patient.update({
      where: { id },
      data: {
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        estimatedDueDate: body.estimatedDueDate ? new Date(body.estimatedDueDate) : null,
        dnrOrderDate: body.dnrOrderDate ? new Date(body.dnrOrderDate) : null,
        lastHospitalVisit: body.lastHospitalVisit ? new Date(body.lastHospitalVisit) : null,
        insuranceVerifiedDate: body.insuranceVerifiedDate ? new Date(body.insuranceVerifiedDate) : null,
        aiLastAssessment: body.aiLastAssessment ? new Date(body.aiLastAssessment) : null,
        patientPortalLastAccess: body.patientPortalLastAccess ? new Date(body.patientPortalLastAccess) : null,
        cardPrintDate: body.cardPrintDate ? new Date(body.cardPrintDate) : null,
        cardExpiryDate: body.cardExpiryDate ? new Date(body.cardExpiryDate) : null
      }
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: 'Patient identity updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update patient' },
      { status: 500 }
    );
  }
}

// DELETE /api/smart-patient-identity/[id] - Soft delete patient
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.patient.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Patient identity deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
