import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateSchema = z.object({
  code:      z.string().min(1).optional(),
  title:     z.string().min(1).optional(),
  domainIds: z.array(z.string()).optional(),
  severity:  z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  isActive:  z.boolean().optional(),
  isGlobal:  z.boolean().optional(),
  sortOrder: z.number().int().optional(),
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
    const { code, title, domainIds, severity, isActive, isGlobal, sortOrder } = updateSchema.parse(await request.json())

    const issue = await prisma.issue.update({
      where: { id },
      data: {
        ...(code      !== undefined && { code }),
        ...(title     !== undefined && { title }),
        ...(severity  !== undefined && { severity }),
        ...(isActive  !== undefined && { isActive }),
        ...(isGlobal  !== undefined && { isGlobal }),
        ...(sortOrder !== undefined && { sortOrder }),
        // Replace domain links atomically
        ...(domainIds !== undefined && {
          domains: {
            deleteMany: {},
            ...(domainIds.length > 0 ? { create: domainIds.map(domainId => ({ domainId })) } : {}),
          },
        }),
      },
      include: {
        domains: { include: { domain: true } },
        _count:  { select: { workOrders: true } },
      },
    })
    return NextResponse.json(issue)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 })
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
    const woCount = await prisma.workOrder.count({ where: { issueId: id } })
    if (woCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${woCount} work order(s) reference this issue.` },
        { status: 409 }
      )
    }
    await prisma.issue.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 })
  }
}
