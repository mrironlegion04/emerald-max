import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one work order required'),
  action: z.enum(['assign', 'status', 'export']),
  technicianId: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { ids, action, technicianId, status } = bulkSchema.parse(body)

    if (action === 'assign') {
      if (!technicianId) {
        return NextResponse.json({ error: 'Technician ID required' }, { status: 400 })
      }

      // Verify technician exists
      const tech = await prisma.user.findUnique({
        where: { id: technicianId },
      })
      if (!tech) {
        return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
      }

      // Bulk assign
      await prisma.workOrder.updateMany({
        where: { id: { in: ids } },
        data: { assignedToId: technicianId },
      })

      return NextResponse.json({ success: true, updated: ids.length })
    }

    if (action === 'status') {
      if (!status) {
        return NextResponse.json({ error: 'Status required' }, { status: 400 })
      }

      // Only allow certain transitions
      await prisma.workOrder.updateMany({
        where: { id: { in: ids } },
        data: { status },
      })

      return NextResponse.json({ success: true, updated: ids.length })
    }

    if (action === 'export') {
      // Get WO data for export
      const workOrders = await prisma.workOrder.findMany({
        where: { id: { in: ids } },
        include: {
          asset: { select: { name: true } },
          assignedTo: { select: { name: true } },
          domain: { select: { name: true } },
        },
      })

      // Convert to CSV
      const headers = ['WO Number', 'Title', 'Asset', 'Status', 'Priority', 'Assigned To (User or Domain)', 'Due Date', 'Created At']
      const rows = workOrders.map(wo => [
        wo.woNumber,
        wo.title,
        wo.asset?.name || '',
        wo.status,
        wo.priority,
        wo.assignedTo?.name || wo.domain?.name || '',
        wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '',
        new Date(wo.createdAt).toLocaleDateString(),
      ])

      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=work-orders.csv',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to process bulk action' }, { status: 500 })
  }
}
