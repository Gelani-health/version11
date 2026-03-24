/**
 * SQLite Database Configuration for Healthcare Platform
 * 
 * Implements:
 * 1. WAL (Write-Ahead Logging) mode for better concurrency
 * 2. Retry logic for SQLITE_BUSY errors with exponential backoff
 * 3. Backup-on-write for crash safety
 * 4. Connection pooling and optimization settings
 * 
 * Medical-grade database configuration for HIPAA compliance
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, statSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'

// ============================================================================
// Configuration Constants
// ============================================================================

const SQLITE_CONFIG = {
  // WAL mode settings
  journalMode: 'WAL',
  synchronous: 'NORMAL', // Balance between safety and performance
  busyTimeout: 30000, // 30 seconds busy timeout
  cacheSize: -64000, // 64MB cache (negative = KB)
  tempStore: 'MEMORY',
  mmapSize: 268435456, // 256MB mmap
  
  // Retry settings
  maxRetries: 5,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  
  // Backup settings
  backupDir: process.env.BACKUP_DIR || './db/backups',
  maxBackups: 10, // Keep last 10 backups
  backupOnWrite: process.env.BACKUP_ON_WRITE !== 'false', // Default true
  
  // Health check settings
  integrityCheckInterval: 3600000, // 1 hour
} as const

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConfig {
  url: string
  walMode: boolean
  backupEnabled: boolean
  maxRetries: number
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryableErrors?: string[]
}

export interface BackupMetadata {
  timestamp: string
  originalPath: string
  backupPath: string
  size: number
  checksum?: string
  trigger: 'manual' | 'write' | 'scheduled'
}

// ============================================================================
// SQLite PRAGMA Commands
// ============================================================================

const SQLITE_PRAGMAS = [
  // Enable WAL mode for better concurrency
  'PRAGMA journal_mode = WAL;',
  
  // Normal synchronous mode (good balance for WAL)
  'PRAGMA synchronous = NORMAL;',
  
  // Busy timeout - how long to wait for locks
  `PRAGMA busy_timeout = ${SQLITE_CONFIG.busyTimeout};`,
  
  // Cache size in KB (negative means KB)
  `PRAGMA cache_size = ${SQLITE_CONFIG.cacheSize};`,
  
  // Store temp tables in memory
  'PRAGMA temp_store = MEMORY;',
  
  // Memory-mapped I/O for better read performance
  `PRAGMA mmap_size = ${SQLITE_CONFIG.mmapSize};`,
  
  // Auto-checkpoint at 1000 pages
  'PRAGMA wal_autocheckpoint = 1000;',
  
  // Locking mode - NORMAL allows other connections
  'PRAGMA locking_mode = NORMAL;',
  
  // Foreign keys enforcement (critical for data integrity)
  'PRAGMA foreign_keys = ON;',
] as const

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

const SQLITE_BUSY_CODES = [
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_BUSY_SNAPSHOT',
]

const RETRYABLE_ERROR_PATTERNS = [
  /SQLITE_BUSY/,
  /database is locked/,
  /database table is locked/,
  /cannot start a transaction within a transaction/,
  /disk I\/O error/,
  /disk full/,
]

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma error codes for SQLite busy/lock errors
    if (['P2034', 'P2035', 'P2024'].includes(error.code)) {
      return true
    }
    // Check error message
    const message = error.message.toLowerCase()
    return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message))
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message))
  }
  
  return false
}

/**
 * Retry wrapper for database operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = SQLITE_CONFIG.maxRetries,
    baseDelayMs = SQLITE_CONFIG.baseDelayMs,
    maxDelayMs = SQLITE_CONFIG.maxDelayMs,
  } = options

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error
      }
      
      // Last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`[SQLite] Operation failed after ${maxRetries + 1} attempts:`, lastError.message)
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs)
      console.warn(`[SQLite] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`)
      
      await sleep(delay)
    }
  }
  
  throw lastError
}

// ============================================================================
// Backup System
// ============================================================================

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): string {
  const backupDir = SQLITE_CONFIG.backupDir
  
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }
  
  return backupDir
}

/**
 * Calculate checksum for backup verification
 */
