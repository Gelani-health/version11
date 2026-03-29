/**
 * Role-Based UI Visibility Hook
 * 
 * Provides utilities for conditional rendering based on user roles and permissions.
 * This hook is CLIENT-SAFE and does not import any server-only code.
 * 
 * It fetches permissions from API routes for database-driven access control.
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import type { 
  UserRole, 
  Permission, 
  SOAPSection, 
  SOAPFieldAccess 
} from '@/lib/rbac-types';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canViewLab,
  canOrderLab,
  canEnterLabResults,
  canVerifyLabResults,
  canApproveLabResults,
  canViewImaging,
  canOrderImaging,
  canPerformImaging,
  canInterpretImaging,
  canApproveImagingReport,
  canPrescribe,
  canDispense,
  canCreateOrders,
  canUseAI,
  isRadiologist,
  isLabWorker,
  isClinicalRole,
  getRoleDisplayName,
  getRoleBadgeColor,
  getSOAPFieldAccess,
} from '@/lib/rbac-types';

// Default user for demo mode
const DEFAULT_USER = {
  id: 'demo-user',
  employeeId: 'DEMO-001',
  role: 'doctor' as UserRole,
  email: 'demo@gelani-health.ai',
  name: 'Demo Doctor',
  permissions: [
    'patient:read', 'patient:write', 'soap_note:read', 'soap_note:write', 'soap_note:sign',
    'vitals:read', 'vitals:write', 'prescription:read', 'prescription:write',
    'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write',
    'ai:use', 'lab:read', 'lab:write', 'lab:verify', 'imaging:read', 'imaging:write',
  ] as Permission[],
};

/**
 * Hook for role-based access control in UI components
 */
