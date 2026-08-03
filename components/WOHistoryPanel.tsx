'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, User, Users, UserCog, PlusCircle, Pencil, History, Loader2,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/utils'

interface ActivityEvent {
  id: string
  kind: 'status' | 'change'
  type: 'status' | 'assignment' | 'team' | 'crew' | 'create' | 'update'
  createdAt: string
  actor: string | null
  summary: string
  details: string[]
  notes: string | null
}
interface Payload {
  events: ActivityEvent[]; currentUserId: string | null
}

interface Props { woId: string }

const TYPE_STYLES: Record<ActivityEvent['type'], { icon: any; bubble: string; label: string }> = {
  status:     { icon: RefreshCw, bubble: 'bg-amber-100 text-amber-700 border-amber-200/50', label: 'Status' },
  assignment: { icon: User,       bubble: 'bg-blue-100 text-blue-700 border-blue-200/50',   label: 'Assignment' },
  team:       { icon: Users,      bubble: 'bg-purple-100 text-purple-700 border-purple-200/50', label: 'Team' },
  crew:       { icon: UserCog,    bubble: 'bg-green-100 text-green-700 border-green-200/50', label: 'Crew' },
  create:     { icon: PlusCircle, bubble: 'bg-emerald-100 text-emerald-700 border-emerald-200/50', label: 'Created' },
  update:     { icon: Pencil,     bubble: 'bg-slate-100 text-slate-600 border-slate-200/50', label: 'Updated' },
}

export default function WOHistoryPanel({ woId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${woId}/activity`)
      const data = await res.json()
      if (res.ok) setEvents(data.events ?? [])
    } finally {
      setLoading(false)
    }
  }, [woId])

  useEffect(() => { load() }, [load])

  // Real-time via SSE
  useEffect(() => {
    const es = new EventSource(`/api/work-orders/${woId}/activity/stream`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.events) setEvents(data.events)
      } catch { /* ignore malformed frames */ }
    }
    es.onerror = () => { /* EventSource auto-reconnects */ }
    return () => es.close()
  }, [woId])

  return (
    <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h2 className="font-bold text-slate-805 text-sm tracking-tight flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-slate-400" />
          Activity / History
          <span className="text-xs bg-slate-100/80 text-slate-500 font-bold px-2 py-0.5 rounded-full">
            {events.length}
          </span>
        </h2>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
          System changes &amp; audit trail
        </span>
      </div>

      <div className="max-h-[24rem] overflow-y-auto">
        {loading && (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading activity...
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400 font-medium">
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
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    )}
                    <div className="relative flex space-x-3">
                      <div className="flex-shrink-0">
                        <span className={`h-8 w-8 rounded-full border flex items-center justify-center text-slate-500 ${style.bubble}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-700 font-semibold leading-snug">
                              {ev.summary}
                              {ev.actor && (
                                <span className="font-normal text-slate-500"> by <span className="font-bold text-blue-600">{ev.actor}</span></span>
                              )}
                            </p>
                            {ev.details.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {ev.details.map((d, i) => (
                                  <li key={i} className="text-[11px] text-slate-500 leading-relaxed">{d}</li>
                                ))}
                              </ul>
                            )}
                            {ev.notes && (
                              <p className="text-[11px] text-slate-500 italic leading-relaxed mt-0.5">&ldquo;{ev.notes}&rdquo;</p>
                            )}
                          </div>
                          <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-bold font-mono flex-shrink-0 pt-0.5">
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
