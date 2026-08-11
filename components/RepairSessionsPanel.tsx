'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Save } from 'lucide-react'

interface SessionUser { name: string }

interface RepairSession {
  id: string
  sessionNo: number
  startedAt: string | Date
  completedAt: string | Date | null
  durationMinutes: number | null
  startedBy?: SessionUser | null
  completedBy?: SessionUser | null
}

interface Props {
  woId: string
  sessions: RepairSession[]
  canEdit?: boolean
}

function toLocalDatetimeString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseRow(s: RepairSession) {
  return {
    id: s.id,
    sessionNo: s.sessionNo,
    startedAt: toLocalDatetimeString(new Date(s.startedAt)),
    completedAt: s.completedAt ? toLocalDatetimeString(new Date(s.completedAt)) : '',
    startedBy: s.startedBy,
    completedBy: s.completedBy,
  }
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function RepairSessionsPanel({ woId, sessions, canEdit = true }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(sessions.map(parseRow))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const update = (id: string, patch: Partial<{ startedAt: string; completedAt: string }>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
    setError('')
  }

  const durationOf = (r: { startedAt: string; completedAt: string }): { invalid: true } | { minutes: number } | null => {
    if (!r.completedAt || !r.startedAt) return null
    const ms = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
    if (ms <= 0) return { invalid: true }
    return { minutes: Math.floor(ms / 60000) }
  }

  const save = async (row: { id: string; startedAt: string; completedAt: string }) => {
    const dur = durationOf(row)
    if (dur && 'invalid' in dur) { setError('End time must be after start time'); return }
    setSavingId(row.id)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/repair-sessions/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startedAt: new Date(row.startedAt).toISOString(),
          completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, ...parseRow(data) } : r)))
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (row: { id: string; sessionNo: number; completedAt: string }) => {
    const isOpen = !row.completedAt
    const msg = isOpen
      ? `Delete the active session #${row.sessionNo}? The work order will be set back to OPEN. This cannot be undone.`
      : `Delete repair session #${row.sessionNo}? This cannot be undone.`
    if (!window.confirm(msg)) return
    setDeletingId(row.id)
    setError('')
    try {
      const res = await fetch(`/api/work-orders/${woId}/repair-sessions/${row.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to delete'); return }
      if (isOpen) {
        router.push(`/work-orders/${woId}`)
      } else {
        setRows(prev => prev
          .filter(r => r.id !== row.id)
          .map((r, i) => ({ ...r, sessionNo: i + 1 })))
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-bold">{error}</p>
      )}
      {rows.map(row => {
        const dur = durationOf(row)
        const dirty = row.startedAt !== parseRow(sessions.find(s => s.id === row.id)!).startedAt ||
          row.completedAt !== parseRow(sessions.find(s => s.id === row.id)!).completedAt
        return (
          <div key={row.id} className="flex flex-col gap-2 py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                #{row.sessionNo}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {row.startedBy?.name ? `Started by ${row.startedBy.name}` : 'Session'}
                {row.completedAt && row.completedBy?.name ? ` · by ${row.completedBy.name}` : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="datetime-local"
                value={row.startedAt}
                disabled={!canEdit}
                onChange={e => update(row.id, { startedAt: e.target.value })}
                className="input-field text-xs bg-white border-slate-200"
              />
              <span className="text-center text-slate-400 text-sm font-bold hidden sm:block">&rarr;</span>
              <input
                type="datetime-local"
                value={row.completedAt}
                disabled={!canEdit}
                onChange={e => update(row.id, { completedAt: e.target.value })}
                className="input-field text-xs bg-white border-slate-200"
              />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              {dur && 'invalid' in dur ? (
                <span className="text-[11px] font-bold text-rose-650">End must be after start</span>
              ) : dur ? (
                <span className="text-[11px] font-bold text-slate-500">
                  {fmtDuration(dur.minutes)} {dur.minutes === 1 ? 'min' : 'mins'}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-600">in progress</span>
              )}
              {canEdit && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => save(row)}
                    disabled={savingId === row.id || deletingId === row.id || !dirty}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition"
                  >
                    <Save className="w-3 h-3" />
                    {savingId === row.id ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => remove(row)}
                    disabled={savingId === row.id || deletingId === row.id}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 disabled:opacity-40 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deletingId === row.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
