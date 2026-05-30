import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const pmSchema = z.object({
  title:                z.string().min(1, 'Title is required'),
  description:          z.string().nullable().optional(),
  triggerType:          z.enum(['TIME','METER']).default('TIME'),
  frequency:            z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:             z.number().int().min(1).default(1),
  nextDueDate:          z.string().min(1, 'Next due date is required'),
  assetId:              z.string().nullable().optional(),
  locationId:           z.string().nullable().optional(),
  locationScope:        z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  isActive:             z.boolean().default(true),
  meterInterval:        z.number().nullable().optional(),
  meterUnit:            z.string().nullable().optional(),
  meterId:              z.string().nullable().optional(),
  checklistTemplateIds: z.array(z.string()).optional().default([]),
  procedureIds:        z.array(z.string()).optional().default([]),
}).refine(data => data.assetId || data.locationId, {
  message: "Either Asset or Location must be selected",
  path: ["assetId"]
})

export async function GET() {
  try {
    const schedules = await prisma.maintenanceSchedule.findMany({
      include: {
        asset:    { select: { id: true, name: true, assetCode: true } },
        location: { select: { id: true, name: true } },
        procedures: {
          select: { procedure: { select: { id: true, name: true } }, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    })
    return NextResponse.json(schedules)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const data = pmSchema.parse(body)

    const combinedProcedureIds = [...new Set([...(data.procedureIds ?? []), ...(data.checklistTemplateIds ?? [])])]

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        title:               data.title,
        description:         data.description         ?? null,
        triggerType:         data.triggerType,
        frequency:           data.frequency,
        interval:            data.interval,
        nextDueDate:         new Date(data.nextDueDate),
        assetId:             data.assetId              ?? null,
        locationId:          data.locationId           ?? null,
        locationScope:       data.locationId && !data.assetId ? (data.locationScope ?? 'ALL_ASSETS') : null,
        isActive:            data.isActive,
        meterId:             data.meterId              ?? null,
        meterInterval:       data.meterInterval        ?? null,
        meterUnit:           data.meterUnit            ?? null,
        createdById:         user.userId,
        procedures: {
          create: combinedProcedureIds.map((procedureId, index) => ({
            procedureId,
            sortOrder: index,
          })),
        },
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'MaintenanceSchedule',
      entityId: schedule.id,
      entityName: schedule.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
