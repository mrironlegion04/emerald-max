'use client'

import { useState, useEffect } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import MaintenanceCharts from './MaintenanceCharts'
import RecentWOsList from './RecentWOsList'

interface DetailData {
  location: { id: string; name: string; address: string }
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
  recentWOs: Array<{
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
  }>
  totals: { total: number; completed: number; open: number; overdue: number; avgResolutionHours: number }
}

interface Props {
  locationId: string
  canExport?: boolean
}

const dateRanges = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: null },
]

export default function MaintenanceDetail({ locationId, canExport = true }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [selectedRange, setSelectedRange] = useState('This Month')
  const [loading, setLoading] = useState(true)
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [displayRange, setDisplayRange] = useState('This Month')

  useEffect(() => {
    const fetchData = async () => {
      // Only fetch if we have both dates in custom mode, otherwise use preset
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

        const res = await fetch(`/api/reports/maintenance/${locationId}?${params}`)
        const json = await res.json()
        setData(json)
      } catch (error) {
        console.error('Failed to fetch maintenance detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [locationId, selectedRange, useCustomDates, customFromDate, customToDate])

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

      const res = await fetch(`/api/reports/maintenance/${locationId}?${params}`)
      const csv = await res.text()

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maintenance-report-${locationId}-${Date.now()}.csv`
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
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{data.location.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {data.totals.total} work orders · {displayRange.toLowerCase()}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={!canExport}
          className={`btn-secondary flex items-center gap-2 ${!canExport ? 'opacity-50 cursor-not-allowed' : ''}`}
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

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: data.totals.total, color: 'bg-gray-100 text-gray-900' },
          { label: 'Open', value: data.totals.open, color: 'bg-blue-50 text-blue-900' },
          { label: 'Completed', value: data.totals.completed, color: 'bg-green-50 text-green-900' },
          { label: 'Overdue', value: data.totals.overdue, color: 'bg-red-50 text-red-900' },
        ].map((stat, idx) => (
          <div key={idx} className={`rounded-lg p-4 ${stat.color}`}>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
              {stat.label}
            </p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <MaintenanceCharts
        typeStatusMatrix={data.typeStatusMatrix}
        priorityStatusMatrix={data.priorityStatusMatrix}
        weeklyTrend={data.weeklyTrend}
      />

      {/* Recent WOs */}
      <RecentWOsList workOrders={data.recentWOs} locationId={locationId} />

      {data.recentWOs.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No work orders found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your date filter</p>
        </div>
      )}
    </div>
  )
}
