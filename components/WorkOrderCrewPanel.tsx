'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, Users, UserCheck, UserX } from 'lucide-react'

interface EligibleMember {
  userId: string
  name: string
  role: string
  isActive: boolean
  recorded: boolean
}

interface RecordedPerformer {
  id: string
  userId: string | null
  performerName: string
  teamName: string | null
  role: string | null
  addedByName: string
  createdAt: string
  isInTeam: boolean
  userActive: boolean | null
}

interface CrewData {
  team: { id: string; name: string } | null
  eligible: EligibleMember[]
  recorded: RecordedPerformer[]
}

interface Props {
  woId: string
  canEdit?: boolean
  onChanged?: () => void
}

const roleLabel: Record<string, string> = { LEAD: 'Lead', MEMBER: 'Member' }

export default function WorkOrderCrewPanel({ woId, canEdit = false, onChanged }: Props) {
  const [data, setData] = useState<CrewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch(`/api/work-orders/${woId}/crew`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load crew')
        return r.json()
      })
      .then((d: CrewData) => setData(d))
      .catch(() => setError('Failed to load crew'))
      .finally(() => setLoading(false))
  }, [woId])

  useEffect(() => { load() }, [load])

  async function toggle(userId: string) {
    if (!data || saving) return
    const checked = new Set(
      data.eligible.filter(m => m.recorded).map(m => m.userId)
    )
    if (checked.has(userId)) checked.delete(userId)
    else checked.add(userId)

    setSaving(true)
    try {
      const res = await fetch(`/api/work-orders/${woId}/crew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...checked] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update crew')
      }
      const updated: CrewData = await res.json()
      setData(updated)
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update crew')
    } finally {
      setSaving(false)
    }
  }

  const recordedCount = data?.recorded.length ?? 0

  return (
    <div className="premium-card p-4 border border-slate-200/50 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-700 text-xs tracking-tight flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          Worked by
          {recordedCount > 0 && (
            <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
              {recordedCount}
            </span>
          )}
        </h3>
        {data?.team && (
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
            👥 {data.team.name}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-rose-600 text-xs font-semibold py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {/* Recorded participants (history — always shown) */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Recorded participants
            </p>
            {data.recorded.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No participants recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.recorded.map(p => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{p.performerName}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {p.role ? roleLabel[p.role] ?? p.role : 'Member'}
                          {p.teamName ? ` · ${p.teamName}` : ''}
                          {p.addedByName ? ` · by ${p.addedByName}` : ''}
                        </p>
                      </div>
                    </div>
                    {!p.isInTeam && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                        <UserX className="w-2.5 h-2.5" />
                        left team
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tick UI — current team members only */}
          {canEdit && data.team && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Mark who worked
              </p>
              {data.eligible.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  The assigned team has no members.
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.eligible.map(m => (
                    <li key={m.userId}>
                      <label
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors select-none ${
                          m.recorded
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        } ${saving ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-emerald-600 rounded"
                          checked={m.recorded}
                          disabled={saving}
                          onChange={() => toggle(m.userId)}
                        />
                        <span className="text-xs font-bold text-slate-700 flex-1">{m.name}</span>
                        {m.role && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {roleLabel[m.role] ?? m.role}
                          </span>
                        )}
                        {!m.isActive && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                            inactive
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canEdit && !data.team && (
            <p className="text-xs text-slate-400 italic">
              Assign a team to this work order to record who worked.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
