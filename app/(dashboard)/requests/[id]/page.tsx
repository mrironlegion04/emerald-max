import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, MapPin, CalendarClock, Phone, Mail, FileText,
  Clock, CheckCircle2, Circle, AlertTriangle, Ban, ExternalLink, Users, Building2, Layers,
} from 'lucide-react'
import Badge, { priorityVariant } from '@/components/Badge'
import RequestActions from '@/components/RequestActions'
import IssueBadge from '@/components/IssueBadge'
import { hasScopeActionFlag } from '@/lib/access-control'
import { REQUEST_STATUS_LABELS, requestStatusVariant, REQUEST_TYPE_LABELS, requestTypeVariant } from '@/lib/request-status'

function fmt(d: Date | string | null | undefined) {
  if (!d) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d))
}

const WO_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  PENDING_APPROVAL: 'Pending approval',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export default async function StaffRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      issue: { select: { id: true, code: true, title: true, severity: true } },
      domain: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      requesterTeam: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetCode: true, description: true, status: true, location: { select: { id: true, name: true } } } },
      workOrder: {
        select: {
          id: true, woNumber: true, status: true,
          issue: { select: { code: true, title: true, severity: true } },
          customIssue: true,
        },
      },
      attachments: { orderBy: { createdAt: 'desc' } },
      reviewedBy: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
    },
  })

  if (!request) notFound()

  const canReview = user.role === 'ADMIN' || user.role === 'MANAGER'
  const canApproveRequest = await hasScopeActionFlag(user, 'canApproveRequest')
  const canConvertRequest = await hasScopeActionFlag(user, 'canConvertRequest')

  const steps = [
    { label: 'Submitted', done: true, date: request.createdAt },
    { label: 'Reviewed', done: request.status !== 'PENDING', date: request.updatedAt },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto min-h-screen">
      <Link href="/requests" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to requests
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)]">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {request.requestNumber && (
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{request.requestNumber}</span>
            )}
            <Badge label={REQUEST_STATUS_LABELS[request.status] ?? request.status} variant={requestStatusVariant(request.status)} />
            <Badge label={request.priority} variant={priorityVariant(request.priority)} />
            {request.requestType && (
              <Badge label={REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType} variant={requestTypeVariant(request.requestType)} />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{request.title}</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-wrap">{request.description}</p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {request.asset && (
              <Link href={`/assets/${request.asset.id}`} className="bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-200 p-4 transition-colors group">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Asset</p>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Package className="w-4 h-4 text-blue-600" /> {request.asset.name}
                  {request.asset.assetCode && <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded">{request.asset.assetCode}</span>}
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 ml-auto" />
                </p>
                {request.asset.location?.name && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {request.asset.location.name}
                  </p>
                )}
              </Link>
            )}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Requester</p>
              <p className="text-sm font-semibold text-slate-800">{request.requesterName}</p>
              {request.requesterEmail && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {request.requesterEmail}
                </p>
              )}
              {request.requesterPhone && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {request.requesterPhone}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {request.location && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {request.location}
              </div>
            )}
            {request.desiredDate && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
                <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Desired {fmt(request.desiredDate)}
              </div>
            )}
            {request.team && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Team: {request.team.name}
              </div>
            )}
            {request.requesterTeam && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Requesting team: {request.requesterTeam.name}
              </div>
            )}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Submitted {fmt(request.createdAt)}
            </div>
          </div>

          {request.issue && (
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Issue</p>
              <IssueBadge
                code={request.issue.code}
                title={request.issue.title}
                severity={request.issue.severity}
                showSeverity
              />
            </div>
          )}

          {request.customIssue && (
            <div className="mt-4 bg-amber-50/60 rounded-xl border border-amber-200 p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Issue (custom)</p>
              <p className="text-sm font-medium text-amber-800">{request.customIssue}</p>
            </div>
          )}

          {request.domain && (
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Domain / Nature: {request.domain.name}
            </div>
          )}

          {request.attachments.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Photos & attachments</p>
              <div className="flex flex-wrap gap-2">
                {request.attachments.map(a => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    {a.mimeType.startsWith('image/') ? (
                      <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50 p-1 text-center">{a.originalName}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {request.workOrder && (
            <div className="mt-5 bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Converted to work order</p>
                <p className="text-sm font-bold text-blue-800">
                  {request.workOrder.woNumber}
                  <span className="ml-2 font-medium text-blue-500">— {WO_STATUS_LABELS[request.workOrder.status] ?? request.workOrder.status}</span>
                </p>
                {!request.issue && (request.workOrder.issue || request.workOrder.customIssue) && (
                  <p className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Issue</span>
                    <IssueBadge
                      code={request.workOrder.issue?.code}
                      title={request.workOrder.issue?.title}
                      severity={request.workOrder.issue?.severity}
                      customIssue={request.workOrder.customIssue}
                      showSeverity
                    />
                  </p>
                )}
              </div>
              <Link href={`/work-orders/${request.workOrder.id}`} className="btn-secondary text-xs shrink-0">
                Open Work Order
              </Link>
            </div>
          )}

          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="mt-5 bg-rose-50/60 border border-rose-100 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Rejection reason</p>
                <p className="text-sm text-rose-600 mt-0.5">{request.rejectionReason}</p>
              </div>
            </div>
          )}

          {request.status === 'CANCELLED' && (
            <div className="mt-5 bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3">
              <Ban className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-500">This request was cancelled by the requester.</p>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Status timeline</p>
            <div className="space-y-0">
              {steps.map((step, i) => {
                const done = step.done
                const isLast = i === steps.length - 1
                return (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Circle className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      {!isLast && <div className={`w-0.5 flex-1 min-h-6 ${done ? 'bg-blue-500' : 'bg-slate-200'}`} />}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-semibold ${done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="text-xs text-slate-400">{done ? fmt(step.date) : 'Awaiting review'}</p>
                    </div>
                  </div>
                )
              })}

              {request.status !== 'PENDING' && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </p>
                    {request.reviewedBy && (
                      <p className="text-xs text-slate-400">Reviewed by {request.reviewedBy.name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {canReview && request.status === 'PENDING' && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Review decision</p>
              <RequestActions requestId={request.id} title={request.title} canApprove={canApproveRequest} canConvert={canConvertRequest} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
