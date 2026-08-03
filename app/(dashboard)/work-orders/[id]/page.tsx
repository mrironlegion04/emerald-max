import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Printer, Download } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Badge, { workOrderStatusVariant, priorityVariant } from '@/components/Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import WOStatusActions from '@/components/WOStatusActions'
import WOPartsPanel from '@/components/WOPartsPanel'
import WOCommentsPanel from '@/components/WOCommentsPanel'
import WOHistoryPanel from '@/components/WOHistoryPanel'
import SubtasksPanel from '@/components/SubtasksPanel'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import SkipPMButton from '@/components/SkipPMButton'
import WorkOrderCrewPanel from '@/components/WorkOrderCrewPanel'
import IssueBadge from '@/components/IssueBadge'
import { canEditWorkOrder, canViewWorkOrder, getUserLocationIds } from '@/lib/access-control'
import { fmt, fmtCurrency, fmtDateTime } from '@/lib/utils'

const statusLabels = WO_STATUS_LABELS
const typeLabels: Record<string,string> = {
  BREAKDOWN:'Breakdown', PREVENTIVE:'Preventive', PREDICTIVE:'Predictive',
}
const priorityLabels: Record<string,string> = {
  LOW:'Low', MEDIUM:'Medium', HIGH:'High', CRITICAL:'Critical',
}
const scopeLabels: Record<string,string> = {
  SINGLE_ASSET:'Single Asset', MULTI_ASSET:'Multi-Asset',
  LOCATION_GENERAL:'Location General', LOCATION_ALL_ASSETS:'Location All Assets',
}

function getWOScope(wo: {
  locationScope: string | null; assetId: string | null; assets: { assetId: string }[]
}): 'SINGLE_ASSET' | 'MULTI_ASSET' | 'LOCATION_GENERAL' | 'LOCATION_ALL_ASSETS' {
  if (wo.locationScope === 'GENERAL') return 'LOCATION_GENERAL'
  if (wo.locationScope === 'ALL_ASSETS') return 'LOCATION_ALL_ASSETS'
  if ((wo.assets?.length ?? 0) > 1) return 'MULTI_ASSET'
  return 'SINGLE_ASSET'
}

