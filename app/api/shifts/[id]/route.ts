import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/access-control'
import { z } from 'zod'

const updateSchema = z.object({
  label:     z.string().min(1).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm').optional(),
  endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm').optional(),
  isActive:  z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure shifts' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.shiftConfig.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Shift config not found' }, { status: 404 })

    const shift = await prisma.shiftConfig.update({ where: { id }, data })
    return NextResponse.json(shift)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update shift config' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure shifts' }, { status: 403 })

    const { id } = await params
    const existing = await prisma.shiftConfig.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Shift config not found' }, { status: 404 })

    await prisma.shiftConfig.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete shift config' }, { status: 500 })
  }
}
