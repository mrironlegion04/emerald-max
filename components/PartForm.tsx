'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PartFormData {
  name: string; partNumber: string; description: string
  unitCost: string; unit: string
}

interface Props {
  initialData?: Partial<PartFormData>
  partId?: string
}

const unitOptions = [
  { value: 'pcs',  label: 'Pieces (pcs)' },
  { value: 'l',    label: 'Litres (l)' },
  { value: 'ml',   label: 'Millilitres (ml)' },
  { value: 'kg',   label: 'Kilograms (kg)' },
  { value: 'g',    label: 'Grams (g)' },
  { value: 'm',    label: 'Metres (m)' },
  { value: 'ft',   label: 'Feet (ft)' },
  { value: 'box',  label: 'Box' },
  { value: 'roll', label: 'Roll' },
  { value: 'set',  label: 'Set' },
]

export default function PartForm({ initialData, partId }: Props) {
  const router = useRouter()
  const isEdit = !!partId

  const [form, setForm] = useState<PartFormData>({
    name:        initialData?.name        ?? '',
    partNumber:  initialData?.partNumber  ?? '',
    description: initialData?.description ?? '',
    unitCost:    initialData?.unitCost    ?? '',
    unit:        initialData?.unit        ?? 'pcs',
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(field: keyof PartFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const payload = {
        ...form,
        quantity:    0,
        minQuantity: 0,
        unitCost:    form.unitCost ? parseFloat(form.unitCost) : null,
        description: form.description || null,
      }
      const url    = isEdit ? `/api/inventory/${partId}` : '/api/inventory'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/inventory/${data.id}`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Part information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Part name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className="input-field" placeholder="e.g. Drive Belt V-Type" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Part number <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.partNumber} onChange={e => set('partNumber', e.target.value)}
              className="input-field font-mono" placeholder="e.g. PRT-BELT-02" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className="input-field">
              {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input-field resize-none" rows={2} placeholder="Optional description..." />
          </div>
        </div>
      </div>

      {/* Cost & Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit cost (INR)</label>
            <input type="number" min="0" step="0.01" value={form.unitCost}
              onChange={e => set('unitCost', e.target.value)}
              className="input-field" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add part'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
