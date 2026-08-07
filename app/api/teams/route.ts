import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { getUserLocationIds } from '@/lib/access-control'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  trade: z.string().min(1),
  description: z.string().optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const mine = searchParams.get('mine') === 'true'

  const where: Record<string, unknown> = showDeleted ? {} : { isDeleted: false }

  if (mine) {
    where.members = { some: { userId: user.userId } }
  } else {
    // Plant-scoped users only see teams that have at least one member at their plants
    const allowedIds = await getUserLocationIds(user.userId)
    if (allowedIds && !showDeleted) {
      where.members = {
        some: { user: { userLocations: { some: { locationId: { in: allowedIds } } } } },
      }
    }
  }

  const teams = await prisma.team.findMany({
    where,
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      _count: { select: { workOrders: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    teams.map(t => ({
      ...t,
      workOrders: undefined,
      _count: undefined,
      activeWorkOrders: t._count.workOrders,
    }))
  )
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'team:create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      trade: parsed.data.trade,
      description: parsed.data.description,
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  })

  return NextResponse.json(team, { status: 201 })
}
