'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  AlertCircle, 
  X, 
  Search, 
  Paperclip, 
  Heading, 
  ArrowUp, 
  ArrowDown,
  Settings
} from 'lucide-react'

const STEP_TYPE_OPTIONS = [
  { value: 'SECTION', label: 'Section / Divider 📁' },
  { value: 'INSTRUCTION', label: 'Instruction Text 📝' },
  { value: 'CHECKBOX', label: 'Checkbox ✅' },
  { value: 'INSPECTION', label: 'Inspection (Pass / Flag / Fail) 🔍' },
  { value: 'TEXT_INPUT', label: 'Text Input 🔠' },
  { value: 'NUMBER_INPUT', label: 'Number Input 🔢' },
  { value: 'SINGLE_SELECT', label: 'Single Select Option 🔘' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice Checkboxes ☑️' },
  { value: 'DROPDOWN', label: 'Dropdown List 🔽' },
  { value: 'DATE', label: 'Date Selection 📅' },
  { value: 'SIGNATURE', label: 'Signature Sign-off ✍️' },
  { value: 'PHOTO', label: 'Photo Upload 📷' },
  { value: 'FILE', label: 'File Attachment 📎' },
  { value: 'METER', label: 'Meter Reading ⚙️' },
] as const

interface ProcedureStep {
  id?: string
  label: string
  type: string
  isMandatory: boolean
  options: string[]
  sortOrder: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logic?: any
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

interface Attachment {
  name: string
  url: string
  type: 'PDF' | 'IMAGE' | 'VIDEO' | 'MANUAL' | 'OTHER'
}

function parseProcedureDescription(descRaw: string | null | undefined): { text: string; attachments: Attachment[] } {
  if (!descRaw) return { text: '', attachments: [] }
  try {
    if (descRaw.trim().startsWith('{')) {
      const parsed = JSON.parse(descRaw)
      if (parsed && typeof parsed === 'object') {
        return {
          text: typeof parsed.text === 'string' ? parsed.text : '',
          attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        }
      }
    }
  } catch (e) {
    // fallback
  }
  return { text: descRaw, attachments: [] }
}

function serializeProcedureDescription(text: string, attachments: Attachment[]): string {
  return JSON.stringify({ text, attachments })
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
      <label className="block text-sm font-semibold text-slate-705 mb-1">{label}</label>
      <div
        className="input-field flex flex-wrap gap-1.5 min-h-[2.5rem] py-1.5 cursor-text bg-white border border-slate-200 rounded-lg px-3 shadow-xs"
        onClick={() => { setOpen(true); setQuery('') }}
      >
        {selectedLabels.length === 0 && !open && (
          <span className="text-slate-400 text-sm">{placeholder ?? 'Select...'}</span>
        )}
        {selectedLabels.map(opt => (
          <span key={opt.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200/50">
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
                    className="w-4 h-4 rounded border-slate-300 text-blue-100 accent-blue-600"
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

  const parsedDesc = parseProcedureDescription(initialData?.description)
  const [name, setName] = useState(initialData?.name ?? '')
  const [descriptionText, setDescriptionText] = useState(parsedDesc.text)
  const [attachments, setAttachments] = useState<Attachment[]>(parsedDesc.attachments)
  const [steps, setSteps] = useState<ProcedureStep[]>(initialData?.steps ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(initialData?.assetIds ?? [])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialData?.categoryIds ?? [])
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(initialData?.locationIds ?? [])

  // State for adding a new procedure level attachment
  const [newAttachName, setNewAttachName] = useState('')
  const [newAttachUrl, setNewAttachUrl] = useState('')
  const [newAttachType, setNewAttachType] = useState<Attachment['type']>('PDF')
  const [showAttachForm, setShowAttachForm] = useState(false)

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  
  // Settings toggle
  const [expandedSettingsIdx, setExpandedSettingsIdx] = useState<number | null>(null)

  function addStep() {
    setSteps(prev => [...prev, { label: '', type: 'CHECKBOX', isMandatory: false, options: [], sortOrder: prev.length, settings: {}, logic: {} }])
  }

  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })))
  }

  function updateStep<K extends keyof ProcedureStep>(idx: number, field: K, value: ProcedureStep[K]) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function updateStepConfig(idx: number, type: 'settings' | 'logic', key: string, value: any) {
    setSteps(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const current = it[type] || {}
      return { ...it, [type]: { ...current, [key]: value } }
    }))
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

  function handleDragStart(idx: number) {
    setDraggedIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIdx) return
    setSteps(prev => {
      const arr = [...prev]
      const [draggedItem] = arr.splice(draggedIdx, 1)
      arr.splice(dropIdx, 0, draggedItem)
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
    setDraggedIdx(null)
  }

  function addAttachment() {
    if (!newAttachName.trim() || !newAttachUrl.trim()) return
    const newAttachment: Attachment = {
      name: newAttachName.trim(),
      url: newAttachUrl.trim(),
      type: newAttachType,
    }
    setAttachments(prev => [...prev, newAttachment])
    setNewAttachName('')
    setNewAttachUrl('')
    setNewAttachType('PDF')
    setShowAttachForm(false)
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (steps.some(it => !it.label.trim())) {
      setError('All procedure steps must have a descriptive label/instruction.')
      return
    }
    const optionRequiredTypes = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN']
    if (steps.some(it => optionRequiredTypes.includes(it.type) && it.options.some(o => !o.trim()))) {
      setError('All choose/dropdown and multiple choice fields must have non-empty options.')
      return
    }
    setError(''); setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: serializeProcedureDescription(descriptionText.trim(), attachments),
        steps: steps.map((it, i) => ({
          label:       it.label.trim(),
          type:        it.type,
          isMandatory: it.isMandatory,
          options:     optionRequiredTypes.includes(it.type) ? it.options.map(o => o.trim()).filter(Boolean) : [],
          sortOrder:   i,
          settings:    it.settings ?? {},
          logic:       it.logic ?? {},
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

  // Group steps visually. We find which sections contain which steps.
  let currentHeader: string | null = null;
  const stepsWithSectionGroup = steps.map((step) => {
    if (step.type === 'SECTION') {
      currentHeader = step.label;
    }
    return {
      ...step,
      sectionHeader: currentHeader
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto px-4 pb-12">
      {error && (
        <div className="bg-red-50 border border-red-250 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Procedure Info */}
      <div className="premium-card p-6 sm:p-7 border border-slate-200 bg-white shadow-sm rounded-xl space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-slate-900 text-lg tracking-tight">Procedure Template Details</h2>
            <p className="text-xs text-slate-500 mt-1">Configure the core details of this Standard Operating Procedure (SOP).</p>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[10px] font-bold tracking-wider uppercase rounded-full">
            MaintainX SOP
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-semibold text-slate-705 mb-1.5">
              Procedure Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field border-slate-200 focus:border-blue-500"
              placeholder="e.g. Forklift Pre-Use Inspection Guide"
              required
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-semibold text-slate-705 mb-1.5">Description Summary</label>
            <textarea
              value={descriptionText}
              onChange={e => setDescriptionText(e.target.value)}
              className="input-field resize-none border-slate-200 focus:border-blue-500"
              rows={2}
              placeholder="Provide context or directions for operators executing this SOP..."
            />
          </div>
        </div>

        {/* Level Attachments Manager */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Paperclip className="w-4 h-4 text-slate-500" />
              SOP Level Reference Manuals & Media ({attachments.length})
            </div>
            <button
              type="button"
              onClick={() => setShowAttachForm(prev => !prev)}
              className="text-xs text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/30 transition-all"
            >
              {showAttachForm ? 'Cancel' : '＋ Add Attachment'}
            </button>
          </div>

          {showAttachForm && (
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3 mb-4 animate-fade-in">
              <span className="text-xs font-bold text-slate-700 block">Add Reference Material Attachment</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Document Name (e.g. Safety Policy V4)"
                  value={newAttachName}
                  onChange={e => setNewAttachName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-705 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="URL String (e.g. /docs/ForkliftManual.pdf)"
                  value={newAttachUrl}
                  onChange={e => setNewAttachUrl(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-705 outline-none focus:ring-1 focus:ring-blue-500 sm:col-span-2"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Resource Type:</span>
                  <select
                    value={newAttachType}
                    onChange={e => setNewAttachType(e.target.value as Attachment['type'])}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-700 cursor-pointer outline-none"
                  >
                    <option value="PDF">PDF Document (PDF)</option>
                    <option value="IMAGE">Image Resource (IMAGE)</option>
                    <option value="VIDEO">Video Guide (VIDEO)</option>
                    <option value="MANUAL">Operating Manual (MANUAL)</option>
                    <option value="OTHER">Other Link (OTHER)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addAttachment}
                  disabled={!newAttachName.trim() || !newAttachUrl.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                >
                  Confirm Upload
                </button>
              </div>
            </div>
          )}

          {attachments.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">No attachments or instruction manuals added yet. Attachments will be available to operators on-site.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map((attach, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg text-xs leading-relaxed transition-all">
                  <div className="flex items-center gap-2 truncate pr-4">
                    <span className="px-1.5 py-0.5 rounded bg-blue-105 border border-blue-200/50 text-blue-800 text-[9px] font-extrabold">{attach.type}</span>
                    <span className="font-bold text-slate-700 truncate" title={attach.name}>{attach.name}</span>
                    <span className="text-[9px] text-slate-400 truncate opacity-70" title={attach.url}>({attach.url})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tag Triggers */}
      {showTagSection && (
        <div className="premium-card p-6 border border-slate-200 bg-white shadow-sm rounded-xl space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Automatic Location & Asset Association</h2>
            <p className="text-xs text-slate-500 mt-1">Define trigger rules. Work orders created matching any of these targets will automatically inherit this procedure.</p>
          </div>
          <div className="space-y-4 pt-2">
            {locations && (
              <MultiTagSelect
                label="Locations Triggers"
                options={locations}
                selected={selectedLocationIds}
                onChange={setSelectedLocationIds}
                placeholder="Assign to locations..."
              />
            )}
            {assetCategories && (
              <MultiTagSelect
                label="Asset Categories Triggers"
                options={assetCategories}
                selected={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                placeholder="Assign to asset categories..."
              />
            )}
            {assets && (
              <MultiTagSelect
                label="Assets Triggers"
                options={assets}
                selected={selectedAssetIds}
                onChange={setSelectedAssetIds}
                placeholder="Assign to assets..."
              />
            )}
          </div>
        </div>
      )}

      {/* Procedure Builder Blocks (SOP Builder) */}
      <div className="premium-card p-6 border border-slate-200 bg-white shadow-sm rounded-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Procedure Blocks Builder ({steps.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">Stack block types below to form your Standard Operating Procedure (SOP). Drag & Drop to order.</p>
          </div>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Procedure Block
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Heading className="w-10 h-10 mx-auto text-slate-350 stroke-[1.25] mb-2" />
            <p className="text-sm font-bold text-slate-505">No procedure blocks added yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">SOPs are composed of ordered block types like section headers, check boxes, instruction cards, and text entry fields.</p>
            <button
              type="button"
              onClick={addStep}
              className="mt-4 inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors"
            >
              Add first block
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {stepsWithSectionGroup.map((step, idx) => {
              const isSection = step.type === 'SECTION'
              const isInstruction = step.type === 'INSTRUCTION'
              const hasOptions = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(step.type)

              return (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`flex flex-col bg-white border rounded-xl transition-all shadow-xxs ${
                    isSection 
                      ? 'border-blue-350 bg-blue-50/10 shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300'
                  } ${draggedIdx === idx ? 'opacity-40 border-dashed border-blue-505' : ''}`}
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Native Drag & Swap handle */}
                    <div 
                      className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-350 hover:bg-slate-100 hover:text-slate-500 transition-all flex-shrink-0"
                      title="Drag to reposition this block"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Step Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Step Label input */}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={step.label}
                            onChange={e => updateStep(idx, 'label', e.target.value)}
                            placeholder={
                              isSection 
                                ? "Enter section header title (e.g. Safety Checks)" 
                                : isInstruction
                                ? "Enter instructional instruction text for operator"
                                : `Step ${idx + 1} instruction/prompt label...`
                            }
                            className={`w-full bg-transparent border-none outline-none text-sm placeholder-slate-400 focus:ring-0 ${
                              isSection ? 'font-black text-slate-850 text-base' : 'font-semibold text-slate-800'
                            }`}
                          />
                        </div>

                        {/* Block Type selector */}
                        <div className="flex items-center gap-2">
                          <select
                            value={step.type}
                            onChange={e => {
                              updateStep(idx, 'type', e.target.value)
                              if (!['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(e.target.value)) {
                                updateStep(idx, 'options', [])
                              }
                            }}
                            className="text-xs font-bold border border-slate-205 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-705 flex-shrink-0 cursor-pointer hover:bg-slate-100 transition shadow-xxs"
                          >
                            {STEP_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          {/* Skip Required for Section & Instruction */}
                          {!isSection && !isInstruction && (
                            <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100 transition whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={step.isMandatory}
                                onChange={e => updateStep(idx, 'isMandatory', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-red-650 accent-red-600 cursor-pointer"
                              />
                              <span className="text-[10px] text-slate-600 font-extrabold uppercase">Mandatory</span>
                            </label>
                          )}

                          {/* Quick Up/Down buttons in case drag-drop is inconvenient */}
                          <div className="flex items-center border border-slate-100 rounded-lg">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveStep(idx, -1)}
                              className="p-1 text-slate-405 hover:text-slate-605 disabled:opacity-30"
                              title="Move step up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === steps.length - 1}
                              onClick={() => moveStep(idx, 1)}
                              className="p-1 text-slate-405 hover:text-slate-605 disabled:opacity-30 border-l border-slate-100"
                              title="Move step down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center border border-slate-100 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setExpandedSettingsIdx(expandedSettingsIdx === idx ? null : idx)}
                              className={`p-1.5 transition-colors ${expandedSettingsIdx === idx ? 'bg-slate-100 text-blue-600' : 'text-slate-405 hover:bg-slate-50 hover:text-slate-605'}`}
                              title="Field Settings & Logic"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStep(idx)}
                              className="p-1.5 text-slate-350 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-slate-100"
                              title="Delete this block"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Choices Options list */}
                      {hasOptions && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-2 max-w-md ml-2 animate-fade-in">
                          <span className="text-[10px] font-extrabold text-slate-505 uppercase block">Define Selection Items</span>
                          <div className="space-y-1.5">
                            {step.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => updateOption(idx, oi, e.target.value)}
                                  placeholder={`Option ${oi + 1} (e.g. Normal Operational Status)`}
                                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-705 outline-none focus:border-slate-350 placeholder-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(idx, oi)}
                                  className="text-slate-350 hover:text-red-500 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addOption(idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add select option
                          </button>
                        </div>
                      )}

                      {/* Brief visual indicator of the block's intent */}
                      <div className="text-[11px] text-slate-400 pl-1 leading-relaxed italic">
                        {isSection && '📁 Section Header: groups following blocks.'}
                        {isInstruction && '📝 Read-only Instruction: plain paragraph guiding the operator.'}
                        {step.type === 'CHECKBOX' && '✅ Checkbox: verification checkbox.'}
                        {step.type === 'INSPECTION' && '🔍 Inspection: Pass / Flag / Fail. Helps raise corrective schedules.'}
                        {step.type === 'TEXT_INPUT' && '🔠 Text Input: collects alphanumeric text response.'}
                        {step.type === 'NUMBER_INPUT' && '🔢 Number Input: captures numeric metrics.'}
                        {step.type === 'MULTIPLE_CHOICE' && '☑️ Multiple Choice: allows choosing multiple items simultaneously.'}
                        {step.type === 'DROPDOWN' && '🔽 Dropdown List: selects from a dropdown stack.'}
                        {step.type === 'DATE' && '📅 Date: records signature calendars.'}
                        {step.type === 'SIGNATURE' && '✍️ Signature: capturing operator sign-off.'}
                        {step.type === 'PHOTO' && '📷 Photo Upload: prompts image attachments during execution.'}
                        {step.type === 'FILE' && '📎 File Attachment: uploads technical manuals or files.'}
                        {step.type === 'METER' && '⚙️ Meter Reading: stores physical metrics.'}
                      </div>

                      {/* Advanced Settings Panel */}
                      {expandedSettingsIdx === idx && (
                        <div className="bg-slate-50 border border-slate-200 mt-3 p-4 rounded-lg animate-fade-in space-y-4">
                          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5" /> Field Settings & Logic
                          </h3>
                          
                          {step.type === 'INSPECTION' && (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-100 rounded-md transition border border-transparent hover:border-slate-200">
                                <input
                                  type="checkbox"
                                  checked={!!step.settings?.requirePhotoOnFail}
                                  onChange={e => updateStepConfig(idx, 'settings', 'requirePhotoOnFail', e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="text-xs">
                                  <span className="font-semibold text-slate-800 block">Require Photo on Fail</span>
                                  <span className="text-slate-500">Forces the user to take a picture if the item is flagged or failed.</span>
                                </div>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-100 rounded-md transition border border-transparent hover:border-slate-200">
                                <input
                                  type="checkbox"
                                  checked={!!step.settings?.correctiveAction}
                                  onChange={e => updateStepConfig(idx, 'settings', 'correctiveAction', e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="text-xs">
                                  <span className="font-semibold text-slate-800 block">Corrective Work Order Action</span>
                                  <span className="text-slate-500">Automatically drafts a new repair work order if this step fails.</span>
                                </div>
                              </label>
                            </div>
                          )}

                          {step.type === 'NUMBER_INPUT' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Min Value</label>
                                <input
                                  type="number"
                                  value={step.settings?.min ?? ''}
                                  onChange={e => updateStepConfig(idx, 'settings', 'min', e.target.value)}
                                  placeholder="e.g. 90"
                                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Max Value</label>
                                <input
                                  type="number"
                                  value={step.settings?.max ?? ''}
                                  onChange={e => updateStepConfig(idx, 'settings', 'max', e.target.value)}
                                  placeholder="e.g. 110"
                                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {step.type === 'METER' && (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Meter Unit</label>
                              <input
                                type="text"
                                value={step.settings?.unit ?? ''}
                                onChange={e => updateStepConfig(idx, 'settings', 'unit', e.target.value)}
                                placeholder="e.g. Hours, Miles, Celsius"
                                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 max-w-sm"
                              />
                            </div>
                          )}

                          {/* Conditional Logic (Available for all fields except SECTION) */}
                          {!isSection && (
                            <div className="pt-2">
                              <h4 className="text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">Conditional Logic</h4>
                              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <label className="flex items-center gap-2">
                                  <input 
                                    type="checkbox"
                                    checked={!!step.logic?.enabled}
                                    onChange={e => updateStepConfig(idx, 'logic', 'enabled', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-slate-300"
                                  />
                                  <span className="text-xs font-semibold text-slate-700">Display this field conditionally</span>
                                </label>
                                
                                {step.logic?.enabled && (
                                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 text-xs border-t border-slate-100">
                                    <span className="text-slate-500 flex-shrink-0">Show this field ONLY IF</span>
                                    <select
                                      value={step.logic?.parentStepIdx ?? ''}
                                      onChange={e => updateStepConfig(idx, 'logic', 'parentStepIdx', e.target.value)}
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 outline-none truncate"
                                    >
                                      <option value="">-- Select Parent Step --</option>
                                      {steps.slice(0, idx).map((s, i) => {
                                        if (s.type === 'SECTION' || s.type === 'INSTRUCTION') return null;
                                        return (
                                          <option key={i} value={i}>Step {i + 1}: {s.label.substring(0, 30)}{s.label.length > 30 ? '...' : ''}</option>
                                        )
                                      })}
                                    </select>
                                    <span className="text-slate-500">is</span>
                                    <input
                                      type="text"
                                      value={step.logic?.parentStepValue ?? ''}
                                      onChange={e => updateStepConfig(idx, 'logic', 'parentStepValue', e.target.value)}
                                      placeholder="Value (e.g. Yes, Pass)"
                                      className="w-32 bg-slate-50 border border-slate-200 rounded p-1 outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Submission Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-white border border-slate-205 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition shadow-xxs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
        >
          {saving ? 'Saving Templates...' : isEdit ? 'Save SOP Template' : 'Create SOP Template'}
        </button>
      </div>
    </form>
  )
}
