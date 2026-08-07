/**
 * Access Control Utilities for CMMS
 * Handles permission checks for work orders, subtasks, and other operations
 */

import { prisma } from './db'
import type { Role } from '@prisma/client'
import { hasPermission, type Permission } from './permissions'
import { cookies } from 'next/headers'

export interface User {
  userId: string
  role: Role
}

export type ScopeActionFlag =
  | 'canCloseWO'
  | 'canAssignWO'
  | 'canEditWO'
  | 'canApproveRequest'
  | 'canConvertRequest'
  | 'canManagePM'
  | 'canManageAssets'

export interface TeamScopeRow {
  teamId: string
  canCloseWO: boolean
  canAssignWO: boolean
  canEditWO: boolean
  canApproveRequest: boolean
  canConvertRequest: boolean
  canManagePM: boolean
  canManageAssets: boolean
}

/**
 * Get the user's team-scope rows (per-team action permissions).
 * Returns `null` when the user has no team-scope rows (unrestricted).
 */
export async function getUserTeamScope(userId: string): Promise<TeamScopeRow[] | null> {
  const rows = await prisma.userTeamScope.findMany({
    where: { userId },
    select: {
      teamId: true,
      canCloseWO: true,
      canAssignWO: true,
      canEditWO: true,
      canApproveRequest: true,
      canConvertRequest: true,
      canManagePM: true,
      canManageAssets: true,
    },
  })
  return rows.length === 0 ? null : rows
}

/**
 * Check whether the user holds a given action flag on at least one scoped team.
 * ADMIN and users without any team-scope rows are always allowed (backward compatible).
 */
export async function hasScopeActionFlag(user: User, flag: ScopeActionFlag): Promise<boolean> {
  if (user.role === 'ADMIN') return true
  const scope = await getUserTeamScope(user.userId)
  if (!scope) return true
  return scope.some(row => row[flag] === true)
}

/**
 * Check whether a single record's teamId falls inside the user's team scope.
 * Users without team-scope rows are always allowed. Scoped users must have a
 * teamId that is present in their scope (null/unset teams are out of scope).
 */
export async function canAccessTeamScope(
  user: User,
  teamId: string | null | undefined,
): Promise<boolean> {
  const scope = await getUserTeamScope(user.userId)
  if (!scope) return true
  return !!teamId && scope.some(s => s.teamId === teamId)
}

/**
 * Check that every provided team ID falls inside the user's team scope for
 * create/update payloads. Scoped users must include at least one of their
 * scoped teams on every record they write (null/unset teams are out of scope).
 */
export async function canWriteToTeams(
  user: User,
  teamIds: (string | null | undefined)[],
): Promise<boolean> {
  const scope = await getUserTeamScope(user.userId)
  if (!scope) return true
  if (teamIds.some(id => id === null || id === undefined)) return false
  const ids = [...new Set(teamIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return false
  const scopeIds = new Set(scope.map(s => s.teamId))
  return ids.every(id => scopeIds.has(id))
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
 * - ADMIN: always allowed (override)
 * - MANAGER: allowed when they hold the canCloseWO scope flag and the WO's team
 *   is inside their team scope (team-scoped managers only)
 * - Assigned user: can complete their own WO
 * - Team member: can complete if team is assigned
 */
export async function canCompleteWorkOrder(
  user: User,
  workOrderId: string
): Promise<{ allowed: boolean; reason?: string; isOverride?: boolean }> {
  if (user.role === 'ADMIN') {
    return { allowed: true, isOverride: true }
  }

  if (user.role === 'MANAGER') {
    if (!(await hasScopeActionFlag(user, 'canCloseWO'))) {
      return { allowed: false, reason: 'Your scope does not allow closing work orders' }
    }
    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { teamId: true },
    })
    if (!wo) {
      return { allowed: false, reason: 'Work order not found' }
    }
    if (!(await canAccessTeamScope(user, wo.teamId))) {
      return { allowed: false, reason: 'You do not have access to this work order' }
    }
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
  if (isManagerOrAbove(user)) {
    return { allowed: true }
  }
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

  const locationIds = await getUserLocationIds(user.userId)
  const teamScope = await getUserTeamScope(user.userId)

  // Location-based access restriction
  if (locationIds && !(wo.locationId && locationIds.includes(wo.locationId))) {
    return { allowed: false, reason: 'You do not have access to this work order' }
  }

  // Team-based access restriction (managers scoped to teams)
  if (teamScope) {
    if (wo.teamId && teamScope.some(s => s.teamId === wo.teamId)) {
      return { allowed: true }
    }
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
    IN_PROGRESS: ['PENDING_APPROVAL', 'ON_HOLD', 'CANCELLED', 'COMPLETED'],
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
    select: { woVisibility: true },
  })

  if (!dbUser) return null

  const locationIds = await getUserLocationIds(user.userId)
  const teamScope = await getUserTeamScope(user.userId)

  // MANAGER without location assignment or team scope → unrestricted (backward compatible)
  if (user.role === 'MANAGER' && !locationIds && !teamScope) return null

  // Managers scoped to teams: must be within a scoped team AND within the rest
  // of their scope (assigned/created/team-member visibility AND location scope).
  if (teamScope) {
    const and: Record<string, unknown>[] = []
    if (dbUser.woVisibility !== 'FULL') {
      const teamIds = (await prisma.teamMember.findMany({
        where: { userId: user.userId },
        select: { teamId: true },
      })).map(t => t.teamId)
      const inner: Record<string, unknown>[] = [
        { assignedToId: user.userId },
        { createdById: user.userId },
        ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
      ]
      and.push({ OR: inner })
    }
    if (locationIds) {
      and.push({ locationId: { in: locationIds } })
    }
    and.push({ teamId: { in: teamScope.map(s => s.teamId) } })
    return and.length === 1 ? and[0] : { AND: and }
  }

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
    conditions.push({ locationId: { in: locationIds } })
  }

  if (conditions.length === 0) return null

  return conditions.length === 1
    ? conditions[0]
    : { OR: conditions }
}

