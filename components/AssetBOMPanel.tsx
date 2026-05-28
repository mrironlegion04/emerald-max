'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Wrench } from 'lucide-react'

interface PartOption {
  id: string
  name: string
  partNumber: string
}

interface AssetPart {
  partId: string
  expectedQuantity: number
  part: {
    name: string
    partNumber: string
    unitCost: number | null
  }
}

interface BOMTemplateOption {
  id: string
  name: string
  _count: { parts: number }
}

interface Props {
  assetId: string
  assetParts: AssetPart[]
  allParts: PartOption[]
  bomTemplates?: BOMTemplateOption[]
  canEdit: boolean
}

export default function AssetBOMPanel({ assetId, assetParts, allParts, bomTemplates = [], canEdit }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [selPart, setSelPart] = useState('')
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [selTemplate, setSelTemplate] = useState('')

  const availableParts = allParts.filter(p => !assetParts.some(ap => ap.partId === p.id))

  async function applyTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!selTemplate) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/apply-bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selTemplate })
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to apply template')
        return
      }
      setApplyingTemplate(false)
      setSelTemplate('')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function linkPart(e: React.FormEvent) {
    e.preventDefault()
    if (!selPart) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selPart, expectedQuantity: parseInt(qty) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      
      setAdding(false)
      setSelPart('')
      setQty('1')
      router.refresh()
    } catch { 
      setError('Network error') 
    } finally { 
      setSaving(false) 
    }
  }

  async function removePart(partId: string) {
    setRemoving(partId)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/parts/${partId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      router.refresh()
    } catch { 
      setError('Network error') 
    } finally { 
      setRemoving(null) 
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Wrench className="w-4 h-4 text-gray-400" />
          Bill of Materials
          <span className="text-gray-400 font-normal">({assetParts.length})</span>
        </h2>
        {canEdit && !adding && !applyingTemplate && (
          <div className="flex gap-3">
            <button onClick={() => setApplyingTemplate(true)}
              className="text-xs text-indigo-600 hover:underline font-medium">
              Apply Template
            </button>
            <button onClick={() => setAdding(true)}
              className="text-xs text-blue-600 hover:underline font-medium">
              + Link part
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 px-5 pt-3">{error}</p>}

      {applyingTemplate && (
        <form onSubmit={applyTemplate} className="px-5 py-4 bg-indigo-50 border-b border-indigo-100">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-600 mb-1 block">BOM Template</label>
              <select value={selTemplate} onChange={e => setSelTemplate(e.target.value)} required className="input-field text-sm">
                <option value="">Select a template...</option>
                {bomTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t._count.parts} parts)</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary text-sm bg-indigo-600 hover:bg-indigo-700 border-indigo-600 hover:border-indigo-700">
                {saving ? '...' : 'Apply'}
              </button>
              <button type="button" onClick={() => { setApplyingTemplate(false); setError('') }} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {adding && (
        <form onSubmit={linkPart} className="px-5 py-4 bg-blue-50 border-b border-blue-100">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-600 mb-1 block">Part</label>
              <select value={selPart} onChange={e => setSelPart(e.target.value)}
                className="input-field text-sm" required>
                <option value="">Select a part...</option>
                {availableParts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.partNumber})
                  </option>
                ))}
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

      {assetParts.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 px-5">
          No parts linked to this asset. Link parts to create a Bill of Materials for easier work order suggestions.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {assetParts.map(ap => (
            <div key={ap.partId} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{ap.part.name}</p>
                <p className="text-xs text-gray-400">{ap.part.partNumber}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  Qty: {ap.expectedQuantity}
                </span>
              </div>
              {canEdit && (
                <button onClick={() => removePart(ap.partId)} disabled={removing === ap.partId}
                  className="text-gray-300 hover:text-red-500 transition-colors ml-2"
                  title="Remove from BOM">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
