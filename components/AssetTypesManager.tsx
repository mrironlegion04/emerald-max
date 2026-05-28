'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, X, Check, Tag, Search } from 'lucide-react'

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
    if (!confirm(`Delete asset type "${name}"?`)) return
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search asset types…"
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

        <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
          <Tag className="w-4 h-4" />
          <span>{types.length} total</span>
        </div>

        <button onClick={openAdd} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Add Type
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {editingId ? 'Edit Asset Type' : 'Add Asset Type'}
            </h3>
            <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="input-field"
              placeholder="e.g. Equipment, Vehicle, Tool, Facility"
              required
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Keep names short and distinct — this is a flat list, no sub-types.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add Type'}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {types.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No asset types yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add simple labels like "Equipment", "Vehicle", "Tool".
          </p>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No asset types match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-1">
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filteredTypes.map(t => (
            <div key={t.id}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-900">{t.name}</span>

                {(t._count?.assets ?? 0) > 0 && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {t._count!.assets} asset{t._count!.assets !== 1 ? 's' : ''}
                  </span>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {deleteErrors[t.id] && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{deleteErrors[t.id]}</span>
                  <button
                    onClick={() => setDeleteErrors(prev => ({ ...prev, [t.id]: '' }))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
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
