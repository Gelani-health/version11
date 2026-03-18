import { PrismaClient } from '@prisma/client'

// Clear the global cache to force fresh client with new models
declare global {
   
  var prismaGlobal: PrismaClient | undefined
}

// Always create fresh client in development to pick up new models
const createPrismaClient = () => {
  return new PrismaClient({
    log: ['query'],
  })
}

// In development, use a fresh client to ensure new models are available
export const db = process.env.NODE_ENV === 'production' 
  ? (globalThis.prismaGlobal ?? createPrismaClient())
  : createPrismaClient()

if (process.env.NODE_ENV === 'production') {
  globalThis.prismaGlobal = db
}