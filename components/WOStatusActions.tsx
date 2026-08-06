'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, Check, X, Pencil } from 'lucide-react'
import FaceVerificationModal from './FaceVerificationModal'

interface Props {
  woId: string
  currentStatus: string
  userRole: string
  userId: string
  canCloseWO?: boolean
  requestedCompletionTime: string | null
  requestedCompletionNotes: string | null
  initialStartAt?: string | null
  initialLaborHours?: number | null
  initialLaborCost?: number | null
  initialDowntimeStartedAt?: string | null
  initialDowntimeEndedAt?: string | null
  onStatusChanged?: () => void
}

// Valid transitions from each status
const transitions: Record<string, { value: string; label: string; color: string }[]> = {
  OPEN: [
    { value: 'IN_PROGRESS', label: 'Start work',   color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md font-bold' },
    { value: 'CANCELLED',   label: 'Cancel WO',    color: 'bg-slate-100 hover:bg-slate-205 text-slate-700 border border-slate-200/50 font-semibold' },
  ],
  IN_PROGRESS: [
    { value: 'PENDING_APPROVAL', label: 'Mark complete', color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-md font-bold' },
    { value: 'ON_HOLD',          label: 'Put on hold',   color: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 shadow-md font-bold' },
  ],
  ON_HOLD: [
    { value: 'IN_PROGRESS', label: 'Resume work',   color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-md font-bold' },
    { value: 'CANCELLED',   label: 'Cancel WO',     color: 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 font-semibold' },
  ],
  PENDING_APPROVAL: [],
  COMPLETED:  [
    { value: 'CLOSED', label: 'Close WO',   color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md font-bold' },
    { value: 'OPEN',   label: 'Reopen WO', color: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 shadow-md font-bold' },
  ],
  CLOSED:     [],
  CANCELLED:  [
    { value: 'OPEN',        label: 'Re-open WO',    color: 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 font-semibold' },
  ],
}

function toLocalDatetimeString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

export default function WOStatusActions({ woId, currentStatus, userRole, userId, canCloseWO = false, requestedCompletionTime, requestedCompletionNotes, initialStartAt, initialLaborHours, initialLaborCost, initialDowntimeStartedAt, initialDowntimeEndedAt, onStatusChanged }: Props) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [notes, setNotes]       = useState('')
  const [laborHours, setLaborHours] = useState('')
  const [laborCost, setLaborCost]   = useState('')
  const [downSince, setDownSince]   = useState('')
  const [backUpAt, setBackUpAt]     = useState(() => toLocalDatetimeString(new Date()))
  const [showComplete, setShowComplete] = useState(false)
  const [showFaceVerification, setShowFaceVerification] = useState(false)
  const [hasFaceVerification, setHasFaceVerification] = useState(false)
  const [faceVerificationSucceeded, setFaceVerificationSucceeded] = useState(false)

  // Start work form state
  const [showStartWork, setShowStartWork] = useState(false)
  const [startedAtValue, setStartedAtValue] = useState(() => toLocalDatetimeString(new Date()))

  // Unlock form state (admin-only)
  const [showUnlock, setShowUnlock] = useState(false)
  const [unlockReason, setUnlockReason] = useState('')

  // Tech completion form state
  const [requestedTime, setRequestedTime] = useState(() => toLocalDatetimeString(new Date()))
  const [requestNotes, setRequestNotes] = useState('')

  // Manager approval state
  const [showAdjustTime, setShowAdjustTime] = useState(false)
  const [adjustedTime, setAdjustedTime] = useState(() => toLocalDatetimeString(new Date()))
  const [adjustedStartAt, setAdjustedStartAt] = useState(() => initialStartAt ? toLocalDatetimeString(new Date(initialStartAt)) : '')
  const [adjustedLaborHours, setAdjustedLaborHours] = useState(() => initialLaborHours != null ? String(initialLaborHours) : '')
  const [adjustedLaborCost, setAdjustedLaborCost] = useState(() => initialLaborCost != null ? String(initialLaborCost) : '')
  const [adjustedDownSince, setAdjustedDownSince] = useState(() => initialDowntimeStartedAt ? toLocalDatetimeString(new Date(initialDowntimeStartedAt)) : '')
  const [adjustedBackUpAt, setAdjustedBackUpAt] = useState(() => initialDowntimeEndedAt ? toLocalDatetimeString(new Date(initialDowntimeEndedAt)) : '')

  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'
  const canClose = userRole === 'ADMIN' || canCloseWO
  const allAvailable = transitions[currentStatus] ?? []
  const available = (currentStatus === 'COMPLETED' || currentStatus === 'CLOSED') && !isAdminOrManager ? [] : allAvailable

  async function checkFaceVerification() {
    try {
      const res = await fetch(`/api/face/${userId}`)
      const data = await res.json()
      setHasFaceVerification(data.hasFaceVerification)
      return data.hasFaceVerification
    } catch {
      return false
    }
  }

  async function doTransition(newStatus: string) {
    if (newStatus === 'PENDING_APPROVAL') {
      setShowComplete(true)
      setRequestedTime(toLocalDatetimeString(new Date()))
      setRequestNotes('')
      setDownSince(initialDowntimeStartedAt ? toLocalDatetimeString(new Date(initialDowntimeStartedAt)) : '')
      setBackUpAt(initialDowntimeEndedAt ? toLocalDatetimeString(new Date(initialDowntimeEndedAt)) : toLocalDatetimeString(new Date()))
      return
    }

    if (newStatus === 'IN_PROGRESS') {
      setShowStartWork(true)
      setStartedAtValue(toLocalDatetimeString(new Date()))
      setDownSince(initialDowntimeStartedAt ? toLocalDatetimeString(new Date(initialDowntimeStartedAt)) : '')
      return
    }

    if (newStatus === 'COMPLETED' && currentStatus === 'CLOSED') {
      setShowUnlock(true)
      setUnlockReason('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: notes || undefined,
          laborHours: laborHours ? parseFloat(laborHours) : undefined,
          laborCost:  laborCost  ? parseFloat(laborCost)  : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setNotes('')
      setLaborHours('')
      setLaborCost('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function confirmStartWork() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          startedAt: new Date(startedAtValue).toISOString(),
          downtimeStartedAt: downSince ? new Date(downSince).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setShowStartWork(false)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Tech submits for approval
  const handleSubmitForApproval = async () => {
    const hasFace = await checkFaceVerification()
    if (hasFace) {
      setShowFaceVerification(true)
      setFaceVerificationSucceeded(false)
    } else {
      submitForApproval()
    }
  }

  const submitForApproval = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PENDING_APPROVAL',
          notes: notes || undefined,
          laborHours: laborHours ? parseFloat(laborHours) : undefined,
          laborCost:  laborCost  ? parseFloat(laborCost)  : undefined,
          requestedCompletionTime: new Date(requestedTime).toISOString(),
          requestedCompletionNotes: requestNotes || undefined,
          downtimeStartedAt: downSince ? new Date(downSince).toISOString() : undefined,
          downtimeEndedAt: backUpAt ? new Date(backUpAt).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setShowComplete(false)
      setFaceVerificationSucceeded(false)
      setNotes('')
      setLaborHours('')
      setLaborCost('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Manager approves with tech's requested time
  const handleApprove = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          completedAt: requestedCompletionTime || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Manager approves with adjusted time
  const handleApproveAdjusted = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          completedAt: new Date(adjustedTime).toISOString(),
          startedAt: adjustedStartAt ? new Date(adjustedStartAt).toISOString() : undefined,
          laborHours: adjustedLaborHours ? parseFloat(adjustedLaborHours) : undefined,
          laborCost:  adjustedLaborCost  ? parseFloat(adjustedLaborCost)  : undefined,
          downtimeStartedAt: adjustedDownSince ? new Date(adjustedDownSince).toISOString() : undefined,
          downtimeEndedAt: adjustedBackUpAt ? new Date(adjustedBackUpAt).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setShowAdjustTime(false)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Manager rejects — reopen to IN_PROGRESS
  const handleReject = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setNotes('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // Admin unlocks CLOSED → COMPLETED
  const handleUnlock = async () => {
    if (!unlockReason.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          notes: unlockReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
      onStatusChanged?.()
      setShowUnlock(false)
      setUnlockReason('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // ── Terminal states ──
  if (currentStatus === 'CLOSED') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 border border-emerald-150 px-4 py-3 rounded-xl text-xs font-bold shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Work Order Closed — Verified &amp; Finalized
        </div>

        {showUnlock && isAdminOrManager && (
          <div className="space-y-3 p-4 bg-amber-50/35 rounded-xl border border-amber-100 shadow-inner-light">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Unlock for administrative correction</p>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Reason (required)</label>
              <textarea value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="Why does this closed work order need to be unlocked?"
                className="input-field text-xs bg-white border-slate-200 resize-none w-full" rows={3} />
            </div>
            {error && <p className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-bold">{error}</p>}
            <div className="flex gap-2.5 flex-col xs:flex-row">
              <button onClick={handleUnlock} disabled={loading || !unlockReason.trim()}
                className="btn-primary text-xs font-bold py-2 px-4 shadow-sm shadow-blue-50 flex-1 disabled:opacity-50">
                {loading ? 'Unlocking...' : 'Confirm Unlock'}
              </button>
              <button onClick={() => { setShowUnlock(false); setUnlockReason(''); setError('') }}
                className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showUnlock && isAdminOrManager && (
          <button onClick={() => doTransition('COMPLETED')} disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs transition-all tracking-wide bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/50 font-semibold disabled:opacity-50">
            Unlock WO (Admin)
          </button>
        )}
      </div>
    )
  }

  if (currentStatus === 'COMPLETED') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50/50 border border-amber-150 px-4 py-3 rounded-xl text-xs font-bold shadow-xs">
          <CheckCircle className="w-4 h-4 text-amber-500" />
          Awaiting Closure — Manager verification required
        </div>
        {isAdminOrManager && canClose && (
          <div className="flex flex-col gap-2">
            <button onClick={() => doTransition('CLOSED')} disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs transition-all tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md font-bold disabled:opacity-50">
              {loading ? 'Closing...' : 'Close Work Order'}
            </button>
            <button onClick={() => doTransition('OPEN')} disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs transition-all tracking-wide bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 shadow-md font-bold disabled:opacity-50">
              {loading ? 'Reopening...' : 'Reopen WO'}
            </button>
          </div>
        )}
        {!isAdminOrManager && (
          <p className="text-xs text-slate-500 text-center py-2">
            Waiting for manager to close...
          </p>
        )}
        {isAdminOrManager && !canClose && (
          <p className="text-xs text-slate-500 text-center py-2">
            Your scope does not allow closing work orders.
          </p>
        )}
      </div>
    )
  }

  // ── PENDING APPROVAL — manager sees approve/reject ──
  if (currentStatus === 'PENDING_APPROVAL') {
    return (
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-bold">{error}</p>}

        {/* Requested time display */}
        <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Awaiting approval</p>
          </div>
          <p className="text-xs text-purple-700">
            Requested completion: <span className="font-bold">{fmtDateTime(requestedCompletionTime)}</span>
          </p>
          {requestedCompletionNotes && (
            <p className="text-xs text-purple-600 mt-1 italic">"{requestedCompletionNotes}"</p>
          )}
        </div>

        {/* Manager actions */}
        {isAdminOrManager && (
          <div className="space-y-2">
            {!showAdjustTime ? (
              <>
                {canClose && (
                  <button onClick={handleApprove} disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md disabled:opacity-50">
                    {loading ? 'Approving...' : 'Approve with requested time'}
                  </button>
                )}
                {canClose && (
                  <button onClick={() => {
                      setShowAdjustTime(true)
                      setAdjustedTime(toLocalDatetimeString(new Date()))
                      setAdjustedStartAt(initialStartAt ? toLocalDatetimeString(new Date(initialStartAt)) : '')
                      setAdjustedLaborHours(initialLaborHours != null ? String(initialLaborHours) : '')
                      setAdjustedLaborCost(initialLaborCost != null ? String(initialLaborCost) : '')
                      setAdjustedDownSince(initialDowntimeStartedAt ? toLocalDatetimeString(new Date(initialDowntimeStartedAt)) : '')
                      setAdjustedBackUpAt(initialDowntimeEndedAt ? toLocalDatetimeString(new Date(initialDowntimeEndedAt)) : toLocalDatetimeString(new Date()))
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-md">
                    <Pencil className="w-3 h-3 inline mr-1.5" />
                    Adjust time & approve
                  </button>
                )}
                <button onClick={handleReject} disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/50 disabled:opacity-50">
                  {loading ? 'Rejecting...' : 'Reject & reopen'}
                </button>
              </>
            ) : (
              <div className="space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Completion time</label>
                <input type="datetime-local" value={adjustedTime}
                  onChange={e => setAdjustedTime(e.target.value)}
                  className="input-field text-xs bg-white border-slate-200 w-full" />
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Start time</label>
                <input type="datetime-local" value={adjustedStartAt}
                  onChange={e => setAdjustedStartAt(e.target.value)}
                  className="input-field text-xs bg-white border-slate-200 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Labor hours</label>
                    <input type="number" min="0" step="0.5" value={adjustedLaborHours}
                      onChange={e => setAdjustedLaborHours(e.target.value)}
                      placeholder="0.0" className="input-field text-xs bg-white border-slate-200 w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Labor cost ($)</label>
                    <input type="number" min="0" step="0.01" value={adjustedLaborCost}
                      onChange={e => setAdjustedLaborCost(e.target.value)}
                      placeholder="0.00" className="input-field text-xs bg-white border-slate-200 w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Machine down since</label>
                    <input type="datetime-local" value={adjustedDownSince}
                      onChange={e => setAdjustedDownSince(e.target.value)}
                      className="input-field text-xs bg-white border-slate-200 w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Back up at</label>
                    <input type="datetime-local" value={adjustedBackUpAt}
                      onChange={e => setAdjustedBackUpAt(e.target.value)}
                      className="input-field text-xs bg-white border-slate-200 w-full" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleApproveAdjusted} disabled={loading}
                    className="btn-primary text-xs font-bold py-2 px-4 shadow-sm flex-1">
                    {loading ? 'Approving...' : 'Approve'}
                  </button>
                  <button onClick={() => setShowAdjustTime(false)}
                    className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Non-manager sees waiting message */}
        {!isAdminOrManager && (
          <p className="text-xs text-slate-500 text-center py-2">
            Waiting for manager approval...
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-bold">{error}</p>}

      {/* Face Verification Modal */}
      {showFaceVerification && (
        <FaceVerificationModal
          userId={userId}
          isOpen={showFaceVerification}
          onClose={() => setShowFaceVerification(false)}
          onSuccess={(verified) => {
            if (verified) {
              setShowFaceVerification(false)
              submitForApproval()
            }
          }}
          requiredSimilarity={60}
        />
      )}

      {/* Start work form */}
      {showStartWork && (
        <div className="space-y-3 p-4 bg-emerald-50/35 rounded-xl border border-emerald-100 shadow-inner-light">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">When did you start working?</p>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Start date & time</label>
            <input type="datetime-local" value={startedAtValue}
              onChange={e => setStartedAtValue(e.target.value)}
              className="input-field text-xs bg-white border-slate-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Machine down since</label>
            <input type="datetime-local" value={downSince}
              onChange={e => setDownSince(e.target.value)}
              className="input-field text-xs bg-white border-slate-200" />
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              When the machine actually went down (may be before work started). Optional — leave blank if not down.
            </p>
          </div>
          <div className="flex gap-2.5 pt-1.5 flex-col xs:flex-row">
            <button onClick={confirmStartWork} disabled={loading}
              className="btn-primary text-xs font-bold py-2 px-4 shadow-sm shadow-blue-50 flex-1">
              {loading ? 'Starting...' : 'Confirm start'}
            </button>
            <button onClick={() => setShowStartWork(false)}
              className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tech completion form — submits for approval */}
      {showComplete && (
        <div className="space-y-3 p-4 bg-blue-50/35 rounded-xl border border-blue-100 shadow-inner-light">
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Submit for approval</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Labor hours</label>
              <input type="number" min="0" step="0.5" value={laborHours}
                onChange={e => setLaborHours(e.target.value)}
                placeholder="0.0" className="input-field text-xs bg-white border-slate-200" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Labor cost ($)</label>
              <input type="number" min="0" step="0.01" value={laborCost}
                onChange={e => setLaborCost(e.target.value)}
                placeholder="0.00" className="input-field text-xs bg-white border-slate-200" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">When did you finish?</label>
            <input type="datetime-local" value={requestedTime}
              onChange={e => setRequestedTime(e.target.value)}
              className="input-field text-xs bg-white border-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Machine down since</label>
              <input type="datetime-local" value={downSince}
                onChange={e => setDownSince(e.target.value)}
                className="input-field text-xs bg-white border-slate-200" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Back up at</label>
              <input type="datetime-local" value={backUpAt}
                onChange={e => setBackUpAt(e.target.value)}
                className="input-field text-xs bg-white border-slate-200" />
            </div>
          </div>
          {downSince && backUpAt && (() => {
            const ms = new Date(backUpAt).getTime() - new Date(downSince).getTime()
            const lost = ms > 0 ? (ms / 3600000).toFixed(2) : null
            return lost !== null && (
              <p className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
                Estimated lost hours: {lost} {lost === '1.00' ? 'hour' : 'hours'}
                {ms <= 0 && ' — back-up time must be after down time'}
              </p>
            )
          })()}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Notes for approver (optional)</label>
            <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)}
              placeholder="Any notes for the manager reviewing this..."
              className="input-field text-xs bg-white border-slate-200 resize-none w-full" rows={2} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Completion Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What actions were taken to resolve this?"
              className="input-field text-xs bg-white border-slate-200 resize-none w-full" rows={2} />
          </div>
          <div className="flex gap-2.5 pt-1.5 flex-col xs:flex-row">
            <button onClick={handleSubmitForApproval} disabled={loading}
              className="btn-primary text-xs font-bold py-2 px-4 shadow-sm shadow-blue-50 flex-1">
              {loading ? 'Submitting...' : 'Submit for approval'}
            </button>
            <button onClick={() => { setShowComplete(false); setFaceVerificationSucceeded(false) }}
              className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transition buttons */}
      {!showComplete && !showStartWork && (
        <div className="flex flex-col gap-2">
          {available.map(t => (
            <button key={t.value} onClick={() => doTransition(t.value)} disabled={loading}
              className={`w-full py-2.5 px-4 rounded-xl text-xs transition-all tracking-wide disabled:opacity-50 cursor-pointer ${t.color}`}>
              {loading ? 'Updating...' : t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
