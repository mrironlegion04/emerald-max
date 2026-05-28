/**
 * Maintenance Metrics Calculation Utilities
 * Calculates MTTR (Mean Time To Repair) and MTBF (Mean Time Between Failures)
 */

import { prisma } from './db'

export interface AssetMetrics {
  mttrMinutes: number
  mtbfDays: number
  totalFailures: number
  lastFailureDate: Date | null
  lastRepairDate: Date | null
}

/**
 * Calculate MTTR (Mean Time To Repair)
 * Formula: Total repair time / Number of repairs
 * Returns: Minutes
 */
export async function calculateMTTR(assetId: string): Promise<number> {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      assetId,
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: {
      createdAt: true,
      completedAt: true,
    },
  })

  if (workOrders.length === 0) return 0

  // Calculate total repair time (difference between created and completed)
  const totalMinutes = workOrders.reduce((sum, wo) => {
    if (!wo.completedAt) return sum
    const repairTimeMs = wo.completedAt.getTime() - wo.createdAt.getTime()
    const repairMinutes = Math.floor(repairTimeMs / (1000 * 60))
    return sum + repairMinutes
  }, 0)

  // Return average
  return Math.floor(totalMinutes / workOrders.length)
}

/**
 * Calculate MTBF (Mean Time Between Failures)
 * Formula: Total time span / Number of failures
 * Returns: Days
 *
 * Logic:
 * - Look at all completed BREAKDOWN work orders (failures)
 * - Find the time span between each failure
 * - Calculate average
 */
export async function calculateMTBF(assetId: string): Promise<number> {
  const failures = await prisma.workOrder.findMany({
    where: {
      assetId,
      type: 'BREAKDOWN',
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: {
      completedAt: true,
    },
    orderBy: {
      completedAt: 'asc',
    },
  })

  if (failures.length <= 1) return 0

  // Calculate time between failures
  let totalDaysBetweenFailures = 0

  for (let i = 1; i < failures.length; i++) {
    const prev = failures[i - 1].completedAt!
    const curr = failures[i].completedAt!
    const daysBetween = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    totalDaysBetweenFailures += daysBetween
  }

  // Return average
  return Math.floor(totalDaysBetweenFailures / (failures.length - 1) * 100) / 100
}

/**
 * Get total number of failures for an asset
 */
export async function getTotalFailures(assetId: string): Promise<number> {
  const count = await prisma.workOrder.count({
    where: {
      assetId,
      type: 'BREAKDOWN',
      status: 'COMPLETED',
    },
  })
  return count
}

/**
 * Get last failure date
 */
export async function getLastFailureDate(assetId: string): Promise<Date | null> {
  const wo = await prisma.workOrder.findFirst({
    where: {
      assetId,
      type: 'BREAKDOWN',
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: {
      completedAt: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
  })

  return wo?.completedAt || null
}

/**
 * Get last repair date (any completed work order)
 */
export async function getLastRepairDate(assetId: string): Promise<Date | null> {
  const wo = await prisma.workOrder.findFirst({
    where: {
      assetId,
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: {
      completedAt: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
  })

  return wo?.completedAt || null
}

/**
 * Calculate all metrics for an asset and update the database
 */
export async function updateAssetMetrics(assetId: string): Promise<AssetMetrics> {
  // Calculate metrics
  const mttr = await calculateMTTR(assetId)
  const mtbf = await calculateMTBF(assetId)
  const totalFailures = await getTotalFailures(assetId)
  const lastFailureDate = await getLastFailureDate(assetId)
  const lastRepairDate = await getLastRepairDate(assetId)

  // Get total repair time from all completed work orders
  const workOrders = await prisma.workOrder.findMany({
    where: {
      assetId,
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    select: {
      createdAt: true,
      completedAt: true,
    },
  })

  const totalRepairTime = workOrders.reduce((sum, wo) => {
    if (!wo.completedAt) return sum
    const repairTimeMs = wo.completedAt.getTime() - wo.createdAt.getTime()
    const repairMinutes = Math.floor(repairTimeMs / (1000 * 60))
    return sum + repairMinutes
  }, 0)

  // Update asset
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      mttrMinutes: mttr,
      mtbfDays: mtbf,
      totalFailures,
      lastFailureDate,
      lastRepairDate,
      totalRepairTime,
    },
  })

  return {
    mttrMinutes: mttr,
    mtbfDays: mtbf,
    totalFailures,
    lastFailureDate,
    lastRepairDate,
  }
}

/**
 * Format MTTR for display
 */
export function formatMTTR(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  const hrs = hours % 24
  return `${days}d ${hrs}h`
}

/**
 * Format MTBF for display
 */
export function formatMTBF(days: number): string {
  if (days < 1) return `${Math.round(days * 24)} hours`
  if (days < 7) return `${Math.round(days)} days`
  const weeks = Math.round(days / 7)
  if (weeks < 4) return `${weeks} weeks`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} months`
  const years = Math.round(days / 365)
  return `${years} years`
}
