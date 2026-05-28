'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Badge from '@/components/Badge'
import { Search } from 'lucide-react'

interface LogEntry {
  id: string; action: string; entity: string; entityName: string
  userName: string | null; userEmail: string | null; changes: string | null; createdAt: string
}

const ACTION_VARIANTS: Record<string, 'green'|'blue'|'red'|'yellow'|'gray'> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  STATUS_CHANGE: 'yellow', LOGIN: 'gray',
}

const ENTITIES = ['','Asset','WorkOrder','Part','User','MaintenanceSchedule','Location','Request','ChecklistTemplate','Team']
const ACTIONS  = ['','CREATE','UPDATE','DELETE','STATUS_CHANGE','LOGIN']

function fmt(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit',
  }).format(new Date(date))
}

function formatChanges(raw: string | null): string | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    return Object.entries(obj)
      .map(([k, v]: [string, unknown]) => {
        const { before, after } = v as { before: unknown; after: unknown }
        return `${k}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`
      })
      .join('\n')
  } catch { return raw }
}

export default function AuditLogTable() {
  const [logs,    setLogs]    = useState<LogEntry[]>([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)
  const [entity,  setEntity]  = useState('')
  const [action,  setAction]  = useState('')
  const [search,  setSearch]  = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (entity) params.set('entity', entity)
      if (action) params.set('action', action)
      if (search) params.set('search', search)
      const res  = await fetch(`/api/audit?${params}`)
      const data = await res.json()
      if (res.ok) { setLogs(data.logs); setTotal(data.total); setPages(data.pages) }
    } finally { setLoading(false) }
  }, [page, entity, action, search])

  useEffect(() => { load() }, [load])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [entity, action, search])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or user..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm" />
        </div>
        <select value={entity} onChange={e => setEntity(e.target.value)} className="input-field w-auto text-sm">
          <option value="">All entities</option>
          {ENTITIES.slice(1).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="input-field w-auto text-sm">
          <option value="">All actions</option>
          {ACTIONS.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(entity || action || search) && (
          <button onClick={() => { setEntity(''); setAction(''); setSearch('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100">
            Clear
          </button>
        )}
        <span className="text-sm text-gray-400 self-center ml-auto">{total} events</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No audit events found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">When</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Record</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">User</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const changes = formatChanges(log.changes)
                  const isExpanded = expanded === log.id
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge label={log.action} variant={ACTION_VARIANTS[log.action] ?? 'gray'} />
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{log.entity}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{log.entityName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-700">{log.userName ?? '—'}</p>
                          {log.userEmail && <p className="text-xs text-gray-400">{log.userEmail}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {changes && (
                            <button onClick={() => setExpanded(isExpanded ? null : log.id)}
                              className="text-xs text-blue-600 hover:underline">
                              {isExpanded ? 'Hide' : 'Changes'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && changes && (
                        <tr className="bg-blue-50">
                          <td colSpan={6} className="px-4 py-3">
                            <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap">{changes}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}