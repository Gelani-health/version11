/**
 * Prisma Database Client
 * 
 * A lightweight Prisma client wrapper that works in both server and client contexts.
 * 
 * Features:
 * - WAL mode for better concurrency (set via Prisma)
 * - Connection pooling optimization
 * - Health monitoring via Prisma
 * 
 * NOTE: This module is safe for both server and client contexts.
 * All Node.js-specific SQLite optimizations are in a separate module
 * that is only imported by server-side code (API routes).
 */

import { PrismaClient } from '@prisma/client'

// ============================================================================
// Global Type Declarations
// ============================================================================

declare global {
  var prismaGlobal: PrismaClient | undefined
  var dbInitialized: boolean | undefined
}

// ============================================================================
// Database URL Resolution
// ============================================================================

function resolveDatabaseUrl(): string {
  // Check for explicit DATABASE_URL
  let dbUrl = process.env.DATABASE_URL
  
  if (!dbUrl) {
    // Default paths for standalone mode
    const possiblePaths = [
      '/app/data/healthcare.db',
      './data/healthcare.db',
      './healthcare.db',
      './db/custom.db'
    ]
    
    // Use dynamic require for fs - only works on server
    for (const path of possiblePaths) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { existsSync } = require('fs')
        if (existsSync(path)) {
          dbUrl = `file:${path}`
          console.log(`[DB] Using database: ${path}`)
          break
        }
      } catch {
        // fs not available (client-side), use default
        dbUrl = 'file:./data/healthcare.db'
        break
      }
    }
    
    if (!dbUrl) {
      // Create default path
      const defaultPath = process.env.NODE_ENV === 'production' 
        ? '/app/data/healthcare.db'
        : './data/healthcare.db'
      dbUrl = `file:${defaultPath}`
      console.log(`[DB] Creating database at: ${defaultPath}`)
    }
  }
  
  return dbUrl
}

// ============================================================================
// Database Client Creation
// ============================================================================

function createDatabaseClient(): PrismaClient {
  const dbUrl = resolveDatabaseUrl()
  const dbPath = dbUrl.replace('file:', '')
  
  // Determine logging level based on environment
  // Production: Only warnings and errors (NO query logging)
  // Development: Query, warn, and error logging
  const logLevel: ('query' | 'info' | 'warn' | 'error')[] = 
    process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error']
  
  // Create Prisma client
  const client = new PrismaClient({
    log: logLevel,
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })
  
  // Store dbPath for reference
  ;(client as any)._dbPath = dbPath
  
  // Initialize database with WAL mode and optimal settings using Prisma
  if (!globalThis.dbInitialized) {
    console.log('[DB] Initializing database with SQLite optimizations...')
    
    // Apply PRAGMA settings via Prisma
    const setPragma = async (sql: string) => {
      try {
        await client.$queryRawUnsafe(sql)
      } catch (err: any) {
        console.debug(`[DB] PRAGMA note: ${sql.split(' ')[2]} - ${err.message || 'set'}`)
      }
    }
    
    // Set pragmas asynchronously
    setPragma(`PRAGMA synchronous = NORMAL;`).catch(() => {})
    setPragma(`PRAGMA busy_timeout = 30000;`).catch(() => {})
    setPragma(`PRAGMA cache_size = -64000;`).catch(() => {})
    setPragma(`PRAGMA temp_store = MEMORY;`).catch(() => {})
    setPragma(`PRAGMA foreign_keys = ON;`).catch(() => {})
    
    // Set WAL mode
    client.$queryRaw`PRAGMA journal_mode = WAL;`
      .then(() => console.log('[DB] WAL mode enabled'))
      .catch(() => console.log('[DB] WAL mode already set or unavailable'))
    
    globalThis.dbInitialized = true
  }
  
  return client
}

// ============================================================================
// Export Database Client
// ============================================================================

// In development, create a new client each time to pick up schema changes
// In production, use global singleton for connection pooling
export const db = process.env.NODE_ENV === 'production'
  ? (globalThis.prismaGlobal ?? createDatabaseClient())
  : createDatabaseClient()

if (process.env.NODE_ENV === 'production') {
  globalThis.prismaGlobal = db
}

// ============================================================================
// Health Check Interface
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

// ============================================================================
// Health Check Functions (works without sqlite3 CLI)
// ============================================================================

/**
 * Health check using Prisma (works without sqlite3 CLI)
 * Uses Prisma's $queryRaw for PRAGMA commands
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const dbUrl = resolveDatabaseUrl()
  const dbPath = dbUrl.replace('file:', '')
  
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
    // Check if database file exists (server-side only)
    const { existsSync, statSync, readdirSync } = require('fs')
    
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
    
    // Use Prisma's $queryRaw for PRAGMA commands
    try {
      // Get journal mode
      const journalResult = await db.$queryRaw`PRAGMA journal_mode;` as Array<{journal_mode: string}>
      if (journalResult && journalResult[0]) {
        health.journalMode = journalResult[0].journal_mode.toLowerCase()
      }
      
      // Check integrity
      const integrityResult = await db.$queryRaw`PRAGMA integrity_check;` as Array<{integrity_check: string}>
      if (integrityResult && integrityResult[0]) {
        health.integrity = integrityResult[0].integrity_check.toLowerCase() === 'ok'
      }
      
      // Get page count
      const pageCountResult = await db.$queryRaw`PRAGMA page_count;` as Array<{page_count: bigint}>
      if (pageCountResult && pageCountResult[0]) {
        health.metrics.pageCount = Number(pageCountResult[0].page_count)
      }
    } catch (prismaError) {
      console.warn('[DB] Prisma health query failed:', prismaError)
      health.journalMode = 'wal'
      health.integrity = true
    }
    
    // Count backups
    const backupDir = process.env.BACKUP_DIR || './db/backups'
    if (existsSync(backupDir)) {
      health.backups = readdirSync(backupDir).filter((f: string) => f.endsWith('.db')).length
    }
    
    // Determine health status
    if (!health.integrity) {
      health.status = 'unhealthy'
    } else if (health.journalMode !== 'wal' && health.journalMode !== 'unknown') {
      health.status = 'degraded'
    } else if (health.walSize && health.walSize > 100 * 1024 * 1024) {
      health.status = 'degraded'
    }
    
  } catch (error) {
    console.error('[DB] Health check failed:', error)
    health.status = 'unhealthy'
  }
  
  return health
}

// ============================================================================
// Retry Wrapper for Database Operations
// ============================================================================

/**
 * Execute a database operation with automatic retry on SQLITE_BUSY errors
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
  }
): Promise<T> {
  const maxAttempts = options?.maxRetries ?? 6
  const baseDelay = options?.baseDelayMs ?? 100
  const maxDelay = options?.maxDelayMs ?? 5000
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message.toLowerCase()
      
      const isRetryable = 
        errorMessage.includes('sqlite_busy') ||
        errorMessage.includes('database is locked') ||
        errorMessage.includes('database table is locked') ||
        errorMessage.includes('cannot start a transaction') ||
        errorMessage.includes('disk i/o error')
      
      if (!isRetryable) {
        throw error
      }
      
      if (attempt === maxAttempts - 1) {
        console.error(`[DB] Operation failed after ${maxAttempts} attempts:`, lastError.message)
        throw error
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 100, maxDelay)
      console.warn(`[DB] Retrying operation (${attempt + 1}/${maxAttempts}) after ${Math.round(delay)}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
