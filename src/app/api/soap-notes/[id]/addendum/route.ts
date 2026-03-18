/**
 * SOAP Note Addendum API
 * Add addendum to signed SOAP note
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/soap-notes/[id]/addendum - Add addendum
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { addendumText, reason, authoredBy, authoredByName, authoredByRole } = body;

    // Validate required fields
    if (!addendumText || !authoredBy) {
      return NextResponse.json(
        { success: false, error: 'Addendum text and authoredBy are required' },
        { status: 400 }
      );
    }

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

    // Addendum can only be added to signed notes
    if (existingNote.status !== 'signed') {
      return NextResponse.json(
        { success: false, error: 'Addendum can only be added to signed SOAP notes' },
        { status: 400 }
      );
    }

    // Create addendum
    const addendum = await db.soapAddendum.create({
      data: {
        soapNoteId: id,
        addendumText,
        reason,
        authoredBy,
      },
    });

    // Update SOAP note status to amended
    await db.soapNote.update({
      where: { id },
      data: {
        status: 'amended',
        lockVersion: { increment: 1 },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: authoredBy,
      actorName: authoredByName || 'Clinician',
      actorRole: authoredByRole || 'doctor',
      actionType: 'amend',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
      fieldChanged: 'addendum',
      newValue: addendumText,
    });

    return NextResponse.json({ 
      success: true, 
      data: addendum,
      message: 'Addendum added successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding addendum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add addendum' },
      { status: 500 }
    );
  }
}

// GET /api/soap-notes/[id]/addendum - Get addenda for a SOAP note
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const addenda = await db.soapAddendum.findMany({
      where: { soapNoteId: id },
      include: {
        author: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
            department: true,
          },
        },
      },
      orderBy: { authoredAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: addenda });
  } catch (error) {
    console.error('Error fetching addenda:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch addenda' },
      { status: 500 }
    );
  }
}
