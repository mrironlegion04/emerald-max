'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Layers, Search, EyeOff, LayoutGrid } from 'lucide-react'

interface Domain {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
  _count?: { issues: number; categories: number }
}

interface Props {
  initialDomains: Domain[]
}

export default function DomainsManager({ initialDomains }: Props) {
  const [domains, setDomains] = useState<Domain[]>(initialDomains)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  function openAdd() {
    setEditingId(null)
    setFormName('')
    setFormDescription('')
    setFormIsActive(true)
    setError('')
    setShowForm(true)
  }

  function openEdit(d: Domain) {
    setEditingId(d.id)
    setFormName(d.name)
    setFormDescription(d.description ?? '')
    setFormIsActive(d.isActive ?? true)
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormDescription('')
    setFormIsActive(true)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setLoading(true)
    setError('')
    try {
      const isEdit = !!editingId
      const res = await fetch(
        isEdit ? `/api/domains/${editingId}` : '/api/domains',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: formName.trim(), 
            description: formDescription.trim() || null,
            ...(isEdit ? { isActive: formIsActive } : {}),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      if (isEdit) {
        setDomains(prev => prev.map(d => d.id === editingId ? { ...d, name: data.name, description: data.description ?? null, isActive: data.isActive ?? true } : d))
      } else {
        setDomains(prev => [...prev, { ...data, description: data.description ?? null, isActive: data.isActive ?? true }])
      }
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete domain "${name}"?`)) return
    setDeleteErrors(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/domains/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setDomains(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      setDeleteErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed' }))
    }
  }

  const filteredDomains = domains.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search domains…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>{domains.length} absolute domains</span>
          </div>
          <button onClick={openAdd} className="btn-primary py-2 px-4 shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Add Domain</span>
          </button>
        </div>
      </div>

      {/* Form Slide-over Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={cancel} />
          
          <div className="relative w-full max-w-md bg-white h-screen shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">
                    {editingId ? 'Edit Maintenance Domain' : 'Create New Domain'}
                  </h3>
                </div>
                <button 
                  type="button" 
                  onClick={cancel} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {error && (
                  <div className="flex gap-2.5 p-3.5 bg-red-50/70 px-4 rounded-xl border border-red-100 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Domain Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Hydraulic, Electrical, HVAC"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <div className="flex items-center h-11 bg-white border border-slate-200 rounded-xl px-3.5">
                      <label className="flex items-center gap-2.5 cursor-pointer w-full select-none">
                        <input
                          type="checkbox"
                          checked={formIsActive}
                          onChange={e => setFormIsActive(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                        />
                        <span className="text-sm font-semibold text-slate-700">Domain is Active</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="input-field resize-none min-h-[100px]"
                      rows={3}
                      placeholder="Detailed scope or purpose of issues listed under this domain..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex justify-end gap-3">
                <button type="button" onClick={cancel} className="btn-secondary py-2 px-4 shadow-sm text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary py-2 px-5 shadow-sm flex items-center gap-1.5 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Domain'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List Display */}
      {domains.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-slate-700 font-bold text-base">No maintenance domains configured</p>
          <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm mx-auto">Create domains to categorize troubleshooting guides, checklist steps, and assets.</p>
          <button onClick={openAdd} className="btn-primary font-semibold">
            <Plus className="w-4 h-4" /> Add First Domain
          </button>
        </div>
      ) : filteredDomains.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 px-4 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No matching domains found</p>
          <p className="text-slate-400 text-sm mt-1">We couldn&apos;t find any domains matching &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-3 transition-colors">
            Reset filter query
          </button>
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="divide-y divide-slate-100">
            {filteredDomains.map(d => (
              <div key={d.id} className="relative transition-colors duration-150">
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/70 ${!d.isActive ? 'bg-slate-50/30' : ''} group`}>
                  
                  {/* Info Column */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-bold text-sm tracking-tight ${d.isActive ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{d.name}</span>
                        {!d.isActive && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full text-[10px] border border-slate-250">
                            <EyeOff className="w-2.5 h-2.5" /> INACTIVE
                          </span>
                        )}
                      </div>
                      {d.description ? (
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">{d.description}</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-0.5">No description added</p>
                      )}
                    </div>
                  </div>

                  {/* Badges / Metrics Column */}
                  <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      {(d._count?.issues ?? 0) > 0 ? (
                        <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold px-2.5 py-1 rounded-full text-xs">
                          {d._count!.issues} issue{d._count!.issues !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-slate-100 text-slate-400 font-medium px-2 py-1 rounded-full text-xs border border-slate-200/40">
                          0 issues
                        </span>
                      )}

                      {(d._count?.categories ?? 0) > 0 && (
                        <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 font-semibold px-2.5 py-1 rounded-full text-xs">
                          {d._count!.categories} cat{d._count!.categories !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center gap-1 pl-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1 px-2 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300/30 flex items-center gap-1 text-xs font-semibold"
                        title="Edit domain properties"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="sm:hidden md:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.name)}
                        className="p-1 px-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-200/50 flex items-center gap-1 text-xs font-semibold"
                        title="Delete domain"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sm:hidden md:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Local Delete Error banner */}
                {deleteErrors[d.id] && (
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100/50">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                    <span className="flex-1 font-medium">{deleteErrors[d.id]}</span>
                    <button onClick={() => setDeleteErrors(prev => ({ ...prev, [d.id]: '' }))} className="p-0.5 rounded text-red-400 hover:bg-red-100 hover:text-red-700">
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