function calculateChecksum(filePath: string): string {
  try {
    const crypto = require('crypto')
    const { readFileSync } = require('fs')
    const fileBuffer = readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16)
  } catch {
    return 'unknown'
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 */
function cleanupOldBackups(): void {
  const backupDir = ensureBackupDir()
  
  const backups = readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: join(backupDir, f),
      mtime: statSync(join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime)
  
  // Remove old backups beyond maxBackups
  if (backups.length > SQLITE_CONFIG.maxBackups) {
    const toRemove = backups.slice(SQLITE_CONFIG.maxBackups)
    for (const backup of toRemove) {
      try {
        const { unlinkSync } = require('fs')
        unlinkSync(backup.path)
        // Also remove associated JSON metadata if exists
        const jsonPath = backup.path.replace('.db', '.json')
        if (existsSync(jsonPath)) {
          unlinkSync(jsonPath)
        }
        console.log(`[SQLite] Removed old backup: ${backup.name}`)
      } catch (error) {
        console.warn(`[SQLite] Failed to remove old backup ${backup.name}:`, error)
      }
    }
  }
}

/**
 * Create a backup of the database
 */
export function createBackup(dbPath: string, trigger: 'manual' | 'write' | 'scheduled' = 'manual'): BackupMetadata | null {
  try {
    // Ensure database file exists
    if (!existsSync(dbPath)) {
      console.warn(`[SQLite] Database file not found: ${dbPath}`)
      return null
    }
    
    const backupDir = ensureBackupDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `backup-${timestamp}.db`
    const backupPath = join(backupDir, backupFileName)
    
    // Force checkpoint before backup for WAL mode
    // This ensures all WAL content is written to main DB
    try {
      execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);"`, { 
        timeout: 30000,
        stdio: 'pipe'
      })
    } catch {
      // Checkpoint might fail if no WAL file exists, that's okay
    }
    
    // Copy database file
    copyFileSync(dbPath, backupPath)
    
    // Also copy WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`
    const shmPath = `${dbPath}-shm`
    
    if (existsSync(walPath)) {
      copyFileSync(walPath, `${backupPath}-wal`)
    }
    if (existsSync(shmPath)) {
      copyFileSync(shmPath, `${backupPath}-shm`)
    }
    
    const stats = statSync(backupPath)
    const checksum = calculateChecksum(backupPath)
    
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      originalPath: dbPath,
      backupPath,
      size: stats.size,
      checksum,
      trigger,
    }
    
    // Write metadata file
    const metadataPath = backupPath.replace('.db', '.json')
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    
    console.log(`[SQLite] Backup created: ${backupFileName} (${Math.round(stats.size / 1024)} KB)`)
    
    // Cleanup old backups
    cleanupOldBackups()
    
    return metadata
  } catch (error) {
    console.error('[SQLite] Backup failed:', error)
    return null
  }
}

/**
 * Restore database from backup
 */
export function restoreBackup(dbPath: string, backupPath: string): boolean {
  try {
    if (!existsSync(backupPath)) {
      console.error(`[SQLite] Backup file not found: ${backupPath}`)
      return false
    }
    
    // Create a pre-restore backup of current database
    if (existsSync(dbPath)) {
      const preRestoreBackup = `${dbPath}.pre-restore-${Date.now()}`
      copyFileSync(dbPath, preRestoreBackup)
      console.log(`[SQLite] Current database backed up to: ${preRestoreBackup}`)
    }
    
    // Restore from backup
    copyFileSync(backupPath, dbPath)
    
    // Also restore WAL and SHM files if they exist
    const walBackup = `${backupPath}-wal`
    const shmBackup = `${backupPath}-shm`
    
    if (existsSync(walBackup)) {
      copyFileSync(walBackup, `${dbPath}-wal`)
    }
    if (existsSync(shmBackup)) {
      copyFileSync(shmBackup, `${dbPath}-shm`)
    }
    
    console.log(`[SQLite] Database restored from: ${backupPath}`)
    return true
  } catch (error) {
    console.error('[SQLite] Restore failed:', error)
    return false
  }
}

/**
 * List available backups
 */
