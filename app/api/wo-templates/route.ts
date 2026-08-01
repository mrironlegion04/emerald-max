import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const templateSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  description:   z.string().nullable().optional(),
  woType:        z.enum(['BREAKDOWN','PREVENTIVE','PREDICTIVE']).default('PREVENTIVE'),
  priority:      z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  woDescription: z.string().nullable().optional(),
  notes:         z.string().nullable().optional(),
  assignedToId:  z.string().nullable().optional(),
  teamId:        z.string().nullable().optional(),
  categoryId:    z.string().nullable().optional(),

})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const templates = await prisma.workOrderTemplate.findMany({
      include: {
        assignedTo: { select: { name: true } },
        team:       { select: { name: true } },
        category:   { select: { name: true } },
        createdBy:  { select: { name: true } },

      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:create'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const data = templateSchema.parse(body)

    const template = await prisma.workOrderTemplate.create({
      data: {
        name:          data.name,
        description:   data.description   ?? null,
        woType:        data.woType,
        priority:      data.priority,
        woDescription: data.woDescription ?? null,
        notes:         data.notes          ?? null,
        assignedToId:  data.assignedToId  ?? null,
        teamId:        data.teamId        ?? null,
        categoryId:    data.categoryId    ?? null,
        createdById:   user.userId,
      },
      include: {
        assignedTo: { select: { name: true } },
        team:       { select: { name: true } },
        category:   { select: { name: true } },
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'WorkOrderTemplate',
      entityId: template.id,
      entityName: template.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
