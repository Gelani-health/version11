/**
 * Fix LLM Defaults Script
 * ========================
 * 
 * Ensures only one LLM provider is set as default
 * Run with: bunx tsx scripts/fix-llm-defaults.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLLMDefaults() {
  console.log('🔧 Fixing LLM default providers...\n');

  // Get all LLM providers with isDefault: true
  const defaultProviders = await prisma.lLMIntegration.findMany({
    where: { isDefault: true },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`Found ${defaultProviders.length} providers marked as default:`);
  defaultProviders.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.displayName} (priority: ${p.priority})`);
  });

  if (defaultProviders.length <= 1) {
    console.log('\n✅ Already correct - only one or zero default providers.');
    return;
  }

  // Keep the first one (highest priority, oldest) as default
  const keepDefault = defaultProviders[0];
  const othersToFix = defaultProviders.slice(1);

  console.log(`\n📌 Keeping "${keepDefault.displayName}" as default`);
  console.log(`🔄 Unsetting defaults for ${othersToFix.length} other providers...`);

  for (const provider of othersToFix) {
    await prisma.lLMIntegration.update({
      where: { id: provider.id },
      data: { isDefault: false }
    });
    console.log(`  ✓ Unset default for "${provider.displayName}"`);
  }

  // Verify the fix
  const remainingDefaults = await prisma.lLMIntegration.count({
    where: { isDefault: true }
  });

  console.log(`\n✅ Fix complete! ${remainingDefaults} provider(s) marked as default.`);

  // Show final state
  const allProviders = await prisma.lLMIntegration.findMany({
    orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }]
  });

  console.log('\n📊 Current LLM Providers:');
  allProviders.forEach((p, i) => {
    const defaultTag = p.isDefault ? ' [DEFAULT]' : '';
    const activeTag = p.isActive ? '' : ' [INACTIVE]';
    console.log(`  ${i + 1}. ${p.displayName}${defaultTag}${activeTag}`);
  });
}

fixLLMDefaults()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
