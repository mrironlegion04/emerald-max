import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const ruleSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
  priority:    z.number().optional(),
  triggerType: z.string().min(1).optional(),
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    })

    if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rule)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch rule' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = ruleSchema.parse(body)

    const updateData: Prisma.AutomationRuleUpdateInput = {
      ...data,
      ...(data.conditions ? { conditions: data.conditions as unknown as Prisma.InputJsonValue } : {}),
      ...(data.actions ? { actions: data.actions as unknown as Prisma.InputJsonValue } : {}),
    }

    const rule = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(rule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    await prisma.automationRule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
