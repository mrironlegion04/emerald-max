import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, MapPin, CalendarClock, Phone, Mail, CheckCircle2,
  Circle, Clock, FileText, AlertTriangle, Ban, Users,
} from 'lucide-react'
import Badge, { priorityVariant } from '@/components/Badge'
import { REQUEST_STATUS_LABELS, requestStatusVariant, REQUEST_TYPE_LABELS, requestTypeVariant } from '@/lib/request-status'
import CancelRequestButton from '@/components/CancelRequestButton'
import IssueBadge from '@/components/IssueBadge'

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
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

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      issue: { select: { id: true, code: true, title: true, severity: true } },
      team: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetCode: true, description: true, location: { select: { name: true } } } },
      workOrder: {
        select: {
          id: true, woNumber: true, status: true,
          issue: { select: { code: true, title: true, severity: true } },
          customIssue: true,
        },
      },
      attachments: { orderBy: { createdAt: 'desc' } },
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  const isOwner = request && (request.requesterId === user.userId || request.requesterName === user.name)
  if (!request || !isOwner) redirect('/my-requests')

  const steps = [
    { label: 'Submitted', done: true, date: request.createdAt, icon: FileText },
    { label: 'Reviewed', done: request.status !== 'PENDING', date: request.updatedAt, icon: CheckCircle2 },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link href="/my-requests" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to My Requests
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
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
          <h1 className="text-xl font-bold text-slate-900">{request.title}</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-wrap">{request.description}</p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {request.asset && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Asset</p>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Package className="w-4 h-4 text-blue-600" /> {request.asset.name}
                  {request.asset.assetCode && <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded">{request.asset.assetCode}</span>}
                </p>
                {request.asset.location?.name && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {request.asset.location.name}
                  </p>
                )}
              </div>
            )}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
              {request.location && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {request.location}
                </p>
              )}
              {request.desiredDate && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" /> Desired by {fmtDate(request.desiredDate)}
                </p>
              )}
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Submitted {fmtDate(request.createdAt)}
              </p>
              {request.requesterPhone && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {request.requesterPhone}
                </p>
              )}
              {request.requesterEmail && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {request.requesterEmail}
                </p>
              )}
              {request.team && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Team: {request.team.name}
                </p>
              )}
            </div>
          </div>

          {request.issue && (
            <div className="mt-5 bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Issue</p>
              <IssueBadge
                code={request.issue.code}
                title={request.issue.title}
                severity={request.issue.severity}
                showSeverity
              />
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
            <div className="mt-5 bg-blue-50/60 border border-blue-100 rounded-xl p-4">
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
          )}

          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="mt-5 bg-rose-50/60 border border-rose-100 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Rejected{request.reviewedBy ? ` by ${request.reviewedBy.name}` : ''}</p>
                <p className="text-sm text-rose-600 mt-0.5">{request.rejectionReason}</p>
              </div>
            </div>
          )}

          {request.status === 'CANCELLED' && (
            <div className="mt-5 bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3">
              <Ban className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cancelled</p>
                <p className="text-sm text-slate-500 mt-0.5">This request was cancelled and is no longer being reviewed.</p>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Status timeline</p>
            <div className="space-y-0">
              {steps.map((step, i) => {
                const Icon = step.icon
                const done = step.done
                const isLast = i === steps.length - 1
                return (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        {done ? <Icon className="w-3.5 h-3.5 text-white" /> : <Circle className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      {!isLast && <div className={`w-0.5 flex-1 min-h-6 ${done ? 'bg-blue-500' : 'bg-slate-200'}`} />}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-semibold ${done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="text-xs text-slate-400">{done ? fmtDate(step.date) : 'Awaiting review'}</p>
                    </div>
                  </div>
                )
              })}

              {request.status !== 'PENDING' && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </p>
                    {request.reviewedBy && (
                      <p className="text-xs text-slate-400">By {request.reviewedBy.name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {request.status === 'PENDING' && (
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
              <p className="text-sm text-slate-500">Changed your mind?</p>
              <CancelRequestButton requestId={request.id} requestTitle={request.title} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
