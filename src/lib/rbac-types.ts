/**
 * RBAC Types and Constants
 * 
 * This module contains ONLY types, constants, and pure functions.
 * It is SAFE to import this in both client and server components.
 * 
 * No database imports, no Node.js APIs - just TypeScript definitions.
 */

// ============================================
// USER ROLES
// ============================================

export type UserRole = 
  | 'doctor' 
  | 'nurse' 
  | 'admin' 
  | 'specialist' 
  | 'pharmacist' 
  | 'receptionist'
  | 'radiologist'
  | 'lab_worker';

// ============================================
// PERMISSIONS
// ============================================

export type Permission = 
  // Patient permissions
  | 'patient:read'
  | 'patient:write'
  | 'patient:delete'
  // Clinical Documentation
  | 'soap_note:read'
  | 'soap_note:write'
  | 'soap_note:sign'
  | 'soap_note:amend'
  // Vitals
  | 'vitals:read'
  | 'vitals:write'
  // Prescriptions
  | 'prescription:read'
  | 'prescription:write'
  | 'prescription:dispense'
  // Orders
  | 'clinical_order:read'
  | 'clinical_order:write'
  // Nursing
  | 'nurse_task:read'
  | 'nurse_task:write'
  // Laboratory
  | 'lab:read'
  | 'lab:write'
  | 'lab:result_entry'
  | 'lab:verify'
  | 'lab:approve'
  // Imaging
  | 'imaging:read'
  | 'imaging:write'
  | 'imaging:perform'
  | 'imaging:interpret'
  | 'imaging:approve'
  // Administration
  | 'audit_log:read'
  | 'employee:read'
  | 'employee:write'
  | 'role:manage'
  | 'settings:manage'
  // AI Features
  | 'ai:use';

// ============================================
// DEFAULT ROLE PERMISSIONS (Fallback)
// ============================================

