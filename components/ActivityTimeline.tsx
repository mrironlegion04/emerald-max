'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlusCircle, Pencil, Trash2, RotateCcw, History, Loader2,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/utils'

interface ActivityEvent {
  id: string
  type: 'create' | 'update' | 'delete' | 'restore'
  createdAt: string
  actor: string | null
  summary: string
  details: string[]
  notes: string | null
}

interface Payload {
  events: ActivityEvent[]
}

interface Props {
  fetchUrl: string
}

const TYPE_STYLES: Record<ActivityEvent['type'], { icon: typeof PlusCircle; bubble: string }> = {
  create:  { icon: PlusCircle, bubble: 'bg-emerald-100 text-emerald-700 border-emerald-200/50' },
  update:  { icon: Pencil,     bubble: 'bg-slate-100 text-slate-600 border-slate-200/50' },
  delete:  { icon: Trash2,     bubble: 'bg-red-100 text-red-700 border-red-200/50' },
  restore: { icon: RotateCcw,  bubble: 'bg-emerald-100 text-emerald-700 border-emerald-200/50' },
}

export default function ActivityTimeline({ fetchUrl }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(fetchUrl)
      const data: Payload = await res.json()
      if (res.ok) setEvents(data.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [fetchUrl])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-gray-400" />
          Activity
          {events.length > 0 && (
            <span className="text-xs bg-gray-100/80 text-gray-500 font-bold px-2 py-0.5 rounded-full ml-1">
              {events.length}
            </span>
          )}
        </h2>
        <span className="text-[10px] text-gray-400 font-medium hidden sm:block">
          Audit trail
        </span>
      </div>

      <div className="max-h-[28rem] overflow-y-auto px-5 py-4">
        {loading && (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading activity...
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400 font-medium">
            No recorded activity yet.
          </div>
        )}

        <div className="flow-root">
          <ul className="-mb-6">
            {events.map((ev, idx) => {
              const style = TYPE_STYLES[ev.type]
              const Icon = style.icon
              const isLast = idx === events.length - 1
              return (
                <li key={ev.id}>
                  <div className="relative pb-6">
                    {!isLast && (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-100" aria-hidden="true" />
                    )}
                    <div className="relative flex space-x-3">
                      <div className="flex-shrink-0">
                        <span className={`h-8 w-8 rounded-full border flex items-center justify-center text-gray-500 ${style.bubble}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700 font-semibold leading-snug">
                              {ev.summary}
                              {ev.actor && (
                                <span className="font-normal text-gray-500"> by <span className="font-bold text-blue-600">{ev.actor}</span></span>
                              )}
                            </p>
                            {ev.details.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {ev.details.map((d, i) => (
                                  <li key={i} className="text-[11px] text-gray-500 leading-relaxed">{d}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="text-right text-[10px] whitespace-nowrap text-gray-400 font-bold font-mono flex-shrink-0 pt-0.5">
                            {fmtDateTime(ev.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