export default async function WorkOrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      asset:        { select: { id: true, name: true, assetCode: true, location: { select: { name: true } }, assetParts: { select: { partId: true } } } },
      assets:       { include: { asset: { select: { id: true, name: true, assetCode: true } } } },
      location:     { select: { id: true, name: true, address: true } },
      assignedTo:   { select: { id: true, name: true, email: true } },
      domain:       { select: { id: true, name: true } },
      createdBy:    { select: { name: true } },
      completedBy:  { select: { id: true, name: true, email: true } },
      issue:        true,
      partsUsed:    { include: { part: { select: { id: true, name: true, partNumber: true, unitCost: true } } } },
      subtasks:     { include: { assignedTo: { select: { id: true, name: true, email: true } }, assignedDomain: { select: { id: true, name: true } }, assignedTeam: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      attachments:  { include: { uploadedBy: { select: { name: true } } } },
      repairSessions: { orderBy: { sessionNo: 'asc' } },
      maintenanceSchedule: { select: { id: true, title: true } },
    },
  })

  if (!wo) notFound()

  // Plant isolation: page-level view guard (cross-plant WOs render as 404)
  if (user && !(await canViewWorkOrder(user, wo.id)).allowed) notFound()

  const crewCanEdit = user ? (await canEditWorkOrder(user, wo.id)).allowed : false
  const canEdit = crewCanEdit

  const allParts = await prisma.part.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
  const allowedIds = user ? await getUserLocationIds(user.userId) : null
  const allUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(allowedIds
        ? { OR: [{ userLocations: { some: { locationId: { in: allowedIds } } } }, { role: 'ADMIN' }] }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
  const allDomains = await prisma.maintenanceDomain.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  const allTeams = await prisma.team.findMany({
    where: {
      isActive: true,
      ...(allowedIds
        ? { members: { some: { user: { userLocations: { some: { locationId: { in: allowedIds } } } } } } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const isOverdue =
    wo.dueDate && new Date(wo.dueDate) < new Date() &&
    !['COMPLETED','CANCELLED'].includes(wo.status)

  const totalCost = (wo.laborCost ?? 0) + (wo.partsCost ?? 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <Link href="/work-orders" className="text-xs font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1.5 uppercase tracking-wider">
          ← Back to work orders
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            {scopeLabels[getWOScope(wo)]}
          </span>
          {(wo.assets?.length ?? 0) > 0 && (
            <span className="text-[11px] text-slate-400 font-semibold tracking-tight">
              {wo.assets.length} asset{wo.assets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <PageHeader
          title={wo.title}
          subtitle={`${wo.woNumber} · ${typeLabels[wo.type] ?? wo.type}`}
          action={
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <Link href={`/work-orders/${wo.id}/print`} className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 border-slate-200 font-bold hover:bg-slate-50 transition shadow-xs">
                <Printer className="w-4 h-4 text-slate-500" />
                Print
              </Link>
              <a href={`/api/work-orders/${wo.id}/pdf`} download className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 border-slate-200 font-bold hover:bg-slate-50 transition shadow-xs">
                <Download className="w-4 h-4 text-slate-500" />
                PDF
              </a>
              {canEdit && wo.status !== 'CLOSED' && (
                <Link href={`/work-orders/${wo.id}/edit`} className="btn-secondary text-xs py-2 px-3.5 border-slate-200 font-bold hover:bg-slate-50 transition shadow-xs">
                  Edit work order
                </Link>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="premium-card p-5 border border-slate-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-805 text-sm tracking-tight">Status</h2>
              <Badge label={statusLabels[wo.status]} variant={workOrderStatusVariant(wo.status)} />
            </div>
            <WOStatusActions
              woId={wo.id}
              currentStatus={wo.status}
              userRole={user?.role ?? 'TECHNICIAN'}
              userId={user?.userId ?? ''}
              requestedCompletionTime={wo.requestedCompletionTime?.toISOString() ?? null}
              requestedCompletionNotes={wo.requestedCompletionNotes ?? null}
              initialStartAt={wo.startedAt?.toISOString() ?? null}
              initialLaborHours={wo.laborHours}
              initialLaborCost={wo.laborCost}
            />
            <SkipPMButton
              woId={wo.id}
              currentStatus={wo.status}
              isPmGenerated={!!wo.maintenanceScheduleId}
              userRole={user?.role ?? 'TECHNICIAN'}
              userId={user?.userId ?? ''}
              assignedToId={wo.assignedToId}
            />
          </div>

          {/* Repair Sessions */}
          {(wo.repairSessions as any[]).length > 0 && (
            <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
              <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-4 pb-2 border-b border-slate-100">
                Repair Sessions
                <span className="ml-2 text-slate-400 font-normal font-normal">({(wo.repairSessions as any[]).length})</span>
              </h2>
              <div className="space-y-2">
                {(wo.repairSessions as any[]).map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                        #{session.sessionNo}
                      </span>
                      <div className="text-xs text-slate-700">
                        <span className="font-medium">
                          {new Date(session.startedAt).toLocaleDateString()}{' '}
                          {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {session.completedAt && (
                          <>
                            <span className="text-slate-400 mx-1">&rarr;</span>
                            <span className="font-medium">
                              {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                        {!session.completedAt && (
                          <span className="text-amber-600 ml-1 font-semibold">in progress</span>
                        )}
                      </div>
                    </div>
                    {session.durationMinutes != null && (
                      <span className="text-xs font-bold text-slate-600">
                        {Math.floor(session.durationMinutes / 60)}h {session.durationMinutes % 60}m
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
            <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-4 pb-2 border-b border-slate-100">Details</h2>
            <dl className="space-y-3.5">
              {[
                { label: 'WO number',   value: <span className="font-mono text-xs">{wo.woNumber}</span> },
                { label: 'Type',        value: typeLabels[wo.type] },
                { label: 'Priority',    value: (
                  <Badge label={priorityLabels[wo.priority]} variant={priorityVariant(wo.priority)} />
                )},
                { label: 'Asset(s)',       value: wo.assets && wo.assets.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {wo.assets.map((wa: any) => (
                      <Link key={wa.asset.id} href={`/assets/${wa.asset.id}`} className="text-blue-600 hover:text-blue-805 hover:underline text-xs font-bold">
                        {wa.asset.name}
                      </Link>
                    ))}
                  </div>
                ) : wo.asset ? (
                  <Link href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:text-blue-850 hover:underline text-xs font-bold">
                    {wo.asset.name}
                  </Link>
                ) : '—' },
                { label: 'Location',    value: wo.asset?.location?.name ?? '—' },
                { label: 'Assigned to', value: wo.domain ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">
                    👥 {wo.domain.name}
                  </span>
                ) : wo.assignedTo?.name ? (
                  wo.assignedTo.name
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )},
                { label: 'Created by',  value: wo.createdBy?.name ?? (wo.createdById === 'system' ? 'System' : '—') },
                { label: 'Created',     value: fmtDateTime(wo.createdAt) },
                { label: 'Start date',  value: fmtDateTime(wo.startDate) },
                { label: 'Due date',    value: (
                  <span className={isOverdue ? 'text-rose-650 font-bold' : ''}>
                    {isOverdue ? '⚠ ' : ''}{fmtDateTime(wo.dueDate)}
                  </span>
                )},
                { label: 'Started',     value: fmtDateTime(wo.startedAt) },
                { label: 'Completed',   value: fmtDateTime(wo.completedAt) },
                { label: 'Completed by', value: wo.completedBy ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">
                    ✓ {wo.completedBy.name}
                  </span>
                ) : '—' },
                ...(wo.issue || wo.customIssue ? [{
                  label: 'Issue',
                  value: (
                    <IssueBadge
                      code={wo.issue?.code}
                      title={wo.issue?.title}
                      severity={wo.issue?.severity}
                      customIssue={wo.customIssue}
                      showSeverity
                    />
                  ),
                }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center gap-4">
                  <dt className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{row.label}</dt>
                  <dd className="text-xs text-slate-800 font-bold text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Worked by — recorded crew (survives team membership changes) */}
          <WorkOrderCrewPanel woId={wo.id} canEdit={crewCanEdit} />

          {/* Custom Fields */}
          {wo.customFields && typeof wo.customFields === 'object' && Object.keys(wo.customFields as Record<string, any>).length > 0 && (
            <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
              <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-4 pb-2 border-b border-slate-100">Custom fields</h2>
              <dl className="space-y-3">
                {Object.entries(wo.customFields as Record<string, any>).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center gap-4">
                    <dt className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{key}</dt>
                    <dd className="text-xs text-slate-800 font-bold text-right">
                      {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Cost summary */}
          <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
            <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-3 pb-2 border-b border-slate-100">Cost summary</h2>
            <div className="space-y-3.5">
              {[
                { label: 'Labor hours', value: wo.laborHours ? `${wo.laborHours} hrs` : '—' },
                { label: 'Labor cost',  value: fmtCurrency(wo.laborCost) },
                { label: 'Parts cost',  value: fmtCurrency(wo.partsCost) },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-semibold uppercase tracking-wider">{r.label}</span>
                  <span className="font-bold text-slate-750">{r.value}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3.5 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-650 uppercase tracking-wide">Total cost</span>
                <span className="text-sm font-extrabold text-slate-900">{fmtCurrency(totalCost || null)}</span>
              </div>
            </div>
          </div>

          {/* Activity / History (system audit trail) */}
          <WOHistoryPanel woId={wo.id} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {wo.description && (
            <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
              <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-2 pb-2 border-b border-slate-100">Description</h2>
              <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">{wo.description}</p>
            </div>
          )}

          {/* Notes */}
          {wo.notes && (
            <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
              <h2 className="font-bold text-slate-805 text-sm tracking-tight mb-2 pb-2 border-b border-slate-100">Technician notes</h2>
              <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">{wo.notes}</p>
            </div>
          )}

          {/* Parts used */}
          <WOPartsPanel
            woId={wo.id}
            partsUsed={wo.partsUsed.map((p: any) => ({
              id: p.id,
              partId: p.partId,
              name: p.part.name,
              partNumber: p.part.partNumber,
              quantity: p.quantity,
              unitCost: p.unitCost ?? p.part.unitCost ?? 0,
            }))}
            allParts={allParts.map((p: any) => ({
              id: p.id,
              name: p.name,
              partNumber: p.partNumber,
              unitCost: p.unitCost ?? 0,
            }))}
            canEdit={canEdit || user?.role === 'TECHNICIAN'}
            woStatus={wo.status}
            suggestedPartIds={wo.asset?.assetParts.map((ap: { partId: string }) => ap.partId) || []}
          />
          <SubtasksPanel
            woId={wo.id}
            initialSubtasks={wo.subtasks.map((s: any) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              status: s.status,
              priority: s.priority,
              dueDate: s.dueDate ? s.dueDate.toISOString() : null,
              completedAt: s.completedAt ? s.completedAt.toISOString() : null,
              completionType: s.completionType ?? null,
              required: s.required ?? true,
              createdAt: s.createdAt.toISOString(),
              workOrderId: s.workOrderId,
              assignedTo: s.assignedTo,
              assignedDomain: s.assignedDomain,
              assignedTeam: s.assignedTeam,
              completedBy: s.completedBy,
              createdBy: s.createdBy,
            }))}
            woStatus={wo.status}
            allUsers={allUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))}
            allTeams={allTeams.map((t: any) => ({ id: t.id, name: t.name }))}
            canEdit={canEdit || user?.role === 'TECHNICIAN'}
            currentUserId={user?.userId}
            isManagerOrAbove={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          />
          <WOCommentsPanel woId={wo.id} woStatus={wo.status} />
          <AttachmentsPanel
            attachments={wo.attachments.map((a: any) => ({
              ...a,
              uploadedBy: a.uploadedBy?.name || null,
            }))}
            entityType="workOrder"
            entityId={wo.id}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  )
}
