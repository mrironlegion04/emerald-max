'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Trash2, 
  Check, 
  AlertCircle, 
  Paperclip, 
  ChevronDown, 
  Clock, 
  User, 
  AlertTriangle, 
  FileText, 
  CheckSquare, 
  X, 
  ArrowUpRight,
  Download,
  FileUp,
  Loader2
} from 'lucide-react'

interface ProcedureStep {
  id: string
  label: string
  type: string
  isChecked: boolean
  isMandatory: boolean
  stringValue: string | null
  options: string[]
  checkedAt: string | null
  checkedBy: string | null
  sortOrder: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logic?: any
  assetId?: string | null
  asset?: {
    id: string
    name: string
    parentId: string | null
    location: {
      id: string
      name: string
      parentId: string | null
    } | null
  } | null
}

interface ProcedureInstance {
  id: string
  title: string
  source: string
  procedureId?: string | null
  steps: ProcedureStep[]
}

interface Props {
  woId: string
  initialProcedures: ProcedureInstance[]
  woStatus: string
  locations?: { id: string; name: string; parentId: string | null }[]
}

// Structured representation of step response
interface StepMetaResponse {
  value: string | null
  notes: string | null
  attachments: { name: string; url: string; type: string }[]
}

function parseRichResponse(raw: string | null): StepMetaResponse {
  if (!raw) return { value: null, notes: null, attachments: [] }
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return {
        value: parsed.value !== undefined ? parsed.value : null,
        notes: parsed.notes || null,
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      }
    } catch {
      // ignore, fallback
    }
  }
  return { value: raw, notes: null, attachments: [] }
}

function serializeRichResponse(value: string | null, notes: string | null, attachments: { name: string; url: string; type: string }[]): string {
  return JSON.stringify({ value, notes, attachments })
}

