import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  teamId:    z.string().min(1),
  domainIds: z.array(z.string()),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { teamId, domainIds } = schema.parse(await request.json())

    await prisma.$transaction([
      prisma.teamDomain.deleteMany({ where: { teamId } }),
      prisma.teamDomain.createMany({
        data: domainIds.map((domainId: string) => ({ teamId, domainId })),
        skipDuplicates: true,
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update team domains' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const domainId = searchParams.get('domainId')

    if (teamId) {
      const links = await prisma.teamDomain.findMany({
        where: { teamId },
        include: { domain: true },
      })
      return NextResponse.json(links.map((l: any) => l.domain))
    }

    if (domainId) {
      const links = await prisma.teamDomain.findMany({
        where: { domainId },
        include: { team: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } },
      })
      return NextResponse.json(links.map((l: any) => l.team))
    }

    return NextResponse.json({ error: 'teamId or domainId required' }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
