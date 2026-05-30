'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function DeleteProcedureButton({ id, name, onSuccess }: { id: string; name: string; onSuccess?: () => void }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/procedures/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/settings/procedures')
        router.refresh()
      }
    }
    setDeleting(false)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-slate-500">Delete "{name}"?</span>
        <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-650 font-bold hover:underline">
          {deleting ? 'Deleting...' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-slate-400 font-bold hover:underline">No</button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors font-bold"
    >
      <Trash2 className="w-3 h-3" /> Delete
    </button>
  )
}
