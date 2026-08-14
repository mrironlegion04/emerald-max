import { describe, expect, it, vi } from 'vitest'
import { completionResolutionError } from '@/lib/access-control'

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}))

describe('completionResolutionError', () => {
  it('returns null for non-completion statuses', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED']) {
      expect(completionResolutionError(status, undefined, null)).toBeNull()
      expect(completionResolutionError(status, null, null)).toBeNull()
    }
  })

  it('requires a resolution when entering the completion flow', () => {
    for (const status of ['PENDING_APPROVAL', 'COMPLETED', 'CLOSED']) {
      expect(completionResolutionError(status, undefined, null)).toBe(
        'Resolution is required before completing or closing a work order'
      )
      expect(completionResolutionError(status, null, null)).toBe(
        'Resolution is required before completing or closing a work order'
      )
    }
  })

  it('allows completion when a resolution is provided', () => {
    for (const status of ['PENDING_APPROVAL', 'COMPLETED', 'CLOSED']) {
      expect(completionResolutionError(status, 'CORRECTION', null)).toBeNull()
      expect(completionResolutionError(status, 'REPLACEMENT', null)).toBeNull()
    }
  })

  it('falls back to the existing resolution when none is provided', () => {
    expect(completionResolutionError('COMPLETED', undefined, 'DESIGN')).toBeNull()
    expect(completionResolutionError('CLOSED', undefined, 'PREVENTIVE_MAINTENANCE')).toBeNull()
    expect(completionResolutionError('PENDING_APPROVAL', undefined, 'CORRECTION')).toBeNull()
  })

  it('provided value wins over the existing one', () => {
    expect(completionResolutionError('COMPLETED', 'DESIGN', 'REPLACEMENT')).toBeNull()
    expect(completionResolutionError('COMPLETED', null, 'REPLACEMENT')).toBe(
      'Resolution is required before completing or closing a work order'
    )
  })
})