/**
 * Default role-permission mapping
 * Used as fallback when database is unavailable
 * Also used by client components for immediate UI decisions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  doctor: [
    'patient:read', 'patient:write',
    'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
    'vitals:read',
    'prescription:read', 'prescription:write',
    'clinical_order:read', 'clinical_order:write',
    'nurse_task:read', 'nurse_task:write',
    'ai:use',
    'lab:read', 'lab:write', 'lab:verify',
    'imaging:read', 'imaging:write',
  ],
  nurse: [
    'patient:read',
    'soap_note:read',
    'vitals:read', 'vitals:write',
    'prescription:read',
    'clinical_order:read',
    'nurse_task:read', 'nurse_task:write',
    'lab:read',
    'imaging:read',
  ],
  admin: [
    'patient:read', 'patient:write', 'patient:delete',
    'soap_note:read', 'soap_note:write', 'soap_note:sign',
    'vitals:read',
    'prescription:read',
    'clinical_order:read', 'clinical_order:write',
    'nurse_task:read', 'nurse_task:write',
    'audit_log:read', 'employee:read', 'employee:write', 'ai:use',
    'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'lab:approve',
    'imaging:read', 'imaging:write', 'imaging:perform', 'imaging:interpret', 'imaging:approve',
    'role:manage', 'settings:manage',
  ],
  specialist: [
    'patient:read', 'patient:write',
    'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
    'vitals:read',
    'prescription:read', 'prescription:write',
    'clinical_order:read', 'clinical_order:write',
    'nurse_task:read', 'nurse_task:write',
    'ai:use',
    'lab:read', 'lab:write', 'lab:verify',
    'imaging:read', 'imaging:write',
  ],
  pharmacist: [
    'patient:read',
    'prescription:read', 'prescription:dispense',
    'clinical_order:read',
    'lab:read',
  ],
  receptionist: [
    'patient:read', 'patient:write',
    'vitals:read',
    'lab:read',
    'imaging:read',
  ],
  radiologist: [
    'patient:read',
    'clinical_order:read',
    'ai:use',
    'imaging:read', 'imaging:write', 'imaging:interpret', 'imaging:approve',
    'lab:read',
  ],
  lab_worker: [
    'patient:read',
    'clinical_order:read',
    'ai:use',
    'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify',
    'imaging:read',
  ],
};

// ============================================
// PURE HELPER FUNCTIONS (Client-Safe)
// ============================================

/**
 * Check if a role has a specific permission (sync, uses defaults)
 * This is safe for client-side use
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return permissions.every(p => rolePermissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return permissions.some(p => rolePermissions.includes(p));
}

/**
 * Get all permissions for a role (from defaults)
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

// ============================================
// SOAP NOTE FIELD ACCESS
// ============================================

export type SOAPSection = 
  | 'subjective'
  | 'objective'
  | 'assessment'
  | 'plan';

export interface SOAPFieldAccess {
  canRead: boolean;
  canWrite: boolean;
  canSign: boolean;
}

export function getSOAPFieldAccess(role: UserRole, section: SOAPSection): SOAPFieldAccess {
  const canRead = hasPermission(role, 'soap_note:read');
  const canWrite = hasPermission(role, 'soap_note:write');
  const canSign = hasPermission(role, 'soap_note:sign');
  
  if (section === 'objective') {
    return {
      canRead,
      canWrite: canWrite || hasPermission(role, 'vitals:write'),
      canSign,
    };
  }
  
  return { canRead, canWrite, canSign };
}

// ============================================
// PERMISSION HELPER FUNCTIONS
// ============================================

export function canModifySignedNote(role: UserRole): boolean {
  return hasPermission(role, 'soap_note:amend');
}

export function canPrescribe(role: UserRole): boolean {
  return hasPermission(role, 'prescription:write');
}

export function canDispense(role: UserRole): boolean {
  return hasPermission(role, 'prescription:dispense');
}

export function canViewAuditLogs(role: UserRole): boolean {
  return hasPermission(role, 'audit_log:read');
}

export function canUseAI(role: UserRole): boolean {
  return hasPermission(role, 'ai:use');
}

export function canCreateOrders(role: UserRole): boolean {
  return hasPermission(role, 'clinical_order:write');
}

export function canAssignTasks(role: UserRole): boolean {
  return hasPermission(role, 'nurse_task:write');
}

// Lab permissions
export function canViewLab(role: UserRole): boolean {
  return hasPermission(role, 'lab:read');
}

export function canOrderLab(role: UserRole): boolean {
  return hasPermission(role, 'lab:write');
}

export function canEnterLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:result_entry');
}

export function canVerifyLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:verify');
}

export function canApproveLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:approve');
}

// Imaging permissions
export function canViewImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:read');
}

export function canOrderImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:write');
}

export function canPerformImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:perform');
}

export function canInterpretImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:interpret');
}

export function canApproveImagingReport(role: UserRole): boolean {
  return hasPermission(role, 'imaging:approve');
}

// Role helpers
export function isRadiologist(role: UserRole): boolean {
  return role === 'radiologist';
}

export function isLabWorker(role: UserRole): boolean {
  return role === 'lab_worker';
}

export function isClinicalRole(role: UserRole): boolean {
  return ['doctor', 'nurse', 'specialist', 'radiologist'].includes(role);
}

export function canOrderDiagnostics(role: UserRole): boolean {
  return hasPermission(role, 'lab:write') || hasPermission(role, 'imaging:write');
}

export function getLabModuleRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'lab_worker', 'pharmacist', 'receptionist'];
}

export function getImagingModuleRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'radiologist', 'receptionist'];
}

export function getLabResultEntryRoles(): UserRole[] {
  return ['lab_worker', 'admin'];
}

export function getImagingInterpretRoles(): UserRole[] {
  return ['radiologist', 'admin'];
}

// ============================================
// ROLE DISPLAY HELPERS
// ============================================

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    doctor: 'Doctor',
    nurse: 'Nurse',
    admin: 'Administrator',
    specialist: 'Specialist',
    pharmacist: 'Pharmacist',
    receptionist: 'Receptionist',
    radiologist: 'Radiologist',
    lab_worker: 'Lab Worker',
  };
  return roleNames[role] || role;
}

export function getRoleBadgeColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    doctor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    nurse: 'bg-blue-100 text-blue-700 border-blue-200',
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    specialist: 'bg-amber-100 text-amber-700 border-amber-200',
    pharmacist: 'bg-pink-100 text-pink-700 border-pink-200',
    receptionist: 'bg-slate-100 text-slate-700 border-slate-200',
    radiologist: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    lab_worker: 'bg-teal-100 text-teal-700 border-teal-200',
  };
  return roleColors[role] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function isValidRole(role: string): role is UserRole {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist', 'radiologist', 'lab_worker'].includes(role);
}

export function getAllRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist', 'radiologist', 'lab_worker'];
}

export function getAssignableRoles(role: UserRole): UserRole[] {
  if (role === 'admin') {
    return getAllRoles();
  }
  return [];
}
