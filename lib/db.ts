// lib/db.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  // Patch: PrismaPg fails first query on every new connection
  // This proxy auto-retries once on P1000/AuthenticationFailed
  const handler: ProxyHandler<PrismaClient> = {
    get(target, prop) {
      const value = (target as any)[prop]
      if (typeof value !== 'object' || value === null) return value
      
      return new Proxy(value, {
        get(innerTarget, innerProp) {
          const method = (innerTarget as any)[innerProp]
          if (typeof method !== 'function') return method
          
          return async (...args: any[]) => {
            try {
              return await method.apply(innerTarget, args)
            } catch (e: any) {
              const isAuthError = 
                e?.code === 'P1000' || 
                e?.meta?.driverAdapterError?.message?.includes('AuthenticationFailed')
              if (isAuthError) {
                await new Promise(r => setTimeout(r, 300))
                return await method.apply(innerTarget, args)
              }
              throw e
            }
          }
        }
      })
    }
  }

  globalForPrisma.prisma = new Proxy(client, handler)
  return globalForPrisma.prisma
}

export const prisma = getPrisma()