export const WORK_ORDER_RESOLUTIONS = [
  'CORRECTION',
  'DESIGN',
  'PREVENTIVE_MAINTENANCE',
  'REPLACEMENT',
] as const

export type WorkOrderResolution = (typeof WORK_ORDER_RESOLUTIONS)[number]

export const RESOLUTION_LABELS: Record<string, string> = {
  CORRECTION: 'Correction',
  DESIGN: 'Design',
  PREVENTIVE_MAINTENANCE: 'Preventive Maintenance',
  REPLACEMENT: 'Replacement',
}
