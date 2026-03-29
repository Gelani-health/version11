/**
 * Role Management API - Admin Configurable RBAC
 * 
 * Endpoints:
 * - GET: List all roles with their permissions
 * - POST: Create a new role (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';
import { clearPermissionsCache } from '@/lib/rbac-server';

// GET - List all roles with permissions
export async function GET(request: NextRequest) {
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

    const permissions = await db.permissionConfig.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    });

    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc, perm) => {
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

    // Format roles with permissions
    const formattedRoles = roles.map(role => ({
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

    return NextResponse.json({
      success: true,
      data: {
        roles: formattedRoles,
        permissions: permissionsByCategory,
        allPermissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          category: p.category,
          description: p.description,
        })),
      },
    });
  } catch (error) {
    console.error('[RBAC API] Error fetching roles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST - Create a new role
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  // Only admins can create roles
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, displayName, description, permissionIds } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { success: false, error: 'Role name and display name are required' },
        { status: 400 }
      );
    }

    // Check if role name already exists
    const existingRole = await db.roleConfig.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'Role name already exists' },
        { status: 400 }
      );
    }

    // Create role with permissions
    const role = await db.roleConfig.create({
      data: {
        name: name.toLowerCase(),
        displayName,
        description,
        isSystem: false,
        permissions: permissionIds ? {
          create: permissionIds.map((permId: string) => ({
            permissionId: permId,
            grantedBy: user.employeeId,
          })),
        } : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionType: 'CREATE',
        resourceType: 'RoleConfig',
        resourceId: role.id,
        metadata: JSON.stringify({ action: `Created role: ${displayName}` }),
        outcome: 'SUCCESS',
      },
    });

    // Clear permissions cache so new role is available immediately
    clearPermissionsCache();

    return NextResponse.json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions.map(rp => ({
          id: rp.permission.id,
          name: rp.permission.name,
          displayName: rp.permission.displayName,
        })),
      },
      message: 'Role created successfully',
    });
  } catch (error) {
    console.error('[RBAC API] Error creating role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });
