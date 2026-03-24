#!/usr/bin/env bun
/**
 * SQLite Backup Service for Gelani Healthcare Platform
 * 
 * Features:
 * - Scheduled automatic backups
 * - Backup before risky operations
 * - Backup rotation and cleanup
 * - Backup verification
 * - Point-in-time recovery support
 * 
 * Usage:
 *   bun run scripts/backup-service.ts [command] [options]
 * 
 * Commands:
 *   backup              Create a new backup
 *   list                List all backups
 *   restore <file>      Restore from backup file
 *   verify <file>       Verify backup integrity
 *   schedule            Run scheduled backup daemon
 *   cleanup             Remove old backups
 *   health              Check backup health
 */

import { 
  existsSync, 
  mkdirSync, 
  copyFileSync, 
  statSync, 
  writeFileSync, 
  readdirSync,
  unlinkSync,
  readFileSync
} from 'fs'
import { join, dirname, basename } from 'path'
import { execSync } from 'child_process'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Database paths
  dbPath: process.env.DATABASE_PATH || '/app/data/healthcare.db',
  backupDir: process.env.BACKUP_DIR || '/app/data/backups',
  
  // Backup settings
  maxBackups: parseInt(process.env.MAX_BACKUPS || '20'),
  minBackupInterval: parseInt(process.env.MIN_BACKUP_INTERVAL || '60000'), // 1 minute
  scheduledBackupInterval: parseInt(process.env.SCHEDULED_BACKUP_INTERVAL || '3600000'), // 1 hour
  
  // Retention policy (in hours)
  retention: {
    hourly: parseInt(process.env.RETENTION_HOURLY || '24'),    // Keep hourly for 24 hours
    daily: parseInt(process.env.RETENTION_DAILY || '168'),     // Keep daily for 7 days
    weekly: parseInt(process.env.RETENTION_WEEKLY || '720'),   // Keep weekly for 30 days
    monthly: parseInt(process.env.RETENTION_MONTHLY || '8760'), // Keep monthly for 1 year
  },
  
  // WAL checkpoint before backup
  checkpointBeforeBackup: true,
}

// ============================================================================
// Types
// ============================================================================

interface BackupMetadata {
  id: string
  timestamp: string
  originalPath: string
  backupPath: string
  size: number
  checksum: string
  trigger: 'manual' | 'scheduled' | 'write' | 'pre-restore'
  retention: 'hourly' | 'daily' | 'weekly' | 'monthly'
  verified: boolean
  version: string
  prismaVersion?: string
}

interface BackupStatus {
  totalBackups: number
  totalSize: number
  oldestBackup: string | null
  newestBackup: string | null
  lastVerification: string | null
  health: 'healthy' | 'degraded' | 'unhealthy'
}

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
    console.log(`[Backup] Created directory: ${path}`)
  }
}

function generateBackupId(): string {
  const now = new Date()
  return `backup-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
}

function calculateChecksum(filePath: string): string {
  try {
    const crypto = require('crypto')
    const fileBuffer = readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16)
  } catch (error) {
    return 'checksum-failed'
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function getRetentionBucket(timestamp: Date): 'hourly' | 'daily' | 'weekly' | 'monthly' {
  const now = new Date()
  const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
  
  if (hoursDiff < CONFIG.retention.hourly) return 'hourly'
  if (hoursDiff < CONFIG.retention.daily) return 'daily'
  if (hoursDiff < CONFIG.retention.weekly) return 'weekly'
  return 'monthly'
}

// ============================================================================
// WAL Checkpoint
// ============================================================================

function performWalCheckpoint(dbPath: string): boolean {
  try {
    // First try TRUNCATE mode (most aggressive)
    const result = execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    console.log('[Backup] WAL checkpoint completed')
    return true
  } catch (error) {
    // Try PASSIVE mode as fallback
    try {
      execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(PASSIVE);"`, {
        timeout: 10000,
        stdio: 'pipe'
      })
      console.log('[Backup] WAL checkpoint completed (passive mode)')
      return true
    } catch {
      console.warn('[Backup] WAL checkpoint failed, proceeding anyway')
      return false
    }
  }
}

// ============================================================================
// Backup Operations
// ============================================================================

