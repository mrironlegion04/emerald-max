'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check, AlertCircle, Package } from 'lucide-react'

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

function isStepComplete(step: ProcedureStep): boolean {
  if (step.type === 'CHECKBOX') return step.isChecked
  return !!step.stringValue
}

interface ProcedureInstance {
  id: string
  title: string
  source: string
  steps: ProcedureStep[]
}

interface Props {
  woId: string
  initialProcedures: ProcedureInstance[]
  woStatus: string
  locations?: { id: string; name: string; parentId: string | null }[]
}

export default function WOProceduresPanel({ woId, initialProcedures, woStatus }: Props) {
  const router  = useRouter()
  const isClosed = ['COMPLETED','CANCELLED'].includes(woStatus)
  const [procedures, setProcedures] = useState(initialProcedures)
  const [newTitle,    setNewTitle]    = useState('')
  const [newLabels,   setNewLabels]   = useState('')
  const [adding,      setAdding]      = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [toggling,    setToggling]    = useState<string | null>(null)
  const [error,       setError]       = useState('')

  const totalSteps   = procedures.reduce((s, p) => s + p.steps.length, 0)
  const checkedSteps = procedures.reduce((s, p) => s + p.steps.filter(st => isStepComplete(st)).length, 0)

  async function addProcedure(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true); setError('')
    try {
      const labels = newLabels.split('\n').map(l => l.trim()).filter(Boolean)
      const res  = await fetch(`/api/work-orders/${woId}/procedures`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), steps: labels }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setProcedures(prev => [...prev, data])
      setNewTitle(''); setNewLabels(''); setAdding(false)
      router.refresh()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  async function toggleStep(procId: string, stepId: string, currentChecked: boolean) {
    setToggling(stepId)
    try {
      const res  = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: !currentChecked }),
      })
      const data = await res.json()
      if (!res.ok) return
      setProcedures(prev => prev.map(p => p.id !== procId ? p : {
        ...p, steps: p.steps.map(s => s.id !== stepId ? s : { ...s, isChecked: data.isChecked, stringValue: data.stringValue, checkedAt: data.checkedAt, checkedBy: data.checkedBy })
      }))
    } finally { setToggling(null) }
  }

  async function saveStepValue(procId: string, stepId: string, value: string | null) {
    setToggling(stepId)
    try {
      const res  = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${stepId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stringValue: value }),
      })
      const data = await res.json()
      if (!res.ok) return
      setProcedures(prev => prev.map(p => p.id !== procId ? p : {
        ...p, steps: p.steps.map(s => s.id !== stepId ? s : { ...s, stringValue: data.stringValue, isChecked: data.isChecked, checkedAt: data.checkedAt, checkedBy: data.checkedBy })
      }))
    } finally { setToggling(null) }
  }

  async function deleteProcedure(procId: string) {
    try {
      const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}`, { method: 'DELETE' })
      if (res.ok) {
        setProcedures(prev => prev.filter(p => p.id !== procId))
        router.refresh()
      }
    } catch { /* ignore */ }
  }

  const pct = totalSteps > 0 ? Math.round((checkedSteps / totalSteps) * 100) : 0

  // ── Flat asset-grouped steps ──

  function groupStepsByAsset(steps: ProcedureStep[]): { assetName: string; steps: ProcedureStep[] }[] {
    const groups = new Map<string, ProcedureStep[]>()
    const ungrouped: ProcedureStep[] = []

    for (const step of steps) {
      if (step.asset) {
        const key = step.asset.name
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(step)
      } else {
        ungrouped.push(step)
      }
    }

    const result: { assetName: string; steps: ProcedureStep[] }[] = []
    for (const [assetName, assetSteps] of groups) {
      result.push({ assetName, steps: assetSteps.sort((a, b) => a.sortOrder - b.sortOrder) })
    }
    result.sort((a, b) => a.assetName.localeCompare(b.assetName))

    if (ungrouped.length > 0) {
      result.unshift({ assetName: 'General Tasks', steps: ungrouped.sort((a, b) => a.sortOrder - b.sortOrder) })
    }

    return result
  }

  // ── Step row rendering ──

  function renderProcedureStepRow(step: ProcedureStep, procId: string) {
    const complete = isStepComplete(step)

    return (
      <div
        key={step.id}
        className={`flex items-start gap-3 p-2.5 rounded-lg transition-all border border-transparent ${
          complete ? 'bg-green-50/40 hover:bg-green-50/60 border-green-100/50' : 'hover:bg-slate-50/80 hover:border-slate-100'
        }`}
      >
        {step.type === 'CHECKBOX' ? (
          <button
            type="button"
            onClick={() => !isClosed && toggleStep(procId, step.id, step.isChecked)}
            disabled={toggling === step.id || isClosed}
            className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
              step.isChecked
                ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-100 scale-105'
                : 'border-slate-300 hover:border-green-500 hover:bg-green-50/20'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {step.isChecked && (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            )}
          </button>
        ) : step.type === 'INSPECTION' ? (
          <div className="flex gap-1 mt-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => !isClosed && saveStepValue(procId, step.id, 'PASS')}
              disabled={isClosed}
              className={`px-2 py-1 text-xs font-bold rounded border transition-all ${
                step.stringValue === 'PASS'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'border-slate-300 text-slate-500 hover:border-green-400'
              } disabled:opacity-50`}
            >
              ✓ PASS
            </button>
            <button
              type="button"
              onClick={() => !isClosed && saveStepValue(procId, step.id, 'FAIL')}
              disabled={isClosed}
              className={`px-2 py-1 text-xs font-bold rounded border transition-all ${
                step.stringValue === 'FAIL'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-slate-300 text-slate-500 hover:border-red-400'
              } disabled:opacity-50`}
            >
              ✗ FAIL
            </button>
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm transition-all ${
              complete ? 'line-through text-slate-400 font-normal' : 'text-slate-700 font-semibold'
            }`}>
              {step.label}
            </p>
            {step.type !== 'CHECKBOX' && (
              <span className="text-[10px] text-slate-400 font-mono uppercase">{step.type === 'INSPECTION' ? 'PASS/FAIL' : step.type.replace('_', ' ')}</span>
            )}
            {step.isMandatory && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                <AlertCircle className="w-2.5 h-2.5" />
                Required
              </span>
            )}
          </div>

          {step.type === 'TEXT_INPUT' && !isClosed && (
            <input
              type="text"
              defaultValue={step.stringValue ?? ''}
              onBlur={e => saveStepValue(procId, step.id, e.target.value || null)}
              disabled={toggling === step.id}
              className="mt-1.5 w-full text-xs border border-slate-250 rounded-md px-2 py-1 bg-white text-slate-700 disabled:opacity-50"
              placeholder="Enter text value..."
            />
          )}
          {step.type === 'TEXT_INPUT' && isClosed && step.stringValue && (
            <p className="text-xs text-slate-600 mt-1 italic">&ldquo;{step.stringValue}&rdquo;</p>
          )}
          {step.type === 'NUMBER_INPUT' && !isClosed && (
            <input
              type="number"
              defaultValue={step.stringValue ?? ''}
              onBlur={e => saveStepValue(procId, step.id, e.target.value || null)}
              disabled={toggling === step.id}
              className="mt-1.5 w-32 text-xs border border-slate-250 rounded-md px-2 py-1 bg-white text-slate-700 disabled:opacity-50"
              placeholder="0"
              step="any"
            />
          )}
          {step.type === 'NUMBER_INPUT' && isClosed && step.stringValue && (
            <p className="text-xs text-slate-600 mt-1">{step.stringValue}</p>
          )}
          {step.type === 'SINGLE_SELECT' && !isClosed && (
            <select
              defaultValue={step.stringValue ?? ''}
              onChange={e => saveStepValue(procId, step.id, e.target.value || null)}
              disabled={toggling === step.id}
              className="mt-1.5 text-xs border border-slate-250 rounded-md px-2 py-1 bg-white text-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <option value="">Select option...</option>
              {step.options.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
          {step.type === 'SINGLE_SELECT' && isClosed && step.stringValue && (
            <p className="text-xs text-slate-600 mt-1">Selected option: {step.stringValue}</p>
          )}
          {step.type === 'SIGNATURE' && !isClosed && (
            <div className="mt-1.5">
              {step.stringValue ? (
                <div className="flex items-center gap-2">
                  <img src={step.stringValue} alt="Signature" className="h-10 border border-slate-200 rounded" />
                  <button
                    type="button"
                    onClick={() => saveStepValue(procId, step.id, null)}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement('canvas')
                    canvas.width = 300; canvas.height = 80
                    const ctx = canvas.getContext('2d')
                    if (!ctx) return
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 80)
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 2
                    ctx.font = '14px sans-serif'
                    ctx.fillStyle = '#999'
                    ctx.fillText('Signature pad placeholder', 20, 45)
                    saveStepValue(procId, step.id, canvas.toDataURL())
                  }}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  + Click to Sign
                </button>
              )}
            </div>
          )}
          {step.type === 'SIGNATURE' && isClosed && step.stringValue && (
            <img src={step.stringValue} alt="Signature" className="mt-1 h-10 border border-slate-200 rounded" />
          )}

          {complete && step.checkedBy && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
              {step.type === 'CHECKBOX' ? 'Checked' : 'Completed'} by {step.checkedBy} · {step.checkedAt ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(step.checkedAt)) : ''}
            </p>
          )}
        </div>
        {!isClosed && (
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/work-orders/${woId}/procedures/${procId}/steps/${step.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isMandatory: !step.isMandatory }),
                })
                if (res.ok) {
                  setProcedures(prev => prev.map(p => p.id !== procId ? p : {
                    ...p, steps: p.steps.map(s => s.id !== step.id ? s : { ...s, isMandatory: !step.isMandatory })
                  }))
                }
              } catch { /* ignore */ }
            }}
            className="text-xs text-slate-400 hover:text-orange-500 transition-colors font-bold px-2 py-1 rounded hover:bg-slate-100 flex-shrink-0"
            title={step.isMandatory ? 'Remove required restriction' : 'Mark as required to complete order'}
          >
            {step.isMandatory ? '◆' : '◇'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/10">
        <div className="flex items-center gap-2.5">
          <h2 className="font-bold text-slate-805 text-sm tracking-tight">Procedures</h2>
          {totalSteps > 0 && (
            <span className="text-[11px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
              {checkedSteps}/{totalSteps} steps completed
            </span>
          )}
        </div>
        {!isClosed && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:text-blue-850 hover:underline font-bold transition">
            + Add Procedure
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="px-5 py-3.5 border-b border-slate-100/60 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all shadow-xs" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-705 w-9 text-right">{pct}%</span>
          </div>
        </div>
      )}

      {/* Add Procedure form */}
      {adding && (
        <form onSubmit={addProcedure} className="px-5 py-4 border-b border-slate-100 bg-blue-50/30 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Procedure title</label>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="input-field text-xs bg-white border-slate-200" placeholder="e.g. Safety check routines" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Steps (one per line)</label>
            <textarea value={newLabels} onChange={e => setNewLabels(e.target.value)}
              className="input-field text-xs bg-white border-slate-200 resize-none font-sans" rows={4}
              placeholder={"Check oil level\nInspect belts\nVerify visual indicators"} />
          </div>
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded">{error}</p>}
          <div className="flex gap-2 pt-1.5">
            <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-4 shadow-sm font-bold">
              {saving ? 'Adding...' : 'Add Procedure'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="btn-secondary text-xs py-2 px-4 font-bold">Cancel</button>
          </div>
        </form>
      )}

      {/* Procedures — flat asset-grouped rendering */}
      {procedures.length === 0 && !adding ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white">No Procedures added</div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white">
          {procedures.map(list => {
            const listPct = list.steps.length > 0
              ? Math.round((list.steps.filter(st => isStepComplete(st)).length / list.steps.length) * 105)
              : 0

            const assetGroups = groupStepsByAsset(list.steps)

            return (
              <div key={list.id} className="px-5 py-4 first:pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{list.title}</span>
                    <span className="text-xs bg-slate-50 border border-slate-100 font-semibold px-2 py-0.5 rounded-full text-slate-500">
                      {list.steps.filter(st => isStepComplete(st)).length}/{list.steps.length}
                    </span>
                    {listPct >= 100 && list.steps.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">Done</span>
                    )}
                    {list.source && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-extrabold uppercase tracking-wide text-indigo-700">
                        {list.source}
                      </span>
                    )}
                  </div>
                  {!isClosed && (
                    <button onClick={() => deleteProcedure(list.id)} className="text-slate-300 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Flat asset-grouped rendering */}
                {assetGroups.length > 0 ? (
                  <div className="space-y-4">
                    {assetGroups.map(group => (
                       <div key={group.assetName}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Package className="w-3.5 h-3.5 text-indigo-505 flex-shrink-0" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {group.assetName}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {group.steps.map(step => renderProcedureStepRow(step, list.id))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2 font-medium">No steps in this procedure</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
