import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Printer } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Badge, { workOrderStatusVariant, priorityVariant } from '@/components/Badge'
import WOStatusActions from '@/components/WOStatusActions'
import WOPartsPanel from '@/components/WOPartsPanel'
import WOCommentsPanel from '@/components/WOCommentsPanel'
import WOProceduresPanel from '@/components/WOProceduresPanel'
import SubtasksPanel from '@/components/SubtasksPanel'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import TimerPanel from '@/components/TimerPanel'
import { fmt, fmtCurrency, fmtDateTime } from '@/lib/utils'

const statusLabels: Record<string,string> = {
  OPEN:'Open', IN_PROGRESS:'In Progress', ON_HOLD:'On Hold', COMPLETED:'Completed', CANCELLED:'Cancelled',
}
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
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      asset:        { select: { id: true, name: true, assetCode: true, location: { select: { name: true } }, assetParts: { select: { partId: true } } } },
      assets:       { include: { asset: { select: { id: true, name: true, assetCode: true } } } },
      location:     { select: { id: true, name: true, address: true } },
      assignedTo:   { select: { id: true, name: true, email: true } },
      team:         { select: { id: true, name: true, trade: true } },
      createdBy:    { select: { name: true } },
      completedBy:  { select: { id: true, name: true, email: true } },
      issue:        true,
      partsUsed:    { include: { part: { select: { id: true, name: true, partNumber: true, unitCost: true } } } },
      subtasks:     { include: { assignedTo: { select: { id: true, name: true, email: true } }, assignedTeam: { select: { id: true, name: true, trade: true } }, completedBy: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      procedures: {
        include: {
          steps: {
            include: {
              asset: {
                include: {
                  location: true
                }
              }
            }
          }
        }
      },
      attachments:  { include: { uploadedBy: { select: { name: true } } } },
    },
  })

  if (!wo) notFound()

  const allParts = await prisma.part.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
  const allUsers = await prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  const allTeams = await prisma.team.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } })
  const allLocations = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } })

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
              {canEdit && (
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
            />
            {wo.slaBreached && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-150 rounded-xl">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">⚠️ SLA BREACHED</p>
                <p className="text-xs text-rose-600 mt-1 font-medium leading-relaxed">Response or resolution time exceeded.</p>
              </div>
            )}
          </div>

          {/* Timer panel */}
          <TimerPanel woId={wo.id} woStatus={wo.status} />

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
                { label: 'Assigned to', value: wo.team ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[10px] font-bold">
                    👥 {wo.team.name} ({wo.team.trade})
                  </span>
                ) : wo.assignedTo?.name ? (
                  wo.assignedTo.name
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )},
                { label: 'Created by',  value: wo.createdBy?.name ?? (wo.createdById === 'system' ? 'System' : '—') },
                { label: 'Created',     value: fmtDateTime(wo.createdAt) },
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
                ...(wo.issue ? [{
                  label: 'Issue',
                  value: (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <code className="text-[10px] font-bold font-mono bg-slate-105 border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded">{wo.issue.code}</code>
                      <span className="text-xs text-violet-750 font-bold">{wo.issue.title}</span>
                    </span>
                  ),
                }] : wo.customIssue ? [{
                  label: 'Issue',
                  value: (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-amber-705 font-bold">{wo.customIssue}</span>
                    </span>
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
              createdAt: s.createdAt.toISOString(),
              workOrderId: s.workOrderId,
              assignedTo: s.assignedTo,
              assignedTeam: s.assignedTeam,
              completedBy: s.completedBy,
              createdBy: s.createdBy,
            }))}
            woStatus={wo.status}
            allUsers={allUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))}
            allTeams={allTeams.map((t: any) => ({ id: t.id, name: t.name, trade: t.trade }))}
            canEdit={canEdit || user?.role === 'TECHNICIAN'}
          />
          <WOProceduresPanel
            woId={wo.id}
            initialProcedures={wo.procedures.map((c: any) => ({
              id: c.id,
              title: c.title,
              source: c.source,
              steps: c.steps.map((s: any) => ({
                id: s.id,
                label: s.label,
                type: s.type,
                isChecked: s.isChecked,
                isMandatory: s.isMandatory,
                stringValue: s.stringValue,
                options: s.options,
                checkedAt: s.checkedAt ? s.checkedAt.toISOString() : null,
                checkedBy: s.checkedBy,
                sortOrder: s.sortOrder,
                assetId: s.assetId,
                settings: s.settings,
                logic: s.logic,
                asset: s.asset ? {
                  id: s.asset.id,
                  name: s.asset.name,
                  parentId: s.asset.parentId,
                  location: s.asset.location ? {
                    id: s.asset.location.id,
                    name: s.asset.location.name,
                    parentId: s.asset.location.parentId,
                  } : null
                } : null
              })),
            }))
            }
            woStatus={wo.status}
            locations={allLocations}
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
