import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const createMeterSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  unit:          z.string().min(1, 'Unit is required'),
  meterType:     z.enum(['RUNTIME','DISTANCE','CYCLE','TEMPERATURE','PRESSURE','CUSTOM']).default('CUSTOM'),
  description:   z.string().nullable().optional(),
  isPrimary:     z.boolean().optional(),
  allowDecrease: z.boolean().optional(),
  maxDeltaPerDay: z.number().positive().nullable().optional(),
  minDeltaPerDay: z.number().positive().nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meters = await prisma.meter.findMany({
      where: { assetId: id, deletedAt: null },
      include: {
        _count: { select: { readings: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json(meters)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meters' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = createMeterSchema.parse(body)

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (asset.isDeleted) {
      return NextResponse.json({ error: 'Cannot add meters to a deleted asset' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // If isPrimary requested, unset existing primary
      if (data.isPrimary) {
        await tx.meter.updateMany({
          where: { assetId: id, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      // Check if this is the first meter — auto-primary
      const existingCount = await tx.meter.count({
        where: { assetId: id, deletedAt: null },
      })

      const meter = await tx.meter.create({
        data: {
          name: data.name,
          unit: data.unit,
          meterType: data.meterType,
          description: data.description ?? null,
          isPrimary: data.isPrimary ?? existingCount === 0,
          allowDecrease: data.allowDecrease ?? false,
          maxDeltaPerDay: data.maxDeltaPerDay ?? null,
          minDeltaPerDay: data.minDeltaPerDay ?? null,
          assetId: id,
        },
      })

      // If primary, update legacy asset cache
      if (meter.isPrimary) {
        await tx.asset.update({
          where: { id },
          data: { meterUnit: data.unit },
        })
      }

      return meter
    })

    await writeAudit({
      action: 'CREATE', entity: 'Meter',
      entityId: result.id, entityName: result.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create meter' }, { status: 500 })
  }
}
