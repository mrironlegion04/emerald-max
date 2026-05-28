import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

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

const templateSchema = z.object({
  name:       z.string().min(1, 'Template name is required'),
  description:z.string().nullish(),
  items:      z.array(itemSchema).default([]),
  assetIds:   z.array(z.string()).optional().default([]),
  categoryIds:z.array(z.string()).optional().default([]),
  locationIds:z.array(z.string()).optional().default([]),
})

export async function GET() {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      include: {
        items:     { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories:true,
        assets:    true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await req.json()
    const data = templateSchema.parse(body)

    const template = await prisma.checklistTemplate.create({
      data: {
        name:       data.name,
        description:data.description ?? null,
        items: { create: data.items },
        locations: { connect: data.locationIds.map(id => ({ id })) },
        categories:{ connect: data.categoryIds.map(id => ({ id })) },
        assets:    { connect: data.assetIds.map(id => ({ id })) },
      },
      include: {
        items:     { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories:true,
        assets:    true,
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'Procedure',
      entityId: template.id,
      entityName: template.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
