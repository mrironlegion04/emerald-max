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
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meters or assets..."
            className="input-field text-sm pl-9"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="input-field text-sm max-w-[160px]"
        >
          <option value="">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{typeLabels[t] || t}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {filtered.length} of {meters.length}
        </span>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading meters...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Gauge className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {meters.length === 0 ? 'No meters configured yet' : 'No meters match your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Meter</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Readings</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last reading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(meter => (
                <tr key={meter.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/assets/${meter.assetId}/meters/${meter.id}`}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {meter.name}
                      {meter.isPrimary && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                          Primary
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/assets/${meter.assetId}`}
                      className="text-sm text-gray-700 hover:text-blue-600"
                    >
                      {meter.asset?.name ?? '—'}
                    </Link>
                    <p className="text-xs text-gray-400 font-mono">{meter.asset?.assetCode}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      typeColors[meter.meterType] || typeColors.CUSTOM
                    }`}>
                      {typeLabels[meter.meterType] || meter.meterType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {meter.lastValue?.toLocaleString() ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400">{meter.unit}</p>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-500">
                    {meter._count.readings}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {formatDate(meter.lastReadingAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
