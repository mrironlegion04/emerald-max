import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { buildWOVisibilityFilter, getWriteScopeIds, resolveActiveScope } from '@/lib/access-control'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import AdvancedWOFilters from '@/components/AdvancedWOFilters'
import WorkOrderViewShell from '@/components/WorkOrderViewShell'
import { WO_STATUS_LABELS, ACTIVE_STATUSES, DONE_STATUSES } from '@/lib/work-order-status'

interface SearchParams {
  search?:      string
  status?:      string | string[]
  priority?:    string | string[]
  type?:        string | string[]
  assignedToId?:string
  domainId?:    string
  assetId?:     string
  dueDateFrom?: string
  dueDateTo?:   string
  createdFrom?: string
  createdTo?:   string
  overdue?:     string
  location?:    string
  page?:        string
}

const ITEMS_PER_PAGE = 25

const statusLabels = WO_STATUS_LABELS
const typeLabels: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}

async function getWorkOrders(
  filters: SearchParams,
  visibilityFilter: Record<string, unknown> | null,
  locationScopeIds: string[] | null,
  pickerScopeIds: string[] | null,
) {
  const where: Record<string, unknown> = {}

  if (visibilityFilter) {
    where.AND = [visibilityFilter]
  }

  if (filters.search) {
    where.OR = [
      { title:       { contains: filters.search, mode: 'insensitive' } },
      { woNumber:    { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters.status) {
    const v = filters.status
    where.status = Array.isArray(v) && v.length > 1 ? { in: [...v] } : (Array.isArray(v) ? v[0] : v)
  }
  if (filters.priority) {
    const v = filters.priority
    where.priority = Array.isArray(v) && v.length > 1 ? { in: [...v] } : (Array.isArray(v) ? v[0] : v)
  }
  if (filters.type) {
    const v = filters.type
    where.type = Array.isArray(v) && v.length > 1 ? { in: [...v] } : (Array.isArray(v) ? v[0] : v)
  }

  if (filters.assignedToId) where.assignedToId = filters.assignedToId
  if (filters.domainId)     where.domainId     = filters.domainId

  if (locationScopeIds) {
    const locFilter = { locationId: { in: locationScopeIds } }
    if (Array.isArray(where.AND)) {
      where.AND = [...where.AND, locFilter]
    } else if (where.AND) {
      where.AND = [where.AND, locFilter]
    } else {
      where.AND = [locFilter]
    }
  }

  if (filters.overdue === 'true') {
    where.dueDate = { lt: new Date() }
    where.status  = { notIn: ['COMPLETED', 'CANCELLED'] }
  }

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
      where:   { isActive: true, ...(pickerScopeIds ? { userLocations: { some: { locationId: { in: pickerScopeIds } } } } : {}) },
      select:  { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.maintenanceDomain.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: 'DECOMMISSIONED' }, ...(pickerScopeIds ? { locationId: { in: pickerScopeIds } } : {}) },
      select: { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return { workOrders, technicians, domains, assets, totalCount, page }
}

async function getPanelViewData(userId: string, teamIds: string[], visibilityFilter: Record<string, unknown> | null, locationScopeIds: string[] | null) {
  const woSelect = {
    id: true, woNumber: true, title: true, type: true, status: true,
    priority: true, dueDate: true, createdAt: true,
    asset: { select: { id: true, name: true, assetCode: true } },
    assignedTo: { select: { id: true, name: true } },
    domain: { select: { id: true, name: true } },
    createdBy: { select: { name: true } },
  }

  const woOrder = [{ priority: 'desc' as const }, { dueDate: 'asc' as const }]
  const visAnd = [
    ...(visibilityFilter ? [visibilityFilter] : []),
    ...(locationScopeIds ? [{ locationId: { in: locationScopeIds } }] : []),
  ]

  const [myWOs, mySubtasks, rawTeamWOs, rawTeamSubtasks, createdWOs, allOpen, done] = await Promise.all([
    prisma.workOrder.findMany({
      where: { AND: visAnd, assignedToId: userId, status: { in: ACTIVE_STATUSES as any } },
      include: { asset: woSelect.asset, assignedTo: woSelect.assignedTo, domain: woSelect.domain, createdBy: woSelect.createdBy },
      orderBy: woOrder,
    }),
    prisma.subtask.findMany({
      where: { assignedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS'] as any } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        assignedDomain: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true, status: true, dueDate: true, asset: { select: { id: true, name: true, assetCode: true } } } },
      },
      orderBy: woOrder,
    }),
    teamIds.length ? prisma.workOrder.findMany({
      where: { AND: visAnd, teamId: { in: teamIds }, status: { in: ACTIVE_STATUSES as any } },
      include: { asset: woSelect.asset, assignedTo: woSelect.assignedTo, domain: woSelect.domain, createdBy: woSelect.createdBy },
      orderBy: woOrder,
    }) : [],
    teamIds.length ? prisma.subtask.findMany({
      where: { assignedDomainId: { in: teamIds }, status: { in: ['PENDING', 'IN_PROGRESS'] as any } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        assignedDomain: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true, status: true, dueDate: true, asset: { select: { id: true, name: true, assetCode: true } } } },
      },
      orderBy: woOrder,
    }) : [],
    prisma.workOrder.findMany({
      where: { AND: visAnd, createdById: userId, status: { in: ACTIVE_STATUSES as any } },
      include: { asset: woSelect.asset, assignedTo: woSelect.assignedTo, domain: woSelect.domain, createdBy: woSelect.createdBy },
      orderBy: woOrder,
    }),
    prisma.workOrder.findMany({
      where: { AND: visAnd, status: { in: ACTIVE_STATUSES as any } },
      include: { asset: woSelect.asset, assignedTo: woSelect.assignedTo, domain: woSelect.domain, createdBy: woSelect.createdBy },
      orderBy: woOrder,
    }),
    prisma.workOrder.findMany({
      where: { AND: visAnd, status: { in: DONE_STATUSES as any } },
      include: { asset: woSelect.asset, assignedTo: woSelect.assignedTo, domain: woSelect.domain, createdBy: woSelect.createdBy },
      orderBy: { updatedAt: 'desc' as const },
      take: 100,
    }),
  ])

  const myWOIds = new Set(myWOs.map((w: any) => w.id))
  const teamWOs = rawTeamWOs.filter((wo: any) => !myWOIds.has(wo.id))
  const mySTIds = new Set(mySubtasks.map((s: any) => s.id))
  const teamSubtasks = rawTeamSubtasks.filter((st: any) => !mySTIds.has(st.id))

  const createdWOIds = new Set<string>([...myWOIds, ...teamWOs.map((w: any) => w.id)])
  const uniqueCreatedWOs = createdWOs.filter((wo: any) => !createdWOIds.has(wo.id))

  const allOpenIds = new Set<string>([
    ...myWOs.map((w: any) => w.id),
    ...teamWOs.map((w: any) => w.id),
    ...uniqueCreatedWOs.map((w: any) => w.id),
  ])
  const poolWOs = allOpen.filter((wo: any) => !allOpenIds.has(wo.id))

  return {
    myWOs,
    mySubtasks,
    teamWOs,
    teamSubtasks,
    createdWOs: uniqueCreatedWOs,
    allOpen: [...myWOs, ...teamWOs, ...uniqueCreatedWOs, ...poolWOs],
    done,
    totalCount: allOpen.length + done.length,
  }
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  const params = await searchParams
  const activeScope = user ? await resolveActiveScope(user, params.location) : { scopeIds: null }
  const pickerScopeIds = user ? await getWriteScopeIds(user) : null
  const visibilityFilter = user ? await buildWOVisibilityFilter(user) : null
  const { workOrders, technicians, domains, assets, totalCount, page } = await getWorkOrders(params, visibilityFilter, activeScope.scopeIds, pickerScopeIds)
  const canExport = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const panelData = user ? await (async () => {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.userId },
      select: { teamId: true },
    })
    const teamIds = memberships.map(m => m.teamId)
    return getPanelViewData(user.userId, teamIds, visibilityFilter, activeScope.scopeIds)
  })() : null

  const overdueCount = workOrders.filter(
    (wo: any) => wo.dueDate && new Date(wo.dueDate) < new Date() && !['COMPLETED','CANCELLED'].includes(wo.status)
  ).length

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/work-orders?${queryString.toString()}`

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Work Orders"
        subtitle={`${totalCount} total · ${workOrders.length} showing${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        action={
          <Link href="/work-orders/new" className="btn-primary text-sm">+ New work order</Link>
        }
      />

      {!panelData ? (
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
        <WorkOrderViewShell
          panelData={panelData}
          tableData={workOrders}
          technicians={technicians}
          typeLabels={typeLabels}
          statusLabels={statusLabels}
          totalPages={totalPages}
          currentPage={String(page)}
          baseUrl={baseUrl}
        >
          <AdvancedWOFilters technicians={technicians} domains={domains} assets={assets} canExport={canExport} />
        </WorkOrderViewShell>
      )}
    </div>
  )
}
