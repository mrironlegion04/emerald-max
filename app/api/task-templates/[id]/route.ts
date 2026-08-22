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

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  tasks:       z.array(taskSchema).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await prisma.taskTemplate.findUnique({
      where: { id },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              assignedTo: { select: { id: true, name: true } },
              assignedTeam: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          _count: { select: { tasks: true, pmSchedules: true } },
        },
    })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(template)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.taskTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.isDeleted) return NextResponse.json({ error: 'Cannot edit an archived template. Restore it first.' }, { status: 400 })

    const existingTaskCount = await prisma.taskTemplateTask.count({ where: { templateId: id } })

    const template = await prisma.$transaction(async tx => {
      if (data.tasks !== undefined) {
        await tx.taskTemplateTask.deleteMany({ where: { templateId: id } })
        await tx.taskTemplateTask.createMany({
          data: data.tasks.map((t, i) => ({
            title:           t.title,
            description:     t.description ?? null,
            priority:        t.priority,
            order:           i,
            assignedToId:    t.assignedToId ?? null,
            assignedTeamId:  t.assignedTeamId ?? null,
            required:        t.required,
            templateId:      id,
          })),
        })
      }

      return tx.taskTemplate.update({
        where: { id },
        data: {
          ...(data.name        !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          updatedById: user.userId,
        },
        include: {
          tasks: { orderBy: { order: 'asc' } },
          _count: { select: { tasks: true, pmSchedules: true } },
        },
      })
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (data.name !== undefined && existing.name !== template.name) {
      changes.name = { before: existing.name, after: template.name }
    }
    if (data.description !== undefined && JSON.stringify(existing.description) !== JSON.stringify(template.description)) {
      changes.description = { before: existing.description, after: template.description }
    }
    if (data.tasks !== undefined && existingTaskCount !== template._count.tasks) {
      changes.tasks = { before: existingTaskCount, after: template._count.tasks }
    }

    await writeAudit({
      action: 'UPDATE',
      entity: 'TaskTemplate',
      entityId: id,
      entityName: template.name,
      ...(Object.keys(changes).length > 0 && { changes }),
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:delete'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params

    const template = await prisma.taskTemplate.findUnique({ where: { id } })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (template.isDeleted) return NextResponse.json({ error: 'Already archived' }, { status: 400 })

    await prisma.taskTemplate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    await writeAudit({
      action: 'DELETE',
      entity: 'TaskTemplate',
      entityId: id,
      entityName: template.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive template' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    if (body.action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.taskTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!existing.isDeleted) return NextResponse.json({ error: 'Template is not archived' }, { status: 400 })

    const restored = await prisma.taskTemplate.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'TaskTemplate',
      entityId: id,
      entityName: existing.name,
      changes: { isDeleted: { before: true, after: false } },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(restored)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to restore template' }, { status: 500 })
  }
}
