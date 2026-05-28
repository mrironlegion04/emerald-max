'use client'

import { useMemo } from 'react'
import Link from 'next/link'

interface Technician {
  id: string
  name: string
  email: string
  role: string
}

interface Asset {
  id: string
  name: string
  assetCode: string
}

interface AssignedTo {
  id: string
  name: string
}

interface WorkOrder {
  id: string
  woNumber: string
  title: string
  priority: string
  status: string
  dueDate: string | null
  asset: Asset | null
  assignedTo: AssignedTo | null
  assignedToId: string | null
}

interface ScheduleGridProps {
  technicians: Technician[]
  workOrders: WorkOrder[]
  startDate: string // ISO date
  endDate: string   // ISO date
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-blue-100 border-blue-300 text-blue-900',
  MEDIUM: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  HIGH: 'bg-orange-100 border-orange-300 text-orange-900',
  CRITICAL: 'bg-red-100 border-red-300 text-red-900',
}

const statusBgColor: Record<string, string> = {
  OPEN: 'border-l-4 border-gray-400',
  IN_PROGRESS: 'border-l-4 border-blue-500',
  ON_HOLD: 'border-l-4 border-yellow-500',
  COMPLETED: 'border-l-4 border-green-500',
  CANCELLED: 'border-l-4 border-red-500',
}

export default function ScheduleGrid({ technicians, workOrders, startDate, endDate }: ScheduleGridProps) {
  // Generate dates for the week
  const days = useMemo(() => {
    const dates: Date[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return dates
  }, [startDate, endDate])

  // Group WOs by technician and date
  const wosByTechnicianAndDate = useMemo(() => {
    const grouped: Record<string, Record<string, WorkOrder[]>> = {}

    technicians.forEach(tech => {
      grouped[tech.id] = {}
      days.forEach(day => {
        const dateKey = day.toISOString().split('T')[0]
        grouped[tech.id][dateKey] = []
      })
    })

    workOrders.forEach(wo => {
      if (wo.assignedToId) {
        const dateKey = wo.dueDate ? new Date(wo.dueDate).toISOString().split('T')[0] : null
        if (dateKey && grouped[wo.assignedToId]) {
          grouped[wo.assignedToId][dateKey].push(wo)
        }
      }
    })

    return grouped
  }, [technicians, workOrders, days])

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const getDayOfWeek = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Mobile/Tablet Compact Block List */}
      <div className="block lg:hidden space-y-4">
        {technicians.map(tech => {
          // Flatten daily work orders to check if tech has ANY assignments this week
          const weekWOs: { date: Date; wos: WorkOrder[] }[] = []
          days.forEach(day => {
            const dateKey = day.toISOString().split('T')[0]
            const dayWOs = wosByTechnicianAndDate[tech.id]?.[dateKey] || []
            if (dayWOs.length > 0) {
              weekWOs.push({ date: day, wos: dayWOs })
            }
          })

          return (
            <div key={tech.id} className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden">
              {/* Technician Header info */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{tech.name}</h4>
                  <p className="text-xs text-slate-400 font-medium truncate">{tech.email}</p>
                </div>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-150">
                  {weekWOs.reduce((acc, curr) => acc + curr.wos.length, 0)} assigned
                </span>
              </div>

              {/* Tasks mapping */}
              <div className="p-4 space-y-3.5">
                {weekWOs.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-3 text-center">No assignments scheduled for this week.</p>
                ) : (
                  weekWOs.map(({ date, wos }) => (
                    <div key={date.toISOString()} className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="space-y-1.5 pl-1 border-l border-slate-150">
                        {wos.map(wo => (
                          <Link
                            key={wo.id}
                            href={`/work-orders/${wo.id}`}
                            className={`block p-3 rounded-xl border text-xs font-semibold hover:shadow-2xs transition-all active:scale-98 ${
                              priorityColors[wo.priority] || 'bg-slate-50 border-slate-200 text-slate-800'
                            } ${statusBgColor[wo.status] || ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">{wo.woNumber}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider backdrop-blur-3xs bg-black/5 px-1.5 py-0.5 rounded">
                                {wo.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="mt-1 font-medium text-slate-800 truncate">{wo.title}</p>
                            {wo.asset && (
                              <p className="text-[10px] opacity-75 mt-1 font-semibold">
                                📦 {wo.asset.assetCode} — {wo.asset.name}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}

        {technicians.length === 0 && (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">
            No technicians available this week.
          </div>
        )}
      </div>

      {/* Desktop Multi-day horizontal grid timeline */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)]">
        <table className="w-full border-collapse bg-white table-fixed">
          {/* Header */}
          <thead>
            <tr>
              <th className="border border-slate-150 bg-slate-50/50 p-3 text-left font-bold text-xs uppercase tracking-wider w-32 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.01)] select-none">
                Technician
              </th>
              {days.map((day, idx) => (
                <th
                  key={idx}
                  className="border border-slate-150 bg-slate-50/50 p-2.5 text-center font-bold text-xs w-32 min-w-32 select-none"
                >
                  <div className="text-[10px] font-bold text-slate-420 uppercase tracking-wider">{getDayOfWeek(day)}</div>
                  <div className="text-sm font-extrabold text-slate-800 mt-0.5">{formatDate(day)}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {technicians.map(tech => (
              <tr key={tech.id} className="hover:bg-slate-50/20 transition-colors">
                {/* Technician name column - Sticky */}
                <td className="border border-slate-150 bg-white p-3.5 font-bold text-slate-900 sticky left-0 z-10 w-32 shadow-[2px_0_5px_rgba(0,0,0,0.01)] leading-tight">
                  <div className="text-sm font-bold truncate">{tech.name}</div>
                  <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{tech.email}</div>
                </td>

                {/* Day columns */}
                {days.map((day, dayIdx) => {
                  const dateKey = day.toISOString().split('T')[0]
                  const dayWOs = wosByTechnicianAndDate[tech.id]?.[dateKey] || []

                  return (
                    <td
                      key={dayIdx}
                      className="border border-slate-150 p-2 align-top min-w-32 w-32 bg-slate-50/10"
                    >
                      <div className="space-y-1.5 min-h-[105px]">
                        {dayWOs.length === 0 ? (
                          <div className="text-xs text-slate-300 py-10 text-center select-none">—</div>
                        ) : (
                          dayWOs.map(wo => (
                            <Link
                              key={wo.id}
                              href={`/work-orders/${wo.id}`}
                              className={`block p-2 rounded-xl border text-[10px] font-bold no-underline hover:shadow-2xs transition-all ${
                                priorityColors[wo.priority] || 'bg-slate-50 border-slate-200 text-slate-800'
                              } ${statusBgColor[wo.status] || ''} group leading-normal`}
                            >
                              <div className="font-extrabold text-slate-900 group-hover:text-blue-700 truncate">
                                {wo.woNumber}
                              </div>
                              <div className="truncate text-slate-600 mt-0.5 font-semibold">{wo.title}</div>
                              {wo.asset && (
                                <div className="text-[9px] opacity-75 truncate mt-1">
                                  📦 {wo.asset.assetCode}
                                </div>
                              )}
                            </Link>
                          ))
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {technicians.length === 0 && (
          <div className="text-center py-16 text-slate-420 font-semibold">
            <p>No dispatch team technicians setup for this operational window.</p>
          </div>
        )}
      </div>
    </div>
  )
}
