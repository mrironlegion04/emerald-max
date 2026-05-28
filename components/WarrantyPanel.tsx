'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, daysUntil } from '@/lib/utils'

interface Props {
  assetId: string
  warrantyExpiry: string | null
  warrantyNotes: string | null
  canEdit: boolean
}

export default function WarrantyPanel({ assetId, warrantyExpiry, warrantyNotes, canEdit }: Props) {
  const router  = useRouter()
  const [editing, setEditing] = useState(false)
  const [expiry,  setExpiry]  = useState(warrantyExpiry ? new Date(warrantyExpiry).toISOString().split('T')[0] : '')
  const [notes,   setNotes]   = useState(warrantyNotes ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const days    = warrantyExpiry ? daysUntil(warrantyExpiry) : null
  const expired = days !== null && days < 0
  const expiring = days !== null && days >= 0 && days <= 30

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warrantyExpiry: expiry || null, warrantyNotes: notes || null }),
      })
      if (!res.ok) { setError('Save failed'); return }
      setEditing(false)
      router.refresh()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-sm">Warranty</h2>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Warranty expiry date</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field text-sm resize-none" rows={2} placeholder="Warranty coverage details, vendor contact..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {!warrantyExpiry ? (
            <p className="text-sm text-gray-400">No warranty information recorded</p>
          ) : (
            <>
              <div className={`rounded-lg px-3 py-2.5 ${expired ? 'bg-red-50 border border-red-100' : expiring ? 'bg-yellow-50 border border-yellow-100' : 'bg-green-50 border border-green-100'}`}>
                <p className={`text-xs font-semibold ${expired ? 'text-red-700' : expiring ? 'text-yellow-700' : 'text-green-700'}`}>
                  {expired ? 'Warranty expired' : expiring ? 'Expiring soon' : 'Under warranty'}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${expired ? 'text-red-800' : expiring ? 'text-yellow-800' : 'text-green-800'}`}>
                  {fmt(warrantyExpiry)}
                </p>
                {days !== null && (
                  <p className={`text-xs mt-0.5 ${expired ? 'text-red-600' : expiring ? 'text-yellow-600' : 'text-green-600'}`}>
                    {expired ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`}
                  </p>
                )}
              </div>
              {warrantyNotes && <p className="text-sm text-gray-600 leading-relaxed">{warrantyNotes}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}