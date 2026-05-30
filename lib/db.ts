import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { exec } from 'child_process'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

// Auto-push schema changes asynchronously in runtime environment where DATABASE_URL is available
if (process.env.DATABASE_URL) {
  exec('npx prisma db push --accept-data-loss', (error, stdout, _stderr) => {
    if (error) {
      console.error('Prisma db push auto-update error:', error)
    } else {
      console.log('Prisma db push auto-update accomplished successfully:', stdout, _stderr || '')
    }
  })
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma