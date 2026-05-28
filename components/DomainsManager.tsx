'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Layers, Search } from 'lucide-react'

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
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search domains…"
            className="input-field pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-shrink-0">
          <Layers className="w-4 h-4" />
          <span>{domains.length} total</span>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Domain' : 'Add Domain'}</h3>
            <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="input-field"
              placeholder="e.g. Hydraulic, Electrical, Mechanical"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="input-field resize-none"
              rows={2}
              placeholder="e.g. Electrical systems, panels, and components"
            />
          </div>
          {editingId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add Domain'}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {domains.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No domains yet</p>
          <p className="text-gray-400 text-sm mt-1">Add domains like Hydraulic, Electrical, Mechanical.</p>
        </div>
      ) : filteredDomains.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No domains match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-1">
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filteredDomains.map(d => (
                <div key={d.id}>
              <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group ${!d.isActive ? 'opacity-50' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  {d.description && <p className="text-xs text-gray-400 truncate">{d.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {(d._count?.issues ?? 0) > 0 && (
                    <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                      {d._count!.issues} issue{d._count!.issues !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(d)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id, d.name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {deleteErrors[d.id] && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{deleteErrors[d.id]}</span>
                  <button onClick={() => setDeleteErrors(prev => ({ ...prev, [d.id]: '' }))}>
                    <X className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
