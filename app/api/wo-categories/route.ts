import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/access-control'
import { z } from 'zod'

const categorySchema = z.object({
  name:      z.string().min(1, 'Name is required'),
  isActive:  z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const categories = await prisma.workOrderCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch work order categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Only admins can configure work order categories' }, { status: 403 })

    const body = await request.json()
    const data = categorySchema.parse(body)

    const category = await prisma.workOrderCategory.create({ data })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create work order category' }, { status: 500 })
  }
}
