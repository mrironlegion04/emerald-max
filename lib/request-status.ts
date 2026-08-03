import type { BadgeVariant } from '@/components/Badge'

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONVERTED: 'Converted to WO',
  CANCELLED: 'Cancelled',
}

export function requestStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    PENDING: 'yellow',
    APPROVED: 'green',
    REJECTED: 'red',
    CONVERTED: 'blue',
    CANCELLED: 'gray',
  }
  return map[status] ?? 'gray'
}

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  REPAIR: 'Repair',
  MAINTENANCE: 'Maintenance',
  INSPECTION: 'Inspection',
  INSTALLATION: 'Installation',
  OTHER: 'Other',
}

export function requestTypeVariant(type: string | null | undefined): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    REPAIR: 'red',
    MAINTENANCE: 'blue',
    INSPECTION: 'purple',
    INSTALLATION: 'green',
    OTHER: 'gray',
  }
  if (type) {
    const variant = map[type]
    if (variant) return variant
  }
  return 'gray'
}