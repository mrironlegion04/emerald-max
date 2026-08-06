import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { generateRequestNumber } from '@/lib/request-number'

describe('generateRequestNumber', () => {
  it('formats the sequence as REQ-XXXX', async () => {
    const client = makeClient({ counter: 11, existing: [] })
    const num = await generateRequestNumber(client as unknown as PrismaClient)
    expect(num).toBe('REQ-0012')
  })

  it('bumps past a manually created collision and retries', async () => {
    const client = makeClient({ counter: 2, existing: ['REQ-0003'] })
    const num = await generateRequestNumber(client as unknown as PrismaClient)
    expect(num).toBe('REQ-0004')
    expect(client.$executeRaw).toHaveBeenCalled()
  })

  it('throws after exhausting retries', async () => {
    const client = makeClient({
      counter: 0,
      existing: ['REQ-0001', 'REQ-0002', 'REQ-0003'],
    })
    await expect(generateRequestNumber(client as unknown as PrismaClient, 3)).rejects.toThrow(
      /Failed to generate unique request number/
    )
  })
})

interface FakeClient {
  $queryRaw: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  maintenanceRequest: { findUnique: ReturnType<typeof vi.fn> }
}

function makeClient(opts: {
  counter: number
  existing: string[]
}): FakeClient {
  let counter = opts.counter
  const existing = new Set(opts.existing)

  return {
    $queryRaw: vi.fn(async () => {
      counter += 1
      return [{ counter }]
    }),
    $executeRaw: vi.fn(async () => {}),
    maintenanceRequest: {
      findUnique: vi.fn(async ({ where }: { where: { requestNumber: string } }) =>
        existing.has(where.requestNumber) ? { id: 'exists' } : null
      ),
    },
  }
}
