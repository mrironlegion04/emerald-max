import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/PrintButton'
import { fmtCurrency, fmtDateTime } from '@/lib/utils'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'
import { RESOLUTION_LABELS } from '@/lib/work-order-resolution'
import { canViewWorkOrder } from '@/lib/access-control'
import { isOverdueByDate, todayUTC, fmtScheduledTime, utcDateOnly, fmtDateOnly } from '@/lib/date-format'

const typeLabels: Record<string, string> = {
  BREAKDOWN: 'Breakdown', PREVENTIVE: 'Preventive', PREDICTIVE: 'Predictive',
}
const priorityLabels: Record<string, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
}
const statusLabels = WO_STATUS_LABELS
const resolutionLabels = RESOLUTION_LABELS

export default async function WorkOrderPrintPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, name: true, assetCode: true, serialNumber: true, location: { select: { name: true } } } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { name: true } },
      partsUsed: { include: { part: { select: { id: true, name: true, partNumber: true, unitCost: true } } } },
      attachments: { include: { uploadedBy: { select: { name: true } } } },

      repairSessions: { orderBy: { sessionNo: 'asc' } },
    },
  })

  if (!wo) notFound()

  // Plant isolation: cross-plant WOs render as 404 on the print view too
  if (user && !(await canViewWorkOrder(user, wo.id)).allowed) notFound()

  const totalCost = Number(wo.laborCost ?? 0) + Number(wo.partsCost ?? 0)
  const isOverdue =
    wo.dueDate && isOverdueByDate(wo.dueDate, todayUTC()) &&
    !['COMPLETED', 'CANCELLED'].includes(wo.status)

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-white">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
        }
      `}</style>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Work Order</h1>
        <p className="text-gray-600 text-lg mt-2">{wo.woNumber}</p>
      </div>

      {/* Header section */}
      <div className="grid grid-cols-4 gap-6 mb-8 pb-8 border-b border-gray-300">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</h3>
          <p className="text-lg font-bold text-gray-900">{statusLabels[wo.status]}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Priority</h3>
          <p className="text-lg font-bold text-gray-900">{priorityLabels[wo.priority]}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Type</h3>
          <p className="text-lg font-bold text-gray-900">{typeLabels[wo.type]}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Resolution</h3>
          <p className="text-lg font-bold text-gray-900">{wo.resolution ? (resolutionLabels[wo.resolution] ?? wo.resolution) : '—'}</p>
        </div>
      </div>

      {/* Title and description */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{wo.title}</h2>
        {wo.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{wo.description}</p>
        )}
      </div>

      {/* Asset and assignment info */}
      <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-300">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Asset Information</h3>
          {wo.asset ? (
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {wo.assetNameSnapshot ?? wo.asset.name}</p>
              <p><strong>Code:</strong> {wo.asset.assetCode}</p>
              {wo.asset.serialNumber && <p><strong>Serial:</strong> {wo.asset.serialNumber}</p>}
              {(wo.locationNameSnapshot ?? wo.asset.location) && <p><strong>Location:</strong> {wo.locationNameSnapshot ?? wo.asset.location?.name}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No asset assigned</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Assignment</h3>
          <div className="space-y-1 text-sm">
            {wo.assignedTo && <p><strong>Assigned to:</strong> {wo.assignedTo.name}</p>}
            {!wo.assignedTo && <p className="text-gray-500">Unassigned</p>}
            {wo.requestedBy && <p><strong>Requested by:</strong> {wo.requestedBy}</p>}
            {wo.createdBy && <p><strong>Created by:</strong> {wo.createdBy.name}</p>}
          </div>
        </div>
      </div>

      {/* Dates and timeline */}
      <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-300">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Dates</h3>
          <div className="space-y-1 text-sm">
            <p><strong>Created:</strong> {fmtDateTime(wo.createdAt)}</p>
            {wo.startDate && <p><strong>Start date:</strong> {fmtDateOnly(utcDateOnly(wo.startDate))}{wo.startTime && ` · ${fmtScheduledTime(wo.startTime)}`}</p>}
            {wo.startedAt && <p><strong>Started:</strong> {fmtDateTime(wo.startedAt)}</p>}
            {wo.respondedAt && <p><strong>Responded:</strong> {fmtDateTime(wo.respondedAt)}</p>}
            {wo.completedAt && <p><strong>Completed:</strong> {fmtDateTime(wo.completedAt)}</p>}
            {wo.dueDate && (
              <p className={isOverdue ? 'text-red-600 font-bold' : ''}>
                <strong>Due:</strong> {fmtDateOnly(utcDateOnly(wo.dueDate))}
                {wo.dueTime && ` · ${fmtScheduledTime(wo.dueTime)}`}
                {isOverdue && ' (OVERDUE)'}
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Labor & Cost</h3>
          <div className="space-y-1 text-sm">
            {(wo.repairSessions as any[]).length > 0 && (
              <div className="mb-2">
                <p className="font-semibold text-gray-700 mb-1">Repair Sessions:</p>
                {(wo.repairSessions as any[]).map((s: any) => (
                  <p key={s.id} className="ml-2 text-gray-600">
                    #{s.sessionNo}: {new Date(s.startedAt).toLocaleDateString()}{' '}
                    {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {s.completedAt && ` → ${new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    {s.durationMinutes != null && ` (${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m)`}
                  </p>
                ))}
              </div>
            )}
            {wo.laborHours && <p><strong>Labor hours:</strong> {wo.laborHours} hrs</p>}
            <p><strong>Labor cost:</strong> {fmtCurrency(wo.laborCost != null ? Number(wo.laborCost) : null)}</p>
            <p><strong>Parts cost:</strong> {fmtCurrency(wo.partsCost != null ? Number(wo.partsCost) : null)}</p>
            <p className="border-t border-gray-300 pt-1 font-bold"><strong>Total:</strong> {fmtCurrency(totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Parts used */}
      {wo.partsUsed.length > 0 && (
        <div className="mb-8 pb-8 border-b border-gray-300">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Parts Used</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 font-semibold text-gray-900">Part</th>
                <th className="text-center py-2 font-semibold text-gray-900" style={{ width: '80px' }}>Qty</th>
                <th className="text-right py-2 font-semibold text-gray-900" style={{ width: '100px' }}>Unit Cost</th>
                <th className="text-right py-2 font-semibold text-gray-900" style={{ width: '120px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {wo.partsUsed.map((p: any) => {
                const unitCost = Number(p.unitCost ?? p.part.unitCost ?? 0)
                const total = unitCost * p.quantity
                return (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-2 text-gray-700">{p.part.name}</td>
                    <td className="py-2 text-center text-gray-700">{p.quantity}</td>
                    <td className="py-2 text-right text-gray-700">{fmtCurrency(unitCost)}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{fmtCurrency(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {wo.notes && (
        <div className="mb-8 pb-8 border-b border-gray-300">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Final Action</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{wo.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 pt-8">
        <p>Generated on {fmtDateTime(new Date())}</p>
        {user && <p>By {user.name} ({user.role})</p>}
      </div>

      <div className="no-print mt-8 text-center">
        <PrintButton />
      </div>
    </div>
  )
}
