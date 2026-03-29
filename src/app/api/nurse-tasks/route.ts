/**
 * Nurse Tasks API Route - HIPAA Compliant
 * ========================================
 *
 * Comprehensive nursing task management for clinical workflow
 * Supports 28+ standardized nursing tasks with workflow states
 *
 * All operations require authentication and appropriate permissions:
 * - GET: nurse_task:read
 * - POST: nurse_task:write
 * - PUT: nurse_task:write
 * - DELETE: nurse_task:write
 *
 * Audit trail is maintained for all PHI access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { authenticateRequest, checkPermission, AuthenticatedUser } from '@/lib/auth-middleware';
import { createAuditLog } from '@/lib/audit-service';

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
// Permission: nurse_task:read
export async function GET(request: NextRequest) {
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
  if (!checkPermission(user, 'nurse_task:read')) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions: nurse_task:read required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const priority = searchParams.get('priority');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    const where: Prisma.NurseTaskWhereInput = {};
    
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (priority) where.priority = priority;

    const tasks = await db.nurseTask.findMany({
      where,
      take: limit,
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

    // Log PHI access
    await logPHIAccess(user, 'READ', 'nurse_tasks', tasks.length);

    return NextResponse.json({
      success: true,
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
// Permission: nurse_task:write
export async function POST(request: NextRequest) {
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
  if (!checkPermission(user, 'nurse_task:write')) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions: nurse_task:write required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      patientId,
      soapNoteId,
      taskDescription,
      taskType,
      priority = 'routine',
      assignedTo,
      dueBy,
      notes,
    } = body;

    // Validate required fields
    if (!patientId || !taskDescription) {
      return NextResponse.json(
        { success: false, error: 'patientId and taskDescription are required' },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Validate priority
    const validPriorities = ['urgent', 'routine', 'low'] as const;
    const taskPriority = validPriorities.includes(priority as any) ? priority : 'routine';

    // Create the task with authenticated user as assigner
    const task = await db.nurseTask.create({
      data: {
        patientId,
        soapNoteId,
        taskDescription,
        priority: taskPriority,
        status: 'pending',
        assignedTo,
        assignedBy: user.employeeId,
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
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'create',
      resourceType: 'nurse_task',
      resourceId: task.id,
      patientId,
      newValue: JSON.stringify({ taskDescription, priority, assignedTo }),
    });

    // Log PHI access
    await logPHIAccess(user, 'CREATE', 'nurse_task', task.id, { patientId, taskDescription });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task created successfully',
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating nurse task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create nurse task' },
      { status: 500 }
    );
  }
}

// PUT - Update task (bulk update supported)
// Permission: nurse_task:write
export async function PUT(request: NextRequest) {
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
  if (!checkPermission(user, 'nurse_task:write')) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions: nurse_task:write required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { taskId, updates, completionNotes } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'taskId is required' },
        { status: 400 }
      );
    }

    const existingTask = await db.nurseTask.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    // Validate updates
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'updates object is required' },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'] as const;
    if (updates.status && !validStatuses.includes(updates.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Prisma.NurseTaskUpdateInput = {
      ...updates,
    };

    // Handle task completion
    if (updates.status === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedBy = user.employeeId;
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
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: updates.status === 'completed' ? 'update' : 'update',
      resourceType: 'nurse_task',
      resourceId: taskId,
      patientId: existingTask.patientId,
      oldValue: JSON.stringify({ status: existingTask.status }),
      newValue: JSON.stringify(updates),
    });

    // Log PHI access
    await logPHIAccess(user, 'UPDATE', 'nurse_task', taskId, { updates });

    return NextResponse.json({
      success: true,
      task,
      message: updates.status === 'completed' ? 'Task completed' : 'Task updated',
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating nurse task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update nurse task' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel task
// Permission: nurse_task:write
export async function DELETE(request: NextRequest) {
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
  if (!checkPermission(user, 'nurse_task:write')) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions: nurse_task:write required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const reason = searchParams.get('reason');

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'taskId is required' },
        { status: 400 }
      );
    }

    const existingTask = await db.nurseTask.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    // Mark as cancelled instead of deleting
    const task = await db.nurseTask.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        notes: existingTask.notes 
          ? `${existingTask.notes}\nCancelled: ${reason || 'No reason provided'} by ${user.employeeId}`
          : `Cancelled: ${reason || 'No reason provided'} by ${user.employeeId}`,
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'delete',
      resourceType: 'nurse_task',
      resourceId: taskId,
      patientId: existingTask.patientId,
      newValue: JSON.stringify({ cancelled: true, reason }),
    });

    // Log PHI access
    await logPHIAccess(user, 'DELETE', 'nurse_task', taskId, { reason });

    return NextResponse.json({
      success: true,
      message: 'Task cancelled',
      meta: {
        cancelledBy: user.employeeId,
        cancelledAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error cancelling nurse task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel nurse task' },
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
