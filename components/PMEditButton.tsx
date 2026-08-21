'use client'

import Link from 'next/link'
import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  scheduleId: string
  canEditSchedule: boolean
}

export default function PMEditButton({ scheduleId, canEditSchedule }: Props) {
  const [showModal, setShowModal] = useState(false)

  if (canEditSchedule) {
    return (
      <Link href={`/preventive-maintenance/${scheduleId}/edit`} className="btn-secondary text-sm">
        Edit schedule
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="btn-secondary text-sm opacity-60 cursor-pointer"
      >
        Edit schedule
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Cannot edit this schedule</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This schedule includes assets from multiple plants. Editing is restricted to users with access to all of those plants.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full btn-primary text-sm py-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
