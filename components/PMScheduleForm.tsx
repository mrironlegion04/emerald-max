'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Star } from 'lucide-react'
import AssetTreeSelect from './AssetTreeSelect'
import LocationSelect from './LocationSelect'

interface SimpleMeter {
  id: string
  name: string
  unit: string
  meterType: string
  isPrimary: boolean
  lastValue: number | null
}

interface Asset    { id: string; name: string; assetCode: string | null; imageUrl?: string | null; parentId?: string | null; locationId?: string | null; categoryId?: string | null }
interface Location { id: string; name: string; address: string | null; path: string | null; parentId: string | null }
interface Procedure {
  id: string; name: string; description?: string | null; steps?: { id: string }[]
  locations?: { id: string }[]
  categories?: { id: string }[]
  assets?: { id: string }[]
}

interface PMFormData {
  title: string; description: string
  triggerType: string; frequency: string; interval: string
  meterInterval: string; meterUnit: string; meterId: string
  nextDueDate: string; assetId: string; locationId: string; locationScope: string; isActive: boolean
  procedureIds: string[]
}

interface Props {
  assets:     Asset[]
  locations:  Location[]
  procedures?: Procedure[]
  initialData?: Partial<PMFormData>
  scheduleId?: string
  preselectedAssetId?: string
}

const freqOptions = [
  { value: 'DAILY',     label: 'Daily' },
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY',    label: 'Yearly' },
]

