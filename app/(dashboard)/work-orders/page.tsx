import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import AdvancedWOFilters from '@/components/AdvancedWOFilters'
import WorkOrdersTable from '@/components/WorkOrdersTable'

interface SearchParams {
  search?:      string
  status?:      string
  priority?:    string
  type?:        string
  assignedToId?:string
  domainId?:    string
  assetId?:     string
  dueDateFrom?: string
  dueDateTo?:   string
  createdFrom?: string
  createdTo?:   string
  page?:        string
}

const ITEMS_PER_PAGE = 25

const statusLabels: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}
const typeLabels: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}

async function getWorkOrders(filters: SearchParams) {
  const where: Record<string, unknown> = {}

  if (filters.search) {
    where.OR = [
      { title:       { contains: filters.search, mode: 'insensitive' } },
      { woNumber:    { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.status)       where.status       = filters.status
  if (filters.priority)     where.priority     = filters.priority
  if (filters.type)         where.type         = filters.type
  if (filters.assignedToId) where.assignedToId = filters.assignedToId
  if (filters.domainId)     where.domainId     = filters.domainId
  


  if (filters.assetId) {
    const allAssets = await prisma.asset.findMany({
      select: { id: true, parentId: true }
    })
    const subAssetIds = new Set<string>([filters.assetId])
    const queue = [filters.assetId]
    while (queue.length > 0) {
      const currentId = queue.shift()!
      const children = allAssets.filter((a: any) => a.parentId === currentId)
      for (const child of children) {
        if (!subAssetIds.has(child.id)) {
          subAssetIds.add(child.id)
          queue.push(child.id)
        }
      }
    }
    where.assetId = { in: Array.from(subAssetIds) }
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {
      ...(filters.dueDateFrom ? { gte: new Date(filters.dueDateFrom) } : {}),
      ...(filters.dueDateTo   ? { lte: new Date(filters.dueDateTo) }   : {}),
    }
  }
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
      ...(filters.createdTo   ? { lte: new Date(filters.createdTo) }   : {}),
    }
  }

  const page = Math.max(1, parseInt(filters.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [workOrders, totalCount, technicians, domains, assets] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: {
        asset:        { select: { id: true, name: true, assetCode: true } },
        assignedTo:   { select: { id: true, name: true } },
        domain:       { select: { id: true, name: true } },
        createdBy:    { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.workOrder.count({ where }),
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.maintenanceDomain.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select: { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return { workOrders, technicians, domains, assets, totalCount, page }
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  const params = await searchParams
  const { workOrders, technicians, domains, assets, totalCount, page } = await getWorkOrders(params)
  const canExport = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const overdueCount = workOrders.filter(
    (wo: any) => wo.dueDate && new Date(wo.dueDate) < new Date() && !['COMPLETED','CANCELLED'].includes(wo.status)
  ).length
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/work-orders?${queryString.toString()}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Work Orders"
        subtitle={`${totalCount} total · ${workOrders.length} showing${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        action={
          <Link href="/work-orders/new" className="btn-primary text-sm">+ New work order</Link>
        }
      />

      <AdvancedWOFilters technicians={technicians} domains={domains} assets={assets} canExport={canExport} />

      {workOrders.length === 0 ? (
        <EmptyState
          title="No work orders found"
          description={
            Object.values(params).some(Boolean)
              ? 'Try adjusting your filters.'
              : 'Create your first work order to get started.'
          }
          action={
            <Link href="/work-orders/new" className="btn-primary text-sm">
              Create work order
            </Link>
          }
          icon={<ClipboardList className="w-7 h-7" />}
        />
      ) : (
        <>
          <WorkOrdersTable
            workOrders={workOrders}
            technicians={technicians}
            typeLabels={typeLabels}
            statusLabels={statusLabels}
          />
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=1'} className="btn-secondary text-sm">
                    ← First
                  </Link>
                )}
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page - 1}`} className="btn-secondary text-sm">
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page + 1}`} className="btn-secondary text-sm">
                    Next →
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${totalPages}`} className="btn-secondary text-sm">
                    Last →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
