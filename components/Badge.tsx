import clsx from 'clsx'

type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange'

const variantMap: Record<BadgeVariant, string> = {
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  blue:   'bg-blue-50 text-blue-700 border border-blue-200/60',
  yellow: 'bg-amber-50 text-amber-800 border border-amber-200/60',
  red:    'bg-red-50 text-red-700 border border-red-200/60',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200/60',
  gray:   'bg-slate-50 text-slate-600 border border-slate-200',
  orange: 'bg-orange-50 text-orange-700 border border-orange-200/60',
}

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={clsx('badge', variantMap[variant])}>
      {label}
    </span>
  )
}

// Helpers for consistent status/priority coloring used across all pages
export function workOrderStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    OPEN: 'blue',
    IN_PROGRESS: 'yellow',
    ON_HOLD: 'orange',
    COMPLETED: 'green',
    CANCELLED: 'gray',
  }
  return map[status] ?? 'gray'
}

export function priorityVariant(priority: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    LOW: 'gray',
    MEDIUM: 'blue',
    HIGH: 'orange',
    CRITICAL: 'red',
  }
  return map[priority] ?? 'gray'
}

export function assetStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'green',
    INACTIVE: 'gray',
    UNDER_MAINTENANCE: 'yellow',
    DECOMMISSIONED: 'red',
  }
  return map[status] ?? 'gray'
}
