/**
 * Access Control Utilities for CMMS
 * Handles permission checks for work orders, subtasks, and other operations
 */

import { prisma } from './db'
import type { Role } from '@prisma/client'
import { hasPermission, type Permission } from './permissions'

export interface User {
  userId: string
  role: Role
}

/**
 * Check if user is ADMIN only
 */
export function isAdmin(user: User): boolean {
  return user.role === 'ADMIN'
}

/**
 * Check if user is ADMIN or MANAGER
 */
export function isManagerOrAbove(user: User): boolean {
  return user.role === 'ADMIN' || user.role === 'MANAGER'
}

/**
 * Check if user can complete a work order
 * Rules:
 * - ADMIN/MANAGER: always allowed (override)
 * - Assigned user: can complete their own WO
 * - Team member: can complete if team is assigned
 */
export async function canCompleteWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string; isOverride?: boolean }> {
  if (isManagerOrAbove(user)) {
    return { allowed: true, isOverride: true }
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      assignedToId: true,
      teamId: true,
    },
  })

  if (!wo) {
    return { allowed: false, reason: 'Work order not found' }
  }

  if (wo.assignedToId === user.userId) {
    return { allowed: true, isOverride: false }
  }

  if (wo.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: wo.teamId, userId: user.userId } },
    })
    if (membership) {
      return { allowed: true, isOverride: false }
    }
  }

  return { allowed: false, reason: 'User is not assigned to this work order' }
}

/**
 * Check if user can upload attachments to a work order
 */
export async function canUploadWOAttachment(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const result = await canCompleteWorkOrder(user, workOrderId)
  return { allowed: result.allowed, reason: result.reason }
}

/**
 * Check if user can complete a subtask
 */
export async function canCompleteSubtask(
  user: User,
  subtaskId: string
): Promise<{ allowed: boolean; reason?: string; isOverride?: boolean }> {
  if (isManagerOrAbove(user)) {
    return { allowed: true, isOverride: true }
  }

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: {
      assignedToId: true,
      assignedTeamId: true,
    },
  })

  if (!subtask) {
    return { allowed: false, reason: 'Subtask not found' }
  }

  if (subtask.assignedToId === user.userId) {
    return { allowed: true, isOverride: false }
  }

  if (subtask.assignedTeamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: subtask.assignedTeamId, userId: user.userId } },
    })
    if (membership) {
      return { allowed: true, isOverride: false }
    }
  }

  return { allowed: false, reason: 'User is not assigned to this subtask' }
}

/**
 * Check if user can view a work order (respects WO visibility setting)
 */
export async function canViewWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role === 'ADMIN') {
    return { allowed: true }
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      assignedToId: true,
      teamId: true,
      createdById: true,
      locationId: true,
    },
  })

  if (!wo) {
    return { allowed: false, reason: 'Work order not found' }
  }

  if (wo.assignedToId === user.userId) {
    return { allowed: true }
  }

  if (wo.createdById === user.userId) {
    return { allowed: true }
  }

  if (wo.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: wo.teamId, userId: user.userId } },
    })
    if (membership) {
      return { allowed: true }
    }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { assignedLocationId: true },
  })

  // Location-based access restriction
  if (dbUser?.assignedLocationId) {
    if (wo.locationId) {
      const locationIds = await getLocationSubtreeIds(dbUser.assignedLocationId)
      if (!locationIds.includes(wo.locationId)) {
        return { allowed: false, reason: 'You do not have access to this work order' }
      }
      return { allowed: true }
    }
    // WO has no location → deny if user has location assigned
    return { allowed: false, reason: 'You do not have access to this work order' }
  }

  // MANAGER without location assignment can view any WO (backward compatible)
  if (user.role === 'MANAGER') {
    return { allowed: true }
  }

  return { allowed: false, reason: 'You do not have access to this work order' }
}

/**
 * Check if user can edit a work order
 */
export async function canEditWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role === 'ADMIN') {
    return { allowed: true }
  }

  const canEdit = await hasPermission(user, 'wo:edit')
  if (!canEdit) {
    return { allowed: false, reason: 'You do not have permission to edit work orders' }
  }

  const result = await canViewWorkOrder(user, workOrderId)
  return result
}

/**
 * Determine completion type based on user role and assignment
 */
