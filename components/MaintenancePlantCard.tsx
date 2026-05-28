'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'

interface LocationData {
  id: string
  name: string
  address: string
  total: number
  byType: { BREAKDOWN: number; PREVENTIVE: number; PREDICTIVE: number }
  byStatus: { OPEN: number; IN_PROGRESS: number; ON_HOLD: number; COMPLETED: number; CANCELLED: number }
  byPriority: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }
  criticalCount: number
}

interface Props {
  location: LocationData
}

export default function MaintenancePlantCard({ location }: Props) {
  const [isHovered, setIsHovered] = useState(false)

  const typeColors = {
    BREAKDOWN: 'bg-blue-500',
    PREVENTIVE: 'bg-green-500',
    PREDICTIVE: 'bg-purple-500',
  }

  const statusColors = {
    OPEN: 'bg-blue-400',
    IN_PROGRESS: 'bg-yellow-500',
    ON_HOLD: 'bg-orange-400',
    COMPLETED: 'bg-green-500',
    CANCELLED: 'bg-gray-300',
  }

  const statusOrder = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const
  const totalByStatus = statusOrder.reduce((sum, status) => sum + (location.byStatus[status] || 0), 0)

  return (
    <Link href={`/reports/maintenance/${location.id}`}>
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-6 cursor-pointer h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{location.name}</h3>
            <p className="text-xs text-gray-600 mt-1">{location.address}</p>
          </div>
          <div className="flex items-center gap-2">
            {location.criticalCount > 0 && (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" title="Critical WOs" />
            )}
            <span className="text-sm font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
              {location.total} total
            </span>
          </div>
        </div>

        {/* Work Order Types */}
        <div className="pb-6 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Work Order Types</p>
          <div className="space-y-3">
            {Object.entries(location.byType).map(([type, count]) => {
              const percentage = location.total > 0 ? (count / location.total) * 100 : 0
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {type === 'BREAKDOWN'
                          ? 'Breakdown'
                          : type === 'PREVENTIVE'
                            ? 'Preventive'
                            : 'Predictive'}
                      </span>
                      <span className="text-xs text-gray-600">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${typeColors[type as keyof typeof typeColors]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="py-6 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Status Breakdown</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {statusOrder.map(status => (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                    <span className="text-xs text-gray-700 font-medium">
                      {status === 'IN_PROGRESS' ? 'In Progress' : status === 'ON_HOLD' ? 'On Hold' : status}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{location.byStatus[status] || 0}</span>
                </div>
              ))}
            </div>

            {/* Stacked Status Bar */}
            <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden flex">
              {statusOrder.map(status => {
                const count = location.byStatus[status] || 0
                const percentage = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0
                return (
                  <div
                    key={status}
                    className={statusColors[status]}
                    style={{ width: `${percentage}%` }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* Priority Flags */}
        <div className="pt-6 pb-6 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Priority Flags</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔴</span>
              <span className="text-xs text-gray-700 font-medium">
                {location.byPriority.CRITICAL} Critical
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🟠</span>
              <span className="text-xs text-gray-700 font-medium">{location.byPriority.HIGH} High</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔵</span>
              <span className="text-xs text-gray-700 font-medium">{location.byPriority.MEDIUM} Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚪</span>
              <span className="text-xs text-gray-700 font-medium">{location.byPriority.LOW} Low</span>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="pt-6">
          <div className={`text-sm font-medium transition-colors ${isHovered ? 'text-blue-600' : 'text-gray-500'}`}>
            View Plant Report →
          </div>
        </div>
      </div>
    </Link>
  )
}
