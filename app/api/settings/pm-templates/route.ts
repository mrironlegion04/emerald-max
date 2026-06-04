import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const pmTemplateSchema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  frequency:   z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  interval:    z.number().min(1).default(1),
  categoryId:  z.string().min(1, 'Category is required'),
  procedureIds: z.array(z.string()).min(1, 'At least one procedure is required'),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const templates = await prisma.pMTemplate.findMany({
      include: {
        category: { select: { id: true, name: true } },
        procedures: {
          include: { procedure: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch PM templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const data = pmTemplateSchema.parse(body)

    const template = await prisma.pMTemplate.create({
      data: {
        title:       data.title,
        description: data.description ?? null,
        frequency:   data.frequency,
        interval:    data.interval,
        categoryId:  data.categoryId,
        procedures: {
          create: data.procedureIds.map((pid, idx) => ({
            procedureId: pid,
            sortOrder: idx,
          })),
        },
      },
      include: {
        category: true,
        procedures: { include: { procedure: true } },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create PM template' }, { status: 500 })
  }
}