export function useRoleBasedAccess(user = DEFAULT_USER) {
  const role = user.role as UserRole;
  const permissions = user.permissions;
  const [dbPermissions, setDbPermissions] = useState<Permission[] | null>(null);

  // Fetch database permissions on mount (async enhancement)
  useEffect(() => {
    const fetchDbPermissions = async () => {
      try {
        const response = await fetch(`/api/auth/permissions?role=${role}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.permissions) {
            setDbPermissions(data.permissions);
          }
        }
      } catch (error) {
        // Silently fall back to default permissions
        console.debug('[RBAC Hook] Using default permissions');
      }
    };
    
    fetchDbPermissions();
  }, [role]);

  // Use database permissions if available, otherwise use user's permissions or defaults
  const effectivePermissions = useMemo(() => {
    if (dbPermissions) return dbPermissions;
    if (permissions.length > 0) return permissions;
    return getRolePermissions(role);
  }, [dbPermissions, permissions, role]);

  // Memoize permission checks
  const can = useMemo(() => ({
    // Patient access
    viewPatients: effectivePermissions.includes('patient:read'),
    createPatients: effectivePermissions.includes('patient:write'),
    editPatients: effectivePermissions.includes('patient:write'),
    deletePatients: effectivePermissions.includes('patient:delete'),
    
    // Clinical documentation
    viewSOAPNotes: effectivePermissions.includes('soap_note:read'),
    createSOAPNotes: effectivePermissions.includes('soap_note:write'),
    signSOAPNotes: effectivePermissions.includes('soap_note:sign'),
    amendSOAPNotes: effectivePermissions.includes('soap_note:amend'),
    
    // Vitals
    viewVitals: effectivePermissions.includes('vitals:read'),
    recordVitals: effectivePermissions.includes('vitals:write'),
    
    // Prescriptions
    viewPrescriptions: effectivePermissions.includes('prescription:read'),
    prescribeMedications: effectivePermissions.includes('prescription:write'),
    dispenseMedications: effectivePermissions.includes('prescription:dispense'),
    
    // Clinical orders
    viewOrders: effectivePermissions.includes('clinical_order:read'),
    createOrders: effectivePermissions.includes('clinical_order:write'),
    
    // Nurse tasks
    viewNurseTasks: effectivePermissions.includes('nurse_task:read'),
    assignNurseTasks: effectivePermissions.includes('nurse_task:write'),
    
    // Lab
    viewLab: canViewLab(role),
    orderLab: canOrderLab(role),
    enterLabResults: canEnterLabResults(role),
    verifyLabResults: canVerifyLabResults(role),
    approveLabResults: canApproveLabResults(role),
    
    // Imaging
    viewImaging: canViewImaging(role),
    orderImaging: canOrderImaging(role),
    performImaging: canPerformImaging(role),
    interpretImaging: canInterpretImaging(role),
    approveImagingReport: canApproveImagingReport(role),
    
    // AI features
    useAI: canUseAI(role),
    
    // Audit
    viewAuditLogs: effectivePermissions.includes('audit_log:read'),
    
    // Employee management
    viewEmployees: effectivePermissions.includes('employee:read'),
    manageEmployees: effectivePermissions.includes('employee:write'),
    
    // Settings
    manageSettings: effectivePermissions.includes('settings:manage'),
    
    // Roles
    manageRoles: effectivePermissions.includes('role:manage'),
  }), [role, effectivePermissions]);

  // Role helpers
  const is = useMemo(() => ({
    doctor: role === 'doctor',
    nurse: role === 'nurse',
    admin: role === 'admin',
    specialist: role === 'specialist',
    pharmacist: role === 'pharmacist',
    receptionist: role === 'receptionist',
    radiologist: isRadiologist(role),
    labWorker: isLabWorker(role),
    clinical: isClinicalRole(role),
  }), [role]);

  // UI helpers
  const ui = useMemo(() => ({
    displayName: getRoleDisplayName(role),
    badgeColor: getRoleBadgeColor(role),
  }), [role]);

  // Module visibility
  const modules = useMemo(() => ({
    patients: can.viewPatients,
    consultations: can.viewPatients && can.viewSOAPNotes,
    documentation: can.viewSOAPNotes,
    drugSafety: can.viewPrescriptions,
    laboratory: can.viewLab,
    imaging: can.viewImaging,
    analytics: can.viewPatients || can.viewAuditLogs,
    settings: can.manageSettings,
    accessControl: can.manageRoles,
  }), [can]);

  // Check specific permission
  const checkPermission = useCallback((permission: Permission): boolean => {
    return effectivePermissions.includes(permission);
  }, [effectivePermissions]);

  // Check any of the permissions
  const checkAnyPermission = useCallback((perms: Permission[]): boolean => {
    return perms.some(p => effectivePermissions.includes(p));
  }, [effectivePermissions]);

  // Check all permissions
  const checkAllPermissions = useCallback((perms: Permission[]): boolean => {
    return perms.every(p => effectivePermissions.includes(p));
  }, [effectivePermissions]);

  // Render guard component helper
  const renderIf = useCallback((
    condition: boolean,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ): React.ReactNode => {
    return condition ? component : fallback;
  }, []);

  return {
    user,
    role,
    permissions: effectivePermissions,
    can,
    is,
    ui,
    modules,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    renderIf,
  };
}

/**
 * Permission Gate Component Props
 */
export interface PermissionGateProps {
  permission?: Permission | Permission[];
  requireAll?: boolean;
  role?: UserRole | UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Permission Gate Component
 * Conditionally renders children based on permissions/roles
 */
export function PermissionGate({
  permission,
  requireAll = false,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { checkPermission, checkAnyPermission, checkAllPermissions, role: userRole } = useRoleBasedAccess();

  // Check role if specified
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(userRole)) {
      return <>{fallback}</>;
    }
  }

  // Check permission if specified
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = requireAll
      ? checkAllPermissions(permissions)
      : checkAnyPermission(permissions);
    
    if (!hasAccess) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Module Visibility Configuration
 */
export const MODULE_VISIBILITY: Record<string, {
  requiredPermission?: Permission;
  requiredRole?: UserRole[];
  label: string;
  description: string;
}> = {
  patients: {
    requiredPermission: 'patient:read',
    label: 'Patient Management',
    description: 'View and manage patient records',
  },
  consultations: {
    requiredPermission: 'clinical_order:read',
    label: 'Consultations',
    description: 'View and manage clinical consultations',
  },
  documentation: {
    requiredPermission: 'soap_note:read',
    label: 'Documentation',
    description: 'Clinical documentation and SOAP notes',
  },
  drugSafety: {
    requiredPermission: 'prescription:read',
    label: 'Drug Safety',
    description: 'Drug interactions and prescriptions',
  },
  laboratory: {
    requiredPermission: 'lab:read' as Permission,
    label: 'Laboratory',
    description: 'Lab orders and results',
  },
  imaging: {
    requiredPermission: 'imaging:read' as Permission,
    label: 'Imaging',
    description: 'Medical imaging studies',
  },
  analytics: {
    requiredPermission: 'audit_log:read',
    label: 'Analytics',
    description: 'System analytics and reports',
  },
  settings: {
    requiredRole: ['admin'],
    label: 'Settings',
    description: 'System configuration',
  },
  accessControl: {
    requiredRole: ['admin'],
    label: 'Access Control',
    description: 'Role and permission management',
  },
};

/**
 * Get visible modules for a role (sync, uses defaults)
 */
export function getVisibleModules(role: UserRole): string[] {
  const rolePermissions = {
    doctor: ['patients', 'consultations', 'documentation', 'drugSafety', 'laboratory', 'imaging', 'analytics'],
    nurse: ['patients', 'consultations', 'documentation', 'drugSafety', 'laboratory', 'imaging'],
    admin: ['patients', 'consultations', 'documentation', 'drugSafety', 'laboratory', 'imaging', 'analytics', 'settings', 'accessControl'],
    specialist: ['patients', 'consultations', 'documentation', 'drugSafety', 'laboratory', 'imaging', 'analytics'],
    pharmacist: ['patients', 'drugSafety', 'laboratory'],
    receptionist: ['patients', 'consultations', 'laboratory', 'imaging'],
    radiologist: ['patients', 'imaging', 'laboratory'],
    lab_worker: ['patients', 'laboratory', 'imaging'],
  };
  
  return rolePermissions[role] || [];
}

export default useRoleBasedAccess;
