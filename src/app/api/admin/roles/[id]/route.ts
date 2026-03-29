/**
 * Individual Role Management API
 * 
 * Endpoints:
 * - GET: Get a specific role with permissions
 * - PUT: Update a role (admin only)
 * - DELETE: Delete a role (admin only, non-system roles)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';
import { clearPermissionsCache } from '@/lib/rbac-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a specific role
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const role = await db.roleConfig.findUnique({
      where: { id },
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

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error('[RBAC API] Error fetching role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role' },
      { status: 500 }
    );
  }
}

// PUT - Update a role
export const PUT = withAuth(async (request: NextRequest, user: AuthenticatedUser, { params }: RouteParams) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { displayName, description, permissionIds, isActive, priority } = body;

    // Check if role exists
    const existingRole = await db.roleConfig.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update role
    const updateData: any = {};
    if (displayName) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;

    const role = await db.roleConfig.update({
      where: { id },
      data: updateData,
    });

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Delete existing permissions
      await db.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Create new permissions
      if (permissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: permissionIds.map((permId: string) => ({
            roleId: id,
            permissionId: permId,
            grantedBy: user.employeeId,
          })),
        });
      }
    }

    // Fetch updated role with permissions
    const updatedRole = await db.roleConfig.findUnique({
      where: { id },
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
        actionType: 'UPDATE',
        resourceType: 'RoleConfig',
        resourceId: id,
        metadata: JSON.stringify({ action: `Updated role: ${role.displayName}` }),
        outcome: 'SUCCESS',
      },
    });

    // Clear permissions cache so changes take effect immediately
    clearPermissionsCache();

    return NextResponse.json({
      success: true,
      data: {
        id: updatedRole!.id,
        name: updatedRole!.name,
        displayName: updatedRole!.displayName,
        description: updatedRole!.description,
        isSystem: updatedRole!.isSystem,
        permissions: updatedRole!.permissions.map(rp => ({
          id: rp.permission.id,
          name: rp.permission.name,
          displayName: rp.permission.displayName,
        })),
      },
      message: 'Role updated successfully',
    });
  } catch (error) {
    console.error('[RBAC API] Error updating role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update role' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });

// DELETE - Delete a role (soft delete for non-system roles)
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser, { params }: RouteParams) => {
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Check if role exists
    const role = await db.roleConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete system roles' },
        { status: 400 }
      );
    }

    // Check if role has employees
    if (role._count.employees > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete role with ${role._count.employees} assigned employees. Reassign employees first.` },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await db.roleConfig.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionType: 'DELETE',
        resourceType: 'RoleConfig',
        resourceId: id,
        metadata: JSON.stringify({ action: `Deleted role: ${role.displayName}` }),
        outcome: 'SUCCESS',
      },
    });

    // Clear permissions cache so changes take effect immediately
    clearPermissionsCache();

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('[RBAC API] Error deleting role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });
