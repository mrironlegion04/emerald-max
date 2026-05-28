'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { requestId: string; title: string }

export default function RequestActions({ requestId, title }: Props) {
  const router  = useRouter()
  const [mode, setMode]     = useState<'idle'|'reject'|'convert'>('idle')
  const [loading, setLoading] = useState(false)
  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState('')

  async function doAction(action: string, extra?: Record<string,unknown>) {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  if (mode === 'reject') return (
    <div className="flex-shrink-0 space-y-2 min-w-48">
      <textarea value={reason} onChange={e => setReason(e.target.value)} className="input-field text-sm resize-none w-full" rows={2} placeholder="Reason for rejection..." />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => doAction('reject', { reason })} disabled={loading} className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg flex-1 disabled:opacity-50">{loading ? '...' : 'Reject'}</button>
        <button onClick={() => setMode('idle')} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="flex-shrink-0 flex flex-col gap-2 min-w-36">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={() => doAction('approve')} disabled={loading}
        className="btn-primary text-sm py-1.5 w-full">{loading ? '...' : 'Approve'}</button>
      <button onClick={() => doAction('convert')} disabled={loading}
        className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1.5 px-3 rounded-lg border border-blue-200 transition-colors disabled:opacity-50 w-full">{loading ? '...' : 'Convert to WO'}</button>
      <button onClick={() => setMode('reject')} className="btn-secondary text-sm py-1.5 w-full">Reject</button>
    </div>
  )
}