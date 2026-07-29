'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SkipForward } from 'lucide-react'

interface Props {
  woId: string
  currentStatus: string
  isPmGenerated: boolean
  userRole: string
  userId: string
  assignedToId: string | null
}

export default function SkipPMButton({ woId, currentStatus, isPmGenerated, userRole, userId, assignedToId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Only show for PM-generated WOs that can be skipped
  if (!isPmGenerated || !['OPEN', 'IN_PROGRESS'].includes(currentStatus)) {
    return null
  }

  // Check access: admin, manager, or assigned technician
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'
  const isAssignedTech = assignedToId === userId
  if (!isAdminOrManager && !isAssignedTech) {
    return null
  }

  async function handleSkip() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/skip-pm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to skip')
        return
      }
      router.refresh()
      setShowConfirm(false)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full py-2.5 px-4 rounded-xl text-xs transition-all tracking-wide bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/50 font-semibold flex items-center justify-center gap-2"
      >
        <SkipForward className="w-3.5 h-3.5" />
        Skip PM Cycle
      </button>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-amber-50/35 rounded-xl border border-amber-100">
      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Skip this PM cycle?</p>
      <p className="text-xs text-amber-700">
        This will cancel the work order and advance the PM schedule to the next due date.
      </p>
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Reason (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Why are you skipping this maintenance?"
          className="input-field text-xs bg-white border-slate-200 resize-none w-full"
          rows={2}
        />
      </div>
      {error && (
        <p className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-bold">
          {error}
        </p>
      )}
      <div className="flex gap-2.5 pt-1.5">
        <button
          onClick={handleSkip}
          disabled={loading}
          className="btn-primary text-xs font-bold py-2 px-4 shadow-sm shadow-blue-50 flex-1 bg-amber-600 hover:bg-amber-700"
        >
          {loading ? 'Skipping...' : 'Confirm Skip'}
        </button>
        <button
          onClick={() => { setShowConfirm(false); setNotes(''); setError('') }}
          className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
