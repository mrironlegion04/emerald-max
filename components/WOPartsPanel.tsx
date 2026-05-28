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
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">
          Parts used
          <span className="ml-2 text-gray-400 font-normal">({parts.length})</span>
        </h2>
        {canModify && !adding && (
          <button onClick={() => setAdding(true)}
            className="text-xs text-blue-600 hover:underline font-medium">
            + Add part
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 px-5 pt-3">{error}</p>}

      {/* Add part form */}
      {adding && (
        <form onSubmit={addPart} className="px-5 py-4 bg-blue-50 border-b border-blue-100">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-600 mb-1 block">Part</label>
              <select value={selPart} onChange={e => setSelPart(e.target.value)}
                className="input-field text-sm" required>
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
            <div className="w-24">
              <label className="text-xs text-gray-600 mb-1 block">Qty</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                className="input-field text-sm" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? '...' : 'Add'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }}
                className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Parts list */}
      {parts.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No parts recorded</div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {parts.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.partNumber}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-gray-700">{p.quantity} × {fmtCurrency(p.unitCost)}</p>
                  <p className="text-xs text-gray-500 font-medium">= {fmtCurrency(p.quantity * p.unitCost)}</p>
                </div>
                {canModify && (
                  <button onClick={() => removePart(p.id)} disabled={removing === p.id}
                    className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-xl">
            <span className="text-sm text-gray-500">Total parts cost</span>
            <span className="text-sm font-bold text-gray-900">{fmtCurrency(totalPartsCost)}</span>
          </div>
        </>
      )}
    </div>
  )
}
