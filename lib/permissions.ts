import { prisma } from './db'
import type { Role } from '@prisma/client'

// ── All Permissions ──────────────────────────────────────────────────────────

export const ALL_PERMISSIONS = [
  // Work Orders
  'wo:create', 'wo:read', 'wo:edit', 'wo:delete', 'wo:assign',
  'wo:change_status', 'wo:complete', 'wo:cancel',

  // Assets
  'asset:create', 'asset:read', 'asset:edit', 'asset:delete', 'asset:change_status',

  // Locations
  'location:create', 'location:read', 'location:edit', 'location:delete',

  // Parts / Inventory
  'part:create', 'part:read', 'part:edit', 'part:delete',

  // Meters
  'meter:create', 'meter:read', 'meter:edit', 'meter:delete',

  // PM Schedules
  'pm:create', 'pm:read', 'pm:edit', 'pm:delete',

  // Issues
  'issue:create', 'issue:read', 'issue:edit', 'issue:delete',

  // Asset Categories
  'category:create', 'category:read', 'category:edit', 'category:delete',

  // Asset Types
  'type:create', 'type:read', 'type:edit', 'type:delete',

  // Skills
  'skill:create', 'skill:read', 'skill:edit', 'skill:delete',

  // BOM Templates
  'bom:create', 'bom:read', 'bom:edit', 'bom:delete',

  // Domains
  'domain:create', 'domain:read', 'domain:edit', 'domain:delete',

  // Users
  'user:create', 'user:read', 'user:edit', 'user:delete',

  // Teams
  'team:create', 'team:read', 'team:edit', 'team:delete', 'team:manage_members',

  // Custom Roles
  'role:create', 'role:read', 'role:edit', 'role:delete',

  // Reporting
  'report:view', 'report:custom',

  // Organization
  'org:invite_users', 'org:remove_users', 'org:manage_billing',

  // Import / Export
  'import:data', 'export:data',

  // Audit
  'audit:view',

  // Categories & Domain mapping
  'category_domain:edit',

  // Automation Rules
  'automation:manage',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

// Permission groups for UI display
export const PERMISSION_GROUPS: Record<string, { label: string; permissions: Permission[] }> = {
  workorders: {
    label: 'Work Orders',
    permissions: ['wo:create', 'wo:read', 'wo:edit', 'wo:delete', 'wo:assign', 'wo:change_status', 'wo:complete', 'wo:cancel'],
  },
  assets: {
    label: 'Assets',
    permissions: ['asset:create', 'asset:read', 'asset:edit', 'asset:delete', 'asset:change_status'],
  },
  locations: {
    label: 'Locations',
    permissions: ['location:create', 'location:read', 'location:edit', 'location:delete'],
  },
  parts: {
    label: 'Parts / Inventory',
    permissions: ['part:create', 'part:read', 'part:edit', 'part:delete'],
  },
  meters: {
    label: 'Meters',
    permissions: ['meter:create', 'meter:read', 'meter:edit', 'meter:delete'],
  },
  pm: {
    label: 'Preventive Maintenance',
    permissions: ['pm:create', 'pm:read', 'pm:edit', 'pm:delete'],
  },
  issues: {
    label: 'Issues',
    permissions: ['issue:create', 'issue:read', 'issue:edit', 'issue:delete'],
  },
  categories: {
    label: 'Categories & Types',
    permissions: ['category:create', 'category:read', 'category:edit', 'category:delete', 'type:create', 'type:read', 'type:edit', 'type:delete'],
  },
  skills: {
    label: 'Skills',
    permissions: ['skill:create', 'skill:read', 'skill:edit', 'skill:delete'],
  },
  bom: {
    label: 'BOM Templates',
    permissions: ['bom:create', 'bom:read', 'bom:edit', 'bom:delete'],
  },
  domains: {
    label: 'Domains',
    permissions: ['domain:create', 'domain:read', 'domain:edit', 'domain:delete'],
  },
  users: {
    label: 'Users',
    permissions: ['user:create', 'user:read', 'user:edit', 'user:delete'],
  },
  teams: {
    label: 'Teams',
    permissions: ['team:create', 'team:read', 'team:edit', 'team:delete', 'team:manage_members'],
  },
  roles: {
    label: 'Custom Roles',
    permissions: ['role:create', 'role:read', 'role:edit', 'role:delete'],
  },
  reporting: {
    label: 'Reporting',
    permissions: ['report:view', 'report:custom'],
  },
  organization: {
    label: 'Organization',
    permissions: ['org:invite_users', 'org:remove_users', 'org:manage_billing'],
  },
  data: {
    label: 'Import / Export / Audit',
    permissions: ['import:data', 'export:data', 'audit:view', 'category_domain:edit'],
  },
  automation: {
    label: 'Automation Rules',
    permissions: ['automation:manage'],
  },
}

// ── Default Permissions Per Role ─────────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL_PERMISSIONS as unknown as Permission[],

  MANAGER: [
    'wo:create', 'wo:read', 'wo:edit', 'wo:assign', 'wo:change_status',
    'wo:complete', 'wo:cancel',
    'asset:read', 'asset:change_status',
    'location:read',
    'part:read',
    'meter:read',
    'pm:create', 'pm:read', 'pm:edit',
    'issue:read',
    'category:read', 'type:read',
    'skill:read',
    'bom:read',
    'domain:read',
    'user:read',
    'team:read',
    'report:view', 'report:custom',
    'export:data',
  ],

  TECHNICIAN: [
    'wo:create', 'wo:read', 'wo:complete',
    'asset:read',
    'location:read',
    'part:read',
    'meter:read',
    'pm:read',
    'issue:read',
    'category:read', 'type:read',
    'team:read',
    'domain:read',
  ],

  REQUESTER: [
    'wo:create', 'wo:read',
    'asset:read',
    'location:read',
    'issue:read',
    'category:read',
  ],

  VIEWER: [
    'wo:read',
    'asset:read',
    'location:read',
    'part:read',
    'meter:read',
    'pm:read',
    'issue:read',
    'category:read', 'type:read',
    'skill:read',
    'bom:read',
    'domain:read',
    'team:read',
    'user:read',
    'report:view',
  ],
}

