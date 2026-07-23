import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1),
  steps: z.array(z.string().min(1)).default([]),
  procedureId: z.string().optional(),
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const procedures = await prisma.wOProcedure.findMany({
    where: { workOrderId: id },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(procedures)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const { title, steps, procedureId } = schema.parse(await req.json())

    if (procedureId) {
      // Prevent duplicate Procedure application using Procedure IDs
      const existing = await prisma.wOProcedure.findFirst({
        where: { workOrderId: id, procedureId }
      })
      if (existing) {
        return NextResponse.json({ error: 'This Procedure is already applied to this Work Order' }, { status: 400 })
      }

      const procTemplate = await prisma.procedure.findUnique({
        where: { id: procedureId },
        include: { steps: { orderBy: { sortOrder: 'asc' } } }
      })
      if (!procTemplate) return NextResponse.json({ error: 'Procedure template not found' }, { status: 404 })

      // Build steps list, expanding nested procedures inline
      const woSteps: any[] = []
      let sortOrder = 0

      for (const step of procTemplate.steps) {
        if (step.type === 'NESTED_PROCEDURE' && step.nestedProcedureId) {
          // Fetch nested procedure and clone its steps inline
          const nestedProc = await prisma.procedure.findUnique({
            where: { id: step.nestedProcedureId },
            include: { steps: { orderBy: { sortOrder: 'asc' } } }
          })
          if (nestedProc) {
            for (const nestedStep of nestedProc.steps) {
              woSteps.push({
                label: nestedStep.label,
                type: nestedStep.type,
                isMandatory: nestedStep.isMandatory,
                sortOrder: sortOrder++,
                options: nestedStep.options,
                isChecked: false,
                settings: nestedStep.settings ?? {},
                logic: nestedStep.logic ?? {},
                links: nestedStep.links ?? undefined,
                assignedUserIds: nestedStep.assignedUserIds ?? [],
                assignedTeamIds: nestedStep.assignedTeamIds ?? [],
              })
            }
          }
        } else {
          woSteps.push({
            label: step.label,
            type: step.type,
            isMandatory: step.isMandatory,
            sortOrder: sortOrder++,
            options: step.options,
            isChecked: false,
            settings: step.settings ?? {},
            logic: step.logic ?? {},
            links: step.links ?? undefined,
            assignedUserIds: step.assignedUserIds ?? [],
            assignedTeamIds: step.assignedTeamIds ?? [],
            nestedProcedureId: step.nestedProcedureId ?? undefined,
          })
        }
      }

      const woProcedure = await prisma.wOProcedure.create({
        data: {
          title: procTemplate.name,
          workOrderId: id,
          procedureId,
          source: 'MANUAL',
          steps: { create: woSteps }
        },
        include: { steps: { orderBy: { sortOrder: 'asc' } } }
      })
      return NextResponse.json(woProcedure, { status: 201 })
    }

    const woProcedure = await prisma.wOProcedure.create({
      data: {
        title,
        workOrderId: id,
        source: 'MANUAL',
        steps: {
          create: steps.map((label, idx) => ({
            label,
            sortOrder: idx,
            type: 'CHECKBOX',
            isMandatory: false,
            options: [],
            isChecked: false,
          })),
        },
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json(woProcedure, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
