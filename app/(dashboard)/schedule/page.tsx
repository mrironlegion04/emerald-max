'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ScheduleGrid from '@/components/ScheduleGrid'

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

interface ScheduleData {
  technicians: Technician[]
  assigned: WorkOrder[]
  unassigned: WorkOrder[]
  dateRange: { start: string; end: string }
}

const priorityBadge: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const statusBadge: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

function getWeekRange(date: Date): [Date, Date] {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return [monday, sunday]
}

function formatDateIso(date: Date): string {
  return date.toISOString().split('T')[0]
}

export default function SchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentWeek, setCurrentWeek] = useState<[Date, Date]>(() => {
    const dateParam = searchParams.get('date')
    return getWeekRange(dateParam ? new Date(dateParam) : new Date())
  })

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true)
        setError('')
        const startDate = formatDateIso(currentWeek[0])
        const endDate = formatDateIso(currentWeek[1])
        const res = await fetch(`/api/schedule?startDate=${startDate}&endDate=${endDate}`)

        if (!res.ok) {
          throw new Error('Failed to fetch schedule')
        }

        const scheduleData = await res.json()
        setData(scheduleData)
      } catch (err: any) {
        setError(err.message || 'Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [currentWeek])

  const handlePreviousWeek = () => {
    const prev = new Date(currentWeek[0])
    prev.setDate(prev.getDate() - 7)
    setCurrentWeek(getWeekRange(prev))
  }

  const handleNextWeek = () => {
    const next = new Date(currentWeek[0])
    next.setDate(next.getDate() + 7)
    setCurrentWeek(getWeekRange(next))
  }

  const handleToday = () => {
    setCurrentWeek(getWeekRange(new Date()))
  }

  const weekLabel = `${currentWeek[0].toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} – ${currentWeek[1].toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Technician Schedule</h1>
        <p className="text-gray-600">View and manage work order assignments by technician</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreviousWeek}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <span>←</span> Previous
          </button>
          <button
            onClick={handleToday}
            className="btn-secondary text-sm"
          >
            Today
          </button>
          <button
            onClick={handleNextWeek}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            Next <span>→</span>
          </button>
          <div className="text-lg font-semibold text-gray-900 min-w-48 ml-4">
            {weekLabel}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/work-orders/new" className="btn-primary text-sm">
            + New work order
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading schedule...</div>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">No data available</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main schedule grid */}
          <div className="lg:col-span-3">
            <div className="overflow-hidden">
              <ScheduleGrid
                technicians={data.technicians}
                workOrders={data.assigned}
                startDate={data.dateRange.start}
                endDate={data.dateRange.end}
              />
            </div>

            {/* Legend */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-3">🎨 Priority Legend</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {Object.entries(priorityBadge).map(([priority, className]) => (
                  <div key={priority} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${className}`}></div>
                    <span className="text-gray-600">{priority}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Unassigned WOs Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-6">
              <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <span>📋</span> Unassigned WOs
                <span className="ml-auto bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {data.unassigned.length}
                </span>
              </h2>

              {data.unassigned.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">All work orders assigned!</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.unassigned.map(wo => (
                    <Link
                      key={wo.id}
                      href={`/work-orders/${wo.id}`}
                      className="block p-2 rounded border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-bold text-gray-600 group-hover:text-gray-900 truncate">
                          {wo.woNumber}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${priorityBadge[wo.priority]}`}>
                          {wo.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 group-hover:text-gray-900">
                        {wo.title}
                      </p>
                      {wo.asset && (
                        <p className="text-xs text-gray-400 mt-1">
                          📦 {wo.asset.assetCode}
                        </p>
                      )}
                      {wo.dueDate && (
                        <p className="text-xs text-gray-400 mt-1">
                          📅 {new Date(wo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <Link
                          href={`/work-orders/${wo.id}?action=assign`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Assign →
                        </Link>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {data.unassigned.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link
                    href="/work-orders?filter=unassigned"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View all →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">💡 Tip:</span> Click on any work order block to view details. Use the unassigned sidebar to quickly assign work orders to technicians.
        </p>
      </div>
    </div>
  )
}
