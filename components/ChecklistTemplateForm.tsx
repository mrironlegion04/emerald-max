'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, GripVertical, AlertCircle, X, Search } from 'lucide-react'

const STEP_TYPE_OPTIONS = [
  { value: 'CHECKBOX', label: 'Checkbox' },
  { value: 'TEXT_INPUT', label: 'Text Input' },
  { value: 'NUMBER_INPUT', label: 'Number Input' },
  { value: 'SINGLE_SELECT', label: 'Single Select' },
  { value: 'INSPECTION', label: 'Pass / Fail' },
  { value: 'SIGNATURE', label: 'Signature' },
] as const

interface TemplateItem {
  id?: string
  label: string
  type: string
  isMandatory: boolean
  options: string[]
  sortOrder: number
}

interface SelectOption {
  id: string
  name: string
}

interface Props {
  templateId?: string
  initialData?: {
    name: string
    description: string
    items: TemplateItem[]
    assetIds?: string[]
    categoryIds?: string[]
    locationIds?: string[]
  }
  assets?: SelectOption[]
  assetCategories?: SelectOption[]
  locations?: SelectOption[]
}

function MultiTagSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string
  options: SelectOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(query.toLowerCase())
  )

  const selectedLabels = selected.map(id => options.find(o => o.id === id)).filter(Boolean) as SelectOption[]

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    )
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div
        className="input-field flex flex-wrap gap-1.5 min-h-[2.5rem] py-1.5 cursor-text"
        onClick={() => { setOpen(true); setQuery('') }}
      >
        {selectedLabels.length === 0 && !open && (
          <span className="text-gray-400 text-sm">{placeholder ?? 'Select...'}</span>
        )}
        {selectedLabels.map(opt => (
          <span key={opt.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {opt.name}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(opt.id) }}
              className="hover:text-blue-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-md px-2 py-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm flex-1"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No options found</p>
            ) : (
              filtered.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-900">{opt.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChecklistTemplateForm({ templateId, initialData, assets, assetCategories, locations }: Props) {
  const router = useRouter()
  const isEdit = !!templateId

  const [name,       setName]       = useState(initialData?.name ?? '')
  const [description,setDescription] = useState(initialData?.description ?? '')
  const [items,      setItems]      = useState<TemplateItem[]>(initialData?.items ?? [])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const [selectedAssetIds,    setSelectedAssetIds]    = useState<string[]>(initialData?.assetIds ?? [])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialData?.categoryIds ?? [])
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(initialData?.locationIds ?? [])

  function addItem() {
    setItems(prev => [...prev, { label: '', type: 'CHECKBOX', isMandatory: false, options: [], sortOrder: prev.length }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })))
  }

  function updateItem<K extends keyof TemplateItem>(idx: number, field: K, value: TemplateItem[K]) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addOption(idx: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, options: [...it.options, ''] } : it))
  }

  function removeOption(idx: number, optIdx: number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, options: it.options.filter((_, oi) => oi !== optIdx) } : it))
  }

  function updateOption(idx: number, optIdx: number, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, options: it.options.map((o, oi) => oi === optIdx ? value : o) } : it))
  }

  function moveItem(idx: number, direction: -1 | 1) {
    setItems(prev => {
      const arr = [...prev]
      const target = idx + direction
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some(it => !it.label.trim())) {
      setError('All checklist items must have a label')
      return
    }
    if (items.some(it => it.type === 'SINGLE_SELECT' && it.options.some(o => !o.trim()))) {
      setError('All SINGLE_SELECT options must have a label')
      return
    }
    setError(''); setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        items: items.map((it, i) => ({
          label:       it.label.trim(),
          type:        it.type,
          isMandatory: it.isMandatory,
          options:     it.type === 'SINGLE_SELECT' ? it.options.map(o => o.trim()).filter(Boolean) : [],
          sortOrder:   i,
        })),
        assetIds:    selectedAssetIds,
        categoryIds: selectedCategoryIds,
        locationIds: selectedLocationIds,
      }
      const url    = isEdit ? `/api/checklist-templates/${templateId}` : '/api/checklist-templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push('/settings/checklist-templates')
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  const showTagSection = assets || assetCategories || locations

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Template info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Template details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field"
            placeholder="e.g. Monthly Pump Inspection"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input-field resize-none"
            rows={2}
            placeholder="Optional description of this template..."
          />
        </div>
      </div>

      {/* Tag associations */}
      {showTagSection && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">
            Tag associations <span className="text-xs font-normal text-gray-400 ml-1">— metadata only, no restrictions</span>
          </h2>
          <p className="text-xs text-gray-400">
            Optionally tag this template with locations, categories, and assets for easy filtering and smart recommendations.
          </p>
          <div className="space-y-4">
            {locations && (
              <MultiTagSelect
                label="Locations"
                options={locations}
                selected={selectedLocationIds}
                onChange={setSelectedLocationIds}
                placeholder="Select locations..."
              />
            )}
            {assetCategories && (
              <MultiTagSelect
                label="Asset Categories"
                options={assetCategories}
                selected={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                placeholder="Select asset categories..."
              />
            )}
            {assets && (
              <MultiTagSelect
                label="Assets"
                options={assets}
                selected={selectedAssetIds}
                onChange={setSelectedAssetIds}
                placeholder="Select assets..."
              />
            )}
          </div>
        </div>
      )}

      {/* Checklist items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Checklist items ({items.length})</h2>
          <button type="button" onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add item
          </button>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm">No items yet. Click &quot;Add item&quot; to get started.</p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col bg-gray-50 rounded-lg px-3 py-2.5 group">
              <div className="flex items-center gap-3">
                {/* Reorder controls */}
                <div className="flex flex-col gap-0.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0">
                  <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                    className="hover:text-gray-700 disabled:opacity-30 leading-none text-xs">▲</button>
                  <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                    className="hover:text-gray-700 disabled:opacity-30 leading-none text-xs">▼</button>
                </div>
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                {/* Label */}
                <input
                  type="text"
                  value={item.label}
                  onChange={e => updateItem(idx, 'label', e.target.value)}
                  placeholder={`Item ${idx + 1}...`}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400 min-w-0"
                />

                {/* Step type selector */}
                <select
                  value={item.type}
                  onChange={e => {
                    updateItem(idx, 'type', e.target.value)
                    if (e.target.value !== 'SINGLE_SELECT') updateItem(idx, 'options', [])
                  }}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 flex-shrink-0"
                >
                  {STEP_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Mandatory toggle */}
                <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.isMandatory}
                    onChange={e => updateItem(idx, 'isMandatory', e.target.checked)}
                    className="w-3.5 h-3.5 text-red-600 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">Req</span>
                </label>

                <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options editor for SINGLE_SELECT */}
              {item.type === 'SINGLE_SELECT' && (
                <div className="ml-10 mt-2 space-y-1.5">
                  {item.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(idx, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 placeholder-gray-400"
                      />
                      <button type="button" onClick={() => removeOption(idx, oi)} className="text-gray-300 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(idx)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add option
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <p className="text-xs text-gray-400">
            {items.filter(i => i.isMandatory).length} mandatory · {items.filter(i => i.type !== 'CHECKBOX').length} typed step{items.filter(i => i.type !== 'CHECKBOX').length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create template'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
