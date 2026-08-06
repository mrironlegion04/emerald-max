import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import '@/lib/db' // side effect: applies the Decimal toJSON -> number patch

// Guards the lib/db.ts toJSON patch that keeps money values numeric in the
// API contract instead of Prisma's default string serialization.
describe('Prisma Decimal JSON serialization', () => {
  it('serializes Decimal as a plain number', () => {
    const d = new Prisma.Decimal('18.75')
    const out = JSON.parse(JSON.stringify(d))
    expect(out).toBe(18.75)
    expect(typeof out).toBe('number')
  })

  it('serializes integer-valued Decimals as numbers', () => {
    const out = JSON.parse(JSON.stringify(new Prisma.Decimal('45')))
    expect(out).toBe(45)
    expect(typeof out).toBe('number')
  })

  it('keeps nulls as null', () => {
    const out = JSON.parse(JSON.stringify({ unitCost: null }))
    expect(out.unitCost).toBeNull()
  })

  it('survives round-trips inside object trees', () => {
    const obj = {
      laborCost: new Prisma.Decimal('200'),
      partsCost: new Prisma.Decimal('73.50'),
      name: 'WO-1',
    }
    const out = JSON.parse(JSON.stringify(obj))
    expect(out).toEqual({ laborCost: 200, partsCost: 73.5, name: 'WO-1' })
  })
})
