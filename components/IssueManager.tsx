'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Tag, Search, Globe, Eye, EyeOff } from 'lucide-react'

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

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH:     'bg-orange-100 text-orange-800',
  MEDIUM:   'bg-yellow-100 text-yellow-800',
  LOW:      'bg-blue-100 text-blue-800',
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

  function openAdd() { setEditingId(null); setFormCode(generateNextCode()); setFormTitle(''); setFormDomainIds([]); setFormSeverity('MEDIUM'); setFormIsGlobal(false); setError(''); setShowForm(true) }
  function openEdit(i: Issue) { setEditingId(i.id); setFormCode(i.code); setFormTitle(i.title); setFormDomainIds(i.domains.map(d => d.domain.id)); setFormSeverity(i.severity ?? 'MEDIUM'); setFormIsGlobal(i.isGlobal ?? false); setError(''); setShowForm(true) }
  function cancel() { setShowForm(false); setEditingId(null); setFormCode(''); setFormTitle(''); setFormDomainIds([]); setFormSeverity('MEDIUM'); setFormIsGlobal(false); setError('') }
  function toggleDomain(id: string) { setFormDomainIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formDomainIds.length === 0 && !formIsGlobal) { setError('Select at least one domain'); return }
    setLoading(true); setError('')
    try {
      const isEdit = !!editingId
      const res = await fetch(isEdit ? `/api/issues/${editingId}` : '/api/issues', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formCode.trim(), title: formTitle.trim(), domainIds: formDomainIds, severity: formSeverity, isGlobal: formIsGlobal }),
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
      setDeleteErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed' }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={filterDomainId} onChange={e => setFilterDomainId(e.target.value)} className="input-field text-sm w-44 flex-shrink-0">
          <option value="">All domains</option>
          <option value="__global__">🌐 Global only</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="text-sm text-gray-500 flex-shrink-0 flex items-center gap-1.5">
          <Tag className="w-4 h-4" />{issues.length} total
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />Add Issue
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Issue' : 'Add Issue'}</h3>
            <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
              <input type="text" value={formCode} onChange={e => setFormCode(e.target.value)} className="input-field font-mono" placeholder="e.g. HYD-001" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue title <span className="text-red-500">*</span></label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="input-field" placeholder="e.g. Oil leak at cylinder seal" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Domains <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {domains.map(d => (
                  <button key={d.id} type="button" onClick={() => !formIsGlobal && toggleDomain(d.id)}
                    disabled={formIsGlobal}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${formDomainIds.includes(d.id) ? 'bg-violet-600 border-violet-600 text-white' : formIsGlobal ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 hover:border-violet-400'}`}>
                    {d.name}
                  </button>
                ))}
                {domains.length === 0 && <p className="text-sm text-gray-400">No domains yet. Add domains first.</p>}
                {formIsGlobal && <p className="text-xs text-gray-400 mt-1">Global issues don&apos;t need domains</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select value={formSeverity} onChange={e => setFormSeverity(e.target.value)} className="input-field">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formIsGlobal} onChange={e => {
                  setFormIsGlobal(e.target.checked)
                  if (e.target.checked) setFormDomainIds([])
                }} className="w-4 h-4 rounded border-gray-300 text-violet-600" />
                <span className="text-sm text-gray-700">Global issue <span className="text-xs text-gray-400">(no domain needed — available as fallback)</span></span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />{loading ? 'Saving…' : editingId ? 'Save changes' : 'Add Issue'}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {filterLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">Filtering…</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search || filterDomainId ? 'No matching issues' : 'No issues yet'}</p>
          {(search || filterDomainId) && <button onClick={() => { setSearch(''); setFilterDomainId('') }} className="text-sm text-blue-600 hover:underline mt-1">Clear filters</button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {issues.map(issue => (
              <div key={issue.id}>
                <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group ${!issue.isActive ? 'opacity-50' : ''}`}>
                  <code className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0">{issue.code}</code>
                  <span className="flex-1 text-sm text-gray-900 truncate">{issue.title}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {issue.severity && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${severityColors[issue.severity] || 'bg-gray-100 text-gray-600'}`}>
                        {issue.severity}
                      </span>
                    )}
                    {issue.isGlobal && (
                      <span className="text-xs bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Globe className="w-3 h-3" />Global
                      </span>
                    )}
                    {!issue.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />Inactive
                      </span>
                    )}
                    {issue.domains.map(d => (
                      <span key={d.domain.id} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{d.domain.name}</span>
                    ))}
                  </div>
                {(issue._count?.workOrders ?? 0) > 0 && <span className="text-xs text-gray-400 flex-shrink-0">{issue._count!.workOrders} WO</span>}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(issue)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(issue.id, issue.title)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {deleteErrors[issue.id] && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /><span className="flex-1">{deleteErrors[issue.id]}</span>
                  <button onClick={() => setDeleteErrors(prev => ({ ...prev, [issue.id]: '' }))}><X className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
