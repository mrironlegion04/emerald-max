import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import { ClipboardList, Clock, AlertTriangle, Calendar } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import EmptyState from '@/components/EmptyState'
import PMGenerateAllButton from '@/components/PMGenerateAllButton'
import AdvancedPMFilters from '@/components/AdvancedPMFilters'
import { fmt, daysUntil } from '@/lib/utils'

interface SearchParams {
  search?:      string
  frequency?:   string
  isActive?:    string
  overdueOnly?: string
  assetId?:     string
  dueDateFrom?: string
  dueDateTo?:   string
  page?:        string
}

const ITEMS_PER_PAGE = 25

const freqLabels: Record<string, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly', YEARLY: 'Yearly',
}

export default async function PMPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const params  = await searchParams

  // Build Prisma where clause
  const where: Record<string, unknown> = {}
  if (params.frequency)                where.frequency = params.frequency
  if (params.isActive !== undefined && params.isActive !== '')
    where.isActive = params.isActive === 'true'
  if (params.assetId)  where.assetId   = params.assetId
  if (params.dueDateFrom || params.dueDateTo) {
    where.nextDueDate = {
      ...(params.dueDateFrom ? { gte: new Date(params.dueDateFrom) } : {}),
      ...(params.dueDateTo   ? { lte: new Date(params.dueDateTo) }   : {}),
    }
  }
  if (params.search) {
    where.OR = [
      { title:       { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params.overdueOnly === 'true') {
    where.nextDueDate = { lt: new Date() }
    where.isActive    = true
  }

  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [schedules, totalCount, assets] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, assetCode: true, location: { select: { name: true } } } },
        location: { select: { id: true, name: true } },
        procedures: {
          select: {
            procedure: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { nextDueDate: 'asc' },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.maintenanceSchedule.count({ where }),
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select:  { id: true, name: true, assetCode: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const overdueCount  = schedules.filter((s: any) => s.isActive && new Date(s.nextDueDate) < new Date()).length
  const dueSoonCount  = schedules.filter((s: any) => {
    const d = daysUntil(s.nextDueDate)
    return s.isActive && d >= 0 && d <= 7
  }).length
  const activeCount   = schedules.filter((s: any) => s.isActive).length

  const generateableIds = schedules
    .filter((s: any) => s.isActive && daysUntil(s.nextDueDate) <= 0)
    .map((s: any) => s.id)
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/preventive-maintenance?${queryString.toString()}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Preventive Maintenance"
        subtitle={`${totalCount} total · ${activeCount} active${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        action={
          canEdit ? (
            <div className="flex gap-2">
              {generateableIds.length > 0 && <PMGenerateAllButton ids={generateableIds} />}
              <Link href="/preventive-maintenance/new" className="btn-primary text-sm">+ New schedule</Link>
            </div>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Active schedules</p>
            <p className="text-xl font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Due within 7 days</p>
            <p className="text-xl font-bold text-yellow-700">{dueSoonCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Overdue</p>
            <p className="text-xl font-bold text-red-700">{overdueCount}</p>
          </div>
        </div>
      </div>

      {/* Advanced filters */}
      <AdvancedPMFilters assets={assets} canExport={canEdit} />

      {schedules.length === 0 ? (
        <EmptyState
          title="No PM schedules found"
          description={
            Object.values(params).some(Boolean)
              ? 'Try adjusting your filters.'
              : 'Create a preventive maintenance schedule to start auto-generating work orders.'
          }
          action={
            canEdit ? (
              <Link href="/preventive-maintenance/new" className="btn-primary text-sm">
                Create first schedule
              </Link>
            ) : undefined
          }
          icon={<Calendar className="w-7 h-7" />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop & Larger Tablets View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Schedule</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Asset</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Frequency</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Checklist</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Next due</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schedules.map((s: any) => {
                  const days    = daysUntil(s.nextDueDate)
                  const overdue = s.isActive && days < 0
                  const dueSoon = s.isActive && days >= 0 && days <= 7

                  let dueBadge: React.ReactNode
                  if (!s.isActive)    dueBadge = <Badge label="Inactive"                                   variant="gray" />
                  else if (overdue)   dueBadge = <Badge label={`${Math.abs(days)}d overdue`}               variant="red" />
                  else if (dueSoon)   dueBadge = <Badge label={days === 0 ? 'Due today' : `Due in ${days}d`} variant="yellow" />
                  else                dueBadge = <Badge label={`In ${days}d`}                              variant="green" />

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.title}</p>
                        {s.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{s.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.asset ? (
                          <>
                            <Link href={`/assets/${s.asset.id}`} className="text-blue-600 hover:underline text-xs">
                              {s.asset.name}
                            </Link>
                            <p className="text-xs text-gray-400">{s.asset.location?.name ?? ''}</p>
                          </>
                        ) : s.location ? (
                          <>
                            <span className="text-xs text-gray-900 font-medium">
                              {s.location.name}
                            </span>
                            <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">
                              {s.locationScope === 'ALL_ASSETS' ? 'All Assets Scope' : 'General Maint.'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        Every {s.interval > 1 ? `${s.interval} ` : ''}{freqLabels[s.frequency].toLowerCase()}
                      </td>
                      <td className="px-4 py-3">
                        {s.procedures && s.procedures.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium" title={s.procedures.map((ct: any) => ct.procedure.name).join(', ')}>
                            ✅ {s.procedures.length} procedure{s.procedures.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {fmt(s.nextDueDate)}
                        </p>
                      </td>
                      <td className="px-4 py-3">{dueBadge}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/preventive-maintenance/${s.id}`}
                            className="text-xs text-blue-600 hover:underline font-medium">View</Link>
                          {canEdit && (
                            <Link href={`/preventive-maintenance/${s.id}/edit`}
                              className="text-xs text-gray-500 hover:underline font-medium">Edit</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Smaller Tablets Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {schedules.map((s: any) => {
              const days    = daysUntil(s.nextDueDate)
              const overdue = s.isActive && days < 0
              const dueSoon = s.isActive && days >= 0 && days <= 7

              let dueBadge: React.ReactNode
              if (!s.isActive)    dueBadge = <Badge label="Inactive"                                   variant="gray" />
              else if (overdue)   dueBadge = <Badge label={`${Math.abs(days)}d overdue`}               variant="red" />
              else if (dueSoon)   dueBadge = <Badge label={days === 0 ? 'Due today' : `Due in ${days}d`} variant="yellow" />
              else                dueBadge = <Badge label={`In ${days}d`}                              variant="green" />

              return (
                <div key={s.id} className="p-4.5 flex flex-col gap-3.5 hover:bg-slate-50/40 transition-colors">
                  {/* Title & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/preventive-maintenance/${s.id}`} className="font-extrabold text-slate-900 text-sm leading-snug hover:text-blue-600 block truncate">
                        {s.title}
                      </Link>
                      {s.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{s.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 select-none">
                      {dueBadge}
                    </div>
                  </div>

                  {/* High Density metadata metrics */}
                  <div className="border-t border-slate-105/60 pt-3.5 grid grid-cols-2 gap-3.5 text-xs">
                    {/* Location Scope & Asset */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset / Target</span>
                      {s.asset ? (
                        <div className="min-w-0">
                          <Link href={`/assets/${s.asset.id}`} className="text-blue-600 font-extrabold hover:underline truncate block">
                            {s.asset.name}
                          </Link>
                          {s.asset.location?.name && (
                            <span className="text-[11px] text-slate-500 block truncate font-medium mt-0.5">📍 {s.asset.location.name}</span>
                          )}
                        </div>
                      ) : s.location ? (
                        <div className="min-w-0">
                          <span className="text-slate-900 font-extrabold block truncate">
                            {s.location.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block truncate mt-0.5">
                            {s.locationScope === 'ALL_ASSETS' ? 'All Assets Scope' : 'General Maint.'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </div>

                    {/* Frequency */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recurrence</span>
                      <span className="text-slate-700 font-bold flex items-center gap-1.5">
                        🔄 Every {s.interval > 1 ? `${s.interval} ` : ''}{freqLabels[s.frequency].toLowerCase()}
                      </span>
                    </div>

                    {/* Checklist linked count */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Procedures</span>
                      {s.procedures && s.procedures.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[11px] font-bold" title={s.procedures.map((ct: any) => ct.procedure.name).join(', ')}>
                          📋 {s.procedures.length} Procedure{(s.procedures.length !== 1) ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </div>

                    {/* Next Due Date */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Due date</span>
                      <span className={`font-bold flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-slate-800'}`}>
                        📅 {fmt(s.nextDueDate)}
                      </span>
                    </div>
                  </div>

                  {/* Touch optimized quick actions */}
                  <div className="flex items-center gap-2.5 w-full pt-1">
                    <Link
                      href={`/preventive-maintenance/${s.id}`}
                      className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-bold rounded-xl transition-all border border-slate-200"
                    >
                      View Schedule
                    </Link>
                    {canEdit && (
                      <Link
                        href={`/preventive-maintenance/${s.id}/edit`}
                        className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all border border-blue-100"
                      >
                        Edit Schedule
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
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
        </div>
      )}
    </div>
  )
}
