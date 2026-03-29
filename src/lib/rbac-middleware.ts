/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * This module provides a unified interface for RBAC functionality.
 * It re-exports from rbac-types.ts (client-safe).
 * 
 * USAGE:
 * - For client components: Import from this module, use sync functions
 * - For server code: Import from rbac-server.ts for async database functions
 * 
 * ARCHITECTURE:
 * - rbac-types.ts: Types, constants, pure functions (client-safe)
 * - rbac-server.ts: Database operations (server-only, import directly)
 * - rbac-middleware.ts: Unified interface for client-safe exports
 */

// Re-export everything from types (client-safe)
export {
  // Types
  type UserRole,
  type Permission,
  type SOAPSection,
  type SOAPFieldAccess,
  
  // Constants
  DEFAULT_ROLE_PERMISSIONS,
  
  // Pure functions (sync, safe for client)
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  getSOAPFieldAccess,
  canModifySignedNote,
  canPrescribe,
  canDispense,
  canViewAuditLogs,
  canUseAI,
  canCreateOrders,
  canAssignTasks,
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
  isRadiologist,
  isLabWorker,
  isClinicalRole,
  canOrderDiagnostics,
  getLabModuleRoles,
  getImagingModuleRoles,
  getLabResultEntryRoles,
  getImagingInterpretRoles,
  getRoleDisplayName,
  getRoleBadgeColor,
  isValidRole,
  getAllRoles,
  getAssignableRoles,
} from './rbac-types';

// Server functions (async, database-powered) are available from './rbac-server'
// Import them directly in server code:
// import { getRolePermissionsFromDB, hasPermissionAsync } from '@/lib/rbac-server';