export default function WOProceduresPanel({ woId, initialProcedures, woStatus }: Props) {
  const router = useRouter()
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(woStatus)

  const [procedures, setProcedures] = useState(initialProcedures)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Form states to add new manual procedure
  const [addMode, setAddMode] = useState<'TEMPLATE' | 'CUSTOM'>('TEMPLATE')
  const [globalTemplates, setGlobalTemplates] = useState<{ id: string; name: string; description: string | null }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLabels, setNewLabels] = useState('')

  // State for expanded notes/attachments editor for any step
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  
  // Temporary notes editor value
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({})
  const [stepAttachName, setStepAttachName] = useState<Record<string, string>>({})
  const [stepAttachUrl, setStepAttachUrl] = useState<Record<string, string>>({})

  // Real upload states for MinIO
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null)

  async function uploadFileHelper(file: File): Promise<{ url: string; name: string; type: 'PDF' | 'IMAGE' | 'VIDEO' | 'OTHER'; key: string } | null> {
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
      
      let type: 'PDF' | 'IMAGE' | 'VIDEO' | 'OTHER' = 'OTHER'
      const mime = file.type.toLowerCase()
      if (mime.includes('pdf')) {
        type = 'PDF'
      } else if (mime.startsWith('image/')) {
        type = 'IMAGE'
      } else if (mime.startsWith('video/')) {
        type = 'VIDEO'
      }

      return {
        url: data.url,
        name: file.name,
        type,
        key: data.key
      }
    } catch (err: unknown) {
      const error = err as Error
      alert(error.message || 'Error occurred during file upload')
      return null
    }
  }

  // Fetch available globals on click "Add Procedure"
  useEffect(() => {
    if (adding && addMode === 'TEMPLATE' && globalTemplates.length === 0) {
      fetch('/api/procedures')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setGlobalTemplates(data)
            if (data.length > 0) setSelectedTemplateId(data[0].id)
          }
        })
        .catch(err => console.error('Error fetching global procedures:', err))
    }
  }, [adding, addMode, globalTemplates.length])

  // Refresh component state if initialProcedures changes from outside
  useEffect(() => {
    setProcedures(initialProcedures)
  }, [initialProcedures])

  // Count core statistics
  // We ignore SECTION and INSTRUCTION (unless instructions are mandatory checklists) for completion metrics
  const scoreableSteps = procedures.flatMap(p => p.steps).filter(s => s.type !== 'SECTION' && s.type !== 'INSTRUCTION')
  const totalSteps = scoreableSteps.length
  
  const completedSteps = scoreableSteps.filter(s => isStepCompleted(s)).length
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // Standard step complete check with dynamic bounds/photo rule enforcement!
  function isStepCompleted(g: ProcedureStep): boolean {
    if (g.type === 'SECTION') return true
    if (g.type === 'INSTRUCTION') return g.isMandatory ? g.isChecked : true
    if (g.type === 'CHECKBOX') return g.isChecked
    
    const rich = parseRichResponse(g.stringValue)
    if (!rich.value) return false

    // 1. Enforce Photo requirement on fail/flag
    if (g.type === 'INSPECTION' && g.settings?.requirePhotoOnFail) {
      if (rich.value === 'FAIL' || rich.value === 'FLAG') {
        const hasImage = rich.attachments?.some(a => 
          a.type === 'IMAGE' || 
          a.url?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)/) || 
          a.name?.toLowerCase().includes('photo') || 
          a.name?.toLowerCase().includes('image')
        )
        if (!hasImage) return false
      }
    }

    // 2. Validate Number limits/bounds
    if (g.type === 'NUMBER_INPUT') {
      const valNum = Number(rich.value)
      if (!isNaN(valNum)) {
        if (g.settings?.min !== undefined && g.settings?.min !== '' && valNum < Number(g.settings.min)) {
          return false
        }
        if (g.settings?.max !== undefined && g.settings?.max !== '' && valNum > Number(g.settings.max)) {
          return false
        }
      }
    }

    return true
  }

  // Handle direct changes of core values
  async function submitStepValue(procId: string, stepId: string, stepType: string, newValue: string | null) {
    setToggling(stepId)
    try {
      // Get current notes/attachments
      const stepObj = procedures.find(p => p.id === procId)?.steps.find(s => s.id === stepId)
      const currentRich = parseRichResponse(stepObj?.stringValue ?? null)
      
      const payloadString = serializeRichResponse(newValue, currentRich.notes, currentRich.attachments)

      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: payloadString }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to update step response')
        return
      }

      setProcedures(prev => prev.map(p => p.id !== procId ? p : {
        ...p,
        steps: p.steps.map(s => s.id !== stepId ? s : {
          ...s,
          stringValue: data.stringValue,
          isChecked: data.isChecked,
          checkedAt: data.checkedAt,
          checkedBy: data.checkedBy
        })
      }))
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  // Toggle checklist boolean directly (for CHECKBOX and mandatory INSTRUCTION read checkoff)
  async function submitCheckboxToggle(procId: string, stepId: string, currentChecked: boolean) {
    setToggling(stepId)
    try {
      // Get current values
      const stepObj = procedures.find(p => p.id === procId)?.steps.find(s => s.id === stepId)
      const currentRich = parseRichResponse(stepObj?.stringValue ?? null)

      // checkbox toggle both isChecked and also stores "CHECKED" string state inside serialized json
      const nextChecked = !currentChecked
      const payloadString = serializeRichResponse(nextChecked ? 'CHECKED' : null, currentRich.notes, currentRich.attachments)

      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isChecked: nextChecked,
          stringValue: payloadString 
        }),
      })
      const data = await res.json()
      if (!res.ok) return

      setProcedures(prev => prev.map(p => p.id !== procId ? p : {
        ...p,
        steps: p.steps.map(s => s.id !== stepId ? s : {
          ...s,
          isChecked: data.isChecked,
          stringValue: data.stringValue,
          checkedAt: data.checkedAt,
          checkedBy: data.checkedBy
        })
      }))
    } catch {
      // ignore
    } finally {
      setToggling(null)
    }
  }

  // Save additional operator notes
  async function handleNotesSave(procId: string, stepId: string) {
    const rawVal = stepNotes[stepId] ?? ''
    const stepObj = procedures.find(p => p.id === procId)?.steps.find(s => s.id === stepId)
    if (!stepObj) return
    
    setToggling(stepId)
    try {
      const rich = parseRichResponse(stepObj.stringValue)
      const payload = serializeRichResponse(rich.value, rawVal.trim() || null, rich.attachments)
      
      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        setProcedures(prev => prev.map(p => p.id !== procId ? p : {
          ...p,
          steps: p.steps.map(s => s.id !== stepId ? s : { ...s, stringValue: data.stringValue })
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  // Add operator files & photo links
  async function handleAttachmentAdd(procId: string, stepId: string) {
    const nameStr = stepAttachName[stepId]?.trim() || ''
    const urlStr = stepAttachUrl[stepId]?.trim() || ''
    if (!nameStr || !urlStr) return

    const stepObj = procedures.find(p => p.id === procId)?.steps.find(s => s.id === stepId)
    if (!stepObj) return

    setToggling(stepId)
    try {
      const rich = parseRichResponse(stepObj.stringValue)
      const isImg = urlStr.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)/) || nameStr.toLowerCase().includes('photo') || nameStr.toLowerCase().includes('image')
      const nextAttach = [...rich.attachments, { name: nameStr, url: urlStr, type: isImg ? 'IMAGE' : 'PDF', key: undefined }]
      
      const payload = serializeRichResponse(rich.value, rich.notes, nextAttach)
      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        setProcedures(prev => prev.map(p => p.id !== procId ? p : {
          ...p,
          steps: p.steps.map(s => s.id !== stepId ? s : { ...s, stringValue: data.stringValue })
        }))
        setStepAttachName(prev => ({ ...prev, [stepId]: '' }))
        setStepAttachUrl(prev => ({ ...prev, [stepId]: '' }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  async function handleAttachmentRemove(procId: string, stepId: string, attachIdx: number) {
    const stepObj = procedures.find(p => p.id === procId)?.steps.find(s => s.id === stepId)
    if (!stepObj) return

    setToggling(stepId)
    try {
      const rich = parseRichResponse(stepObj.stringValue)
      const target = rich.attachments[attachIdx]
      
      if (target?.url || target?.key) {
        fetch(`/api/upload?key=${encodeURIComponent(target.key || '')}&url=${encodeURIComponent(target.url || '')}`, {
          method: 'DELETE'
        }).catch(err => console.error('Cleanup failed:', err))
      }

      const nextAttach = rich.attachments.filter((_, i) => i !== attachIdx)
      
      const payload = serializeRichResponse(rich.value, rich.notes, nextAttach)
      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        setProcedures(prev => prev.map(p => p.id !== procId ? p : {
          ...p,
          steps: p.steps.map(s => s.id !== stepId ? s : { ...s, stringValue: data.stringValue })
        }))
      }
    } catch {
      // ignore
    } finally {
      setToggling(null)
    }
  }

  // Draw signature base64 automatically 
  async function handleSignatureSave(procId: string, stepId: string, signedName: string) {
    if (!signedName.trim()) return
    // Generating signature visual representation via custom HTML canvas placeholder
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, 400, 100)
      ctx.strokeStyle = '#1e3a8a'
      ctx.lineWidth = 2.5
      // Draw simulated handwriting curves based on name
      ctx.beginPath()
      ctx.moveTo(30, 60)
      ctx.quadraticCurveTo(80, 20, 150, 75)
      ctx.quadraticCurveTo(220, 30, 290, 65)
      ctx.lineTo(360, 45)
      ctx.stroke()

      ctx.fillStyle = '#0f172a'
      ctx.font = 'italic bold 22px "Georgia", serif'
      ctx.fillText(signedName.trim(), 40, 55)

      ctx.fillStyle = '#64748b'
      ctx.font = '9px monospace'
      ctx.fillText(`SECURE SOP SIGN-OFF · TIMESTAMP: ${new Date().toISOString()}`, 40, 85)

      const base64Data = canvas.toDataURL()
      await submitStepValue(procId, stepId, 'SIGNATURE', base64Data)
    }
  }

  // Adding procedure triggers
  async function addProcedure(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let payload = {}
      if (addMode === 'TEMPLATE') {
        if (!selectedTemplateId) {
          setError('Please select a Procedure template')
          setSaving(false)
          return
        }
        payload = { procedureId: selectedTemplateId }
      } else {
        if (!newTitle.trim()) {
          setError('Procedure title is required')
          setSaving(false)
          return
        }
        const labels = newLabels.split('\n').map(l => l.trim()).filter(Boolean)
        payload = { title: newTitle.trim(), steps: labels }
      }

      const res = await fetch(`/api/work-orders/${woId}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to apply procedure')
        return
      }

      setProcedures(prev => [...prev, data])
      setSelectedTemplateId('')
      setNewTitle('')
      setNewLabels('')
      setAdding(false)
      router.refresh()
    } catch {
      setError('Network request failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProcedure(procId: string) {
    if (!confirm('Are you sure you want to remove this Procedure from the Work Order?')) return
    try {
      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}`, { method: 'DELETE' })
      if (res.ok) {
        setProcedures(prev => prev.filter(p => p.id !== procId))
        router.refresh()
      }
    } catch {
      // ignore
    }
  }

  // Render individual step card
  function renderStepBlock(procId: string, step: ProcedureStep, allSteps: ProcedureStep[]) {
    const isComp = isStepCompleted(step)
    const rich = parseRichResponse(step.stringValue)
    
    // Evaluate logic for conditional visibility
    if (step.logic && step.logic.enabled && step.logic.parentStepIdx !== undefined && step.logic.parentStepValue !== undefined) {
      const parentIdx = parseInt(step.logic.parentStepIdx, 10)
      if (!isNaN(parentIdx) && allSteps[parentIdx]) {
        const parentStep = allSteps[parentIdx]
        const parentRich = parseRichResponse(parentStep.stringValue)
        let parentValue = parentStep.type === 'CHECKBOX' 
          ? (parentStep.isChecked ? 'Yes' : 'No') 
          : parentRich.value
        if (!parentValue) parentValue = ''
        
        const operator = step.logic.operator || 'equals'
        const targetValue = String(step.logic.parentStepValue).toLowerCase().trim()
        const pv = parentValue.toLowerCase().trim()
        const pvNum = parseFloat(pv)
        const tvNum = parseFloat(targetValue)
        
        let conditionMet = false
        switch (operator) {
          case 'equals':
            conditionMet = pv === targetValue
            break
          case 'not_equals':
            conditionMet = pv !== targetValue
            break
          case 'contains':
            conditionMet = pv.includes(targetValue)
            break
          case 'not_contains':
            conditionMet = !pv.includes(targetValue)
            break
          case 'greater_than':
            conditionMet = !isNaN(pvNum) && !isNaN(tvNum) && pvNum > tvNum
            break
          case 'less_than':
            conditionMet = !isNaN(pvNum) && !isNaN(tvNum) && pvNum < tvNum
            break
          default:
            conditionMet = pv === targetValue
        }
        if (!conditionMet) {
          return null
        }
      }
    }
    
    // Core states
    const isSection = step.type === 'SECTION'
    const isInstruction = step.type === 'INSTRUCTION'

    // Open collapsibles notes on click
    const isExpanded = expandedStepId === step.id

    if (isSection) {
      return (
        <div key={step.id} className="pt-6 pb-2 first:pt-2 border-b border-slate-100 flex items-center gap-3">
          <span className="text-xs font-black tracking-widest text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md uppercase shadow-4xs">
            📁 Heading: {step.label}
          </span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
      )
    }

    return (
      <div 
        key={step.id} 
        className={`flex flex-col bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-4xs overflow-hidden ${
          isComp ? 'bg-green-50/10 border-green-200/50' : 'border-slate-200'
        }`}
      >
        <div className="flex items-start gap-4 p-4">
          
          {/* Left Checkbox toggle for standard checks */}
          {step.type === 'CHECKBOX' && (
            <button
              type="button"
              onClick={() => !isClosed && submitCheckboxToggle(procId, step.id, step.isChecked)}
              disabled={toggling === step.id || isClosed}
              className={`mt-1.5 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                step.isChecked
                  ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                  : 'border-slate-300 hover:border-green-600 hover:bg-green-50/10'
              } disabled:opacity-50`}
            >
              {step.isChecked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
            </button>
          )}

          {/* Left Pass / Flag / Fail toggle for Inspections */}
          {step.type === 'INSPECTION' && (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => !isClosed && submitStepValue(procId, step.id, 'INSPECTION', 'PASS')}
                disabled={toggling === step.id || isClosed}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg border text-center transition-all ${
                  rich.value === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                PASS
              </button>
              <button
                type="button"
                onClick={() => !isClosed && submitStepValue(procId, step.id, 'INSPECTION', 'FLAG')}
                disabled={toggling === step.id || isClosed}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg border text-center transition-all ${
                  rich.value === 'FLAG'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                FLAG
              </button>
              <button
                type="button"
                onClick={() => !isClosed && submitStepValue(procId, step.id, 'INSPECTION', 'FAIL')}
                disabled={toggling === step.id || isClosed}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg border text-center transition-all ${
                  rich.value === 'FAIL'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                FAIL
              </button>
            </div>
          )}

          {/* Core content of step */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 flex-wrap items-center">
              <span className={`text-slate-800 text-sm font-semibold leading-snug break-words ${
                isComp && step.type === 'CHECKBOX' ? 'line-through text-slate-400' : ''
              }`}>
                {step.label}
              </span>
              {step.type !== 'CHECKBOX' && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8px] font-extrabold tracking-wide uppercase border border-slate-150">
                  {step.type.replace('_', ' ')}
                </span>
              )}
              {step.isMandatory && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/50 text-amber-800 text-[9px] font-bold">
                  <AlertCircle className="w-2.5 h-2.5" /> Required
                </span>
              )}
            </div>

            {/* Step-specific SOP documents, blueprints, or reference photos configured on template */}
            {step.settings?.attachments && step.settings.attachments.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2 animate-fade-in mb-2">
                {step.settings.attachments.map((attach: { name: string; url: string; type: string }, idx: number) => {
                  const isImg = attach.type === 'IMAGE' || attach.url?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)/)
                  return (
                    <a
                      key={idx}
                      href={attach.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-4xs group max-w-[280px]"
                      title={`Click to open ${attach.name}`}
                    >
                      {isImg ? (
                        <div className="w-8 h-8 rounded bg-white border border-slate-150 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img
                            src={attach.url}
                            alt={attach.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-200 border border-slate-300 text-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-[9px] uppercase font-mono">
                          {attach.type || 'SOP'}
                        </div>
                      )}
                      <div className="text-left font-sans min-w-0 pr-1 flex-1">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">{attach.type || 'SOP Reference'}</span>
                        <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 truncate block mt-0.5 max-w-[170px] leading-snug">
                          {attach.name}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">View Document</span>
                          <ArrowUpRight className="w-2.5 h-2.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Instruction Read-only card with action */}
            {isInstruction && (
              <div className="mt-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg leading-relaxed shadow-4xs">
                <p>{step.label}</p>
                {step.isMandatory && !step.isChecked && !isClosed && (
                  <button
                    type="button"
                    onClick={() => submitCheckboxToggle(procId, step.id, false)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-650 hover:bg-blue-700 text-white text-[10px] font-extrabold uppercase rounded-lg transition-all shadow-3xs"
                  >
                    Confirm Read & Understood
                  </button>
                )}
                {step.isMandatory && step.isChecked && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
                    ✓ Confirmed Read & Safe
                  </span>
                )}
              </div>
            )}

            {/* Alphanumeric Text area input */}
            {step.type === 'TEXT_INPUT' && !isClosed && (
              <textarea
                defaultValue={rich.value ?? ''}
                onBlur={e => submitStepValue(procId, step.id, 'TEXT_INPUT', e.target.value || null)}
                placeholder="Type descriptive inspection response..."
                rows={1}
                className="mt-2 w-full text-xs border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none resize-none transition-all shadow-4xs"
              />
            )}

            {/* Number standard input with dynamic tolerance validation */}
            {step.type === 'NUMBER_INPUT' && !isClosed && (() => {
              const valNum = Number(rich.value)
              const minVal = step.settings?.min !== undefined && step.settings?.min !== '' ? Number(step.settings.min) : null
              const maxVal = step.settings?.max !== undefined && step.settings?.max !== '' ? Number(step.settings.max) : null
              const isOutOfRange = rich.value !== null && rich.value !== '' && !isNaN(valNum) && (
                (minVal !== null && valNum < minVal) || (maxVal !== null && valNum > maxVal)
              )
              return (
                <div className="mt-2 space-y-1.5 max-w-sm">
                  <input
                    type="number"
                    defaultValue={rich.value ?? ''}
                    onBlur={e => submitStepValue(procId, step.id, 'NUMBER_INPUT', e.target.value || null)}
                    placeholder={`Enter reading... ${minVal !== null ? `(Min: ${minVal})` : ''} ${maxVal !== null ? `(Max: ${maxVal})` : ''}`}
                    className={`text-xs border rounded-lg px-3 py-1.5 outline-none transition-all w-full ${
                      isOutOfRange ? 'border-red-500 bg-red-50/30 focus:border-red-600' : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {isOutOfRange && (
                    <p className="text-[10px] text-red-600 font-extrabold flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md border border-red-200/45 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      Limit Violated: Reading should be between {minVal !== null ? minVal : 'any'} and {maxVal !== null ? maxVal : 'any'}
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Dropdown list */}
            {step.type === 'DROPDOWN' && !isClosed && (
              <div className="relative mt-2 max-w-xs">
                <select
                  value={rich.value ?? ''}
                  onChange={e => submitStepValue(procId, step.id, 'DROPDOWN', e.target.value || null)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-705 outline-none cursor-pointer appearance-none shadow-4xs"
                >
                  <option value="">Choose item...</option>
                  {(step.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            )}

            {/* Multiple Choice Option */}
            {step.type === 'MULTIPLE_CHOICE' && !isClosed && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-2.5 border border-slate-200 rounded-lg">
                {(step.options || []).map((opt) => {
                  const currentValueList = rich.value ? rich.value.split(', ') : []
                  const checked = currentValueList.includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-2 text-xs text-slate-705 cursor-pointer p-1 rounded-md hover:bg-white transition-colors border border-transparent hover:border-slate-200/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const nextList = checked 
                            ? currentValueList.filter(v => v !== opt)
                            : [...currentValueList, opt]
                          submitStepValue(procId, step.id, 'MULTIPLE_CHOICE', nextList.join(', ') || null)
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 accent-blue-600"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Date and Time entries */}
            {step.type === 'DATE' && !isClosed && (
              <input
                type="date"
                defaultValue={rich.value ?? ''}
                onChange={e => submitStepValue(procId, step.id, 'DATE', e.target.value || null)}
                className="mt-2 max-w-xs text-xs border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-1.5 bg-white text-slate-705 outline-none transition-all cursor-pointer shadow-4xs"
              />
            )}

            {/* Signature Area drawing pad or name entry */}
            {step.type === 'SIGNATURE' && !isClosed && (
              <div className="mt-2 bg-slate-50/50 p-3 border border-slate-200 rounded-xl max-w-md">
                {rich.value ? (
                  <div className="space-y-2">
                    <img src={rich.value} alt="Digitally signed audit" className="h-14 border border-slate-200 rounded bg-white shadow-inner" />
                    <button
                      type="button"
                      onClick={() => submitStepValue(procId, step.id, 'SIGNATURE', null)}
                      className="text-[10px] text-red-600 font-extrabold uppercase hover:underline"
                    >
                      Clear & Redraw
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id={`sig-input-${step.id}`}
                      placeholder="Write your full legal name..."
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-805 outline-none flex-1 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const inputEl = document.getElementById(`sig-input-${step.id}`) as HTMLInputElement
                        if (inputEl && inputEl.value.trim()) {
                          handleSignatureSave(procId, step.id, inputEl.value)
                        } else {
                          alert('Please enter your name to sign.')
                        }
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
                    >
                      Sign
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Physical mechanical Meters input with custom unit */}
            {step.type === 'METER' && !isClosed && (
              <div className="mt-2 flex items-center gap-2 max-w-sm">
                <input
                  type="number"
                  defaultValue={rich.value ?? ''}
                  onBlur={e => submitStepValue(procId, step.id, 'METER', e.target.value || null)}
                  placeholder={`e.g. ${step.settings?.unit ? `Enter ${step.settings.unit}` : '14250'}`}
                  className="text-xs border border-slate-205 focus:border-blue-500 rounded-lg px-3 py-1.5 outline-none transition flex-1"
                />
                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                  {step.settings?.unit || 'Reading'}
                </span>
              </div>
            )}

            {/* Photos & Files prompt execution */}
            {(step.type === 'PHOTO' || step.type === 'FILE') && !isClosed && (
              <div className="mt-2 p-3 border border-slate-200 border-dashed rounded-xl bg-slate-50/50 text-center max-w-md">
                {rich.value ? (
                  <div className="space-y-2">
                    {step.type === 'PHOTO' ? (
                      <img src={rich.value} alt="Operator Upload" className="mx-auto rounded border border-slate-200 max-h-32 shadow-xs bg-white" />
                    ) : (
                      <div className="inline-flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-105 text-xs">
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <span className="text-slate-705 font-bold max-w-xs truncate">{rich.value}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => submitStepValue(procId, step.id, step.type, null)}
                      className="text-[10px] text-red-600 font-bold block mx-auto uppercase hover:underline"
                    >
                      Remove File / Upload again
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-2">
                      Prompt: Upload executing reference {step.type.toLowerCase()}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative group">
                        <button
                          type="button"
                          className="w-full flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 rounded-xl bg-white hover:bg-blue-50/50 transition-all text-slate-500 hover:text-blue-600 gap-1"
                        >
                          <FileUp className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                          <span className="font-bold text-[10px]">Upload File</span>
                        </button>
                        <input
                          type="file"
                          accept={step.type === 'PHOTO' ? 'image/*' : '*'}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const uploaded = await uploadFileHelper(file)
                            if (uploaded) {
                              submitStepValue(procId, step.id, step.type, uploaded.url)
                            }
                          }}
                        />
                      </div>

                      {step.type === 'PHOTO' && (
                        <div className="relative group">
                          <button
                            type="button"
                            className="w-full flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 rounded-xl bg-white hover:bg-blue-50/50 transition-all text-slate-500 hover:text-blue-600 gap-1"
                          >
                            <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-blue-500 text-lg">📷</div>
                            <span className="font-bold text-[10px]">Take Photo</span>
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const uploaded = await uploadFileHelper(file)
                              if (uploaded) {
                                submitStepValue(procId, step.id, step.type, uploaded.url)
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Read-Only display inside Closed Work Order */}
            {isClosed && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 border border-slate-105 leading-relaxed">
                {step.type === 'SIGNATURE' && rich.value ? (
                  <img src={rich.value} alt="Official compliance sign-off" className="h-10 border border-slate-200 bg-white" />
                ) : step.type === 'PHOTO' && rich.value ? (
                  <img src={rich.value} alt="Official photo attached" className="max-h-24 rounded border inline-block" />
                ) : rich.value ? (
                  <p className="font-semibold text-slate-705 flex items-center gap-1">
                    <span className="text-slate-400 font-normal">Completed Value:</span> &ldquo;{rich.value}&rdquo;
                  </p>
                ) : (
                  <span className="text-slate-400 italic">No value collected</span>
                )}
              </div>
            )}

            {/* Display failure alerts & enforcing photo rule alerts for Inspections */}
            {step.type === 'INSPECTION' && (rich.value === 'FAIL' || rich.value === 'FLAG') && (
              <div className="space-y-2 max-w-lg mt-3">
                {/* Photo required verification warning if rule active */}
                {step.settings?.requirePhotoOnFail && (() => {
                  const hasImage = rich.attachments?.some(a => 
                    a.type === 'IMAGE' || 
                    a.url?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)/) || 
                    a.name?.toLowerCase().includes('photo') || 
                    a.name?.toLowerCase().includes('image')
                  )
                  if (!hasImage) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2.5 shadow-4xs animate-pulse-slow">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold block">Compliance Warning: Photo Required</span>
                          <span className="text-amber-800 leading-normal block mt-0.5">Emerald SOP rules require a proof image for flagged checkpoints. Click the paperclip icon on the far right of this card to attach.</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div className="p-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs shadow-4xs">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold">Compliant: Fault verification photo attached successfully!</span>
                    </div>
                  )
                })()}

                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 shadow-4xs">
                  <AlertTriangle className="w-5 h-5 text-red-650 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-extrabold text-red-800 uppercase tracking-tight block">Inspection Flag raised!</span>
                    <p className="text-red-700 mt-1 leading-relaxed">This step has been flagged as Failed or Deficient. Compliance protocols recommend creating corrective operations immediately.</p>
                    <button
                      type="button"
                      onClick={() => {
                        const titleUrl = `Corrective: Flagged ${step.label.substring(0, 30)}...`
                        router.push(`/work-orders/new?title=${encodeURIComponent(titleUrl)}&issueId=OTHER&customIssue=${encodeURIComponent(`Failed inspection step: "${step.label}"`)}`)
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-rose-700 text-white font-extrabold uppercase text-[10px] rounded-lg shadow-sm"
                    >
                      Create Corrective Work Order <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Audit trace meta details showing completedBy */}
            {isComp && step.checkedBy && (
              <div className="mt-2.5 flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-50 pt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Completed by <strong>{step.checkedBy}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {step.checkedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(step.checkedAt)) : 'N/A'}
                </span>
              </div>
            )}
          </div>

          {/* Right Expandable comments toggle */}
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                isExpanded 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' 
                  : (rich.notes || rich.attachments.length > 0)
                  ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500'
              }`}
              title="Add Notes and Attachments to this step"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notes and step-level attachments drawer panel */}
        {isExpanded && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 animate-fade-in space-y-4 text-xs">
            {/* Notes view and write */}
            <div>
              <span className="font-extrabold text-slate-700 block uppercase tracking-wide mb-1.5">Comments & Observations</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={rich.notes ? `Current note: "${rich.notes}"` : "Enter observations..."}
                  value={stepNotes[step.id] ?? rich.notes ?? ''}
                  onChange={e => {
                    const text = e.target.value
                    setStepNotes(prev => ({ ...prev, [step.id]: text }))
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-805 outline-none flex-1 focus:border-slate-350 focus:ring-1 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => handleNotesSave(procId, step.id)}
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition"
                >
                  Save Note
                </button>
              </div>
            </div>

            {/* Attachments list and upload */}
            <div className="pt-3 border-t border-slate-200">
              <span className="font-extrabold text-slate-700 block uppercase tracking-wide mb-2">Step Attachments ({rich.attachments.length})</span>
              
              {rich.attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {rich.attachments.map((at, ai) => (
                    <div key={ai} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-4xs">
                      <div className="truncate pr-2 flex items-center gap-2">
                        <span className="font-bold text-slate-705 truncate max-w-[140px]">{at.name}</span>
                        <div className="flex items-center gap-1">
                          <a href={at.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] uppercase">
                            View <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                          <a href={at.url} download={at.name} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-700 p-1 border border-slate-200 rounded">
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAttachmentRemove(procId, step.id, ai)}
                        className="text-slate-400 hover:text-red-500 rounded hover:bg-red-50 p-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add attachment link */}
              <div className="bg-white p-3 border border-slate-200 rounded-lg space-y-3 max-w-lg shadow-4xs">
                {/* Real File Uploader Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 text-center hover:bg-blue-50/50 transition-all cursor-pointer relative group">
                    {uploadingStepId === step.id ? (
                      <div className="flex flex-col items-center justify-center py-1 text-slate-500 font-bold gap-2">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span>Syncing...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-1 text-slate-500 gap-1 hover:text-blue-650">
                        <FileUp className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="font-bold text-[11px] text-slate-705">Upload File</span>
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadingStepId(step.id)
                            const uploaded = await uploadFileHelper(file)
                            setUploadingStepId(null)
                            if (uploaded) {
                              const nameStr = uploaded.name.split('.').slice(0, -1).join('.') || uploaded.name
                              const urlStr = uploaded.url
                              const rich = parseRichResponse(step.stringValue)
                              const nextAttach = [...rich.attachments, { name: nameStr, url: urlStr, type: uploaded.type, key: uploaded.key }]
                              const payload = serializeRichResponse(rich.value, rich.notes, nextAttach)
                              const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${step.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ stringValue: payload }),
                              })
                              const data = await res.json()
                              if (res.ok) {
                                setProcedures(prev => prev.map(p => p.id !== procId ? p : {
                                  ...p,
                                  steps: p.steps.map(s => s.id !== step.id ? s : { ...s, stringValue: data.stringValue })
                                }))
                                router.refresh()
                              }
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Camera Option */}
                  <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 text-center hover:bg-blue-50/50 transition-all cursor-pointer relative group">
                    <div className="flex flex-col items-center justify-center py-1 text-slate-500 gap-1 hover:text-blue-650">
                      <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-blue-500">📷</div>
                      <span className="font-bold text-[11px] text-slate-705">Take Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploadingStepId(step.id)
                          const uploaded = await uploadFileHelper(file)
                          setUploadingStepId(null)
                          if (uploaded) {
                            const nameStr = `Photo_${new Date().getTime()}`
                            const urlStr = uploaded.url
                            const rich = parseRichResponse(step.stringValue)
                            const nextAttach = [...rich.attachments, { name: nameStr, url: urlStr, type: 'IMAGE', key: uploaded.key }]
                            const payload = serializeRichResponse(rich.value, rich.notes, nextAttach)
                            const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${step.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ stringValue: payload }),
                            })
                            const data = await res.json()
                            if (res.ok) {
                              setProcedures(prev => prev.map(p => p.id !== procId ? p : {
                                ...p,
                                steps: p.steps.map(s => s.id !== step.id ? s : { ...s, stringValue: data.stringValue })
                              }))
                              router.refresh()
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200 bg-white shadow-sm rounded-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/20">
        <div className="flex items-center gap-2.5">
          <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-slate-500" />
            Standard Operating Procedures
          </h2>
          {totalSteps > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-full border border-slate-200">
              {completedSteps} / {totalSteps} BLOCKS RECORDED
            </span>
          )}
        </div>
        {!isClosed && !adding && (
          <button 
            type="button" 
            onClick={() => setAdding(true)} 
            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
          >
            ＋ Add SOP
          </button>
        )}
      </div>

      {/* Score progress bar */}
      {totalSteps > 0 && (
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/5">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-150 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-emerald-500 transition-all shadow-xxs duration-300" 
                style={{ width: `${pct}%` }} 
              />
            </div>
            <span className="text-xs font-bold text-slate-700 w-9 text-right">{pct}% completed</span>
          </div>
        </div>
      )}

      {/* Manual SOP appending form */}
      {adding && (
        <form onSubmit={addProcedure} className="p-5 border-b border-slate-100 bg-slate-50/60 space-y-4 animate-fade-in text-xs">
          <div className="flex gap-4 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => { setAddMode('TEMPLATE'); setError('') }}
              className={`pb-1 font-bold ${addMode === 'TEMPLATE' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
            >
              Select SOP Template
            </button>
            <button
              type="button"
              onClick={() => { setAddMode('CUSTOM'); setError('') }}
              className={`pb-1 font-bold ${addMode === 'CUSTOM' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
            >
              Quick Custom List
            </button>
          </div>

          {addMode === 'TEMPLATE' ? (
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 block">SOP Templates Library</label>
              <div className="relative max-w-md">
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-705 outline-none cursor-pointer"
                >
                  <option value="">Choose Template...</option>
                  {globalTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.description ? `(${t.description.substring(0, 30)}...)` : ''}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 bg-white/60 p-2 border border-slate-100 rounded">
                Choose defined compliance models from the global database to clone instantly into the current scope.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1 block">Procedure title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="input-field text-xs bg-white border-slate-200"
                  placeholder="e.g. Specialized Compressor Reboot instructions..."
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1 block">Steps (one per line)</label>
                <textarea
                  value={newLabels}
                  onChange={e => setNewLabels(e.target.value)}
                  className="input-field text-xs bg-white border-slate-200 resize-none font-sans"
                  rows={4}
                  placeholder={`Confirm pressure drops\nCheck safety valve release\nLog ambient reading psi`}
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-slate-205 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-lg shadow-sm">
              {saving ? 'Loading...' : 'Confirm Append'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List Procedures */}
      {procedures.length === 0 && !adding ? (
        <div className="py-12 text-center text-xs text-slate-400 font-semibold">
          No procedures attached to this Work Order
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white">
          {procedures.map(list => {
            const listSteps = list.steps ?? []
            const listCompletedCount = listSteps.filter(s => isStepCompleted(s)).length
            const isDone = listSteps.length > 0 && listCompletedCount === listSteps.length

            return (
              <div key={list.id} className="p-5">
                {/* SOP Title Bar */}
                <div className="flex items-center justify-between mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-extrabold text-slate-805 text-sm">{list.title}</span>
                    <span className="bg-slate-100 border border-slate-200 font-bold px-2 py-0.5 rounded-full text-slate-500">
                      {listCompletedCount} / {listSteps.length} Steps
                    </span>
                    {isDone && (
                      <span className="bg-emerald-100 border border-emerald-200 text-emerald-850 font-extrabold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide">
                        COMPLIANT
                      </span>
                    )}
                    {list.source && (
                      <span className="bg-indigo-55 border border-indigo-150 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wide">
                        {list.source}
                      </span>
                    )}
                  </div>
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => deleteProcedure(list.id)}
                      className="text-slate-400 hover:text-red-650 transition-colors bg-white hover:bg-slate-50 p-1.5 border border-slate-200 rounded-lg shadow-4xs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Steps block contents */}
                {listSteps.length > 0 ? (
                  <div className="space-y-3.5 pl-2 border-l-2 border-slate-150 ml-2">
                    {listSteps.map(step => renderStepBlock(list.id, step, listSteps))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic pl-6 font-medium">No steps are declared on this procedure</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
