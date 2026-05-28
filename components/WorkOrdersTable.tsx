'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Tag, ChevronRight } from 'lucide-react'
import BulkWOActions from './BulkWOActions'
import Badge, { workOrderStatusVariant, priorityVariant } from './Badge'

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

  // Centralized Badge components rendering
  const getPriorityBadge = (priority: string) => {
    return <Badge label={priority} variant={priorityVariant(priority)} />
  }

  const getStatusBadge = (status: string) => {
    return <Badge label={statusLabels[status] || status} variant={workOrderStatusVariant(status)} />
  }

  // Handle both Date and string dueDate
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'No due date'
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

  const handleBulkAction = async (action: string, payload: Record<string, unknown>) => {
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
    }
  }

  const isAllSelected = selectedIds.length === workOrders.length && workOrders.length > 0

  return (
    <>
      {/* Desktop & Larger Screens: Premium Table View */}
      <div className="responsive-table-container hidden md:block">
        <table className="premium-table">
          <thead>
            <tr>
              <th className="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Select all rows"
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
            {workOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 font-semibold italic">
                  No work orders found matching the filter criteria.
                </td>
              </tr>
            ) : (
              workOrders.map(wo => {
                const overdue =
                  wo.dueDate &&
                  new Date(wo.dueDate) < new Date() &&
                  !['COMPLETED', 'CANCELLED'].includes(wo.status)

                return (
                  <tr 
                    key={wo.id} 
                    className={`premium-tr-hover border-b border-slate-100/60 transition-colors ${overdue ? 'bg-rose-50/15' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(wo.id)}
                        onChange={() => toggleSelect(wo.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={`Select work order ${wo.woNumber}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100/90 border border-slate-200/50 text-slate-700 px-2.5 py-1 rounded-lg font-extrabold">
                        {wo.woNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <Link 
                        href={`/work-orders/${wo.id}`} 
                        className="font-bold text-slate-900 truncate block hover:text-blue-600 transition-colors"
                      >
                        {wo.title}
                      </Link>
                      <p className="text-[11px] leading-tight text-slate-400 mt-0.5 font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Tag className="w-3 h-3" />
                        {typeLabels[wo.type] ?? wo.type}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {wo.asset ? (
                        <Link href={`/assets/${wo.asset.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-xs">
                          {wo.asset.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400 font-normal select-none">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {wo.team ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50/80 text-purple-700 border border-purple-100 rounded-full text-xs font-bold leading-none select-none">
                          👥 {wo.team.name}
                        </span>
                      ) : wo.assignedTo?.name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 text-blue-700 border border-blue-100/40 rounded-full text-xs font-bold leading-none select-none">
                          👤 {wo.assignedTo.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic select-none font-semibold">Unassigned</span>
                      )}
                    </td>
                    <td className={`px-4 py-3.5 text-xs whitespace-nowrap select-none ${overdue ? 'font-bold text-red-600' : 'text-slate-600 font-semibold'}`}>
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1 rounded-full animate-pulse font-extrabold text-[11px]">
                          ⚠️ OVERDUE - {formatDate(wo.dueDate)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(wo.dueDate)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getPriorityBadge(wo.priority)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(wo.status)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link 
                        href={`/work-orders/${wo.id}`} 
                        className="inline-flex items-center gap-1.5 justify-center px-3.5 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-600 transition-all shadow-3xs active:scale-95"
                      >
                        View
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile & Tablet UI: Responsive Dynamic Card List */}
      <div className="md:hidden flex flex-col gap-4">
        {/* Mobile Header helper */}
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mobile-select-all"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="mobile-select-all" className="text-xs font-bold text-slate-600 select-none cursor-pointer">
              Select All Work Orders
            </label>
          </div>
          <span className="text-[11px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            {workOrders.length} showing
          </span>
        </div>

        {workOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-semibold italic">
            No work orders found matching the filter criteria.
          </div>
        ) : (
          workOrders.map(wo => {
            const overdue =
              wo.dueDate &&
              new Date(wo.dueDate) < new Date() &&
              !['COMPLETED', 'CANCELLED'].includes(wo.status)

            const isSelected = selectedIds.includes(wo.id)

            return (
              <div 
                key={wo.id}
                className={`group relative bg-white border rounded-2xl p-4.5 transition-all duration-200 shadow-sm flex flex-col gap-3.5 ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200/80 hover:border-slate-300'
                } ${overdue ? 'bg-rose-50/5' : ''}`}
              >
                {/* Colored Accent Strip Indicator */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl ${
                  wo.priority === 'HIGH' || wo.priority === 'CRITICAL' || overdue ? 'bg-rose-500' :
                  wo.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-300'
                }`} />

                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 pl-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Oversized Checkbox Target */}
                    <div className="flex items-center justify-center p-1 -m-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(wo.id)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={`Select work order ${wo.woNumber}`}
                      />
                    </div>
                    
                    {/* WO ID */}
                    <span className="font-mono text-xs bg-slate-100 border border-slate-200 text-slate-705 px-2 py-0.5 rounded font-extrabold tracking-tight">
                      {wo.woNumber}
                    </span>
                  </div>

                  {/* Status/Priority floating badge layout */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getPriorityBadge(wo.priority)}
                    {getStatusBadge(wo.status)}
                  </div>
                </div>

                {/* Title & Type */}
                <div className="pl-2.5 min-w-0">
                  <Link 
                    href={`/work-orders/${wo.id}`}
                    className="font-extrabold text-slate-900 text-sm leading-snug hover:text-blue-600 block transition-colors group-active:text-blue-700 active:scale-[0.99]"
                    style={{ minHeight: '36px' }}
                  >
                    {wo.title}
                  </Link>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1 select-none">
                    <Tag className="w-3 h-3 flex-shrink-0" />
                    <span>{typeLabels[wo.type] ?? wo.type}</span>
                  </div>
                </div>

                {/* Metas: Asset, Assinged detail layout */}
                <div className="pl-2.5 border-t border-slate-100 pt-3.5 grid grid-cols-2 gap-3.5 select-none text-xs">
                  {/* Asset */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset</span>
                    {wo.asset ? (
                      <Link 
                        href={`/assets/${wo.asset.id}`} 
                        className="text-blue-600 font-extrabold hover:underline truncate"
                      >
                        {wo.asset.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400 font-medium">—</span>
                    )}
                  </div>

                  {/* Assigned to */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignee</span>
                    {wo.team ? (
                      <span className="text-purple-700 font-bold truncate" title={`Team: ${wo.team.name}`}>
                        👥 {wo.team.name}
                      </span>
                    ) : wo.assignedTo?.name ? (
                      <span className="text-blue-700 font-bold truncate">
                        👤 {wo.assignedTo.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium italic">Unassigned</span>
                    )}
                  </div>

                  {/* Due Date - Full width below */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</span>
                    {overdue ? (
                      <span className="inline-flex items-center gap-1.5 self-start px-2 py-1 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold tracking-tight animate-pulse">
                        ⚠️ OVERDUE · {formatDate(wo.dueDate)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(wo.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Level CTA Button */}
                <div className="pl-2.5 pt-1.5 flex justify-end">
                  <Link 
                    href={`/work-orders/${wo.id}`} 
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/60 rounded-xl text-xs font-bold text-slate-600 transition-all select-none active:scale-[0.97]"
                  >
                    Manage Work Order
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            )
          })
        )}
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
