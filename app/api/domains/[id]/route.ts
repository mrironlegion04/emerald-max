import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive:    z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const { name, description, isActive } = schema.parse(await request.json())
    const domain = await prisma.maintenanceDomain.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive    !== undefined && { isActive }),
      },
      include: { _count: { select: { issues: true, categories: true } } },
    })
    return NextResponse.json(domain)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const issueCount = await prisma.issueDomain.count({ where: { domainId: id } })
    if (issueCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${issueCount} issue(s) are linked to this domain.` },
        { status: 409 }
      )
    }
    await prisma.maintenanceDomain.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 })
  }
}
