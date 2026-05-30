'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, AlertCircle, TrendingDown } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface BreachData {
  summary: {
    total: number
    prevTotal: number
    breaches: number
    prevBreaches: number
    complianceRate: number
    prevComplianceRate: number
    responseBreaches: number
    resolutionBreaches: number
  }
  breachesByPriority: Record<string, number>
  breachesByStatus: Record<string, number>
  topAssets: { assetName: string; breaches: number }[]
  weeklyTrend: { week: string; breaches: number; total: number }[]
  recentBreaches: {
    id: string
    workOrderId: string
    woNumber: string
    title: string
    priority: string
    status: string
    assetName: string
    createdAt: string
    breachType: string
    targetMinutes: number
    actualMinutes: number
    delayMinutes: number
  }[]
}

function StatDelta({ current, previous, inverse = false }: { current: number, previous: number, inverse?: boolean }) {
  const diff = current - previous
  if (diff === 0) return null
  
  const isPositive = diff > 0
  const colorClass = inverse 
    ? (isPositive ? 'text-red-600' : 'text-green-600')
    : (isPositive ? 'text-green-600' : 'text-red-600')
    
  return (
    <span className={`text-xs font-medium ml-2 ${colorClass}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(diff)}{typeof current === 'number' && current <= 100 && current >= 0 && previous <= 100 ? '%' : ''}
    </span>
  )
}

const dateRanges = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: null },
]

const priorityColors: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
}

const statusColors: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  ON_HOLD: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELLED: '#6b7280',
}

export default function SLABreachReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<BreachData | null>(null)
  const [selectedRange, setSelectedRange] = useState('This Month')
  const [loading, setLoading] = useState(true)
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [displayRange, setDisplayRange] = useState('This Month')
  const [breachesPage, setBreachesPage] = useState(1)
  const BREACHES_PER_PAGE = 20

  useEffect(() => {
    const fetchData = async () => {
      // Only fetch if we have both dates in custom mode
      if (useCustomDates && (!customFromDate || !customToDate)) {
        return
      }

      setLoading(true)
      try {
        let from = new Date()
        let to = new Date()

        if (useCustomDates && customFromDate && customToDate) {
          from = new Date(customFromDate)
          to = new Date(customToDate)
          setDisplayRange(`${customFromDate} to ${customToDate}`)
        } else {
          const days = dateRanges.find(r => r.label === selectedRange)?.days
          if (days) {
            from.setDate(from.getDate() - days)
          } else {
            from = new Date(0)
          }
          setDisplayRange(selectedRange)
        }

        const params = new URLSearchParams({
          dateFrom: from.toISOString(),
          dateTo: to.toISOString(),
        })

        const res = await fetch(`/api/sla-breach-reports?${params}`)
        const json = await res.json()
        if (res.ok) {
          setData(json)
        } else {
          console.error('API Error:', json.error)
          setData(null)
        }
      } catch (error) {
        console.error('Failed to fetch breach data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedRange, useCustomDates, customFromDate, customToDate])

  const handleExportCsv = async () => {
    try {
      let from = new Date()
      let to = new Date()

      if (useCustomDates && customFromDate && customToDate) {
        from = new Date(customFromDate)
        to = new Date(customToDate)
      } else {
        const days = dateRanges.find(r => r.label === selectedRange)?.days
        if (days) {
          from.setDate(from.getDate() - days)
        } else {
          from = new Date(0)
        }
      }

      const params = new URLSearchParams({
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        export: 'true',
      })

      const res = await fetch(`/api/sla-breach-reports?${params}`)
      const csv = await res.text()

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sla-breaches-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export CSV:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader title="SLA Breach Reports" />
        <div className="bg-white rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SLA Breach Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data.summary.total} total work orders · {displayRange.toLowerCase()}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {dateRanges.map(range => (
          <button
            key={range.label}
            onClick={() => {
              setUseCustomDates(false)
              setSelectedRange(range.label)
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !useCustomDates && selectedRange === range.label
                ? 'bg-blue-500 text-white'
                : 'border border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
            }`}
          >
            {range.label}
          </button>
        ))}
        
        {/* Custom Date Separator */}
        <div className="w-px h-6 bg-gray-200" />
        
        {/* Custom Date Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustomDates}
            onChange={e => setUseCustomDates(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Custom</span>
        </label>

        {/* Custom Date Inputs */}
        {useCustomDates && (
          <>
            <input
              type="date"
              value={customFromDate}
              onChange={e => setCustomFromDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              title="From date"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={customToDate}
              onChange={e => setCustomToDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              title="To date"
            />
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Total WOs</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-gray-900">{data.summary.total}</p>
            <StatDelta current={data.summary.total} previous={data.summary.prevTotal} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">SLA Breaches</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-red-600">{data.summary.breaches}</p>
            <StatDelta current={data.summary.breaches} previous={data.summary.prevBreaches} inverse />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Compliance Rate</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-green-600">{data.summary.complianceRate}%</p>
            <StatDelta current={data.summary.complianceRate} previous={data.summary.prevComplianceRate} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Resolution Breaches</p>
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-orange-600">{data.summary.resolutionBreaches}</p>
            {/* Show breakdown of total breaches if needed */}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority × Breaches */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Breaches by Priority</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(data.breachesByPriority).map(([priority, count]) => ({ priority, count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status × Breaches */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Breaches by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(data.breachesByStatus).map(([status, count]) => ({ status, count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total WOs" strokeWidth={2} />
              <Line type="monotone" dataKey="breaches" stroke="#ef4444" name="Breaches" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Assets */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-500" />
          Assets with highest Breaches
        </h3>
        <div className="space-y-3">
          {data.topAssets.length > 0 ? (
            data.topAssets.slice(0, 10).map((asset, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{asset.assetName}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: `${Math.max(...data.topAssets.map(a => a.breaches)) > 0 ? (asset.breaches / Math.max(...data.topAssets.map(a => a.breaches))) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-red-600 w-8 text-right">{asset.breaches}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No breach data</p>
          )}
        </div>
      </div>

      {/* Recent Breaches Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Breaches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">WO</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Asset</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Priority</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Delay</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBreaches.length > 0 ? (
                (() => {
                  const totalPages = Math.ceil(data.recentBreaches.length / BREACHES_PER_PAGE)
                  const start = (breachesPage - 1) * BREACHES_PER_PAGE
                  const paginatedBreaches = data.recentBreaches.slice(start, start + BREACHES_PER_PAGE)
                  return paginatedBreaches.map(breach => (
                  <tr
                    key={breach.id}
                    onClick={() => router.push(`/work-orders/${breach.workOrderId}`)}
                    className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-blue-600">{breach.woNumber}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">{breach.title}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{breach.assetName}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        breach.breachType === 'RESOLUTION' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {breach.breachType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: priorityColors[breach.priority] || '#6b7280' }}
                      >
                        {breach.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {breach.status}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-red-600">+{breach.delayMinutes}m</div>
                      <div className="text-[10px] text-gray-400 capitalize">Target: {breach.targetMinutes}m</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {new Date(breach.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
                })()
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No breaches in this period! 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls for recent breaches */}
        {data.recentBreaches.length > BREACHES_PER_PAGE && (
          <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{breachesPage}</span> of <span className="font-semibold">{Math.ceil(data.recentBreaches.length / BREACHES_PER_PAGE)}</span>
            </div>
            <div className="flex gap-2">
              {breachesPage > 1 && (
                <button
                  onClick={() => setBreachesPage(1)}
                  className="btn-secondary text-sm"
                >
                  ← First
                </button>
              )}
              {breachesPage > 1 && (
                <button
                  onClick={() => setBreachesPage(breachesPage - 1)}
                  className="btn-secondary text-sm"
                >
                  ← Previous
                </button>
              )}
              {breachesPage < Math.ceil(data.recentBreaches.length / BREACHES_PER_PAGE) && (
                <button
                  onClick={() => setBreachesPage(breachesPage + 1)}
                  className="btn-secondary text-sm"
                >
                  Next →
                </button>
              )}
              {breachesPage < Math.ceil(data.recentBreaches.length / BREACHES_PER_PAGE) && (
                <button
                  onClick={() => setBreachesPage(Math.ceil(data.recentBreaches.length / BREACHES_PER_PAGE))}
                  className="btn-secondary text-sm"
                >
                  Last →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
