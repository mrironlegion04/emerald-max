import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { canAssignTeams, canAssignUsers, canWriteToLocations } from '@/lib/access-control'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const nestedTierSchema = z.object({
  label:     z.string(),
  frequency: z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:  z.number().int().min(1),
  runEvery:  z.number().int().min(1),
  enabled:   z.boolean(),
})

const updateSchema = z.object({
  title:                z.string().min(1).optional(),
  description:          z.string().nullable().optional(),
  triggerType:          z.enum(['TIME','METER','TIME_OR_METER']).optional(),
  frequency:            z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']).optional(),
  interval:             z.number().int().min(1).optional(),
  nextDueDate:          z.string().optional(),
  assetId:              z.string().nullable().optional(),
  locationId:           z.string().nullable().optional(),
  locationScope:        z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  isActive:             z.boolean().optional(),
  meterInterval:        z.number().nullable().optional(),
  meterUnit:            z.string().nullable().optional(),
  meterId:              z.string().nullable().optional(),
  procedureIds:         z.array(z.string()).optional(),
  // MaintainX-style fields
  scheduleBehavior:     z.enum(['FIXED','FLOATING']).optional(),
  schedulingHorizon:    z.number().int().min(1).max(52).optional(),
  nestedConfig:         z.array(nestedTierSchema).nullable().optional(),
  // WO Template fields
  woPriority:           z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  woDescription:        z.string().nullable().optional(),
  woAssignedToId:       z.string().nullable().optional(),
  woTeamId:             z.string().nullable().optional(),
  woCategoryId:         z.string().nullable().optional(),
  // Start date offset
  startDateOffset:      z.number().int().min(0).optional(),
  // Nested start index
  nestedStartIndex:     z.number().int().min(0).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        asset: true,
        location: true,
      },
    })
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(schedule)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
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

    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const finalAssetId = data.assetId !== undefined ? data.assetId : existing.assetId
    const finalLocationId = data.locationId !== undefined ? data.locationId : existing.locationId
    const finalLocationScope = finalLocationId && !finalAssetId
      ? (data.locationScope !== undefined ? data.locationScope : (existing.locationScope ?? 'ALL_ASSETS'))
      : null

    // ── Plant scope enforcement (only for fields actually changed) ────
    const changedLocationIds: (string | null | undefined)[] = []
    if (data.locationId !== undefined) changedLocationIds.push(finalLocationId)
    if (data.assetId !== undefined) {
      const asset = finalAssetId
        ? await prisma.asset.findUnique({ where: { id: finalAssetId }, select: { locationId: true } })
        : null
      changedLocationIds.push(asset?.locationId ?? null)
    }

    const inScope =
      (await canWriteToLocations(user, changedLocationIds)) &&
      (data.woAssignedToId !== undefined ? await canAssignUsers(user, [data.woAssignedToId]) : true) &&
      (data.woTeamId !== undefined ? await canAssignTeams(user, [data.woTeamId]) : true)
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected location, asset, or assignee' },
        { status: 403 }
      )
    }

    const schedule = await prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        title:               data.title,
        description:         data.description         ?? undefined,
        triggerType:         data.triggerType,
        frequency:           data.frequency,
        interval:            data.interval,
        nextDueDate:         data.nextDueDate ? new Date(data.nextDueDate) : undefined,
        assetId:             finalAssetId,
        locationId:          finalLocationId,
        locationScope:       finalLocationScope,
        isActive:            data.isActive,
        meterId:             data.meterId              ?? null,
        meterInterval:       data.meterInterval        ?? null,
        meterUnit:           data.meterUnit            ?? null,
        scheduleBehavior:    data.scheduleBehavior,
        schedulingHorizon:   data.schedulingHorizon,
        nestedConfig:        data.nestedConfig !== undefined
          ? (data.nestedConfig === null ? Prisma.JsonNull as any : data.nestedConfig)
          : undefined,
        woPriority:          data.woPriority,
        woDescription:       data.woDescription        ?? undefined,
        woAssignedToId:      data.woAssignedToId       ?? undefined,
        woTeamId:            data.woTeamId              ?? undefined,
        woCategoryId:        data.woCategoryId          ?? undefined,
        startDateOffset:     data.startDateOffset,
        nestedStartIndex:    data.nestedStartIndex,
      },
    })

    const changes: Record<string, { before: any; after: any }> = {}
    for (const key of Object.keys(data)) {
      const beforeVal = existing[key as keyof typeof existing]
      const afterVal = schedule[key as keyof typeof schedule]
      const beforeStr = beforeVal instanceof Date ? beforeVal.toISOString() : JSON.stringify(beforeVal)
      const afterStr = afterVal instanceof Date ? afterVal.toISOString() : JSON.stringify(afterVal)
      if (beforeStr !== afterStr) {
        changes[key] = {
          before: beforeVal instanceof Date ? beforeVal.toISOString() : beforeVal,
          after: afterVal instanceof Date ? afterVal.toISOString() : afterVal
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        action: 'UPDATE',
        entity: 'MaintenanceSchedule',
        entityId: schedule.id,
        entityName: schedule.title,
        changes,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:delete'))) {
      return NextResponse.json({ error: 'Only admins can delete schedules' }, { status: 403 })
    }
    const { id } = await params
    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.maintenanceSchedule.delete({ where: { id } })

    await writeAudit({
      action: 'DELETE',
      entity: 'MaintenanceSchedule',
      entityId: id,
      entityName: existing.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
