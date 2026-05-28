import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const partSchema = z.object({
  name:        z.string().min(1, 'Name is required'),
  partNumber:  z.string().min(1, 'Part number is required'),
  description: z.string().nullable().optional(),
  unitCost:    z.number().nullable().optional(),
  unit:        z.string().default('pcs'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const showDeleted = searchParams.get('showDeleted') === 'true'

    const parts = await prisma.part.findMany({
      where: showDeleted ? undefined : { isDeleted: false },
      orderBy: [{ name: 'asc' }],
      include: { _count: { select: { usedInWorkOrders: true } } },
    })
    return NextResponse.json(parts)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    const data = partSchema.parse(body)

    const existing = await prisma.part.findUnique({ where: { partNumber: data.partNumber } })
    if (existing) {
      return NextResponse.json({ error: 'Part number already exists' }, { status: 409 })
    }

    const part = await prisma.part.create({
      data: {
        name:        data.name,
        partNumber:  data.partNumber,
        description: data.description ?? null,
        unitCost:    data.unitCost ?? null,
        unit:        data.unit,
        createdById: user.userId,
      },
    })

    await writeAudit({
      action: 'CREATE', entity: 'Part',
      entityId: part.id, entityName: part.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create part' }, { status: 500 })
  }
}
