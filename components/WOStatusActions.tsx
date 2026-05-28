'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import FaceVerificationModal from './FaceVerificationModal'

interface Props {
  woId: string
  currentStatus: string
  userRole: string
  userId: string
}

// Valid transitions from each status
const transitions: Record<string, { value: string; label: string; color: string }[]> = {
  OPEN: [
    { value: 'IN_PROGRESS', label: 'Start work',   color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md font-bold' },
    { value: 'CANCELLED',   label: 'Cancel WO',    color: 'bg-slate-100 hover:bg-slate-205 text-slate-700 border border-slate-200/50 font-semibold' },
  ],
  IN_PROGRESS: [
    { value: 'COMPLETED',   label: 'Mark complete', color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-md font-bold' },
    { value: 'ON_HOLD',     label: 'Put on hold',   color: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 shadow-md font-bold' },
  ],
  ON_HOLD: [
    { value: 'IN_PROGRESS', label: 'Resume work',   color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 shadow-md font-bold' },
    { value: 'CANCELLED',   label: 'Cancel WO',     color: 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 font-semibold' },
  ],
  COMPLETED:  [],
  CANCELLED:  [
    { value: 'OPEN',        label: 'Re-open WO',    color: 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 font-semibold' },
  ],
}

export default function WOStatusActions({ woId, currentStatus, userRole, userId }: Props) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [notes, setNotes]       = useState('')
  const [laborHours, setLaborHours] = useState('')
  const [laborCost, setLaborCost]   = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [showFaceVerification, setShowFaceVerification] = useState(false)
  const [hasFaceVerification, setHasFaceVerification] = useState(false)
  const [faceVerificationSucceeded, setFaceVerificationSucceeded] = useState(false)

  const available = transitions[currentStatus] ?? []

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
    // If completing, just show the completion form (no pre-verification)
    if (newStatus === 'COMPLETED') {
      setShowComplete(true)
      return
    }

    // For other transitions, proceed directly
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

  const handleConfirmCompletion = async () => {
    // Check if user has face verification enrolled
    const hasFace = await checkFaceVerification()
    
    if (hasFace) {
      // Show face verification modal before final submission
      setShowFaceVerification(true)
      setFaceVerificationSucceeded(false)
    } else {
      // No face verification enrolled, complete directly
      completeWorkOrder()
    }
  }

  const completeWorkOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          notes: notes || undefined,
          laborHours: laborHours ? parseFloat(laborHours) : undefined,
          laborCost:  laborCost  ? parseFloat(laborCost)  : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      router.refresh()
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

  if (available.length === 0 && currentStatus === 'COMPLETED') {
    return (
      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 border border-emerald-150 px-4 py-3 rounded-xl text-xs font-bold shadow-xs">
        <CheckCircle className="w-4 h-4 text-emerald-500" />
        Work Order Completed Successfully
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
              // After verification succeeds, complete the work order
              completeWorkOrder()
            }
          }}
          requiredSimilarity={60}
        />
      )}

      {/* Completion form */}
      {showComplete && (
        <div className="space-y-3 p-4 bg-emerald-50/35 rounded-xl border border-emerald-100 shadow-inner-light">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Complete this work order</p>
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
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Completion Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What actions were taken to resolve this?"
              className="input-field text-xs bg-white border-slate-200 resize-none w-full" rows={2} />
          </div>
          <div className="flex gap-2.5 pt-1.5 flex-col xs:flex-row">
            <button onClick={handleConfirmCompletion} disabled={loading}
              className="btn-primary text-xs font-bold py-2 px-4 shadow-sm shadow-blue-50 flex-1">
              {loading ? 'Completing...' : 'Confirm complete'}
            </button>
            <button onClick={() => {
              setShowComplete(false)
              setFaceVerificationSucceeded(false)
            }} className="btn-secondary text-xs font-bold py-2 px-4 border-slate-200 flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transition buttons */}
      {!showComplete && (
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
