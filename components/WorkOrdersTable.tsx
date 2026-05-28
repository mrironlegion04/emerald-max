'use client'

import { useState } from 'react'
import BulkWOActions from './BulkWOActions'

interface WorkOrder {
  id: string
  woNumber: string
  title: string
  type: string
  dueDate: Date | string | null
  asset: { id: string; name: string; assetCode: string | null } | null
  assignedTo: { id: string; name: string } | null
  team: { id: string; name: string; trade: string } | null
  priority: string
  status: string
  createdBy: { name: string } | null
}

interface WorkOrdersTableProps {
  workOrders: WorkOrder[]
  technicians: Array<{ id: string; name: string; role: string }>
  typeLabels: Record<string, string>
  statusLabels: Record<string, string>
}

export default function WorkOrdersTable({
  workOrders,
  technicians,
  typeLabels,
  statusLabels,
}: WorkOrdersTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Inline variant logic to avoid passing functions from server component
  const getStatusVariant = (status: string): string => {
    const map: Record<string, string> = {
      OPEN: 'bg-purple-100 text-purple-700',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      ON_HOLD: 'bg-yellow-100 text-yellow-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
    }
    return map[status] ?? 'bg-gray-100 text-gray-700'
  }

  const getPriorityVariant = (priority: string): string => {
    const map: Record<string, string> = {
      LOW: 'bg-green-100 text-green-700',
      MEDIUM: 'bg-yellow-100 text-yellow-700',
      HIGH: 'bg-orange-100 text-orange-700',
      CRITICAL: 'bg-red-100 text-red-700',
    }
    return map[priority] ?? 'bg-gray-100 text-gray-700'
  }

  // Handle both Date and string dueDate
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === workOrders.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(workOrders.map(wo => wo.id))
    }
  }

  const handleBulkAction = async (action: string, payload: any) => {
    setLoading(true)
    try {
      const response = await fetch('/api/work-orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          ...payload,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to perform action')
      }

      if (action === 'export') {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'work-orders.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        // Refresh page after assign/status change
        window.location.reload()
      }

      setSelectedIds([])
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const isAllSelected = selectedIds.length === workOrders.length && workOrders.length > 0

  return (
    <>
      <div className="responsive-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th className="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th>WO #</th>
              <th>Title</th>
              <th>Asset</th>
              <th>Assigned to</th>
              <th>Due date</th>
              <th>Priority</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
              {workOrders.map(wo => {
                const overdue =
                  wo.dueDate &&
                  new Date(wo.dueDate) < new Date() &&
                  !['COMPLETED', 'CANCELLED'].includes(wo.status)

                return (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(wo.id)}
                        onChange={() => toggleSelect(wo.id)}
                        className="w-4 h-4 border-gray-300 rounded text-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {wo.woNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{wo.title}</p>
                      <p className="text-xs text-gray-400">{typeLabels[wo.type] ?? wo.type}</p>
                    </td>
                    <td className="px-4 py-3">
                      {wo.asset ? (
                        <a href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:underline text-xs">
                          {wo.asset.name}
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {wo.team ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                          👥 {wo.team.name}
                        </span>
                      ) : wo.assignedTo?.name ? (
                        <span className="text-gray-600 text-xs">{wo.assignedTo.name}</span>
                      ) : (
                        <span className="text-gray-500 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${overdue ? 'font-bold text-red-600' : 'text-gray-600'}`}>
                      {formatDate(wo.dueDate)}
                      {overdue && ' ⚠️'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getPriorityVariant(wo.priority)}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getStatusVariant(wo.status)}`}>
                        {statusLabels[wo.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline text-xs">
                        View
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      <BulkWOActions
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        totalCount={workOrders.length}
        technicians={technicians}
        onAction={handleBulkAction}
      />

      {selectedIds.length > 0 && <div className="h-32" />}
    </>
  )
}
