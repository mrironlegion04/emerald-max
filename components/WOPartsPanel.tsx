'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

interface PartUsed {
  id: string; partId: string; name: string
  partNumber: string; quantity: number; unitCost: number
}
interface PartOption {
  id: string; name: string; partNumber: string; unitCost: number
}
interface Props {
  woId: string
  partsUsed: PartUsed[]
  allParts: PartOption[]
  canEdit: boolean
  woStatus: string
  suggestedPartIds?: string[]
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v)
}

export default function WOPartsPanel({ woId, partsUsed, allParts, canEdit, woStatus, suggestedPartIds = [] }: Props) {
  const router = useRouter()
  const [parts, setParts]     = useState(partsUsed)
  const [adding, setAdding]   = useState(false)
  const [selPart, setSelPart] = useState('')
  const [qty, setQty]         = useState('1')
  const [saving, setSaving]   = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError]     = useState('')

  const canModify = canEdit && !['COMPLETED','CANCELLED'].includes(woStatus)
  const totalPartsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)

  async function addPart(e: React.FormEvent) {
    e.preventDefault()
    if (!selPart) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selPart, quantity: parseInt(qty) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      // Optimistic update
      const found = allParts.find(p => p.id === selPart)!
      setParts(prev => [...prev, {
        id: data.id, partId: selPart, name: found.name,
        partNumber: found.partNumber, quantity: parseInt(qty),
        unitCost: data.unitCost ?? found.unitCost,
      }])
      setAdding(false); setSelPart(''); setQty('1')
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function removePart(partUsedId: string) {
    setRemoving(partUsedId); setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/parts/${partUsedId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      setParts(prev => prev.filter(p => p.id !== partUsedId))
      router.refresh()
    } catch { setError('Network error') }
    finally { setRemoving(null) }
  }

  return (
    <div className="premium-card p-0 overflow-hidden border border-slate-200/50 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/10">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
          Parts used
          <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
            {parts.length}
          </span>
        </h2>
        {canModify && !adding && (
          <button onClick={() => setAdding(true)}
            className="text-xs text-blue-600 hover:text-blue-850 hover:underline font-bold transition">
            + Add part
          </button>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-5 py-2.5">{error}</p>}

      {/* Add part form */}
      {adding && (
        <form onSubmit={addPart} className="px-5 py-4 bg-blue-50/20 border-b border-blue-100/60">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Part</label>
              <select value={selPart} onChange={e => setSelPart(e.target.value)}
                className="input-field text-xs bg-white" required>
                <option value="">Select a part...</option>
                {suggestedPartIds.length > 0 && (
                  <optgroup label="Suggested (Asset BOM)">
                    {allParts.filter(p => suggestedPartIds.includes(p.id)).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partNumber})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={suggestedPartIds.length > 0 ? "Other Parts" : "All Parts"}>
                  {allParts.filter(p => !suggestedPartIds.includes(p.id)).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.partNumber})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="w-full sm:w-24">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Qty</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                className="input-field text-xs bg-white" required />
            </div>
            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-1">
              <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-4 shadow-sm font-bold flex-1 sm:flex-none">
                {saving ? '...' : 'Add'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }}
                className="btn-secondary text-xs py-2 px-4 font-bold flex-1 sm:flex-none">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Parts list */}
      {parts.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium">No parts recorded</div>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {parts.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-55/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 tracking-tight">{p.name}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.partNumber}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-600 font-medium">{p.quantity} × {fmtCurrency(p.unitCost)}</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">= {fmtCurrency(p.quantity * p.unitCost)}</p>
                </div>
                {canModify && (
                  <button onClick={() => removePart(p.id)} disabled={removing === p.id}
                    className="text-slate-350 hover:text-rose-600 transition-colors ml-2 p-1 hover:bg-slate-100 rounded-lg">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <span className="text-xs font-bold text-slate-550 uppercase tracking-wider">Total parts cost</span>
            <span className="text-sm font-extrabold text-slate-900">{fmtCurrency(totalPartsCost)}</span>
          </div>
        </>
      )}
    </div>
  )
}
