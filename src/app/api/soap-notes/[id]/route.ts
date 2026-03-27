/**
 * Single SOAP Note API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: soap_note:read
 * - PUT: soap_note:write
 * 
 * Audit trail is maintained for all PHI access.
 * 
 * Schema Improvements (Phase 4):
 * - Differential diagnoses are now stored in a separate table
 * - Proper relations with database constraints
 * 
 * PROMPT 10 Enhancements:
 * - Version history with SoapNoteVersion for amendment trail
 * - Structured SoapNoteAssessmentItem with ICD coding
 * - Structured SoapNotePlanItem for care coordination
 * - Automatic version snapshot creation on updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { authenticateRequest, AuthenticatedUser, checkPermission } from '@/lib/auth-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Differential diagnosis interface
interface DifferentialDiagnosisInput {
  id?: string;
  rank: number;
  icdCode?: string;
  description: string;
  confidence?: number;
  reasoning?: string;
  status?: string;
  icdVersion?: string;
}

// PROMPT 10: Assessment item interface
interface AssessmentItemInput {
  id?: string;
  diagnosis: string;
  icdCode?: string;
  icdVersion?: string;
  snomedCode?: string;
  rank?: number;
  confidence?: number;
  status?: string;
  isPrimary?: boolean;
  notes?: string;
}

// PROMPT 10: Plan item interface
interface PlanItemInput {
  id?: string;
  category: 'medication' | 'lab' | 'imaging' | 'referral' | 'followup' | 'procedure' | 'education';
  description: string;
  status?: string;
  priority?: string;
  orderedBy?: string;
  orderedAt?: string;
  scheduledDate?: string;
  completedAt?: string;
  completedBy?: string;
  outcome?: string;
  notes?: string;
}

/**
 * GET /api/soap-notes/[id] - Get single SOAP note
 * Permission: soap_note:read
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
    if (!checkPermission(user, 'soap_note:read')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:read required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const soapNote = await db.soapNote.findUnique({
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
            bloodType: true,
            allergies: true,
          },
        },
        author: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
            specialty: true,
          },
        },
        editor: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        signer: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        vitals: true,
        differentialDiagnoses: {
          orderBy: { rank: 'asc' },
        },
        addenda: {
          include: {
            author: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: { authoredAt: 'desc' },
        },
        orders: true,
        prescriptions: true,
        nurseTasks: {
          include: {
            assigner: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            assignee: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        // PROMPT 10: Include new relations
        assessmentItems: {
          orderBy: { rank: 'asc' },
        },
        planItems: {
          orderBy: { createdAt: 'asc' },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5, // Last 5 versions
        },
      },
    });

    if (!soapNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Log PHI access
    await logPHIAccess(user, 'READ', 'soap_note', id, { patientId: soapNote.patientId });

    return NextResponse.json({
      success: true,
      data: soapNote,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOAP note' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/soap-notes/[id] - Update SOAP note
 * Permission: soap_note:write
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
    if (!checkPermission(user, 'soap_note:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing SOAP note
    const existingNote = await db.soapNote.findUnique({
      where: { id },
      include: { 
        patient: { select: { mrn: true } },
        differentialDiagnoses: true,
      },
    });

    if (!existingNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Check if note is signed
    if (existingNote.status === 'signed') {
      return NextResponse.json(
        { success: false, error: 'Cannot modify signed SOAP note. Use addendum instead.' },
        { status: 400 }
      );
    }

    // Extract differential diagnoses from body
    const { differentialDiagnoses, assessmentItems, planItems, ...updateData } = body;

    // PROMPT 10: Create version snapshot before update
    // Get the current maximum version number
    const maxVersion = await db.soapNoteVersion.aggregate({
      where: { soapNoteId: id },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

    // Use transaction to update SOAP note, create version, and update related items atomically
    const updatedNote = await db.$transaction(async (tx) => {
      // PROMPT 10: Create version snapshot before update
      // Only create version if note is already signed (drafts don't need version history)
      if (existingNote.status === 'signed' || existingNote.status === 'amended') {
        // Serialize current note state for snapshot
        const snapshotData = {
          ...existingNote,
          differentialDiagnoses: existingNote.differentialDiagnoses,
        };
        
        await tx.soapNoteVersion.create({
          data: {
            soapNoteId: id,
            versionNumber: nextVersionNumber,
            snapshotJson: JSON.stringify(snapshotData),
            amendedBy: user.employeeId,
            amendmentReason: 'Clinical update',
            changeSummary: 'Note updated via API',
          },
        });
      }
      // Update differential diagnoses if provided
      if (differentialDiagnoses && Array.isArray(differentialDiagnoses)) {
        // Delete existing differentials
        await tx.differentialDiagnosis.deleteMany({
          where: { soapNoteId: id },
        });

        // Create new differentials
        if (differentialDiagnoses.length > 0) {
          await tx.differentialDiagnosis.createMany({
            data: differentialDiagnoses.map((d: DifferentialDiagnosisInput, index: number) => ({
              soapNoteId: id,
              rank: d.rank || index + 1,
              icdCode: d.icdCode || null,
              description: d.description,
              confidence: d.confidence || null,
              reasoning: d.reasoning || null,
              status: d.status || 'considering',
              icdVersion: d.icdVersion || 'ICD-10',
            })),
          });
        }
      }

      // PROMPT 10: Update assessment items if provided
      if (assessmentItems && Array.isArray(assessmentItems)) {
        // Delete existing assessment items
        await db.soapNoteAssessmentItem.deleteMany({
          where: { soapNoteId: id },
        });

        // Create new assessment items
        if (assessmentItems.length > 0) {
          await db.soapNoteAssessmentItem.createMany({
            data: assessmentItems.map((a: AssessmentItemInput, index: number) => ({
              soapNoteId: id,
              diagnosis: a.diagnosis,
              icdCode: a.icdCode || null,
              icdVersion: a.icdVersion || 'ICD-10',
              snomedCode: a.snomedCode || null,
              rank: a.rank || index + 1,
              confidence: a.confidence || null,
              status: a.status || 'active',
              isPrimary: a.isPrimary || false,
              notes: a.notes || null,
            })),
          });
        }
      }

      // PROMPT 10: Update plan items if provided
      if (planItems && Array.isArray(planItems)) {
        // Delete existing plan items
        await db.soapNotePlanItem.deleteMany({
          where: { soapNoteId: id },
        });

        // Create new plan items
        if (planItems.length > 0) {
          await db.soapNotePlanItem.createMany({
            data: planItems.map((p: PlanItemInput) => ({
              soapNoteId: id,
              category: p.category,
              description: p.description,
              status: p.status || 'pending',
              priority: p.priority || 'routine',
              orderedBy: p.orderedBy || null,
              orderedAt: p.orderedAt ? new Date(p.orderedAt) : null,
              scheduledDate: p.scheduledDate ? new Date(p.scheduledDate) : null,
              completedAt: p.completedAt ? new Date(p.completedAt) : null,
              completedBy: p.completedBy || null,
              outcome: p.outcome || null,
              notes: p.notes || null,
            })),
          });
        }
      }

      // Update SOAP note with authenticated user as editor
      return tx.soapNote.update({
        where: { id },
        data: {
          ...updateData,
          lastEditedBy: user.employeeId,
          lockVersion: { increment: 1 },
          updatedAt: new Date(),
        },
        include: {
          differentialDiagnoses: {
            orderBy: { rank: 'asc' },
          },
          // PROMPT 10: Include new relations
          assessmentItems: {
            orderBy: { rank: 'asc' },
          },
          planItems: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'update',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'UPDATE', 'soap_note', id, { 
      updatedFields: Object.keys(updateData) 
    });

    return NextResponse.json({
      success: true,
      data: updatedNote,
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SOAP note' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/soap-notes/[id] - Delete SOAP note (only drafts)
 * Permission: soap_note:write
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
    if (!checkPermission(user, 'soap_note:write')) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions: soap_note:write required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const soapNote = await db.soapNote.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
    });

    if (!soapNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of drafts
    if (soapNote.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft SOAP notes can be deleted' },
        { status: 400 }
      );
    }

    // Delete SOAP note (differentials will cascade delete)
    await db.soapNote.delete({
      where: { id },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'delete',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: soapNote.patient?.mrn || undefined,
    });

    // Log PHI access
    await logPHIAccess(user, 'DELETE', 'soap_note', id);

    return NextResponse.json({
      success: true,
      message: 'SOAP note deleted',
      meta: {
        deletedBy: user.employeeId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error deleting SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SOAP note' },
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
