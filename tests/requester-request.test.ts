import { describe, expect, it, vi } from 'vitest'
import { canRequesterEditOwnRequest } from '@/lib/access-control'

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}))

const requester = { userId: 'user-req', role: 'REQUESTER' as const }
const admin = { userId: 'user-admin', role: 'ADMIN' as const }
const manager = { userId: 'user-mgr', role: 'MANAGER' as const }
const technician = { userId: 'user-tech', role: 'TECHNICIAN' as const }
const otherRequester = { userId: 'user-other', role: 'REQUESTER' as const }

function wo(overrides: Partial<{ status: string; requestedById: string | null; createdById: string | null }> = {}) {
  return {
    status: 'OPEN',
    requestedById: 'user-req',
    createdById: 'user-req',
    ...overrides,
  }
}

describe('canRequesterEditOwnRequest', () => {
  it('allows the requester to edit their own OPEN work order', () => {
    expect(canRequesterEditOwnRequest(requester, wo())).toBe(true)
  })

  it('allows ownership via createdById fallback', () => {
    expect(canRequesterEditOwnRequest(requester, wo({ requestedById: null, createdById: 'user-req' }))).toBe(true)
  })

  it('blocks once work has started or the order progressed', () => {
    for (const status of ['IN_PROGRESS', 'ON_HOLD', 'PENDING_APPROVAL', 'COMPLETED', 'CLOSED', 'CANCELLED']) {
      expect(canRequesterEditOwnRequest(requester, wo({ status }))).toBe(false)
    }
  })

  it('blocks a requester editing someone elses work order', () => {
    expect(canRequesterEditOwnRequest(requester, wo({ requestedById: 'user-other', createdById: 'user-other' }))).toBe(false)
  })

  it('only applies to the REQUESTER role', () => {
    expect(canRequesterEditOwnRequest(admin, wo())).toBe(false)
    expect(canRequesterEditOwnRequest(manager, wo())).toBe(false)
    expect(canRequesterEditOwnRequest(technician, wo())).toBe(false)
  })

  it('never lets a different requester cancel someone elses order', () => {
    expect(canRequesterEditOwnRequest(otherRequester, wo())).toBe(false)
  })
})
