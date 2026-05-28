'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  assetId: string
}

export default function RestoreAssetButton({ assetId }: Props) {
  const router = useRouter()
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState('')

  async function handleRestore() {
    setRestoring(true)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Restore failed')
        setRestoring(false)
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleRestore}
        disabled={restoring}
        className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {restoring ? 'Restoring...' : 'Restore asset'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}