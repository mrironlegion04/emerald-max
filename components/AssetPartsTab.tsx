'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Wrench, Package } from 'lucide-react'
import Badge, { workOrderStatusVariant } from '@/components/Badge'
import { WO_STATUS_LABELS } from '@/lib/work-order-status'

interface AssetPart {
  partId: string
  expectedQuantity: number
  part: {
    name: string
    partNumber: string
    unitCost: number | null
  }
}

interface PartOption {
  id: string
  name: string
  partNumber: string
}

interface BOMTemplateOption {
  id: string
  name: string
  _count: { parts: number }
}

interface PartsUsageEntry {
  id: string
  quantity: number
  unitCost: number | null
  part: { id: string; name: string; partNumber: string; unit: string }
  workOrder: { id: string; woNumber: string; title: string; status: string; completedAt: Date | null; createdAt: Date }
}

interface Props {
  assetId: string
  assetParts: AssetPart[]
  allParts: PartOption[]
  bomTemplates?: BOMTemplateOption[]
  partsUsage: PartsUsageEntry[]
  totalPartsValue: number
  totalPartsUsedQty: number
  totalPartsUsedCost: number
  canEdit: boolean
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}

const woStatusLabels = WO_STATUS_LABELS

export default function AssetPartsTab({
  assetId, assetParts, allParts, bomTemplates = [], partsUsage,
  totalPartsValue, totalPartsUsedQty, totalPartsUsedCost, canEdit,
}: Props) {
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
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/apply-bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selTemplate }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to apply template')
        return
      }
      setApplyingTemplate(false); setSelTemplate('')
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function linkPart(e: React.FormEvent) {
    e.preventDefault()
    if (!selPart) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selPart, expectedQuantity: parseInt(qty) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setAdding(false); setSelPart(''); setQty('1')
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function removePart(partId: string) {
    setRemoving(partId); setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/parts/${partId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      router.refresh()
    } catch { setError('Network error') }
    finally { setRemoving(null) }
  }

  return (
    <div className="space-y-6">
      {/* ── Parts List ── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            Parts
            <span className="text-gray-400 font-normal">({assetParts.length})</span>
          </h2>
          {canEdit && !adding && !applyingTemplate && (
            <div className="flex gap-3">
              <button
                onClick={() => setApplyingTemplate(true)}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Apply Template
              </button>
              <button
                onClick={() => setAdding(true)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Link part
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 px-5 pt-3">{error}</p>}

        {/* Apply template form */}
        {applyingTemplate && (
          <form onSubmit={applyTemplate} className="px-5 py-4 bg-indigo-50 border-b border-indigo-100">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-600 mb-1 block">BOM Template</label>
                <select
                  value={selTemplate} onChange={e => setSelTemplate(e.target.value)}
                  required className="input-field text-sm"
                >
                  <option value="">Select a template...</option>
                  {bomTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t._count.parts} parts)</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="btn-primary text-sm bg-indigo-600 hover:bg-indigo-700 border-indigo-600 hover:border-indigo-700">
                  {saving ? '...' : 'Apply'}
                </button>
                <button type="button" onClick={() => { setApplyingTemplate(false); setError('') }}
                  className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Add part form */}
        {adding && (
          <form onSubmit={linkPart} className="px-5 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-600 mb-1 block">Part</label>
                <select value={selPart} onChange={e => setSelPart(e.target.value)}
                  className="input-field text-sm" required>
                  <option value="">Select a part...</option>
                  {availableParts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-24">
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
        {assetParts.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 px-5">
            No parts linked to this asset. Link parts to create a Bill of Materials.
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {assetParts.map(ap => (
                <div key={ap.partId} className="flex items-center gap-3 sm:gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ap.part.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{ap.part.partNumber}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-gray-500">
                      {ap.expectedQuantity} × {fmtCurrency(ap.part.unitCost ?? 0)}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {fmtCurrency(ap.expectedQuantity * (ap.part.unitCost ?? 0))}
                    </p>
                  </div>
                  {canEdit && (
                    <button onClick={() => removePart(ap.partId)} disabled={removing === ap.partId}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-1 sm:ml-2 p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0"
                      title="Remove from asset">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total parts value</span>
              <span className="text-sm font-bold text-gray-900">{fmtCurrency(totalPartsValue)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Parts Usage History ── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-400" />
            Parts Usage
            <span className="text-gray-400 font-normal">({partsUsage.length})</span>
          </h2>
        </div>

        {partsUsage.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 px-5">
            No parts have been used on work orders for this asset yet.
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {partsUsage.map(entry => (
                <Link
                  key={entry.id}
                  href={`/work-orders/${entry.workOrder.id}`}
                  className="block px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Top row: part name + status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.part.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">{entry.part.partNumber}</p>
                    </div>
                    <Badge
                      label={woStatusLabels[entry.workOrder.status] ?? entry.workOrder.status}
                      variant={workOrderStatusVariant(entry.workOrder.status)}
                    />
                  </div>
                  {/* Bottom row: WO info + qty/cost */}
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <p className="text-xs text-gray-400 truncate">
                      {entry.workOrder.woNumber} · {entry.workOrder.title}
                      {entry.workOrder.completedAt ? ` · ${fmtDate(entry.workOrder.completedAt)}` : ''}
                    </p>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-700">
                        {entry.quantity} {entry.part.unit}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {fmtCurrency(entry.quantity * (entry.unitCost ?? 0))}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total parts used</span>
              <span className="text-sm font-bold text-gray-900">
                {totalPartsUsedQty} pcs · {fmtCurrency(totalPartsUsedCost)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
