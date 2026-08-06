import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { generateWONumber } from '@/lib/wo-number'

describe('generateWONumber', () => {
  it('formats the sequence with a zero-padded 4-digit counter', async () => {
    const client = makeClient({ counter: 6, existing: [] })
    const num = await generateWONumber(client as unknown as PrismaClient)
    expect(num).toBe('WO-0007')
  })

  it('bumps past a manually created collision and retries', async () => {
    const client = makeClient({ counter: 4, existing: ['WO-0005'] })
    const num = await generateWONumber(client as unknown as PrismaClient)
    // 0005 collides → counter bumped to 6 → 0006 is free
    expect(num).toBe('WO-0006')
    expect(client.$executeRaw).toHaveBeenCalled()
  })

  it('throws after exhausting retries', async () => {
    const client = makeClient({ counter: 0, existing: ['WO-0001', 'WO-0002', 'WO-0003'] })
    // bumpSequence cannot advance past the collision, so every attempt collides
    await expect(generateWONumber(client as unknown as PrismaClient, 3)).rejects.toThrow(
      /Failed to generate unique WO number/
    )
  })
})

interface FakeClient {
  $queryRaw: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  workOrder: { findUnique: ReturnType<typeof vi.fn> }
}

function makeClient(opts: { counter: number; existing: string[] }): FakeClient {
  let counter = opts.counter
  const existing = new Set(opts.existing)

  const $queryRaw = vi.fn(async () => {
    counter += 1
    return [{ counter }]
  })
  const $executeRaw = vi.fn(async () => {})

  return {
    $queryRaw,
    $executeRaw,
    workOrder: {
      findUnique: vi.fn(async ({ where }: { where: { woNumber: string } }) =>
        existing.has(where.woNumber) ? { id: 'exists' } : null
      ),
    },
  }
}
