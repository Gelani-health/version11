/**
 * Employees API - HIPAA Compliant
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: employee:read
 * - POST: employee:write
 * 
 * Audit trail is maintained for all access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-service';
import { isValidRole } from '@/lib/rbac-middleware';
import { withAuth, AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * GET /api/employees - List employees
 * Permission: employee:read
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const department = searchParams.get('department');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (role && isValidRole(role)) {
      where.role = role;
    }
    if (department) {
      where.department = department;
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ];
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        specialty: true,
        licenseNumber: true,
        isActive: true,
        hireDate: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    // Log access
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'read',
      resourceType: 'employee',
    });

    return NextResponse.json({ 
      success: true, 
      data: employees,
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:read'] });

/**
 * POST /api/employees - Create employee
 * Permission: employee:write
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const {
      employeeId,
      firstName,
      lastName,
      email,
      phone,
      role,
      department,
      specialty,
      licenseNumber,
    } = body;

    // Validate required fields
    if (!employeeId || !firstName || !lastName || !email || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate role
    if (!isValidRole(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check for existing employee
    const existingEmployee = await db.employee.findFirst({
      where: {
        OR: [
          { employeeId },
          { email },
        ],
      },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee ID or email already exists' },
        { status: 400 }
      );
    }

    const employee = await db.employee.create({
      data: {
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        role,
        department,
        specialty,
        licenseNumber,
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'create',
      resourceType: 'employee',
      resourceId: employee.id,
      newValue: JSON.stringify({
        employeeId,
        firstName,
        lastName,
        email,
        role,
      }),
    });

    return NextResponse.json({ 
      success: true, 
      data: employee,
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['employee:write'] });
