import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const stepTypeEnum = z.enum(['CHECKBOX','TEXT_INPUT','NUMBER_INPUT','SINGLE_SELECT','INSPECTION','SIGNATURE'])

const itemSchema = z.object({
  label:      z.string().min(1),
  type:       stepTypeEnum.default('CHECKBOX'),
  isMandatory:z.boolean().default(false),
  options:    z.array(z.string()).default([]),
  sortOrder:  z.number().int().default(0),
}).refine(
  item => item.type !== 'SINGLE_SELECT' || item.options.length >= 1,
  { message: 'SINGLE_SELECT steps must have at least one option', path: ['options'] }
)

const updateSchema = z.object({
  name:       z.string().min(1),
  description:z.string().nullish(),
  items:      z.array(itemSchema).default([]),
  assetIds:   z.array(z.string()).optional().default([]),
  categoryIds:z.array(z.string()).optional().default([]),
  locationIds:z.array(z.string()).optional().default([]),
})

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        items:     { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories:true,
        assets:    true,
      },
    })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(template)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Replace all items and update tag associations atomically
    const template = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } })
      return tx.checklistTemplate.update({
        where: { id },
        data: {
          name:       data.name,
          description:data.description ?? null,
          items: { create: data.items },
          locations: { set: data.locationIds.map(id => ({ id })) },
          categories:{ set: data.categoryIds.map(id => ({ id })) },
          assets:    { set: data.assetIds.map(id => ({ id })) },
        },
        include: {
          items:     { orderBy: { sortOrder: 'asc' } },
          locations: true,
          categories:true,
          assets:    true,
        },
      })
    })

    const changes: Record<string, { before: any; after: any }> = {}
    if (existing.name !== data.name) {
      changes.name = { before: existing.name, after: data.name }
    }
    if (existing.description !== (data.description ?? null)) {
      changes.description = { before: existing.description, after: data.description ?? null }
    }
    changes.items = { before: 'replaced', after: `${data.items.length} item(s)` }

    await writeAudit({
      action: 'UPDATE',
      entity: 'Procedure',
      entityId: template.id,
      entityName: template.name,
      changes,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const existing = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.checklistTemplate.delete({ where: { id } })

    await writeAudit({
      action: 'DELETE',
      entity: 'Procedure',
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
