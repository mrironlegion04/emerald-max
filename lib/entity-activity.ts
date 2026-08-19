import { fmtDateTime } from '@/lib/utils'

export interface EntityActivityEvent {
  id: string
  type: 'create' | 'update' | 'delete' | 'restore'
  createdAt: string
  actor: string | null
  summary: string
  details: string[]
  notes: string | null
}

const PM_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  triggerType: 'Trigger type',
  frequency: 'Frequency',
  interval: 'Interval',
  nextDueDate: 'Next due date',
  isActive: 'Status',
  scheduleBehavior: 'Schedule behavior',
  woPriority: 'WO priority',
  woDescription: 'WO description',
  woAssignedToId: 'WO assignee',
  woTeamId: 'WO team',
  woCategoryId: 'WO category',
  assetId: 'Asset',
  locationId: 'Location',
  startDateOffset: 'Start date offset',
  schedulingHorizon: 'Scheduling horizon',
}

const ASSET_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  assetCode: 'Asset code',
  description: 'Description',
  status: 'Status',
  categoryId: 'Category',
  locationId: 'Location',
  parentId: 'Parent asset',
  isDeleted: 'Archive status',
}

const PM_VALUE_FORMATTERS: Record<string, (v: unknown) => string> = {
  frequency: (v) => {
    const labels: Record<string, string> = { HOURLY: 'Hourly', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' }
    return labels[String(v)] ?? String(v)
  },
  triggerType: (v) => {
    const labels: Record<string, string> = { TIME: 'Time-based', METER: 'Meter-based', CONDITION: 'Condition-based' }
    return labels[String(v)] ?? String(v)
  },
  scheduleBehavior: (v) => {
    const labels: Record<string, string> = { FIXED: 'Fixed', FLOATING: 'Floating' }
    return labels[String(v)] ?? String(v)
  },
  woPriority: (v) => {
    const labels: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }
    return labels[String(v)] ?? String(v)
  },
  isActive: (v) => v === true ? 'Active' : 'Inactive',
  nextDueDate: (v) => v ? fmtDateTime(String(v)) : '—',
}

const ASSET_VALUE_FORMATTERS: Record<string, (v: unknown) => string> = {
  status: (v) => {
    const labels: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', MAINTENANCE: 'In maintenance', DECOMMISSIONED: 'Decommissioned' }
    return labels[String(v)] ?? String(v)
  },
  isDeleted: (v) => v === true ? 'Archived' : 'Active',
}

function prettifyKey(key: string, fieldLabels: Record<string, string>): string {
  if (fieldLabels[key]) return fieldLabels[key]
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/([a-z])(\d)/g, '$1 $2').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function truncate(v: string, max = 60): string {
  return v.length > max ? `${v.slice(0, max)}…` : v
}

function formatValue(key: string, value: unknown, formatters: Record<string, (v: unknown) => string>): string {
  if (value === null || value === undefined) return '—'
  if (formatters[key]) return formatters[key](value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return 'Changed'
  const str = String(value)
  return truncate(str)
}

function buildSummary(action: string, entityName: string, keys: string[], fieldLabels: Record<string, string>): string {
  if (action === 'CREATE') return `${entityName} created`
  if (action === 'DELETE') return `${entityName} archived`
  if (keys.length > 0) {
    const first = prettifyKey(keys[0], fieldLabels)
    return keys.length === 1 ? `${first} updated` : `${first} +${keys.length - 1} more updated`
  }
  return `${entityName} updated`
}

export interface AuditLogRow {
  id: string
  action: string
  entityName: string
  changes: string | null
  userName: string | null
  createdAt: Date
}

export function buildEntityActivityEvents(
  auditLogs: AuditLogRow[],
  opts: {
    fieldLabels: Record<string, string>
    valueFormatters: Record<string, (v: unknown) => string>
  },
): EntityActivityEvent[] {
  const events: EntityActivityEvent[] = []

  for (const log of auditLogs) {
    const actor = log.userName || null
    const createdAt = log.createdAt.toISOString()

    if (log.action === 'CREATE') {
      events.push({
        id: `a-${log.id}`,
        type: 'create',
        createdAt,
        actor,
        summary: `${log.entityName} created`,
        details: [],
        notes: null,
      })
      continue
    }

    if (log.action === 'DELETE') {
      events.push({
        id: `a-${log.id}`,
        type: 'delete',
        createdAt,
        actor,
        summary: `${log.entityName} archived`,
        details: [],
        notes: null,
      })
      continue
    }

    if (log.action === 'UPDATE' && log.changes) {
      let parsed: Record<string, { before: unknown; after: unknown }> = {}
      try {
        parsed = JSON.parse(log.changes)
      } catch { continue }

      // Check for restore
      if (parsed.isDeleted?.before === true && parsed.isDeleted?.after === false) {
        events.push({
          id: `a-${log.id}`,
          type: 'restore',
          createdAt,
          actor,
          summary: `${log.entityName} restored`,
          details: [],
          notes: null,
        })
        continue
      }

      const keys = Object.keys(parsed)
      if (keys.length === 0) continue

      const details: string[] = []
      for (const key of keys) {
        const before = formatValue(key, parsed[key].before, opts.valueFormatters)
        const after = formatValue(key, parsed[key].after, opts.valueFormatters)
        details.push(`${prettifyKey(key, opts.fieldLabels)}: ${before} → ${after}`)
      }

      events.push({
        id: `a-${log.id}`,
        type: 'update',
        createdAt,
        actor,
        summary: buildSummary(log.action, log.entityName, keys, opts.fieldLabels),
        details,
        notes: null,
      })
    }
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return events
}

export function buildPmActivityEvents(auditLogs: AuditLogRow[]): EntityActivityEvent[] {
  return buildEntityActivityEvents(auditLogs, {
    fieldLabels: PM_FIELD_LABELS,
    valueFormatters: PM_VALUE_FORMATTERS,
  })
}

export function buildAssetActivityEvents(auditLogs: AuditLogRow[]): EntityActivityEvent[] {
  return buildEntityActivityEvents(auditLogs, {
    fieldLabels: ASSET_FIELD_LABELS,
    valueFormatters: ASSET_VALUE_FORMATTERS,
  })
}
