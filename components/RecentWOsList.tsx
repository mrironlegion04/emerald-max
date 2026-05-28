'use client'

import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface WorkOrder {
  id: string
  woNumber: string
  title: string
  type: string
  priority: string
  status: string
  assetName: string
  dueDate: string | null
  createdAt: string
  isOverdue: boolean
}

interface Props {
  workOrders: WorkOrder[]
  locationId: string
}

const priorityEmoji = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🔵',
  LOW: '⚪',
}

const statusColors = {
  OPEN: 'bg-blue-50 text-blue-900 border border-blue-200',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-900 border border-yellow-200',
  ON_HOLD: 'bg-orange-50 text-orange-900 border border-orange-200',
  COMPLETED: 'bg-green-50 text-green-900 border border-green-200',
  CANCELLED: 'bg-gray-50 text-gray-900 border border-gray-200',
}

export default function RecentWOsList({ workOrders, locationId }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Work Orders
          <span className="ml-2 inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
            {workOrders.length}
          </span>
        </h2>
      </div>

      <div className="space-y-2">
        {workOrders.map(wo => (
          <Link
            key={wo.id}
            href={`/work-orders/${wo.id}`}
            target="_blank"
            className="group flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all"
          >
            {/* Priority Dot */}
            <span className="text-lg flex-shrink-0">
              {priorityEmoji[wo.priority as keyof typeof priorityEmoji] || '⚪'}
            </span>

            {/* WO Number & Title */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {wo.woNumber} — {wo.title}
              </p>
              <p className="text-xs text-gray-600 mt-1 truncate">
                {wo.assetName}
                {wo.dueDate && ` · Due ${new Date(wo.dueDate).toLocaleDateString()}`}
              </p>
            </div>

            {/* Type Badge */}
            <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-full flex-shrink-0">
              {wo.type === 'BREAKDOWN'
                ? 'Breakdown'
                : wo.type === 'PREVENTIVE'
                  ? 'Preventive'
                  : 'Predictive'}
            </span>

            {/* Status Badge */}
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${
                statusColors[wo.status as keyof typeof statusColors] || statusColors.OPEN
              }`}
            >
              {wo.status === 'IN_PROGRESS'
                ? 'In Progress'
                : wo.status === 'ON_HOLD'
                  ? 'On Hold'
                  : wo.status}
            </span>

            {/* Arrow */}
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {workOrders.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <Link
            href={`/work-orders?locationId=${locationId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
          >
            View all work orders →
          </Link>
        </div>
      )}
    </div>
  )
}
