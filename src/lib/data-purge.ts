/**
 * Data Purge and Retention Management Service
 * =============================================
 * 
 * PROMPT 12+: Comprehensive data lifecycle management for:
 * - Context compression and archival
 * - Database record purging based on retention policies
 * - Storage optimization and cleanup
 * 
 * HIPAA Compliance:
 * - Audit logs: 7-year retention (45 CFR § 164.312(b))
 * - Medical records: 7-year retention minimum
 * - AI interactions: Configurable (default 90 days for non-PHI)
 * 
 * Evidence Sources:
 * - HIPAA Privacy Rule 45 CFR § 164.530(j) - Retention requirements
 * - HIPAA Security Rule 45 CFR § 164.312(b) - Audit controls
 */

import { db } from './db';

// =============================================================================
// Retention Policy Configuration
// =============================================================================

export interface RetentionPolicy {
  /** Days to retain records before purging */
  retentionDays: number;
  /** Whether to archive before purging */
  archiveBeforePurge: boolean;
  /** Whether to keep records with patient associations */
  keepPatientRelated: boolean;
  /** Whether to keep records marked as critical */
  keepCritical: boolean;
  /** Maximum records to purge per batch (for performance) */
  batchSize: number;
}

/**
 * Default retention policies per data type
 * Based on HIPAA requirements and operational best practices
 */
export const DEFAULT_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  // HIPAA-mandated retention (7 years)
  auditLogs: {
    retentionDays: 2555, // 7 years
    archiveBeforePurge: false, // Never purge audit logs
    keepPatientRelated: true,
    keepCritical: true,
    batchSize: 1000,
  },
  
  // Medical records retention (7 years minimum)
  soapNotes: {
    retentionDays: 2555, // 7 years
    archiveBeforePurge: true,
    keepPatientRelated: true,
    keepCritical: true,
    batchSize: 100,
  },
  
  // SOAP note versions - compress old versions
  soapNoteVersions: {
    retentionDays: 365, // Keep full snapshots for 1 year
    archiveBeforePurge: true,
    keepPatientRelated: true,
    keepCritical: true,
    batchSize: 100,
  },
  
  // AI interactions without patient context
  aiInteractions: {
    retentionDays: 90,
    archiveBeforePurge: false,
    keepPatientRelated: true, // Keep any with patient associations
    keepCritical: true, // Keep any with safety flags
    batchSize: 500,
  },
  
  // RAG query logs
  ragQueries: {
    retentionDays: 30,
    archiveBeforePurge: false,
    keepPatientRelated: true,
    keepCritical: false,
    batchSize: 1000,
  },
  
  // Knowledge feedback
  knowledgeFeedback: {
    retentionDays: 365,
    archiveBeforePurge: false,
    keepPatientRelated: false,
    keepCritical: true,
    batchSize: 500,
  },
  
  // Embedding cache
  embeddingCache: {
    retentionDays: 90,
    archiveBeforePurge: false,
    keepPatientRelated: false,
    keepCritical: false,
    batchSize: 1000,
  },
  
  // Smart card access logs
  smartCardAccess: {
    retentionDays: 365, // 1 year
    archiveBeforePurge: false,
    keepPatientRelated: true,
    keepCritical: false,
    batchSize: 500,
  },
  
  // Integration sync logs
  integrationSyncLogs: {
    retentionDays: 90,
    archiveBeforePurge: false,
    keepPatientRelated: false,
    keepCritical: false,
    batchSize: 500,
  },
  
  // Voice notes (draft status only)
  voiceNotesDraft: {
    retentionDays: 7,
    archiveBeforePurge: false,
    keepPatientRelated: false,
    keepCritical: false,
    batchSize: 100,
  },
};

// =============================================================================
// Purge Result Types
// =============================================================================

export interface PurgeResult {
  /** Data type that was purged */
  dataType: string;
  /** Number of records purged */
  purgedCount: number;
  /** Number of records retained */
  retainedCount: number;
  /** Number of records archived */
  archivedCount: number;
  /** Errors encountered */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
}

export interface PurgeSummary {
  timestamp: Date;
  results: PurgeResult[];
  totalPurged: number;
  totalRetained: number;
  totalArchived: number;
  totalErrors: number;
  durationMs: number;
}

// =============================================================================
// Core Purge Functions
// =============================================================================

/**
 * Purge old AI interactions based on retention policy
 */