function createBackup(trigger: BackupMetadata['trigger'] = 'manual'): BackupMetadata | null {
  const dbPath = CONFIG.dbPath
  
  // Check if database exists
  if (!existsSync(dbPath)) {
    console.error(`[Backup] Database not found: ${dbPath}`)
    return null
  }
  
  // Ensure backup directory exists
  ensureDirectory(CONFIG.backupDir)
  
  // Perform WAL checkpoint before backup
  if (CONFIG.checkpointBeforeBackup) {
    performWalCheckpoint(dbPath)
  }
  
  // Generate backup filename
  const backupId = generateBackupId()
  const backupFileName = `${backupId}.db`
  const backupPath = join(CONFIG.backupDir, backupFileName)
  
  try {
    // Copy main database file
    copyFileSync(dbPath, backupPath)
    
    // Copy associated files
    const walPath = `${dbPath}-wal`
    const shmPath = `${dbPath}-shm`
    
    if (existsSync(walPath)) {
      copyFileSync(walPath, `${backupPath}-wal`)
    }
    if (existsSync(shmPath)) {
      copyFileSync(shmPath, `${backupPath}-shm`)
    }
    
    // Get file stats
    const stats = statSync(backupPath)
    const checksum = calculateChecksum(backupPath)
    
    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date().toISOString(),
      originalPath: dbPath,
      backupPath,
      size: stats.size,
      checksum,
      trigger,
      retention: getRetentionBucket(new Date()),
      verified: false,
      version: '2.0.0',
    }
    
    // Write metadata
    const metadataPath = `${backupPath}.json`
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    
    console.log(`[Backup] ✅ Created: ${backupFileName}`)
    console.log(`[Backup]    Size: ${formatBytes(stats.size)}`)
    console.log(`[Backup]    Checksum: ${checksum}`)
    console.log(`[Backup]    Trigger: ${trigger}`)
    
    return metadata
  } catch (error) {
    console.error('[Backup] ❌ Failed:', error)
    return null
  }
}

function listBackups(): BackupMetadata[] {
  if (!existsSync(CONFIG.backupDir)) {
    return []
  }
  
  const backups: BackupMetadata[] = []
  
  const files = readdirSync(CONFIG.backupDir)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse()
  
  for (const file of files) {
    const backupPath = join(CONFIG.backupDir, file)
    const metadataPath = `${backupPath}.json`
    
    try {
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as BackupMetadata
        backups.push(metadata)
      } else {
        // Create metadata for legacy backups
        const stats = statSync(backupPath)
        backups.push({
          id: file.replace('.db', ''),
          timestamp: stats.mtime.toISOString(),
          originalPath: 'unknown',
          backupPath,
          size: stats.size,
          checksum: calculateChecksum(backupPath),
          trigger: 'manual',
          retention: getRetentionBucket(stats.mtime),
          verified: false,
          version: '1.0.0',
        })
      }
    } catch {
      // Skip problematic files
    }
  }
  
  return backups
}

function verifyBackup(backupPath: string): boolean {
  if (!existsSync(backupPath)) {
    console.error(`[Backup] Backup not found: ${backupPath}`)
    return false
  }
  
  try {
    // Check if file can be opened by SQLite
    const result = execSync(`sqlite3 "${backupPath}" "PRAGMA integrity_check;"`, {
      timeout: 60000,
      encoding: 'utf-8'
    }).toString().trim()
    
    if (result === 'ok') {
      console.log(`[Backup] ✅ Integrity check passed: ${basename(backupPath)}`)
      
      // Update metadata
      const metadataPath = `${backupPath}.json`
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        metadata.verified = true
        metadata.verifiedAt = new Date().toISOString()
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
      }
      
      return true
    } else {
      console.error(`[Backup] ❌ Integrity check failed: ${result}`)
      return false
    }
  } catch (error) {
    console.error(`[Backup] ❌ Verification error:`, error)
    return false
  }
}

function restoreBackup(backupFileName: string): boolean {
  const backupPath = join(CONFIG.backupDir, backupFileName)
  
  if (!existsSync(backupPath)) {
    console.error(`[Backup] Backup not found: ${backupFileName}`)
    return false
  }
  
  // Verify backup before restore
  if (!verifyBackup(backupPath)) {
    console.error('[Backup] Cannot restore corrupted backup')
    return false
  }
  
  const dbPath = CONFIG.dbPath
  
  // Create pre-restore backup
  if (existsSync(dbPath)) {
    console.log('[Backup] Creating pre-restore backup...')
    createBackup('pre-restore')
  }
  
  try {
    // Restore main database
    copyFileSync(backupPath, dbPath)
    
    // Restore associated files
    const walBackup = `${backupPath}-wal`
    const shmBackup = `${backupPath}-shm`
    
    if (existsSync(walBackup)) {
      copyFileSync(walBackup, `${dbPath}-wal`)
    }
    if (existsSync(shmBackup)) {
      copyFileSync(shmBackup, `${dbPath}-shm`)
    }
    
    console.log(`[Backup] ✅ Restored from: ${backupFileName}`)
    return true
  } catch (error) {
    console.error('[Backup] ❌ Restore failed:', error)
    return false
  }
}

