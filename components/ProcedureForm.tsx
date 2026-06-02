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
  Heading as HeadingIcon, 
  Settings,
  SlidersHorizontal,
  ChevronRight,
  Sliders,
  Check,
  CheckSquare,
  HelpCircle,
  FileUp,
  Loader2
} from 'lucide-react'

const STEP_TYPE_OPTIONS = [
  { value: 'SECTION', label: 'Heading / Section 📁' },
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
  { value: 'INSTRUCTION', label: 'Static Instruction Card 📝' },
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
  key?: string
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
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
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
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
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

interface GroupedHeading {
  headingIdx: number // index in the main flat steps array, or -1 for starting floating steps
  heading: ProcedureStep | null
  steps: { step: ProcedureStep; originalIdx: number }[]
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

  // Real upload states & logic for MinIO
  const [uploadingProcFile, setUploadingProcFile] = useState(false)
  const [uploadingStepFile, setUploadingStepFile] = useState(false)

  async function uploadFileHelper(file: File): Promise<{ url: string; name: string; type: 'PDF' | 'IMAGE' | 'VIDEO' | 'MANUAL' | 'OTHER' } | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to upload file')
      }

      const data = await res.json()
      
      let type: 'PDF' | 'IMAGE' | 'VIDEO' | 'MANUAL' | 'OTHER' = 'OTHER'
      const mime = file.type.toLowerCase()
      if (mime.includes('pdf')) {
        type = 'PDF'
      } else if (mime.startsWith('image/')) {
        type = 'IMAGE'
      } else if (mime.startsWith('video/')) {
        type = 'VIDEO'
      } else if (mime.includes('msword') || mime.includes('word') || mime.includes('document')) {
        type = 'MANUAL'
      }

      return {
        url: data.url,
        name: file.name,
        type,
        key: data.key
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during file upload')
      return null
    }
  }

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [draggedHeadingIdx, setDraggedHeadingIdx] = useState<number | null>(null)
  
  // Settings slide-out drawer state
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null)

  // Group steps by their preceding Heading block
  const groupedSections: GroupedHeading[] = []
  let currentGroup: GroupedHeading = { headingIdx: -1, heading: null, steps: [] }

  steps.forEach((step, originalIdx) => {
    if (step.type === 'SECTION') {
      if (currentGroup.headingIdx !== -1 || currentGroup.steps.length > 0) {
        groupedSections.push(currentGroup)
      }
      currentGroup = { headingIdx: originalIdx, heading: step, steps: [] }
    } else {
      currentGroup.steps.push({ step, originalIdx })
    }
  })
  if (currentGroup.headingIdx !== -1 || currentGroup.steps.length > 0 || groupedSections.length === 0) {
    groupedSections.push(currentGroup)
  }

  // Terminology helper: display Section as "Heading"
  function getStepTypeBadge(type: string) {
    const opt = STEP_TYPE_OPTIONS.find(o => o.value === type)
    return opt ? opt.label : type
  }

  // Quick helper to check if step has customized rules configured
  function hasConfiguredRules(step: ProcedureStep) {
    if (!step) return false
    const settings = step.settings ?? {}
    const logic = step.logic ?? {}
    return (
      settings.requirePhotoOnFail === true ||
      settings.correctiveAction === true ||
      (settings.min !== undefined && settings.min !== '') ||
      (settings.max !== undefined && settings.max !== '') ||
      (settings.unit !== undefined && settings.unit !== '') ||
      logic.enabled === true
    )
  }

  // Add a new Heading at the bottom
  function addHeading() {
    setSteps(prev => [
      ...prev,
      {
        label: `New Heading ${prev.filter(s => s.type === 'SECTION').length + 1}`,
        type: 'SECTION',
        isMandatory: false,
        options: [],
        sortOrder: prev.length,
        settings: {},
        logic: {}
      }
    ])
  }

  // Add a normal Step under a specific heading index
  function addStepUnderHeading(headingIdx: number) {
    setSteps(prev => {
      const arr = [...prev]
      let insertAt = headingIdx + 1
      // Find the end of this heading's section (before the next heading/section block)
      while (insertAt < arr.length && arr[insertAt].type !== 'SECTION') {
        insertAt++
      }
      arr.splice(insertAt, 0, {
        label: '',
        type: 'CHECKBOX',
        isMandatory: false,
        options: [],
        sortOrder: insertAt,
        settings: {},
        logic: {}
      })
      
      // Re-map sortOrders
      const updated = arr.map((it, i) => ({ ...it, sortOrder: i }))
      
      // Auto-open settings drawer for this newly added step
      setTimeout(() => setEditingStepIdx(insertAt), 50)
      
      return updated
    })
  }

  function removeStep(idx: number) {
    if (editingStepIdx === idx) {
      setEditingStepIdx(null)
    } else if (editingStepIdx !== null && editingStepIdx > idx) {
      setEditingStepIdx(editingStepIdx - 1)
    }
    setSteps(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })))
  }

  // Remove a heading and prompt to move or delete all children under it
  function removeHeading(headingIdx: number, deleteChildren: boolean) {
    if (editingStepIdx === headingIdx) setEditingStepIdx(null)
    setSteps(prev => {
      if (deleteChildren) {
        // Delete heading and all following steps until next SECTION
        const arr: ProcedureStep[] = []
        let skip = false
        for (let i = 0; i < prev.length; i++) {
          if (i === headingIdx) {
            skip = true
            continue
          }
          if (skip && prev[i].type === 'SECTION') {
            skip = false
          }
          if (!skip) {
            arr.push(prev[i])
          }
        }
        return arr.map((it, i) => ({ ...it, sortOrder: i }))
      } else {
        // Delete only the heading block, keep children as flat floating steps
        return prev.filter((_, i) => i !== headingIdx).map((it, i) => ({ ...it, sortOrder: i }))
      }
    })
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
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: [...(it.options || []), ''] } : it))
  }

  function removeOption(idx: number, optIdx: number) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: (it.options || []).filter((_, oi) => oi !== optIdx) } : it))
  }

  function updateOption(idx: number, optIdx: number, value: string) {
    setSteps(prev => prev.map((it, i) => i === idx ? { ...it, options: (it.options || []).map((o, oi) => oi === optIdx ? value : o) } : it))
  }

  // Move individual step up/down within list
  function moveStep(idx: number, direction: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const target = idx + direction
      if (target < 0 || target >= arr.length) return arr
      // Prevent step from moving out of scope or swapping past sections if desired, or allow free reorder
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      if (editingStepIdx === idx) setEditingStepIdx(target)
      else if (editingStepIdx === target) setEditingStepIdx(idx)
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  // Move entire section/heading block (AND all its child steps) up or down past other headings!
  function moveHeadingSection(headingIdx: number, direction: -1 | 1) {
    // Find all sections
    const secIndices = steps.map((s, i) => s.type === 'SECTION' ? i : -1).filter(i => i !== -1)
    const currentSecPos = secIndices.indexOf(headingIdx)
    if (currentSecPos === -1) return
    const targetSecPos = currentSecPos + direction
    if (targetSecPos < 0 || targetSecPos >= secIndices.length) return

    const targetHeadingIdx = secIndices[targetSecPos]

    // Construct slices of heading and its child steps
    // To move: we identify the range for headingIdx and targetHeadingIdx
    setSteps(prev => {
      const groups: ProcedureStep[][] = []
      let tempGroup: ProcedureStep[] = []
      prev.forEach((step) => {
        if (step.type === 'SECTION') {
          if (tempGroup.length > 0) groups.push(tempGroup)
          tempGroup = [step]
        } else {
          tempGroup.push(step)
        }
      })
      if (tempGroup.length > 0) groups.push(tempGroup)

      // Find the groups corresponding to headingIdx and targetHeadingIdx
      const activeGroupIdx = groups.findIndex(g => g[0].type === 'SECTION' && prev.indexOf(g[0]) === headingIdx)
      const targetGroupIdx = groups.findIndex(g => g[0].type === 'SECTION' && prev.indexOf(g[0]) === targetHeadingIdx)

      if (activeGroupIdx === -1 || targetGroupIdx === -1) return prev

      // Swap the slices in the groups array
      ;[groups[activeGroupIdx], groups[targetGroupIdx]] = [groups[targetGroupIdx], groups[activeGroupIdx]]

      // Flatten and update sortOrder
      const flat = groups.flat()
      setEditingStepIdx(null) // Reset drawer edit index to prevent mismatch
      return flat.map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  // Drag-and-drop for standard steps
  function handleDragStart(idx: number) {
    setDraggedIdx(idx)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIdx) return
    setSteps(prev => {
      const arr = [...prev]
      const [draggedItem] = arr.splice(draggedIdx, 1)
      arr.splice(dropIdx, 0, draggedItem)
      setEditingStepIdx(null) // Reset editing index
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
    setDraggedIdx(null)
  }

  // Drag-and-drop for heading groups (all steps under heading)
  function handleHeadingDragStart(headingIdx: number) {
    setDraggedHeadingIdx(headingIdx)
  }

  function handleHeadingDrop(e: React.DragEvent, targetHeadingIdx: number) {
    e.preventDefault()
    if (draggedHeadingIdx === null || draggedHeadingIdx === targetHeadingIdx) return
    setSteps(prev => {
      const groups: ProcedureStep[][] = []
      let tempGroup: ProcedureStep[] = []
      prev.forEach((step) => {
        if (step.type === 'SECTION') {
          if (tempGroup.length > 0) groups.push(tempGroup)
          tempGroup = [step]
        } else {
          tempGroup.push(step)
        }
      })
      if (tempGroup.length > 0) groups.push(tempGroup)

      const fromGroupIdx = groups.findIndex(g => prev.indexOf(g[0]) === draggedHeadingIdx)
      const toGroupIdx = groups.findIndex(g => prev.indexOf(g[0]) === targetHeadingIdx)

      if (fromGroupIdx === -1 || toGroupIdx === -1) return prev

      const [movedGroup] = groups.splice(fromGroupIdx, 1)
      groups.splice(toGroupIdx, 0, movedGroup)

      setEditingStepIdx(null)
      return groups.flat().map((it, i) => ({ ...it, sortOrder: i }))
    })
    setDraggedHeadingIdx(null)
  }

  function addAttachment() {
    if (!newAttachName.trim() || !newAttachUrl.trim()) return
    const newAttachment: Attachment = {
      name: newAttachName.trim(),
      url: newAttachUrl.trim(),
      type: newAttachType,
      key: undefined,
    }
    setAttachments(prev => [...prev, newAttachment])
    setNewAttachName('')
    setNewAttachUrl('')
    setNewAttachType('PDF')
    setShowAttachForm(false)
  }

  async function removeAttachment(idx: number) {
    const target = attachments[idx]
    if (target?.key) {
      try {
        await fetch(`/api/upload?key=${encodeURIComponent(target.key)}&url=${encodeURIComponent(target.url)}`, {
          method: 'DELETE'
        })
        console.log('File deleted from MinIO storage successfully')
      } catch (err) {
        console.error('Failed to clear file from storage:', err)
      }
    }
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (steps.some(it => !it.label.trim())) {
      setError('All procedure steps and headings must have a descriptive label/title.')
      return
    }
    const optionRequiredTypes = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN']
    if (steps.some(it => optionRequiredTypes.includes(it.type) && (!it.options || it.options.some(o => !o.trim())))) {
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
          options:     optionRequiredTypes.includes(it.type) ? (it.options || []).map(o => o.trim()).filter(Boolean) : [],
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto px-4 pb-20 relative">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* Top Details & Auto Trigger Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detail Panel */}
        <div className="lg:col-span-2 premium-card p-6 border border-slate-200 bg-white shadow-xs rounded-xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base tracking-tight">Procedure Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Define core info and safe working manuals.</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold tracking-wider uppercase rounded-full">
              Standard Template
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">
                Procedure Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field border-slate-200 focus:border-blue-500 text-sm py-2"
                placeholder="e.g. Annual Generator Service & Oil Change"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">Instructions & Safety Description Summary</label>
              <textarea
                value={descriptionText}
                onChange={e => setDescriptionText(e.target.value)}
                className="input-field resize-none border-slate-200 focus:border-blue-500 text-sm"
                rows={3}
                placeholder="Describe tools needed or general caution warnings (e.g., Lockout/Tagout Kit #4 required)..."
              />
            </div>
          </div>

          {/* Reference Manuals */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Paperclip className="w-4 h-4 text-slate-500" />
                SOP Manuals & References ({attachments.length})
              </div>
              <button
                type="button"
                onClick={() => setShowAttachForm(prev => !prev)}
                className="text-xs text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/30 transition-all"
              >
                {showAttachForm ? 'Cancel' : '＋ Add Reference Link'}
              </button>
            </div>

            {showAttachForm && (
              <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3 mb-4 animate-fade-in text-xs">
                {/* Real File Uploader Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-dashed border-slate-300 rounded-xl bg-white p-4 text-center hover:bg-slate-50 transition-all cursor-pointer relative group">
                    {uploadingProcFile ? (
                      <div className="flex flex-col items-center justify-center py-2 text-slate-500 font-bold gap-2">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 text-slate-500 gap-1 hover:text-blue-650">
                        <FileUp className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="font-bold text-xs text-slate-705">Upload File</span>
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadingProcFile(true)
                            const uploaded = await uploadFileHelper(file)
                            setUploadingProcFile(false)
                            if (uploaded) {
                              const newAt: Attachment = {
                                name: uploaded.name.split('.').slice(0, -1).join('.') || uploaded.name,
                                url: uploaded.url,
                                type: uploaded.type,
                                key: uploaded.key
                              }
                              setAttachments(prev => [...prev, newAt])
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Camera Option */}
                  <div className="border border-dashed border-slate-300 rounded-xl bg-white p-4 text-center hover:bg-slate-50 transition-all cursor-pointer relative group">
                    <div className="flex flex-col items-center justify-center py-2 text-slate-500 gap-1 hover:text-blue-650">
                      <div className="w-6 h-6 flex items-center justify-center text-slate-400 group-hover:text-blue-500 text-xl">📷</div>
                      <span className="font-bold text-xs text-slate-705">Take Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploadingProcFile(true)
                          const uploaded = await uploadFileHelper(file)
                          setUploadingProcFile(false)
                          if (uploaded) {
                            const newAt: Attachment = {
                              name: `Ref_Photo_${new Date().getTime()}`,
                              url: uploaded.url,
                              type: 'IMAGE',
                              key: uploaded.key
                            }
                            setAttachments(prev => [...prev, newAt])
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                </div>
              )}

            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No reference manuals uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((attach, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs transition-all">
                    <div className="flex items-center gap-1.5 truncate pr-3 flex-1">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 border border-blue-200/50 text-blue-800 text-[9px] font-extrabold">{attach.type}</span>
                      <span className="font-bold text-slate-705 truncate max-w-[120px]">{attach.name}</span>
                      <a 
                        href={attach.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-200/30 transition-all uppercase tracking-tighter"
                      >
                        View
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-150 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Triggers Panel */}
        <div className="premium-card p-6 border border-slate-200 bg-white shadow-xs rounded-xl space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Automatic Work Order Association</h2>
            <p className="text-xs text-slate-500 mt-1">If a work order matches any of these trigger fields, this procedure is automatically appended.</p>
          </div>
          {showTagSection ? (
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
                  placeholder="Assign to categories..."
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
          ) : (
            <p className="text-xs text-slate-400 italic">No asset or location triggers configured.</p>
          )}
        </div>
      </div>

      {/* Emerald Max Structured Procedures Editor */}
      <div className="premium-card p-6 border border-slate-200 bg-white shadow-xs rounded-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              Emerald Max Procedure Builder
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Divide your checklist into Chapters (Headings) and add specific response field types below.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addHeading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all border border-slate-200 shadow-xxs"
            >
              <Plus className="w-4 h-4" />
              ＋ New Heading
            </button>
          </div>
        </div>

        {/* Builder Area */}
        {groupedSections.length === 0 || (groupedSections.length === 1 && groupedSections[0].headingIdx === -1 && groupedSections[0].steps.length === 0) ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <HeadingIcon className="w-12 h-12 mx-auto text-slate-350 stroke-[1.25] mb-2" />
            <p className="text-sm font-bold text-slate-600">This procedure has no steps yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Start by creating a Heading to chapter your checklist, or add a standalone step block.</p>
            <div className="mt-5 flex gap-3 justify-center">
              <button
                type="button"
                onClick={addHeading}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-lg transition shadow-xs"
              >
                Create First Heading
              </button>
              <button
                type="button"
                onClick={() => addStepUnderHeading(-1)}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-lg transition"
              >
                Add Standalone Step
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedSections.map((group, groupIdx) => {
              const isFloating = group.headingIdx === -1
              const heading = group.heading

              return (
                <div 
                  key={groupIdx} 
                  className={`border rounded-xl bg-slate-50/30 overflow-hidden ${
                    isFloating ? 'border-dashed border-slate-200' : 'border-slate-200/80 shadow-3xs'
                  }`}
                  draggable={!isFloating}
                  onDragStart={() => !isFloating && handleHeadingDragStart(group.headingIdx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => !isFloating && handleHeadingDrop(e, group.headingIdx)}
                >
                  {/* Heading Header */}
                  {!isFloating && heading && (
                    <div className="bg-slate-50 border-b border-slate-200/60 px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Drag Handle */}
                        <div 
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1 rounded"
                          title="Drag entire Heading chapter"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={heading.label}
                          onChange={e => updateStep(group.headingIdx, 'label', e.target.value)}
                          placeholder="Heading title (e.g. PPE & Safety Checks)"
                          className="font-bold text-slate-805 bg-transparent border-none outline-none focus:ring-0 p-0 text-sm flex-1 placeholder-slate-400 font-sans"
                        />
                      </div>

                      {/* Heading actions */}
                      <div className="flex items-center gap-2">
                        {/* Add step here */}
                        <button
                          type="button"
                          onClick={() => addStepUnderHeading(group.headingIdx)}
                          className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-100 transition-all shadow-3xs"
                        >
                          <Plus className="w-3 h-3" /> Step
                        </button>

                        {/* Delete Chapter options */}
                        <div className="flex items-center border-l border-slate-200 pl-2 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Do you want to delete "${heading.label}" AND all steps under it? Click OK to delete all, Cancel to delete only the heading.`)) {
                                removeHeading(group.headingIdx, true)
                              } else {
                                removeHeading(group.headingIdx, false)
                              }
                            }}
                            className="p-1 text-slate-350 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete Chapter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nested steps list */}
                  <div className="p-4 space-y-3 bg-white/70">
                    {group.steps.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs italic bg-white/50 border border-dashed border-slate-200 rounded-lg">
                        No fields nested under this heading. Add checklist steps below!
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {group.steps.map(({ step, originalIdx }) => {
                          const hasRules = hasConfiguredRules(step)
                          const isEditTarget = editingStepIdx === originalIdx

                          return (
                            <div
                              key={originalIdx}
                              draggable
                              onDragStart={() => handleDragStart(originalIdx)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, originalIdx)}
                              className={`flex items-center justify-between p-3 bg-white border rounded-xl transition-all shadow-3xs ${
                                isEditTarget 
                                  ? 'ring-2 ring-blue-500 border-transparent bg-blue-50/5' 
                                  : 'border-slate-200 hover:border-slate-300'
                              } ${draggedIdx === originalIdx ? 'opacity-30 border-dashed border-blue-400' : ''}`}
                            >
                              {/* Grab + Input detail */}
                              <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                                <div className="cursor-grab active:cursor-grabbing text-slate-350 hover:text-slate-500 p-1">
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <span className="text-xs font-bold text-slate-400 select-none">
                                  {originalIdx + 1}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={step.label}
                                    onChange={e => updateStep(originalIdx, 'label', e.target.value)}
                                    placeholder="Enter descriptive instruction or checkpoint prompt..."
                                    className="font-semibold text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0 text-sm w-full placeholder-slate-400"
                                  />
                                </div>
                              </div>

                              {/* Badges + Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Mandatory flag */}
                                {step.isMandatory && (
                                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200/50 text-amber-800 text-[10px] font-extrabold uppercase rounded-full">
                                    Required
                                  </span>
                                )}

                                {/* Field Type Indicator */}
                                <span className="px-2 py-1 bg-slate-100 border border-slate-150 text-slate-600 rounded-lg text-[10px] font-bold font-mono">
                                  {getStepTypeBadge(step.type)}
                                </span>

                                {/* Step-specific attachments indicator */}
                                {step.settings?.attachments && step.settings.attachments.length > 0 && (
                                  <span 
                                    className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-200/50 text-indigo-800 text-[10px] font-extrabold uppercase rounded flex items-center gap-1 cursor-pointer"
                                    onClick={() => setEditingStepIdx(originalIdx)}
                                  >
                                    📎 {step.settings.attachments.length} Document{step.settings.attachments.length !== 1 ? 's' : ''}
                                  </span>
                                )}

                                {/* Rules tag */}
                                {hasRules && (
                                  <span 
                                    className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/40 text-[9px] font-extrabold uppercase rounded flex items-center gap-1 cursor-pointer"
                                    onClick={() => setEditingStepIdx(originalIdx)}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Rules Active
                                  </span>
                                )}

                                {/* Advanced Slide-out Drawer Drawer Trigger */}
                                <button
                                  type="button"
                                  onClick={() => setEditingStepIdx(isEditTarget ? null : originalIdx)}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    isEditTarget 
                                      ? 'bg-blue-600 border-blue-600 text-white' 
                                      : 'text-slate-450 bg-white hover:bg-slate-50 border-slate-200'
                                  }`}
                                  title="Field Rules & Settings"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => removeStep(originalIdx)}
                                  className="p-1.5 text-slate-350 hover:text-red-500 hover:bg-red-50 border border-slate-100 rounded-lg transition-colors"
                                  title="Delete step"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Quick step append at the bottom of heading list */}
                    <div className="pt-2 flex justify-start">
                      <button
                        type="button"
                        onClick={() => addStepUnderHeading(group.headingIdx)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add a step to {isFloating ? 'standalone list' : heading?.label}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Global actions at bottom */}
        <div className="pt-4 border-t border-slate-100 flex justify-center gap-3">
          <button
            type="button"
            onClick={addHeading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg shadow-xxs transition-all"
          >
            <Plus className="w-4 h-4" /> Add a Heading Chapter
          </button>
          <button
            type="button"
            onClick={() => addStepUnderHeading(steps.length - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-xxs transition-all"
          >
            <Plus className="w-4 h-4" /> Add a Floating Step
          </button>
        </div>
      </div>

      {/* Slide-out Field Settings Panel (Drawer) */}
      {editingStepIdx !== null && steps[editingStepIdx] && (() => {
        const step = steps[editingStepIdx]
        const hasOptions = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(step.type)

        return (
          <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setEditingStepIdx(null)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in-right">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">Step {editingStepIdx + 1} Configuration</span>
                  <h3 className="font-bold text-slate-805 text-sm truncate" title={step.label || 'New step'}>
                    {step.label || 'Configure response details'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStepIdx(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body Scroll */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* 1. Field Type & Core properties */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Field Input Type</label>
                    <select
                      value={step.type}
                      onChange={e => {
                        updateStep(editingStepIdx, 'type', e.target.value)
                        if (!['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(e.target.value)) {
                          updateStep(editingStepIdx, 'options', [])
                        }
                      }}
                      className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 cursor-pointer hover:bg-slate-100 outline-none focus:ring-1 focus:ring-blue-500 transition shadow-xxs"
                    >
                      {STEP_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {step.type !== 'SECTION' && (
                    <label className="flex items-center gap-2.5 p-3 hover:bg-slate-50 rounded-xl border border-slate-150 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.isMandatory}
                        onChange={e => updateStep(editingStepIdx, 'isMandatory', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Required Step</span>
                        <span className="text-slate-400 text-[11px]">Operator cannot bypass or close work order without ticking off this block.</span>
                      </div>
                    </label>
                  )}
                </div>

                {/* 1.5 Step Specific Attachments & SOP Reference Documents */}
                {step.type !== 'SECTION' &&
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Field Step Attachments</span>
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded-full">
                        {step.settings?.attachments?.length || 0} files
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal">
                      Attach PDFs, specifications, blueprints, or reference photos for this step. Technicians can view them right below the checklist instruction line.
                    </p>

                     {/* Existing step-specific attachments */}
                     {step.settings?.attachments && step.settings.attachments.length > 0 && (
                       <div className="space-y-1.5">
                         {step.settings.attachments.map((at: Attachment, idx: number) => (
                           <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs leading-none">
                             <div className="flex items-center gap-1.5 truncate max-w-[220px] flex-1">
                               <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[8px] font-extrabold uppercase">{at.type || 'SOP'}</span>
                               <span className="font-semibold text-slate-705 truncate max-w-[120px]">{at.name}</span>
                               <a 
                                 href={at.url} 
                                 target="_blank" 
                                 rel="noreferrer" 
                                 className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-200/30 transition-all uppercase tracking-tighter"
                               >
                                 View
                               </a>
                             </div>
                             <button
                               type="button"
                               onClick={() => {
                                 const currentAttachments = step.settings?.attachments ? [...step.settings.attachments] : []
                                 const target = currentAttachments[idx]
                                 if (target?.key || target?.url) {
                                   fetch(`/api/upload?key=${encodeURIComponent(target.key || '')}&url=${encodeURIComponent(target.url || '')}`, {
                                     method: 'DELETE'
                                   }).catch(err => console.error('Failed to cleanup step file:', err))
                                 }
                                 const updatedAttachments = currentAttachments.filter((_: unknown, i: number) => i !== idx)
                                 updateStepConfig(editingStepIdx, 'settings', 'attachments', updatedAttachments)
                               }}
                               className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-colors"
                             >
                               <X className="w-3.5 h-3.5" />
                             </button>
                           </div>
                         ))}
                       </div>
                     )}

                    {/* Form to add a new step attachment */}
                    <div className="border-t border-slate-200/50 pt-3 space-y-2 bg-slate-100/30 p-2 rounded-lg text-xs">
                      {/* Real File Uploader Area */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="border border-dashed border-slate-300 rounded-xl bg-white p-3 text-center hover:bg-slate-50 transition-all cursor-pointer relative group/step-file">
                          {uploadingStepFile ? (
                            <div className="flex items-center justify-center py-2 text-slate-500 font-bold gap-1.5 text-xs">
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500 gap-0.5 hover:text-blue-605 text-[11px]">
                              <FileUp className="w-5 h-5 text-slate-400 group-hover/step-file:text-blue-500 transition-colors" />
                              <span className="font-bold text-slate-700">Upload File</span>
                              <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  setUploadingStepFile(true)
                                  const uploaded = await uploadFileHelper(file)
                                  setUploadingStepFile(false)
                                  if (uploaded) {
                                    const currentAttachments = step.settings?.attachments ?? []
                                    const newAt: Attachment = {
                                      name: uploaded.name.split('.').slice(0, -1).join('.') || uploaded.name,
                                      url: uploaded.url,
                                      type: uploaded.type,
                                      key: uploaded.key,
                                    }
                                    updateStepConfig(editingStepIdx, 'settings', 'attachments', [...currentAttachments, newAt])
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Camera Option */}
                        <div className="border border-dashed border-slate-300 rounded-xl bg-white p-3 text-center hover:bg-slate-50 transition-all cursor-pointer relative group">
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-0.5 hover:text-blue-605 text-[11px]">
                            <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-blue-500">📷</div>
                            <span className="font-bold text-slate-700">Take Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setUploadingStepFile(true)
                                const uploaded = await uploadFileHelper(file)
                                setUploadingStepFile(false)
                                if (uploaded) {
                                  const currentAttachments = step.settings?.attachments ?? []
                                  const newAt: Attachment = {
                                    name: `Photo_${new Date().getTime()}`,
                                    url: uploaded.url,
                                    type: 'IMAGE',
                                    key: uploaded.key,
                                  }
                                  updateStepConfig(editingStepIdx, 'settings', 'attachments', [...currentAttachments, newAt])
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }

                {/* 2. Options list for Selects */}
                {hasOptions && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Configure Selections</span>
                      <button
                        type="button"
                        onClick={() => addOption(editingStepIdx)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="w-3 h-3" /> Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(step.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateOption(editingStepIdx, oi, e.target.value)}
                            placeholder={`Option ${oi + 1} (e.g. Broken Belt)`}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(editingStepIdx, oi)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {(step.options || []).length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-2">No selection items configured yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Inspection Fail Actions (Corrective logic) */}
                {step.type === 'INSPECTION' && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Corrective Fail Triggers</span>
                    
                    <div className="space-y-3 pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!step.settings?.requirePhotoOnFail}
                          onChange={e => updateStepConfig(editingStepIdx, 'settings', 'requirePhotoOnFail', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 block">Require Photo on Fail</span>
                          <span className="text-slate-450 block text-[11px] leading-relaxed mt-0.5">Forces the technician to upload an inspection picture if they click FAIL or FLAG.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200">
                        <input
                          type="checkbox"
                          checked={!!step.settings?.correctiveAction}
                          onChange={e => updateStepConfig(editingStepIdx, 'settings', 'correctiveAction', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 block">Corrective Work Order Action</span>
                          <span className="text-slate-450 block text-[11px] leading-relaxed mt-0.5">Prompt or draft a repair ticket automatically when a fail is recorded.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* 4. Number Boundaries Validation */}
                {step.type === 'NUMBER_INPUT' && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Boundary Tolerances</span>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Minimum Limit</label>
                        <input
                          type="number"
                          value={step.settings?.min ?? ''}
                          onChange={e => updateStepConfig(editingStepIdx, 'settings', 'min', e.target.value)}
                          placeholder="e.g. 90"
                          className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Maximum Limit</label>
                        <input
                          type="number"
                          value={step.settings?.max ?? ''}
                          onChange={e => updateStepConfig(editingStepIdx, 'settings', 'max', e.target.value)}
                          placeholder="e.g. 110"
                          className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">Operators entering quantities violating these boundaries will receive a strict alarm during form execution.</p>
                  </div>
                )}

                {/* 5. Meter custom unit config */}
                {step.type === 'METER' && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Asset Meter Settings</span>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Physical Reading Unit</label>
                      <input
                        type="text"
                        value={step.settings?.unit ?? ''}
                        onChange={e => updateStepConfig(editingStepIdx, 'settings', 'unit', e.target.value)}
                        placeholder="e.g. Hours, Miles, Celsius, PSI"
                        className="w-full text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">Technician readings update the asset’s profile log in your compliance database instantly.</p>
                  </div>
                )}

                {/* 6. Advanced conditional visibility logic */}
                {step.type !== 'SECTION' && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Conditional Display Logic</span>
                    
                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={!!step.logic?.enabled}
                          onChange={e => updateStepConfig(editingStepIdx, 'logic', 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">Display this step conditionally</span>
                      </label>
                      
                      {step.logic?.enabled && (
                        <div className="pt-3 flex flex-col gap-3 border-t border-slate-200 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Show ONLY IF parent step:</label>
                            <select
                              value={step.logic?.parentStepIdx ?? ''}
                              onChange={e => updateStepConfig(editingStepIdx, 'logic', 'parentStepIdx', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 outline-none text-xs"
                            >
                              <option value="">-- Choose Step --</option>
                              {steps.slice(0, editingStepIdx).map((s, i) => {
                                if (s.type === 'SECTION') return null
                                return (
                                  <option key={i} value={i}>Step {i + 1}: {s.label.substring(0, 32)}{s.label.length > 32 ? '...' : ''}</option>
                                )
                              })}
                            </select>
                          </div>

                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Condition</label>
                              <select
                                value={step.logic?.operator ?? 'equals'}
                                onChange={e => updateStepConfig(editingStepIdx, 'logic', 'operator', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 outline-none text-xs"
                              >
                                <option value="equals">Equals</option>
                                <option value="not_equals">Not Equals</option>
                                <option value="contains">Contains</option>
                                <option value="not_contains">Does Not Contain</option>
                                <option value="greater_than">Greater Than</option>
                                <option value="less_than">Less Than</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Value</label>
                              <input
                                type="text"
                                value={step.logic?.parentStepValue ?? ''}
                                onChange={e => updateStepConfig(editingStepIdx, 'logic', 'parentStepValue', e.target.value)}
                                placeholder="e.g. Yes, FAIL, 100"
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 outline-none text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
                <button
                  type="button"
                  onClick={() => setEditingStepIdx(null)}
                  className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md"
                >
                  Save & Apply Rules
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Submission Buttons */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition shadow-xxs"
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