export async function purgeAiInteractions(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.aiInteractions
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'aiInteractions',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    // Get old interactions in batches
    let hasMore = true;
    while (hasMore) {
      const interactions = await db.aIInteraction.findMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
        select: {
          id: true,
          patientId: true,
          safetyFlags: true,
          interactionType: true,
        },
        take: policy.batchSize,
      });

      if (interactions.length === 0) {
        hasMore = false;
        break;
      }

      for (const interaction of interactions) {
        const hasPatient = !!interaction.patientId;
        const hasCriticalFlags = interaction.safetyFlags && 
          interaction.safetyFlags !== '{}' && 
          interaction.safetyFlags !== 'null';

        const shouldKeep = (policy.keepPatientRelated && hasPatient) ||
                          (policy.keepCritical && hasCriticalFlags);

        if (shouldKeep) {
          result.retainedCount++;
        } else {
          await db.aIInteraction.delete({
            where: { id: interaction.id },
          });
          result.purgedCount++;
        }
      }

      // Check if we've processed all records
      if (interactions.length < policy.batchSize) {
        hasMore = false;
      }
    }

    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge old RAG queries based on retention policy
 */
export async function purgeRagQueries(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.ragQueries
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'ragQueries',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    // Delete in batches
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const deleteResult = await db.rAGQuery.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          patientId: policy.keepPatientRelated ? null : undefined,
        },
        // SQLite doesn't support limit in deleteMany, so we use a workaround
      });

      totalDeleted += deleteResult.count;
      
      // For SQLite, we can't batch easily, so we break after one attempt
      hasMore = false;
    }

    result.purgedCount = totalDeleted;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge old embedding cache entries
 */
export async function purgeEmbeddingCache(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.embeddingCache
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'embeddingCache',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Not accessed in 30 days

    const deleteResult = await db.embeddingCache.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate } },
          { lastAccessed: { lt: staleDate } },
        ],
      },
    });

    result.purgedCount = deleteResult.count;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge old knowledge feedback entries
 */
