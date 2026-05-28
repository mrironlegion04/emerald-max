'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Gauge, ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Clock,
  Download, Upload, Plus, ChevronDown,
} from 'lucide-react'
import MeterTrendChart from './MeterTrendChart'

interface MeterData {
  id: string
  name: string
  meterType: string
  unit: string
  isPrimary: boolean
  lastValue: number | null
  lastReadingAt: string | null
  description: string | null
  allowDecrease: boolean
  maxDeltaPerDay: number | null
  minDeltaPerDay: number | null
  _count: { readings: number }
}

interface Reading {
  id: string
  value: number
  readingDate: string
  notes: string | null
  source: string
  status: string
  createdAt: string
  recordedBy: string | null
}

interface Props {
  assetId: string
  assetName: string
  meter: MeterData
}

const typeLabels: Record<string, string> = {
  RUNTIME: 'Runtime',
  DISTANCE: 'Distance',
  CYCLE: 'Cycle',
  TEMPERATURE: 'Temperature',
  PRESSURE: 'Pressure',
  CUSTOM: 'Custom',
}

const statusColors: Record<string, string> = {
  VALID: 'bg-green-100 text-green-700',
  SUSPECT: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MeterDetailView({ assetId, assetName, meter: initialMeter }: Props) {
  const router = useRouter()
  const [meter, setMeter] = useState(initialMeter)
  const [readings, setReadings] = useState<Reading[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Reading form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formValue, setFormValue] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Bulk import
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const fetchReadings = useCallback(async (p: number) => {
    try {
      const res = await fetch(
        `/api/assets/${assetId}/meters/${meter.id}/readings?page=${p}&limit=50`,
      )
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setReadings(data.readings)
      setTotalCount(data.totalCount)
      setHasMore(data.hasMore)
    } catch {
      setError('Failed to load readings')
    } finally {
      setIsLoading(false)
    }
  }, [assetId, meter.id])

  useEffect(() => {
    fetchReadings(page)
  }, [page, fetchReadings])

  async function handleSubmitReading(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/meters/${meter.id}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parseFloat(formValue),
          notes: formNotes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return
      }
      setSuccess(`Reading of ${formValue} ${meter.unit} recorded`)
      setFormValue(''); setFormNotes(''); setShowForm(false)
      setMeter(prev => ({ ...prev, lastValue: data.value, lastReadingAt: data.readingDate }))
      await fetchReadings(1)
      setPage(1)
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkImport() {
    setError(''); setSaving(true)
    try {
      const lines = bulkText.trim().split('\n').filter(Boolean)
      const readings_array = lines.map(line => {
        const parts = line.split(',').map(p => p.trim())
        const value = parseFloat(parts[0])
        if (isNaN(value)) throw new Error(`Invalid number: ${parts[0]}`)
        return { value, notes: parts[1] || null }
      })

      const res = await fetch(`/api/assets/${assetId}/meters/${meter.id}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings: readings_array }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Import failed')
        return
      }
      const data = await res.json()
      setSuccess(`${data.count} readings imported`)
      setBulkText(''); setShowBulk(false)
      await fetchReadings(1)
      setPage(1)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  const delta = readings.length > 1
    ? readings[0].value - readings[1].value
    : null

  // Status change dropdown
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)

  useEffect(() => {
    if (!openStatusId) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-status-dropdown]')) {
        setOpenStatusId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openStatusId])

  async function handleStatusChange(readingId: string, newStatus: string) {
    try {
      const res = await fetch(
        `/api/assets/${assetId}/meters/${meter.id}/readings/${readingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update status')
        return
      }
      setReadings(prev =>
        prev.map(r => (r.id === readingId ? { ...r, status: newStatus } : r)),
      )
      setSuccess(`Reading marked as ${newStatus}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Network error')
    } finally {
      setOpenStatusId(null)
    }
  }

  const statusTransitions: Record<string, { label: string; value: string; color: string }[]> = {
    VALID: [
      { label: 'Mark SUSPECT', value: 'SUSPECT', color: 'text-amber-600' },
      { label: 'Mark REJECTED', value: 'REJECTED', color: 'text-red-600' },
    ],
    SUSPECT: [
      { label: 'Mark VALID', value: 'VALID', color: 'text-green-600' },
      { label: 'Mark REJECTED', value: 'REJECTED', color: 'text-red-600' },
    ],
    REJECTED: [
      { label: 'Restore VALID', value: 'VALID', color: 'text-green-600' },
    ],
  }

  return (
    <div className="space-y-6">
      {/* Meter header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Gauge className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{meter.name}</h1>
                {meter.isPrimary && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                    Primary
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  typeLabels[meter.meterType] ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {typeLabels[meter.meterType] || meter.meterType}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{assetName} · {meter._count.readings} readings</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              Bulk
            </button>
            <button
              onClick={() => { setShowForm(true); setShowBulk(false) }}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Log reading
            </button>
          </div>
        </div>
      </div>

      {/* Current value */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
        <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Current value</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-bold text-blue-900">
            {meter.lastValue?.toLocaleString() ?? '—'}
          </span>
          <span className="text-lg text-blue-600">{meter.unit}</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          {delta !== null && (
            <span className={`text-sm font-medium flex items-center gap-1 ${
              delta >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {delta >= 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {Math.abs(delta).toLocaleString()} from last reading
            </span>
          )}
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(meter.lastReadingAt)}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          ✓ {success}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Trend</h2>
        {readings.length < 2 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Record at least 2 readings to see a trend chart
          </div>
        ) : (
          <MeterTrendChart
            readings={[...readings].reverse()}
            unit={meter.unit}
          />
        )}
      </div>

      {/* Add reading form */}
      {showForm && (
        <form onSubmit={handleSubmitReading} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Log reading</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number" step="0.01" value={formValue}
                onChange={e => setFormValue(e.target.value)}
                placeholder={`Enter value in ${meter.unit}`}
                className="input-field text-sm" required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text" value={meter.unit} disabled
                className="input-field text-sm bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text" value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Optional"
                className="input-field text-sm"
              />
            </div>
          </div>
          {!meter.allowDecrease && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
              This meter does not allow decreasing values
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !formValue}
              className="btn-primary text-sm">
              {saving ? 'Saving...' : 'Save reading'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Bulk import */}
      {showBulk && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Bulk import</h2>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="1000, Monthly reading&#10;1050, After service&#10;1100, "
            rows={5}
            className="input-field text-sm font-mono resize-none"
          />
          <p className="text-xs text-gray-400">Format: value, optional notes (one per line)</p>
          <div className="flex gap-2">
            <button onClick={handleBulkImport} disabled={saving || !bulkText.trim()}
              className="btn-primary text-sm">
              {saving ? 'Importing...' : `Import ${bulkText.trim().split('\n').filter(Boolean).length} readings`}
            </button>
            <button onClick={() => setShowBulk(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Validation rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Validation rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Allow decrease</p>
            <span className={`font-semibold ${meter.allowDecrease ? 'text-green-600' : 'text-red-600'}`}>
              {meter.allowDecrease ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Max delta / day</p>
            <p className="font-semibold text-gray-900">
              {meter.maxDeltaPerDay ? `${meter.maxDeltaPerDay.toLocaleString()} ${meter.unit}` : '—'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Min delta / day</p>
            <p className="font-semibold text-gray-900">
              {meter.minDeltaPerDay ? `${meter.minDeltaPerDay.toLocaleString()} ${meter.unit}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Readings list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">
            Reading history
            <span className="ml-2 text-gray-400 font-normal">({totalCount})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading readings...</div>
        ) : readings.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            <Gauge className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            No readings yet. Log your first reading above.
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {readings.map((reading, idx) => {
                const prevReading = readings[idx + 1]
                const diff = prevReading ? reading.value - prevReading.value : null

                return (
                  <div key={reading.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-gray-900">
                          {reading.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-gray-400">{meter.unit}</span>
                        {diff !== null && (
                          <span className={`text-xs font-medium ${
                            diff >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {diff >= 0 ? '+' : ''}{diff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{formatDate(reading.readingDate)}</span>
                        <div className="relative" data-status-dropdown>
                          <button
                            onClick={() => setOpenStatusId(openStatusId === reading.id ? null : reading.id)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 ${
                              statusColors[reading.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {reading.status}
                            <ChevronDown className="w-2.5 h-2.5" />
                          </button>
                          {openStatusId === reading.id && (
                            <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                              {statusTransitions[reading.status]?.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleStatusChange(reading.id, opt.value)}
                                  className={`block w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${opt.color}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase">{reading.source}</span>
                        {reading.recordedBy && (
                          <span className="text-xs text-gray-400">by {reading.recordedBy}</span>
                        )}
                      </div>
                      {reading.notes && (
                        <p className="text-xs text-gray-500 mt-1">{reading.notes}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-400">
                Page {page} of {Math.ceil(totalCount / 50) || 1}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
                className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
