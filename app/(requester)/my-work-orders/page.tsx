import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, Package, MapPin, ChevronRight, CalendarClock, Users, SearchX, Layers, AlertTriangle } from 'lucide-react'
import Badge, { priorityVariant, workOrderStatusVariant } from '@/components/Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import { utcDateOnly } from '@/lib/date-format'

interface SearchParams {
  search?: string
  status?: string
}

const VALID_STATUS = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_APPROVAL', 'COMPLETED', 'CLOSED', 'CANCELLED']

export default async function MyWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const params = await searchParams
  const hasFilters = Boolean(params.search || params.status)

  const where: Prisma.WorkOrderWhereInput = {
    requestedById: user.userId,
  }
  if (params.status && VALID_STATUS.includes(params.status)) where.status = params.status as Prisma.WorkOrderWhereInput['status']
  if (params.search) {
    where.AND = [{
      OR: [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { woNumber: { contains: params.search, mode: 'insensitive' } },
        { locationNameSnapshot: { contains: params.search, mode: 'insensitive' } },
      ],
    }]
  }

  const wos = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      issue: { select: { id: true, code: true, title: true } },
      domain: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetCode: true, location: { select: { name: true } } } },
    },
  })

  const statusTabs = [
    { key: '', label: 'All' },
    { key: 'OPEN', label: 'Open' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CLOSED', label: 'Closed' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Work Orders</h1>
            <p className="text-sm text-slate-500">{wos.length} work order{wos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/request" className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Work Order
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusTabs.map(t => (
            <Link
              key={t.key}
              href={t.key ? `/my-work-orders?status=${t.key}` : '/my-work-orders'}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                (params.status ?? '') === t.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {wos.length === 0 ? (
          hasFilters ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No matching work orders</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
              <Link href="/my-work-orders" className="mt-4 btn-secondary text-sm inline-block">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No work orders yet</p>
              <p className="text-sm text-slate-400 mt-1">Submit your first maintenance work order</p>
              <Link href="/request" className="mt-4 btn-primary text-sm inline-block">
                Submit Work Order
              </Link>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {wos.map(wo => (
            <div key={wo.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200/60 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {wo.woNumber && (
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{wo.woNumber}</span>
                    )}
                    <Badge label={WO_STATUS_LABELS[wo.status] ?? wo.status} variant={workOrderStatusVariant(wo.status)} />
                    <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
                    {(wo.issue || wo.issueTitleSnapshot) && (
                      <span className="inline-flex items-center gap-1">
                        <code className="text-[10px] font-bold font-mono bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{wo.issue?.code}</code>
                        <span className="text-[11px] font-semibold text-violet-700 truncate max-w-[160px]">{wo.issueTitleSnapshot ?? wo.issue?.title}</span>
                      </span>
                    )}
                  </div>

                  <Link href={`/my-work-orders/${wo.id}`} className="group mt-2 block">
                    <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">{wo.title}</h3>
                    {wo.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{wo.description}</p>
                    )}
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-400">
                    {wo.asset && (
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        {wo.asset.name}
                        {wo.asset.assetCode && <span className="text-slate-400 font-bold">({wo.asset.assetCode})</span>}
                      </span>
                    )}
                    {(wo.locationNameSnapshot || wo.asset?.location?.name) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {wo.locationNameSnapshot || wo.asset?.location?.name}
                      </span>
                    )}
                    {wo.domain && (
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> {wo.domain.name}
                      </span>
                    )}
                    {wo.customIssue && (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> {wo.customIssue}
                      </span>
                    )}
                    {wo.team && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {wo.team.name}
                      </span>
                    )}
                    {wo.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" /> Due {utcDateOnly(wo.dueDate) ?? '—'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Created {new Date(wo.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {(wo.status === 'OPEN' || wo.status === 'IN_PROGRESS' || wo.status === 'ON_HOLD') && (
                    <div className="mt-3 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                        Tracking: <span className="font-black">{wo.woNumber}</span>
                        <span className="ml-2 normal-case font-medium text-blue-500">{WO_STATUS_LABELS[wo.status]}</span>
                      </p>
                      <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  )
}
