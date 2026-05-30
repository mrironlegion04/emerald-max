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

interface ProcedureStep {
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
    steps: ProcedureStep[]
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
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      <div
        className="input-field flex flex-wrap gap-1.5 min-h-[2.5rem] py-1.5 cursor-text bg-white"
        onClick={() => { setOpen(true); setQuery('') }}
      >
        {selectedLabels.length === 0 && !open && (
          <span className="text-slate-400 text-sm">{placeholder ?? 'Select...'}</span>
        )}
        {selectedLabels.map(opt => (
          <span key={opt.id} className="inline-flex items-center gap-1 bg-blue-105 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200/50">
            {opt.name}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(opt.id) }}
              className="hover:text-blue-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-md px-2 py-1">
              <Search className="w-4 h-4 text-slate-400" />
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
              <p className="text-sm text-slate-400 text-center py-4">No options found</p>
            ) : (
              filtered.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm text-slate-900">{opt.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProcedureForm({ templateId, initialData, assets, assetCategories, locations }: Props) {
  const router = useRouter()
  const isEdit = !!templateId

  const [name,       setName]       = useState(initialData?.name ?? '')
  const [description,setDescription] = useState(initialData?.description ?? '')
  const [steps,      setSteps]      = useState<ProcedureStep[]>(initialData?.steps ?? [])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [generatingSteps, setGeneratingSteps] = useState(false)

  const [selectedAssetIds,    setSelectedAssetIds]    = useState<string[]>(initialData?.assetIds ?? [])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialData?.categoryIds ?? [])
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(initialData?.locationIds ?? [])

  async function handleAIGenerate() {
    if (!name.trim()) return
    setError('')
    setGeneratingSteps(true)
    try {
      const associatedAssetNames = selectedAssetIds.map(id => assets?.find(a => a.id === id)?.name).filter(Boolean)
      const associatedCategoryNames = selectedCategoryIds.map(id => assetCategories?.find(c => c.id === id)?.name).filter(Boolean)
      
      const res = await fetch('/api/procedures/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          assetName: associatedAssetNames.length > 0 ? associatedAssetNames.join(', ') : undefined,
          categoryName: associatedCategoryNames.length > 0 ? associatedCategoryNames.join(', ') : undefined,
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate steps with AI')
        return
      }

      if (data.steps && Array.isArray(data.steps)) {
        const mappedSteps = data.steps.map((s: any, i: number) => ({
          label: s.label,
          type: s.type || 'CHECKBOX',
          isMandatory: !!s.isMandatory,
          options: s.options || [],
          sortOrder: i,
        }))
        setSteps(mappedSteps)
      } else {
        setError('Invalid response structure from AI')
      }
    } catch {
      setError('Network error during AI generation')
    } finally {
      setGeneratingSteps(false)
    }
  }

