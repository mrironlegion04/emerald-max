import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const stepTypeEnum = z.enum([
  'SECTION',
  'INSTRUCTION',
  'CHECKBOX',
  'INSPECTION',
  'TEXT_INPUT',
  'NUMBER_INPUT',
  'SINGLE_SELECT',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
  'DATE',
  'SIGNATURE',
  'PHOTO',
  'FILE',
  'METER'
])

const stepSchema = z.object({
  label:      z.string().min(1),
  type:       stepTypeEnum.default('CHECKBOX'),
  isMandatory:z.boolean().default(false),
  options:    z.array(z.string()).default([]),
  sortOrder:  z.number().int().default(0),
}).refine(
  step => !['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(step.type) || step.options.length >= 1,
  { message: 'Multiple choice, single select, and dropdown steps must have at least one option', path: ['options'] }
)

const procedureSchema = z.object({
  name:       z.string().min(1, 'Procedure name is required'),
  description:z.string().nullish(),
  steps:      z.array(stepSchema).default([]),
  assetIds:   z.array(z.string()).optional().default([]),
  categoryIds:z.array(z.string()).optional().default([]),
  locationIds:z.array(z.string()).optional().default([]),
})

export async function GET() {
  try {
    const procedures = await prisma.procedure.findMany({
      include: {
        steps:     { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories:true,
        assets:    true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(procedures)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch procedures' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await req.json()
    const data = procedureSchema.parse(body)

    const procedure = await prisma.procedure.create({
      data: {
        name:       data.name,
        description:data.description ?? null,
        steps: { create: data.steps },
        locations: { connect: data.locationIds.map(id => ({ id })) },
        categories:{ connect: data.categoryIds.map(id => ({ id })) },
        assets:    { connect: data.assetIds.map(id => ({ id })) },
      },
      include: {
        steps:     { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories:true,
        assets:    true,
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'Procedure',
      entityId: procedure.id,
      entityName: procedure.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(procedure, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to create procedure' }, { status: 500 })
  }
}
