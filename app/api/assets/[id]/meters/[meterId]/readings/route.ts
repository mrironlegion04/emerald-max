import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { processMeterReading } from '@/lib/meter-events/processors'
import { z } from 'zod'

const readingSchema = z.object({
  value:       z.number().min(0, 'Value must be >= 0'),
  readingDate: z.string().datetime().optional(),
  notes:       z.string().max(500).optional().nullable(),
  source:      z.enum(['MANUAL','IOT','IMPORT']).optional(),
})

const bulkSchema = z.object({
  readings: z.array(readingSchema).min(1, 'At least one reading required'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, meterId } = await params
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const status = searchParams.get('status') // optional filter: VALID, SUSPECT, REJECTED

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, assetId: id, deletedAt: null },
    })
    if (!meter) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    const where: any = { meterId, assetId: id }
    if (status) where.status = status

    const [readings, totalCount] = await Promise.all([
      prisma.meterReading.findMany({
        where,
        orderBy: { readingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          value: true,
          readingDate: true,
          notes: true,
          source: true,
          status: true,
          createdAt: true,
          recordedBy: true,
        },
      }),
      prisma.meterReading.count({ where }),
    ])

    return NextResponse.json({
      readings,
      totalCount,
      page,
      limit,
      hasMore: page * limit < totalCount,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch readings' }, { status: 500 })
  }
}

async function validateReading(
  meter: { allowDecrease: boolean; maxDeltaPerDay: number | null; minDeltaPerDay: number | null; lastValue: number | null },
  value: number,
): Promise<{ valid: boolean; status: string; warnings: string[] }> {
  const warnings: string[] = []

  // Check decrease
  if (!meter.allowDecrease && meter.lastValue !== null && value < meter.lastValue) {
    return {
      valid: false,
      status: 'REJECTED',
      warnings: [`Value (${value}) is lower than last reading (${meter.lastValue}). Decrease not allowed on this meter.`],
    }
  }

  // Check delta (only if we have a previous value)
  if (meter.lastValue !== null) {
    const delta = value - meter.lastValue

    if (meter.maxDeltaPerDay !== null && delta > meter.maxDeltaPerDay) {
      warnings.push(`Delta (${delta}) exceeds max delta per day (${meter.maxDeltaPerDay})`)
    }

    if (meter.minDeltaPerDay !== null && delta < meter.minDeltaPerDay) {
      warnings.push(`Delta (${delta}) is below min delta per day (${meter.minDeltaPerDay})`)
    }
  }

  const status = warnings.length > 0 ? 'SUSPECT' : 'VALID'
  return { valid: true, status, warnings }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, meterId } = await params
    const body = await request.json()

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (asset.isDeleted) {
      return NextResponse.json({ error: 'Cannot record readings on deleted asset' }, { status: 400 })
    }

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, assetId: id, deletedAt: null },
    })
    if (!meter) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    // --- Bulk import ---
    if (body.readings && Array.isArray(body.readings)) {
      const { readings } = bulkSchema.parse(body)

      const result = await prisma.$transaction(async (tx) => {
        const created: Array<{ id: string; value: number; status: string }> = []

        for (const r of readings) {
          // Check duplicate
          const dup = await tx.meterReading.findFirst({
            where: {
              meterId,
              value: r.value,
              readingDate: {
                gte: new Date(new Date(r.readingDate || new Date()).getTime() - 5 * 60 * 1000),
                lte: new Date(new Date(r.readingDate || new Date()).getTime() + 5 * 60 * 1000),
              },
            },
          })
          if (dup) continue

          const validation = await validateReading(
            meter,
            r.value,
          )

          if (!validation.valid) continue

          const reading = await tx.meterReading.create({
            data: {
              value: r.value,
              readingDate: r.readingDate ? new Date(r.readingDate) : new Date(),
              notes: r.notes ?? null,
              source: r.source ?? 'IMPORT',
              status: validation.status as any,
              meterId,
              assetId: id,
              recordedById: user.userId,
              recordedBy: user.name,
            },
          })

          await processMeterReading(tx, {
            meterId,
            readingId: reading.id,
            value: r.value,
            unit: meter.unit,
            readingDate: reading.readingDate,
            source: 'IMPORT',
            status: reading.status,
            recordedById: user.userId,
            recordedBy: user.name,
          })

          created.push({ id: reading.id, value: r.value, status: reading.status })
        }

        return created
      })

      return NextResponse.json({
        success: true,
        count: result.length,
        readings: result,
      }, { status: 201 })
    }

    // --- Single reading ---
    const { value, readingDate, notes, source } = readingSchema.parse(body)

    // Duplicate check
    const duplicate = await prisma.meterReading.findFirst({
      where: {
        meterId,
        value,
        readingDate: {
          gte: new Date(Date.now() - 10 * 60 * 1000),
          lte: new Date(),
        },
      },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'Duplicate reading: same value recorded within the last 10 minutes' },
        { status: 400 },
      )
    }

    const validation = await validateReading(meter, value)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.warnings[0] }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const reading = await tx.meterReading.create({
        data: {
          value,
          readingDate: readingDate ? new Date(readingDate) : new Date(),
          notes: notes ?? null,
          source: source ?? 'MANUAL',
          status: validation.status as any,
          meterId,
          assetId: id,
          recordedById: user.userId,
          recordedBy: user.name,
        },
      })

      await processMeterReading(tx, {
        meterId,
        readingId: reading.id,
        value,
        unit: meter.unit,
        readingDate: reading.readingDate,
        source: reading.source,
        status: reading.status,
        recordedById: user.userId,
        recordedBy: user.name,
      })

      return reading
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to record reading' }, { status: 500 })
  }
}
