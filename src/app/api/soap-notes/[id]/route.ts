/**
 * Single SOAP Note API
 * Operations for individual SOAP notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/soap-notes/[id] - Get single SOAP note
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
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
      },
    });

    if (!soapNote) {
      return NextResponse.json(
        { success: false, error: 'SOAP note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: soapNote });
  } catch (error) {
    console.error('Error fetching SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOAP note' },
      { status: 500 }
    );
  }
}

// PUT /api/soap-notes/[id] - Update SOAP note
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get existing SOAP note
    const existingNote = await db.soapNote.findUnique({
      where: { id },
      include: { patient: { select: { mrn: true } } },
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

    const { lastEditedBy, ...updateData } = body;

    // Update SOAP note
    const updatedNote = await db.soapNote.update({
      where: { id },
      data: {
        ...updateData,
        lastEditedBy,
        lockVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: lastEditedBy || existingNote.createdBy,
      actorName: 'Clinician',
      actorRole: 'doctor',
      actionType: 'update',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
    });

    return NextResponse.json({ success: true, data: updatedNote });
  } catch (error) {
    console.error('Error updating SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SOAP note' },
      { status: 500 }
    );
  }
}

// DELETE /api/soap-notes/[id] - Delete SOAP note (only drafts)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
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

    // Delete SOAP note
    await db.soapNote.delete({
      where: { id },
    });

    // Create audit log
    await createAuditLog({
      actorId: soapNote.createdBy,
      actorName: 'Clinician',
      actorRole: 'doctor',
      actionType: 'delete',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: soapNote.patient?.mrn || undefined,
    });

    return NextResponse.json({ success: true, message: 'SOAP note deleted' });
  } catch (error) {
    console.error('Error deleting SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SOAP note' },
      { status: 500 }
    );
  }
}
