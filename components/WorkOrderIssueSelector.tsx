'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, X, ChevronDown, Tag, PenLine, AlertTriangle, AlertCircle, CircleAlert } from 'lucide-react'

interface Issue { id: string; code: string; title: string; severity?: string }
interface DomainGroup { id: string; name: string; issues: Issue[]; isFallback?: boolean }

// Special sentinel — means user chose "Other (type manually)"
export const OTHER_ISSUE = '__other__'

interface Props {
  groups: DomainGroup[]
  value: string           // issueId OR '__other__'
  onChange: (id: string) => void
  placeholder?: string
}

export default function WorkOrderIssueSelector({
  groups,
  value,
  onChange,
  placeholder = 'Select Issue',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const allIssues = useMemo(() => groups.flatMap(g => g.issues), [groups])
  const selectedIssue = useMemo(
    () => value && value !== OTHER_ISSUE ? allIssues.find(i => i.id === value) : null,
    [allIssues, value]
  )

  const trimmed = search.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!trimmed) return []
    return allIssues.filter(i =>
      i.title.toLowerCase().includes(trimmed) || i.code.toLowerCase().includes(trimmed)
    )
  }, [allIssues, trimmed])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  function select(id: string) { onChange(id); setOpen(false); setSearch('') }
  function clear(e: React.MouseEvent) { e.stopPropagation(); onChange('') }

  // Trigger label
  function renderTriggerLabel() {
    if (value === OTHER_ISSUE) {
      return (
        <>
          <PenLine className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="flex-1 text-sm text-amber-700 font-medium">Other (type manually)</span>
          <button type="button" onClick={clear} className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )
    }
    if (selectedIssue) {
      return (
        <>
          <Tag className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
          <span className="flex-1 text-sm text-gray-900 truncate">{selectedIssue.title}</span>
          <code className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">{selectedIssue.code}</code>
          <button type="button" onClick={clear} className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )
    }
    return (
      <>
        <span className="flex-1 text-sm text-gray-400">{placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </>
    )
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`input-field flex items-center gap-2 text-left w-full ${open ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
      >
        {renderTriggerLabel()}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search issues…"
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
          </div>

          {/* Clear */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setSearch('') }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />No issue
          </button>

          <div className="max-h-72 overflow-y-auto">
            {trimmed ? (
              // ── Search mode: flat ──
              searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-gray-400">No results for &ldquo;{search}&rdquo;</p>
              ) : (
                <>
                  {searchResults.map(issue => (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => select(issue.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${value === issue.id ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <code className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">{issue.code}</code>
                      <span className="flex-1 truncate">{issue.title}</span>
                      {value === issue.id && <span className="text-violet-600 text-xs font-semibold">✓</span>}
                    </button>
                  ))}
                  <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 text-right">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                </>
              )
            ) : (
              // ── Grouped view ──
              <>
                {groups.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-400">No issues configured for this category.</p>
                ) : (
                  groups.map(group => (
                    <div key={group.id}>
                      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.name}</span>
                      </div>
                      {group.issues.length === 0 ? (
                        <p className="px-4 py-2 text-xs text-gray-400 italic">No issues in this domain</p>
                      ) : (
                        group.issues.map(issue => (
                          <button
                            key={issue.id}
                            type="button"
                            onClick={() => select(issue.id)}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${value === issue.id ? 'bg-violet-50 text-violet-700' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <code className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">{issue.code}</code>
                            <span className="flex-1 truncate">{issue.title}</span>
                            {value === issue.id && <span className="text-violet-600 text-xs font-semibold">✓</span>}
                          </button>
                        ))
                      )}
                    </div>
                  ))
                )}

                {/* Other option — always shown at the bottom */}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => select(OTHER_ISSUE)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${value === OTHER_ISSUE ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-amber-50 hover:text-amber-700'}`}
                  >
                    <PenLine className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1">Other (type manually)</span>
                    {value === OTHER_ISSUE && <span className="text-amber-600 text-xs font-semibold">✓</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
