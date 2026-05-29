'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Tag, Search, LayoutGrid } from 'lucide-react'

interface AssetType {
  id: string
  name: string
  _count?: { assets: number }
}

interface Props {
  initialTypes: AssetType[]
}

export default function AssetTypesManager({ initialTypes }: Props) {
  const [types, setTypes] = useState<AssetType[]>(initialTypes)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const filteredTypes = types.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditingId(null)
    setFormName('')
    setError('')
    setShowForm(true)
  }

  function openEdit(t: AssetType) {
    setEditingId(t.id)
    setFormName(t.name)
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setLoading(true)
    setError('')

    try {
      const isEdit = !!editingId
      const res = await fetch(isEdit ? `/api/asset-types/${editingId}` : '/api/asset-types', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      if (isEdit) {
        setTypes(prev => prev.map(t => t.id === editingId ? { ...t, name: data.name } : t))
      } else {
        setTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete asset classification type "${name}"?`)) return
    setDeleteErrors(prev => ({ ...prev, [id]: '' }))

    try {
      const res = await fetch(`/api/asset-types/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setTypes(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setDeleteErrors(prev => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to delete',
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Header controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search flat asset classifications…"
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
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50 flex-shrink-0">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>{types.length} asset types</span>
          </div>

          <button onClick={openAdd} className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Add Type</span>
          </button>
        </div>
      </div>      {/* Form Slide-over Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[100] flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={cancel} />
          
          <div className="relative w-full max-w-md bg-white h-screen shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">
                    {editingId ? 'Edit Classification Type' : 'Create Asset Type'}
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
                  <div className="flex gap-2.5 p-3.5 bg-red-55/7 px-4 rounded-xl border border-red-100 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Asset Classification Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="input-field font-semibold"
                    placeholder="e.g., Equipment, Vehicle, Smart Tool..."
                    required
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Keep the classification short and broad — this list operates horizontally without child structures.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 sm:pb-5 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex justify-end gap-3">
                <button type="button" onClick={cancel} className="btn-secondary py-2 px-4 shadow-sm text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary py-2 px-5 shadow-sm flex items-center gap-1.5 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List */}
      {types.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Tag className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-slate-700 font-bold text-base">No asset types registered</p>
          <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm mx-auto">Group assets broadly like "Vehicle" or "Heavy Machinery" to help filter analytical reports later.</p>
          <button onClick={openAdd} className="btn-primary font-semibold">
            <Plus className="w-4 h-4" /> Add Broad Classification
          </button>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 px-4 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-bold">No classification types found</p>
          <p className="text-slate-400 text-sm mt-1">Try adapting your search terms.</p>
          <button onClick={() => setSearch('')} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors">
            Reset classification searches
          </button>
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="divide-y divide-slate-100">
            {filteredTypes.map(t => (
              <div key={t.id} className="relative group">
                <div className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="font-bold text-sm text-slate-800 truncate leading-snug tracking-tight">{t.name}</span>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {(t._count?.assets ?? 0) > 0 ? (
                      <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2.5 py-0.5 rounded text-xs">
                        {t._count!.assets} asset{t._count!.assets !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-slate-50 text-slate-400 font-medium px-2.5 py-0.5 rounded text-xs border border-slate-200/20">
                        0 assets
                      </span>
                    )}

                    <div className="flex items-center gap-1 pl-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1 px-2 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-300/30 flex items-center gap-1 text-xs font-semibold"
                        title="Edit properties"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1 px-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-200/50 flex items-center gap-1 text-xs font-semibold"
                        title="Delete asset type"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {deleteErrors[t.id] && (
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100/50">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                    <span className="flex-1 font-medium">{deleteErrors[t.id]}</span>
                    <button onClick={() => setDeleteErrors(prev => ({ ...prev, [t.id]: '' }))} className="p-0.5 rounded text-red-400 hover:bg-red-105 hover:text-red-700">
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
