import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'
import { ALL_PERMISSIONS } from '@/lib/permissions'

const permValues = ALL_PERMISSIONS as unknown as [string, ...string[]]

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.enum(permValues)).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'role:read'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { roleId } = await params
  const role = await prisma.customRole.findUnique({
    where: { id: roleId },
    include: {
      users: { select: { id: true, name: true, email: true } },
    },
  })

  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...role,
    users: role.users,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'role:edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { roleId } = await params
  const body = await request.json()

  const existing = await prisma.customRole.findUnique({ where: { id: roleId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prevent renaming to a name that already exists
  if (body.name && body.name !== existing.name) {
    const nameConflict = await prisma.customRole.findUnique({ where: { name: body.name } })
    if (nameConflict) {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 })
    }
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const role = await prisma.customRole.update({
    where: { id: roleId },
    data: parsed.data,
  })

  return NextResponse.json(role)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'role:delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { roleId } = await params
  const role = await prisma.customRole.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, _count: { select: { users: true } } },
  })

  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${role.name}" — ${role._count.users} user(s) are assigned to it. Reassign them first.` },
      { status: 409 }
    )
  }

  await prisma.customRole.delete({ where: { id: roleId } })
  return NextResponse.json({ success: true })
}
