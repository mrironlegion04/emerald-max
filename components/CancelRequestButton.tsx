'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'

interface Props {
  requestId: string
  requestTitle: string
}

export default function CancelRequestButton({ requestId, requestTitle }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function cancel() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to cancel'); return }
      router.refresh()
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={cancel}
          disabled={loading}
          className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
        >
          {loading ? 'Cancelling...' : 'Confirm cancel'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1.5">
          Keep
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 transition-all"
      >
        <Ban className="w-3.5 h-3.5" /> Cancel request
      </button>
      {error && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{error}</p>}
    </>
  )
}
