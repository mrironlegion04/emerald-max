// lib/db.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function getPool(): Pool {
  if (globalForPrisma.pool) return globalForPrisma.pool

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    min: 2,                          // keep minimum 2 connections alive always
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,  // give more time
    allowExitOnIdle: false,          // never let pool go fully idle
  })

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  pool.on('connect', () => {
    console.log('New DB connection established')
  })

  globalForPrisma.pool = pool
  return pool
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const adapter = new PrismaPg(getPool())
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  globalForPrisma.prisma = client
  return client
}

export const prisma = getPrisma()