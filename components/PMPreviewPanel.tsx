'use client'

import { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import Badge from '@/components/Badge'
import { utcDateOnly, fmtDateOnly } from '@/lib/date-format'

interface PreviewWO {
  dueDate: string
  title: string
  nestedLabel: string | null
  nestedLevel: number
}

interface Props {
  scheduleId: string
}

export default function PMPreviewPanel({ scheduleId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewWOs, setPreviewWOs] = useState<PreviewWO[]>([])
  const [error, setError] = useState('')

  async function loadPreview() {
    if (isOpen && previewWOs.length > 0) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pm/${scheduleId}/preview`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to load preview')
        return
      }
      const data = await res.json()
      setPreviewWOs(data)
      setIsOpen(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <button
        onClick={loadPreview}
        disabled={loading}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Preview upcoming WOs</h2>
        </div>
        {loading ? (
          <span className="text-xs text-gray-400">Loading...</span>
        ) : isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}

      {isOpen && previewWOs.length > 0 && (
        <div className="mt-4 space-y-2">
          {previewWOs.map((wo, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                <p className="text-xs text-gray-400">
                  Due {fmtDateOnly(utcDateOnly(wo.dueDate))}
                  {wo.nestedLabel && ` · ${wo.nestedLabel}`}
                </p>
              </div>
              {wo.nestedLevel > 0 && (
                <Badge label={`Tier ${wo.nestedLevel + 1}`} variant="purple" />
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && previewWOs.length === 0 && !error && (
        <p className="text-xs text-gray-400 mt-4">No upcoming WOs to preview.</p>
      )}
    </div>
  )
}
