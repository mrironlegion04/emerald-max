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
    let client
    try {
      // Test the pool connection directly (not via Prisma)
      client = await pool.connect()
      await client.query('SELECT 1')
      console.log('✓ Database connection pool warmed up successfully (direct pool test)')
      poolReady = true
      client.release()
      return
    } catch (error) {
      if (client) client.release(true)
      lastError = error as Error
      retries++
      const delayMs = Math.min(1000 * Math.pow(2, retries - 1), 10000)
      console.warn(
        `[Pool Warmup] Attempt ${retries}/${maxRetries} failed: ${(error as any)?.message}. Retrying in ${delayMs}ms...`
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
  throw lastError
}

// Start warmup but don't block - we'll handle failures gracefully in requests
const warmupPromise = warmupPool().catch((err) => {
  console.error('Pool warmup failed, will retry on first request:', err.message)
})

// Export a function to wait for pool readiness before making queries
export async function ensureDbReady() {
  await warmupPromise
  if (!poolReady) {
    throw new Error('Database pool failed to warm up')
  }
}