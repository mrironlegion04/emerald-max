'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface Props {
  typeStatusMatrix: Array<{
    type: string
    open: number
    inProgress: number
    onHold: number
    completed: number
    cancelled: number
    total: number
  }>
  priorityStatusMatrix: Array<{
    priority: string
    open: number
    inProgress: number
    completed: number
    total: number
  }>
  weeklyTrend: Array<{ week: string; created: number; completed: number }>
}

export default function MaintenanceCharts({
  typeStatusMatrix,
  priorityStatusMatrix,
  weeklyTrend,
}: Props) {
  const typeData = typeStatusMatrix.map(row => ({
    name: row.type === 'BREAKDOWN' ? 'Breakdown' : row.type === 'PREVENTIVE' ? 'Preventive' : 'Predictive',
    Open: row.open,
    'In Progress': row.inProgress,
    'On Hold': row.onHold,
    Completed: row.completed,
    Cancelled: row.cancelled,
  }))

  const priorityData = priorityStatusMatrix.map(row => ({
    name: row.priority,
    Open: row.open,
    'In Progress': row.inProgress,
    Completed: row.completed,
  }))

  const trendData = weeklyTrend.map(row => ({
    week: new Date(row.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Created: row.created,
    Completed: row.completed,
  }))

  const colors = {
    Open: '#60a5fa',
    'In Progress': '#eab308',
    'On Hold': '#f97316',
    Completed: '#22c55e',
    Cancelled: '#d1d5db',
  }

  return (
    <div className="space-y-6">
      {/* Type × Status Matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
          Work Orders by Type
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {/* Chart */}
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Open" stackId="a" fill="#60a5fa" />
                <Bar dataKey="In Progress" stackId="a" fill="#eab308" />
                <Bar dataKey="Completed" stackId="a" fill="#22c55e" />
                <Bar dataKey="On Hold" stackId="a" fill="#f97316" />
                <Bar dataKey="Cancelled" stackId="a" fill="#d1d5db" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Cards */}
          <div className="space-y-3">
            {typeStatusMatrix.map((row, idx) => {
              const typeName =
                row.type === 'BREAKDOWN'
                  ? 'Breakdown'
                  : row.type === 'PREVENTIVE'
                    ? 'Preventive'
                    : 'Predictive'
              const percentage = ((row.total / typeStatusMatrix.reduce((sum, r) => sum + r.total, 0)) * 100).toFixed(0)
              const remaining = row.total - row.completed
              return (
                <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{typeName}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-gray-900">{row.total}</span>
                    <span className="text-xs text-gray-600">{percentage}%</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {row.completed} done · {remaining} remaining
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Priority × Status Matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
          Priority Breakdown
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {/* Chart */}
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={priorityData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Open" stackId="a" fill="#60a5fa" />
                <Bar dataKey="In Progress" stackId="a" fill="#eab308" />
                <Bar dataKey="Completed" stackId="a" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Cards */}
          <div className="space-y-3">
            {priorityStatusMatrix.map((row, idx) => {
              const colors = {
                CRITICAL: 'bg-red-50 text-red-900 border-red-200',
                HIGH: 'bg-orange-50 text-orange-900 border-orange-200',
                MEDIUM: 'bg-blue-50 text-blue-900 border-blue-200',
                LOW: 'bg-gray-50 text-gray-900 border-gray-200',
              }
              const priorityEmoji = {
                CRITICAL: '🔴',
                HIGH: '🟠',
                MEDIUM: '🔵',
                LOW: '⚪',
              }
              return (
                <div key={idx} className={`rounded-lg p-4 border ${colors[row.priority as keyof typeof colors]}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{priorityEmoji[row.priority as keyof typeof priorityEmoji]}</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider">{row.priority}</p>
                      <p className="text-2xl font-bold">{row.total}</p>
                    </div>
                  </div>
                  <p className="text-xs opacity-75 mt-2">
                    {row.open} open · {row.inProgress} in progress
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
          WO Activity
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Created"
              stroke="#3b82f6"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Completed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
