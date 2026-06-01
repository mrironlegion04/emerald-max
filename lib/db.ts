import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { execSync } from 'child_process'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbMigrated: boolean | undefined
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Self-healing database mechanism: auto-sync schema exactly once on load
if (!globalForPrisma.dbMigrated) {
  try {
    console.log('[db-init] Running self-healing schema sync on start...')
    execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8', stdio: 'inherit' })
    console.log('[db-init] Schema sync completed successfully')
    globalForPrisma.dbMigrated = true
  } catch (error) {
    const err = error as Error
    console.warn('[db-init] Schema sync skipped/failed:', err.message)
  }
}
