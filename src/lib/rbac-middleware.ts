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
  | 'receptionist';

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
  | 'ai:use';

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
  ],
  pharmacist: [
    'patient:read',
    'prescription:read',
    'prescription:dispense',
    'clinical_order:read',
  ],
  receptionist: [
    'patient:read',
    'patient:write',
    'vitals:read',
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
  };
  return roleColors[role] || 'bg-slate-100 text-slate-700 border-slate-200';
}

/**
 * Validate role string
 */
export function isValidRole(role: string): role is UserRole {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist'].includes(role);
}

/**
 * Get all available roles
 */
export function getAllRoles(): UserRole[] {
  return ['doctor', 'nurse', 'admin', 'specialist', 'pharmacist', 'receptionist'];
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
