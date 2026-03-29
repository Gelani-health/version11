/**
 * Nurse Tasks API Route
 * =====================
 *
 * Comprehensive nursing task management for clinical workflow
 * Supports 28+ standardized nursing tasks with workflow states
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Standard nursing task types
export const NURSING_TASK_TYPES = [
  // Vital Signs & Monitoring
  { id: 'vitals-routine', name: 'Routine Vital Signs', category: 'monitoring', defaultPriority: 'routine', estimatedMinutes: 5 },
  { id: 'vitals-frequency', name: 'Frequent Vital Signs (q4h)', category: 'monitoring', defaultPriority: 'routine', estimatedMinutes: 5 },
  { id: 'vitals-critical', name: 'Critical Vital Signs (q1h)', category: 'monitoring', defaultPriority: 'urgent', estimatedMinutes: 5 },
  { id: 'neuro-check', name: 'Neurological Assessment', category: 'monitoring', defaultPriority: 'routine', estimatedMinutes: 10 },
  { id: 'cardiac-monitor', name: 'Cardiac Monitoring Setup', category: 'monitoring', defaultPriority: 'routine', estimatedMinutes: 15 },
  
  // Medication Administration
  { id: 'med-admin', name: 'Medication Administration', category: 'medication', defaultPriority: 'routine', estimatedMinutes: 10 },
  { id: 'iv-start', name: 'IV Line Insertion', category: 'medication', defaultPriority: 'routine', estimatedMinutes: 20 },
  { id: 'iv-fluids', name: 'IV Fluid Management', category: 'medication', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'blood-transfusion', name: 'Blood Transfusion Administration', category: 'medication', defaultPriority: 'urgent', estimatedMinutes: 60 },
  { id: 'insulin-admin', name: 'Insulin Administration', category: 'medication', defaultPriority: 'routine', estimatedMinutes: 10 },
  
  // Wound Care
  { id: 'wound-dressing', name: 'Wound Dressing Change', category: 'wound_care', defaultPriority: 'routine', estimatedMinutes: 20 },
  { id: 'wound-assessment', name: 'Wound Assessment', category: 'wound_care', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'surgical-site-care', name: 'Surgical Site Care', category: 'wound_care', defaultPriority: 'routine', estimatedMinutes: 20 },
  
  // Patient Care
  { id: 'admission', name: 'Patient Admission', category: 'patient_care', defaultPriority: 'routine', estimatedMinutes: 45 },
  { id: 'discharge', name: 'Patient Discharge', category: 'patient_care', defaultPriority: 'routine', estimatedMinutes: 30 },
  { id: 'transfer', name: 'Patient Transfer', category: 'patient_care', defaultPriority: 'routine', estimatedMinutes: 30 },
  { id: 'fall-prevention', name: 'Fall Prevention Protocol', category: 'patient_care', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'mobility-assist', name: 'Mobility Assistance', category: 'patient_care', defaultPriority: 'routine', estimatedMinutes: 15 },
  
  // Specimen Collection
  { id: 'blood-draw', name: 'Blood Specimen Collection', category: 'specimen', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'urine-collection', name: 'Urine Specimen Collection', category: 'specimen', defaultPriority: 'routine', estimatedMinutes: 10 },
  { id: 'culture-collection', name: 'Culture Specimen Collection', category: 'specimen', defaultPriority: 'routine', estimatedMinutes: 15 },
  
  // Respiratory Care
  { id: 'oxygen-therapy', name: 'Oxygen Therapy Management', category: 'respiratory', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'suctioning', name: 'Airway Suctioning', category: 'respiratory', defaultPriority: 'routine', estimatedMinutes: 10 },
  { id: 'nebulizer', name: 'Nebulizer Treatment', category: 'respiratory', defaultPriority: 'routine', estimatedMinutes: 20 },
  
  // Patient Education
  { id: 'med-education', name: 'Medication Education', category: 'education', defaultPriority: 'routine', estimatedMinutes: 20 },
  { id: 'discharge-education', name: 'Discharge Education', category: 'education', defaultPriority: 'routine', estimatedMinutes: 30 },
  { id: 'disease-education', name: 'Disease Management Education', category: 'education', defaultPriority: 'routine', estimatedMinutes: 25 },
  
  // Documentation
  { id: 'care-plan-update', name: 'Care Plan Update', category: 'documentation', defaultPriority: 'routine', estimatedMinutes: 15 },
  { id: 'incident-report', name: 'Incident Report', category: 'documentation', defaultPriority: 'urgent', estimatedMinutes: 30 },
] as const;

// GET - List nurse tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const priority = searchParams.get('priority');

    const where: Prisma.NurseTaskWhereInput = {};
    
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (priority) where.priority = priority;

    const tasks = await db.nurseTask.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
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
        assigner: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
        soapNote: {
          select: {
            encounterId: true,
            chiefComplaint: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueBy: 'asc' },
        { assignedAt: 'desc' },
      ],
    });

    // Get task statistics
    const stats = await db.nurseTask.groupBy({
      by: ['status'],
      _count: true,
    });

    const priorityStats = await db.nurseTask.groupBy({
      by: ['priority'],
      _count: true,
      where: { status: { in: ['pending', 'in-progress'] } },
    });

    return NextResponse.json({
      tasks,
      taskTypes: NURSING_TASK_TYPES,
      statistics: {
        byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byPriority: priorityStats.reduce((acc, p) => ({ ...acc, [p.priority]: p._count }), {}),
        totalPending: tasks.filter(t => t.status === 'pending').length,
        totalInProgress: tasks.filter(t => t.status === 'in-progress').length,
        totalOverdue: tasks.filter(t => t.dueBy && new Date(t.dueBy) < new Date() && t.status !== 'completed').length,
      },
    });
  } catch (error) {
    console.error('Error fetching nurse tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new nurse task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      soapNoteId,
      taskDescription,
      taskType,
      priority = 'routine',
      assignedTo,
      assignedBy,
      dueBy,
      notes,
    } = body;

    // Validate required fields
    if (!patientId || !taskDescription || !assignedBy) {
      return NextResponse.json(
        { error: 'patientId, taskDescription, and assignedBy are required' },
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

    // Create the task
    const task = await db.nurseTask.create({
      data: {
        patientId,
        soapNoteId,
        taskDescription,
        priority,
        status: 'pending',
        assignedTo,
        assignedBy,
        dueBy: dueBy ? new Date(dueBy) : null,
        notes,
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorId: assignedBy,
        actorName: 'System',
        actorRole: 'nurse',
        actionType: 'CREATE',
        resourceType: 'NurseTask',
        resourceId: task.id,
        patientId,
        newValue: JSON.stringify({ taskDescription, priority, assignedTo }),
      },
    });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task created successfully',
    });
  } catch (error) {
    console.error('Error creating nurse task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update task (bulk update supported)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, updates, completedBy, completionNotes } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const existingTask = await db.nurseTask.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Prisma.NurseTaskUpdateInput = {
      ...updates,
    };

    // Handle task completion
    if (updates.status === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedBy = completedBy || updates.assignedTo;
      if (completionNotes) {
        updateData.notes = existingTask.notes 
          ? `${existingTask.notes}\n${completionNotes}`
          : completionNotes;
      }
    }

    const task = await db.nurseTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorId: completedBy || existingTask.assignedTo || 'system',
        actorName: 'System',
        actorRole: 'nurse',
        actionType: updates.status === 'completed' ? 'COMPLETE' : 'UPDATE',
        resourceType: 'NurseTask',
        resourceId: taskId,
        patientId: existingTask.patientId,
        oldValue: JSON.stringify({ status: existingTask.status }),
        newValue: JSON.stringify(updates),
      },
    });

    return NextResponse.json({
      success: true,
      task,
      message: updates.status === 'completed' ? 'Task completed' : 'Task updated',
    });
  } catch (error) {
    console.error('Error updating nurse task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const cancelledBy = searchParams.get('cancelledBy');
    const reason = searchParams.get('reason');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const existingTask = await db.nurseTask.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Mark as cancelled instead of deleting
    const task = await db.nurseTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        notes: existingTask.notes 
          ? `${existingTask.notes}\nCancelled: ${reason || 'No reason provided'}`
          : `Cancelled: ${reason || 'No reason provided'}`,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorId: cancelledBy || 'system',
        actorName: 'System',
        actorRole: 'nurse',
        actionType: 'DELETE',
        resourceType: 'NurseTask',
        resourceId: taskId,
        patientId: existingTask.patientId,
        newValue: JSON.stringify({ cancelled: true, reason }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task cancelled',
    });
  } catch (error) {
    console.error('Error cancelling nurse task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
