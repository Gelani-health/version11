/**
 * Check Database Status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Checking Database Status...\n');

  // Check RAG Services
  const ragServices = await prisma.rAGServiceConfig.findMany();
  console.log('📡 RAG Services:', ragServices.length);
  for (const service of ragServices) {
    console.log(`  - ${service.displayName} (${service.serviceName})`);
    console.log(`    Status: ${service.connectionStatus}`);
    console.log(`    Active: ${service.isActive}, Default: ${service.isDefault}`);
  }

  // Check LLM Integrations
  const llmIntegrations = await prisma.lLMIntegration.findMany();
  console.log('\n🤖 LLM Integrations:', llmIntegrations.length);
  for (const llm of llmIntegrations) {
    console.log(`  - ${llm.displayName} (${llm.provider})`);
    console.log(`    Model: ${llm.model}`);
    console.log(`    Status: ${llm.connectionStatus}`);
  }

  // Check Patients
  const patientCount = await prisma.patient.count();
  console.log('\n👥 Patients:', patientCount);

  // Check Employees
  const employeeCount = await prisma.employee.count();
  console.log('👤 Employees:', employeeCount);

  console.log('\n✅ Database check complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
