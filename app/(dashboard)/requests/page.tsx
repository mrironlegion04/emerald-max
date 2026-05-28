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
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Maintenance Requests"
        subtitle={`${allRequestsForStats.length} total · ${requests.length} showing${pendingReviewCount > 0 ? ` · ${pendingReviewCount} pending review` : ''}`}
        action={
          <a href="/request" target="_blank" className="btn-secondary text-sm flex items-center gap-1.5">
            <ExternalLink className="w-4 h-4" />
            Public request form
          </a>
        }
      />

      {allRequestsForStats.length > 0 && <RequestFilters />}

      {allRequestsForStats.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No requests submitted yet.</p>
          <p className="text-xs text-gray-400 mt-1">Share the public request form link so users can submit maintenance requests.</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No requests match your search or filter criteria.</p>
          <p className="text-xs text-gray-400 mt-1">Try clearing your filters or adjusting your search term.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requests.map((req: any) => (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge label={req.status} variant={statusVariant(req.status)} />
                      <Badge label={req.priority} variant={req.priority === 'CRITICAL' ? 'red' : req.priority === 'HIGH' ? 'orange' as never : req.priority === 'MEDIUM' ? 'blue' : 'gray'} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{req.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{req.description}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span>From: <span className="text-gray-600 font-medium">{req.requesterName}</span></span>
                      {req.requesterEmail && <span>{req.requesterEmail}</span>}
                      {req.location && <span>Location: {req.location}</span>}
                      <span>{fmt(req.createdAt)}</span>
                    </div>
                    {req.workOrder && (
                      <p className="text-xs text-green-600 mt-1 font-medium">
                        Converted → <Link href={`/work-orders/${req.workOrder.id}`} className="hover:underline">{req.workOrder.woNumber}</Link>
                      </p>
                    )}
                    {req.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">Rejection reason: {req.rejectionReason}</p>
                    )}
                  </div>
                  {canReview && req.status === 'PENDING' && (
                    <RequestActions requestId={req.id} title={req.title} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-gray-200 rounded-b-xl bg-white">
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