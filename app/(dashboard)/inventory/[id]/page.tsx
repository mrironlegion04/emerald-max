export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import DeletePartButton from '@/components/DeletePartButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import RestorePartButton from '@/components/RestorePartButton'
import PartQRButton from '@/components/PartQRButton'

function fmtCurrency(v: number | null) {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
}
function fmt(date: Date | string | null) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}



const woStatusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const woStatusLabels: Record<string,string> = {
  OPEN:'Open', IN_PROGRESS:'In Progress', ON_HOLD:'On Hold', COMPLETED:'Completed', CANCELLED:'Cancelled',
}

export default async function PartDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user    = await getCurrentUser()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      attachments: true,
      usedInWorkOrders: {
        include: {
          workOrder: {
            select: {
              id: true, woNumber: true, title: true, status: true,
              completedAt: true, asset: { select: { name: true } },
            },
          },
        },
        orderBy: { workOrder: { createdAt: 'desc' } },
      },
    },
  })

  if (!part) notFound()

  const totalUsed   = part.usedInWorkOrders.reduce((s: number, u: any) => s + u.quantity, 0)
  const totalSpend  = part.usedInWorkOrders.reduce((s: number, u: any) => s + u.quantity * (u.unitCost ?? part.unitCost ?? 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-1">
        <Link href="/inventory" className="text-sm text-gray-400 hover:text-gray-600">← Back to inventory</Link>
      </div>

      {/* Deleted banner */}
      {part.isDeleted && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">This part has been archived</p>
            <p className="text-xs text-red-600 mt-0.5">
              Archived on {part.deletedAt ? new Date(part.deletedAt).toLocaleDateString() : 'Unknown date'}
              {' '}— it is hidden from active views but all usage history is preserved.
            </p>
          </div>
          <RestorePartButton partId={part.id} />
        </div>
      )}

      <PageHeader
        title={part.name}
        subtitle={part.partNumber}
        action={
          <div className="flex gap-2">
            <PartQRButton partId={part.id} partNumber={part.partNumber} partName={part.name} />
            {canEdit && !part.isDeleted && (
              <Link href={`/inventory/${part.id}/edit`} className="btn-secondary text-sm">Edit part</Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Pricing & Spend details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Pricing</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Unit cost</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtCurrency(part.unitCost)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Total spend</p>
                <p className="text-sm font-bold text-purple-700 mt-0.5">{fmtCurrency(totalSpend)}</p>
              </div>
            </div>
          </div>

          {/* Part details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Part details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Part number', value: part.partNumber },
                { label: 'Unit',        value: part.unit },
                { label: 'Added',       value: fmt(part.createdAt) },
                { label: 'Created by',  value: part.createdBy?.name },
                { label: 'Last updated',value: fmt(part.updatedAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt className="text-xs text-gray-400">{row.label}</dt>
                  <dd className="text-xs text-gray-900 font-medium text-right">{row.value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Description */}
          {part.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-2">Description</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{part.description}</p>
            </div>
          )}

          {/* Usage summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Usage summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total used</span>
                <span className="font-medium text-gray-900">{totalUsed} {part.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Work orders</span>
                <span className="font-medium text-gray-900">{part.usedInWorkOrders.length}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="font-semibold text-gray-700">Total spend</span>
                <span className="font-bold text-gray-900">{fmtCurrency(totalSpend)}</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          {canEdit && !part.isDeleted && (
            <div className="bg-white rounded-xl border border-red-100 p-5">
              <h2 className="font-semibold text-red-700 text-sm mb-2">Danger zone</h2>
              <p className="text-xs text-gray-500 mb-3">
                Archiving this part will hide it from selection lists. Work order history is preserved.
              </p>
              <DeletePartButton partId={part.id} partName={part.name} />
            </div>
          )}
        </div>

        {/* Right: attachments and usage history */}
        <div className="lg:col-span-2 space-y-5">
          <AttachmentsPanel
            attachments={part.attachments}
            entityType="part"
            entityId={part.id}
            canEdit={canEdit}
          />

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">
                Usage history
                <span className="ml-2 text-gray-400 font-normal">({part.usedInWorkOrders.length})</span>
              </h2>
            </div>
            {part.usedInWorkOrders.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                This part hasn't been used in any work orders yet
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {part.usedInWorkOrders.map((use: any) => (
                  <Link key={use.id} href={`/work-orders/${use.workOrder.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{use.workOrder.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {use.workOrder.woNumber}
                        {use.workOrder.asset?.name ? ` · ${use.workOrder.asset.name}` : ''}
                        {use.workOrder.completedAt ? ` · Completed ${fmt(use.workOrder.completedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {use.quantity} {part.unit}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmtCurrency(use.quantity * (use.unitCost ?? part.unitCost ?? 0))}
                        </p>
                      </div>
                      <span className={`badge text-xs ${woStatusColors[use.workOrder.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {woStatusLabels[use.workOrder.status] ?? use.workOrder.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
