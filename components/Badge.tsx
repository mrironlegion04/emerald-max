import clsx from 'clsx'

export type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange'

const variantMap: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  green:  { bg: 'bg-emerald-50/70', text: 'text-emerald-700', border: 'border-emerald-200/40', dot: 'bg-emerald-500' },
  blue:   { bg: 'bg-blue-50/70', text: 'text-blue-700', border: 'border-blue-200/40', dot: 'bg-blue-500' },
  yellow: { bg: 'bg-amber-50/75', text: 'text-amber-700', border: 'border-amber-200/50', dot: 'bg-amber-500' },
  red:    { bg: 'bg-rose-50/70', text: 'text-rose-700', border: 'border-rose-200/40', dot: 'bg-rose-500' },
  purple: { bg: 'bg-purple-50/70', text: 'text-purple-700', border: 'border-purple-200/40', dot: 'bg-purple-500' },
  gray:   { bg: 'bg-slate-100/70', text: 'text-slate-650', border: 'border-slate-200/50', dot: 'bg-slate-400' },
  orange: { bg: 'bg-orange-50/70', text: 'text-orange-700', border: 'border-orange-200/40', dot: 'bg-orange-500' },
}

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  const styles = variantMap[variant] || variantMap.gray
  return (
    <span className={clsx('badge select-none', styles.bg, styles.text, styles.border)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)} />
      <span className="leading-none">{label}</span>
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
