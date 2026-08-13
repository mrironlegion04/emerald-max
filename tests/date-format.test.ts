import { describe, expect, it } from 'vitest'
import {
  dateOnlyToUtcMidnight,
  utcDateOnly,
  localDateOnly,
  todayLocal,
  todayUTC,
  isOverdueByDate,
  isValidTime,
  extractTimeOnly,
  fmtDateOnly,
  fmtScheduledTime,
  endOfUtcDay,
} from '@/lib/date-format'

describe('dateOnlyToUtcMidnight', () => {
  it('parses yyyy-mm-dd to UTC midnight', () => {
    expect(dateOnlyToUtcMidnight('2026-08-12')?.toISOString()).toBe('2026-08-12T00:00:00.000Z')
  })

  it('rejects malformed input', () => {
    expect(dateOnlyToUtcMidnight('12-08-2026')).toBeNull()
    expect(dateOnlyToUtcMidnight('2026-8-2')).toBeNull()
    expect(dateOnlyToUtcMidnight('2026-13-01')).toBeNull()
    expect(dateOnlyToUtcMidnight('')).toBeNull()
    expect(dateOnlyToUtcMidnight(null)).toBeNull()
  })
})

describe('utcDateOnly', () => {
  it('extracts the UTC calendar day', () => {
    expect(utcDateOnly('2026-08-12T12:00:00.000Z')).toBe('2026-08-12')
    expect(utcDateOnly('2026-08-12T23:59:59.999Z')).toBe('2026-08-12')
    expect(utcDateOnly(null)).toBeNull()
  })
})

describe('localDateOnly / todayLocal', () => {
  it('extracts the local calendar day (Asia/Kolkata box)', () => {
    expect(localDateOnly('2026-08-11T20:30:00.000Z')).toBe('2026-08-12')
    expect(localDateOnly('2026-08-12T00:00:00.000Z')).toBe('2026-08-12')
  })

  it('todayLocal and todayUTC return valid yyyy-mm-dd', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(todayUTC()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isOverdueByDate', () => {
  it('is day-based regardless of stored time', () => {
    const due = '2026-08-12T12:00:00.000Z'
    expect(isOverdueByDate(due, '2026-08-11')).toBe(false)
    expect(isOverdueByDate(due, '2026-08-12')).toBe(false)
    expect(isOverdueByDate(due, '2026-08-13')).toBe(true)
  })

  it('handles null and bad input', () => {
    expect(isOverdueByDate(null, '2026-08-13')).toBe(false)
    expect(isOverdueByDate('not-a-date', '2026-08-13')).toBe(false)
  })
})

describe('isValidTime', () => {
  it('accepts 24h HH:mm and empty', () => {
    expect(isValidTime('09:30')).toBe(true)
    expect(isValidTime('14:00')).toBe(true)
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('')).toBe(true)
    expect(isValidTime(null)).toBe(true)
    expect(isValidTime(undefined)).toBe(true)
  })

  it('rejects invalid times', () => {
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:00')).toBe(false)
    expect(isValidTime('12:60')).toBe(false)
    expect(isValidTime('noon')).toBe(false)
  })
})

describe('extractTimeOnly', () => {
  it('returns HH:mm of the stored instant (UTC wall clock)', () => {
    expect(extractTimeOnly('2026-08-12T14:30:00.000Z')).toBe('14:30')
    expect(extractTimeOnly('2026-08-12T00:00:00.000Z')).toBe('00:00')
    expect(extractTimeOnly(null)).toBeNull()
  })
})

describe('fmtDateOnly', () => {
  it('formats a date-only string', () => {
    expect(fmtDateOnly('2026-08-12')).toBe('12 Aug 2026')
    expect(fmtDateOnly(null)).toBe('—')
  })
})

describe('fmtScheduledTime', () => {
  it('formats 24h HH:mm to 12h', () => {
    expect(fmtScheduledTime('14:00')).toBe('2 PM')
    expect(fmtScheduledTime('09:30')).toBe('9:30 AM')
    expect(fmtScheduledTime('00:00')).toBe('12 AM')
    expect(fmtScheduledTime('12:00')).toBe('12 PM')
    expect(fmtScheduledTime(null)).toBeNull()
    expect(fmtScheduledTime('oops')).toBeNull()
  })
})

describe('endOfUtcDay', () => {
  it('returns the last millisecond of the UTC day', () => {
    expect(endOfUtcDay('2026-08-12T00:00:00.000Z').toISOString()).toBe('2026-08-12T23:59:59.999Z')
    expect(endOfUtcDay('2026-08-12T12:00:00.000Z').toISOString()).toBe('2026-08-12T23:59:59.999Z')
  })
})
