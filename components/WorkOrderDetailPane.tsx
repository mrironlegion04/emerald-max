'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import Badge, { workOrderStatusVariant, priorityVariant } from './Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import WOStatusActions from './WOStatusActions'
import WOPartsPanel from './WOPartsPanel'
import WOCommentsPanel from './WOCommentsPanel'
import WOHistoryPanel from './WOHistoryPanel'
import SubtasksPanel from './SubtasksPanel'
import AttachmentsPanel from './AttachmentsPanel'
import WorkOrderCrewPanel from './WorkOrderCrewPanel'
import { fmtCurrency, fmt, fmtDateTime } from '@/lib/utils'
import { isOverdueByDate, todayLocal, fmtScheduledTime } from '@/lib/date-format'

interface Props {
  woId?: string
  subtaskId?: string
  onLoadingChange?: (loading: boolean) => void
  userRole?: string
  userId?: string
}

const statusLabels = WO_STATUS_LABELS
const typeLabels: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}
const priorityLabels: Record<string, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
}

export default function WorkOrderDetailPane({ woId, onLoadingChange, userRole = 'TECHNICIAN', userId = '' }: Props) {
  const [wo, setWo] = useState<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!woId) return
    let cancelled = false
    onLoadingChange?.(true)
    fetch(`/api/work-orders/${woId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => { if (!cancelled) { setWo(data); setLoaded(true); onLoadingChange?.(false) } })
      .catch(() => { if (!cancelled) { setError('Failed to load work order'); setLoaded(true); onLoadingChange?.(false) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woId, reloadKey])

  if (!woId) return null

  if (!loaded && !error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !wo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-500">{error || 'Work order not found'}</p>
        </div>
      </div>
    )
  }

  const isOverdue = wo.dueDate && isOverdueByDate(wo.dueDate, todayLocal()) && !['COMPLETED', 'CANCELLED'].includes(wo.status)
  const dueTimeLabel = wo.dueTime ? fmtScheduledTime(wo.dueTime) : null
  const startTimeLabel = wo.startTime ? fmtScheduledTime(wo.startTime) : null
  const lostHours = wo.downtimeStartedAt && wo.downtimeEndedAt
    ? (new Date(wo.downtimeEndedAt).getTime() - new Date(wo.downtimeStartedAt).getTime()) / 3600000
    : null
  const fmtLost = lostHours !== null && lostHours > 0
    ? (lostHours % 1 === 0 ? lostHours.toFixed(0) : lostHours.toFixed(2))
    : null
  const totalCost = (wo.laborCost ?? 0) + (wo.partsCost ?? 0)
  const viewer = wo.viewer ?? {}
  const canEdit = viewer.canEdit ?? false
  const lastHoldAt = (wo.repairSessions ?? [])
    .filter((s: { completedAt: string | null }) => s.completedAt)
    .at(-1)?.completedAt ?? null
  const canComplete = viewer.canComplete ?? false
  const canUploadAttachment = viewer.canUploadAttachment ?? false

  return (
    <div className="p-5 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-400 font-bold">{wo.woNumber}</span>
            <Badge label={statusLabels[wo.status]} variant={workOrderStatusVariant(wo.status)} />
            <Badge label={priorityLabels[wo.priority]} variant={priorityVariant(wo.priority)} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{wo.title}</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">
            {typeLabels[wo.type] ?? wo.type}
          </p>
        </div>
        <Link
          href={`/work-orders/${wo.id}`}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/60 rounded-xl transition-all"
          title="Open full work order page"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </Link>
      </div>

      {/* Status Actions */}
      <div className="premium-card p-4 border border-slate-200/50 shadow-sm">
        <h3 className="font-bold text-slate-700 text-xs tracking-tight mb-3">Status Actions</h3>
        <WOStatusActions
          woId={wo.id}
          currentStatus={wo.status}
          userRole={userRole}
          userId={userId}
          canCloseWO={viewer.canCloseWO ?? false}
          requestedCompletionTime={wo.requestedCompletionTime ?? null}
          requestedCompletionNotes={wo.requestedCompletionNotes ?? null}
          initialStartAt={wo.startedAt ?? null}
          initialHoldAt={lastHoldAt}
          initialLaborHours={wo.laborHours ?? null}
          initialLaborCost={wo.laborCost ?? null}
          initialDowntimeStartedAt={wo.downtimeStartedAt ?? null}
          initialDowntimeEndedAt={wo.downtimeEndedAt ?? null}
          initialCategoryId={wo.woCategoryId ?? null}
          initialNotes={wo.notes ?? null}
          onStatusChanged={() => setReloadKey(k => k + 1)}
        />
      </div>

      {/* Details */}
      <div className="premium-card p-4 border border-slate-200/50 shadow-sm bg-white">
        <h3 className="font-bold text-slate-700 text-xs tracking-tight mb-3 pb-2 border-b border-slate-100">Details</h3>
        <dl className="space-y-3">
          {[
            { label: 'Type', value: typeLabels[wo.type] },
            { label: 'Priority', value: <Badge label={priorityLabels[wo.priority]} variant={priorityVariant(wo.priority)} /> },
            { label: 'Asset', value: wo.asset ? (
              <Link href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-bold">{wo.assetNameSnapshot ?? wo.asset.name}</Link>
            ) : wo.assets?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {wo.assets.map((wa: any) => (
                  <Link key={wa.asset.id} href={`/assets/${wa.asset.id}`} className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-bold">{wa.asset.name}</Link>
                ))}
              </div>
            ) : '—' },
            { label: 'Location', value: wo.locationNameSnapshot ?? wo.location?.name ?? wo.asset?.location?.name ?? '—' },
            { label: 'Domain / Nature', value: (wo.domainNameSnapshot ?? wo.domain) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">◎ {wo.domainNameSnapshot ?? wo.domain?.name}</span>
            ) : '—' },
            { label: 'Assigned to', value: wo.assignedTo?.name ? (
              <span className="text-xs font-bold">{wo.assignedTo.name}</span>
            ) : wo.team?.name ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">👥 {wo.team.name}</span>
            ) : (
              <span className="text-slate-400 italic text-xs">Unassigned</span>
            )},
            { label: 'Created by', value: wo.createdBy?.name ?? '—' },
            { label: 'Start date', value: wo.startDate ? (
              <span className="text-xs">
                {fmt(wo.startDate)}
                {startTimeLabel && <span className="text-slate-400 font-medium"> · Scheduled {startTimeLabel}</span>}
              </span>
            ) : '—' },
            { label: 'Due date', value: (
              <span className={isOverdue ? 'text-rose-600 font-bold text-xs' : 'text-xs'}>
                {isOverdue ? '⚠ ' : ''}{fmt(wo.dueDate)}
                {dueTimeLabel && <span className="text-slate-400 font-medium"> · Scheduled {dueTimeLabel}</span>}
              </span>
            )},
            { label: 'Completed', value: fmtDateTime(wo.completedAt) },
            ...(wo.downtimeStartedAt ? [
              { label: 'Down since', value: fmtDateTime(wo.downtimeStartedAt) },
              ...(wo.downtimeEndedAt ? [
                { label: 'Back up at', value: fmtDateTime(wo.downtimeEndedAt) },
                { label: 'Lost hours', value: fmtLost !== null ? <span className={(lostHours ?? 0) > 0 ? 'text-rose-600' : ''}>{fmtLost} {fmtLost === '1' ? 'hr' : 'hrs'}</span> : '—' },
              ] : [
                { label: 'Lost hours', value: <span className="text-slate-400 italic">still down</span> },
              ]),
            ] : []),
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center gap-3">
              <dt className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{row.label}</dt>
              <dd className="text-xs text-slate-800 font-bold text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Worked by — recorded crew (survives team membership changes) */}
      <WorkOrderCrewPanel
        woId={wo.id}
        canEdit={canEdit}
        onChanged={() => setReloadKey(k => k + 1)}
      />

      {/* Cost */}
      {(wo.laborHours || wo.partsCost) && (
        <div className="premium-card p-4 border border-slate-200/50 shadow-sm bg-white">
          <h3 className="font-bold text-slate-700 text-xs tracking-tight mb-3 pb-2 border-b border-slate-100">Cost Summary</h3>
          <div className="space-y-2">
            {wo.laborHours && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Labor hours</span>
                <span className="font-bold text-slate-700">{wo.laborHours} hrs</span>
              </div>
            )}
            {wo.laborCost > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Labor cost</span>
                <span className="font-bold text-slate-700">{fmtCurrency(wo.laborCost)}</span>
              </div>
            )}
            {wo.partsCost > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Parts cost</span>
                <span className="font-bold text-slate-700">{fmtCurrency(wo.partsCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t border-slate-100 pt-2">
              <span className="font-bold text-slate-600">Total</span>
              <span className="font-extrabold text-slate-900">{fmtCurrency(totalCost || null)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {wo.description && (
        <div className="premium-card p-4 border border-slate-200/50 shadow-sm bg-white">
          <h3 className="font-bold text-slate-700 text-xs tracking-tight mb-2">Description</h3>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{wo.description}</p>
        </div>
      )}

      {/* Notes */}
      {wo.notes && (
        <div className="premium-card p-4 border border-slate-200/50 shadow-sm bg-white">
          <h3 className="font-bold text-slate-700 text-xs tracking-tight mb-2">Final Actions</h3>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{wo.notes}</p>
        </div>
      )}

      {/* Parts */}
      <WOPartsPanel
        woId={wo.id}
        partsUsed={(wo.partsUsed ?? []).map((p: any) => ({
          id: p.id, partId: p.partId, name: p.part.name,
          partNumber: p.part.partNumber, quantity: p.quantity,
          unitCost: p.unitCost ?? p.part.unitCost ?? 0,
        }))}
        allParts={[]}
        canEdit={canEdit}
        woStatus={wo.status}
        suggestedPartIds={wo.asset?.assetParts?.map((ap: any) => ap.partId) || []}
      />

      {/* Subtasks */}
      <SubtasksPanel
        woId={wo.id}
        initialSubtasks={(wo.subtasks ?? []).map((s: any) => ({
          id: s.id, title: s.title, description: s.description,
          status: s.status, priority: s.priority,
          dueDate: s.dueDate ? new Date(s.dueDate).toISOString() : null,
          completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
          completionType: s.completionType ?? null,
          required: s.required ?? true,
          createdAt: new Date(s.createdAt).toISOString(),
          workOrderId: s.workOrderId,
          assignedTo: s.assignedTo, assignedDomain: s.assignedDomain,
          assignedTeam: s.assignedTeam,
          completedBy: s.completedBy, createdBy: s.createdBy,
        }))}
        woStatus={wo.status}
        allUsers={[]}
        allTeams={[]}
        canEdit={canEdit || canComplete}
        currentUserId={userId}
        isManagerOrAbove={userRole === 'ADMIN' || userRole === 'MANAGER'}
      />

      {/* Comments */}
      <WOCommentsPanel woId={wo.id} woStatus={wo.status} />

      {/* Activity / History */}
      <WOHistoryPanel woId={wo.id} />

      {/* Attachments */}
      <AttachmentsPanel
        attachments={(wo.attachments ?? []).map((a: any) => ({
          ...a, uploadedBy: a.uploadedBy?.name || null,
        }))}
        entityType="workOrder"
        entityId={wo.id}
        canEdit={canUploadAttachment}
      />
    </div>
  )
}