function cleanupBackups(): number {
  const backups = listBackups()
  let removed = 0
  
  // Sort by timestamp (newest first)
  backups.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  
  // Apply retention policy
  const now = new Date()
  const toKeep = new Set<string>()
  
  // Keep backups based on retention buckets
  const buckets: Record<string, BackupMetadata | null> = {
    hourly: null,
    daily: null,
    weekly: null,
    monthly: null,
  }
  
  for (const backup of backups) {
    const backupDate = new Date(backup.timestamp)
    const hoursDiff = (now.getTime() - backupDate.getTime()) / (1000 * 60 * 60)
    
    // Always keep backups within hourly retention
    if (hoursDiff < CONFIG.retention.hourly) {
      toKeep.add(backup.id)
      continue
    }
    
    // Keep one per day within daily retention
    if (hoursDiff < CONFIG.retention.daily) {
      const dayKey = backupDate.toISOString().split('T')[0]
      if (!buckets[`day-${dayKey}`]) {
        buckets[`day-${dayKey}`] = backup
        toKeep.add(backup.id)
      }
      continue
    }
    
    // Keep one per week within weekly retention
    if (hoursDiff < CONFIG.retention.weekly) {
      const weekKey = `${backupDate.getFullYear()}-W${Math.ceil(backupDate.getDate() / 7)}`
      if (!buckets[`week-${weekKey}`]) {
        buckets[`week-${weekKey}`] = backup
        toKeep.add(backup.id)
      }
      continue
    }
    
    // Keep one per month within monthly retention
    if (hoursDiff < CONFIG.retention.monthly) {
      const monthKey = `${backupDate.getFullYear()}-${backupDate.getMonth()}`
      if (!buckets[`month-${monthKey}`]) {
        buckets[`month-${monthKey}`] = backup
        toKeep.add(backup.id)
      }
    }
  }
  
  // Remove backups not in keep list
  for (const backup of backups) {
    if (!toKeep.has(backup.id)) {
      try {
        unlinkSync(backup.backupPath)
        const metadataPath = `${backup.backupPath}.json`
        if (existsSync(metadataPath)) {
          unlinkSync(metadataPath)
        }
        
        // Remove associated files
        const walPath = `${backup.backupPath}-wal`
        const shmPath = `${backup.backupPath}-shm`
        if (existsSync(walPath)) unlinkSync(walPath)
        if (existsSync(shmPath)) unlinkSync(shmPath)
        
        console.log(`[Backup] Removed: ${backup.id}`)
        removed++
      } catch (error) {
        console.warn(`[Backup] Failed to remove ${backup.id}:`, error)
      }
    }
  }
  
  // Also enforce max backups limit
  const remainingBackups = listBackups()
  if (remainingBackups.length > CONFIG.maxBackups) {
    const excessBackups = remainingBackups
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .slice(0, remainingBackups.length - CONFIG.maxBackups)
    
    for (const backup of excessBackups) {
      try {
        unlinkSync(backup.backupPath)
        const metadataPath = `${backup.backupPath}.json`
        if (existsSync(metadataPath)) unlinkSync(metadataPath)
        console.log(`[Backup] Removed (max limit): ${backup.id}`)
        removed++
      } catch {
        // Ignore
      }
    }
  }
  
  console.log(`[Backup] Cleanup complete. Removed ${removed} backup(s)`)
  return removed
}

function getBackupStatus(): BackupStatus {
  const backups = listBackups()
  
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0)
  const sortedBackups = backups.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  
  const verifiedBackups = backups.filter(b => b.verified)
  const health = backups.length === 0 
    ? 'unhealthy'
    : verifiedBackups.length < backups.length / 2
      ? 'degraded'
      : 'healthy'
  
  return {
    totalBackups: backups.length,
    totalSize,
    oldestBackup: sortedBackups[0]?.timestamp || null,
    newestBackup: sortedBackups[sortedBackups.length - 1]?.timestamp || null,
    lastVerification: verifiedBackups[0]?.timestamp || null,
    health,
  }
}

