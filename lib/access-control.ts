/**
 * Access Control Utilities for CMMS
 * Handles permission checks for work orders, subtasks, and other operations
 */

import { prisma } from './db'
import type { Role } from '@prisma/client'

export interface User {
  userId: string
  role: Role
}

/**
 * Check if user is ADMIN or MANAGER
 */
export function isAdmin(user: User): boolean {
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
  // Admin/Manager always allowed (but it's an override)
  if (isAdmin(user)) {
    return { allowed: true, isOverride: true }
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      assignedToId: true,
      teamId: true,
      team: { select: { members: { select: { userId: true } } } },
    },
  })

  if (!wo) {
    return { allowed: false, reason: 'Work order not found' }
  }

  // Check if user is directly assigned
  if (wo.assignedToId === user.userId) {
    return { allowed: true, isOverride: false }
  }

  // Check if user is in assigned team
  if (wo.teamId && wo.team?.members.some((m) => m.userId === user.userId)) {
    return { allowed: true, isOverride: false }
  }

  return { allowed: false, reason: 'User is not assigned to this work order' }
}

/**
 * Check if user can upload attachments to a work order
 * Same rules as completion
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
 * Rules:
 * - ADMIN/MANAGER: always allowed (override)
 * - Assigned user: can complete their own subtask
 * - Team member: can complete if team is assigned
 */
export async function canCompleteSubtask(
  user: User,
  subtaskId: string
): Promise<{ allowed: boolean; reason?: string; isOverride?: boolean }> {
  // Admin/Manager always allowed (but it's an override)
  if (isAdmin(user)) {
    return { allowed: true, isOverride: true }
  }

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: {
      assignedToId: true,
      assignedTeamId: true,
      assignedTeam: { select: { members: { select: { userId: true } } } },
    },
  })

  if (!subtask) {
    return { allowed: false, reason: 'Subtask not found' }
  }

  // Check if user is directly assigned
  if (subtask.assignedToId === user.userId) {
    return { allowed: true, isOverride: false }
  }

  // Check if user is in assigned team
  if (
    subtask.assignedTeamId &&
    subtask.assignedTeam?.members.some((m) => m.userId === user.userId)
  ) {
    return { allowed: true, isOverride: false }
  }

  return {
    allowed: false,
    reason: 'User is not assigned to this subtask',
  }
}

/**
 * Check if user can view a work order
 * Rules:
 * - ADMIN/MANAGER: can view all
 * - Assigned user or team member: can view
 */
export async function canViewWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin/Manager can view all
  if (isAdmin(user)) {
    return { allowed: true }
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      assignedToId: true,
      teamId: true,
      team: { select: { members: { select: { userId: true } } } },
    },
  })

  if (!wo) {
    return { allowed: false, reason: 'Work order not found' }
  }

  // Check if user is directly assigned
  if (wo.assignedToId === user.userId) {
    return { allowed: true }
  }

  // Check if user is in assigned team
  if (wo.teamId && wo.team?.members.some((m) => m.userId === user.userId)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: 'You do not have access to this work order',
  }
}

/**
 * Check if user can edit a work order
 * Rules:
 * - ADMIN/MANAGER: can edit all
 * - Assigned user or team member: can edit (except status/assignment)
 */
export async function canEditWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin/Manager can edit all
  if (isAdmin(user)) {
    return { allowed: true }
  }

  // Technician can only edit if assigned
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
 * Rules:
 * - ADMIN/MANAGER: can reassign
 * - Others: cannot
 */
export function canReassignWorkOrder(user: User): boolean {
  return isAdmin(user)
}

/**
 * Validate work order status transition
 * Returns true if transition is allowed
 */
export function isValidWOStatusTransition(
  from: string,
  to: string
): boolean {
  const allowed: Record<string, string[]> = {
    OPEN: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: ['OPEN'],
  }

  return allowed[from]?.includes(to) ?? false
}

/**
 * Check if user can delete a work order (only admins)
 */
export function canDeleteWorkOrder(user: User): boolean {
  return user.role === 'ADMIN'
}

/**
 * Get completion label for display
 * Used to show "Completed by Manager" vs no label
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
