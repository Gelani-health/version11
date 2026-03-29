/**
 * Seed Script for Configurable RBAC
 * Initializes default roles and permissions in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// All available permissions with categories
const PERMISSIONS = [
  // Patient permissions
  { name: 'patient:read', displayName: 'View Patients', category: 'Patient', description: 'View patient records and demographics' },
  { name: 'patient:write', displayName: 'Edit Patients', category: 'Patient', description: 'Create and update patient records' },
  { name: 'patient:delete', displayName: 'Delete Patients', category: 'Patient', description: 'Delete patient records (admin only)' },
  
  // Clinical Documentation
  { name: 'soap_note:read', displayName: 'View Clinical Notes', category: 'Clinical', description: 'View SOAP notes and clinical documentation' },
  { name: 'soap_note:write', displayName: 'Write Clinical Notes', category: 'Clinical', description: 'Create and edit SOAP notes' },
  { name: 'soap_note:sign', displayName: 'Sign Clinical Notes', category: 'Clinical', description: 'Sign and finalize SOAP notes' },
  { name: 'soap_note:amend', displayName: 'Amend Signed Notes', category: 'Clinical', description: 'Add amendments to signed notes' },
  
  // Vitals
  { name: 'vitals:read', displayName: 'View Vitals', category: 'Clinical', description: 'View vital signs records' },
  { name: 'vitals:write', displayName: 'Record Vitals', category: 'Clinical', description: 'Record and update vital signs' },
  
  // Prescriptions
  { name: 'prescription:read', displayName: 'View Prescriptions', category: 'Clinical', description: 'View medication prescriptions' },
  { name: 'prescription:write', displayName: 'Prescribe Medications', category: 'Clinical', description: 'Create and modify prescriptions' },
  { name: 'prescription:dispense', displayName: 'Dispense Medications', category: 'Clinical', description: 'Dispense prescribed medications' },
  
  // Orders
  { name: 'clinical_order:read', displayName: 'View Orders', category: 'Clinical', description: 'View clinical orders' },
  { name: 'clinical_order:write', displayName: 'Create Orders', category: 'Clinical', description: 'Create clinical orders' },
  
  // Nursing
  { name: 'nurse_task:read', displayName: 'View Tasks', category: 'Nursing', description: 'View nursing tasks' },
  { name: 'nurse_task:write', displayName: 'Manage Tasks', category: 'Nursing', description: 'Create and manage nursing tasks' },
  
  // Laboratory
  { name: 'lab:read', displayName: 'View Lab Results', category: 'Laboratory', description: 'View lab orders and results' },
  { name: 'lab:write', displayName: 'Order Lab Tests', category: 'Laboratory', description: 'Create lab orders' },
  { name: 'lab:result_entry', displayName: 'Enter Lab Results', category: 'Laboratory', description: 'Enter lab test results' },
  { name: 'lab:verify', displayName: 'Verify Lab Results', category: 'Laboratory', description: 'Verify lab result accuracy' },
  { name: 'lab:approve', displayName: 'Approve Lab Results', category: 'Laboratory', description: 'Approve lab results for release' },
  
  // Imaging
  { name: 'imaging:read', displayName: 'View Imaging', category: 'Imaging', description: 'View imaging orders and reports' },
  { name: 'imaging:write', displayName: 'Order Imaging', category: 'Imaging', description: 'Order imaging studies' },
  { name: 'imaging:perform', displayName: 'Perform Imaging', category: 'Imaging', description: 'Perform imaging procedures' },
  { name: 'imaging:interpret', displayName: 'Interpret Imaging', category: 'Imaging', description: 'Interpret imaging studies' },
  { name: 'imaging:approve', displayName: 'Approve Imaging Reports', category: 'Imaging', description: 'Approve imaging reports for release' },
  
  // Administration
  { name: 'audit_log:read', displayName: 'View Audit Logs', category: 'Admin', description: 'View system audit logs' },
  { name: 'employee:read', displayName: 'View Employees', category: 'Admin', description: 'View employee records' },
  { name: 'employee:write', displayName: 'Manage Employees', category: 'Admin', description: 'Create and manage employees' },
  { name: 'role:manage', displayName: 'Manage Roles', category: 'Admin', description: 'Configure roles and permissions' },
  { name: 'settings:manage', displayName: 'Manage Settings', category: 'Admin', description: 'Configure system settings' },
  
  // AI Features
  { name: 'ai:use', displayName: 'Use AI Features', category: 'AI', description: 'Access AI-powered clinical features' },
];

// Role definitions with default permissions
const ROLES = [
  {
    name: 'doctor',
    displayName: 'Doctor',
    description: 'Physician with full clinical access',
    isSystem: true,
    priority: 1,
    permissions: [
      'patient:read', 'patient:write',
      'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
      'vitals:read',
      'prescription:read', 'prescription:write',
      'clinical_order:read', 'clinical_order:write',
      'nurse_task:read', 'nurse_task:write',
      'lab:read', 'lab:write', 'lab:verify',
      'imaging:read', 'imaging:write',
      'ai:use',
    ],
  },
  {
    name: 'nurse',
    displayName: 'Nurse',
    description: 'Nursing staff with patient care access',
    isSystem: true,
    priority: 2,
    permissions: [
      'patient:read',
      'soap_note:read',
      'vitals:read', 'vitals:write',
      'prescription:read',
      'clinical_order:read',
      'nurse_task:read', 'nurse_task:write',
      'lab:read',
      'imaging:read',
    ],
  },
  {
    name: 'specialist',
    displayName: 'Specialist',
    description: 'Medical specialist with full clinical access',
    isSystem: true,
    priority: 3,
    permissions: [
      'patient:read', 'patient:write',
      'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
      'vitals:read',
      'prescription:read', 'prescription:write',
      'clinical_order:read', 'clinical_order:write',
      'nurse_task:read', 'nurse_task:write',
      'lab:read', 'lab:write', 'lab:verify',
      'imaging:read', 'imaging:write',
      'ai:use',
    ],
  },
  {
    name: 'radiologist',
    displayName: 'Radiologist',
    description: 'Medical imaging specialist',
    isSystem: true,
    priority: 4,
    permissions: [
      'patient:read',
      'clinical_order:read',
      'lab:read',
      'imaging:read', 'imaging:write', 'imaging:interpret', 'imaging:approve',
      'ai:use',
    ],
  },
  {
    name: 'lab_worker',
    displayName: 'Lab Worker',
    description: 'Laboratory technician',
    isSystem: true,
    priority: 5,
    permissions: [
      'patient:read',
      'clinical_order:read',
      'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify',
      'imaging:read',
      'ai:use',
    ],
  },
  {
    name: 'pharmacist',
    displayName: 'Pharmacist',
    description: 'Pharmacy staff',
    isSystem: true,
    priority: 6,
    permissions: [
      'patient:read',
      'prescription:read', 'prescription:dispense',
      'clinical_order:read',
      'lab:read',
    ],
  },
  {
    name: 'receptionist',
    displayName: 'Receptionist',
    description: 'Front desk staff',
    isSystem: true,
    priority: 7,
    permissions: [
      'patient:read', 'patient:write',
      'vitals:read',
      'lab:read',
      'imaging:read',
    ],
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'System administrator with full access',
    isSystem: true,
    priority: 0,
    permissions: [
      // Admin has all permissions
      'patient:read', 'patient:write', 'patient:delete',
      'soap_note:read', 'soap_note:write', 'soap_note:sign', 'soap_note:amend',
      'vitals:read', 'vitals:write',
      'prescription:read', 'prescription:write', 'prescription:dispense',
      'clinical_order:read', 'clinical_order:write',
      'nurse_task:read', 'nurse_task:write',
      'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'lab:approve',
      'imaging:read', 'imaging:write', 'imaging:perform', 'imaging:interpret', 'imaging:approve',
      'audit_log:read', 'employee:read', 'employee:write', 'role:manage', 'settings:manage',
      'ai:use',
    ],
  },
];

async function main() {
  console.log('🌱 Seeding RBAC configuration...');

  // Create permissions
  console.log('Creating permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permissionConfig.upsert({
      where: { name: perm.name },
      update: {
        displayName: perm.displayName,
        description: perm.description,
        category: perm.category,
        isSystem: true,
      },
      create: {
        name: perm.name,
        displayName: perm.displayName,
        description: perm.description,
        category: perm.category,
        isSystem: true,
      },
    });
  }
  console.log(`Created ${PERMISSIONS.length} permissions`);

  // Create roles with permissions
  console.log('Creating roles...');
  for (const role of ROLES) {
    const createdRole = await prisma.roleConfig.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        priority: role.priority,
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        priority: role.priority,
      },
    });

    // Get permission IDs
    const permissions = await prisma.permissionConfig.findMany({
      where: { name: { in: role.permissions } },
    });

    // Clear existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: createdRole.id },
    });

    // Create new permissions
    for (const perm of permissions) {
      await prisma.rolePermission.create({
        data: {
          roleId: createdRole.id,
          permissionId: perm.id,
        },
      });
    }

    console.log(`Created role ${role.name} with ${permissions.length} permissions`);
  }

  // Update existing employees to link to roles
  console.log('Updating employee role links...');
  const employees = await prisma.employee.findMany();
  const roles = await prisma.roleConfig.findMany();
  
  for (const emp of employees) {
    const roleConfig = roles.find(r => r.name === emp.role);
    if (roleConfig) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { roleId: roleConfig.id },
      });
      console.log(`Linked employee ${emp.employeeId} to role ${roleConfig.name}`);
    }
  }

  console.log('✅ RBAC seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding RBAC:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
