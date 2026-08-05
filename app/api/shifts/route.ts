import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/access-control'
import { z } from 'zod'

const shiftSchema = z.object({
  name:      z.string().min(1),
  label:     z.string().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm'),
  endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm'),
  isActive:  z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shifts = await prisma.shiftConfig.findMany({
      orderBy: [{ startTime: 'asc' }],
    })
    return NextResponse.json(shifts)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch shift configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure shifts' }, { status: 403 })

    const body = await request.json()
    const data = shiftSchema.parse(body)

    const shift = await prisma.shiftConfig.create({ data })
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create shift config' }, { status: 500 })
  }
}
