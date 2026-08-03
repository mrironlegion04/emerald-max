import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, Package, MapPin, ChevronRight, CalendarClock, Users } from 'lucide-react'
import Badge, { priorityVariant } from '@/components/Badge'
import { REQUEST_STATUS_LABELS, requestStatusVariant, REQUEST_TYPE_LABELS, requestTypeVariant } from '@/lib/request-status'
import MyRequestsFilters from '@/components/MyRequestsFilters'
import CancelRequestButton from '@/components/CancelRequestButton'

interface SearchParams {
  search?: string
  status?: string
}

const VALID_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED']

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const params = await searchParams

  const where: any = {
    OR: [
      { requesterId: user.userId },
      { requesterName: user.name },
    ],
  }
  if (params.status && VALID_STATUS.includes(params.status)) where.status = params.status
  if (params.search) {
    where.AND = [{
      OR: [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { requestNumber: { contains: params.search, mode: 'insensitive' } },
        { location: { contains: params.search, mode: 'insensitive' } },
      ],
    }]
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      issue: { select: { id: true, code: true, title: true } },
      team: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetCode: true, location: { select: { name: true } } } },
      workOrder: { select: { id: true, woNumber: true, status: true } },
    },
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Requests</h1>
            <p className="text-sm text-slate-500">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/request" className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No requests yet</p>
          <p className="text-sm text-slate-400 mt-1">Submit your first maintenance request</p>
          <Link href="/request" className="mt-4 btn-primary text-sm inline-block">
            Submit Request
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <MyRequestsFilters />

          {requests.map(req => (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200/60 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {req.requestNumber && (
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{req.requestNumber}</span>
                    )}
                    <Badge label={REQUEST_STATUS_LABELS[req.status] ?? req.status} variant={requestStatusVariant(req.status)} />
                    <Badge label={req.priority} variant={priorityVariant(req.priority)} />
                    {req.requestType && (
                      <Badge label={REQUEST_TYPE_LABELS[req.requestType] ?? req.requestType} variant={requestTypeVariant(req.requestType)} />
                    )}
                    {req.issue && (
                      <span className="inline-flex items-center gap-1">
                        <code className="text-[10px] font-bold font-mono bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{req.issue.code}</code>
                        <span className="text-[11px] font-semibold text-violet-700 truncate max-w-[160px]">{req.issue.title}</span>
                      </span>
                    )}
                  </div>

                  <Link href={`/my-requests/${req.id}`} className="group mt-2 block">
                    <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">{req.title}</h3>
                    {req.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.description}</p>
                    )}
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-400">
                    {req.asset && (
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        {req.asset.name}
                        {req.asset.assetCode && <span className="text-slate-400 font-bold">({req.asset.assetCode})</span>}
                      </span>
                    )}
                    {(req.location || req.asset?.location?.name) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {req.location || req.asset?.location?.name}
                      </span>
                    )}
                    {req.team && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {req.team.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" />
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {req.workOrder && (
                    <div className="mt-3 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                        Tracking: <span className="font-black">{req.workOrder.woNumber}</span>
                        <span className="ml-2 normal-case font-medium text-blue-500">
                          {({ OPEN: 'Open', IN_PROGRESS: 'In progress', ON_HOLD: 'On hold', PENDING_APPROVAL: 'Pending approval', COMPLETED: 'Completed', CLOSED: 'Closed', CANCELLED: 'Cancelled' } as Record<string, string>)[req.workOrder.status] ?? req.workOrder.status}
                        </span>
                      </p>
                      <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  )}

                  {req.status === 'REJECTED' && req.rejectionReason && (
                    <div className="mt-3 bg-rose-50/60 border border-rose-100 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected</p>
                      <p className="text-xs text-rose-600 mt-0.5">{req.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {req.status === 'PENDING' && (
                  <div className="shrink-0">
                    <CancelRequestButton requestId={req.id} requestTitle={req.title} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
