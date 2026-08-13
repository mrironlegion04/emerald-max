'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelRequesterRequestButton({ woId }: { woId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCancel() {
    if (!window.confirm('Cancel this request? Once cancelled, it cannot be restarted by you.')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', notes: 'Cancelled by requester' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to cancel request'); return }
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="btn-danger text-xs font-bold py-2 px-4"
      >
        {loading ? 'Cancelling...' : 'Cancel request'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
