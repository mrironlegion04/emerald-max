'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  scheduleId: string
  assetName: string
  scheduleName: string
  canGenerate: boolean
  isOverdue: boolean
}

export default function PMGenerateButton({ scheduleId, assetName, scheduleName, canGenerate, isOverdue }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  async function generate() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res  = await fetch(`/api/pm/${scheduleId}/generate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to generate'); return }
      setSuccess(`Work order ${data.woNumber} created!`)
      router.refresh()
    } catch { setError('Network error') }
    finally  { setLoading(false) }
  }

  if (!canGenerate) {
    return (
      <div className="text-sm text-gray-400 text-center py-2">
        Not due yet — next generation available on due date
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error   && <p className="text-xs text-red-600">{error}</p>}
      {success && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-green-700 font-medium">
          {success}
        </div>
      )}
      <button
        onClick={generate}
        disabled={loading}
        className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          isOverdue
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? 'Generating...' : isOverdue ? 'Generate overdue WO now' : 'Generate work order'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Creates a preventive WO for {assetName}
      </p>
    </div>
  )
}
