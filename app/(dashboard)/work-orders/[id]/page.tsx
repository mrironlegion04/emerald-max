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
import WOChecklistPanel from '@/components/WOChecklistPanel'
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
      checklists: {
        include: {
          items: {
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
      attachments:  true,
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-1">
        <Link href="/work-orders" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to work orders
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">
          {scopeLabels[getWOScope(wo)]}
        </span>
        {(wo.assets?.length ?? 0) > 0 && (
          <span className="text-xs text-gray-400">
            {wo.assets.length} asset{wo.assets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <PageHeader
        title={wo.title}
        subtitle={`${wo.woNumber} · ${typeLabels[wo.type] ?? wo.type}`}
        action={
          <div className="flex gap-2">
              <Link href={`/work-orders/${wo.id}/print`} className="btn-secondary text-sm flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Print
              </Link>
              {canEdit && (
                <Link href={`/work-orders/${wo.id}/edit`} className="btn-secondary text-sm">
                  Edit work order
                </Link>
              )}
            </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* Status card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Status</h2>
              <Badge label={statusLabels[wo.status]} variant={workOrderStatusVariant(wo.status)} />
            </div>
            <WOStatusActions
              woId={wo.id}
              currentStatus={wo.status}
              userRole={user?.role ?? 'TECHNICIAN'}
              userId={user?.userId ?? ''}
            />
            {wo.slaBreached && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-semibold text-red-700">⚠️ SLA BREACHED</p>
                <p className="text-xs text-red-600 mt-1">Response or resolution time exceeded</p>
              </div>
            )}
          </div>

          {/* Timer panel */}
          <TimerPanel woId={wo.id} woStatus={wo.status} />

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'WO number',   value: wo.woNumber },
                { label: 'Type',        value: typeLabels[wo.type] },
                { label: 'Priority',    value: (
                  <Badge label={priorityLabels[wo.priority]} variant={priorityVariant(wo.priority)} />
                )},
                { label: 'Asset(s)',       value: wo.assets && wo.assets.length > 1 ? (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {wo.assets.map(wa => (
                      <Link key={wa.asset.id} href={`/assets/${wa.asset.id}`} className="text-blue-600 hover:underline text-xs">
                        {wa.asset.name}
                      </Link>
                    ))}
                  </div>
                ) : wo.asset ? (
                  <Link href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:underline text-xs">
                    {wo.asset.name}
                  </Link>
                ) : '—' },
                { label: 'Location',    value: wo.asset?.location?.name ?? '—' },
                { label: 'Assigned to', value: wo.team ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                    👥 {wo.team.name} ({wo.team.trade})
                  </span>
                ) : wo.assignedTo?.name ? (
                  wo.assignedTo.name
                ) : (
                  'Unassigned'
                )},
                { label: 'Created by',  value: wo.createdBy?.name ?? (wo.createdById === 'system' ? 'System' : '—') },
                { label: 'Created',     value: fmtDateTime(wo.createdAt) },
                { label: 'Due date',    value: (
                  <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                    {isOverdue ? '⚠ ' : ''}{fmtDateTime(wo.dueDate)}
                  </span>
                )},
                { label: 'Started',     value: fmtDateTime(wo.startedAt) },
                { label: 'Completed',   value: fmtDateTime(wo.completedAt) },
                { label: 'Completed by', value: wo.completedBy ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                    ✓ {wo.completedBy.name}
                  </span>
                ) : '—' },
                ...(wo.issue ? [{
                  label: 'Issue',
                  value: (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <code className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{wo.issue.code}</code>
                      <span className="text-xs text-violet-700 font-medium">{wo.issue.title}</span>
                    </span>
                  ),
                }] : wo.customIssue ? [{
                  label: 'Issue',
                  value: (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-amber-700 font-medium">{wo.customIssue}</span>
                    </span>
                  ),
                }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center gap-4">
                  <dt className="text-xs text-gray-400 flex-shrink-0">{row.label}</dt>
                  <dd className="text-xs text-gray-900 font-medium text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Cost summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Cost summary</h2>
            <div className="space-y-2">
              {[
                { label: 'Labor hours', value: wo.laborHours ? `${wo.laborHours} hrs` : '—' },
                { label: 'Labor cost',  value: fmtCurrency(wo.laborCost) },
                { label: 'Parts cost',  value: fmtCurrency(wo.partsCost) },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-900">{r.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total cost</span>
                <span className="font-bold text-gray-900">{fmtCurrency(totalCost || null)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          {wo.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-2">Description</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{wo.description}</p>
            </div>
          )}

          {/* Notes */}
          {wo.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-2">Technician notes</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{wo.notes}</p>
            </div>
          )}

          {/* Parts used */}
          <WOPartsPanel
            woId={wo.id}
            partsUsed={wo.partsUsed.map(p => ({
              id: p.id,
              partId: p.partId,
              name: p.part.name,
              partNumber: p.part.partNumber,
              quantity: p.quantity,
              unitCost: p.unitCost ?? p.part.unitCost ?? 0,
            }))}
            allParts={allParts.map(p => ({
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
            initialSubtasks={wo.subtasks.map(s => ({
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
            allUsers={allUsers.map(u => ({ id: u.id, name: u.name, email: u.email }))}
            allTeams={allTeams.map(t => ({ id: t.id, name: t.name, trade: t.trade }))}
            canEdit={canEdit || user?.role === 'TECHNICIAN'}
          />
          <WOChecklistPanel
            woId={wo.id}
            initialChecklists={wo.checklists.map(c => ({
              id: c.id,
              title: c.title,
              items: c.items.map(i => ({
                id: i.id,
                label: i.label,
                type: i.type,
                isChecked: i.isChecked,
                isMandatory: i.isMandatory,
                stringValue: i.stringValue,
                options: i.options,
                checkedAt: i.checkedAt ? i.checkedAt.toISOString() : null,
                checkedBy: i.checkedBy,
                sortOrder: i.sortOrder,
                assetId: i.assetId,
                asset: i.asset ? {
                  id: i.asset.id,
                  name: i.asset.name,
                  parentId: i.asset.parentId,
                  location: i.asset.location ? {
                    id: i.asset.location.id,
                    name: i.asset.location.name,
                    parentId: i.asset.location.parentId,
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
            attachments={wo.attachments}
            entityType="workOrder"
            entityId={wo.id}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  )
}
