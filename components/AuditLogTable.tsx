'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Badge from '@/components/Badge'
import { Search, Filter } from 'lucide-react'
import FilterDrawer from './FilterDrawer'

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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
      {/* 1. Desktop Filters (hidden md:flex) */}
      <div className="hidden md:flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm group">
          <input type="text" placeholder="Search by name or user..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 text-sm" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <select value={entity} onChange={e => setEntity(e.target.value)} className="input-field w-auto text-sm bg-white">
          <option value="">All entities</option>
          {ENTITIES.slice(1).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="input-field w-auto text-sm bg-white">
          <option value="">All actions</option>
          {ACTIONS.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(entity || action || search) && (
          <button onClick={() => { setEntity(''); setAction(''); setSearch('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            Clear
          </button>
        )}
        <span className="text-sm text-gray-400 self-center ml-auto">{total} events</span>
      </div>

      {/* 2. Mobile/Tablet Filters (flex md:hidden) */}
      <div className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2.5 items-center w-full">
          <div className="relative flex-1 group">
            <input type="text" placeholder="Search by name or user..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-10 text-sm w-full bg-white shadow-3xs" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 shadow-3xs focus:outline-none ${
              (entity || action) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-650'
            }`}
          >
            <Filter className="w-5 h-5" />
            {(entity || action) && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-white text-blue-700 rounded-full">
                {(entity ? 1 : 0) + (action ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
          <span>{total} events</span>
          {(entity || action || search) && (
            <button onClick={() => { setEntity(''); setAction(''); setSearch('') }}
              className="text-blue-600 font-semibold cursor-pointer">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* 3. Filter Drawer for Mobile/Tablet */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Audit Log Filters"
        activeCount={(entity ? 1 : 0) + (action ? 1 : 0)}
        onClear={() => { setEntity(''); setAction('') }}
      >
        <div className="space-y-4 font-sans text-sm">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Entity Type</label>
            <select
              value={entity}
              onChange={e => setEntity(e.target.value)}
              className="input-field w-full text-sm bg-white"
            >
              <option value="">All entities</option>
              {ENTITIES.slice(1).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Action Type</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="input-field w-full text-sm bg-white"
            >
              <option value="">All actions</option>
              {ACTIONS.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </FilterDrawer>

      {/* Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 font-medium">Loading activity logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 font-medium">No audit events found</div>
        ) : (
          <>
            {/* Mobile/Tablet Card View (md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {logs.map(log => {
                const changes = formatChanges(log.changes)
                const isExpanded = expanded === log.id
                return (
                  <div key={log.id} className="p-4.5 space-y-3 hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400 font-medium">{fmt(log.createdAt)}</span>
                      <Badge label={log.action} variant={ACTION_VARIANTS[log.action] ?? 'gray'} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{log.entity}</span>
                        <span className="text-slate-350">•</span>
                        <span className="text-sm font-semibold text-slate-900">{log.entityName}</span>
                      </div>
                      <div className="flex flex-col text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{log.userName ?? 'System'}</span>
                        {log.userEmail && <span className="text-slate-400 font-medium">{log.userEmail}</span>}
                      </div>
                    </div>
                    {changes && (
                      <div>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : log.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold active:scale-95 transition-all"
                        >
                          {isExpanded ? 'Hide Changes' : 'Show Changes'}
                          <span>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 overflow-hidden">
                            <pre className="text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{changes}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">When</th>
                    <th className="text-left px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">Action</th>
                    <th className="text-left px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">Entity</th>
                    <th className="text-left px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">Record</th>
                    <th className="text-left px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">User</th>
                    <th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => {
                    const changes = formatChanges(log.changes)
                    const isExpanded = expanded === log.id
                    return (
                      <Fragment key={log.id}>
                        <tr className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">{fmt(log.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <Badge label={log.action} variant={ACTION_VARIANTS[log.action] ?? 'gray'} />
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">{log.entity}</td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-900">{log.entityName}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-semibold text-slate-700">{log.userName ?? '—'}</p>
                            {log.userEmail && <p className="text-xs text-slate-400 font-medium">{log.userEmail}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {changes && (
                              <button onClick={() => setExpanded(isExpanded ? null : log.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer">
                                {isExpanded ? 'Hide details' : 'View changes'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && changes && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-5 py-4.5 border-t border-b border-dashed border-slate-200">
                              <div className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-3xs max-w-3xl">
                                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Audit Log Diffs</h4>
                                <pre className="text-xs text-slate-650 font-mono whitespace-pre-wrap leading-relaxed">{changes}</pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
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