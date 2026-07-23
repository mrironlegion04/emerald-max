'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, GripVertical, AlertCircle, X, Search, Paperclip,
  Heading as HeadingIcon, Settings, ChevronDown, ChevronRight, Check,
  CheckSquare, HelpCircle, FileUp, Loader2, Link2, Users, BarChart3,
  Layers, List, Hash, Type, Calendar, Camera, PenTool, FileText,
  ToggleLeft, ChevronUp, ToggleRight, ClipboardList, Wrench,
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════════════
   MaintainX-inspired design tokens
   Brand blue #155EEF, ink navy #0B1220, success/warn/danger match
   MaintainX's Pass / Flag / Fail inspection coding.
   ════════════════════════════════════════════════════════════════════ */

interface FieldTypeItem {
  value: string
  label: string
  icon: React.ComponentType<any>
  desc: string
}

interface FieldTypeGroup {
  group: string
  items: FieldTypeItem[]
}

const FIELD_TYPES: FieldTypeGroup[] = [
  { group: 'Structure', items: [
    { value: 'SECTION', label: 'Heading', icon: HeadingIcon, desc: 'Organize fields into a section' },
    { value: 'INSTRUCTION', label: 'Instruction', icon: FileText, desc: 'Static informational text' },
  ]},
  { group: 'Input', items: [
    { value: 'CHECKBOX', label: 'Checkbox', icon: CheckSquare, desc: 'Single checkbox toggle' },
    { value: 'TEXT_INPUT', label: 'Text Field', icon: Type, desc: 'Single or multi-line text' },
    { value: 'NUMBER_INPUT', label: 'Number', icon: Hash, desc: 'Numeric value input' },
    { value: 'AMOUNT', label: 'Amount', icon: BarChart3, desc: 'Currency amount' },
    { value: 'DATE', label: 'Date', icon: Calendar, desc: 'Date and optional time' },
    { value: 'SIGNATURE', label: 'Signature', icon: PenTool, desc: 'Digital signature capture' },
    { value: 'PHOTO', label: 'Photo', icon: Camera, desc: 'Photo from device or camera' },
    { value: 'FILE', label: 'File', icon: FileUp, desc: 'File attachment upload' },
    { value: 'METER', label: 'Meter Reading', icon: Wrench, desc: 'Record an asset meter reading' },
  ]},
  { group: 'Selection', items: [
    { value: 'INSPECTION', label: 'Inspection', icon: Check, desc: 'Pass / Flag / Fail check' },
    { value: 'YES_NO_NA', label: 'Yes / No / N/A', icon: ToggleLeft, desc: 'Three-way toggle' },
    { value: 'SINGLE_SELECT', label: 'Single Select', icon: ChevronDown, desc: 'Choose one from a list' },
    { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: CheckSquare, desc: 'Select multiple options' },
    { value: 'DROPDOWN', label: 'Dropdown', icon: ChevronDown, desc: 'Choose one from a dropdown' },
  ]},
  { group: 'Advanced', items: [
    { value: 'NESTED_PROCEDURE', label: 'Nested Procedure', icon: Layers, desc: 'Embed another procedure' },
  ]},
]

const FLAT_FIELD_TYPES: FieldTypeItem[] = FIELD_TYPES.flatMap(g => g.items)

interface ProcedureStep {
  id?: string
  label: string
  type: string
  isMandatory: boolean
  options: string[]
  sortOrder: number
  settings?: any
  logic?: any
  links?: any
  assignedUserIds?: string[]
  assignedTeamIds?: string[]
  nestedProcedureId?: string | null
}

interface SelectOption { id: string; name: string }

interface Props {
  templateId?: string
  initialData?: {
    name: string
    description: string
    steps: ProcedureStep[]
    assetIds?: string[]
    categoryIds?: string[]
    locationIds?: string[]
    teamId?: string | null
  }
  assets?: SelectOption[]
  assetCategories?: SelectOption[]
  locations?: SelectOption[]
  teams?: SelectOption[]
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
  } catch { /* fallback */ }
  return { text: descRaw, attachments: [] }
}

function serializeProcedureDescription(text: string, attachments: Attachment[]): string {
  return JSON.stringify({ text, attachments })
}

