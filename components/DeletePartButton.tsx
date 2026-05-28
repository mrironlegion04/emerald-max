'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { partId: string; partName: string }

export default function DeletePartButton({ partId, partName }: Props) {
  const router = useRouter()
  const [confirm,   setConfirm]  = useState(false)
  const [deleting,  setDeleting] = useState(false)
  const [error,     setError]    = useState('')
  const [forceOpen, setForceOpen] = useState(false)
  const [activeCount, setActiveCount] = useState(0)

  async function handleDelete() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/inventory/${partId}`, { method: 'DELETE' })

      if (res.status === 409) {
        const data = await res.json()
        if (data.requiresForce) {
          setActiveCount(data.activeWorkOrders)
          setForceOpen(true)
          setDeleting(false)
          return
        }
      }

      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Archive failed'); return }
      router.push('/inventory')
      router.refresh()
    } catch { setError('Network error') }
    finally  { setDeleting(false) }
  }

  async function handleForceArchive() {
    setDeleting(true); setError('')
    try {
      const res = await fetch(`/api/inventory/${partId}?force=true`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Archive failed'); return }
      router.push('/inventory')
      router.refresh()
    } catch { setError('Network error') }
    finally { setDeleting(false) }
  }

  if (forceOpen) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700 font-medium">
          Archive "{partName}"?
        </p>
        <p className="text-xs text-gray-600">
          This part is used in {activeCount} active work order{activeCount !== 1 ? 's' : ''}.
          Archiving will preserve usage history but remove it from selection lists.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleForceArchive} disabled={deleting}
            className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50">
            {deleting ? 'Archiving...' : 'Yes, archive anyway'}
          </button>
          <button onClick={() => { setForceOpen(false); setConfirm(false) }} className="btn-secondary text-sm py-1.5">Cancel</button>
        </div>
      </div>
    )
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-sm text-red-600 hover:text-red-700 font-medium">
        Archive this part
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-red-700 font-medium">Archive "{partName}"? It will be hidden from active views.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleDelete} disabled={deleting}
          className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50">
          {deleting ? 'Archiving...' : 'Yes, archive'}
        </button>
        <button onClick={() => setConfirm(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </div>
  )
}
