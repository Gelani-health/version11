/**
 * Prisma Database Client with SQLite Optimizations
 * 
 * Features:
 * - WAL mode for better concurrency
 * - Automatic retry on SQLITE_BUSY errors
 * - Backup-on-write for crash safety
 * - Connection pooling optimization
 * - Health monitoring
 */

import { 
  createOptimizedPrismaClient, 
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
    
    for (const path of possiblePaths) {
      const { existsSync } = require('fs')
      if (existsSync(path)) {
        dbUrl = `file:${path}`
        console.log(`[DB] Using database: ${path}`)
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
  const logLevel: ('query' | 'info' | 'warn' | 'error')[] = 
    process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error']
  
  // Create optimized Prisma client
  const client = new PrismaClient({
    log: logLevel,
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })
  
  // Add retry middleware
  client.$use(async (params, next) => {
    const maxAttempts = 6 // 1 initial + 5 retries
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await next(params)
        return result
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
        const baseDelay = 100
        const maxDelay = 5000
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 100, maxDelay)
        
        console.warn(`[DB] Retrying ${params.model}.${params.action} (${attempt + 1}/${maxAttempts}) after ${Math.round(delay)}ms`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  })
  
  // Add backup-on-write middleware (for write operations)
  if (process.env.BACKUP_ON_WRITE !== 'false') {
    client.$use(async (params, next) => {
      const result = await next(params)
      
      // Only backup after successful write operations
      if (['create', 'update', 'delete', 'upsert'].includes(params.action)) {
        // Defer backup to not block the response
        setImmediate(() => {
          try {
            const { existsSync } = require('fs')
            if (existsSync(dbPath)) {
              // Create backup every 50 writes (approximately)
              // This reduces I/O while still maintaining safety
              const writeCounter = (globalThis as any).writeCounter || 0
              ;(globalThis as any).writeCounter = writeCounter + 1
              
              if (writeCounter % 50 === 0) {
                createBackup(dbPath, 'write')
              }
            }
          } catch {
            // Backup failure should not affect the operation
          }
        })
      }
      
      return result
    })
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
// Graceful Shutdown
// ============================================================================

async function gracefulShutdown(signal: string) {
  console.log(`[DB] ${signal} received, disconnecting...`)
  
  try {
    await db.$disconnect()
    console.log('[DB] Disconnected successfully')
  } catch (error) {
    console.error('[DB] Error during disconnect:', error)
  }
  
  process.exit(0)
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
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
