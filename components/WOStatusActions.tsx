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
    { value: 'IN_PROGRESS', label: 'Start work',   color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { value: 'CANCELLED',   label: 'Cancel WO',    color: 'bg-gray-200 hover:bg-gray-300 text-gray-700' },
  ],
  IN_PROGRESS: [
    { value: 'COMPLETED',   label: 'Mark complete', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { value: 'ON_HOLD',     label: 'Put on hold',   color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  ],
  ON_HOLD: [
    { value: 'IN_PROGRESS', label: 'Resume work',   color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { value: 'CANCELLED',   label: 'Cancel WO',     color: 'bg-gray-200 hover:bg-gray-300 text-gray-700' },
  ],
  COMPLETED:  [],
  CANCELLED:  [
    { value: 'OPEN',        label: 'Re-open WO',    color: 'bg-gray-200 hover:bg-gray-300 text-gray-700' },
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
      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Work order completed
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

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
        <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs font-medium text-green-800">Complete this work order</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Labor hours</label>
              <input type="number" min="0" step="0.5" value={laborHours}
                onChange={e => setLaborHours(e.target.value)}
                placeholder="0.0" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Labor cost ($)</label>
              <input type="number" min="0" step="0.01" value={laborCost}
                onChange={e => setLaborCost(e.target.value)}
                placeholder="0.00" className="input-field text-sm" />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Completion notes (optional)..."
            className="input-field text-sm resize-none w-full" rows={2} />
          <div className="flex gap-2">
            <button onClick={handleConfirmCompletion} disabled={loading}
              className="btn-primary text-sm flex-1">
              {loading ? 'Completing...' : 'Confirm complete'}
            </button>
            <button onClick={() => {
              setShowComplete(false)
              setFaceVerificationSucceeded(false)
            }} className="btn-secondary text-sm">
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
              className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${t.color}`}>
              {loading ? 'Updating...' : t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
