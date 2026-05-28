'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'

interface Props { ids: string[] }

export default function PMGenerateAllButton({ ids }: Props) {
  const router = useRouter()
  const [loading,  setLoading]  = useState(false)
  const [results,  setResults]  = useState<{ created: number; errors: number } | null>(null)

  async function generateAll() {
    setLoading(true); setResults(null)
    let created = 0, errors = 0
    await Promise.all(
      ids.map(async id => {
        try {
          const res = await fetch(`/api/pm/${id}/generate`, { method: 'POST' })
          if (res.ok) created++; else errors++
        } catch { errors++ }
      })
    )
    setResults({ created, errors })
    setLoading(false)
    router.refresh()
  }

  if (results) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-600 font-medium">
          {results.created} WO{results.created !== 1 ? 's' : ''} created
          {results.errors > 0 ? `, ${results.errors} skipped` : ''}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={generateAll}
      disabled={loading}
      className="btn-secondary text-sm flex items-center gap-1.5"
    >
      <Zap className="w-4 h-4" />
      {loading ? 'Generating...' : `Generate all (${ids.length})`}
    </button>
  )
}
