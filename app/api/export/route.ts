import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n')
}

function fmt(date: Date | string | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric' }).format(new Date(date))
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Technicians cannot export data' }, { status: 403 })

    const sp = new URL(request.url).searchParams
    const type = sp.get('type') ?? 'work-orders'

    let csv = ''
    let filename = ''

    if (type === 'work-orders') {
      // Advanced filters
      const where: Record<string, unknown> = {}
      const search      = sp.get('search')
      const status      = sp.get('status')
      const priority    = sp.get('priority')
      const woType      = sp.get('type') !== 'work-orders' ? sp.get('type') : null
      const assignedToId= sp.get('assignedToId')
      const assetId     = sp.get('assetId')
      const dueDateFrom = sp.get('dueDateFrom')
      const dueDateTo   = sp.get('dueDateTo')
      const createdFrom = sp.get('createdFrom')
      const createdTo   = sp.get('createdTo')

      if (search) where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { woNumber:    { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
      if (status)       where.status       = status
      if (priority)     where.priority     = priority
      if (woType)       where.type         = woType
      if (assignedToId) where.assignedToId = assignedToId
      
      if (assetId) {
        const allAssets = await prisma.asset.findMany({
          select: { id: true, parentId: true }
        })
        const subAssetIds = new Set<string>([assetId])
        const queue = [assetId]
        while (queue.length > 0) {
          const currentId = queue.shift()!
          const children = allAssets.filter((a: { id: string; parentId: string | null }) => a.parentId === currentId)
          for (const child of children) {
            if (!subAssetIds.has(child.id)) {
              subAssetIds.add(child.id)
              queue.push(child.id)
            }
          }
        }
        where.assetId = { in: Array.from(subAssetIds) }
      }

      if (dueDateFrom || dueDateTo) {
        where.dueDate = {
          ...(dueDateFrom ? { gte: new Date(dueDateFrom) } : {}),
          ...(dueDateTo   ? { lte: new Date(dueDateTo) }   : {}),
        }
      }
      if (createdFrom || createdTo) {
        where.createdAt = {
          ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
          ...(createdTo   ? { lte: new Date(createdTo) }   : {}),
        }
      }

      const wos = await prisma.workOrder.findMany({
        where,
        include: {
          asset:        { select: { name: true, assetCode: true } },
          assignedTo:   { select: { name: true, email: true } },
          createdBy:    { select: { name: true } },
          domain:       { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      filename = `work-orders-${new Date().toISOString().slice(0,10)}.csv`
      const headers = [
        'WO Number','Title','Type','Status','Priority',
        'Asset','Asset Code','Assigned To','Industrial Domain','Created By',
        'Due Date','Started','Completed',
        'Labor Hours','Labor Cost','Parts Cost','Total Cost','Created At',
      ]
      const rows = wos.map(w => [
        w.woNumber, w.title, w.type, w.status, w.priority,
        w.asset?.name ?? '', w.asset?.assetCode ?? '',
        w.assignedTo?.name ?? '', w.domain?.name ?? '', w.createdBy?.name ?? '',
        fmt(w.dueDate), fmt(w.startedAt), fmt(w.completedAt),
        w.laborHours ?? '', w.laborCost ?? '', w.partsCost ?? '',
        ((w.laborCost ?? 0) + (w.partsCost ?? 0)) || '',
        fmt(w.createdAt),
      ])
      csv = toCSV(headers, rows)

    } else if (type === 'pm-schedules') {
      const where: Record<string, unknown> = {}
      const assetId  = sp.get('assetId')
      const isActive = sp.get('isActive')
      const freq     = sp.get('frequency')
      if (assetId)  where.assetId   = assetId
      if (freq)     where.frequency = freq
      if (isActive !== null) where.isActive = isActive === 'true'

      const schedules = await prisma.maintenanceSchedule.findMany({
        where,
        include: {
          asset: { select: { name: true, assetCode: true, location: { select: { name: true } } } },
          location: { select: { name: true } },
          procedures: {
            select: {
              procedure: { select: { name: true } },
            },
          },
        },
        orderBy: { nextDueDate: 'asc' },
      })
      filename = `pm-schedules-${new Date().toISOString().slice(0,10)}.csv`
      const headers = [
        'Title','Description','Trigger','Frequency','Interval','Next Due',
        'Asset','Asset Code','Location','Procedure','Active','Created At',
      ]
      const rows = schedules.map(s => [
        s.title, s.description ?? '',
        s.triggerType, s.frequency, s.interval, fmt(s.nextDueDate),
        s.asset?.name ?? '', s.asset?.assetCode ?? '', s.asset?.location?.name ?? s.location?.name ?? '',
        s.procedures.map(p => p.procedure.name).join('; ') || '',
        s.isActive ? 'Yes' : 'No', fmt(s.createdAt),
      ])
      csv = toCSV(headers, rows)

    } else if (type === 'assets') {
      const assets = await prisma.asset.findMany({
        include: {
          category: { select: { name: true } },
          location: { select: { name: true } },
          _count:   { select: { workOrders: true } },
        },
        orderBy: { name: 'asc' },
      })
      filename = `assets-${new Date().toISOString().slice(0,10)}.csv`
      const headers = [
        'Asset Code','Name','Status','Category','Location','Manufacturer','Model',
        'Serial Number','Purchase Date','Purchase Cost','Work Orders','Created At',
      ]
      const rows = assets.map(a => [
        a.assetCode, a.name, a.status,
        a.category?.name ?? '', a.location?.name ?? '',
        a.manufacturer ?? '', a.model ?? '', a.serialNumber ?? '',
        fmt(a.purchaseDate), a.purchaseCost ?? '',
        a._count.workOrders, fmt(a.createdAt),
      ])
      csv = toCSV(headers, rows)

    } else if (type === 'inventory') {
      const parts = await prisma.part.findMany({
        where: { isDeleted: false },
        include: { _count: { select: { usedInWorkOrders: true } } },
        orderBy: { name: 'asc' },
      })
      filename = `inventory-${new Date().toISOString().slice(0,10)}.csv`
      const headers = [
        'Part Number','Name','Description','Unit',
        'Unit Cost','Times Used','Created At',
      ]
      const rows = parts.map(p => [
        p.partNumber, p.name, p.description ?? '',
        p.unit,
        p.unitCost ?? '',
        p._count.usedInWorkOrders, fmt(p.createdAt),
      ])
      csv = toCSV(headers, rows)

    } else if (type === 'audit') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      }
      const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10000 })
      filename = `audit-log-${new Date().toISOString().slice(0,10)}.csv`
      const headers = ['Date','Action','Entity','Entity Name','User','Email','Changes']
      const rows = logs.map(l => [
        fmt(l.createdAt), l.action, l.entity, l.entityName,
        l.userName ?? '', l.userEmail ?? '', l.changes ?? '',
      ])
      csv = toCSV(headers, rows)

    } else {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}