'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AssetImageUpload from './AssetImageUpload'
import CustomFieldsPanel from './CustomFieldsPanel'
import CategorySelect from './CategorySelect'
import LocationSelect from './LocationSelect'

interface Category {
  id: string
  name: string
  parentId: string | null
}

interface AssetType {
  id: string
  name: string
}

interface Location  { id: string; name: string; parentId: string | null }
interface Asset { id: string; name: string; assetCode: string | null; parentId: string | null }
interface User { id: string; name: string }

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

interface AssetFormData {
  name: string
  assetCode: string | undefined
  description: string
  status: string
  serialNumber: string
  model: string
  manufacturer: string
  purchaseDate: string
  purchaseCost: string
  categoryId: string
  locationId: string
  meterUnit: string
  parentId: string
  assetTypeId: string
  criticality: string
  ownerId: string
  primaryTeamId: string
  customFields: Record<string, any> | null
}

interface Team { id: string; name: string }

interface Props {
  categories: Category[]
  assetTypes: AssetType[]
  locations: Location[]
  assets: Asset[]
  users?: User[]
  teams?: Team[]
  initialData?: Partial<AssetFormData>
  assetId?: string
  currentImageUrl?: string | null
}

const statusOptions = [
  { value: 'ACTIVE',            label: 'Active' },
  { value: 'INACTIVE',          label: 'Inactive' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'DECOMMISSIONED',    label: 'Decommissioned' },
]


