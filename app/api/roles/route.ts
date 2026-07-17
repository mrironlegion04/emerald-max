import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'
import { ALL_PERMISSIONS } from '@/lib/permissions'

const permValues = ALL_PERMISSIONS as unknown as [string, ...string[]]

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.enum(permValues)),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'role:read'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const roles = await prisma.customRole.findMany({
    where: { isActive: true },
    include: { _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    roles.map(r => ({
      ...r,
      users: undefined,
      _count: undefined,
      userCount: r._count.users,
    }))
  )
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'role:create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.customRole.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 })
  }

  const role = await prisma.customRole.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
    },
  })

  return NextResponse.json(role, { status: 201 })
}