/**
 * Get all descendant location IDs (including the given location) for location scoping.
 */
export async function getLocationSubtreeIds(locationId: string): Promise<string[]> {
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
 * Get the union of all location-subtree IDs the user is assigned to (their plants and descendants).
 * Returns `null` when the user has no plant assignments (unrestricted scope).
 */
export async function getUserLocationIds(userId: string): Promise<string[] | null> {
  const assignments = await prisma.userLocation.findMany({
    where: { userId },
    select: { locationId: true },
  })

  if (assignments.length === 0) return null

  const all = new Set<string>()
  for (const assignment of assignments) {
    const subtree = await getLocationSubtreeIds(assignment.locationId)
    for (const id of subtree) all.add(id)
  }

  return Array.from(all)
}

/**
 * Build a Prisma `where` filter for location-scoped entities (assets, parts, PM schedules, etc.).
 * Returns `null` if no location scoping applies for the given user.
 */
export async function buildLocationFilter(user: User): Promise<Record<string, unknown> | null> {
  if (user.role === 'ADMIN') return null

  const locationIds = await getUserLocationIds(user.userId)

  if (!locationIds) return null

  return { locationId: { in: locationIds } }
}

/**
 * Get the location IDs the user may select as an "active plant":
 * their UserLocation assignments (plants), or every root location for ADMIN.
 */
export async function getAllowedPlantIds(user: User): Promise<string[]> {
  if (user.role === 'ADMIN') {
    const roots = await prisma.location.findMany({
      where: { parentId: null },
      select: { id: true },
    })
    return roots.map(l => l.id)
  }

  const assignments = await prisma.userLocation.findMany({
    where: { userId: user.userId },
    select: { locationId: true },
  })
  return assignments.map(a => a.locationId)
}

/**
 * Read the persisted "active plant" from the cookie (set by the location switcher).
 */
export async function getActiveLocationCookie(): Promise<string | null> {
  return (await cookies()).get('activeLocation')?.value ?? null
}

/**
 * Resolve the active plant scope for a user.
 *
 * The "active plant" (from the ?location= URL param or the `activeLocation`
 * cookie) is a UI focus that scopes lists and form pickers to a single plant
 * subtree. It is validated against the user's allowed plants so it can never
 * widen access beyond their assignments.
 *
 * Returns `{ activeLocationId, scopeIds }` — both null when there is no
 * (valid) active plant, meaning "All plants" / full union scope.
 */
export async function resolveActiveScope(
  user: User,
  requested?: string | null,
): Promise<{ activeLocationId: string | null; scopeIds: string[] | null }> {
  const allowed = await getAllowedPlantIds(user)
  const candidate = requested ?? (await getActiveLocationCookie())

  if (!candidate || !allowed.includes(candidate)) {
    return { activeLocationId: null, scopeIds: null }
  }

  return {
    activeLocationId: candidate,
    scopeIds: await getLocationSubtreeIds(candidate),
  }
}

/**
 * Compute filter scopes for form pickers (assets, users) so plant-scoped users
 * only see/assign assets and technicians belonging to their plants.
 * Pass `locationIds` (e.g. an active-plant scope) to restrict to a single plant;
 * otherwise the full union of the user's plants is used.
 */
export async function getPickerScope(
  userId: string,
  locationIds?: string[] | null,
): Promise<{
  assetFilter: Record<string, unknown> | null
  userFilter: Record<string, unknown> | null
}> {
  const ids = locationIds ?? (await getUserLocationIds(userId))
  if (!ids) return { assetFilter: null, userFilter: null }

  return {
    assetFilter: { locationId: { in: ids } },
    userFilter:  { userLocations: { some: { locationId: { in: ids } } } },
  }
}

/**
 * Effective write scope for create/update operations: the active plant subtree
 * when a plant is active, otherwise the union of the user's assigned plant
 * subtrees. Returns `null` for unrestricted users (ADMIN with no active plant,
 * or users without plant assignments) — meaning no location restriction.
 */
export async function getWriteScopeIds(
  user: User,
  requested?: string | null,
): Promise<string[] | null> {
  const active = await resolveActiveScope(user, requested)
  if (active.scopeIds) return active.scopeIds
  return getUserLocationIds(user.userId)
}

/**
 * Check that every provided location ID falls inside the user's write scope.
 * Null/undefined entries (no location constraint) are ignored.
 */
export async function canWriteToLocations(
  user: User,
  locationIds: (string | null | undefined)[],
): Promise<boolean> {
  const scope = await getWriteScopeIds(user)
  if (!scope) return true
  return locationIds.every(id => !id || scope.includes(id))
}

/**
 * Check that every provided asset belongs to the user's write scope.
 */
export async function canWriteToAssets(
  user: User,
  assetIds: string[],
): Promise<boolean> {
  const scope = await getWriteScopeIds(user)
  if (!scope) return true

  const ids = [...new Set(assetIds.filter(Boolean))] as string[]
  if (ids.length === 0) return true

  const assets = await prisma.asset.findMany({
    where: { id: { in: ids } },
    select: { locationId: true },
  })
  if (assets.length !== ids.length) return false

  return assets.every(a => !!a.locationId && scope.includes(a.locationId))
}

/**
 * Check that every provided user (assignee/owner) belongs to the write scope,
 * i.e. has a plant assignment inside the scope.
 */
export async function canAssignUsers(
  user: User,
  userIds: (string | null | undefined)[],
): Promise<boolean> {
  const scope = await getWriteScopeIds(user)
  if (!scope) return true

  const ids = [...new Set(userIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return true

  const count = await prisma.userLocation.count({
    where: { userId: { in: ids }, locationId: { in: scope } },
  })
  return count === ids.length
}

/**
 * Check that every provided team belongs to the write scope, i.e. has at least
 * one member with a plant assignment inside the scope (empty teams allowed).
 */
export async function canAssignTeams(
  user: User,
  teamIds: (string | null | undefined)[],
): Promise<boolean> {
  const scope = await getWriteScopeIds(user)
  if (!scope) return true

  const ids = [...new Set(teamIds.filter((id): id is string => !!id))]
  if (ids.length === 0) return true

  const scopedUserIds = (await prisma.user.findMany({
    where: { userLocations: { some: { locationId: { in: scope } } } },
    select: { id: true },
  })).map(u => u.id)

  for (const teamId of ids) {
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    })
    if (members.length > 0 && !members.some(m => scopedUserIds.includes(m.userId))) {
      return false
    }
  }
  return true
}

/**
 * Check that an asset is within the user's full view scope (union of all their
 * plant assignments — not the narrowed "active plant" focus).
 */
export async function canViewAsset(user: User, assetId: string): Promise<boolean> {
  const locationIds = await getUserLocationIds(user.userId)
  if (!locationIds) return true

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { locationId: true },
  })
  if (!asset) return false
  return !!asset.locationId && locationIds.includes(asset.locationId)
}
