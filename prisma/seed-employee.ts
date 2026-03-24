import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create initial employees
  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { employeeId: 'EMP-001' },
      update: {},
      create: {
        employeeId: 'EMP-001',
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@gelani.health',
        role: 'admin',
        department: 'IT',
        isActive: true,
      },
    }),
    prisma.employee.upsert({
      where: { employeeId: 'DOC-001' },
      update: {},
      create: {
        employeeId: 'DOC-001',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@gelani.health',
        phone: '+1 555-0101',
        role: 'doctor',
        department: 'Internal Medicine',
        specialty: 'Internal Medicine',
        licenseNumber: 'MD-12345',
        isActive: true,
      },
    }),
    prisma.employee.upsert({
      where: { employeeId: 'DOC-002' },
      update: {},
      create: {
        employeeId: 'DOC-002',
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael.chen@gelani.health',
        phone: '+1 555-0102',
        role: 'doctor',
        department: 'Pulmonology',
        specialty: 'Pulmonology',
        licenseNumber: 'MD-67890',
        isActive: true,
      },
    }),
    prisma.employee.upsert({
      where: { employeeId: 'NUR-001' },
      update: {},
      create: {
        employeeId: 'NUR-001',
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@gelani.health',
        phone: '+1 555-0103',
        role: 'nurse',
        department: 'Emergency',
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${employees.length} employees`);
  console.log('Employees seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
