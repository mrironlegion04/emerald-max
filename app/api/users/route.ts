import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hashPassword } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { getUserLocationIds } from '@/lib/access-control'
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

const createSchema = z.object({
  name:       z.string().min(1, 'Name is required'),
  email:      z.string().email('Invalid email'),
  username:   z.string().trim().min(3, 'Username must be at least 3 characters').max(32, 'Username must be at most 32 characters')
              .transform(v => v.toLowerCase())
              .refine(v => /^[a-z0-9][a-z0-9._-]*$/.test(v), 'Username may only contain lowercase letters, numbers, dots, underscores, and hyphens')
              .optional(),
  password:   z.string().min(12, 'Password must be at least 12 characters'),
  role:       z.enum(['ADMIN','MANAGER','TECHNICIAN','REQUESTER','VIEWER']).default('TECHNICIAN'),
  isActive:   z.boolean().default(true),
  phone:      z.string().nullable().optional(),
  bio:        z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  woVisibility: z.enum(['FULL','LIMITED']).default('FULL'),
  customRoleId: z.string().nullable().optional(),
  assignedLocationIds: z.array(z.string()).default([]),
  assignedTeamIds:     z.array(z.string()).default([]),
  teamScope: teamScopeSchema.optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'user:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    // Plant-scoped users only see the directory entries for their plants (plus platform admins)
    const allowedIds = await getUserLocationIds(user.userId)
    const users = await prisma.user.findMany({
      where: allowedIds
        ? { OR: [{ userLocations: { some: { locationId: { in: allowedIds } } } }, { role: 'ADMIN' }] }
        : undefined,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        phone: true,
        bio: true,
        department: true,
        lastActiveAt: true,
        userLocations: {
          select: { locationId: true },
        },
        teamScopes: {
          select: { teamId: true },
        },
        _count: {
          select: {
            assignedWorkOrders: true,
            createdWorkOrders: true,
            skills: true,
          },
        },
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'user:create'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const data = createSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    if (data.username) {
      const existingUsername = await prisma.user.findUnique({ where: { username: data.username } })
      if (existingUsername) {
        return NextResponse.json({ error: 'Username already in use' }, { status: 409 })
      }
    }

    const passwordHash = await hashPassword(data.password)
    const teamScopeFlags = data.teamScope ?? DEFAULT_TEAM_SCOPE
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        username: data.username || null,
        passwordHash,
        role: data.role,
        isActive: data.isActive,
        mustChangePassword: true,
        phone: data.phone || null,
        bio: data.bio || null,
        department: data.department || null,
        woVisibility: data.woVisibility,
        customRoleId: data.customRoleId || null,
        userLocations: {
          create: data.assignedLocationIds.map(locationId => ({ locationId })),
        },
        teamScopes: {
          create: data.assignedTeamIds.map(teamId => ({
            teamId,
            canCloseWO:        teamScopeFlags.canCloseWO ?? false,
            canAssignWO:       teamScopeFlags.canAssignWO ?? false,
            canEditWO:         teamScopeFlags.canEditWO ?? false,
            canApproveRequest: teamScopeFlags.canApproveRequest ?? false,
            canConvertRequest: teamScopeFlags.canConvertRequest ?? false,
            canManagePM:       teamScopeFlags.canManagePM ?? false,
            canManageAssets:   teamScopeFlags.canManageAssets ?? false,
          })),
        },
      },
      select: { id:true, name:true, email:true, username:true, role:true, isActive:true, phone:true, bio:true, department:true, woVisibility: true, customRoleId: true, userLocations: { select: { locationId: true } }, teamScopes: { select: { teamId: true } } },
    })

    await writeAudit({
      action: 'CREATE', entity: 'User',
      entityId: newUser.id, entityName: newUser.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