function MultiTagSelect({
  label, options, selected, onChange, placeholder,
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

  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
  const selectedLabels = selected.map(id => options.find(o => o.id === id)).filter(Boolean) as SelectOption[]

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div
        className="flex flex-wrap gap-1.5 min-h-[40px] py-1.5 cursor-text bg-white border border-slate-200 rounded-lg px-3 text-sm focus-within:ring-2 focus-within:ring-[#155EEF]/20 focus-within:border-[#155EEF] transition"
        onClick={() => { setOpen(true); setQuery('') }}
      >
        {selectedLabels.length === 0 && !open && (
          <span className="text-slate-400 text-xs self-center">{placeholder ?? 'Select...'}</span>
        )}
        {selectedLabels.map(opt => (
          <span key={opt.id} className="inline-flex items-center gap-1 bg-[#EEF4FF] text-[#155EEF] text-xs font-medium px-2 py-1 rounded-md">
            {opt.name}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(opt.id) }} className="hover:text-[#0B3FC4]">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-md px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="bg-transparent border-none outline-none text-xs flex-1" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No options found</p>
            ) : filtered.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} className="w-3.5 h-3.5 rounded border-slate-300 accent-[#155EEF]" />
                <span className="text-xs text-slate-700">{opt.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════════════ */
export default function ProcedureForm({ templateId, initialData, assets, assetCategories, locations, teams }: Props) {
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
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialData?.teamId ?? '')
  const [availableProcedures, setAvailableProcedures] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/procedures')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableProcedures(data.map((p: any) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})
  }, [])

  const [newAttachName, setNewAttachName] = useState('')
  const [newAttachUrl, setNewAttachUrl] = useState('')
  const [newAttachType, setNewAttachType] = useState<Attachment['type']>('PDF')
  const [showAttachForm, setShowAttachForm] = useState(false)
  const [uploadingProcFile, setUploadingProcFile] = useState(false)
  const [uploadingStepFile, setUploadingStepFile] = useState(false)

  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields')
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [draggedHeadingIdx, setDraggedHeadingIdx] = useState<number | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddItem(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ─── Step grouping ─── */
  interface GroupedSection { headingIdx: number; heading: ProcedureStep | null; steps: { step: ProcedureStep; originalIdx: number }[] }

  const groupedSections: GroupedSection[] = []
  let currentGroup: GroupedSection = { headingIdx: -1, heading: null, steps: [] }
  steps.forEach((step, originalIdx) => {
    if (step.type === 'SECTION') {
      if (currentGroup.headingIdx !== -1 || currentGroup.steps.length > 0) groupedSections.push(currentGroup)
      currentGroup = { headingIdx: originalIdx, heading: step, steps: [] }
    } else {
      currentGroup.steps.push({ step, originalIdx })
    }
  })
  if (currentGroup.headingIdx !== -1 || currentGroup.steps.length > 0 || groupedSections.length === 0) groupedSections.push(currentGroup)

  /* ─── File upload ─── */
  async function uploadFileHelper(file: File): Promise<{ url: string; name: string; type: Attachment['type']; key?: string } | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Failed to upload file') }
      const data = await res.json()
      let type: Attachment['type'] = 'OTHER'
      const mime = file.type.toLowerCase()
      if (mime.includes('pdf')) type = 'PDF'
      else if (mime.startsWith('image/')) type = 'IMAGE'
      else if (mime.startsWith('video/')) type = 'VIDEO'
      else if (mime.includes('msword') || mime.includes('word') || mime.includes('document')) type = 'MANUAL'
      return { url: data.url, name: file.name, type, key: data.key }
    } catch (err: any) { alert(err.message || 'Upload failed'); return null }
  }

  /* ─── Step helpers ─── */
  function addStep(type: string, afterIdx?: number) {
    setSteps(prev => {
      const arr = [...prev]
      let insertAt = arr.length
      if (afterIdx !== undefined) {
        insertAt = afterIdx + 1
        while (insertAt < arr.length && arr[insertAt].type !== 'SECTION') insertAt++
      }
      const newStep: ProcedureStep = {
        label: type === 'SECTION' ? `Heading ${arr.filter(s => s.type === 'SECTION').length + 1}` : '',
        type,
        isMandatory: false,
        options: [],
        sortOrder: insertAt,
        settings: {},
        logic: {},
      }
      arr.splice(insertAt, 0, newStep)
      const updated = arr.map((it, i) => ({ ...it, sortOrder: i }))
      setTimeout(() => setSelectedStepIdx(insertAt), 50)
      return updated
    })
    setShowAddItem(false)
  }

  function removeStep(idx: number) {
    if (selectedStepIdx === idx) setSelectedStepIdx(null)
    else if (selectedStepIdx !== null && selectedStepIdx > idx) setSelectedStepIdx(selectedStepIdx - 1)
    setSteps(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })))
  }

  function removeHeading(headingIdx: number, deleteChildren: boolean) {
    if (selectedStepIdx === headingIdx) setSelectedStepIdx(null)
    setSteps(prev => {
      if (deleteChildren) {
        const arr: ProcedureStep[] = []
        let skip = false
        for (let i = 0; i < prev.length; i++) {
          if (i === headingIdx) { skip = true; continue }
          if (skip && prev[i].type === 'SECTION') skip = false
          if (!skip) arr.push(prev[i])
        }
        return arr.map((it, i) => ({ ...it, sortOrder: i }))
      }
      return prev.filter((_, i) => i !== headingIdx).map((it, i) => ({ ...it, sortOrder: i }))
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

  function moveStep(idx: number, direction: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const target = idx + direction
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      if (selectedStepIdx === idx) setSelectedStepIdx(target)
      else if (selectedStepIdx === target) setSelectedStepIdx(idx)
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  function moveHeadingSection(headingIdx: number, direction: -1 | 1) {
    const secIndices = steps.map((s, i) => s.type === 'SECTION' ? i : -1).filter(i => i !== -1)
    const currentSecPos = secIndices.indexOf(headingIdx)
    if (currentSecPos === -1) return
    const targetSecPos = currentSecPos + direction
    if (targetSecPos < 0 || targetSecPos >= secIndices.length) return
    const targetHeadingIdx = secIndices[targetSecPos]

    setSteps(prev => {
      const groups: ProcedureStep[][] = []
      let tempGroup: ProcedureStep[] = []
      prev.forEach(step => {
        if (step.type === 'SECTION') { if (tempGroup.length > 0) groups.push(tempGroup); tempGroup = [step] }
        else tempGroup.push(step)
      })
      if (tempGroup.length > 0) groups.push(tempGroup)

      const activeGroupIdx = groups.findIndex(g => g[0].type === 'SECTION' && prev.indexOf(g[0]) === headingIdx)
      const targetGroupIdx = groups.findIndex(g => g[0].type === 'SECTION' && prev.indexOf(g[0]) === targetHeadingIdx)
      if (activeGroupIdx === -1 || targetGroupIdx === -1) return prev

      ;[groups[activeGroupIdx], groups[targetGroupIdx]] = [groups[targetGroupIdx], groups[activeGroupIdx]]
      setSelectedStepIdx(null)
      return groups.flat().map((it, i) => ({ ...it, sortOrder: i }))
    })
  }

  /* ─── Drag and drop ─── */
  function handleDragStart(idx: number) { setDraggedIdx(idx) }
  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIdx) return
    setSteps(prev => {
      const arr = [...prev]
      const [draggedItem] = arr.splice(draggedIdx, 1)
      arr.splice(dropIdx, 0, draggedItem)
      setSelectedStepIdx(null)
      return arr.map((it, i) => ({ ...it, sortOrder: i }))
    })
    setDraggedIdx(null)
  }

  function handleHeadingDragStart(headingIdx: number) { setDraggedHeadingIdx(headingIdx) }
  function handleHeadingDrop(e: React.DragEvent, targetHeadingIdx: number) {
    e.preventDefault()
    if (draggedHeadingIdx === null || draggedHeadingIdx === targetHeadingIdx) return
    setSteps(prev => {
      const groups: ProcedureStep[][] = []
      let tempGroup: ProcedureStep[] = []
      prev.forEach(step => {
        if (step.type === 'SECTION') { if (tempGroup.length > 0) groups.push(tempGroup); tempGroup = [step] }
        else tempGroup.push(step)
      })
      if (tempGroup.length > 0) groups.push(tempGroup)

      const fromGroupIdx = groups.findIndex(g => prev.indexOf(g[0]) === draggedHeadingIdx)
      const toGroupIdx = groups.findIndex(g => prev.indexOf(g[0]) === targetHeadingIdx)
      if (fromGroupIdx === -1 || toGroupIdx === -1) return prev

      const [movedGroup] = groups.splice(fromGroupIdx, 1)
      groups.splice(toGroupIdx, 0, movedGroup)
      setSelectedStepIdx(null)
      return groups.flat().map((it, i) => ({ ...it, sortOrder: i }))
    })
    setDraggedHeadingIdx(null)
  }

  /* ─── Attachments ─── */
  function addAttachment() {
    if (!newAttachName.trim() || !newAttachUrl.trim()) return
    setAttachments(prev => [...prev, { name: newAttachName.trim(), url: newAttachUrl.trim(), type: newAttachType, key: undefined }])
    setNewAttachName(''); setNewAttachUrl(''); setNewAttachType('PDF'); setShowAttachForm(false)
  }

  async function removeAttachment(idx: number) {
    const target = attachments[idx]
    if (target?.key) {
      try { await fetch(`/api/upload?key=${encodeURIComponent(target.key)}&url=${encodeURIComponent(target.url)}`, { method: 'DELETE' }) } catch {}
    }
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  /* ─── Submit ─── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (steps.some(it => !it.label.trim())) { setError('All procedure steps and headings must have a descriptive label/title.'); return }
    const optionRequiredTypes = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN']
    if (steps.some(it => optionRequiredTypes.includes(it.type) && (!it.options || it.options.some(o => !o.trim())))) {
      setError('All selection and multiple choice fields must have non-empty options.'); return
    }
    setError(''); setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: serializeProcedureDescription(descriptionText.trim(), attachments),
        steps: steps.map((it, i) => ({
          label: it.label.trim(), type: it.type, isMandatory: it.isMandatory,
          options: optionRequiredTypes.includes(it.type) ? (it.options || []).map(o => o.trim()).filter(Boolean) : [],
          sortOrder: i, settings: it.settings ?? {}, logic: it.logic ?? {},
          links: it.links ?? null,
          assignedUserIds: it.assignedUserIds ?? [], assignedTeamIds: it.assignedTeamIds ?? [],
          nestedProcedureId: it.nestedProcedureId ?? null,
        })),
        assetIds: selectedAssetIds, categoryIds: selectedCategoryIds, locationIds: selectedLocationIds,
        teamId: selectedTeamId || null,
      }
      const url = isEdit ? `/api/procedures/${templateId}` : '/api/procedures'
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push('/procedures'); router.refresh()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  const showTagSection = assets || assetCategories || locations
  const hasFields = steps.length > 0

  /* ════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                         */
  /* ════════════════════════════════════════════════════════════════ */
  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-[calc(100vh-120px)] bg-[#F7F8FA]">

      {/* ── Sticky Header (MaintainX chrome: navy breadcrumb strip + white title bar) ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-0 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-1.5 pt-2.5 text-[11px] text-slate-400 font-medium">
          <ClipboardList className="w-3.5 h-3.5" />
          <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procedures')}>Procedures</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600">{isEdit ? 'Edit Template' : 'New Template'}</span>
          {!isEdit && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wide">Draft</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-xl font-bold text-[#0B1220] bg-transparent border-none outline-none placeholder:text-slate-300 tracking-tight"
              placeholder="Untitled Procedure"
              required
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => router.back()} className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-[#155EEF] text-white text-xs font-semibold rounded-lg hover:bg-[#0F4FD1] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving...' : isEdit ? 'Save Template' : 'Create Template'}
            </button>
          </div>
        </div>

        {/* Tabs — MaintainX segmented underline style */}
        <div className="flex items-center gap-1 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === 'fields' ? 'border-[#155EEF] text-[#155EEF]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Procedure Fields
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === 'settings' ? 'border-[#155EEF] text-[#155EEF]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-[#FEF3F2] border border-[#FDA29B] text-[#B42318] px-4 py-3 rounded-xl text-xs flex items-center gap-2 shadow-xs mt-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 pt-4">
        {activeTab === 'fields' ? (
          /* ═══════════════ PROCEDURE FIELDS TAB ═══════════════ */
          <div className="flex gap-4 h-full">
            {/* Left: Steps list */}
            <div className={`flex-1 min-w-0 ${selectedStepIdx !== null ? 'max-w-[calc(100%-400px)]' : ''}`}>
              {!hasFields ? (
                /* ── Empty State ── */
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                  <div className="w-14 h-14 rounded-2xl bg-[#EEF4FF] flex items-center justify-center mb-4">
                    <ClipboardList className="w-7 h-7 text-[#155EEF]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0B1220] mb-1">No fields in this procedure yet</p>
                  <p className="text-xs text-slate-400 max-w-xs text-center mb-5">
                    Add Headings to organize your checklist and Fields to capture responses from technicians.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addStep('SECTION')} className="px-4 py-2 bg-[#155EEF] text-white text-xs font-semibold rounded-lg hover:bg-[#0F4FD1] transition shadow-sm flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Heading
                    </button>
                    <button type="button" onClick={() => addStep('CHECKBOX')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Field
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Steps List ── */
                <div className="space-y-4">
                  {groupedSections.map((group, groupIdx) => {
                    const isFloating = group.headingIdx === -1
                    const heading = group.heading
                    return (
                      <div
                        key={groupIdx}
                        className={`rounded-xl overflow-hidden transition-all ${
                          isFloating ? '' : 'bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                        }`}
                        draggable={!isFloating}
                        onDragStart={() => !isFloating && handleHeadingDragStart(group.headingIdx)}
                        onDragOver={handleDragOver}
                        onDrop={e => !isFloating && handleHeadingDrop(e, group.headingIdx)}
                      >
                        {/* Section Header */}
                        {!isFloating && heading && (
                          <div className="flex items-center gap-2 px-4 py-3 bg-[#F7F9FC] border-b border-slate-150 border-l-4 border-l-[#155EEF]">
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-0.5">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <HeadingIcon className="w-4 h-4 text-[#155EEF] flex-shrink-0" />
                              <input
                                type="text"
                                value={heading.label}
                                onChange={e => updateStep(group.headingIdx, 'label', e.target.value)}
                                placeholder="Heading title"
                                className="font-bold text-sm text-[#0B1220] bg-transparent border-none outline-none p-0 flex-1 placeholder-slate-400"
                              />
                            </div>
                            <div className="flex items-center gap-0.5">
                              {group.steps.length === 0 && (
                                <span className="text-[10px] text-slate-400 mr-1">Empty</span>
                              )}
                              <button type="button" onClick={() => moveHeadingSection(group.headingIdx, -1)} className="p-1 text-slate-300 hover:text-slate-600 rounded" title="Move up">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => moveHeadingSection(group.headingIdx, 1)} className="p-1 text-slate-300 hover:text-slate-600 rounded" title="Move down">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (group.steps.length > 0) {
                                    if (confirm(`Delete "${heading.label}" and all ${group.steps.length} field(s) under it?`)) removeHeading(group.headingIdx, true)
                                    else removeHeading(group.headingIdx, false)
                                  } else removeHeading(group.headingIdx, false)
                                }}
                                className="p-1 text-slate-300 hover:text-[#B42318] hover:bg-[#FEF3F2] rounded transition-colors"
                                title="Delete heading"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Fields under this heading */}
                        <div className={`${isFloating ? 'space-y-2' : 'divide-y divide-slate-100'}`}>
                          {group.steps.length === 0 && !isFloating && (
                            <div className="px-4 py-6 text-center">
                              <p className="text-xs text-slate-400">No fields yet</p>
                              <button type="button" onClick={() => addStep('CHECKBOX', group.headingIdx)} className="mt-2 text-xs font-semibold text-[#155EEF] hover:text-[#0F4FD1] flex items-center gap-1 mx-auto">
                                <Plus className="w-3 h-3" /> Add a field
                              </button>
                            </div>
                          )}
                          {group.steps.map(({ step, originalIdx }) => (
                            <FieldCard
                              key={originalIdx}
                              step={step}
                              idx={originalIdx}
                              isSelected={selectedStepIdx === originalIdx}
                              onSelect={() => setSelectedStepIdx(selectedStepIdx === originalIdx ? null : originalIdx)}
                              onUpdate={(field, value) => updateStep(originalIdx, field, value)}
                              onRemove={() => removeStep(originalIdx)}
                              onMoveUp={() => moveStep(originalIdx, -1)}
                              onMoveDown={() => moveStep(originalIdx, 1)}
                              isDragging={draggedIdx === originalIdx}
                              onDragStart={() => handleDragStart(originalIdx)}
                              onDragOver={handleDragOver}
                              onDragDrop={e => handleDrop(e, originalIdx)}
                              stepNumber={originalIdx + 1}
                            />
                          ))}
                        </div>

                        {/* Quick add button at bottom of each section */}
                        {!isFloating && (
                          <div className="px-4 py-2 border-t border-slate-100 bg-[#F7F9FC]">
                            <button type="button" onClick={() => addStep('CHECKBOX', group.headingIdx)} className="text-xs font-semibold text-[#155EEF] hover:text-[#0F4FD1] flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Add field
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Global Add Button */}
                  <div className="relative" ref={addMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowAddItem(!showAddItem)}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-[#155EEF] hover:border-[#155EEF]/40 hover:bg-[#EEF4FF]/50 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>

                    {showAddItem && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-slate-100 bg-[#F7F9FC]">
                          <p className="text-xs font-bold text-[#0B1220]">Add to procedure</p>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                          {FIELD_TYPES.map(group => (
                            <div key={group.group}>
                              <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.group}</span>
                              </div>
                              {group.items.map(ft => {
                                const Icon = ft.icon
                                return (
                                  <button
                                    key={ft.value}
                                    type="button"
                                    onClick={() => addStep(ft.value)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#EEF4FF]/60 transition text-left"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                                      <Icon className="w-4 h-4 text-[#155EEF]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-700">{ft.label}</p>
                                      <p className="text-[11px] text-slate-400 truncate">{ft.desc}</p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Field Settings Panel (when a step is selected) */}
            {selectedStepIdx !== null && steps[selectedStepIdx] && (
              <div className="w-[380px] flex-shrink-0 border border-slate-200 rounded-xl bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)] overflow-hidden h-fit sticky top-[132px]">
                <FieldSettingsPanel
                  step={steps[selectedStepIdx]}
                  idx={selectedStepIdx}
                  allSteps={steps}
                  templateId={templateId}
                  availableProcedures={availableProcedures}
                  onClose={() => setSelectedStepIdx(null)}
                  onUpdate={(field, value) => updateStep(selectedStepIdx, field, value)}
                  onUpdateConfig={(type, key, value) => updateStepConfig(selectedStepIdx, type, key, value)}
                  onAddOption={() => addOption(selectedStepIdx)}
                  onRemoveOption={(optIdx) => removeOption(selectedStepIdx, optIdx)}
                  onUpdateOption={(optIdx, value) => updateOption(selectedStepIdx, optIdx, value)}
                  uploadFileHelper={uploadFileHelper}
                  uploadingStepFile={uploadingStepFile}
                  setUploadingStepFile={setUploadingStepFile}
                />
              </div>
            )}
          </div>
        ) : (
          /* ═══════════════ SETTINGS TAB ═══════════════ */
          <div className="max-w-2xl space-y-4">
            {/* Description */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-bold text-[#0B1220]">Description</h3>
              <textarea
                value={descriptionText}
                onChange={e => setDescriptionText(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF] resize-none transition"
                rows={3}
                placeholder="Add a description for this procedure..."
              />
            </div>

            {/* Team Assignment */}
            {teams && teams.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h3 className="text-sm font-bold text-[#0B1220]">Team in Charge</h3>
                <select
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF] transition"
                >
                  <option value="">No team assigned</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Assigning a team helps others select the right team when adding this procedure to a work order.</p>
              </div>
            )}

            {/* Tags */}
            {showTagSection && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h3 className="text-sm font-bold text-[#0B1220]">Tags</h3>
                <p className="text-[11px] text-slate-400 -mt-2">Tags help filter procedures in the library.</p>
                <div className="space-y-4">
                  {locations && (
                    <MultiTagSelect label="Locations" options={locations} selected={selectedLocationIds} onChange={setSelectedLocationIds} placeholder="Assign to locations..." />
                  )}
                  {assetCategories && (
                    <MultiTagSelect label="Categories" options={assetCategories} selected={selectedCategoryIds} onChange={setSelectedCategoryIds} placeholder="Assign to categories..." />
                  )}
                  {assets && (
                    <MultiTagSelect label="Assets" options={assets} selected={selectedAssetIds} onChange={setSelectedAssetIds} placeholder="Assign to assets..." />
                  )}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1220]">Reference Documents</h3>
                <button type="button" onClick={() => setShowAttachForm(!showAttachForm)} className="text-xs font-semibold text-[#155EEF] hover:text-[#0F4FD1] flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> {showAttachForm ? 'Cancel' : 'Add File'}
                </button>
              </div>

              {showAttachForm && (
                <div className="p-4 bg-[#F7F9FC] border border-slate-200/60 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-dashed border-slate-300 rounded-xl bg-white p-4 text-center hover:bg-[#EEF4FF]/40 hover:border-[#155EEF]/40 transition-all cursor-pointer relative group">
                      {uploadingProcFile ? (
                        <div className="flex flex-col items-center justify-center py-2 text-slate-500 font-semibold gap-2 text-xs">
                          <Loader2 className="w-4 h-4 text-[#155EEF] animate-spin" />
                          Uploading...
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2 text-slate-500 gap-1">
                          <FileUp className="w-5 h-5 text-slate-400 group-hover:text-[#155EEF] transition-colors" />
                          <span className="font-semibold text-xs text-slate-600">Upload File</span>
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={async e => {
                              const file = e.target.files?.[0]; if (!file) return
                              setUploadingProcFile(true); const uploaded = await uploadFileHelper(file); setUploadingProcFile(false)
                              if (uploaded) setAttachments(prev => [...prev, { name: uploaded.name.split('.').slice(0, -1).join('.') || uploaded.name, url: uploaded.url, type: uploaded.type, key: uploaded.key }])
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="border border-dashed border-slate-300 rounded-xl bg-white p-4 text-center hover:bg-[#EEF4FF]/40 hover:border-[#155EEF]/40 transition-all cursor-pointer relative group">
                      <div className="flex flex-col items-center justify-center py-2 text-slate-500 gap-1">
                        <Camera className="w-5 h-5 text-slate-400 group-hover:text-[#155EEF] transition-colors" />
                        <span className="font-semibold text-xs text-slate-600">Take Photo</span>
                        <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return
                            setUploadingProcFile(true); const uploaded = await uploadFileHelper(file); setUploadingProcFile(false)
                            if (uploaded) setAttachments(prev => [...prev, { name: `Photo_${Date.now()}`, url: uploaded.url, type: 'IMAGE', key: uploaded.key }])
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No reference documents attached.</p>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map((attach, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-[#F7F9FC] border border-slate-150 rounded-lg text-xs">
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-[#EEF4FF] border border-[#155EEF]/20 text-[#155EEF] text-[10px] font-bold">{attach.type}</span>
                        <span className="font-medium text-slate-700 truncate">{attach.name}</span>
                        <a href={attach.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#155EEF] hover:text-[#0F4FD1] uppercase">View</a>
                      </div>
                      <button type="button" onClick={() => removeAttachment(idx)} className="p-1 text-slate-400 hover:text-[#B42318] rounded hover:bg-slate-100 transition-colors ml-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  FIELD CARD                                                         */
/* ════════════════════════════════════════════════════════════════════ */
function FieldCard({
  step, idx, isSelected, onSelect, onUpdate, onRemove, onMoveUp, onMoveDown,
  isDragging, onDragStart, onDragOver, onDragDrop, stepNumber,
}: {
  step: ProcedureStep
  idx: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: <K extends keyof ProcedureStep>(field: K, value: ProcedureStep[K]) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isDragging: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragDrop: (e: React.DragEvent) => void
  stepNumber: number
}) {
  const typeInfo = FLAT_FIELD_TYPES.find(ft => ft.value === step.type)
  const TypeIcon = typeInfo?.icon ?? HelpCircle

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDragDrop}
      onClick={onSelect}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group ${
        isDragging ? 'opacity-30' : ''
      } ${
        isSelected
          ? 'bg-[#EEF4FF]/60 border-l-[3px] border-l-[#155EEF]'
          : 'bg-transparent hover:bg-slate-50 border-l-[3px] border-l-transparent'
      }`}
    >
      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Step number */}
      <span className="w-5 text-[11px] font-bold text-slate-400 text-center select-none flex-shrink-0">{stepNumber}</span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={step.label}
          onChange={e => { e.stopPropagation(); onUpdate('label', e.target.value) }}
          onClick={e => e.stopPropagation()}
          placeholder={step.type === 'SECTION' ? 'Heading title...' : 'Enter field label...'}
          className={`w-full bg-transparent border-none outline-none p-0 text-sm placeholder-slate-300 ${
            step.type === 'SECTION' ? 'font-bold text-[#0B1220]' : 'font-medium text-slate-700'
          }`}
        />
      </div>

      {/* Type badge */}
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold flex-shrink-0 ${
        step.type === 'SECTION' ? 'bg-slate-100 text-slate-600' :
        step.type === 'INSPECTION' ? 'bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]' :
        step.type === 'CHECKBOX' ? 'bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]' :
        step.type === 'TEXT_INPUT' || step.type === 'NUMBER_INPUT' ? 'bg-[#EEF4FF] text-[#155EEF] border border-[#155EEF]/20' :
        'bg-slate-100 text-slate-600'
      }`}>
        <TypeIcon className="w-3 h-3" />
        {typeInfo?.label ?? step.type}
      </span>

      {/* Badges */}
      {step.isMandatory && (
        <span className="px-1.5 py-0.5 bg-[#FFFAEB] border border-[#FEDF89] text-[#B54708] text-[9px] font-bold uppercase rounded flex-shrink-0">Required</span>
      )}
      {(step.links ?? []).length > 0 && (
        <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}
      {((step.assignedUserIds ?? []).length > 0 || (step.assignedTeamIds ?? []).length > 0) && (
        <Users className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onMoveUp} className="p-1 text-slate-300 hover:text-slate-600 rounded" title="Move up">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onMoveDown} className="p-1 text-slate-300 hover:text-slate-600 rounded" title="Move down">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onSelect} className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-[#EEF4FF] text-[#155EEF]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title="Settings">
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onRemove} className="p-1 text-slate-300 hover:text-[#B42318] hover:bg-[#FEF3F2] rounded transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════ */
/*  FIELD SETTINGS PANEL                                               */
/* ════════════════════════════════════════════════════════════════════ */
function FieldSettingsPanel({
  step, idx, allSteps, templateId, availableProcedures, onClose,
  onUpdate, onUpdateConfig, onAddOption, onRemoveOption, onUpdateOption,
  uploadFileHelper, uploadingStepFile, setUploadingStepFile,
}: {
  step: ProcedureStep
  idx: number
  allSteps: ProcedureStep[]
  templateId?: string
  availableProcedures: { id: string; name: string }[]
  onClose: () => void
  onUpdate: <K extends keyof ProcedureStep>(field: K, value: ProcedureStep[K]) => void
  onUpdateConfig: (type: 'settings' | 'logic', key: string, value: any) => void
  onAddOption: () => void
  onRemoveOption: (optIdx: number) => void
  onUpdateOption: (optIdx: number, value: string) => void
  uploadFileHelper: (file: File) => Promise<{ url: string; name: string; type: 'PDF' | 'IMAGE' | 'VIDEO' | 'MANUAL' | 'OTHER'; key?: string } | null>
  uploadingStepFile: boolean
  setUploadingStepFile: (v: boolean) => void
}) {
  const typeInfo = FLAT_FIELD_TYPES.find(ft => ft.value === step.type)
  const TypeIcon = typeInfo?.icon ?? HelpCircle
  const hasOptions = ['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(step.type)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-[#F7F9FC]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
            <TypeIcon className="w-3.5 h-3.5 text-[#155EEF]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Field Settings</span>
            <p className="text-xs font-bold text-[#0B1220] truncate">{step.label || 'Untitled field'}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Field Type */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Field Type</label>
          <select
            value={step.type}
            onChange={e => {
              onUpdate('type', e.target.value)
              if (!['SINGLE_SELECT', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(e.target.value)) onUpdate('options', [])
            }}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF] transition"
          >
            {FIELD_TYPES.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Required Toggle */}
        {step.type !== 'SECTION' && (
          <div className="flex items-center justify-between p-3 bg-[#F7F9FC] rounded-lg border border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Required</span>
              <span className="text-[11px] text-slate-400">Technician must complete this field</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('isMandatory', !step.isMandatory)}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${step.isMandatory ? 'bg-[#155EEF]' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${step.isMandatory ? 'translate-x-[18px]' : ''}`} />
            </button>
          </div>
        )}

        {/* Options Editor (for select types) */}
        {hasOptions && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Options</label>
              <button type="button" onClick={onAddOption} className="text-[11px] font-bold text-[#155EEF] hover:text-[#0F4FD1] flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-1.5">
              {(step.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1.5">
                  <span className="w-4 text-[10px] font-semibold text-slate-400 text-center">{oi + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => onUpdateOption(oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition"
                  />
                  <button type="button" onClick={() => onRemoveOption(oi)} className="p-1 text-slate-300 hover:text-[#B42318] rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(step.options || []).length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-2">No options yet</p>
              )}
            </div>
          </div>
        )}

        {/* Inspection Settings */}
        {step.type === 'INSPECTION' && (
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Inspection Options</label>
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECFDF3] text-[#027A48] border border-[#ABEFC6]">PASS</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]">FLAG</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FDA29B]">FAIL</span>
            </div>
            <label className="flex items-center gap-2.5 p-2.5 bg-[#F7F9FC] rounded-lg border border-slate-100 cursor-pointer">
              <input type="checkbox" checked={!!step.settings?.requirePhotoOnFail} onChange={e => onUpdateConfig('settings', 'requirePhotoOnFail', e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#155EEF]" />
              <div className="text-xs">
                <span className="font-semibold text-slate-700 block">Require photo on fail</span>
                <span className="text-slate-400">Forces technician to upload photo if FAIL or FLAG</span>
              </div>
            </label>
            <label className="flex items-center gap-2.5 p-2.5 bg-[#F7F9FC] rounded-lg border border-slate-100 cursor-pointer">
              <input type="checkbox" checked={!!step.settings?.correctiveAction} onChange={e => onUpdateConfig('settings', 'correctiveAction', e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#155EEF]" />
              <div className="text-xs">
                <span className="font-semibold text-slate-700 block">Corrective action</span>
                <span className="text-slate-400">Create a corrective work order on fail</span>
              </div>
            </label>
          </div>
        )}

        {/* Number Boundaries */}
        {step.type === 'NUMBER_INPUT' && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Validation Boundaries</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Min</label>
                <input type="number" value={step.settings?.min ?? ''} onChange={e => onUpdateConfig('settings', 'min', e.target.value)} placeholder="Min" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Max</label>
                <input type="number" value={step.settings?.max ?? ''} onChange={e => onUpdateConfig('settings', 'max', e.target.value)} placeholder="Max" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
              </div>
            </div>
          </div>
        )}

        {/* Meter Unit */}
        {step.type === 'METER' && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Reading Unit</label>
            <input type="text" value={step.settings?.unit ?? ''} onChange={e => onUpdateConfig('settings', 'unit', e.target.value)} placeholder="e.g. Hours, PSI, Miles" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
          </div>
        )}

        {/* Date Include Time */}
        {step.type === 'DATE' && (
          <label className="flex items-center justify-between p-2.5 bg-[#F7F9FC] rounded-lg border border-slate-100 cursor-pointer">
            <span className="text-xs font-semibold text-slate-700">Include time field</span>
            <button
              type="button"
              onClick={() => onUpdateConfig('settings', 'includeTime', !step.settings?.includeTime)}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${step.settings?.includeTime ? 'bg-[#155EEF]' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${step.settings?.includeTime ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
        )}

        {/* Nested Procedure */}
        {step.type === 'NESTED_PROCEDURE' && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Select Procedure</label>
            <select
              value={step.nestedProcedureId ?? ''}
              onChange={e => onUpdate('nestedProcedureId', e.target.value || null)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition"
            >
              <option value="">Choose a procedure...</option>
              {availableProcedures.filter(p => p.id !== templateId).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step Attachments */}
        {step.type !== 'SECTION' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attachments</label>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{step.settings?.attachments?.length || 0} files</span>
            </div>
            {step.settings?.attachments?.length > 0 && (
              <div className="space-y-1">
                {step.settings.attachments.map((at: Attachment, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[#F7F9FC] border border-slate-150 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                      <span className="px-1 py-0.5 rounded bg-[#EEF4FF] text-[#155EEF] text-[9px] font-bold">{at.type || 'File'}</span>
                      <span className="font-medium text-slate-600 truncate">{at.name}</span>
                    </div>
                    <button type="button" onClick={() => {
                      const updated = step.settings?.attachments ? [...step.settings.attachments] : []
                      const target = updated[i]
                      if (target?.key || target?.url) fetch(`/api/upload?key=${encodeURIComponent(target.key || '')}&url=${encodeURIComponent(target.url || '')}`, { method: 'DELETE' }).catch(() => {})
                      onUpdateConfig('settings', 'attachments', updated.filter((_: any, j: number) => j !== i))
                    }} className="p-0.5 text-slate-400 hover:text-[#B42318] rounded ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-dashed border-slate-300 rounded-lg bg-[#F7F9FC] p-3 text-center cursor-pointer relative group">
              {uploadingStepFile ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Loader2 className="w-3.5 h-3.5 text-[#155EEF] animate-spin" /> Uploading...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 group-hover:text-[#155EEF]">
                  <FileUp className="w-4 h-4" /> <span className="font-medium">Upload file</span>
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return
                      setUploadingStepFile(true); const uploaded = await uploadFileHelper(file); setUploadingStepFile(false)
                      if (uploaded) {
                        const currentAt = step.settings?.attachments ?? []
                        onUpdateConfig('settings', 'attachments', [...currentAt, { name: uploaded.name.split('.').slice(0, -1).join('.') || uploaded.name, url: uploaded.url, type: uploaded.type, key: uploaded.key }])
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conditional Logic */}
        {step.type !== 'SECTION' && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Conditional Display</label>
            <label className="flex items-center gap-2.5 p-2.5 bg-[#F7F9FC] rounded-lg border border-slate-100 cursor-pointer">
              <input type="checkbox" checked={!!step.logic?.enabled} onChange={e => onUpdateConfig('logic', 'enabled', e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#155EEF]" />
              <span className="text-xs font-semibold text-slate-700">Show conditionally</span>
            </label>
            {step.logic?.enabled && (
              <div className="space-y-2 pl-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Show only if step:</label>
                  <select value={step.logic?.parentStepIdx ?? ''} onChange={e => onUpdateConfig('logic', 'parentStepIdx', e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF]">
                    <option value="">Choose step...</option>
                    {allSteps.slice(0, idx).filter((s: ProcedureStep) => s.type !== 'SECTION').map((s: ProcedureStep, i: number) => (
                      <option key={i} value={allSteps.indexOf(s)}>Step {allSteps.indexOf(s) + 1}: {(s.label || 'Untitled').substring(0, 30)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Condition</label>
                    <select value={step.logic?.operator ?? 'equals'} onChange={e => onUpdateConfig('logic', 'operator', e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF]">
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater_than">Greater than</option>
                      <option value="less_than">Less than</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Value</label>
                    <input type="text" value={step.logic?.parentStepValue ?? ''} onChange={e => onUpdateConfig('logic', 'parentStepValue', e.target.value)} placeholder="e.g. Yes, 100" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reference Links */}
        {step.type !== 'SECTION' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Reference Links</label>
              <button type="button" onClick={() => onUpdate('links', [...(step.links ?? []), { label: '', url: '' }])} className="text-[11px] font-bold text-[#155EEF] hover:text-[#0F4FD1] flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-1.5">
              {(step.links ?? []).map((link: { label: string; url: string }, i: number) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input type="text" value={link.label} onChange={e => { const u = [...(step.links ?? [])]; u[i] = { ...u[i], label: e.target.value }; onUpdate('links', u) }} placeholder="Label" className="w-1/3 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
                  <input type="url" value={link.url} onChange={e => { const u = [...(step.links ?? [])]; u[i] = { ...u[i], url: e.target.value }; onUpdate('links', u) }} placeholder="https://..." className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
                  <button type="button" onClick={() => { const u = (step.links ?? []).filter((_: any, j: number) => j !== i); onUpdate('links', u.length > 0 ? u : null) }} className="p-1 text-slate-300 hover:text-[#B42318] rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(!step.links || step.links.length === 0) && <p className="text-[11px] text-slate-400 italic">No links added</p>}
            </div>
          </div>
        )}

        {/* Assign Users/Teams */}
        {step.type !== 'SECTION' && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assign Users / Teams</label>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">User IDs (comma-separated)</label>
              <input type="text" value={(step.assignedUserIds ?? []).join(', ')} onChange={e => onUpdate('assignedUserIds', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="user-id-1, user-id-2" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Team IDs (comma-separated)</label>
              <input type="text" value={(step.assignedTeamIds ?? []).join(', ')} onChange={e => onUpdate('assignedTeamIds', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="team-id-1, team-id-2" className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 transition" />
            </div>
          </div>
        )}

        {/* Description */}
        {step.type !== 'SECTION' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea
              value={step.settings?.description ?? ''}
              onChange={e => onUpdateConfig('settings', 'description', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-[#155EEF]/20 resize-none transition"
              rows={2}
              placeholder="Add a description that appears under the field name..."
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-[#F7F9FC] flex justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-[#155EEF] text-white text-xs font-semibold rounded-lg hover:bg-[#0F4FD1] transition shadow-sm">
          Done
        </button>
      </div>
    </div>
  )
}