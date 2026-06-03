import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

// Cache the prisma instance globally to avoid creating multiple connections
globalForPrisma.prisma = prisma

// Warm up the connection pool on startup with retry logic
let poolReady = false

async function warmupPool() {
  const maxRetries = 15
  let retries = 0
  let lastError: Error | null = null

  while (retries < maxRetries) {
    try {
      // Test the connection
      await prisma.$queryRaw`SELECT 1`
      console.log('✓ Database connection pool warmed up successfully')
      poolReady = true
      return
    } catch (error) {
      lastError = error as Error
      retries++
      const delayMs = Math.min(1000 * Math.pow(2, retries - 1), 10000) // Exponential backoff up to 10s
      console.warn(
        `Database connection attempt ${retries}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
        lastError.message
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  console.error(
    '✗ Failed to establish database connection after',
    maxRetries,
    'retries:',
    lastError?.message
  )
  poolReady = false
}

// Initialize pool warmup immediately  
const warmupPromise = warmupPool()

// Export a function to wait for pool readiness
export async function ensureDbReady() {
  await warmupPromise
  return poolReady
}