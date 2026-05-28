'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  assetId: string
  assetName: string
}

export default function DeleteAssetButton({ assetId, assetName }: Props) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [forceOpen, setForceOpen] = useState(false)
  const [activeCount, setActiveCount] = useState(0)

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })

      if (res.status === 409) {
        const data = await res.json()
        if (data.requiresForce) {
          setActiveCount(data.activeWorkOrders)
          setForceOpen(true)
          setDeleting(false)
          return
        }
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Archive failed')
        setDeleting(false)
        return
      }
      router.push('/assets')
      router.refresh()
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  async function handleForceArchive() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/assets/${assetId}?force=true`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Archive failed')
        setDeleting(false)
        return
      }
      router.push('/assets')
      router.refresh()
    } catch {
      setError('Network error')
      setDeleting(false)
    }
  }

  if (forceOpen) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700 font-medium">Archive "{assetName}"?</p>
        <p className="text-xs text-gray-600">
          This asset has {activeCount} active work order{activeCount !== 1 ? 's' : ''}.
          Archiving will preserve the assignments, but the asset will no longer appear as an active option.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleForceArchive}
            disabled={deleting}
            className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? 'Archiving...' : 'Yes, archive anyway'}
          </button>
          <button onClick={() => { setForceOpen(false); setConfirm(false) }} className="btn-secondary text-sm py-1.5">Cancel</button>
        </div>
      </div>
    )
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-sm text-red-600 hover:text-red-700 font-medium"
      >
        Archive this asset
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-red-700 font-medium">
        Archive "{assetName}"? It will be hidden from active views, but all
        work orders and historical data will be preserved.
      </p>
      <p className="text-xs text-gray-500">
        You can restore it later from the asset list by enabling "Show deleted".
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Archiving...' : 'Yes, archive'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="btn-secondary text-sm py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