// ============================================================================
// Scheduled Backup Daemon
// ============================================================================

function runScheduledBackup(): void {
  console.log('[Backup] Starting scheduled backup daemon')
  console.log(`[Backup] Interval: ${CONFIG.scheduledBackupInterval / 60000} minutes`)
  console.log(`[Backup] Database: ${CONFIG.dbPath}`)
  console.log(`[Backup] Backup directory: ${CONFIG.backupDir}`)
  
  // Initial backup
  createBackup('scheduled')
  
  // Schedule regular backups
  setInterval(() => {
    console.log('[Backup] Running scheduled backup...')
    createBackup('scheduled')
    cleanupBackups()
  }, CONFIG.scheduledBackupInterval)
  
  // Schedule verification
  setInterval(() => {
    console.log('[Backup] Running backup verification...')
    const backups = listBackups().slice(0, 5) // Verify last 5 backups
    for (const backup of backups) {
      verifyBackup(backup.backupPath)
    }
  }, CONFIG.scheduledBackupInterval * 4) // Every 4th backup interval
}

// ============================================================================
// CLI Interface
// ============================================================================

function printHelp(): void {
  console.log(`
SQLite Backup Service for Gelani Healthcare Platform

Usage:
  bun run scripts/backup-service.ts <command> [options]

Commands:
  backup              Create a new backup
  list                List all backups with details
  restore <file>      Restore database from backup file
  verify <file>       Verify backup integrity
  schedule            Run scheduled backup daemon
  cleanup             Remove old backups per retention policy
  health              Check backup system health
  help                Show this help message

Options:
  DB_PATH             Database file path (env: DATABASE_PATH)
  BACKUP_DIR          Backup directory (env: BACKUP_DIR)
  MAX_BACKUPS         Maximum backups to keep (env: MAX_BACKUPS)

Examples:
  bun run scripts/backup-service.ts backup
  bun run scripts/backup-service.ts list
  bun run scripts/backup-service.ts restore backup-20240115-120000.db
  bun run scripts/backup-service.ts schedule
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]
  
  switch (command) {
    case 'backup':
      createBackup('manual')
      break
      
    case 'list': {
      const backups = listBackups()
      console.log(`\n📋 Found ${backups.length} backup(s):\n`)
      
      for (const backup of backups) {
        console.log(`  ${backup.id}`)
        console.log(`    Timestamp: ${backup.timestamp}`)
        console.log(`    Size: ${formatBytes(backup.size)}`)
        console.log(`    Checksum: ${backup.checksum}`)
        console.log(`    Trigger: ${backup.trigger}`)
        console.log(`    Verified: ${backup.verified ? '✅' : '❌'}`)
        console.log('')
      }
      break
    }
    
    case 'restore':
      if (!args[1]) {
        console.error('Usage: backup-service.ts restore <backup-file>')
        process.exit(1)
      }
      restoreBackup(args[1])
      break
      
    case 'verify':
      if (!args[1]) {
        console.error('Usage: backup-service.ts verify <backup-file>')
        process.exit(1)
      }
      verifyBackup(join(CONFIG.backupDir, args[1]))
      break
      
    case 'schedule':
      runScheduledBackup()
      break
      
    case 'cleanup':
      cleanupBackups()
      break
      
    case 'health': {
      const status = getBackupStatus()
      console.log('\n📊 Backup System Health\n')
      console.log(`  Status: ${status.health}`)
      console.log(`  Total Backups: ${status.totalBackups}`)
      console.log(`  Total Size: ${formatBytes(status.totalSize)}`)
      console.log(`  Oldest Backup: ${status.oldestBackup || 'N/A'}`)
      console.log(`  Newest Backup: ${status.newestBackup || 'N/A'}`)
      console.log(`  Last Verification: ${status.lastVerification || 'N/A'}`)
      console.log('')
      break
    }
    
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
      
    default:
      if (command) {
        console.error(`Unknown command: ${command}`)
      }
      printHelp()
      process.exit(command ? 1 : 0)
  }
}

// Run if executed directly
main().catch(console.error)

// Export functions for programmatic use
export {
  createBackup,
  listBackups,
  verifyBackup,
  restoreBackup,
  cleanupBackups,
  getBackupStatus,
  CONFIG
}
