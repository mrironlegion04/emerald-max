import { describe, expect, it, vi } from 'vitest'
import { validateDowntimeEdit } from '@/lib/access-control'

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}))

const base = {
  existingDowntimeStartedAt: null,
  existingDowntimeEndedAt: null,
  currentType: 'BREAKDOWN',
}

describe('validateDowntimeEdit', () => {
  it('accepts a breakdown with both times', () => {
    expect(validateDowntimeEdit({
      ...base,
      downtimeStartedAt: '2024-01-01T08:00:00.000Z',
      downtimeEndedAt: '2024-01-01T10:00:00.000Z',
    })).toBeNull()
  })

  it('accepts setting back up time when down since is already stored but unchanged', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: '2024-01-01T08:00:00.000Z',
      existingDowntimeEndedAt: null,
      currentType: 'BREAKDOWN',
      downtimeEndedAt: '2024-01-01T10:00:00.000Z',
    })).toBeNull()
  })

  it('accepts keeping an existing back up time while leaving down since unchanged', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: '2024-01-01T08:00:00.000Z',
      existingDowntimeEndedAt: '2024-01-01T10:00:00.000Z',
      currentType: 'BREAKDOWN',
    })).toBeNull()
  })

  it('requires down since when a back up time is recorded', () => {
    expect(validateDowntimeEdit({
      ...base,
      downtimeEndedAt: '2024-01-01T10:00:00.000Z',
    })).toBe('Machine down since is required when a back up time is recorded')
  })

  it('rejects a back up time before the down time', () => {
    expect(validateDowntimeEdit({
      ...base,
      downtimeStartedAt: '2024-01-01T10:00:00.000Z',
      downtimeEndedAt: '2024-01-01T08:00:00.000Z',
    })).toBe('Back up time must be after the down time')
  })

  it('rejects a back up time before an existing stored down time', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: '2024-01-01T10:00:00.000Z',
      existingDowntimeEndedAt: null,
      currentType: 'BREAKDOWN',
      downtimeEndedAt: '2024-01-01T08:00:00.000Z',
    })).toBe('Back up time must be after the down time')
  })

  it('requires down time when switching type to BREAKDOWN', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: null,
      existingDowntimeEndedAt: null,
      currentType: 'PREVENTIVE',
      type: 'BREAKDOWN',
    })).toBe('Down time is required for breakdown work orders')
  })

  it('does not enforce down time when type is unchanged and downtime untouched', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: null,
      existingDowntimeEndedAt: null,
      currentType: 'BREAKDOWN',
    })).toBeNull()
  })

  it('accepts downtime for a non-breakdown work order', () => {
    expect(validateDowntimeEdit({
      existingDowntimeStartedAt: null,
      existingDowntimeEndedAt: null,
      currentType: 'PREVENTIVE',
      type: 'PREVENTIVE',
      downtimeStartedAt: '2024-01-01T08:00:00.000Z',
      downtimeEndedAt: '2024-01-01T10:00:00.000Z',
    })).toBeNull()
  })
})
