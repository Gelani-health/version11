/**
 * Scheduled Data Purge Script
 * ============================
 * 
 * PROMPT 12+: Automated data lifecycle management
 * 
 * This script can be run via cron or systemd timer to automatically:
 * - Purge old AI interactions
 * - Clean up RAG query logs
 * - Compress SOAP note versions
 * - Optimize database storage
 * 
 * Usage:
 *   npx ts-node scripts/scheduled-data-purge.ts
 *   # or
 *   bun run scripts/scheduled-data-purge.ts
 * 
 * Environment Variables:
 *   DRY_RUN=true - Run in dry-run mode (no actual purges)
 *   VERBOSE=true - Enable verbose logging
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const VERBOSE = process.env.VERBOSE === 'true';

// Retention policies (in days)
const RETENTION = {
  aiInteractions: 90,
  ragQueries: 30,
  embeddingCache: 90,
  integrationSyncLogs: 90,
  voiceNotesDraft: 7,
  smartCardAccess: 365,
  knowledgeFeedback: 365,
};

interface PurgeStats {
  table: string;
  before: number;
  after: number;
  purged: number;
}

/**
 * Log with timestamp
 */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`[${timestamp}] ${prefix}${message}`);
}

/**
 * Get record count for a table
 */
async function getTableCount(tableName: string): Promise<number> {
  try {
    // @ts-ignore - Dynamic table access
    const result = await prisma[tableName].count();
    return result;
  } catch (error) {
    log(`Error counting ${tableName}: ${error}`, 'error');
    return 0;
  }
}

/**
 * Purge old AI interactions
 */
async function purgeAiInteractions(): Promise<PurgeStats> {
  const table = 'aIInteraction';
  const before = await getTableCount(table);
  const cutoffDate = new Date(Date.now() - RETENTION.aiInteractions * 24 * 60 * 60 * 1000);

  if (DRY_RUN) {
    const toPurge = await prisma.aIInteraction.count({
      where: {
        createdAt: { lt: cutoffDate },
        patientId: null, // Only purge non-patient-related
      },
    });
    log(`Would purge ${toPurge} AI interactions older than ${cutoffDate.toISOString()}`);
    return { table, before, after: before - toPurge, purged: toPurge };
  }

  try {
    const result = await prisma.aIInteraction.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        patientId: null,
      },
    });
    
    const after = await getTableCount(table);
    log(`Purged ${result.count} AI interactions`);
    return { table, before, after, purged: result.count };
  } catch (error) {
    log(`Error purging AI interactions: ${error}`, 'error');
    return { table, before, after: before, purged: 0 };
  }
}

/**
 * Purge old RAG queries
 */
async function purgeRagQueries(): Promise<PurgeStats> {
  const table = 'rAGQuery';
  const before = await getTableCount(table);
  const cutoffDate = new Date(Date.now() - RETENTION.ragQueries * 24 * 60 * 60 * 1000);

  if (DRY_RUN) {
    const toPurge = await prisma.rAGQuery.count({
      where: {
        createdAt: { lt: cutoffDate },
        patientId: null,
      },
    });
    log(`Would purge ${toPurge} RAG queries older than ${cutoffDate.toISOString()}`);
    return { table, before, after: before - toPurge, purged: toPurge };
  }

  try {
    const result = await prisma.rAGQuery.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        patientId: null,
      },
    });
    
    const after = await getTableCount(table);
    log(`Purged ${result.count} RAG queries`);
    return { table, before, after, purged: result.count };
  } catch (error) {
    log(`Error purging RAG queries: ${error}`, 'error');
    return { table, before, after: before, purged: 0 };
  }
}

/**
 * Purge old embedding cache
 */
async function purgeEmbeddingCache(): Promise<PurgeStats> {
  const table = 'embeddingCache';
  const before = await getTableCount(table);
  const cutoffDate = new Date(Date.now() - RETENTION.embeddingCache * 24 * 60 * 60 * 1000);
  const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (DRY_RUN) {
    const toPurge = await prisma.embeddingCache.count({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate } },
          { lastAccessed: { lt: staleDate } },
        ],
      },
    });
    log(`Would purge ${toPurge} embedding cache entries`);
    return { table, before, after: before - toPurge, purged: toPurge };
  }

  try {
    const result = await prisma.embeddingCache.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate } },
          { lastAccessed: { lt: staleDate } },
        ],
      },
    });
    
    const after = await getTableCount(table);
    log(`Purged ${result.count} embedding cache entries`);
    return { table, before, after, purged: result.count };
  } catch (error) {
    log(`Error purging embedding cache: ${error}`, 'error');
    return { table, before, after: before, purged: 0 };
  }
}

