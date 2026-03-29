/**
 * Permissions API - Get role permissions from database
 * 
 * This endpoint allows client components to fetch role permissions
 * from the database instead of using hardcoded defaults.
 * 
 * GET /api/auth/permissions?role=doctor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRolePermissionsFromDB } from '@/lib/rbac-server';
import { isValidRole, DEFAULT_ROLE_PERMISSIONS, type UserRole } from '@/lib/rbac-types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roleName = searchParams.get('role');

  if (!roleName || !isValidRole(roleName)) {
    return NextResponse.json({
      success: false,
      error: 'Invalid or missing role parameter',
    }, { status: 400 });
  }

  try {
    // Get permissions from database (with caching)
    const permissions = await getRolePermissionsFromDB(roleName);

    return NextResponse.json({
      success: true,
      role: roleName,
      permissions,
      source: 'database',
      fallbackUsed: permissions.length === 0,
    });
  } catch (error) {
    console.error('[Permissions API] Error:', error);
    
    // Fallback to defaults on error
    return NextResponse.json({
      success: true,
      role: roleName,
      permissions: DEFAULT_ROLE_PERMISSIONS[roleName as UserRole] || [],
      source: 'fallback',
      fallbackUsed: true,
    });
  }
}
