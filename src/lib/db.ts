/**
 * Prisma Database Client with SQLite Optimizations
 * 
 * Features:
 * - WAL mode for better concurrency
 * - Automatic retry on SQLITE_BUSY errors (via wrapper functions)
 * - Backup-on-write for crash safety
 * - Connection pooling optimization
 * - Health monitoring
 * 
 * Edge Runtime Compatible: No Node.js-specific APIs at module level
 */

import { 
  initializeDatabase,
  getDatabaseHealth,
  createBackup,
  checkIntegrity,
  applySQLitePragmas,
  withRetry,
  type DatabaseHealth
} from './sqlite-optimizations'
import { PrismaClient } from '@prisma/client'

// ============================================================================
// Global Type Declarations
// ============================================================================

declare global {
  var prismaGlobal: PrismaClient | undefined
  var dbInitialized: boolean | undefined
  var writeCounter: number | undefined
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
    
    // Use dynamic require for fs to be Edge Runtime compatible
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
        // fs not available (Edge Runtime), use default
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
  
  // Initialize database with WAL mode and optimal settings
  if (!globalThis.dbInitialized) {
    console.log('[DB] Initializing database with SQLite optimizations...')
    
    try {
      initializeDatabase(dbPath)
      globalThis.dbInitialized = true
    } catch (error) {
      console.error('[DB] Database initialization failed:', error)
      // Continue anyway, let Prisma handle it
    }
  }
  
  // Determine logging level based on environment
  // Production: Only warnings and errors (NO query logging)
  // Development: Query, warn, and error logging
  const logLevel: ('query' | 'info' | 'warn' | 'error')[] = 
    process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error']
  
  // Create Prisma client without deprecated middleware
  const client = new PrismaClient({
    log: logLevel,
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })
  
  // Store dbPath for backup functionality
  ;(client as any)._dbPath = dbPath
  
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
// Retry Wrapper for Database Operations
// ============================================================================

/**
 * Execute a database operation with automatic retry on SQLITE_BUSY errors
 * Use this for critical write operations that need retry logic
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
      
      // Check if error is retryable (SQLite busy/locked errors)
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
      
      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 100, maxDelay)
      
      console.warn(`[DB] Retrying operation (${attempt + 1}/${maxAttempts}) after ${Math.round(delay)}ms`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// ============================================================================
// Backup on Write (Optional)
// ============================================================================

/**
 * Create backup after write operations (call manually when needed)
 */
export function backupAfterWrite(): void {
  const dbPath = (db as any)._dbPath
  if (!dbPath) return
  
  // Create backup every 50 writes (approximately)
  const writeCounter = globalThis.writeCounter || 0
  globalThis.writeCounter = writeCounter + 1
  
  if (writeCounter % 50 === 0 && process.env.BACKUP_ON_WRITE !== 'false') {
    // Use setTimeout for Edge Runtime compatibility
    setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { existsSync } = require('fs')
        if (existsSync(dbPath)) {
          createBackup(dbPath, 'write')
        }
      } catch {
        // Backup failure should not affect the operation
      }
    }, 0)
  }
}

// ============================================================================
// Health Check Export
// ============================================================================

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const dbUrl = resolveDatabaseUrl()
  const dbPath = dbUrl.replace('file:', '')
  return getDatabaseHealth(dbPath)
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  initializeDatabase,
  getDatabaseHealth,
  createBackup,
  checkIntegrity,
  applySQLitePragmas,
  withRetry
}
