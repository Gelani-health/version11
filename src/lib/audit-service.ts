/**
 * Audit Service
 * Immutable audit logging for all actions
 */

import { db } from './db';

export type AuditActionType = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'sign' 
  | 'amend' 
  | 'export'
  | 'login'
  | 'logout'
  | 'access';

export type AuditResourceType = 
  | 'patient' 
  | 'soap_note' 
  | 'vitals' 
  | 'prescription' 
  | 'clinical_order'
  | 'employee'
  | 'nurse_task'
  | 'audit_log';

export interface AuditLogInput {
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment?: string;
  actionType: AuditActionType;
  resourceType: AuditResourceType;
  resourceId?: string;
  patientMrn?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an immutable audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        actorDepartment: input.actorDepartment,
        actionType: input.actionType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        patientMrn: input.patientMrn,
        fieldChanged: input.fieldChanged,
        oldValue: input.oldValue,
        newValue: input.newValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logs should not break the main flow
    // But log the error for monitoring
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: AuditResourceType,
  resourceId: string
): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs for a patient (by MRN)
 */
export async function getPatientAuditLogs(mrn: string): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      patientMrn: mrn,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs for an employee
 */
export async function getEmployeeAuditLogs(employeeId: string): Promise<AuditLogData[]> {
  return db.auditLog.findMany({
    where: {
      actorId: employeeId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 100,
  });
}

/**
 * Get audit logs with filters
 */
export interface AuditLogFilters {
  actorId?: string;
  actionType?: AuditActionType;
  resourceType?: AuditResourceType;
  patientMrn?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function getFilteredAuditLogs(filters: AuditLogFilters): Promise<{
  logs: AuditLogData[];
  total: number;
}> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.actionType) where.actionType = filters.actionType;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.patientMrn) where.patientMrn = filters.patientMrn;
  
  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) (where.timestamp as Record<string, Date>).gte = filters.startDate;
    if (filters.endDate) (where.timestamp as Record<string, Date>).lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Format action type for display
 */
export function formatActionType(actionType: AuditActionType): string {
  const actionMap: Record<AuditActionType, string> = {
    create: 'Created',
    read: 'Viewed',
    update: 'Updated',
    delete: 'Deleted',
    sign: 'Signed',
    amend: 'Amended',
    export: 'Exported',
    login: 'Logged In',
    logout: 'Logged Out',
    access: 'Accessed',
  };
  return actionMap[actionType] || actionType;
}

/**
 * Format resource type for display
 */
export function formatResourceType(resourceType: AuditResourceType): string {
  const resourceMap: Record<AuditResourceType, string> = {
    patient: 'Patient Record',
    soap_note: 'SOAP Note',
    vitals: 'Vital Signs',
    prescription: 'Prescription',
    clinical_order: 'Clinical Order',
    employee: 'Employee Record',
    nurse_task: 'Nurse Task',
    audit_log: 'Audit Log',
  };
  return resourceMap[resourceType] || resourceType;
}

// Type for audit log data from database
export interface AuditLogData {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorDepartment: string | null;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  patientMrn: string | null;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}
