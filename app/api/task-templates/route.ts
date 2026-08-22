import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const taskSchema = z.object({
  title:          z.string().min(1, 'Task title is required'),
  description:    z.string().nullable().optional(),
  priority:       z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  assignedToId:   z.string().nullable().optional(),
  assignedTeamId: z.string().nullable().optional(),
  required:       z.boolean().default(true),
})

const createSchema = z.object({
  name:        z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  tasks:       z.array(taskSchema).optional().default([]),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    const templates = await prisma.taskTemplate.findMany({
      where: includeDeleted ? undefined : { isDeleted: false },
      include: {
        _count: { select: { tasks: true, pmSchedules: true } },
      },
      orderBy: { name: 'asc' },
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
    const data = createSchema.parse(body)

    const template = await prisma.taskTemplate.create({
      data: {
        name:        data.name,
        description: data.description ?? null,
        createdById: user.userId,
        tasks: {
          create: data.tasks.map((t, i) => ({
            title:           t.title,
            description:     t.description ?? null,
            priority:        t.priority,
            order:           i,
            assignedToId:    t.assignedToId ?? null,
            assignedTeamId:  t.assignedTeamId ?? null,
            required:        t.required,
          })),
        },
      },
      include: {
        tasks: { orderBy: { order: 'asc' } },
        _count: { select: { tasks: true, pmSchedules: true } },
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'TaskTemplate',
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