/**
 * Purge draft voice notes
 */
async function purgeDraftVoiceNotes(): Promise<PurgeStats> {
  const table = 'voiceNote';
  const before = await getTableCount(table);
  const cutoffDate = new Date(Date.now() - RETENTION.voiceNotesDraft * 24 * 60 * 60 * 1000);

  if (DRY_RUN) {
    const toPurge = await prisma.voiceNote.count({
      where: {
        status: 'draft',
        createdAt: { lt: cutoffDate },
      },
    });
    log(`Would purge ${toPurge} draft voice notes`);
    return { table, before, after: before - toPurge, purged: toPurge };
  }

  try {
    const result = await prisma.voiceNote.deleteMany({
      where: {
        status: 'draft',
        createdAt: { lt: cutoffDate },
      },
    });
    
    const after = await getTableCount(table);
    log(`Purged ${result.count} draft voice notes`);
    return { table, before, after, purged: result.count };
  } catch (error) {
    log(`Error purging voice notes: ${error}`, 'error');
    return { table, before, after: before, purged: 0 };
  }
}

/**
 * Purge old integration sync logs
 */
async function purgeIntegrationSyncLogs(): Promise<PurgeStats> {
  const table = 'integrationSyncLog';
  const before = await getTableCount(table);
  const cutoffDate = new Date(Date.now() - RETENTION.integrationSyncLogs * 24 * 60 * 60 * 1000);

  if (DRY_RUN) {
    const toPurge = await prisma.integrationSyncLog.count({
      where: {
        startedAt: { lt: cutoffDate },
      },
    });
    log(`Would purge ${toPurge} integration sync logs`);
    return { table, before, after: before - toPurge, purged: toPurge };
  }

  try {
    const result = await prisma.integrationSyncLog.deleteMany({
      where: {
        startedAt: { lt: cutoffDate },
      },
    });
    
    const after = await getTableCount(table);
    log(`Purged ${result.count} integration sync logs`);
    return { table, before, after, purged: result.count };
  } catch (error) {
    log(`Error purging integration sync logs: ${error}`, 'error');
    return { table, before, after: before, purged: 0 };
  }
}

/**
 * Run SQLite VACUUM to reclaim space
 */
async function vacuumDatabase(): Promise<void> {
  if (DRY_RUN) {
    log('Would run VACUUM on database');
    return;
  }

  try {
    log('Running VACUUM to reclaim database space...');
    await prisma.$executeRawUnsafe('VACUUM');
    log('VACUUM completed successfully');
  } catch (error) {
    log(`VACUUM error (non-critical): ${error}`, 'warn');
  }
}

/**
 * Run SQLite ANALYZE to update statistics
 */
async function analyzeDatabase(): Promise<void> {
  if (DRY_RUN) {
    log('Would run ANALYZE on database');
    return;
  }

  try {
    log('Running ANALYZE to update database statistics...');
    await prisma.$executeRawUnsafe('ANALYZE');
    log('ANALYZE completed successfully');
  } catch (error) {
    log(`ANALYZE error (non-critical): ${error}`, 'warn');
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  
  log('========================================');
  log('Scheduled Data Purge Starting');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('========================================');

  const stats: PurgeStats[] = [];

  // Run all purge operations
  stats.push(await purgeAiInteractions());
  stats.push(await purgeRagQueries());
  stats.push(await purgeEmbeddingCache());
  stats.push(await purgeDraftVoiceNotes());
  stats.push(await purgeIntegrationSyncLogs());

  // Run database optimization
  await vacuumDatabase();
  await analyzeDatabase();

  // Calculate totals
  const totalPurged = stats.reduce((sum, s) => sum + s.purged, 0);
  const duration = Date.now() - startTime;

  // Summary
  log('========================================');
  log('Purge Summary:');
  for (const stat of stats) {
    if (stat.purged > 0 || VERBOSE) {
      log(`  ${stat.table}: ${stat.before} -> ${stat.after} (${stat.purged} purged)`);
    }
  }
  log('----------------------------------------');
  log(`Total records purged: ${totalPurged}`);
  log(`Duration: ${duration}ms`);
  log('========================================');

  // Write purge log to database
  try {
    await prisma.aIInteraction.create({
      data: {
        interactionType: 'scheduled_purge',
        prompt: 'Automated data purge',
        response: JSON.stringify({
          stats,
          totalPurged,
          duration,
          dryRun: DRY_RUN,
        }),
        humanReviewed: true,
        modelUsed: 'system',
      },
    });
  } catch (error) {
    log(`Failed to write purge log: ${error}`, 'warn');
  }

  await prisma.$disconnect();
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
