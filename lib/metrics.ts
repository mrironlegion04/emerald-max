/**
 * Maintenance Metrics — Single source of truth
 *
 * Source data stored on Asset (cumulative counters):
 *   totalFailures, lastFailureDate, lastRepairDate, totalRepairTime, totalDowntimeMinutes
 *
 * Derived metrics computed on the fly by getAssetMetrics():
 *   MTTR = totalRepairTime / totalFailures
 *   Avg Downtime = totalDowntimeMinutes / totalFailures
 *   MTBF = query completed BREAKDOWN WOs, compute gaps between failures
 *
 * Fleet metrics for dashboard:
 *   Fleet MTTR = sum(all asset repair times) / sum(all asset failures)  [weighted]
 *   Fleet MTBF = computed from global failure timeline
 */

import { prisma } from './db'

export interface AssetMetrics {
  totalFailures: number
  lastFailureDate: Date | null
  lastRepairDate: Date | null
  totalRepairTime: number
  totalDowntimeMinutes: number
  // Derived (computed on the fly)
  mttr: number            // minutes — totalRepairTime / totalFailures
  avgDowntime: number     // minutes — totalDowntimeMinutes / totalFailures
  mtbf: number            // days — computed from failure timeline
}

export interface FleetMetrics {
  totalAssets: number
  totalFailures: number
  totalRepairTime: number
  totalDowntimeMinutes: number
  fleetMttr: number       // minutes — weighted: totalRepairTime / totalFailures
  fleetMtbf: number       // days — computed from global failure timeline
}

// ── Internal helpers ──────────────────────────────────────────────

async function computeMTBF(assetId: string): Promise<number> {
  const failures = await prisma.workOrder.findMany({
    where: {
      assetId,
      type: 'BREAKDOWN',
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: { completedAt: true },
    orderBy: { completedAt: 'asc' },
  })

  if (failures.length <= 1) return 0

  let totalDaysBetween = 0
  for (let i = 1; i < failures.length; i++) {
    const prev = failures[i - 1].completedAt!
    const curr = failures[i].completedAt!
    totalDaysBetween += (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
  }

  return Math.floor(totalDaysBetween / (failures.length - 1) * 100) / 100
}

async function computeFleetMTBF(): Promise<number> {
  const failures = await prisma.workOrder.findMany({
    where: {
      type: 'BREAKDOWN',
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: { completedAt: true },
    orderBy: { completedAt: 'asc' },
  })

  if (failures.length <= 1) return 0

  let totalDaysBetween = 0
  for (let i = 1; i < failures.length; i++) {
    const prev = failures[i - 1].completedAt!
    const curr = failures[i].completedAt!
    totalDaysBetween += (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
  }

  return Math.floor(totalDaysBetween / (failures.length - 1) * 100) / 100
}

// ── Per-asset metrics (used on asset detail page) ─────────────────

/**
 * Get computed metrics for a single asset.
 * Reads source data from the Asset row, computes derived values on the fly.
 */
export async function getAssetMetrics(assetId: string): Promise<AssetMetrics> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      totalFailures: true,
      lastFailureDate: true,
      lastRepairDate: true,
      totalRepairTime: true,
      totalDowntimeMinutes: true,
    },
  })

  if (!asset) {
    return { totalFailures: 0, lastFailureDate: null, lastRepairDate: null, totalRepairTime: 0, totalDowntimeMinutes: 0, mttr: 0, avgDowntime: 0, mtbf: 0 }
  }

  const totalFailures = asset.totalFailures
  const mttr = totalFailures > 0 ? Math.floor(asset.totalRepairTime / totalFailures) : 0
  const avgDowntime = totalFailures > 0 ? Math.floor(asset.totalDowntimeMinutes / totalFailures) : 0
  const mtbf = await computeMTBF(assetId)

  return {
    totalFailures,
    lastFailureDate: asset.lastFailureDate,
    lastRepairDate: asset.lastRepairDate,
    totalRepairTime: asset.totalRepairTime,
    totalDowntimeMinutes: asset.totalDowntimeMinutes,
    mttr,
    avgDowntime,
    mtbf,
  }
}

// ── Fleet-wide metrics (used on dashboard) ────────────────────────

/**
 * Compute fleet-wide metrics across all assets.
 * Uses weighted average: sum of all repair times / sum of all failures.
 */
