'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gauge, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Meter {
  id: string
  name: string
  meterType: string
  unit: string
  isPrimary: boolean
  lastValue: number | null
  lastReadingAt: string | null
  description: string | null
  allowDecrease: boolean
  _count: { readings: number }
}

interface Props {
  assetId: string
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
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MeterListPanel({ assetId }: Props) {
  const router = useRouter()
  const [meters, setMeters] = useState<Meter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', unit: '', meterType: 'CUSTOM', description: '',
    allowDecrease: false,
  })

  useEffect(() => {
    fetchMeters()
  }, [assetId])

  async function fetchMeters() {
    try {
      const res = await fetch(`/api/assets/${assetId}/meters`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMeters(data)
    } catch {
      setError('Failed to load meters')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          unit: form.unit,
          meterType: form.meterType,
          description: form.description || null,
          allowDecrease: form.allowDecrease,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create meter')
        return
      }
      setShowForm(false)
      setForm({ name: '', unit: '', meterType: 'CUSTOM', description: '', allowDecrease: false })
      await fetchMeters()
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const METER_TYPES = [
    { value: 'RUNTIME', label: 'Runtime' },
    { value: 'DISTANCE', label: 'Distance' },
    { value: 'CYCLE', label: 'Cycle Count' },
    { value: 'TEMPERATURE', label: 'Temperature' },
    { value: 'PRESSURE', label: 'Pressure' },
    { value: 'CUSTOM', label: 'Custom' },
  ]

  const METER_UNITS_MAP: Record<string, string[]> = {
    RUNTIME: ['Hours', 'Days', 'Minutes'],
    DISTANCE: ['Miles', 'Kilometers', 'Meters', 'Feet'],
    CYCLE: ['Cycles', 'Revolutions', 'Operations', 'Starts'],
    TEMPERATURE: ['°C', '°F', 'K'],
    PRESSURE: ['PSI', 'Bar', 'kPa'],
    CUSTOM: ['kWh', 'Gallons', 'Liters', 'Pounds', 'Percentage', ''],
  }

  const availableUnits = METER_UNITS_MAP[form.meterType] || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">Meters</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add meter
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Create meter form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="input-field text-sm" placeholder="Engine Hours" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={form.meterType} onChange={e => setForm(p => ({ ...p, meterType: e.target.value, unit: '' }))}
                className="input-field text-sm">
                {METER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit *</label>
              <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                className="input-field text-sm" required>
                <option value="">— Select —</option>
                {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="input-field text-sm" placeholder="Optional" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.allowDecrease}
                  onChange={e => setForm(p => ({ ...p, allowDecrease: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300" />
                <span className="text-xs text-gray-600">Allow decreasing values (for pressure, temperature)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.name || !form.unit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 rounded transition-colors disabled:opacity-50">
              {saving ? 'Creating...' : 'Create meter'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 text-gray-700 text-xs font-medium py-1.5 rounded hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Meter list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400 text-xs">Loading meters...</div>
      ) : meters.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Gauge className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No meters configured</p>
          <p className="text-xs text-gray-400 mt-1">Add a meter to start tracking readings</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meters.map(meter => (
            <Link
              key={meter.id}
              href={`/assets/${assetId}/meters/${meter.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600">
                      {meter.name}
                    </p>
                    {meter.isPrimary && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                        Primary
                      </span>
                    )}
                  </div>
                  <span className={[
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-1',
                    typeColors[meter.meterType] || typeColors.CUSTOM,
                  ].join(' ')}>
                    {meter.meterType}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">
                    {meter.lastValue?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">{meter.unit}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(meter.lastReadingAt)}
                </span>
                <span>{meter._count.readings} readings</span>
                {!meter.allowDecrease && (
                  <span className="text-green-500" title="Monotonic (no decrease)">
                    <AlertCircle className="w-3 h-3" />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
