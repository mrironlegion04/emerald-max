import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, MapPin, CalendarClock,
  Circle, Clock, FileText, AlertTriangle, Users, Building2, Layers,
} from 'lucide-react'
import Badge, { priorityVariant, workOrderStatusVariant } from '@/components/Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import IssueBadge from '@/components/IssueBadge'

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}

export default async function MyWorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const wo = await prisma.workOrder.findFirst({
    where: { id, requestedById: user.userId },
    include: {
      issue: { select: { id: true, code: true, title: true, severity: true } },
      domain: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true, assetCode: true, location: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: 'desc' } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!wo) redirect('/my-work-orders')

  const steps = [
    { label: 'Submitted', done: true, date: wo.createdAt, icon: FileText },
    { label: WO_STATUS_LABELS[wo.status] ?? wo.status, done: wo.status !== 'OPEN', date: wo.updatedAt, icon: Circle },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link href="/my-work-orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to My Work Orders
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {wo.woNumber && (
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{wo.woNumber}</span>
            )}
            <Badge label={WO_STATUS_LABELS[wo.status] ?? wo.status} variant={workOrderStatusVariant(wo.status)} />
            <Badge label={wo.priority} variant={priorityVariant(wo.priority)} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{wo.title}</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-wrap">{wo.description}</p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wo.asset && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Asset</p>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Package className="w-4 h-4 text-blue-600" /> {wo.asset.name}
                  {wo.asset.assetCode && <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded">{wo.asset.assetCode}</span>}
                </p>
                {wo.asset.location?.name && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {wo.asset.location.name}
                  </p>
                )}
              </div>
            )}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
              {wo.locationNameSnapshot && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {wo.locationNameSnapshot}
                </p>
              )}
              {wo.dueDate && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" /> Due by {fmtDate(wo.dueDate)}
                </p>
              )}
              {wo.downtimeStartedAt && (
                <p className="flex items-center gap-2 text-xs text-amber-700">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Down since {fmtDate(wo.downtimeStartedAt)}
                </p>
              )}
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Submitted {fmtDate(wo.createdAt)}
              </p>
              {wo.team && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Team: {wo.team.name}
                </p>
              )}
              {wo.assignedTo && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> Assigned to: {wo.assignedTo.name}
                </p>
              )}
            </div>
          </div>

          {(wo.issue || wo.issueTitleSnapshot) && (
            <div className="mt-5 bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Issue</p>
              <IssueBadge
                code={wo.issue?.code}
                title={wo.issueTitleSnapshot ?? wo.issue?.title}
                severity={wo.issue?.severity}
                showSeverity
              />
            </div>
          )}

          {wo.customIssue && (
            <div className="mt-5 bg-amber-50/60 rounded-xl border border-amber-200 p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Issue (custom)</p>
              <p className="text-sm font-medium text-amber-800">{wo.customIssue}</p>
            </div>
          )}

          {wo.domain && (
            <div className="mt-5 bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-600">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Domain / Nature: {wo.domain.name}
            </div>
          )}

          {wo.attachments.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Photos & attachments</p>
              <div className="flex flex-wrap gap-2">
                {wo.attachments.map(a => (
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

          {wo.status === 'CANCELLED' && (
            <div className="mt-5 bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cancelled</p>
                <p className="text-sm text-slate-500 mt-0.5">This work order was cancelled.</p>
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
                      <p className="text-xs text-slate-400">{done ? fmtDate(step.date) : 'Awaiting progress'}</p>
                    </div>
                  </div>
                )
              })}

              {wo.statusHistory.length > 0 && (
                <div className="mt-2 pt-4 border-t border-slate-100 space-y-2.5">
                  {wo.statusHistory.map(h => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-3 h-3 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {WO_STATUS_LABELS[h.status] ?? h.status}
                          {h.changedByName && <span className="font-normal text-slate-400"> · by {h.changedByName}</span>}
                        </p>
                        {h.notes && <p className="text-xs text-slate-400 mt-0.5">{h.notes}</p>}
                        <p className="text-xs text-slate-400">{fmtDate(h.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
