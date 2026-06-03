import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    min: 1,                        // force 1 connection immediately on creation
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })

  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  globalForPrisma.prisma = client
  return client
}

export const prisma = getPrisma()