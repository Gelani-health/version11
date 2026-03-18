import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Patient Timeline API - Comprehensive patient history with AI interactions, consultations, and more

interface TimelineEvent {
  id: string;
  type: 'consultation' | 'ai_interaction' | 'diagnosis' | 'medication' | 'lab_result' | 'voice_note';
  title: string;
  description?: string;
  date: Date;
  metadata?: Record<string, unknown>;
  aiGenerated?: boolean;
  consultationId?: string;
}

// GET: Get comprehensive patient timeline
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('patientId');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const types = searchParams.get('types')?.split(',') || null;
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const events: TimelineEvent[] = [];

    // Date filter
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (fromDate) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(fromDate) };
    if (toDate) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(toDate) };

    // Fetch Consultations
    if (!types || types.includes('consultation')) {
      const consultations = await db.consultation.findMany({
        where: {
          patientId,
          ...dateFilter,
        },
        orderBy: { consultationDate: 'desc' },
        take: limit,
        include: {
          diagnoses: true,
          medications: true,
        },
      });

      consultations.forEach(c => {
        events.push({
          id: `consultation-${c.id}`,
          type: 'consultation',
          title: c.chiefComplaint || `${c.consultationType} Consultation`,
          description: c.subjectiveNotes?.slice(0, 200) || undefined,
          date: c.consultationDate,
          consultationId: c.id,
          metadata: {
            consultationType: c.consultationType,
            status: c.status,
            providerName: c.providerName,
            department: c.department,
            diagnosisCount: c.diagnoses.length,
            medicationCount: c.medications.length,
            aiSummaryGenerated: c.aiSummaryGenerated,
          },
          aiGenerated: c.aiSummaryGenerated,
        });
      });
    }

    // Fetch AI Interactions
    if (!types || types.includes('ai_interaction')) {
      const aiInteractions = await db.aIInteraction.findMany({
        where: {
          patientId,
          ...dateFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      aiInteractions.forEach(ai => {
        let title = '';
        let description = ai.prompt.slice(0, 150);
        
        switch (ai.interactionType) {
          case 'rag-healthcare':
            title = 'RAG Healthcare Query';
            break;
          case 'symptom-analysis':
            title = 'Symptom AI Analysis';
            break;
          case 'risk-calculation':
            title = 'Risk Score Calculation';
            break;
          case 'lab-interpretation':
            title = 'Lab AI Interpretation';
            break;
          case 'drug-check':
            title = 'Drug Interaction Check';
            break;
          case 'clinical-support':
            title = 'Clinical Decision Support';
            break;
          default:
            title = 'AI Interaction';
        }

        events.push({
          id: `ai-${ai.id}`,
          type: 'ai_interaction',
          title,
          description,
          date: ai.createdAt,
          consultationId: ai.consultationId || undefined,
          metadata: {
            interactionType: ai.interactionType,
            modelUsed: ai.modelUsed,
            processingTime: ai.processingTime,
            humanReviewed: ai.humanReviewed,
          },
          aiGenerated: true,
        });
      });
    }

    // Fetch Diagnoses
    if (!types || types.includes('diagnosis')) {
      const diagnoses = await db.diagnosis.findMany({
        where: {
          patientId,
          ...dateFilter,
        },
        orderBy: { diagnosedDate: 'desc' },
        take: limit,
      });

      diagnoses.forEach(d => {
        events.push({
          id: `diagnosis-${d.id}`,
          type: 'diagnosis',
          title: d.diagnosisName,
          description: d.description || undefined,
          date: d.diagnosedDate,
          consultationId: d.consultationId || undefined,
          metadata: {
            icdCode: d.icdCode,
            snomedCode: d.snomedCode,
            diagnosisType: d.diagnosisType,
            severity: d.severity,
            status: d.status,
          },
          aiGenerated: d.aiSuggested,
        });
      });
    }

    // Fetch Medications
    if (!types || types.includes('medication')) {
      const medications = await db.patientMedication.findMany({
        where: {
          patientId,
          status: 'active',
          ...dateFilter,
        },
        orderBy: { prescribedDate: 'desc' },
        take: limit,
      });

      medications.forEach(m => {
        events.push({
          id: `medication-${m.id}`,
          type: 'medication',
          title: m.medicationName,
          description: `${m.dosage || ''} ${m.frequency || ''} ${m.route || ''}`.trim(),
          date: m.prescribedDate,
          consultationId: m.consultationId || undefined,
          metadata: {
            genericName: m.genericName,
            dosage: m.dosage,
            frequency: m.frequency,
            route: m.route,
            duration: m.duration,
            prescribedBy: m.prescribedBy,
            status: m.status,
            interactionAlerts: m.interactionAlerts,
          },
        });
      });
    }

    // Fetch Lab Results
    if (!types || types.includes('lab_result')) {
      const labResults = await db.labResult.findMany({
        where: {
          patientId,
          ...dateFilter,
        },
        orderBy: { resultDate: 'desc' },
        take: limit,
      });

      labResults.forEach(l => {
        events.push({
          id: `lab-${l.id}`,
          type: 'lab_result',
          title: l.testName,
          description: `Result: ${l.resultValue} ${l.unit || ''} (${l.interpretation || 'N/A'})`,
          date: l.resultDate || l.orderedDate,
          metadata: {
            testCode: l.testCode,
            category: l.category,
            resultValue: l.resultValue,
            unit: l.unit,
            referenceRange: l.referenceRange,
            interpretation: l.interpretation,
            aiInterpretation: l.aiInterpretation,
            aiAlertFlag: l.aiAlertFlag,
          },
          aiGenerated: !!l.aiInterpretation,
        });
      });
    }

    // Fetch Voice Notes
    if (!types || types.includes('voice_note')) {
      const voiceNotes = await db.voiceNote.findMany({
        where: {
          patientId,
          ...dateFilter,
        },
        orderBy: { recordedAt: 'desc' },
        take: limit,
      });

      voiceNotes.forEach(v => {
        events.push({
          id: `voice-${v.id}`,
          type: 'voice_note',
          title: `Voice Note (${v.noteType})`,
          description: v.transcription.slice(0, 150),
          date: v.recordedAt,
          consultationId: v.consultationId || undefined,
          metadata: {
            noteType: v.noteType,
            audioDuration: v.audioDuration,
            status: v.status,
            tags: v.tags,
          },
        });
      });
    }

    // Sort all events by date (newest first)
    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Apply limit after sorting
    const limitedEvents = events.slice(0, limit);

    // Group events by date for easier display
    const groupedByDate = limitedEvents.reduce((acc, event) => {
      const dateKey = event.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, TimelineEvent[]>);

    // Get patient summary
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        allergies: true,
        chronicConditions: true,
        createdAt: true,
      },
    });

    // Get counts
    const counts = {
      consultations: await db.consultation.count({ where: { patientId } }),
      aiInteractions: await db.aIInteraction.count({ where: { patientId } }),
      diagnoses: await db.diagnosis.count({ where: { patientId, status: 'active' } }),
      medications: await db.patientMedication.count({ where: { patientId, status: 'active' } }),
      labResults: await db.labResult.count({ where: { patientId } }),
      voiceNotes: await db.voiceNote.count({ where: { patientId } }),
    };

    return NextResponse.json({
      success: true,
      data: {
        patient,
        events: limitedEvents,
        groupedByDate,
        counts,
        dateRange: {
          from: fromDate || null,
          to: toDate || null,
        },
      },
    });
  } catch (error) {
    console.error('Patient timeline error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve patient timeline' },
      { status: 500 }
    );
  }
}
