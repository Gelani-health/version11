/**
 * SOAP Notes API
 * CRUD operations for SOAP notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';

// GET /api/soap-notes - List SOAP notes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const createdBy = searchParams.get('createdBy');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (createdBy) where.createdBy = createdBy;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, string>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, string>).lte = endDate;
    }

    const soapNotes = await db.soapNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
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
        author: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
          },
        },
        vitals: true,
      },
    });

    return NextResponse.json({ success: true, data: soapNotes });
  } catch (error) {
    console.error('Error fetching SOAP notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOAP notes' },
      { status: 500 }
    );
  }
}

// POST /api/soap-notes - Create SOAP note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      encounterId,
      // Subjective
      chiefComplaint,
      hpiOnset,
      hpiLocation,
      hpiDuration,
      hpiCharacter,
      hpiAggravating,
      hpiRelieving,
      hpiTiming,
      hpiSeverity,
      hpiNarrative,
      rosConstitutional,
      rosHeent,
      rosCardiovascular,
      rosRespiratory,
      rosGastrointestinal,
      rosGenitourinary,
      rosMusculoskeletal,
      rosNeurological,
      rosPsychiatric,
      rosEndocrine,
      rosHematologic,
      rosSkin,
      pmhUpdate,
      pshUpdate,
      familyHistory,
      socialHistory,
      medicationsReview,
      allergiesConfirmed,
      obgynHistory,
      // Objective
      vitalsId,
      generalAppearance,
      peConstitutional,
      peHeent,
      peCardiovascular,
      peRespiratory,
      peGastrointestinal,
      peGenitourinary,
      peMusculoskeletal,
      peNeurological,
      pePsychiatric,
      peSkin,
      diagnosticResults,
      functionalAssessment,
      // Assessment
      primaryDiagnosisCode,
      primaryDiagnosisDesc,
      differential1Code,
      differential1Desc,
      differential1Confidence,
      differential2Code,
      differential2Desc,
      differential2Confidence,
      differential3Code,
      differential3Desc,
      differential3Confidence,
      differential4Code,
      differential4Desc,
      differential4Confidence,
      differential5Code,
      differential5Desc,
      differential5Confidence,
      clinicalReasoning,
      problemListUpdates,
      riskFlags,
      // Plan
      investigationsOrdered,
      medicationsPrescribed,
      referrals,
      patientEducation,
      followUpDate,
      followUpMode,
      followUpClinician,
      nursingInstructions,
      disposition,
      dispositionDestination,
      dispositionReason,
      // Metadata
      createdBy,
      aiSuggestionsUsed,
      aiConfidence,
    } = body;

    // Validate required fields
    if (!patientId || !encounterId || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'Patient ID, encounter ID, and createdBy are required' },
        { status: 400 }
      );
    }

    // Check for existing encounter
    const existingNote = await db.soapNote.findUnique({
      where: { encounterId },
    });

    if (existingNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note already exists for this encounter' },
        { status: 400 }
      );
    }

    // Create SOAP note
    const soapNote = await db.soapNote.create({
      data: {
        patientId,
        encounterId,
        // Subjective
        chiefComplaint,
        hpiOnset,
        hpiLocation,
        hpiDuration,
        hpiCharacter,
        hpiAggravating,
        hpiRelieving,
        hpiTiming,
        hpiSeverity,
        hpiNarrative,
        rosConstitutional,
        rosHeent,
        rosCardiovascular,
        rosRespiratory,
        rosGastrointestinal,
        rosGenitourinary,
        rosMusculoskeletal,
        rosNeurological,
        rosPsychiatric,
        rosEndocrine,
        rosHematologic,
        rosSkin,
        pmhUpdate,
        pshUpdate,
        familyHistory,
        socialHistory,
        medicationsReview,
        allergiesConfirmed: allergiesConfirmed || false,
        obgynHistory,
        // Objective
        vitalsId,
        generalAppearance,
        peConstitutional,
        peHeent,
        peCardiovascular,
        peRespiratory,
        peGastrointestinal,
        peGenitourinary,
        peMusculoskeletal,
        peNeurological,
        pePsychiatric,
        peSkin,
        diagnosticResults,
        functionalAssessment,
        // Assessment
        primaryDiagnosisCode,
        primaryDiagnosisDesc,
        differential1Code,
        differential1Desc,
        differential1Confidence,
        differential2Code,
        differential2Desc,
        differential2Confidence,
        differential3Code,
        differential3Desc,
        differential3Confidence,
        differential4Code,
        differential4Desc,
        differential4Confidence,
        differential5Code,
        differential5Desc,
        differential5Confidence,
        clinicalReasoning,
        problemListUpdates,
        riskFlags,
        // Plan
        investigationsOrdered,
        medicationsPrescribed,
        referrals,
        patientEducation,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        followUpMode,
        followUpClinician,
        nursingInstructions,
        disposition,
        dispositionDestination,
        dispositionReason,
        // Metadata
        createdBy,
        status: 'draft',
        aiSuggestionsUsed: aiSuggestionsUsed || false,
        aiConfidence,
      },
    });

    // Get patient MRN for audit
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { mrn: true },
    });

    // Create audit log
    await createAuditLog({
      actorId: createdBy,
      actorName: 'Clinician',
      actorRole: 'doctor',
      actionType: 'create',
      resourceType: 'soap_note',
      resourceId: soapNote.id,
      patientMrn: patient?.mrn || undefined,
    });

    return NextResponse.json({ success: true, data: soapNote }, { status: 201 });
  } catch (error) {
    console.error('Error creating SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create SOAP note' },
      { status: 500 }
    );
  }
}
