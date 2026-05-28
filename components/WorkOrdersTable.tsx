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

  // Premium Badge functions
  const getPriorityBadge = (priority: string) => {
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      LOW: { bg: 'bg-emerald-50 border-emerald-110', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      MEDIUM: { bg: 'bg-amber-50 border-amber-110', text: 'text-amber-700', dot: 'bg-amber-500' },
      HIGH: { bg: 'bg-orange-50 border-orange-110', text: 'text-orange-755', dot: 'bg-orange-500' },
      CRITICAL: { bg: 'bg-rose-50 border-rose-110 pb-0.5', text: 'text-rose-700', dot: 'bg-rose-500 shadow-sm shadow-rose-205' },
    }
    const cls = map[priority] ?? { bg: 'bg-slate-50 border-slate-110', text: 'text-slate-700', dot: 'bg-slate-500' }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${cls.bg} ${cls.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
        {priority}
      </span>
    )
  }

  const getStatusBadge = (status: string, label: string) => {
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      OPEN: { bg: 'bg-indigo-50 border-indigo-110', text: 'text-indigo-700', dot: 'bg-indigo-500' },
      IN_PROGRESS: { bg: 'bg-blue-50 border-blue-110', text: 'text-blue-700', dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)] animate-pulse' },
      ON_HOLD: { bg: 'bg-amber-50 border-amber-110', text: 'text-amber-700', dot: 'bg-amber-500' },
      COMPLETED: { bg: 'bg-emerald-50 border-emerald-110', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      CANCELLED: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
    }
    const cls = map[status] ?? { bg: 'bg-slate-55 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${cls.bg} ${cls.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
        {label}
      </span>
    )
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
                  <tr key={wo.id} className={`premium-tr-hover border-b border-slate-100/60 transition-colors ${overdue ? 'bg-rose-50/10' : ''}`}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(wo.id)}
                        onChange={() => toggleSelect(wo.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100/80 border border-slate-200/50 text-slate-705 px-2.5 py-1 rounded-lg font-bold">
                        {wo.woNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <span onClick={() => { window.location.href = `/work-orders/${wo.id}` }} className="font-semibold text-slate-905 truncate block cursor-pointer hover:text-blue-600 transition-colors">
                        {wo.title}
                      </span>
                      <p className="text-[11px] leading-tight text-slate-450 mt-0.5 font-medium">{typeLabels[wo.type] ?? wo.type}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {wo.asset ? (
                        <a href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs">
                          {wo.asset.name}
                        </a>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {wo.team ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50/80 text-purple-700 border border-purple-100 rounded-full text-xs font-semibold">
                          👥 {wo.team.name}
                        </span>
                      ) : wo.assignedTo?.name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 text-blue-700 border border-blue-50/80 rounded-full text-xs font-semibold">
                          👤 {wo.assignedTo.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className={`px-4 py-3.5 text-xs whitespace-nowrap ${overdue ? 'font-bold text-red-600' : 'text-slate-600 font-medium'}`}>
                      {overdue ? (
                        <span className="inline-flex items-center gap-1">
                          ⚠️ {formatDate(wo.dueDate)}
                        </span>
                      ) : (
                        formatDate(wo.dueDate)
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getPriorityBadge(wo.priority)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(wo.status, statusLabels[wo.status])}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <a href={`/work-orders/${wo.id}`} className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-100 rounded-xl text-xs font-semibold text-slate-650 transition-all shadow-xs active:scale-95">
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
