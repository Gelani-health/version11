/**
 * RBAC Server Module
 * 
 * This module contains DATABASE-POWERED permission functions.
 * It should ONLY be imported by:
 * - API Routes
 * - Server Actions
 * - Server Components
 * 
 * DO NOT import this in client components or hooks.
 * Use the API routes instead.
 */

import { db } from './db';
import type { UserRole, Permission } from './rbac-types';
import { DEFAULT_ROLE_PERMISSIONS } from './rbac-types';

// Cache for role permissions (refreshed every 5 minutes)
let permissionsCache: Map<string, Permission[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get permissions for a role from database (with caching)
 * Falls back to default permissions if database is unavailable
 */
export async function getRolePermissionsFromDB(roleName: string): Promise<Permission[]> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (now - cacheTimestamp < CACHE_TTL && permissionsCache.has(roleName)) {
    return permissionsCache.get(roleName) || [];
  }

  try {
    // Fetch role with permissions from database
    const role = await db.roleConfig.findFirst({
      where: {
        name: roleName,
        isActive: true,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (role && role.permissions.length > 0) {
      const permissions = role.permissions
        .filter(rp => rp.permission.isActive)
        .map(rp => rp.permission.name as Permission)
        .filter(Boolean);
      
      // Update cache
      permissionsCache.set(roleName, permissions);
      cacheTimestamp = now;
      
      return permissions;
    }
  } catch (error) {
    console.warn('[RBAC Server] Database lookup failed, using default permissions:', error);
  }

  // Fallback to default permissions
  return DEFAULT_ROLE_PERMISSIONS[roleName as UserRole] || [];
}

/**
 * Clear the permissions cache (call when roles are updated)
 */
export function clearPermissionsCache(): void {
  permissionsCache.clear();
  cacheTimestamp = 0;
}

/**
 * Async permission check from database
 */
export async function hasPermissionAsync(role: UserRole, permission: Permission): Promise<boolean> {
  const permissions = await getRolePermissionsFromDB(role);
  return permissions.includes(permission);
}

/**
 * Check if a role has all of the specified permissions
 */
export async function hasAllPermissionsAsync(role: UserRole, permissions: Permission[]): Promise<boolean> {
  const rolePermissions = await getRolePermissionsFromDB(role);
  return permissions.every(p => rolePermissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export async function hasAnyPermissionAsync(role: UserRole, permissions: Permission[]): Promise<boolean> {
  const rolePermissions = await getRolePermissionsFromDB(role);
  return permissions.some(p => rolePermissions.includes(p));
}

/**
 * Get all permissions for a role from database
 */
export async function getRolePermissionsAsync(role: UserRole): Promise<Permission[]> {
  return getRolePermissionsFromDB(role);
}

/**
 * Get all roles with their permissions
 */
export async function getAllRolesWithPermissions() {
  try {
    const roles = await db.roleConfig.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { displayName: 'asc' }],
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      priority: role.priority,
      employeeCount: role._count.employees,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
      })),
    }));
  } catch (error) {
    console.error('[RBAC Server] Failed to get roles:', error);
    return [];
  }
}

/**
 * Get all available permissions grouped by category
 */
export async function getAllPermissions() {
  try {
    const permissions = await db.permissionConfig.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    });

    // Group by category
    const byCategory = permissions.reduce((acc, perm) => {
      const category = perm.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: perm.id,
        name: perm.name,
        displayName: perm.displayName,
        description: perm.description,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      all: permissions.map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        category: p.category,
        description: p.description,
      })),
      byCategory,
    };
  } catch (error) {
    console.error('[RBAC Server] Failed to get permissions:', error);
    return { all: [], byCategory: {} };
  }
}

// Re-export types for convenience
export type { UserRole, Permission } from './rbac-types';
