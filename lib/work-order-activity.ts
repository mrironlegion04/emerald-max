import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import { fmtDateTime } from '@/lib/utils'
import { fmtDateOnly, utcDateOnly } from '@/lib/date-format'

export interface ActivityEvent {
  id: string
  kind: 'status' | 'change'
  type: 'status' | 'assignment' | 'team' | 'crew' | 'create' | 'update'
  createdAt: string
  actor: string | null
  summary: string
  details: string[]
  notes: string | null
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
}
const TYPE_LABELS: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}

const FIELD_LABELS: Record<string, string> = {
  assignedToId: 'Assignee',
  teamId: 'Team',
  completedById: 'Completed by',
  requestedCompletionTime: 'Requested completion time',
  requestedCompletionNotes: 'Requested completion notes',
  laborHours: 'Labor hours',
  laborCost: 'Labor cost',
  partsCost: 'Parts cost',
  dueDate: 'Due date',
  startDate: 'Start date',
  startedAt: 'Started at',
  completedAt: 'Completed at',
  respondedAt: 'Responded at',
  customFields: 'Custom fields',
  locationId: 'Location',
  assetId: 'Asset',
}

function prettifyKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/([a-z])(\d)/g, '$1 $2').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function truncate(v: string, max = 60): string {
  return v.length > max ? `${v.slice(0, max)}…` : v
}

function formatValue(key: string, value: unknown, names: Map<string, string>, teams: Map<string, string>): string {
  if (value === null || value === undefined) return '—'
  if (value instanceof Date) return fmtDateTime(value)
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : 'None'
    return 'Changed'
  }
  const str = String(value)
  if (key === 'assignedToId') return names.get(str) ?? 'Unassigned'
  if (key === 'teamId') return teams.get(str) ?? 'No team'
  if (key === 'status') return WO_STATUS_LABELS[str] ?? str
  if (key === 'priority') return PRIORITY_LABELS[str] ?? str
  if (key === 'type') return TYPE_LABELS[str] ?? str
  if (['dueDate', 'startDate'].includes(key)) {
    const ymd = utcDateOnly(str)
    return ymd ? fmtDateOnly(ymd) : '—'
  }
  if (['startedAt', 'completedAt', 'respondedAt', 'createdAt'].includes(key)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? str : fmtDateTime(d)
  }
  return truncate(str)
}

interface StatusHistoryRow {
  id: string
  status: string
  changedByName: string | null
  notes: string | null
  createdAt: Date
}

interface AuditLogRow {
  id: string
  action: string
  changes: string | null
  userName: string | null
  createdAt: Date
}

export function buildActivityEvents(
  statusHistory: StatusHistoryRow[],
  auditLogs: AuditLogRow[],
  userLookup: Map<string, string>,
  teamLookup: Map<string, string>,
): ActivityEvent[] {
  const events: ActivityEvent[] = []

  for (const h of statusHistory) {
    events.push({
      id: `s-${h.id}`,
      kind: 'status',
      type: 'status',
      createdAt: h.createdAt.toISOString(),
      actor: h.changedByName || null,
      summary: `Status changed to ${WO_STATUS_LABELS[h.status] ?? h.status}`,
      details: [],
      notes: h.notes && !h.notes.includes('Status transitioned') ? h.notes : null,
    })
  }

  for (const log of auditLogs) {
    const actor = log.userName || null
    const createdAt = log.createdAt.toISOString()

    if (log.action === 'CREATE') {
      events.push({
        id: `a-${log.id}`,
        kind: 'change',
        type: 'create',
        createdAt,
        actor,
        summary: 'Work order created',
        details: [],
        notes: null,
      })
      continue
    }

    if (!log.changes) continue

    let parsed: Record<string, { before: unknown; after: unknown }> = {}
    try {
      parsed = JSON.parse(log.changes) as Record<string, { before: unknown; after: unknown }>
    } catch {
      continue
    }

    const keys = Object.keys(parsed)
    if (keys.length === 0) continue

    const details: string[] = []
    let type: ActivityEvent['type'] = 'update'
    for (const key of keys) {
      const before = formatValue(key, parsed[key].before, userLookup, teamLookup)
      const after = formatValue(key, parsed[key].after, userLookup, teamLookup)
      if (key === 'crew') {
        details.push(`Crew updated: ${before} → ${after} members`)
        if (type === 'update') type = 'crew'
        continue
      }
      details.push(`${prettifyKey(key)}: ${before} → ${after}`)
      if (type === 'update' && key === 'assignedToId') type = 'assignment'
      if (type === 'update' && key === 'teamId') type = 'team'
      if (type === 'update' && key === 'status') type = 'status'
    }

    const summaryKey = keys.find(k => !['title', 'description', 'notes', 'crew'].includes(k))
    events.push({
      id: `a-${log.id}`,
      kind: 'change',
      type,
      createdAt,
      actor,
      summary: type === 'crew' ? 'Crew updated'
        : summaryKey ? `${prettifyKey(summaryKey)} updated`
        : 'Work order updated',
      details,
      notes: null,
    })
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return events
}

export async function resolveActivityLookups(
  auditLogs: { changes: string | null }[],
  prisma: { user: { findMany: (args: any) => Promise<{ id: string; name: string }[]> }; team: { findMany: (args: any) => Promise<{ id: string; name: string }[]> } },
): Promise<{ users: Map<string, string>; teams: Map<string, string> }> {
  const users = new Map<string, string>()
  const teams = new Map<string, string>()
  const collectIds = new Set<string>()
  const collectTeamIds = new Set<string>()
  for (const log of auditLogs) {
    if (!log.changes) continue
    try {
      const parsed = JSON.parse(log.changes) as Record<string, { before: unknown; after: unknown }>
      for (const key of ['assignedToId', 'completedById']) {
        const val = parsed[key]?.after
        if (typeof val === 'string' && val) collectIds.add(val)
      }
      const team = parsed['teamId']?.after
      if (typeof team === 'string' && team) collectTeamIds.add(team)
    } catch {
      // ignore malformed changes
    }
  }
  if (collectIds.size) {
    const rows = await prisma.user.findMany({ where: { id: { in: [...collectIds] } }, select: { id: true, name: true } })
    for (const u of rows) users.set(u.id, u.name)
  }
  if (collectTeamIds.size) {
    const rows = await prisma.team.findMany({ where: { id: { in: [...collectTeamIds] } }, select: { id: true, name: true } })
    for (const t of rows) teams.set(t.id, t.name)
  }
  return { users, teams }
}
