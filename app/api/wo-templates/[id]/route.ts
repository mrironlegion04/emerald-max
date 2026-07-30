import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  name:          z.string().min(1).optional(),
  description:   z.string().nullable().optional(),
  woType:        z.enum(['BREAKDOWN','PREVENTIVE','PREDICTIVE']).optional(),
  priority:      z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  woDescription: z.string().nullable().optional(),
  notes:         z.string().nullable().optional(),
  isActive:      z.boolean().optional(),
  assignedToId:  z.string().nullable().optional(),
  teamId:        z.string().nullable().optional(),
  categoryId:    z.string().nullable().optional(),
  procedureIds:  z.array(z.string()).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await prisma.workOrderTemplate.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { name: true, email: true } },
        team:       { select: { name: true } },
        category:   { select: { name: true } },
        createdBy:  { select: { name: true } },
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

    const existing = await prisma.workOrderTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const template = await prisma.workOrderTemplate.update({
      where: { id },
      data: {
        name:          data.name,
        description:   data.description   ?? undefined,
        woType:        data.woType,
        priority:      data.priority,
        woDescription: data.woDescription ?? undefined,
        notes:         data.notes          ?? undefined,
        isActive:      data.isActive,
        assignedToId:  data.assignedToId  ?? undefined,
        teamId:        data.teamId        ?? undefined,
        categoryId:    data.categoryId    ?? undefined,
      },
      include: {
        assignedTo: { select: { name: true } },
        team:       { select: { name: true } },
        category:   { select: { name: true } },
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'WorkOrderTemplate',
      entityId: template.id,
      entityName: template.name,
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete templates' }, { status: 403 })
    }
    const { id } = await params
    const existing = await prisma.workOrderTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.workOrderTemplate.delete({ where: { id } })

    await writeAudit({
      action: 'DELETE',
      entity: 'WorkOrderTemplate',
      entityId: id,
      entityName: existing.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
