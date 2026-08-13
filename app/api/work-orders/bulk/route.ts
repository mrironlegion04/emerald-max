import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { buildWOVisibilityFilter, hasScopeActionFlag, canAssignUsers, isValidWOStatusTransition } from '@/lib/access-control'
import { z } from 'zod'
import { utcDateOnly } from '@/lib/date-format'

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one work order required'),
  action: z.enum(['assign', 'status', 'export']),
  technicianId: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'wo:assign'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { ids, action, technicianId, status } = bulkSchema.parse(body)

    // Only operate on work orders the user can view/edit (plant isolation)
    const visibilityFilter = await buildWOVisibilityFilter(user)
    const scopedWhere = { id: { in: ids }, ...(visibilityFilter ?? {}) }

    if (action === 'assign') {
      if (!technicianId) {
        return NextResponse.json({ error: 'Technician ID required' }, { status: 400 })
      }

      // Managers with team-scope rows need the canAssignWO flag
      if (!(await hasScopeActionFlag(user, 'canAssignWO'))) {
        return NextResponse.json({ error: 'Your scope does not allow assigning work orders' }, { status: 403 })
      }

      // Verify technician exists
      const tech = await prisma.user.findUnique({
        where: { id: technicianId },
      })
      if (!tech) {
        return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
      }

      // Plant isolation: the technician must belong to the user's write scope
      if (!(await canAssignUsers(user, [technicianId]))) {
        return NextResponse.json({ error: 'You do not have access to this technician' }, { status: 403 })
      }

      // Bulk assign (scoped to the user's visible work orders)
      const result = await prisma.workOrder.updateMany({
        where: scopedWhere,
        data: { assignedToId: technicianId },
      })

      return NextResponse.json({ success: true, updated: result.count })
    }

    if (action === 'status') {
      if (!status) {
        return NextResponse.json({ error: 'Status required' }, { status: 400 })
      }

      // Managers with team-scope rows need the right flag for status changes
      const needsClose = status === 'COMPLETED' || status === 'CLOSED'
      const flag = needsClose ? 'canCloseWO' : 'canEditWO'
      if (!(await hasScopeActionFlag(user, flag))) {
        return NextResponse.json({ error: 'Your scope does not allow changing this work order status' }, { status: 403 })
      }

      // Completion is a per-WO workflow (required subtasks, repair sessions,
      // asset metrics, mandatory manager approval) — never a bulk target.
      if (status === 'COMPLETED') {
        return NextResponse.json(
          { error: 'Complete or approve work orders from the work order detail page' },
          { status: 400 }
        )
      }

      // Only operate on the work orders the user can see, and validate every
      // transition against the same rules as the single-WO status route.
      const wos = await prisma.workOrder.findMany({
        where: scopedWhere,
        select: { id: true, status: true, assetId: true, woNumber: true },
      })

      const invalid = wos.filter(wo => {
        if (!isValidWOStatusTransition(wo.status, status)) return true
        // Reopen (COMPLETED→OPEN) and unlock (CLOSED→COMPLETED) require
        // field cleanup that bulk updates must not perform implicitly.
        if (status === 'OPEN' && (wo.status === 'COMPLETED' || wo.status === 'CLOSED')) return true
        return false
      })
      if (invalid.length > 0) {
        const first = invalid[0]
        const suffix = invalid.length > 1 ? ` (and ${invalid.length - 1} more)` : ''
        return NextResponse.json(
          { error: `Cannot transition ${first.woNumber} from ${first.status} to ${status}${suffix}` },
          { status: 422 }
        )
      }

      const result = await prisma.workOrder.updateMany({
        where: { id: { in: wos.map(w => w.id) } },
        data: {
          status,
          ...(status === 'CLOSED' ? { closedAt: new Date() } : {}),
        },
      })

      // Record the transition in each WO's status history
      if (result.count > 0) {
        await prisma.workOrderStatusHistory.createMany({
          data: wos.map(wo => ({
            workOrderId: wo.id,
            status,
            changedById: user.userId,
            changedByName: user.name,
            notes: `Bulk status change from ${wo.status} to ${status}`,
          })),
        })

        // Sync linked asset status
        const assetIds = [...new Set(
          wos.map(w => w.assetId).filter((id): id is string => !!id),
        )]
        if (assetIds.length > 0) {
          await prisma.asset.updateMany({
            where: { id: { in: assetIds } },
            data: status === 'IN_PROGRESS'
              ? { status: 'UNDER_MAINTENANCE' }
              : status === 'CANCELLED' || status === 'CLOSED'
                ? { status: 'ACTIVE' }
                : {},
          })
        }
      }

      return NextResponse.json({ success: true, updated: result.count })
    }

    if (action === 'export') {
      // Get WO data for export (scoped to the user's visible work orders)
      const workOrders = await prisma.workOrder.findMany({
        where: scopedWhere,
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
        wo.dueDate ? utcDateOnly(wo.dueDate) ?? '' : '',
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
