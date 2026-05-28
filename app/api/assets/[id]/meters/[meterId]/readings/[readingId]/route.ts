import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const statusUpdateSchema = z.object({
  status: z.enum(['VALID', 'SUSPECT', 'REJECTED']),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string; readingId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, meterId, readingId } = await params
    const body = await request.json()
    const data = statusUpdateSchema.parse(body)

    const reading = await prisma.meterReading.findFirst({
      where: { id: readingId, meterId, assetId: id },
      include: { meter: { select: { name: true, unit: true } } },
    })
    if (!reading) return NextResponse.json({ error: 'Reading not found' }, { status: 404 })

    const updated = await prisma.meterReading.update({
      where: { id: readingId },
      data: { status: data.status },
    })

    const changes: Record<string, { before: unknown; after: unknown }> = {
      status: { before: reading.status, after: data.status },
    }
    if (data.reason) changes.reason = { before: null, after: data.reason }

    await writeAudit({
      action: 'UPDATE',
      entity: 'MeterReading',
      entityId: readingId,
      entityName: `Status: ${reading.status} → ${data.status} (${reading.value} ${reading.meter.unit})`,
      changes,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update reading status' }, { status: 500 })
  }
}
