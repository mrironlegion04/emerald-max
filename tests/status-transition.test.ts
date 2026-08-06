import { describe, expect, it, vi } from 'vitest'
import { isValidWOStatusTransition } from '@/lib/access-control'

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}))

describe('isValidWOStatusTransition', () => {
  it('accepts documented forward transitions', () => {
    const valid: [string, string][] = [
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'CANCELLED'],
      ['IN_PROGRESS', 'PENDING_APPROVAL'],
      ['IN_PROGRESS', 'ON_HOLD'],
      ['IN_PROGRESS', 'CANCELLED'],
      ['ON_HOLD', 'IN_PROGRESS'],
      ['PENDING_APPROVAL', 'COMPLETED'],
      ['PENDING_APPROVAL', 'IN_PROGRESS'],
      ['COMPLETED', 'OPEN'],
      ['COMPLETED', 'CLOSED'],
      ['CLOSED', 'COMPLETED'],
      ['CANCELLED', 'OPEN'],
    ]
    for (const [from, to] of valid) {
      expect(isValidWOStatusTransition(from, to)).toBe(true)
    }
  })

  it('rejects unknown and illegal transitions', () => {
    const invalid: [string, string][] = [
      ['OPEN', 'COMPLETED'],
      ['OPEN', 'CLOSED'],
      ['OPEN', 'PENDING_APPROVAL'],
      ['IN_PROGRESS', 'COMPLETED'], // must go through PENDING_APPROVAL
      ['IN_PROGRESS', 'CLOSED'],
      ['ON_HOLD', 'COMPLETED'],
      ['PENDING_APPROVAL', 'CLOSED'],
      ['PENDING_APPROVAL', 'CANCELLED'],
      ['COMPLETED', 'IN_PROGRESS'],
      ['COMPLETED', 'CANCELLED'],
      ['CLOSED', 'OPEN'],
      ['CLOSED', 'CANCELLED'],
      ['CANCELLED', 'COMPLETED'],
      ['CANCELLED', 'CLOSED'],
      ['OPEN', 'OPEN'],
      ['UNKNOWN', 'OPEN'],
      ['OPEN', 'UNKNOWN'],
      ['', ''],
    ]
    for (const [from, to] of invalid) {
      expect(isValidWOStatusTransition(from, to)).toBe(false)
    }
  })
})
