import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/access-control'
import { z } from 'zod'

const updateSchema = z.object({
  name:      z.string().min(1, 'Name is required').optional(),
  isActive:  z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure work order categories' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.workOrderCategory.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Work order category not found' }, { status: 404 })

    const category = await prisma.workOrderCategory.update({ where: { id }, data })
    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update work order category' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure work order categories' }, { status: 403 })

    const { id } = await params
    const existing = await prisma.workOrderCategory.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Work order category not found' }, { status: 404 })

    await prisma.workOrderCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete work order category' }, { status: 500 })
  }
}
