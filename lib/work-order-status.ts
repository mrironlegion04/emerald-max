import type { BadgeVariant } from '@/components/Badge'

export const WO_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  PENDING_APPROVAL: 'Pending Approval',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export const WO_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  OPEN: 'blue',
  IN_PROGRESS: 'yellow',
  ON_HOLD: 'orange',
  PENDING_APPROVAL: 'purple',
  COMPLETED: 'green',
  CLOSED: 'green',
  CANCELLED: 'gray',
}

export const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_APPROVAL']
export const DONE_STATUSES   = ['COMPLETED', 'CLOSED', 'CANCELLED']

// Tailwind class maps for inline pill styles (used by components that don't use Badge)
export const WO_STATUS_PILL: Record<string, string> = {
  OPEN:            'bg-blue-100 text-blue-700',
  IN_PROGRESS:     'bg-amber-100 text-amber-700',
  ON_HOLD:         'bg-orange-100 text-orange-700',
  PENDING_APPROVAL:'bg-purple-100 text-purple-700',
  COMPLETED:       'bg-emerald-100 text-emerald-700',
  CLOSED:          'bg-emerald-100 text-emerald-700',
  CANCELLED:       'bg-slate-100 text-slate-500',
}

// Hex color map (used by reports/recharts)
export const WO_STATUS_HEX: Record<string, string> = {
  OPEN:            '#3b82f6',
  IN_PROGRESS:     '#f59e0b',
  ON_HOLD:         '#f97316',
  PENDING_APPROVAL:'#a855f7',
  COMPLETED:       '#10b981',
  CLOSED:          '#059669',
  CANCELLED:       '#94a3b8',
}
