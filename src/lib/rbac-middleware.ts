/**
 * Role-Based Access Control (RBAC) Middleware
 * Field-level access control based on user roles
 */

export type UserRole = 
  | 'doctor' 
  | 'nurse' 
  | 'admin' 
  | 'specialist' 
  | 'pharmacist' 
  | 'receptionist'
  | 'radiologist'
  | 'lab_worker';

export type Permission = 
  | 'patient:read'
  | 'patient:write'
  | 'patient:delete'
  | 'soap_note:read'
  | 'soap_note:write'
  | 'soap_note:sign'
  | 'soap_note:amend'
  | 'vitals:read'
  | 'vitals:write'
  | 'prescription:read'
  | 'prescription:write'
  | 'prescription:dispense'
  | 'clinical_order:read'
  | 'clinical_order:write'
  | 'nurse_task:read'
  | 'nurse_task:write'
  | 'audit_log:read'
  | 'employee:read'
  | 'employee:write'
  | 'ai:use'
  // Lab-specific permissions
  | 'lab:read'
  | 'lab:write'
  | 'lab:result_entry'
  | 'lab:verify'
  | 'lab:approve'
  // Imaging-specific permissions
  | 'imaging:read'
  | 'imaging:write'
  | 'imaging:perform'
  | 'imaging:interpret'
  | 'imaging:approve';

// Role-Permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  doctor: [
    'patient:read',
    'patient:write',
    'soap_note:read',
    'soap_note:write',
    'soap_note:sign',
    'soap_note:amend',
    'vitals:read',
    'prescription:read',
    'prescription:write',
    'clinical_order:read',
    'clinical_order:write',
    'nurse_task:read',
    'nurse_task:write',
    'ai:use',
    // Lab permissions for doctors
    'lab:read',
    'lab:write',
    'lab:verify',
    // Imaging permissions for doctors
    'imaging:read',
    'imaging:write',
  ],
  nurse: [
    'patient:read',
    'soap_note:read',
    'vitals:read',
    'vitals:write',
    'prescription:read',
    'clinical_order:read',
    'nurse_task:read',
    'nurse_task:write',
    // Lab permissions for nurses
    'lab:read',
    // Imaging permissions for nurses
    'imaging:read',
  ],
  admin: [
    'patient:read',
    'patient:write',
    'patient:delete',
    'soap_note:read',
    'soap_note:write',
    'soap_note:sign',
    'vitals:read',
    'prescription:read',
    'clinical_order:read',
    'clinical_order:write',
    'nurse_task:read',
    'nurse_task:write',
    'audit_log:read',
    'employee:read',
    'employee:write',
    'ai:use',
    // Full lab permissions
    'lab:read',
    'lab:write',
    'lab:result_entry',
    'lab:verify',
    'lab:approve',
    // Full imaging permissions
    'imaging:read',
    'imaging:write',
    'imaging:perform',
    'imaging:interpret',
    'imaging:approve',
  ],
  specialist: [
    'patient:read',
    'patient:write',
    'soap_note:read',
    'soap_note:write',
    'soap_note:sign',
    'soap_note:amend',
    'vitals:read',
    'prescription:read',
    'prescription:write',
    'clinical_order:read',
    'clinical_order:write',
    'nurse_task:read',
    'nurse_task:write',
    'ai:use',
    // Lab permissions for specialists
    'lab:read',
    'lab:write',
    'lab:verify',
    // Imaging permissions for specialists
    'imaging:read',
    'imaging:write',
  ],
  pharmacist: [
    'patient:read',
    'prescription:read',
    'prescription:dispense',
    'clinical_order:read',
    // Lab permissions for pharmacists (drug levels, etc.)
    'lab:read',
  ],
  receptionist: [
    'patient:read',
    'patient:write',
    'vitals:read',
    // Lab permissions for receptionists (view only)
    'lab:read',
    // Imaging permissions for receptionists (scheduling)
    'imaging:read',
  ],
  // Radiologist - Medical imaging specialist
  radiologist: [
    'patient:read',
    'clinical_order:read',
    'ai:use',
    // Imaging permissions - core radiologist capabilities
    'imaging:read',
    'imaging:write',
    'imaging:interpret',
    'imaging:approve',
    // Lab permissions - radiologists may need to view related lab results
    'lab:read',
  ],
  // Lab Worker - Laboratory technician/scientist
  lab_worker: [
    'patient:read',
    'clinical_order:read',
    'ai:use',
    // Lab permissions - core lab worker capabilities
    'lab:read',
    'lab:write',
    'lab:result_entry',
    'lab:verify',
    // Imaging permissions - lab workers may need to view related imaging
    'imaging:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.every(p => rolePermissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some(p => rolePermissions.includes(p));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * SOAP Note field-level access control
 */
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

/**
 * Get field-level access for SOAP note sections
 */
export function getSOAPFieldAccess(role: UserRole, section: SOAPSection): SOAPFieldAccess {
  const canRead = hasPermission(role, 'soap_note:read');
  const canWrite = hasPermission(role, 'soap_note:write');
  const canSign = hasPermission(role, 'soap_note:sign');
  
  // Special handling for objective section (vitals)
  if (section === 'objective') {
    return {
      canRead,
      canWrite: canWrite || hasPermission(role, 'vitals:write'),
      canSign,
    };
  }
  
  return {
    canRead,
    canWrite,
    canSign,
  };
}

/**
 * Check if user can modify a signed SOAP note
 */
export function canModifySignedNote(role: UserRole): boolean {
  return hasPermission(role, 'soap_note:amend');
}

/**
 * Check if user can prescribe medications
 */
export function canPrescribe(role: UserRole): boolean {
  return hasPermission(role, 'prescription:write');
}

/**
 * Check if user can dispense medications
 */
export function canDispense(role: UserRole): boolean {
  return hasPermission(role, 'prescription:dispense');
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(role: UserRole): boolean {
  return hasPermission(role, 'audit_log:read');
}

/**
 * Check if user can use AI features
 */
export function canUseAI(role: UserRole): boolean {
  return hasPermission(role, 'ai:use');
}

/**
 * Check if user can create clinical orders
 */
export function canCreateOrders(role: UserRole): boolean {
  return hasPermission(role, 'clinical_order:write');
}

/**
 * Check if user can assign nurse tasks
 */
export function canAssignTasks(role: UserRole): boolean {
  return hasPermission(role, 'nurse_task:write');
}

// ============================================
// LAB PERMISSION HELPERS
// ============================================

/**
 * Check if user can view lab orders and results
 */
export function canViewLab(role: UserRole): boolean {
  return hasPermission(role, 'lab:read');
}

/**
 * Check if user can create lab orders
 */
export function canOrderLab(role: UserRole): boolean {
  return hasPermission(role, 'lab:write');
}

/**
 * Check if user can enter lab results (lab worker/technician)
 */
export function canEnterLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:result_entry');
}

/**
 * Check if user can verify lab results
 */
export function canVerifyLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:verify');
}

