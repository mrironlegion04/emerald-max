import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const teamSchema = z.object({
  name:        z.string().min(1, 'Team name is required'),
  trade:       z.string().min(1, 'Trade is required'),
  description: z.string().nullable().optional(),
  memberIds:   z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const showDeleted = searchParams.get('showDeleted') === 'true'

    const teams = await prisma.team.findMany({
      where: showDeleted ? undefined : { isDeleted: false },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(teams)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { name, trade, description, memberIds } = teamSchema.parse(body)

    // Create team
    const team = await prisma.team.create({
      data: {
        name,
        trade,
        description: description ?? null,
      },
    })

    // Add members if provided
    if (memberIds && memberIds.length > 0) {
      await prisma.teamMember.createMany({
        data: memberIds.map(userId => ({
          teamId: team.id,
          userId,
        })),
        skipDuplicates: true,
      })
    }

    // Fetch the created team with members
    const createdTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    // Audit log
    await writeAudit({
      action: 'CREATE',
      entity: 'Team',
      entityId: team.id,
      entityName: team.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(createdTeam, { status: 201 })
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  }
}
