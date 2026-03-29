/**
 * Preventive Care API Route
 * ==========================
 *
 * USPSTF A/B screening recommendations for patients
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { preventiveCareService } from '@/lib/preventive-care-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const category = searchParams.get('category');

    // Get all screenings
    if (!patientId) {
      const screenings = category
        ? preventiveCareService.getScreeningsByCategory(category as any)
        : preventiveCareService.getAllScreenings();
      
      return NextResponse.json({
        screenings,
        statistics: preventiveCareService.getStatistics(),
      });
    }

    // Get patient-specific recommendations
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      include: {
        patientAllergies: true,
        chronicConditionsNew: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Get completed screenings from SOAP notes or clinical orders
    const completedScreenings: { screeningId: string; performedDate: Date }[] = [];

    const recommendations = preventiveCareService.generateRecommendations(
      patient,
      completedScreenings
    );

    // Separate by status
    const due = recommendations.filter(r => r.status === 'due');
    const overdue = recommendations.filter(r => r.status === 'overdue');
    const upToDate = recommendations.filter(r => r.status === 'up_to_date');

    return NextResponse.json({
      patientId,
      age: calculateAge(patient.dateOfBirth),
      gender: patient.gender,
      recommendations: {
        due,
        overdue,
        upToDate,
        total: recommendations.length,
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Preventive care API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, screeningId, performedDate, notes, orderedBy } = body;

    if (!patientId || !screeningId) {
      return NextResponse.json(
        { error: 'patientId and screeningId are required' },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Get screening details
    const screening = preventiveCareService.getScreeningById(screeningId);
    if (!screening) {
      return NextResponse.json(
        { error: 'Screening not found' },
        { status: 404 }
      );
    }

    // Create a clinical order for the screening
    const order = await db.clinicalOrder.create({
      data: {
        patientId,
        orderType: 'screening',
        orderCategory: screening.category,
        orderName: screening.name,
        orderDetails: JSON.stringify({
          screeningId,
          cptCode: screening.cptCode,
          icd10Code: screening.icd10Code,
          notes,
        }),
        status: 'ordered',
        urgency: screening.grade === 'A' ? 'urgent' : 'routine',
        orderedBy: orderedBy || 'system',
        orderedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      order,
      message: `${screening.name} ordered successfully`,
    });
  } catch (error) {
    console.error('Error ordering screening:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateAge(dateOfBirth: Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}