/**
 * Check if user can approve lab results for release
 */
export function canApproveLabResults(role: UserRole): boolean {
  return hasPermission(role, 'lab:approve');
}

// ============================================
// IMAGING PERMISSION HELPERS
// ============================================

/**
 * Check if user can view imaging orders and reports
 */
export function canViewImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:read');
}

/**
 * Check if user can order imaging studies
 */
export function canOrderImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:write');
}

/**
 * Check if user can perform imaging studies (technician)
 */
export function canPerformImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:perform');
}

/**
 * Check if user can interpret imaging studies (radiologist)
 */
export function canInterpretImaging(role: UserRole): boolean {
  return hasPermission(role, 'imaging:interpret');
}

/**
 * Check if user can approve imaging reports for release
 */
export function canApproveImagingReport(role: UserRole): boolean {
  return hasPermission(role, 'imaging:approve');
}

// ============================================
// ROLE-BASED WORKFLOW HELPERS
// ============================================

/**
 * Check if role is a radiologist
 */
export function isRadiologist(role: UserRole): boolean {
  return role === 'radiologist';
}

/**
 * Check if role is a lab worker
 */
export function isLabWorker(role: UserRole): boolean {
  return role === 'lab_worker';
}

/**
 * Check if role can perform clinical duties
 */
export function isClinicalRole(role: UserRole): boolean {
  return ['doctor', 'nurse', 'specialist', 'radiologist'].includes(role);
}

/**
 * Check if role can order diagnostic tests
 */
export function canOrderDiagnostics(role: UserRole): boolean {
  return hasPermission(role, 'lab:write') || hasPermission(role, 'imaging:write');
}

/**
 * Get roles that can work in lab module
 */
export function getLabModuleRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'lab_worker', 'pharmacist', 'receptionist'];
}

/**
 * Get roles that can work in imaging module
 */
export function getImagingModuleRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'radiologist', 'receptionist'];
}

/**
 * Get roles that can enter lab results
 */
export function getLabResultEntryRoles(): UserRole[] {
  return ['lab_worker', 'admin'];
}

/**
 * Get roles that can interpret imaging
 */
export function getImagingInterpretRoles(): UserRole[] {
  return ['radiologist', 'admin'];
}

/**
 * Get role display name
 */
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

/**
 * Get role badge color
 */
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

/**
 * Validate role string
 */
export function isValidRole(role: string): role is UserRole {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist', 'radiologist', 'lab_worker'].includes(role);
}

/**
 * Get all available roles
 */
export function getAllRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist', 'radiologist', 'lab_worker'];
}

/**
 * Get roles that can be assigned by a role
 */
export function getAssignableRoles(role: UserRole): UserRole[] {
  if (role === 'admin') {
    return getAllRoles();
  }
  return []; // Only admins can assign roles
}
