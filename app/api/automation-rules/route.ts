import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const ruleSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
  priority:    z.number().optional(),
  triggerType: z.string().min(1),
  conditions:  z.array(z.object({
    field:    z.string(),
    operator: z.string(),
    value:    z.any(),
  })).optional(),
  actions: z.array(z.object({
    type:   z.string(),
    params: z.record(z.string(), z.any()),
  })).optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rules = await prisma.automationRule.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { priority: 'desc' },
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const data = ruleSchema.parse(body)

    const rule = await prisma.automationRule.create({
      data: {
        name:        data.name,
        description: data.description,
        isActive:    data.isActive ?? true,
        priority:    data.priority ?? 0,
        triggerType: data.triggerType,
        conditions:  (data.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions:     (data.actions ?? []) as unknown as Prisma.InputJsonValue,
        createdById: user.userId,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
