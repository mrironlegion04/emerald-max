import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { sanitizeLocationCode, generateWONumber } from '@/lib/wo-number'

describe('sanitizeLocationCode', () => {
  it('uppercases and strips unsafe characters', () => {
    expect(sanitizeLocationCode('  plant 01 ')).toBe('PLANT0')
    expect(sanitizeLocationCode('a.b/c')).toBe('ABC')
  })

  it('caps at 6 characters (may include a trailing dash)', () => {
    expect(sanitizeLocationCode('plant-a')).toBe('PLANT-')
    expect(sanitizeLocationCode('abcdefghij')).toBe('ABCDEF')
  })

  it('falls back to GLB for empty or null input', () => {
    expect(sanitizeLocationCode(null)).toBe('GLB')
    expect(sanitizeLocationCode(undefined)).toBe('GLB')
    expect(sanitizeLocationCode('   ')).toBe('GLB')
  })
})

describe('generateWONumber', () => {
  it('formats the sequence with a zero-padded 4-digit counter', async () => {
    const client = makeClient({ counter: 6, existing: [] })
    const num = await generateWONumber('loc-1', client as unknown as PrismaClient)
    expect(num).toBe('LOC-1-WO-0007')
  })

  it('bumps past a manually created collision and retries', async () => {
    const client = makeClient({ counter: 4, existing: ['LOC-1-WO-0005'] })
    const num = await generateWONumber('loc-1', client as unknown as PrismaClient)
    // 0005 collides → counter bumped to 6 → 0006 is free
    expect(num).toBe('LOC-1-WO-0006')
    expect(client.$executeRaw).toHaveBeenCalled()
  })

  it('uses the GLB prefix when no location code resolves', async () => {
    const client = makeClient({ counter: 0, existing: [], locationCode: null })
    const num = await generateWONumber('loc-1', client as unknown as PrismaClient)
    expect(num).toBe('GLB-WO-0001')
  })

  it('throws after exhausting retries', async () => {
    const client = makeClient({
      counter: 0,
      existing: ['GLB-WO-0001', 'GLB-WO-0002', 'GLB-WO-0003'],
    })
    // bumpSequence cannot advance past the collision, so every attempt collides
    await expect(generateWONumber(null, client as unknown as PrismaClient, 3)).rejects.toThrow(
      /Failed to generate unique WO number/
    )
  })
})

interface FakeClient {
  $queryRaw: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  location: { findUnique: ReturnType<typeof vi.fn> }
  workOrder: { findUnique: ReturnType<typeof vi.fn> }
}

function makeClient(opts: {
  counter: number
  existing: string[]
  locationCode?: string | null
}): FakeClient {
  let counter = opts.counter
  const existing = new Set(opts.existing)
  const locationCode = opts.locationCode === undefined ? 'LOC-1' : opts.locationCode

  const $queryRaw = vi.fn(async () => {
    counter += 1
    return [{ counter }]
  })
  const $executeRaw = vi.fn(async () => {})

  return {
    $queryRaw,
    $executeRaw,
    location: {
      findUnique: vi.fn(async () => (locationCode ? { code: locationCode } : null)),
    },
    workOrder: {
      findUnique: vi.fn(async ({ where }: { where: { woNumber: string } }) =>
        existing.has(where.woNumber) ? { id: 'exists' } : null
      ),
    },
  }
}
