'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gauge, Search, Filter } from 'lucide-react'

interface AssetBrief {
  id: string
  name: string
  assetCode: string | null
}

interface Meter {
  id: string
  name: string
  meterType: string
  unit: string
  isPrimary: boolean
  lastValue: number | null
  lastReadingAt: string | null
  assetId: string
  asset: AssetBrief
  _count: { readings: number }
}

const typeLabels: Record<string, string> = {
  RUNTIME: 'Runtime', DISTANCE: 'Distance', CYCLE: 'Cycle',
  TEMPERATURE: 'Temperature', PRESSURE: 'Pressure', CUSTOM: 'Custom',
}

const typeColors: Record<string, string> = {
  RUNTIME: 'bg-blue-100 text-blue-700',
  DISTANCE: 'bg-green-100 text-green-700',
  CYCLE: 'bg-purple-100 text-purple-700',
  TEMPERATURE: 'bg-orange-100 text-orange-700',
  PRESSURE: 'bg-red-100 text-red-700',
  CUSTOM: 'bg-gray-100 text-gray-700',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function GlobalMetersPage() {
  const [meters, setMeters] = useState<Meter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    fetchMeters()
  }, [])

  async function fetchMeters() {
    try {
      const res = await fetch('/api/meters?limit=200')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMeters(data.meters)
    } catch {
      setError('Failed to load meters')
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = meters.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
        !m.asset?.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && m.meterType !== filterType) return false
    return true
  })

  const types = [...new Set(meters.map(m => m.meterType))]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gauge className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">All Meters</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meters or assets..."
            className="input-field text-sm pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="input-field text-sm max-w-[160px] cursor-pointer pointer-events-auto flex-1 font-semibold text-slate-700 bg-white"
          >
            <option value="">All types</option>
            {types.map(t => (
              <option key={t} value={t}>{typeLabels[t] || t}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-200 px-2.5 py-2.5 rounded-xl whitespace-nowrap shadow-3xs">
            {filtered.length} of {meters.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-650 bg-red-50/50 border border-red-150 rounded-xl px-4 py-3 mb-5 font-semibold">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm font-medium">Loading meters...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-slate-200 border-dashed rounded-2xl bg-slate-50/20">
          <Gauge className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-semibold">
            {meters.length === 0 ? 'No meters configured yet' : 'No meters match your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
          {/* Mobile/Tablet Card Layout */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filtered.map(meter => (
              <div key={meter.id} className="p-4.5 space-y-3 hover:bg-slate-50/25 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <Link
                      href={`/assets/${meter.assetId}/meters/${meter.id}`}
                      className="font-bold text-slate-900 text-sm hover:text-blue-600 truncate flex items-center gap-1.5"
                    >
                      {meter.name}
                      {meter.isPrimary && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-150 shadow-3xs">
                          Primary
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-600 font-semibold">
                      <span>Asset:</span>
                      <Link
                        href={`/assets/${meter.assetId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate"
                      >
                        {meter.asset?.name ?? '—'}
                      </Link>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      typeColors[meter.meterType] || typeColors.CUSTOM
                    }`}>
                      {typeLabels[meter.meterType] || meter.meterType}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1.5 px-3 bg-slate-50/60 border border-slate-100 rounded-xl text-center">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Value</span>
                    <span className="text-slate-800 text-xs font-bold leading-tight block mt-0.5">
                      {meter.lastValue?.toLocaleString() ?? '—'} <span className="text-[10px] text-slate-400 font-normal">{meter.unit}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Readings</span>
                    <span className="text-slate-800 text-xs font-mono font-bold leading-tight block mt-0.5">
                      {meter._count.readings}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Last Raw</span>
                    <span className="text-slate-600 text-[10px] font-semibold tracking-tight leading-tight block mt-1 hover:text-slate-900 truncate">
                      {formatDate(meter.lastReadingAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Responsive Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/50">
                  <th className="text-left px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Meter</th>
                  <th className="text-left px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Asset</th>
                  <th className="text-left px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Current Value</th>
                  <th className="text-right px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Readings</th>
                  <th className="text-right px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(meter => (
                  <tr key={meter.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`/assets/${meter.assetId}/meters/${meter.id}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-850"
                      >
                        {meter.name}
                        {meter.isPrimary && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 border border-amber-150 text-amber-700 shadow-3xs uppercase tracking-wider">
                            Primary
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/assets/${meter.assetId}`}
                        className="text-sm font-semibold text-slate-700 hover:text-blue-600"
                      >
                        {meter.asset?.name ?? '—'}
                      </Link>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{meter.asset?.assetCode}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                        typeColors[meter.meterType] || typeColors.CUSTOM
                      }`}>
                        {typeLabels[meter.meterType] || meter.meterType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-bold text-slate-900 leading-none">
                        {meter.lastValue?.toLocaleString() ?? '—'}
                      </p>
                      <p className="text-xs text-slate-400 font-semibold mt-1">{meter.unit}</p>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-mono font-bold text-slate-600">
                      {meter._count.readings}
                    </td>
                    <td className="px-5 py-4 text-right text-xs font-semibold text-slate-400">
                      {formatDate(meter.lastReadingAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
