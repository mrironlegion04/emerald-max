'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  scheduleId: string
}

export default function PMCopyButton({ scheduleId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCopy() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pm/${scheduleId}/duplicate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        router.push(`/preventive-maintenance/${data.id}/edit`)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className="btn-secondary text-sm"
    >
      {loading ? 'Copying...' : 'Copy plan'}
    </button>
  )
}
