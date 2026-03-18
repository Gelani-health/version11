/**
 * SOAP Note Sign API
 * Sign/lock a SOAP note
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/soap-notes/[id]/sign - Sign SOAP note
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { signedBy, signedByName, signedByRole } = body;

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

    // Check if note is already signed
    if (existingNote.status === 'signed') {
      return NextResponse.json(
        { success: false, error: 'SOAP note is already signed' },
        { status: 400 }
      );
    }

    // Validate required fields before signing
    const requiredFields = ['chiefComplaint', 'primaryDiagnosisCode', 'primaryDiagnosisDesc'];
    const missingFields = requiredFields.filter(field => !existingNote[field as keyof typeof existingNote]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Sign the SOAP note
    const signedNote = await db.soapNote.update({
      where: { id },
      data: {
        status: 'signed',
        signedAt: new Date(),
        signedBy,
        lockVersion: { increment: 1 },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: signedBy,
      actorName: signedByName || 'Clinician',
      actorRole: signedByRole || 'doctor',
      actionType: 'sign',
      resourceType: 'soap_note',
      resourceId: id,
      patientMrn: existingNote.patient?.mrn || undefined,
    });

    return NextResponse.json({ 
      success: true, 
      data: signedNote,
      message: 'SOAP note signed successfully' 
    });
  } catch (error) {
    console.error('Error signing SOAP note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign SOAP note' },
      { status: 500 }
    );
  }
}