export async function purgeKnowledgeFeedback(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.knowledgeFeedback
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'knowledgeFeedback',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    const deleteResult = await db.knowledgeFeedback.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    result.purgedCount = deleteResult.count;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge old integration sync logs
 */
export async function purgeIntegrationSyncLogs(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.integrationSyncLogs
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'integrationSyncLogs',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    const deleteResult = await db.integrationSyncLog.deleteMany({
      where: {
        startedAt: { lt: cutoffDate },
      },
    });

    result.purgedCount = deleteResult.count;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge old smart card access logs
 */
export async function purgeSmartCardAccess(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.smartCardAccess
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'smartCardAccess',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    const deleteResult = await db.smartCardAccess.deleteMany({
      where: {
        accessedAt: { lt: cutoffDate },
      },
    });

    result.purgedCount = deleteResult.count;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Purge draft voice notes older than retention period
 */
export async function purgeDraftVoiceNotes(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.voiceNotesDraft
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'voiceNotesDraft',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    const deleteResult = await db.voiceNote.deleteMany({
      where: {
        status: 'draft',
        createdAt: { lt: cutoffDate },
      },
    });

    result.purgedCount = deleteResult.count;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Compress old SOAP note versions
 * Instead of keeping full JSON snapshots, create a summary
 */
export async function compressOldSoapNoteVersions(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICIES.soapNoteVersions
): Promise<PurgeResult> {
  const startTime = Date.now();
  const result: PurgeResult = {
    dataType: 'soapNoteVersions',
    purgedCount: 0,
    retainedCount: 0,
    archivedCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    // Get old versions
    const oldVersions = await db.soapNoteVersion.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        snapshotJson: true,
        changeSummary: true,
      },
    });

    for (const version of oldVersions) {
      try {
        // If snapshot is larger than 10KB, compress it
        if (version.snapshotJson && version.snapshotJson.length > 10000) {
          // Create a compressed version with only essential data
          const snapshot = JSON.parse(version.snapshotJson);
          const compressedSnapshot = {
            id: snapshot.id,
            patientId: snapshot.patientId,
            status: snapshot.status,
            chiefComplaint: snapshot.chiefComplaint,
            primaryDiagnosisCode: snapshot.primaryDiagnosisCode,
            primaryDiagnosisDesc: snapshot.primaryDiagnosisDesc,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            _compressed: true,
            _compressedAt: new Date().toISOString(),
          };

          await db.soapNoteVersion.update({
            where: { id: version.id },
            data: {
              snapshotJson: JSON.stringify(compressedSnapshot),
              changeSummary: version.changeSummary || '[Compressed for storage optimization]',
            },
          });

          result.archivedCount++;
        } else {
          result.retainedCount++;
        }
      } catch (e) {
        result.errors.push(`Failed to compress version ${version.id}: ${e}`);
      }
    }

    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

// =============================================================================
// Comprehensive Purge Operations
// =============================================================================

/**
 * Run all configured purge operations
 * Returns a summary of all operations
 */
export async function runAllPurgeOperations(
  options: {
    skipAuditLogs?: boolean;
    skipMedicalRecords?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<PurgeSummary> {
  const startTime = Date.now();
  const results: PurgeResult[] = [];

  // Run purge operations in order of impact
  // Start with low-impact, non-critical data

  // 1. RAG queries (lowest impact)
  results.push(await purgeRagQueries());

  // 2. Embedding cache
  results.push(await purgeEmbeddingCache());

  // 3. Integration sync logs
  results.push(await purgeIntegrationSyncLogs());

  // 4. Draft voice notes
  results.push(await purgeDraftVoiceNotes());

  // 5. AI interactions (keep patient-related)
  results.push(await purgeAiInteractions());

  // 6. Knowledge feedback
  results.push(await purgeKnowledgeFeedback());

  // 7. Smart card access logs
  results.push(await purgeSmartCardAccess());

  // 8. Compress SOAP note versions (not delete)
  results.push(await compressOldSoapNoteVersions());

  // Calculate totals
  const totalPurged = results.reduce((sum, r) => sum + r.purgedCount, 0);
  const totalRetained = results.reduce((sum, r) => sum + r.retainedCount, 0);
  const totalArchived = results.reduce((sum, r) => sum + r.archivedCount, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return {
    timestamp: new Date(),
    results,
    totalPurged,
    totalRetained,
    totalArchived,
    totalErrors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Get current database statistics for monitoring
 */
export async function getDatabaseStats(): Promise<{
  table: string;
  count: number;
  oldestRecord?: Date;
  newestRecord?: Date;
}[]> {
  const stats: { table: string; count: number; oldestRecord?: Date; newestRecord?: Date }[] = [];

  // AI Interactions
  const aiCount = await db.aIInteraction.count();
  const aiOldest = await db.aIInteraction.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const aiNewest = await db.aIInteraction.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  stats.push({
    table: 'aiInteractions',
    count: aiCount,
    oldestRecord: aiOldest?.createdAt,
    newestRecord: aiNewest?.createdAt,
  });

  // RAG Queries
  const ragCount = await db.rAGQuery.count();
  const ragOldest = await db.rAGQuery.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  stats.push({
    table: 'ragQueries',
    count: ragCount,
    oldestRecord: ragOldest?.createdAt,
  });

  // Embedding Cache
  const embedCount = await db.embeddingCache.count();
  stats.push({
    table: 'embeddingCache',
    count: embedCount,
  });

  // Integration Sync Logs
  const syncCount = await db.integrationSyncLog.count();
  stats.push({
    table: 'integrationSyncLogs',
    count: syncCount,
  });

  // Voice Notes
  const voiceCount = await db.voiceNote.count();
  stats.push({
    table: 'voiceNotes',
    count: voiceCount,
  });

  // Knowledge Feedback
  const feedbackCount = await db.knowledgeFeedback.count();
  stats.push({
    table: 'knowledgeFeedback',
    count: feedbackCount,
  });

  // Smart Card Access
  const cardCount = await db.smartCardAccess.count();
  stats.push({
    table: 'smartCardAccess',
    count: cardCount,
  });

  // SOAP Note Versions
  const versionCount = await db.soapNoteVersion.count();
  stats.push({
    table: 'soapNoteVersions',
    count: versionCount,
  });

  // Audit Logs
  const auditCount = await db.auditLog.count();
  stats.push({
    table: 'auditLogs',
    count: auditCount,
  });

  return stats;
}

/**
 * Estimate storage savings from purge operations
 */
export async function estimatePurgeSavings(): Promise<{
  dataType: string;
  estimatedRecords: number;
  estimatedSizeKB: number;
}[]> {
  const estimates: { dataType: string; estimatedRecords: number; estimatedSizeKB: number }[] = [];

  // AI Interactions older than 90 days
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const aiOld = await db.aIInteraction.count({
    where: { createdAt: { lt: cutoff90 }, patientId: null },
  });
  estimates.push({
    dataType: 'aiInteractions',
    estimatedRecords: aiOld,
    estimatedSizeKB: aiOld * 5, // ~5KB per interaction
  });

  // RAG Queries older than 30 days
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ragOld = await db.rAGQuery.count({
    where: { createdAt: { lt: cutoff30 } },
  });
  estimates.push({
    dataType: 'ragQueries',
    estimatedRecords: ragOld,
    estimatedSizeKB: ragOld * 2, // ~2KB per query
  });

  // Draft voice notes older than 7 days
  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const voiceOld = await db.voiceNote.count({
    where: { createdAt: { lt: cutoff7 }, status: 'draft' },
  });
  estimates.push({
    dataType: 'voiceNotesDraft',
    estimatedRecords: voiceOld,
    estimatedSizeKB: voiceOld * 1, // ~1KB per draft
  });

  return estimates;
}

export default {
  purgeAiInteractions,
  purgeRagQueries,
  purgeEmbeddingCache,
  purgeKnowledgeFeedback,
  purgeIntegrationSyncLogs,
  purgeSmartCardAccess,
  purgeDraftVoiceNotes,
  compressOldSoapNoteVersions,
  runAllPurgeOperations,
  getDatabaseStats,
  estimatePurgeSavings,
  DEFAULT_RETENTION_POLICIES,
};
