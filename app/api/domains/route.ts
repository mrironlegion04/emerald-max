import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  name:        z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const domains = await prisma.maintenanceDomain.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { issues: true, categories: true } },
      },
    })
    return NextResponse.json(domains)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const { name, description } = schema.parse(body)
    const domain = await prisma.maintenanceDomain.create({
      data: { name, description: description ?? null },
      include: { _count: { select: { issues: true, categories: true } } },
    })
    return NextResponse.json(domain, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create domain' }, { status: 500 })
  }
}
