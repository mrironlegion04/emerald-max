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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        {/* Header */}
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 p-2 text-left font-semibold text-sm w-32 sticky left-0 z-10">
              Technician
            </th>
            {days.map((day, idx) => (
              <th
                key={idx}
                className="border border-gray-200 bg-gray-50 p-2 text-center font-semibold text-sm w-32 min-w-32"
              >
                <div className="text-xs font-medium text-gray-500">{getDayOfWeek(day)}</div>
                <div className="text-sm font-bold text-gray-900">{formatDate(day)}</div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {technicians.map(tech => (
            <tr key={tech.id} className="hover:bg-blue-50/30 transition-colors">
              {/* Technician name column */}
              <td className="border border-gray-200 bg-white p-3 font-medium text-sm sticky left-0 z-10 w-32">
                <div className="text-gray-900">{tech.name}</div>
                <div className="text-xs text-gray-400 truncate">{tech.email}</div>
              </td>

              {/* Day columns */}
              {days.map((day, dayIdx) => {
                const dateKey = day.toISOString().split('T')[0]
                const dayWOs = wosByTechnicianAndDate[tech.id]?.[dateKey] || []

                return (
                  <td
                    key={dayIdx}
                    className="border border-gray-200 p-2 align-top min-w-32 w-32 bg-white"
                  >
                    <div className="space-y-1 h-full">
                      {dayWOs.length === 0 ? (
                        <div className="text-xs text-gray-300 py-8 text-center">—</div>
                      ) : (
                        dayWOs.map(wo => (
                          <Link
                            key={wo.id}
                            href={`/work-orders/${wo.id}`}
                            className={`block p-2 rounded border text-xs font-medium no-underline hover:shadow-md transition-all ${
                              priorityColors[wo.priority] || 'bg-gray-50 border-gray-300 text-gray-900'
                            } ${statusBgColor[wo.status] || ''} group`}
                          >
                            <div className="font-bold text-xs truncate group-hover:underline">
                              {wo.woNumber}
                            </div>
                            <div className="text-xs truncate opacity-85">{wo.title}</div>
                            {wo.asset && (
                              <div className="text-xs opacity-70 truncate">
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
        <div className="text-center py-12 text-gray-400">
          <p>No technicians available for this period</p>
        </div>
      )}
    </div>
  )
}
