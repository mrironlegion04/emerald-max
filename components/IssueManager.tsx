'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Tag, Search, Globe, EyeOff, LayoutGrid } from 'lucide-react'

interface Domain { id: string; name: string; description?: string | null }
interface Issue {
  id: string; code: string; title: string
  severity?: string
  isActive?: boolean
  isGlobal?: boolean
  sortOrder?: number
  domains: { domain: Domain }[]
  _count?: { workOrders: number }
}
interface Props { initialIssues: Issue[]; domains: Domain[] }

const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200/60',
  HIGH:     'bg-orange-55/7 text-orange-700 border-orange-200/50',
  MEDIUM:   'bg-blue-50 text-blue-700 border-blue-200/50',
  LOW:      'bg-slate-100 text-slate-700 border-slate-200/50',
}

export default function IssueManager({ initialIssues, domains }: Props) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [search, setSearch] = useState('')
  const [filterDomainId, setFilterDomainId] = useState('')
  const [filterLoading, setFilterLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDomainIds, setFormDomainIds] = useState<string[]>([])
  const [formSeverity, setFormSeverity] = useState('MEDIUM')
  const [formIsGlobal, setFormIsGlobal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  // Fetch from API when search or domain filter changes
  useEffect(() => {
    if (!search.trim() && !filterDomainId) {
      setIssues(initialIssues)
      return
    }
    setFilterLoading(true)
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (filterDomainId === '__global__') {
      params.set('isGlobal', 'true')
    } else if (filterDomainId) {
      params.set('domainId', filterDomainId)
    }
    fetch(`/api/issues?${params}`)
      .then(r => r.json())
      .then((data: Issue[]) => setIssues(data))
      .catch(() => {})
      .finally(() => setFilterLoading(false))
  }, [search, filterDomainId, initialIssues])

  function generateNextCode() {
    let maxNum = 0
    for (const issue of issues) {
      const match = issue.code.match(/^ISS-(\d+)$/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }
    const nextNum = maxNum > 0 ? maxNum + 1 : issues.length + 1
    return `ISS-${String(nextNum).padStart(3, '0')}`
  }

  function openAdd() { 
    setEditingId(null)
    setFormCode(generateNextCode())
    setFormTitle('')
    setFormDomainIds([])
    setFormSeverity('MEDIUM')
    setFormIsGlobal(false)
    setError('')
    setShowForm(true) 
  }
  
  function openEdit(i: Issue) { 
    setEditingId(i.id)
    setFormCode(i.code)
    setFormTitle(i.title)
    setFormDomainIds(i.domains.map(d => d.domain.id))
    setFormSeverity(i.severity ?? 'MEDIUM')
    setFormIsGlobal(i.isGlobal ?? false)
    setError('')
    setShowForm(true) 
  }
  
  function cancel() { 
    setShowForm(false)
    setEditingId(null)
    setFormCode('')
    setFormTitle('')
    setFormDomainIds([])
    setFormSeverity('MEDIUM')
    setFormIsGlobal(false)
    setError('') 
  }
  
  function toggleDomain(id: string) { 
    setFormDomainIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]) 
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formDomainIds.length === 0 && !formIsGlobal) { 
      setError('Select at least one domain or mark this issue as Global')
      return 
    }
    setLoading(true)
    setError('')
    try {
      const isEdit = !!editingId
      const res = await fetch(isEdit ? `/api/issues/${editingId}` : '/api/issues', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: formCode.trim(), 
          title: formTitle.trim(), 
          domainIds: formDomainIds, 
          severity: formSeverity, 
          isGlobal: formIsGlobal 
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setIssues(prev => isEdit ? prev.map(i => i.id === editingId ? data : i) : [...prev, data])
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setLoading(false) }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete issue "${title}"?`)) return
    try {
      const res = await fetch(`/api/issues/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setIssues(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setDeleteErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed to delete' }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Advanced Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search issues library by title or code…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters and Action Button */}
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterDomainId} 
            onChange={e => setFilterDomainId(e.target.value)} 
            className="input-field text-sm w-full sm:w-48 bg-white"
          >
            <option value="">All Domains</option>
            <option value="__global__">🌐 Global Issues Only</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>{issues.length} showing</span>
          </div>

          <button onClick={openAdd} className="btn-primary py-2 px-4 shadow-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            <span>Add Issue</span>
          </button>
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-blue-100/70 shadow-sm animate-in fade-in slide-in-from-top duration-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
              <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                {editingId ? 'Edit Configuration Issue' : 'Create New Troubleshooting Issue'}
              </h3>
              <button 
                type="button" 
                onClick={cancel} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-150 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="flex gap-2.5 p-3.5 bg-red-55/7 px-4 rounded-xl border border-red-100 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-550" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Code <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formCode} 
                  onChange={e => setFormCode(e.target.value)} 
                  className="input-field font-mono font-semibold" 
                  placeholder="e.g., HYD-001" 
                  required 
                  autoFocus 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Severity Level</label>
                <select 
                  value={formSeverity} 
                  onChange={e => setFormSeverity(e.target.value)} 
                  className="input-field bg-white"
                >
                  <option value="LOW">Low Status</option>
                  <option value="MEDIUM">Medium Status</option>
                  <option value="HIGH">High Status</option>
                  <option value="CRITICAL">Critical Status</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Issue Title <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formTitle} 
                  onChange={e => setFormTitle(e.target.value)} 
                  className="input-field" 
                  placeholder="e.g., Oil leakage around lower master cylinder valves" 
                  required 
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Applicable Maintenance Domains <span className="text-red-500">*</span></label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={formIsGlobal} 
                      onChange={e => {
                        setFormIsGlobal(e.target.checked)
                        if (e.target.checked) setFormDomainIds([])
                      }} 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" 
                    />
                    <span className="text-xs font-semibold text-slate-600">Mark as Global Issue <span className="font-normal text-slate-400">(no domains required)</span></span>
                  </label>
                </div>

                {!formIsGlobal ? (
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 max-h-40 overflow-y-auto">
                    {domains.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No domains configured. Register domains first under Domain Settings.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {domains.map(d => {
                          const active = formDomainIds.includes(d.id)
                          return (
                            <button 
                              key={d.id} 
                              type="button" 
                              onClick={() => toggleDomain(d.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                active 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-3xs' 
                                  : 'bg-white border-slate-250 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              {d.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-100/50 rounded-xl p-3.5 text-xs text-slate-500 flex items-center gap-2 border border-slate-200/50">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>Global issues represent un-scoped malfunctions and will bypass specific category restrictions.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" onClick={cancel} className="btn-secondary py-2 px-4 shadow-2xs">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary py-2 px-4 shadow-sm flex items-center gap-1.5 font-semibold">
                <Check className="w-4 h-4" />
                <span>{loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Issue'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Issues Listing */}
      {filterLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 px-4 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Querying fault libraries…</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-slate-700 font-bold text-base">{search || filterDomainId ? 'No matching issues on this filter' : 'Fault library is empty'}</p>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {search || filterDomainId 
              ? 'Try modifying your search query or setting the Domain filter to "All Domains".' 
              : 'Add general issues (like leaks, electrical short, structural crack) that technicians can reference instantly.'}
          </p>
          {(search || filterDomainId) && (
            <button onClick={() => { setSearch(''); setFilterDomainId('') }} className="btn-secondary py-1.5 px-3.5 text-xs font-bold mt-4 transition-all">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="divide-y divide-slate-100">
            {issues.map(issue => (
              <div key={issue.id} className="relative transition-colors duration-150">
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/70 ${!issue.isActive ? 'bg-slate-50/30' : ''} group`}>
                  
                  {/* Issue Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <code className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 flex-shrink-0 self-start mt-0.5 select-all">
                      {issue.code}
                    </code>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-800 tracking-tight leading-snug">{issue.title}</span>
                        {!issue.isActive && (
                          <span className="inline-flex items-center gap-1 bg-slate-150 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-250">
                            <EyeOff className="w-2.5 h-2.5" /> INACTIVE
                          </span>
                        )}
                        {issue.isGlobal && (
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-sky-100">
                            <Globe className="w-2.5 h-2.5 text-sky-500" /> GLOBAL
                          </span>
                        )}
                      </div>

                      {/* Display Associated Domains */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 md:mt-2">
                        {issue.severity && (
                          <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-bold tracking-wider uppercase rounded ${severityStyles[issue.severity] || 'bg-slate-150 text-slate-600 border-slate-200'}`}>
                            {issue.severity} Severity
                          </span>
                        )}

                        {issue.domains.map(d => (
                          <span key={d.domain.id} className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/60 font-sans">
                            {d.domain.name}
                          </span>
                        ))}

                        {issue.domains.length === 0 && !issue.isGlobal && (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 italic">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right hand stats & operations */}
                  <div className="flex items-center gap-4 self-end sm:self-auto flex-shrink-0">
                    {(issue._count?.workOrders ?? 0) > 0 ? (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/40">
                        {issue._count!.workOrders} active WO{issue._count!.workOrders !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium bg-slate-50/10 px-2.5 py-1 rounded-lg border border-slate-100 italic">
                        0 WOs
                      </span>
                    )}

                    {/* Actions Panel */}
                    <div className="flex items-center gap-1 pl-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => openEdit(issue)}
                        className="p-1 px-2 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300/30 flex items-center gap-1 text-xs font-semibold"
                        title="Edit properties"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(issue.id, issue.title)}
                        className="p-1 px-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-200/50 flex items-center gap-1 text-xs font-semibold"
                        title="Delete issue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Delete</span>
                      </button>
                    </div>
                  </div>

                </div>

                {deleteErrors[issue.id] && (
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100/50">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                    <span className="flex-1 font-medium">{deleteErrors[issue.id]}</span>
                    <button onClick={() => setDeleteErrors(prev => ({ ...prev, [issue.id]: '' }))} className="p-0.5 rounded text-red-400 hover:bg-red-100 hover:text-red-700">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
