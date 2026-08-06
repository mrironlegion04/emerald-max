import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserLocationIds, canAccessTeamScope } from '@/lib/access-control'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params

  const team = await prisma.team.findFirst({
    where: { id: teamId, isDeleted: false },
    select: { id: true },
  })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  // Team-scoped users may only view teams within their assigned team scope
  if (!(await canAccessTeamScope(user, teamId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Plant-scoped users may only view members of teams with ≥1 member at their plants
  const allowedIds = await getUserLocationIds(user.userId)
  if (allowedIds) {
    const inScope = await prisma.teamMember.count({
      where: {
        teamId,
        user: { userLocations: { some: { locationId: { in: allowedIds } } } },
      },
    })
    if (inScope === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, role: true,
          userLocations: { select: { locationId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Plant-scoped users must not see members from other plants. Return only
  // members assigned to the caller's plants, plus platform admins.
  if (allowedIds) {
    return NextResponse.json(members.filter(m =>
      m.user.role === 'ADMIN' ||
      m.user.userLocations.some(loc => allowedIds.includes(loc.locationId)),
    ))
  }

  return NextResponse.json(members)
}
