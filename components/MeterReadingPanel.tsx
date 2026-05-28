'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const METER_UNITS = [
  { value: 'Miles', label: 'Miles' },
  { value: 'Kilometers', label: 'Kilometers' },
  { value: 'Meters', label: 'Meters' },
  { value: 'Feet', label: 'Feet' },
  { value: 'Hours', label: 'Hours' },
  { value: 'Days', label: 'Days' },
  { value: 'Gallons', label: 'Gallons (US)' },
  { value: 'Liters', label: 'Liters' },
  { value: 'Cubic Meters', label: 'Cubic Meters' },
  { value: 'Pounds', label: 'Pounds' },
  { value: 'Kilograms', label: 'Kilograms' },
  { value: 'Tons', label: 'Tons (US)' },
  { value: 'Cycles', label: 'Cycles' },
  { value: 'Revolutions', label: 'Revolutions' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Starts', label: 'Starts' },
  { value: 'kWh', label: 'kWh (kilowatt-hours)' },
  { value: 'Watts', label: 'Watts' },
  { value: 'Kilowatts', label: 'Kilowatts' },
  { value: 'HP', label: 'Horsepower' },
  { value: 'PSI', label: 'PSI' },
  { value: 'Bar', label: 'Bar' },
  { value: 'kPa', label: 'kPa' },
  { value: 'GPM', label: 'GPM (Gallons/min)' },
  { value: 'LPM', label: 'LPM (Liters/min)' },
  { value: 'CFM', label: 'CFM (Cubic ft/min)' },
  { value: 'Percentage', label: 'Percentage (%)' },
  { value: 'Percentage (Hours left)', label: 'Percentage (Hours left)' },
]

interface MeterReading {
  id: string
  value: number
  unit: string
  readingDate: string
  notes?: string
  recordedBy?: string
  createdAt?: string
}

interface Props {
  assetId: string
  meterUnit?: string
  currentMeterValue?: number
}

export default function MeterReadingPanel({ assetId, meterUnit = '', currentMeterValue = 0 }: Props) {
  const router = useRouter()
  const [readings, setReadings] = useState<MeterReading[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [importMode, setImportMode] = useState(false)

  const [form, setForm] = useState({
    value: '',
    unit: meterUnit,
    notes: '',
  })

  const [bulkText, setBulkText] = useState('')

  // Fetch readings
  useEffect(() => {
    const fetchReadings = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/meter-readings`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setReadings(data)
      } catch (err) {
        console.error('Error fetching readings:', err)
        setError('Failed to load meter readings')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReadings()
  }, [assetId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      if (!form.value) {
        setError('Meter value is required')
        setIsSaving(false)
        return
      }

      const res = await fetch(`/api/assets/${assetId}/meter-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parseFloat(form.value),
          unit: form.unit || meterUnit,
          notes: form.notes || undefined,
          readingDate: new Date().toISOString(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save reading')
        setIsSaving(false)
        return
      }

      // Add new reading to list
      setReadings(prev => [data, ...prev])
      setForm({ value: '', unit: form.unit, notes: '' })
      setSuccess('Reading recorded successfully')
      setIsOpen(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(readingId: string) {
    try {
      const res = await fetch(`/api/assets/${assetId}/meter-readings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete')
        return
      }

      setReadings(prev => prev.filter(r => r.id !== readingId))
      setDeleteConfirm(null)
      setSuccess('Reading deleted')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to delete reading')
      console.error(err)
    }
  }

  async function handleBulkImport() {
    setError('')
    setIsSaving(true)

    try {
      const lines = bulkText.trim().split('\n')
      const readings_array = []

      for (const line of lines) {
        const parts = line.trim().split(',').map(p => p.trim())
        if (parts.length < 2) continue

        const value = parseFloat(parts[0])
        const unit = parts[1]
        const notes = parts[2] || undefined

        if (isNaN(value)) {
          setError(`Invalid number in line: ${line}`)
          setIsSaving(false)
          return
        }

        readings_array.push({ value, unit, notes })
      }

      if (readings_array.length === 0) {
        setError('No valid readings found')
        setIsSaving(false)
        return
      }

      const res = await fetch(`/api/assets/${assetId}/meter-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings: readings_array }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to import')
        setIsSaving(false)
        return
      }

      setSuccess(`${data.count} readings imported successfully`)
      setBulkText('')
      setImportMode(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)

      // Refetch readings
      const getRes = await fetch(`/api/assets/${assetId}/meter-readings`)
      if (getRes.ok) {
        const newReadings = await getRes.json()
        setReadings(newReadings)
      }
    } catch (err) {
      setError('Network error during import')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const latestReading = readings[0]
  const meterChange = latestReading && readings.length > 1
    ? latestReading.value - readings[1].value
    : null

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-sm">Meter readings</h2>
        <div className="flex gap-2">
          {!isOpen && (
            <button
              onClick={() => setImportMode(!importMode)}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              {importMode ? 'Cancel' : '📥 Bulk'}
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {isOpen ? 'Close' : '+ Log reading'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-1.5 rounded mb-3 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="text-xs text-green-600 bg-green-50 border border-green-100 px-2 py-1.5 rounded mb-3">
          ✓ {success}
        </div>
      )}

      {/* Current meter value */}
      {currentMeterValue !== undefined && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-600">Current value</p>
          <p className="text-2xl font-bold text-blue-700">
            {currentMeterValue.toLocaleString()} <span className="text-sm">{meterUnit}</span>
          </p>
          {meterChange !== null && (
            <p className="text-xs text-blue-600 mt-1">
              {meterChange > 0 ? '+' : ''}{meterChange.toLocaleString()} from last reading
            </p>
          )}
        </div>
      )}

      {/* Bulk import form */}
      {importMode && (
        <div className="space-y-3 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Paste readings (one per line: value,unit,notes)
            </label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="1000,kWh,Monthly check&#10;1050,kWh"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Format: value, unit, optional notes</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkImport}
              disabled={isSaving || !bulkText.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Importing...' : 'Import readings'}
            </button>
            <button
              type="button"
              onClick={() => setImportMode(false)}
              className="flex-1 border border-gray-300 text-gray-700 text-xs font-medium py-1.5 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log reading form */}
      {isOpen && !importMode && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Meter value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.value}
              onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
              placeholder="Enter meter reading"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit}
                onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">— Select unit —</option>
                {METER_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving || !form.value || !form.unit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save reading'}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reading history */}
      {isLoading ? (
        <div className="text-center py-6 text-gray-400 text-xs">Loading readings...</div>
      ) : readings.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-xs">No meter readings yet</div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {readings.map((reading, idx) => {
            const prevReading = readings[idx + 1]
            const diff = prevReading ? reading.value - prevReading.value : null

            return (
              <div
                key={reading.id}
                className="flex items-start justify-between gap-2 border border-gray-100 rounded p-2 bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-gray-900">
                      {reading.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">{reading.unit}</p>
                    {diff !== null && (
                      <p className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(reading.readingDate)}</p>
                  {reading.recordedBy && (
                    <p className="text-xs text-gray-400">by {reading.recordedBy}</p>
                  )}
                  {reading.notes && (
                    <p className="text-xs text-gray-500 italic mt-1">📝 {reading.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => setDeleteConfirm(deleteConfirm === reading.id ? null : reading.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs font-medium transition-opacity"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded p-2">
          <p className="text-xs text-red-700 mb-2">Delete this reading?</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(deleteConfirm)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1 rounded"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 border border-red-200 text-red-700 text-xs font-medium py-1 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
