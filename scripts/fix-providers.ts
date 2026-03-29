import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Disable all non-working providers
  await prisma.lLMIntegration.updateMany({
    where: { provider: { in: ['ollama', 'gemini', 'other'] } },
    data: { isActive: false }
  });
  
  // Ensure ZAI is the only active one
  await prisma.lLMIntegration.updateMany({
    where: { provider: 'zai' },
    data: { isActive: true, isDefault: true, connectionStatus: 'connected', lastError: null }
  });
  
  const all = await prisma.lLMIntegration.findMany();
  console.log('Providers:');
  all.forEach(p => console.log(`  ${p.displayName}: Active=${p.isActive}, Default=${p.isDefault}, Status=${p.connectionStatus}`));
}

main().finally(() => prisma.$disconnect());
