'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { scheduleId: string; isActive: boolean }

export default function PMToggleButton({ scheduleId, isActive }: Props) {
  const router = useRouter()
  const [active,  setActive]  = useState(isActive)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function toggle() {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/pm/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !active }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setActive(!active)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={toggle}
        disabled={loading}
        className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          active
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {loading ? 'Saving...' : active ? 'Deactivate schedule' : 'Activate schedule'}
      </button>
    </div>
  )
}
