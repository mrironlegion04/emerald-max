import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1),
  items: z.array(z.string().min(1)).default([]),
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const checklists = await prisma.wOChecklist.findMany({
    where: { workOrderId: id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(checklists)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const { title, items } = schema.parse(await req.json())
    const checklist = await prisma.wOChecklist.create({
      data: {
        title,
        workOrderId: id,
        items: {
          create: items.map((label, idx) => ({ label, sortOrder: idx })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json(checklist, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}