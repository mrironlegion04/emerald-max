import { describe, expect, it, vi } from 'vitest'
import { canChangePMGeneratedWOFields } from '@/lib/access-control'

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined }),
}))

const pmWO = { maintenanceScheduleId: 'schedule-1', woCategoryId: 'cat-1' }
const pmWONoCategory = { maintenanceScheduleId: 'schedule-1', woCategoryId: null }
const normalWO = { maintenanceScheduleId: null, woCategoryId: null }

describe('canChangePMGeneratedWOFields', () => {
  it('allows any edit on a non-PM work order', () => {
    expect(canChangePMGeneratedWOFields(normalWO, { type: 'BREAKDOWN' })).toEqual({ allowed: true })
    expect(canChangePMGeneratedWOFields(normalWO, { woCategoryId: null })).toEqual({ allowed: true })
    expect(canChangePMGeneratedWOFields(normalWO, { type: 'PREDICTIVE', woCategoryId: '' })).toEqual({ allowed: true })
  })

  it('blocks changing the type away from PREVENTIVE on a PM work order', () => {
    for (const type of ['BREAKDOWN', 'PREDICTIVE']) {
      const result = canChangePMGeneratedWOFields(pmWO, { type })
      expect(result).toEqual({
        allowed: false,
        reason: 'Type is managed by the PM schedule and cannot be changed',
      })
    }
  })

  it('allows sending PREVENTIVE explicitly on a PM work order', () => {
    expect(canChangePMGeneratedWOFields(pmWO, { type: 'PREVENTIVE' })).toEqual({ allowed: true })
  })

  it('allows edits that leave the type untouched on a PM work order', () => {
    expect(canChangePMGeneratedWOFields(pmWO, {})).toEqual({ allowed: true })
    expect(canChangePMGeneratedWOFields(pmWO, { woCategoryId: 'cat-2' })).toEqual({ allowed: true })
  })

  it('blocks clearing the category on a PM work order', () => {
    expect(canChangePMGeneratedWOFields(pmWO, { woCategoryId: null })).toEqual({
      allowed: false,
      reason: 'Category cannot be cleared on a schedule-generated work order',
    })
    expect(canChangePMGeneratedWOFields(pmWO, { woCategoryId: '' })).toEqual({
      allowed: false,
      reason: 'Category cannot be cleared on a schedule-generated work order',
    })
  })

  it('allows switching to another category on a PM work order', () => {
    expect(canChangePMGeneratedWOFields(pmWO, { woCategoryId: 'cat-2' })).toEqual({ allowed: true })
  })

  it('allows an empty category when the PM work order never had one (no-op)', () => {
    expect(canChangePMGeneratedWOFields(pmWONoCategory, { woCategoryId: null })).toEqual({ allowed: true })
    expect(canChangePMGeneratedWOFields(pmWONoCategory, { woCategoryId: '' })).toEqual({ allowed: true })
  })

  it('allows leaving the category untouched on a PM work order', () => {
    expect(canChangePMGeneratedWOFields(pmWO, { type: 'PREVENTIVE' })).toEqual({ allowed: true })
  })
})