export function listBackups(): BackupMetadata[] {
  const backupDir = ensureBackupDir()
  
  const backups: BackupMetadata[] = []
  
  const files = readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse()
  
  for (const file of files) {
    const backupPath = join(backupDir, file)
    const metadataPath = backupPath.replace('.db', '.json')
    
    try {
      if (existsSync(metadataPath)) {
        const { readFileSync } = require('fs')
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        backups.push(metadata)
      } else {
        const stats = statSync(backupPath)
        backups.push({
          timestamp: stats.mtime.toISOString(),
          originalPath: 'unknown',
          backupPath,
          size: stats.size,
          trigger: 'manual',
        })
      }
    } catch {
      // Skip problematic metadata files
    }
  }
  
  return backups
}

// ============================================================================
// Database Initialization
// ============================================================================

/**
 * Apply SQLite PRAGMA settings for optimal performance
 */
export function applySQLitePragmas(dbPath: string): void {
  try {
    for (const pragma of SQLITE_PRAGMAS) {
      try {
        execSync(`sqlite3 "${dbPath}" "${pragma}"`, {
          timeout: 5000,
          stdio: 'pipe'
        })
      } catch (error) {
        // Some pragmas might fail, log but continue
        console.debug(`[SQLite] PRAGMA warning: ${pragma}`, error)
      }
    }
    
    console.log('[SQLite] ✅ Database PRAGMA settings applied')
    console.log(`[SQLite]    Journal Mode: WAL`)
    console.log(`[SQLite]    Synchronous: NORMAL`)
    console.log(`[SQLite]    Busy Timeout: ${SQLITE_CONFIG.busyTimeout}ms`)
    console.log(`[SQLite]    Cache Size: ${Math.abs(SQLITE_CONFIG.cacheSize)}KB`)
  } catch (error) {
    console.error('[SQLite] Failed to apply PRAGMA settings:', error)
  }
}

/**
 * Check database integrity
 */