// ── Permission Checker ───────────────────────────────────────────────────────

interface UserContext {
  userId: string
  role: Role
}

/**
 * Check if a user has a specific permission.
 * Checks custom role first, then falls back to default role permissions.
 */
export async function hasPermission(
  user: UserContext,
  permission: Permission
): Promise<boolean> {
  // ADMIN always holds every permission; a custom role must never be able to
  // strip an admin's rights (it would replace, not augment, the implicit grant).
  if (user.role === 'ADMIN') return true

  // Fetch user's custom role if any
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { customRoleId: true },
  })

  if (dbUser?.customRoleId) {
    const customRole = await prisma.customRole.findUnique({
      where: { id: dbUser.customRoleId },
      select: { permissions: true, isActive: true },
    })

    if (customRole?.isActive) {
      const perms = customRole.permissions as string[]
      return perms.includes(permission)
    }
  }

  // Fall back to default role permissions
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[user.role] ?? []
  return defaultPerms.includes(permission)
}

/**
 * Check if a user has ALL of the given permissions.
 */
export async function hasAllPermissions(
  user: UserContext,
  permissions: Permission[]
): Promise<boolean> {
  for (const perm of permissions) {
    if (!(await hasPermission(user, perm))) return false
  }
  return true
}

/**
 * Check if a user has ANY of the given permissions.
 */
export async function hasAnyPermission(
  user: UserContext,
  permissions: Permission[]
): Promise<boolean> {
  for (const perm of permissions) {
    if (await hasPermission(user, perm)) return true
  }
  return false
}

/**
 * Get all effective permissions for a user (custom role or default role).
 */
export async function getEffectivePermissions(userId: string): Promise<Permission[]> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { customRoleId: true, role: true },
  })

  if (!dbUser) return []

  if (dbUser.role === 'ADMIN') {
    return ALL_PERMISSIONS as unknown as Permission[]
  }

  if (dbUser.customRoleId) {
    const customRole = await prisma.customRole.findUnique({
      where: { id: dbUser.customRoleId },
      select: { permissions: true, isActive: true },
    })

    if (customRole?.isActive) {
      return customRole.permissions as Permission[]
    }
  }

  return DEFAULT_ROLE_PERMISSIONS[dbUser.role] ?? []
}
