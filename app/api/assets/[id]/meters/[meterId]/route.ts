import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const updateMeterSchema = z.object({
  name:            z.string().min(1).optional(),
  unit:            z.string().min(1).optional(),
  meterType:       z.enum(['RUNTIME','DISTANCE','CYCLE','TEMPERATURE','PRESSURE','CUSTOM']).optional(),
  description:     z.string().nullable().optional(),
  isPrimary:       z.boolean().optional(),
  allowDecrease:   z.boolean().optional(),
  maxDeltaPerDay:  z.number().positive().nullable().optional(),
  minDeltaPerDay:  z.number().positive().nullable().optional(),
  lastValue:       z.number().nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, meterId } = await params

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, assetId: id, deletedAt: null },
      include: {
        _count: { select: { readings: true } },
      },
    })

    if (!meter) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    return NextResponse.json(meter)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meter' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, meterId } = await params
    const body = await request.json()
    const data = updateMeterSchema.parse(body)

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const existing = await prisma.meter.findFirst({
      where: { id: meterId, assetId: id, deletedAt: null },
    })
    if (!existing) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    // Block unit change if readings exist
    if (data.unit && data.unit !== existing.unit) {
      const readingCount = await prisma.meterReading.count({ where: { meterId } })
      if (readingCount > 0) {
        return NextResponse.json(
          { error: 'Cannot change unit after readings exist. Create a new meter instead.' },
          { status: 400 }
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // If setting as primary, unset existing primary on this asset
      if (data.isPrimary && data.isPrimary !== existing.isPrimary) {
        await tx.meter.updateMany({
          where: { assetId: id, isPrimary: true, id: { not: meterId } },
          data: { isPrimary: false },
        })
      }

      const meter = await tx.meter.update({
        where: { id: meterId },
        data: {
          ...data,
          maxDeltaPerDay: data.maxDeltaPerDay !== undefined ? data.maxDeltaPerDay : undefined,
          minDeltaPerDay: data.minDeltaPerDay !== undefined ? data.minDeltaPerDay : undefined,
          lastValue: data.lastValue !== undefined ? data.lastValue : undefined,
        },
      })

      // Sync legacy cache if primary changed
      if (data.isPrimary !== undefined) {
        const primary = await tx.meter.findFirst({
          where: { assetId: id, isPrimary: true, deletedAt: null },
        })
        await tx.asset.update({
          where: { id },
          data: {
            meterUnit: primary?.unit ?? null,
            currentMeterValue: primary?.lastValue ?? null,
          },
        })
      } else if (data.unit && existing.isPrimary) {
        await tx.asset.update({
          where: { id },
          data: { meterUnit: data.unit },
        })
      }

      return meter
    })

    await writeAudit({
      action: 'UPDATE', entity: 'Meter',
      entityId: result.id, entityName: result.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update meter' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, meterId } = await params

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, assetId: id, deletedAt: null },
    })
    if (!meter) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    // Soft delete — preserve all readings
    await prisma.meter.update({
      where: { id: meterId },
      data: { deletedAt: new Date(), isPrimary: false },
    })

    // If this was primary, update legacy cache
    if (meter.isPrimary) {
      const newPrimary = await prisma.meter.findFirst({
        where: { assetId: id, isPrimary: true, deletedAt: null, id: { not: meterId } },
      })
      await prisma.asset.update({
        where: { id },
        data: {
          meterUnit: newPrimary?.unit ?? null,
          currentMeterValue: newPrimary?.lastValue ?? null,
        },
      })
    }

    await writeAudit({
      action: 'DELETE', entity: 'Meter',
      entityId: meterId, entityName: meter.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete meter' }, { status: 500 })
  }
}
