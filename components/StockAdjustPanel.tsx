'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  partId: string
  currentQty: number
  unit: string
}

type AdjustType = 'add' | 'remove' | 'set'

export default function StockAdjustPanel({ partId, currentQty, unit }: Props) {
  const router = useRouter()
  const [type,    setType]    = useState<AdjustType>('add')
  const [amount,  setAmount]  = useState('')
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  const preview = (() => {
    const n = parseInt(amount)
    if (isNaN(n) || n < 0) return null
    if (type === 'add')    return currentQty + n
    if (type === 'remove') return Math.max(0, currentQty - n)
    if (type === 'set')    return n
    return null
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setSaving(true)
    try {
      const res  = await fetch(`/api/inventory/${partId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: parseInt(amount), reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setSuccess(`Stock updated to ${data.quantity} ${unit}`)
      setAmount(''); setReason('')
      router.refresh()
    } catch { setError('Network error') }
    finally  { setSaving(false) }
  }

  const tabs: { value: AdjustType; label: string; color: string }[] = [
    { value: 'add',    label: 'Restock',   color: 'text-green-700 bg-green-50 border-green-200' },
    { value: 'remove', label: 'Write-off', color: 'text-red-700 bg-red-50 border-red-200' },
    { value: 'set',    label: 'Set exact', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 text-sm mb-4">Adjust stock</h2>

      {/* Type tabs */}
      <div className="flex gap-1.5 mb-4">
        {tabs.map(tab => (
          <button key={tab.value} type="button"
            onClick={() => { setType(tab.value); setAmount(''); setError(''); setSuccess('') }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
              type === tab.value ? tab.color : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            {type === 'add' ? 'Quantity to add' : type === 'remove' ? 'Quantity to remove' : 'New quantity'}
          </label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            className="input-field text-sm" placeholder="0" required />
        </div>

        {/* Live preview */}
        {preview !== null && (
          <div className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-500">New quantity:</span>
            <span className={`font-bold ${preview === 0 ? 'text-red-600' : preview < currentQty ? 'text-yellow-700' : 'text-green-700'}`}>
              {preview} {unit}
            </span>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            className="input-field text-sm" placeholder="e.g. Received PO #1234" />
        </div>

        {error   && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600 font-medium">{success}</p>}

        <button type="submit" disabled={saving || !amount}
          className="btn-primary w-full text-sm">
          {saving ? 'Saving...' : 'Apply adjustment'}
        </button>
      </form>
    </div>
  )
}