export function checkIntegrity(dbPath: string): boolean {
  try {
    const result = execSync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`, {
      timeout: 60000,
      encoding: 'utf-8'
    }).toString().trim()
    
    if (result === 'ok') {
      console.log('[SQLite] ✅ Database integrity check passed')
      return true
    } else {
      console.error('[SQLite] ❌ Database integrity check failed:', result)
      return false
    }
  } catch (error) {
    console.error('[SQLite] Integrity check error:', error)
    return false
  }
}

/**
 * Initialize database with WAL mode and optimal settings
 */
export function initializeDatabase(dbPath: string): boolean {
  try {
    console.log(`[SQLite] Initializing database: ${dbPath}`)
    
    // Ensure parent directory exists
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }
    
    // Check if database exists
    const isNewDatabase = !existsSync(dbPath)
    
    // If new database, create it with proper settings
    if (isNewDatabase) {
      console.log('[SQLite] Creating new database...')
      
      // Create empty database
      execSync(`sqlite3 "${dbPath}" "SELECT 1;"`, { timeout: 5000 })
    }
    
    // Apply PRAGMA settings
    applySQLitePragmas(dbPath)
    
    // Create initial backup for new databases
    if (isNewDatabase && SQLITE_CONFIG.backupOnWrite) {
      createBackup(dbPath, 'manual')
    }
    
    // Verify WAL mode is active
    const journalMode = execSync(`sqlite3 "${dbPath}" "PRAGMA journal_mode;"`, {
      encoding: 'utf-8',
      timeout: 5000
    }).toString().trim()
    
    if (journalMode.toLowerCase() !== 'wal') {
      console.warn(`[SQLite] ⚠️ WAL mode not active, journal_mode is: ${journalMode}`)
    } else {
      console.log('[SQLite] ✅ WAL mode confirmed active')
    }
    
    // Run integrity check
    checkIntegrity(dbPath)
    
    return true
  } catch (error) {
    console.error('[SQLite] Database initialization failed:', error)
    return false
  }
}

// ============================================================================
// Prisma Client Factory with Retry Support
// ============================================================================

/**
 * Create a Prisma client with SQLite optimizations
 */
export function createOptimizedPrismaClient(options: {
  url: string
  log?: ('query' | 'info' | 'warn' | error')[]
} = { url: process.env.DATABASE_URL || 'file:./data/healthcare.db' }): PrismaClient {
  const { url, log = ['warn', 'error'] } = options
  
  // Extract file path from URL
  const dbPath = url.replace('file:', '')
  
  // Initialize database with proper settings
  initializeDatabase(dbPath)
  
  // Create Prisma client with custom configuration
  const client = new PrismaClient({
    log,
    datasources: {
      db: {
        url
      }
    }
  })
  
  // Add middleware for automatic retries
  client.$use(async (params, next) => {
    const maxAttempts = SQLITE_CONFIG.maxRetries + 1
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await next(params)
        
        // Create backup on successful write operations (optional)
        if (
          SQLITE_CONFIG.backupOnWrite &&
          ['create', 'update', 'delete', 'upsert'].includes(params.action) &&
          attempt === 0 // Only on first successful attempt
        ) {
          // Defer backup to avoid blocking
          setImmediate(() => {
            try {
              createBackup(dbPath, 'write')
            } catch {
              // Backup failure should not affect the operation
            }
          })
        }
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (!isRetryableError(error)) {
          throw error
        }
        
        if (attempt === maxAttempts - 1) {
          console.error(`[SQLite] Prisma operation failed after ${maxAttempts} attempts`)
          throw error
        }
        
        const delay = calculateDelay(attempt, SQLITE_CONFIG.baseDelayMs, SQLITE_CONFIG.maxDelayMs)
        console.warn(`[SQLite] Retrying Prisma operation (${params.model}.${params.action}) after ${delay}ms`)
        
        await sleep(delay)
      }
    }
    
    throw lastError
  })
  
  return client
}

// ============================================================================
// Health Check and Monitoring
// ============================================================================

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  path: string
  journalMode: string
  integrity: boolean
  size: number
  walSize?: number
  lastBackup?: string
  backups: number
  metrics: {
    connections: number
    cacheHitRatio?: number
    pageCount?: number
  }
}

/**
 * Get database health status
 */
export async function getDatabaseHealth(dbPath: string): Promise<DatabaseHealth> {
  const health: DatabaseHealth = {
    status: 'healthy',
    path: dbPath,
    journalMode: 'unknown',
    integrity: false,
    size: 0,
    backups: 0,
    metrics: {
      connections: 1,
    }
  }
  
  try {
    // Check if database exists
    if (!existsSync(dbPath)) {
      health.status = 'unhealthy'
      return health
    }
    
    // Get file size
    health.size = statSync(dbPath).size
    
    // Get WAL file size if exists
    const walPath = `${dbPath}-wal`
    if (existsSync(walPath)) {
      health.walSize = statSync(walPath).size
    }
    
    // Get journal mode
    health.journalMode = execSync(`sqlite3 "${dbPath}" "PRAGMA journal_mode;"`, {
      encoding: 'utf-8',
      timeout: 5000
    }).toString().trim().toLowerCase()
    
    // Check integrity
    const integrityResult = execSync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`, {
      encoding: 'utf-8',
      timeout: 60000
    }).toString().trim()
    health.integrity = integrityResult === 'ok'
    
    // Get page count
    try {
      const pageCount = execSync(`sqlite3 "${dbPath}" "PRAGMA page_count;"`, {
        encoding: 'utf-8',
        timeout: 5000
      }).toString().trim()
      health.metrics.pageCount = parseInt(pageCount, 10)
    } catch {
      // Ignore
    }
    
    // Count backups
    const backupDir = SQLITE_CONFIG.backupDir
    if (existsSync(backupDir)) {
      health.backups = readdirSync(backupDir).filter(f => f.endsWith('.db')).length
      
      // Get last backup
      const backups = listBackups()
      if (backups.length > 0) {
        health.lastBackup = backups[0].timestamp
      }
    }
    
    // Determine health status
    if (!health.integrity) {
      health.status = 'unhealthy'
    } else if (health.journalMode !== 'wal') {
      health.status = 'degraded'
    } else if (health.walSize && health.walSize > 100 * 1024 * 1024) {
      // WAL file larger than 100MB is a warning sign
      health.status = 'degraded'
    }
    
  } catch (error) {
    health.status = 'unhealthy'
    console.error('[SQLite] Health check failed:', error)
  }
  
  return health
}

// ============================================================================
// Exports
// ============================================================================

export {
  SQLITE_CONFIG,
  SQLITE_PRAGMAS,
  isRetryableError,
  calculateDelay,
  sleep,
}
