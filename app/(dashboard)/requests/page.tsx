import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import RequestActions from '@/components/RequestActions'
import RequestFilters from '@/components/RequestFilters'

function fmt(d: Date|string) { return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(d)) }

const statusVariant = (s: string): 'yellow'|'green'|'red'|'blue' => ({ PENDING:'yellow', APPROVED:'green', REJECTED:'red', CONVERTED:'blue' }[s] as never ?? 'gray')

interface SearchParams {
  search?:   string
  status?:   string
  priority?: string
  page?:     string
}

const ITEMS_PER_PAGE = 25

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  const canReview = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const params = await searchParams

  // Build Prisma where clause
  const where: any = {}
  if (params.status)   where.status = params.status as any
  if (params.priority) where.priority = params.priority

  if (params.search) {
    where.OR = [
      { title:          { contains: params.search, mode: 'insensitive' } },
      { description:    { contains: params.search, mode: 'insensitive' } },
      { requesterName:  { contains: params.search, mode: 'insensitive' } },
      { requesterEmail: { contains: params.search, mode: 'insensitive' } },
      { location:       { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [requests, allRequestsForStats, totalCount] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { workOrder: { select: { id: true, woNumber: true } } },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.maintenanceRequest.findMany({
      select: { status: true },
    }),
    prisma.maintenanceRequest.count({ where })
  ])

  const pendingReviewCount = allRequestsForStats.filter((r: any) => r.status === 'PENDING').length
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/requests?${queryString.toString()}`

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen">
      <PageHeader
        title="Maintenance Requests"
        subtitle={`${allRequestsForStats.length} total • ${totalCount} matching filters${pendingReviewCount > 0 ? ` • ${pendingReviewCount} pending` : ''}`}
        action={
          <a href="/request" target="_blank" className="btn-secondary text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-3xs">
            <ExternalLink className="w-4 h-4" />
            <span>Public Form</span>
          </a>
        }
      />

      {allRequestsForStats.length > 0 && <RequestFilters />}

      {allRequestsForStats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-3xs">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-base font-bold text-slate-800">No requests yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto text-balance">
            Share the public form link so users can submit maintenance requests.
          </p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-3xs">
          <p className="text-base font-bold text-slate-800">No matches found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {requests.map((req: any) => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] hover:border-blue-200/50 transition-all group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={req.status} variant={statusVariant(req.status)} />
                      <Badge label={req.priority} variant={req.priority === 'CRITICAL' ? 'red' : req.priority === 'HIGH' ? 'orange' as never : req.priority === 'MEDIUM' ? 'blue' : 'gray'} />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight ml-auto md:ml-0">
                        {fmt(req.createdAt)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-700 transition-colors">{req.title}</h3>
                      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed line-clamp-3">{req.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 pt-1 border-t border-slate-50/50">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-medium">Requester:</span>
                        <span className="text-slate-700 font-bold truncate">{req.requesterName}</span>
                      </div>
                      {req.requesterEmail && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-medium">Email:</span>
                          <span className="text-slate-700 font-bold truncate">{req.requesterEmail}</span>
                        </div>
                      )}
                      {req.location && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-medium">Location:</span>
                          <span className="text-slate-700 font-bold truncate">{req.location}</span>
                        </div>
                      )}
                    </div>

                    {req.workOrder && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <p className="text-[11px] font-black text-blue-700 uppercase tracking-wider">
                          Converted to <Link href={`/work-orders/${req.workOrder.id}`} className="hover:underline decoration-2 underline-offset-2">{req.workOrder.woNumber}</Link>
                        </p>
                      </div>
                    )}
                    
                    {req.rejectionReason && (
                      <div className="bg-rose-50/50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <p className="text-[11px] font-black text-rose-700 uppercase tracking-wider">
                          Rejected: <span className="font-bold text-rose-600 normal-case">{req.rejectionReason}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {canReview && req.status === 'PENDING' && (
                    <div className="md:pt-1 border-t md:border-t-0 border-slate-100 pt-4 mt-1 md:mt-0">
                      <RequestActions requestId={req.id} title={req.title} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 py-6 mt-4 bg-white border border-slate-200/90 rounded-2xl shadow-3xs">
              <div className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                Page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{totalPages}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=1'} className="btn-secondary text-xs h-9 px-3">
                    First
                  </Link>
                )}
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page - 1}`} className="btn-secondary text-xs h-9 px-3">
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page + 1}`} className="btn-secondary text-xs h-9 px-3">
                    Next
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${totalPages}`} className="btn-secondary text-xs h-9 px-3">
                    Last
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