export async function getFleetMetrics(): Promise<FleetMetrics> {
  const assets = await prisma.asset.findMany({
    where: { isDeleted: false },
    select: {
      totalFailures: true,
      totalRepairTime: true,
      totalDowntimeMinutes: true,
    },
  })

  const totalAssets = assets.length
  const totalFailures = assets.reduce((sum, a) => sum + a.totalFailures, 0)
  const totalRepairTime = assets.reduce((sum, a) => sum + a.totalRepairTime, 0)
  const totalDowntimeMinutes = assets.reduce((sum, a) => sum + a.totalDowntimeMinutes, 0)

  const fleetMttr = totalFailures > 0 ? Math.floor(totalRepairTime / totalFailures) : 0
  const fleetMtbf = await computeFleetMTBF()

  return {
    totalAssets,
    totalFailures,
    totalRepairTime,
    totalDowntimeMinutes,
    fleetMttr,
    fleetMtbf,
  }
}

// ── Write source data (called after WO completion, reopen, edit) ──

/**
 * Recalculate and write source data for an asset from WO history.
 * Only writes the 5 source fields — derived metrics are computed on the fly.
 */
export async function updateAssetMetrics(assetId: string): Promise<void> {
  // Total failures
  const totalFailures = await prisma.workOrder.count({
    where: { assetId, type: 'BREAKDOWN', status: 'COMPLETED' },
  })

  // Last failure date
  const lastFailureWO = await prisma.workOrder.findFirst({
    where: { assetId, type: 'BREAKDOWN', status: 'COMPLETED', completedAt: { not: null } },
    select: { completedAt: true },
    orderBy: { completedAt: 'desc' },
  })

  // Last repair date (any completed WO)
  const lastRepairWO = await prisma.workOrder.findFirst({
    where: { assetId, status: 'COMPLETED', completedAt: { not: null } },
    select: { completedAt: true },
    orderBy: { completedAt: 'desc' },
  })

  // Total repair time = sum of RepairSession.durationMinutes for completed WOs on this asset
  const repairSessions = await prisma.repairSession.findMany({
    where: {
      workOrder: { assetId, status: 'COMPLETED' },
      durationMinutes: { not: null },
    },
    select: { durationMinutes: true },
  })
  const totalRepairTime = repairSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)

  // Total downtime = sum of (completedAt - createdAt)
  const downtimeWOs = await prisma.workOrder.findMany({
    where: { assetId, status: 'COMPLETED', completedAt: { not: null } },
    select: { createdAt: true, completedAt: true },
  })
  const totalDowntimeMinutes = downtimeWOs.reduce((sum, wo) => {
    if (!wo.completedAt) return sum
    return sum + Math.floor((wo.completedAt.getTime() - wo.createdAt.getTime()) / (1000 * 60))
  }, 0)

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      totalFailures,
      lastFailureDate: lastFailureWO?.completedAt ?? null,
      lastRepairDate: lastRepairWO?.completedAt ?? null,
      totalRepairTime,
      totalDowntimeMinutes,
    },
  })
}

/**
 * Recalculate asset metrics for ALL assets linked to a work order.
 * Handles multi-asset WOs (primary assetId + WorkOrderAsset junction rows).
 * Deduplicates in case the primary asset is also in the junction table.
 */
export async function updateWorkOrderLinkedAssetMetrics(workOrderId: string): Promise<void> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { assetId: true },
  })
  if (!wo) return

  const junctionAssets = await prisma.workOrderAsset.findMany({
    where: { workOrderId },
    select: { assetId: true },
  })

  const assetIds = new Set<string>()
  if (wo.assetId) assetIds.add(wo.assetId)
  for (const ja of junctionAssets) assetIds.add(ja.assetId)

  await Promise.all([...assetIds].map(id => updateAssetMetrics(id)))
}

// ── Formatting helpers ────────────────────────────────────────────

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  const hrs = hours % 24
  return `${days}d ${hrs}h`
}

export function formatDays(days: number): string {
  if (days < 1) return `${Math.round(days * 24)} hours`
  if (days < 7) return `${Math.round(days)} days`
  const weeks = Math.round(days / 7)
  if (weeks < 4) return `${weeks} weeks`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} months`
  const years = Math.round(days / 365)
  return `${years} years`
}

// Keep old names as aliases for backward compatibility
export const formatMTTR = formatMinutes
export const formatMTBF = formatDays
