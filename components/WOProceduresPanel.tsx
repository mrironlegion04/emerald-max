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
  Download
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
  const completedSteps = scoreableSteps.filter(s => {
    if (s.type === 'CHECKBOX') return s.isChecked
    const rich = parseRichResponse(s.stringValue)
    return !!rich.value
  }).length

  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // Standard step complete check
  function isStepCompleted(g: ProcedureStep): boolean {
    if (g.type === 'SECTION') return true
    if (g.type === 'INSTRUCTION') return g.isMandatory ? g.isChecked : true
    if (g.type === 'CHECKBOX') return g.isChecked
    const rich = parseRichResponse(g.stringValue)
    return !!rich.value
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
      const nextAttach = [...rich.attachments, { name: nameStr, url: urlStr, type: urlStr.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE' }]
      
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
        
        const targetValue = String(step.logic.parentStepValue).toLowerCase().trim()
        if (parentValue.toLowerCase().trim() !== targetValue) {
          return null // hide this step entirely because condition not met
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
        <div key={step.id} className="pt-6 pb-2 first:pt-2 border-b border-slate-105/80 flex items-center gap-3">
          <span className="text-xs font-black tracking-widest text-slate-850 bg-slate-100/80 border border-slate-200/50 px-2.5 py-1 rounded-md uppercase">
            📁 {step.label}
          </span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
      )
    }

    return (
      <div 
        key={step.id} 
        className={`flex flex-col bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-xxs overflow-hidden ${
          isComp ? 'bg-green-55/10 border-green-200/40' : ''
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
                  ? 'bg-green-650 border-green-600 text-white hover:bg-green-700'
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
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs animate-pulse-slow'
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
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8px] font-extrabold tracking-wide uppercase">
                  {step.type.replace('_', ' ')}
                </span>
              )}
              {step.isMandatory && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/50 text-amber-800 text-[9px] font-bold">
                  <AlertCircle className="w-2.5 h-2.5" /> Required
                </span>
              )}
            </div>

            {/* Instruction Read-only card with action */}
            {isInstruction && (
              <div className="mt-2 text-xs text-slate-505 bg-slate-50 border border-slate-100 p-3 rounded-lg leading-relaxed">
                <p>{step.label}</p>
                {step.isMandatory && !step.isChecked && !isClosed && (
                  <button
                    type="button"
                    onClick={() => submitCheckboxToggle(procId, step.id, false)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold uppercase rounded-lg transition-all"
                  >
                    Confirm Read & Understood
                  </button>
                )}
                {step.isMandatory && step.isChecked && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-green-780">
                    ✓ Confirmed Readed & Safe
                  </span>
                )}
              </div>
            )}

            {/* Alphanumeric Text area input */}
            {step.type === 'TEXT_INPUT' && !isClosed && (
              <textarea
                defaultValue={rich.value ?? ''}
                onBlur={e => submitStepValue(procId, step.id, 'TEXT_INPUT', e.target.value || null)}
                placeholder="Type descriptive inspection log here..."
                rows={1}
                className="mt-2 w-full text-xs border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none resize-none transition-all"
              />
            )}

            {/* Number standard input */}
            {step.type === 'NUMBER_INPUT' && !isClosed && (
              <input
                type="number"
                defaultValue={rich.value ?? ''}
                onBlur={e => submitStepValue(procId, step.id, 'NUMBER_INPUT', e.target.value || null)}
                placeholder="Enter numeric response value..."
                className="mt-2 max-w-sm text-xs border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-1.5 outline-none transition-all"
              />
            )}

            {/* Dropdown list */}
            {step.type === 'DROPDOWN' && !isClosed && (
              <div className="relative mt-2 max-w-xs">
                <select
                  value={rich.value ?? ''}
                  onChange={e => submitStepValue(procId, step.id, 'DROPDOWN', e.target.value || null)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-705 outline-none cursor-pointer appearance-none"
                >
                  <option value="">Choose item...</option>
                  {step.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            )}

            {/* Multiple Choice Option */}
            {step.type === 'MULTIPLE_CHOICE' && !isClosed && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">
                {step.options.map((opt) => {
                  const currentValueList = rich.value ? rich.value.split(', ') : []
                  const checked = currentValueList.includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 rounded-md hover:bg-slate-50 transition-colors">
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
                className="mt-2 max-w-xs text-xs border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-1.5 bg-white text-slate-705 outline-none transition-all cursor-pointer"
              />
            )}

            {/* Signature Area drawing pad or name entry */}
            {step.type === 'SIGNATURE' && !isClosed && (
              <div className="mt-2 bg-slate-50/50 p-3 border border-slate-205 rounded-xl max-w-md">
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

            {/* Physical mechanical Meters input */}
            {step.type === 'METER' && !isClosed && (
              <div className="mt-2 flex items-center gap-2 max-w-sm">
                <input
                  type="number"
                  defaultValue={rich.value ?? ''}
                  onBlur={e => submitStepValue(procId, step.id, 'METER', e.target.value || null)}
                  placeholder="e.g. 14250"
                  className="text-xs border border-slate-205 focus:border-blue-500 rounded-lg px-3 py-1.5 outline-none transition flex-1"
                />
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">Reading Hz/Psi</span>
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
                      <div className="inline-flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 text-xs">
                        <FileText className="w-5 h-5 text-indigo-505" />
                        <span className="text-slate-700 font-bold max-w-xs truncate">{rich.value}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => submitStepValue(procId, step.id, step.type, null)}
                      className="text-[10px] text-red-650 font-bold block mx-auto uppercase hover:underline"
                    >
                      Remove File / Upload again
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-2">
                      Prompt: Upload executing reference {step.type.toLowerCase()}
                    </span>
                    <input
                      type="text"
                      placeholder={step.type === 'PHOTO' ? "Paste image URL or camera feed..." : "Paste attachment manual URL..."}
                      id={`file-input-${step.id}`}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-705 outline-none mb-2 focus:border-blue-400"
                    />
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById(`file-input-${step.id}`) as HTMLInputElement)?.value
                          if (val) submitStepValue(procId, step.id, step.type, val)
                        }}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[10px] rounded"
                      >
                        Add URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const mockUrl = step.type === 'PHOTO' 
                            ? 'https://picsum.photos/seed/vibrant/400/300'
                            : `/docs/uploaded_${step.id}.pdf`
                          submitStepValue(procId, step.id, step.type, mockUrl)
                        }}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded"
                      >
                        Choose File
                      </button>
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
                  <p className="font-semibold text-slate-700 flex items-center gap-1">
                    <span className="text-slate-400 font-normal">Completed Value:</span> &ldquo;{rich.value}&rdquo;
                  </p>
                ) : (
                  <span className="text-slate-400 italic">No value collected</span>
                )}
              </div>
            )}

            {/* Display failure alerts supporting correcting actions */}
            {step.type === 'INSPECTION' && (rich.value === 'FAIL' || rich.value === 'FLAG') && (
              <div className="mt-2.5 p-3 bg-red-50 border border-red-200 rounded-xl max-w-lg flex items-start gap-2.5 animate-bounce-short">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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
            )}

            {/* Audit trace meta details showing completedBy */}
            {isComp && step.checkedBy && (
              <div className="mt-2.5 flex items-center gap-3 text-[10px] text-slate-450 border-t border-slate-50 pt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-350" />
                  Completed by <strong>{step.checkedBy}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-350" />
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
                  ? 'bg-slate-100 hover:bg-slate-205 border-slate-300 text-slate-700' 
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
          <div className="bg-slate-50/50 border-t border-slate-105 p-4 animate-fade-in space-y-4 text-xs">
            {/* Notes view and write */}
            <div>
              <span className="font-extrabold text-slate-700 block uppercase tracking-wide mb-1.5">Comments & Observations</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={rich.notes ? `Current note: "${rich.notes}"` : "Enter technical observations..."}
                  value={stepNotes[step.id] ?? rich.notes ?? ''}
                  onChange={e => {
                    const text = e.target.value
                    setStepNotes(prev => ({ ...prev, [step.id]: text }))
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none flex-1 focus:border-slate-350"
                />
                <button
                  type="button"
                  onClick={() => handleNotesSave(procId, step.id)}
                  className="px-3.5 py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-850"
                >
                  Save NOTE
                </button>
              </div>
            </div>

            {/* Attachments list and upload */}
            <div className="pt-3 border-t border-slate-100">
              <span className="font-extrabold text-slate-700 block uppercase tracking-wide mb-2">Step Attachments ({rich.attachments.length})</span>
              
              {rich.attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {rich.attachments.map((at, ai) => (
                    <div key={ai} className="flex items-center justify-between p-2.5 bg-white border border-slate-105 rounded-lg">
                      <div className="truncate pr-4 flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 truncate">{at.name}</span>
                        <a href={at.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAttachmentRemove(procId, step.id, ai)}
                        className="text-slate-400 hover:text-red-500 rounded hover:bg-slate-50 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add attachment link */}
              <div className="bg-white p-3 border border-slate-105 rounded-lg space-y-2 max-w-lg">
                <span className="font-bold text-slate-600 block">Add Photo URL or Technical Document link</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Doc Name (e.g. Belt Photo)"
                    value={stepAttachName[step.id] ?? ''}
                    onChange={e => {
                      const txt = e.target.value
                      setStepAttachName(prev => ({ ...prev, [step.id]: txt }))
                    }}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-350"
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g. https://...)"
                    value={stepAttachUrl[step.id] ?? ''}
                    onChange={e => {
                      const txt = e.target.value
                      setStepAttachUrl(prev => ({ ...prev, [step.id]: txt }))
                    }}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-350"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAttachmentAdd(procId, step.id)}
                  disabled={!stepAttachName[step.id] || !stepAttachUrl[step.id]}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg disabled:opacity-40"
                >
                  Confirm add attachment
                </button>
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
            <CheckSquare className="w-4 h-4 text-slate-550" />
            Standard Operating Procedures
          </h2>
          {totalSteps > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-full border border-slate-200/50">
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
            <span className="text-xs font-bold text-slate-705 w-9 text-right">{pct}% completed</span>
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
                <div className="flex items-center justify-between mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-extrabold text-slate-850 text-sm">{list.title}</span>
                    <span className="bg-slate-105 border border-slate-200/60 font-bold px-2 py-0.5 rounded-full text-slate-500">
                      {listCompletedCount} / {listSteps.length} Steps
                    </span>
                    {isDone && (
                      <span className="bg-green-100 border border-green-200 text-green-800 font-extrabold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide">
                        COMPLIANT
                      </span>
                    )}
                    {list.source && (
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wide">
                        {list.source}
                      </span>
                    )}
                  </div>
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => deleteProcedure(list.id)}
                      className="text-slate-400 hover:text-red-650 transition-colors bg-white hover:bg-slate-50 p-1.5 border border-slate-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Steps block contents */}
                {listSteps.length > 0 ? (
                  <div className="space-y-3.5 pl-2 border-l-2 border-slate-100/60 ml-2">
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
