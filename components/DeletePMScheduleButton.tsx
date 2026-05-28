'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { scheduleId: string; scheduleName: string }

export default function DeletePMScheduleButton({ scheduleId, scheduleName }: Props) {
  const router = useRouter()
  const [confirm,   setConfirm]  = useState(false)
  const [deleting,  setDeleting] = useState(false)
  const [error,     setError]    = useState('')

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/pm/${scheduleId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Delete failed')
        return
      }
      router.push('/preventive-maintenance')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setDeleting(false)
    }
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-sm text-red-600 hover:text-red-700 font-medium">
        Delete this schedule
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-red-700 font-medium">Delete "{scheduleName}"? This cannot be undone.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleDelete} disabled={deleting}
          className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50">
          {deleting ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button onClick={() => setConfirm(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </div>
  )
}
