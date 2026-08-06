import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Money columns are stored as Prisma Decimal. Prisma's Decimal.toJSON()
// serializes to a string, which would silently change the API contract from
// number to string (breaking fmtCurrency and client arithmetic). Patch it to
// serialize as a plain number so JSON responses keep numeric money values.
if (!(Prisma.Decimal.prototype as { __moneyJsonPatched?: boolean }).__moneyJsonPatched) {
  ;(Prisma.Decimal.prototype as { __moneyJsonPatched?: boolean }).__moneyJsonPatched = true
  Prisma.Decimal.prototype.toJSON = function (this: Prisma.Decimal) {
    return this.toNumber()
  } as unknown as () => string
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

globalForPrisma.prisma = prisma