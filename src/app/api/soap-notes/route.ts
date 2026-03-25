/**
 * SOAP Notes API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: soap_note:read
 * - POST: soap_note:write
 * 
 * Audit trail is maintained for all PHI access.
 * 
 * Schema Improvements (Phase 4):
 * - Differential diagnoses are now stored in a separate table
 * - Proper relations with database constraints
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { authenticateRequest, AuthenticatedUser, checkPermission } from '@/lib/auth-middleware';

// Differential diagnosis interface
interface DifferentialDiagnosisInput {
  rank: number;
  icdCode?: string;
  description: string;
  confidence?: number;
  reasoning?: string;
  status?: string;
  icdVersion?: string;
}

/**
 * GET /api/soap-notes - List SOAP notes
 * Permission: soap_note:read
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
    if (!checkPermission(user, 'soap_note:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:read required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const createdBy = searchParams.get('createdBy');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeDifferentials = searchParams.get('includeDifferentials') !== 'false';

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
        ...(includeDifferentials ? {
          differentialDiagnoses: {
            orderBy: { rank: 'asc' },
          },
        } : {}),
      },
    });

    // Log PHI access
    await logPHIAccess(user, 'READ', 'soap_notes', soapNotes.length);

    return NextResponse.json({
      success: true,
      data: soapNotes,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching SOAP notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOAP notes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/soap-notes - Create SOAP note
 * Permission: soap_note:write
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
    if (!checkPermission(user, 'soap_note:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:write required" },
        { status: 403 }
      );
    }

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
      // Assessment - Primary Diagnosis
      primaryDiagnosisCode,
      primaryDiagnosisDesc,
      // New: Differential Diagnoses array (normalized)
      differentialDiagnoses,
      // Legacy: Differential fields for backward compatibility
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
      aiSuggestionsUsed,
      aiConfidence,
    } = body;

    // Validate required fields - use authenticated user for createdBy
    if (!patientId || !encounterId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID and encounter ID are required' },
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

    // Build differential diagnoses data
    let differentialsData: DifferentialDiagnosisInput[] = [];
    
    // Use new array format if provided
    if (differentialDiagnoses && Array.isArray(differentialDiagnoses)) {
      differentialsData = differentialDiagnoses.map((d: DifferentialDiagnosisInput, index: number) => ({
        rank: d.rank || index + 1,
        icdCode: d.icdCode || null,
        description: d.description,
        confidence: d.confidence || null,
        reasoning: d.reasoning || null,
        status: d.status || 'considering',
        icdVersion: d.icdVersion || 'ICD-10',
      }));
    } else {
      // Convert legacy format to new array format
      const legacyDifferentials = [
        { rank: 1, code: differential1Code, desc: differential1Desc, conf: differential1Confidence },
        { rank: 2, code: differential2Code, desc: differential2Desc, conf: differential2Confidence },
        { rank: 3, code: differential3Code, desc: differential3Desc, conf: differential3Confidence },
        { rank: 4, code: differential4Code, desc: differential4Desc, conf: differential4Confidence },
        { rank: 5, code: differential5Code, desc: differential5Desc, conf: differential5Confidence },
      ];

      for (const d of legacyDifferentials) {
        if (d.code || d.desc) {
          differentialsData.push({
            rank: d.rank,
            icdCode: d.code || null,
            description: d.desc || '',
            confidence: typeof d.conf === 'number' ? d.conf : null,
            status: 'considering',
            icdVersion: 'ICD-10',
          });
        }
      }
    }

    // Create SOAP note with authenticated user as creator
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
        // Assessment - Primary Diagnosis
        primaryDiagnosisCode,
        primaryDiagnosisDesc,
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
        // Metadata - use authenticated user
        createdBy: user.employeeId,
        status: 'draft',
        aiSuggestionsUsed: aiSuggestionsUsed || false,
        aiConfidence,
        // Create differential diagnoses
        differentialDiagnoses: differentialsData.length > 0 ? {
          create: differentialsData.map(d => ({
            rank: d.rank,
            icdCode: d.icdCode,
            description: d.description,
            confidence: d.confidence,
            reasoning: d.reasoning,
            status: d.status,
            icdVersion: d.icdVersion,
          })),
        } : undefined,
      },
      include: {
        differentialDiagnoses: {
          orderBy: { rank: 'asc' },
        },
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
      resourceType: 'soap_note',
      resourceId: soapNote.id,
      patientMrn: patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'CREATE', 'soap_note', soapNote.id, { patientId });

    return NextResponse.json({
      success: true,
      data: soapNote,
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create SOAP note' },
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
  details?: unknown
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