export function getCompletionType(
  user: User,
  isOverride: boolean
): 'ASSIGNED' | 'ADMIN_OVERRIDE' | 'MANAGER_OVERRIDE' {
  if (!isOverride) {
    return 'ASSIGNED'
  }
  return user.role === 'ADMIN' ? 'ADMIN_OVERRIDE' : 'MANAGER_OVERRIDE'
}

/**
 * Check if user can reassign a work order
 */
export function canReassignWorkOrder(user: User): boolean {
  return isManagerOrAbove(user)
}

/**
 * Validate work order status transition
 */
export function isValidWOStatusTransition(
  from: string,
  to: string
): boolean {
  const allowed: Record<string, string[]> = {
    OPEN: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['PENDING_APPROVAL', 'ON_HOLD', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    PENDING_APPROVAL: ['COMPLETED', 'IN_PROGRESS'],
    COMPLETED: ['OPEN', 'CLOSED'],
    CLOSED: ['COMPLETED'],
    CANCELLED: ['OPEN'],
  }

  return allowed[from]?.includes(to) ?? false
}

/**
 * Check if user can delete a work order
 */
export function canDeleteWorkOrder(user: User): boolean {
  return user.role === 'ADMIN'
}

/**
 * Get completion label for display
 */
export function getCompletionLabel(
  completionType: string,
  completedByRole?: string
): string | null {
  if (completionType === 'ADMIN_OVERRIDE') {
    return `Completed by Admin`
  }
  if (completionType === 'MANAGER_OVERRIDE') {
    return `Completed by Manager`
  }
  return null
}

/**
 * Build WO visibility filter for Prisma queries.
 * Returns a where clause filter that restricts WOs based on user visibility.
 */
export async function buildWOVisibilityFilter(
  user: User
): Promise<Record<string, unknown> | null> {
  if (user.role === 'ADMIN') return null

  // REQUESTER sees only WOs they created
  if (user.role === 'REQUESTER') {
    return { createdById: user.userId }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { woVisibility: true, assignedLocationId: true },
  })

  if (!dbUser) return null

  const locationIds = dbUser.assignedLocationId
    ? await getLocationSubtreeIds(dbUser.assignedLocationId)
    : null

  // MANAGER without location assignment → unrestricted (backward compatible)
  if (user.role === 'MANAGER' && !locationIds) return null

  const conditions: Record<string, unknown>[] = []

  if (dbUser.woVisibility !== 'FULL') {
    const teamIds = (await prisma.teamMember.findMany({
      where: { userId: user.userId },
      select: { teamId: true },
    })).map(t => t.teamId)

    conditions.push(
      { assignedToId: user.userId },
      { createdById: user.userId },
      ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
    )
  }

  if (locationIds) {
    conditions.push({
      OR: [
        { locationId: { in: locationIds } },
        { locationId: null },
      ],
    })
  }

  if (conditions.length === 0) return null

  return conditions.length === 1
    ? conditions[0]
    : { OR: conditions }
}

/**
 * Get all descendant location IDs (including the given location) for location scoping.
 */
async function getLocationSubtreeIds(locationId: string): Promise<string[]> {
  const allLocations = await prisma.location.findMany({
    select: { id: true, parentId: true },
  })

  const childrenMap = new Map<string, string[]>()
  for (const loc of allLocations) {
    if (loc.parentId) {
      const siblings = childrenMap.get(loc.parentId) ?? []
      siblings.push(loc.id)
      childrenMap.set(loc.parentId, siblings)
    }
  }

  const result: string[] = [locationId]
  const queue = [locationId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const children = childrenMap.get(current) ?? []
    for (const childId of children) {
      result.push(childId)
      queue.push(childId)
    }
  }

  return result
}

/**
 * Build a Prisma `where` filter for location-scoped entities (assets, parts, PM schedules, etc.).
 * Returns `null` if no location scoping applies for the given user.
 */
export async function buildLocationFilter(user: User): Promise<Record<string, unknown> | null> {
  if (user.role === 'ADMIN') return null

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { assignedLocationId: true },
  })

  if (!dbUser?.assignedLocationId) return null

  const locationIds = await getLocationSubtreeIds(dbUser.assignedLocationId)
  return {
    OR: [
      { locationId: { in: locationIds } },
      { locationId: null },
    ],
  }
}
