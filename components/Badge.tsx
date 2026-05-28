import clsx from 'clsx'

type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange'

const variantMap: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  gray:   'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-700',
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
