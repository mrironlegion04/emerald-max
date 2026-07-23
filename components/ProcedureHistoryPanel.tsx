'use client'

import { useState, useEffect } from 'react'
import { Clock, ChevronDown, ChevronRight, User } from 'lucide-react'

interface ProcedureVersion {
  id: string
  versionNumber: number
  snapshot: any
  editedById: string | null
  editedByName: string | null
  changeNote: string | null
  createdAt: string
}

interface Props {
  procedureId: string
}

export default function ProcedureHistoryPanel({ procedureId }: Props) {
  const [versions, setVersions] = useState<ProcedureVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/procedures/${procedureId}/history`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setVersions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [procedureId])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Loading version history...
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No version history yet. History is recorded each time this procedure is saved.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-semibold">
        {versions.length} version{versions.length !== 1 ? 's' : ''} recorded
      </p>

      {versions.map(v => {
        const isExpanded = expandedId === v.id
        const snap = v.snapshot as any

        return (
          <div key={v.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : v.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    v{v.versionNumber}
                  </span>
                  <span className="text-sm font-bold text-slate-800 truncate">
                    {snap?.name ?? 'Untitled'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  {v.editedByName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {v.editedByName}
                    </span>
                  )}
                  <span>{formatDate(v.createdAt)}</span>
                  {snap?.steps && (
                    <span className="text-slate-400">· {snap.steps.length} steps</span>
                  )}
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</span>
                    <p className="text-slate-700 font-semibold mt-0.5">{snap?.name ?? '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Team</span>
                    <p className="text-slate-700 font-semibold mt-0.5">{snap?.teamId ? 'Assigned' : 'None'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Steps</span>
                    <p className="text-slate-700 font-semibold mt-0.5">{snap?.steps?.length ?? 0} fields</p>
                  </div>
                </div>

                {snap?.steps && snap.steps.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Steps Snapshot</span>
                    <div className="space-y-1">
                      {snap.steps.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                          <span className="text-slate-400 w-5 text-right">{idx + 1}.</span>
                          <span className="font-semibold text-slate-700">{step.label}</span>
                          <span className="text-slate-400 bg-white px-1.5 py-0.5 rounded text-[9px] font-mono">{step.type}</span>
                          {step.isMandatory && <span className="text-amber-600 font-bold">Required</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
