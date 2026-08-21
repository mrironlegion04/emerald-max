'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { scheduleId: string; scheduleName: string }

export default function RestorePMScheduleButton({ scheduleId, scheduleName }: Props) {
  const router = useRouter()
  const [confirm,   setConfirm]  = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error,     setError]    = useState('')

  async function handleRestore() {
    setRestoring(true); setError('')
    try {
      const res = await fetch(`/api/pm/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Restore failed')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setRestoring(false)
    }
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-sm text-red-600 hover:text-red-700 font-medium">
        Restore this schedule
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-red-700 font-medium">Restore "{scheduleName}"?</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleRestore} disabled={restoring}
          className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50">
          {restoring ? 'Restoring...' : 'Yes, restore'}
        </button>
        <button onClick={() => setConfirm(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </div>
  )
}
