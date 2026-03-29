/**
 * Nurse Tasks API Route
 * 
 * Manages nursing workflow tasks including the 28 standardized tasks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authMiddleware } from '@/lib/auth-middleware';
import { z } from 'zod';

// Standard 28 nursing tasks organized by category
const NURSING_TASK_CATEGORIES = {
  vital_signs: [
    { id: 'vitals_complete', name: 'Complete Vital Signs Check', priority: 'routine' },
    { id: 'vitals_post_med', name: 'Post-Medication Vitals', priority: 'routine' },
    { id: 'vitals_neuro', name: 'Neurological Vitals', priority: 'urgent' },
    { id: 'vitals_post_op', name: 'Post-Operative Vitals', priority: 'urgent' },
  ],
  medication: [
    { id: 'med_admin', name: 'Medication Administration', priority: 'routine' },
    { id: 'med_iv_start', name: 'Start IV Line', priority: 'routine' },
    { id: 'med_iv_site_check', name: 'IV Site Assessment', priority: 'routine' },
    { id: 'med_blood_transfusion', name: 'Blood Transfusion Monitoring', priority: 'stat' },
    { id: 'med_insulin_admin', name: 'Insulin Administration', priority: 'urgent' },
  ],
  assessment: [
    { id: 'assess_pain', name: 'Pain Assessment', priority: 'routine' },
    { id: 'assess_skin', name: 'Skin Integrity Assessment', priority: 'routine' },
    { id: 'assess_fall_risk', name: 'Fall Risk Assessment', priority: 'routine' },
    { id: 'assess_swallowing', name: 'Swallowing Assessment', priority: 'urgent' },
    { id: 'assess_mental', name: 'Mental Status Assessment', priority: 'routine' },
  ],
  hygiene: [
    { id: 'hygiene_bed_bath', name: 'Bed Bath', priority: 'routine' },
    { id: 'hygiene_oral_care', name: 'Oral Care', priority: 'routine' },
    { id: 'hygiene_hair_care', name: 'Hair Care', priority: 'routine' },
    { id: 'hygiene_perineal', name: 'Perineal Care', priority: 'routine' },
  ],
  mobility: [
    { id: 'mobility_reposition', name: 'Reposition Patient', priority: 'routine' },
    { id: 'mobility_transfer', name: 'Patient Transfer', priority: 'routine' },
    { id: 'mobility_ambulate', name: 'Ambulation Assistance', priority: 'routine' },
    { id: 'mobility_rom', name: 'Range of Motion Exercises', priority: 'routine' },
  ],
  nutrition: [
    { id: 'nut_meal_assist', name: 'Meal Assistance', priority: 'routine' },
    { id: 'nut_fluid_balance', name: 'Fluid Balance Monitoring', priority: 'routine' },
    { id: 'nut_tube_feed', name: 'Tube Feeding Administration', priority: 'urgent' },
  ],
  elimination: [
    { id: 'elim_catheter_care', name: 'Catheter Care', priority: 'routine' },
    { id: 'elim_output_measure', name: 'Measure Output', priority: 'routine' },
    { id: 'elim_bowel', name: 'Bowel Management', priority: 'routine' },
  ],
  documentation: [
    { id: 'doc_chart_update', name: 'Update Patient Chart', priority: 'routine' },
    { id: 'doc_intake_output', name: 'Document Intake/Output', priority: 'routine' },
  ],
};

// Validation schema
const createTaskSchema = z.object({
  patientId: z.string(),
  soapNoteId: z.string().optional(),
  taskDescription: z.string(),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  assignedTo: z.string().optional(),
  dueBy: z.string().optional(),
  notes: z.string().optional(),
});

// GET: List tasks or get task templates
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const templates = searchParams.get('templates');

    // Return task templates
    if (templates === 'true') {
      return NextResponse.json({
        success: true,
        data: {
          categories: NURSING_TASK_CATEGORIES,
          totalTasks: Object.values(NURSING_TASK_CATEGORIES).flat().length,
        },
      });
    }

    // Get specific task
    if (taskId) {
      const task = await prisma.nurseTask.findUnique({
        where: { id: taskId },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          assignee: { select: { employeeId: true, firstName: true, lastName: true } },
          assigner: { select: { employeeId: true, firstName: true, lastName: true } },
        },
      });
      if (!task) {
        return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: task });
    }

    // Build query
    const where: Record<string, unknown> = {};
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const tasks = await prisma.nurseTask.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        assignee: { select: { employeeId: true, firstName: true, lastName: true } },
        assigner: { select: { employeeId: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { priority: 'asc' }, // stat < urgent < routine
        { dueBy: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 100,
    });

    // Get task statistics
    const stats = await prisma.nurseTask.groupBy({
      by: ['status'],
      where: patientId ? { patientId } : {},
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error('Nurse tasks API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get tasks' }, { status: 500 });
  }
}

// POST: Create new task
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const validated = createTaskSchema.parse(body);
    const employeeId = request.headers.get('x-employee-id') || 'unknown';

    const task = await prisma.nurseTask.create({
      data: {
        patientId: validated.patientId,
        soapNoteId: validated.soapNoteId,
        taskDescription: validated.taskDescription,
        priority: validated.priority,
        assignedTo: validated.assignedTo,
        assignedBy: employeeId,
        dueBy: validated.dueBy ? new Date(validated.dueBy) : undefined,
        notes: validated.notes,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Create nurse task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}

// PUT: Update task status
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const { taskId, status, notes, completedBy } = body;
    const employeeId = request.headers.get('x-employee-id') || completedBy || 'unknown';

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status, notes };
    
    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedBy = employeeId;
    }

    const task = await prisma.nurseTask.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Update nurse task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE: Delete task
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID required' }, { status: 400 });
    }

    await prisma.nurseTask.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete nurse task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