  function addStep() {
    setSteps(prev => [...prev, { label: '', type: 'CHECKBOX', isMandatory: false, options: [], sortOrder: prev.length }])
  }

  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })))
  }

  function updateStep<K extends keyof ProcedureStep>(idx: number, field: K, value: ProcedureStep[K]) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addOption(idx: number) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: [...it.options, ''] } : it))
  }

  function removeOption(idx: number, optIdx: number) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: it.options.filter((_, oi) => oi !== optIdx) } : it))
  }

  function updateOption(idx: number, optIdx: number, value: string) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: it.options.map((o, oi) => oi === optIdx ? value : o) } : it))
  }

  function moveStep(idx: number, direction: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const target = idx + direction
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (steps.some(it => !it.label.trim())) {
      setError('All steps must have a label')
      return
    }
    if (steps.some(it => it.type === 'SINGLE_SELECT' && it.options.some(o => !o.trim()))) {
      setError('All SINGLE_SELECT options must have a label')
      return
    }
    setError(''); setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        steps: steps.map((it, i) => ({
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
      const url    = isEdit ? `/api/procedures/${templateId}` : '/api/procedures'
      const method = isEdit ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push('/settings/procedures')
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  const showTagSection = assets || assetCategories || locations

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-250 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Procedure info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold text-slate-900 text-sm">Procedure details</h2>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Procedure name <span className="text-red-500">*</span>
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
          <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input-field resize-none bg-white"
            rows={2}
            placeholder="Optional description of this procedure..."
          />
        </div>
      </div>

      {/* Tag associations */}
      {showTagSection && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-slate-900 text-sm">
            Tag associations <span className="text-xs font-normal text-slate-400 ml-1">— trigger linkages</span>
          </h2>
          <p className="text-xs text-slate-400">
            Define automatic resolution triggers. Target Work Orders tracking tagged locations, matching asset categories, or specific asset IDs will automatically inherit this Procedure.
          </p>
          <div className="space-y-4">
            {locations && (
              <MultiTagSelect
                label="Locations link"
                options={locations}
                selected={selectedLocationIds}
                onChange={setSelectedLocationIds}
                placeholder="Select locations..."
              />
            )}
            {assetCategories && (
              <MultiTagSelect
                label="Asset Categories link"
                options={assetCategories}
                selected={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                placeholder="Select asset categories..."
              />
            )}
            {assets && (
              <MultiTagSelect
                label="Assets link"
                options={assets}
                selected={selectedAssetIds}
                onChange={setSelectedAssetIds}
                placeholder="Select assets..."
              />
            )}
          </div>
        </div>
      )}

      {/* Procedure items */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm">Procedure steps ({steps.length})</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={generatingSteps || !name.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
              title={!name.trim() ? "Enter a procedure name to generate steps" : "Generate steps using Gemini AI"}
            >
              <span>{generatingSteps ? '✨ Generating...' : '✨ AI Auto-Generate'}</span>
            </button>
            <button type="button" onClick={addStep} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-xs">
              <Plus className="w-3.5 h-3.5" />
              Add step
            </button>
          </div>
        </div>

        {steps.length === 0 && (
          <div className="text-center py-8 text-slate-405">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No steps yet. Click &quot;Add step&quot; to define instructions.</p>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col bg-slate-50 border border-slate-200/40 rounded-lg px-3 py-2.5 group">
              <div className="flex items-center gap-3">
                {/* Reorder controls */}
                <div className="flex flex-col gap-0.5 text-slate-300 group-hover:text-slate-500 flex-shrink-0">
                  <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                    className="hover:text-slate-700 disabled:opacity-30 leading-none text-xs">▲</button>
                  <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                    className="hover:text-slate-700 disabled:opacity-30 leading-none text-xs">▼</button>
                </div>
                <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />

                {/* Label */}
                <input
                  type="text"
                  value={step.label}
                  onChange={e => updateStep(idx, 'label', e.target.value)}
                  placeholder={`Instruction ${idx + 1}...`}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 min-w-0"
                />

                {/* Step type selector */}
                <select
                  value={step.type}
                  onChange={e => {
                    updateStep(idx, 'type', e.target.value)
                    if (e.target.value !== 'SINGLE_SELECT') updateStep(idx, 'options', [])
                  }}
                  className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 flex-shrink-0 cursor-pointer"
                >
                  {STEP_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Mandatory toggle */}
                <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.isMandatory}
                    onChange={e => updateStep(idx, 'isMandatory', e.target.checked)}
                    className="w-3.5 h-3.5 text-red-600 rounded border-slate-300 pointer-events-none"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap select-none font-bold">Req</span>
                </label>

                <button type="button" onClick={() => removeStep(idx)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options editor for SINGLE_SELECT */}
              {step.type === 'SINGLE_SELECT' && (
                <div className="ml-10 mt-2 space-y-1.5">
                  {step.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(idx, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-705 placeholder-slate-400"
                      />
                      <button type="button" onClick={() => removeOption(idx, oi)} className="text-slate-305 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(idx)}
                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add option
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {steps.length > 0 && (
          <p className="text-xs text-slate-400">
            {steps.filter(i => i.isMandatory).length} required · {steps.filter(i => i.type !== 'CHECKBOX').length} typed steps
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create Procedure'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
