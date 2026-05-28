'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { partId: string }

export default function RestorePartButton({ partId }: Props) {
  const router = useRouter()
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState('')

  async function handleRestore() {
    setRestoring(true); setError('')
    try {
      const res = await fetch(`/api/inventory/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Restore failed'); return }
      router.refresh()
    } catch { setError('Network error') }
    finally { setRestoring(false) }
  }

  return (
    <div>
      <button
        onClick={handleRestore}
        disabled={restoring}
        className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {restoring ? 'Restoring...' : 'Restore part'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}