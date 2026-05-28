'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import MaintenancePlantCard from './MaintenancePlantCard'

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

interface OverviewData {
  summary: {
    total: number
    breakdown: number
    preventive: number
    inspection: number
    emergency: number
    open: number
    completed: number
  }
  locations: LocationData[]
}

const dateRanges = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: null },
]

export default function MaintenanceOverview() {
  const [data, setData] = useState<OverviewData | null>(null)
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
            from = new Date(0) // All time
          }
          setDisplayRange(selectedRange)
        }

        const params = new URLSearchParams({
          dateFrom: from.toISOString(),
          dateTo: to.toISOString(),
        })

        const res = await fetch(`/api/reports/maintenance?${params}`)
        const json = await res.json()
        setData(json)
      } catch (error) {
        console.error('Failed to fetch maintenance overview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedRange, useCustomDates, customFromDate, customToDate])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header with Date Filters and Range Display */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Maintenance Overview</h1>
            <p className="text-sm text-gray-600 mt-1">
              {data.summary.total} total work orders · {displayRange.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Date Filter Bar */}
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
      </div>

      {/* Fleet Summary Strip */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-0 overflow-hidden">
        <div className="grid grid-cols-5 divide-x divide-gray-100">
          {[
            { label: 'Total WOs', value: data.summary.total, color: 'text-gray-600' },
            { label: 'Breakdown', value: data.summary.breakdown, color: 'text-blue-600' },
            { label: 'Preventive', value: data.summary.preventive, color: 'text-green-600' },
            { label: 'Open', value: data.summary.open, color: 'text-yellow-600' },
            { label: 'Completed', value: data.summary.completed, color: 'text-green-600' },
          ].map((item, idx) => (
            <div key={idx} className="p-6 text-center">
              <p className={`text-4xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-600 font-medium mt-2 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plant Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.locations.map(location => (
          <MaintenancePlantCard key={location.id} location={location} />
        ))}
      </div>

      {data.locations.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No work orders found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your date filter</p>
        </div>
      )}
    </div>
  )
}
