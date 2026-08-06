import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hashPassword } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const teamScopeSchema = z.object({
  canCloseWO:        z.boolean().default(false),
  canAssignWO:       z.boolean().default(false),
  canEditWO:         z.boolean().default(false),
  canApproveRequest: z.boolean().default(false),
  canConvertRequest: z.boolean().default(false),
  canManagePM:       z.boolean().default(false),
  canManageAssets:   z.boolean().default(false),
})

type TeamScopeFlags = z.infer<typeof teamScopeSchema>

const DEFAULT_TEAM_SCOPE: TeamScopeFlags = {
  canCloseWO: false,
  canAssignWO: false,
  canEditWO: false,
  canApproveRequest: false,
  canConvertRequest: false,
  canManagePM: false,
  canManageAssets: false,
}

const updateSchema = z.object({
  name:       z.string().min(1).optional(),
  email:      z.string().email().optional(),
  username:   z.string().trim().min(3).max(32)
              .transform(v => v.toLowerCase())
              .refine(v => /^[a-z0-9][a-z0-9._-]*$/.test(v), 'Username may only contain lowercase letters, numbers, dots, underscores, and hyphens')
              .optional(),
  password:   z.string().min(12).optional(),
  role:       z.enum(['ADMIN','MANAGER','TECHNICIAN','REQUESTER','VIEWER']).optional(),
  isActive:   z.boolean().optional(),
  phone:      z.string().nullable().optional(),
  bio:        z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  woVisibility: z.enum(['FULL','LIMITED']).optional(),
  customRoleId: z.string().nullable().optional(),
  assignedLocationIds: z.array(z.string()).optional(),
  assignedTeamIds:     z.array(z.string()).optional(),
  teamScope: teamScopeSchema.optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Only the user themselves or a holder of user:read may view a full profile.
    if (id !== currentUser.userId && !(await hasPermission(currentUser, 'user:read'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, username: true, role: true, isActive: true, phone: true, bio: true, department: true, userLocations: { select: { locationId: true } }, teamScopes: { select: { teamId: true, canCloseWO: true, canAssignWO: true, canEditWO: true, canApproveRequest: true, canConvertRequest: true, canManagePM: true, canManageAssets: true } } },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json(user)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'user:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Only an ADMIN may modify an ADMIN's record in any way.
    if (target.role === 'ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can modify admin users' }, { status: 403 })
    }

    const body   = await request.json()
    const data   = updateSchema.parse(body)

    // Privilege-sensitive fields are ADMIN-only. A user:edit holder (manager /
    // custom role) may update profile details but never roles, passwords,
    // custom roles, scope assignments, or account state.
    const isAdmin = user.role === 'ADMIN'
    if (!isAdmin) {
      const adminOnlyFields: (keyof typeof data)[] = [
        'password', 'role', 'isActive', 'woVisibility', 'customRoleId',
        'assignedLocationIds', 'assignedTeamIds', 'teamScope',
      ]
      for (const field of adminOnlyFields) {
        if (data[field] !== undefined) {
          return NextResponse.json({ error: 'Only admins can change user roles or assignments' }, { status: 403 })
        }
      }
    }

    // Last-admin guard: never allow the final active ADMIN to be deactivated
    // or demoted, or the system becomes administratively locked out.
    if (target.role === 'ADMIN') {
      const isDemoting = data.role !== undefined && data.role !== 'ADMIN'
      const isDeactivating = data.isActive === false
      if (isDemoting || isDeactivating) {
        const otherAdmins = await prisma.user.count({
          where: { role: 'ADMIN', isActive: true, NOT: { id } },
        })
        if (otherAdmins === 0) {
          return NextResponse.json({ error: 'Cannot remove the last active admin' }, { status: 400 })
        }
      }
    }

    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
    }

    if (data.username) {
      const existingUsername = await prisma.user.findFirst({
        where: { username: data.username, NOT: { id } },
      })
      if (existingUsername) {
        return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {
      name:       data.name,
      role:       data.role,
      isActive:   data.isActive,
      phone:      data.phone ?? null,
      bio:        data.bio ?? null,
      department: data.department ?? null,
      woVisibility: data.woVisibility,
      customRoleId: data.customRoleId ?? null,
    }
    if (data.email)    updateData.email        = data.email.toLowerCase()
    if (data.username) updateData.username     = data.username
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password)
      // A password set by an admin is a reset — force the user to change it.
      updateData.mustChangePassword = true
    }

    // Invalidate the target's other sessions when credentials or account state change.
    if (data.password || data.role !== undefined || data.isActive !== undefined) {
      updateData.sessionVersion = { increment: 1 }
    }

    // Remove undefined keys
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k])

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: updateData,
        select: { id:true, name:true, email:true, username:true, role:true, isActive:true, phone:true, bio:true, department:true, woVisibility: true, customRoleId: true },
      })

      if (data.assignedLocationIds !== undefined) {
        await tx.userLocation.deleteMany({ where: { userId: id } })
        if (data.assignedLocationIds.length > 0) {
          await tx.userLocation.createMany({
            data: data.assignedLocationIds.map(locationId => ({ userId: id, locationId })),
          })
        }
      }

      if (data.assignedTeamIds !== undefined) {
        await tx.userTeamScope.deleteMany({ where: { userId: id } })
        if (data.assignedTeamIds.length > 0) {
          const teamScopeFlags = data.teamScope ?? DEFAULT_TEAM_SCOPE
          await tx.userTeamScope.createMany({
            data: data.assignedTeamIds.map(teamId => ({
              userId: id,
              teamId,
              canCloseWO:        teamScopeFlags.canCloseWO ?? false,
              canAssignWO:       teamScopeFlags.canAssignWO ?? false,
              canEditWO:         teamScopeFlags.canEditWO ?? false,
              canApproveRequest: teamScopeFlags.canApproveRequest ?? false,
              canConvertRequest: teamScopeFlags.canConvertRequest ?? false,
              canManagePM:       teamScopeFlags.canManagePM ?? false,
              canManageAssets:   teamScopeFlags.canManageAssets ?? false,
            })),
          })
        }
      }

      return result
    })

    await writeAudit({
      action: 'UPDATE', entity: 'User',
      entityId: updated.id, entityName: updated.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