const METER_UNITS = [
  // Distance
  { value: 'Miles', label: 'Miles' },
  { value: 'Kilometers', label: 'Kilometers' },
  { value: 'Meters', label: 'Meters' },
  { value: 'Feet', label: 'Feet' },
  // Time
  { value: 'Hours', label: 'Hours' },
  { value: 'Days', label: 'Days' },
  // Volume
  { value: 'Gallons', label: 'Gallons (US)' },
  { value: 'Liters', label: 'Liters' },
  { value: 'Cubic Meters', label: 'Cubic Meters' },
  // Weight
  { value: 'Pounds', label: 'Pounds' },
  { value: 'Kilograms', label: 'Kilograms' },
  { value: 'Tons', label: 'Tons (US)' },
  // Counts
  { value: 'Cycles', label: 'Cycles' },
  { value: 'Revolutions', label: 'Revolutions' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Starts', label: 'Starts' },
  // Power/Energy
  { value: 'kWh', label: 'kWh (kilowatt-hours)' },
  { value: 'Watts', label: 'Watts' },
  { value: 'Kilowatts', label: 'Kilowatts' },
  { value: 'HP', label: 'Horsepower' },
  // Pressure
  { value: 'PSI', label: 'PSI' },
  { value: 'Bar', label: 'Bar' },
  { value: 'kPa', label: 'kPa' },
  // Flow
  { value: 'GPM', label: 'GPM (Gallons/min)' },
  { value: 'LPM', label: 'LPM (Liters/min)' },
  { value: 'CFM', label: 'CFM (Cubic ft/min)' },
  // Other
  { value: 'Percentage', label: 'Percentage (%)' },
  { value: 'Percentage (Hours left)', label: 'Percentage (Hours left)' },
]

// Default next due = 1 week from today
function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

export default function PMScheduleForm({ assets, locations, procedures = [], initialData, scheduleId, preselectedAssetId }: Props) {
  const router = useRouter()
  const isEdit = !!scheduleId

  const [form, setForm] = useState<PMFormData>({
    title:              initialData?.title              ?? '',
    description:        initialData?.description        ?? '',
    triggerType:        initialData?.triggerType        ?? 'TIME',
    frequency:          initialData?.frequency          ?? 'MONTHLY',
    interval:           initialData?.interval           ?? '1',
    meterInterval:      initialData?.meterInterval?.toString() ?? '',
    meterUnit:          initialData?.meterUnit          ?? '',
    meterId:            (initialData as any)?.meterId   ?? '',
    nextDueDate:        initialData?.nextDueDate        ?? defaultDueDate(),
    assetId:            initialData?.assetId            ?? preselectedAssetId ?? '',
    locationId:         initialData?.locationId         ?? '',
    locationScope:      initialData?.locationScope      ?? 'ALL_ASSETS',
    isActive:           initialData?.isActive           ?? true,
    procedureIds:       (initialData as any)?.procedures?.map((p: any) => p.procedure?.id || p.procedureId).filter(Boolean) ?? (initialData as any)?.procedureIds ?? [],
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [targetType, setTargetType] = useState<'ASSET' | 'LOCATION'>(
    (initialData?.locationId && !initialData?.assetId && !preselectedAssetId) ? 'LOCATION' : 'ASSET'
  )

  const handleToggleTarget = (type: 'ASSET' | 'LOCATION') => {
    setTargetType(type)
    if (type === 'ASSET') {
      setForm(prev => ({ ...prev, locationId: '', locationScope: 'ALL_ASSETS' }))
    } else {
      setForm(prev => ({ ...prev, assetId: '' }))
    }
  }

  function set(field: keyof PMFormData, value: string | boolean | string[]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Smart recommendation: determine which procedures match the selected asset/location
  const recommendedIds = useMemo(() => {
    const ids = new Set<string>()
    if (!form.assetId && !form.locationId) return ids

    const selectedAsset = assets.find(a => a.id === form.assetId)
    const selectedAssetCategoryId = selectedAsset?.categoryId

    for (const p of procedures) {
      const matchesAsset   = form.assetId && p.assets?.some(a => a.id === form.assetId)
      const matchesCategory = form.assetId && selectedAssetCategoryId && p.categories?.some(c => c.id === selectedAssetCategoryId)
      const matchesLocation = form.locationId && p.locations?.some(l => l.id === form.locationId)
      if (matchesAsset || matchesCategory || matchesLocation) ids.add(p.id)
    }
    return ids
  }, [form.assetId, form.locationId, procedures, assets])

  // Sort: recommended first, then others
  const sortedProcedures = useMemo(() => {
    return [...procedures].sort((a, b) => {
      const aRec = recommendedIds.has(a.id) ? 0 : 1
      const bRec = recommendedIds.has(b.id) ? 0 : 1
      return aRec - bRec
    })
  }, [procedures, recommendedIds])

  const hasRecommendations = recommendedIds.size > 0 && (!!form.assetId || !!form.locationId)

  // Fetch meters for the selected asset
  const [meters, setMeters] = useState<SimpleMeter[]>([])
  const [loadingMeters, setLoadingMeters] = useState(false)
  useEffect(() => {
    if (!form.assetId) { setMeters([]); return }
    setLoadingMeters(true)
    fetch(`/api/assets/${form.assetId}/meters`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMeters(data))
      .catch(() => setMeters([]))
      .finally(() => setLoadingMeters(false))
  }, [form.assetId])

  function handleMeterChange(meterId: string) {
    const meter = meters.find(m => m.id === meterId)
    set('meterId', meterId)
    set('meterUnit', meter?.unit ?? '')
    if (meter?.lastValue != null) {
      set('meterInterval', String(meter.lastValue))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    if (!form.assetId && !form.locationId) { setError('Either Asset or Location must be selected'); setSaving(false); return }
    try {
      const payload = {
        title:                form.title,
        description:          form.description || null,
        triggerType:          form.triggerType,
        frequency:            form.frequency,
        interval:             parseInt(form.interval),
        nextDueDate:          form.nextDueDate,
        meterId:              form.triggerType === 'METER' ? (form.meterId || null) : null,
        meterInterval:        form.triggerType === 'METER' ? parseFloat(form.meterInterval) : null,
        meterUnit:            form.triggerType === 'METER' ? form.meterUnit : null,
        assetId:              form.assetId || null,
        locationId:           form.locationId || null,
        locationScope:        form.locationId && !form.assetId ? form.locationScope : null,
        procedureIds:         form.procedureIds,
        checklistTemplateIds: form.procedureIds, // Backwards compatible support
      }
      const url    = isEdit ? `/api/pm/${scheduleId}` : '/api/pm'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/preventive-maintenance/${data.id}`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Core info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Schedule details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            className="input-field" placeholder="e.g. Monthly oil change" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input-field resize-none" rows={3}
            placeholder="Describe the maintenance tasks to be performed..." />
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Maintenance Target</p>
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => handleToggleTarget('ASSET')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'ASSET'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Asset
            </button>
            <button
              type="button"
              onClick={() => handleToggleTarget('LOCATION')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                targetType === 'LOCATION'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Location
            </button>
          </div>
        </div>

        {targetType === 'ASSET' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
            <AssetTreeSelect
              assets={assets}
              value={form.assetId}
              onChange={id => set('assetId', id)}
              placeholder="— Select an asset —"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <LocationSelect
                locations={locations}
                value={form.locationId}
                onChange={id => set('locationId', id)}
                placeholder="— Select a location —"
              />
            </div>

            {form.locationId && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600">Scope of work</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="ALL_ASSETS"
                      checked={form.locationScope === 'ALL_ASSETS'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">All Assets in this Location</p>
                      <p className="text-xs text-gray-500">Creates procedure execution instances for each asset recursively</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="locationScope"
                      value="GENERAL"
                      checked={form.locationScope === 'GENERAL'}
                      onChange={e => set('locationScope', e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">General Maintenance</p>
                      <p className="text-xs text-gray-500">Location-only ticket (no asset-specific procedures)</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trigger type & Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Trigger type</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => set('triggerType', 'TIME')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'TIME'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Time-based
          </button>
          <button
            type="button"
            onClick={() => set('triggerType', 'METER')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
              form.triggerType === 'METER'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Meter-based
          </button>
        </div>

        {form.triggerType === 'TIME' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat every</label>
                <input type="number" min="1" max="365" value={form.interval}
                  onChange={e => set('interval', e.target.value)}
                  className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="input-field">
                  {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Schedule preview:</span>{' '}
                This task will repeat every {form.interval === '1' ? '' : `${form.interval} `}
                {freqOptions.find(f => f.value === form.frequency)?.label.toLowerCase() ?? 'month'}.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.assetId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meter <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.meterId}
                    onChange={e => handleMeterChange(e.target.value)}
                    className="input-field" required
                  >
                    <option value="">— Select meter —</option>
                    {loadingMeters ? (
                      <option disabled>Loading...</option>
                    ) : meters.length === 0 ? (
                      <option disabled>No meters on this asset</option>
                    ) : (
                      meters.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit}){m.isPrimary ? ' ★' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Select the meter that triggers this schedule</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meter unit <span className="text-red-500">*</span>
                  </label>
                  <select value={form.meterUnit}
                    onChange={e => set('meterUnit', e.target.value)}
                    className="input-field" required>
                    <option value="">— Select unit —</option>
                    {METER_UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Select from standard CMMS meter units</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter threshold <span className="text-red-500">*</span>
                </label>
                <input type="number" step="0.01" value={form.meterInterval}
                  onChange={e => set('meterInterval', e.target.value)}
                  placeholder="e.g. 10000"
                  className="input-field" required />
                <p className="text-xs text-gray-400 mt-1">WO generates when meter reaches this value</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">
                <span className="font-medium">Meter-based schedule:</span>{' '}
                Work orders will be generated when the meter reading reaches {form.meterInterval || '—'} {form.meterUnit || 'units'}.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Next due date <span className="text-red-500">*</span>
          </label>
          <input type="date" value={form.nextDueDate} onChange={e => set('nextDueDate', e.target.value)}
            className="input-field" required />
          <p className="text-xs text-gray-400 mt-1">
            {form.triggerType === 'TIME'
              ? 'After a work order is generated, this date will advance by the frequency interval.'
              : 'Start date for tracking meter-based maintenance. Does not auto-advance.'}
          </p>
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => set('isActive', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Schedule is active
            </label>
          </div>
        )}
      </div>

      {/* Procedures */}
      {procedures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Procedures</h2>
          </div>
          <p className="text-xs text-gray-450 text-slate-400">
            Select one or more Procedures to be automatically applied when work orders are generated from this schedule.
          </p>

          {/* Recommended section */}
          {hasRecommendations && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                Recommended Procedures
              </div>
              {sortedProcedures.filter(p => recommendedIds.has(p.id)).map(proc => (
                <label key={proc.id} className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50/50 rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={form.procedureIds.includes(proc.id)}
                    onChange={e => {
                      const newIds = e.target.checked
                        ? [...form.procedureIds, proc.id]
                        : form.procedureIds.filter(id => id !== proc.id)
                      set('procedureIds', newIds)
                    }}
                    className="w-4 h-4 text-emerald-605 rounded border-gray-300 pointer-events-none"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{proc.name}</p>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-705 text-[10px] font-bold rounded-full">
                        <Star className="w-2.5 h-2.5 fill-emerald-505" />
                        Recommended
                      </span>
                    </div>
                    {proc.description && (
                      <p className="text-xs text-gray-500">{proc.description}</p>
                    )}
                    {proc.steps && proc.steps.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{proc.steps.length} steps</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* All procedures section */}
          <div className="space-y-2">
            {hasRecommendations && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">
                All procedures
              </div>
            )}
            {sortedProcedures.filter(p => !recommendedIds.has(p.id)).map(proc => (
              <label key={proc.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={form.procedureIds.includes(proc.id)}
                  onChange={e => {
                    const newIds = e.target.checked
                      ? [...form.procedureIds, proc.id]
                      : form.procedureIds.filter(id => id !== proc.id)
                    set('procedureIds', newIds)
                  }}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{proc.name}</p>
                  {proc.description && (
                    <p className="text-xs text-gray-500">{proc.description}</p>
                  )}
                  {proc.steps && proc.steps.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{proc.steps.length} steps</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {form.procedureIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {form.procedureIds.length} Procedure{form.procedureIds.length !== 1 ? 's' : ''} will auto-apply to all generated work orders
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create schedule'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