export default function AssetForm({
  categories,
  assetTypes,
  locations,
  assets,
  users = [],
  teams = [],
  initialData,
  assetId,
  currentImageUrl,
}: Props) {
  const router = useRouter()
  const isEdit = !!assetId

  const [form, setForm] = useState<AssetFormData>({
    name:         initialData?.name         ?? '',
    assetCode:    initialData?.assetCode    ?? '',
    description:  initialData?.description  ?? '',
    status:       initialData?.status       ?? 'ACTIVE',
    serialNumber: initialData?.serialNumber ?? '',
    model:        initialData?.model        ?? '',
    manufacturer: initialData?.manufacturer ?? '',
    purchaseDate: initialData?.purchaseDate ?? '',
    purchaseCost: initialData?.purchaseCost ?? '',
    categoryId:   initialData?.categoryId  ?? '',
    locationId:   initialData?.locationId  ?? '',
    meterUnit:    initialData?.meterUnit    ?? '',
    parentId:     initialData?.parentId    ?? '',
    assetTypeId:  initialData?.assetTypeId  ?? '',
    criticality:  initialData?.criticality  ?? '',
    ownerId:      initialData?.ownerId      ?? '',
    primaryTeamId: initialData?.primaryTeamId ?? '',
    customFields: initialData?.customFields ?? null,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>(currentImageUrl || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  function set(field: keyof AssetFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        ...form,
        purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : null,
        purchaseDate: form.purchaseDate || null,
        categoryId:  form.categoryId  || null,
        locationId:  form.locationId  || null,
        primaryTeamId: form.primaryTeamId || null,
        serialNumber: form.serialNumber || null,
        model:        form.model        || null,
        manufacturer: form.manufacturer || null,
        description:  form.description  || null,
        meterUnit:    form.meterUnit    || null,
        parentId:     form.parentId     || null,
        assetTypeId:  form.assetTypeId  || null,
        criticality:  form.criticality  || null,
        ownerId:      form.ownerId      || null,
        customFields: form.customFields,
      }

      const url    = isEdit ? `/api/assets/${assetId}` : '/api/assets'
      const method = isEdit ? 'PUT' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }

      if (photoFile) {
        setUploadingPhoto(true)
        try {
          const formData = new FormData()
          formData.append('photo', photoFile)
          await fetch(`/api/assets/${data.id}/photo`, { method: 'POST', body: formData })
        } catch (photoError) {
          console.error('Photo upload error:', photoError)
        } finally {
          setUploadingPhoto(false)
        }
      }

      router.push(`/assets/${data.id}`)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  function handlePhotoSelect(file: File, preview: string) {
    setPhotoFile(file)
    setPhotoPreview(preview)
  }

  // Exclude self + descendants from parent selector
  const availableParents = useMemo(() => {
    if (!isEdit || !assetId) return assets
    const descendantIds = new Set<string>()
    const queue = [assetId]
    while (queue.length > 0) {
      const currentId = queue.shift()!
      assets.filter(a => a.parentId === currentId).forEach(c => {
        if (!descendantIds.has(c.id)) { descendantIds.add(c.id); queue.push(c.id) }
      })
    }
    return assets.filter((a: Asset) => a.id !== assetId && !descendantIds.has(a.id))
  }, [assets, isEdit, assetId])

  const forcedParent = !isEdit && initialData?.parentId ? assets.find(a => a.id === initialData.parentId) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Basic information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asset name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input-field"
              placeholder="e.g. Air Compressor #1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asset code {!form.parentId && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.assetCode}
              onChange={e => set('assetCode', e.target.value)}
              className="input-field font-mono"
              placeholder={form.parentId ? 'Optional (auto-generated if empty)' : 'e.g. AST-005'}
              required={!form.parentId}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="input-field"
            >
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          <div className="md:col-span-2">
            <AssetImageUpload
              onImageSelect={handlePhotoSelect}
              currentImageUrl={currentImageUrl || undefined}
              assetName={form.name || 'Asset'}
            />
          </div>
        </div>
      </div>

      {/* Hierarchy */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Hierarchy</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent asset</label>
          {forcedParent ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{forcedParent.name}</p>
                <p className="text-xs text-gray-500 font-mono">{forcedParent.assetCode}</p>
              </div>
              <button
                type="button"
                onClick={() => set('parentId', '')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <select
              value={form.parentId}
              onChange={e => set('parentId', e.target.value)}
              className="input-field"
            >
              <option value="">— Root asset (no parent) —</option>
              {availableParents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.assetCode})
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {forcedParent
              ? 'This asset will be created as a sub-asset of the one selected above.'
              : 'Select a parent asset to create a sub-asset. Leave blank for a root-level asset.'}
          </p>
        </div>
      </div>

      {/* Classification */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-1">Classification</h2>
        <p className="text-xs text-gray-400 mb-4">
          Category and type are managed by your admin in Settings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Category: custom visual hierarchy dropdown ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <CategorySelect
              categories={categories}
              value={form.categoryId}
              onChange={id => set('categoryId', id)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
            <select
              value={form.criticality}
              onChange={e => set('criticality', e.target.value)}
              className="input-field"
            >
              <option value="">— Not specified —</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* ── Asset Type: flat dropdown ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset type</label>
            {assetTypes.length > 0 ? (
              <select
                id="asset-type-select"
                value={form.assetTypeId}
                onChange={e => set('assetTypeId', e.target.value)}
                className="input-field"
              >
                <option value="">— No type —</option>
                {assetTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : (
              <div>
                <select
                  id="asset-type-select-disabled"
                  disabled
                  className="input-field bg-gray-50 opacity-75 cursor-not-allowed text-gray-400"
                >
                  <option value="">— No custom types —</option>
                </select>
                <p className="text-xs text-gray-400 mt-1.5">
                  No custom types active.{' '}
                  <a href="/settings/asset-types" className="text-blue-600 hover:underline font-medium">
                    Configure them in Settings →
                  </a>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <LocationSelect
              locations={locations}
              value={form.locationId}
              onChange={id => set('locationId', id)}
            />
          </div>

          {users.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select
                value={form.ownerId}
                onChange={e => set('ownerId', e.target.value)}
                className="input-field"
              >
                <option value="">— No owner —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Team</label>
              <select
                value={form.primaryTeamId}
                onChange={e => set('primaryTeamId', e.target.value)}
                className="input-field"
              >
                <option value="">— No primary team —</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Technical details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Technical details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input
              type="text"
              value={form.manufacturer}
              onChange={e => set('manufacturer', e.target.value)}
              className="input-field"
              placeholder="e.g. Atlas Copco"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={form.model}
              onChange={e => set('model', e.target.value)}
              className="input-field"
              placeholder="e.g. GA37"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial number</label>
            <input
              type="text"
              value={form.serialNumber}
              onChange={e => set('serialNumber', e.target.value)}
              className="input-field"
              placeholder="e.g. AC-2021-00123"
            />
          </div>
        </div>
      </div>

      {/* Purchase info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Purchase information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase date</label>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={e => set('purchaseDate', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase cost ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchaseCost}
              onChange={e => set('purchaseCost', e.target.value)}
              className="input-field"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Meter configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Meter configuration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meter unit (optional)
            </label>
            <select
              value={form.meterUnit}
              onChange={e => set('meterUnit', e.target.value)}
              className="input-field"
            >
              <option value="">— Not metered —</option>
              {METER_UNITS.map(unit => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Enable meter readings tracking and meter-based preventive maintenance for this asset
            </p>
          </div>
        </div>
      </div>

      {/* Custom fields */}
      <CustomFieldsPanel
        fields={form.customFields}
        onChange={fields => setForm(prev => ({ ...prev, customFields: fields }))}
      />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || uploadingPhoto} className="btn-primary">
          {saving ? 'Saving...' : uploadingPhoto ? 'Uploading photo...' : isEdit ? 'Save changes' : 'Create asset'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={saving || uploadingPhoto}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
