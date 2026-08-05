'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, PowerOff, ChevronUp, ChevronDown } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface WOCategory {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
}

export default function WOCategoriesManager() {
  const [categories, setCategories] = useState<WOCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    try {
      const res = await fetch('/api/wo-categories')
      const data = await res.json()
      if (res.ok) setCategories(data)
      else setError(data.error ?? 'Failed to load categories')
    } finally { setLoading(false) }
  }

  async function createCategory() {
    setError('')
    if (!name.trim()) { setError('Category name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/wo-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sortOrder: categories.length }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save category'); return }
      setCategories(prev => [...prev, data].sort((a, b) => a.sortOrder - b.sortOrder))
      setShowForm(false)
      setName('')
    } finally { setSaving(false) }
  }

  async function updateCategory(id: string, patch: Partial<WOCategory>) {
    const res = await fetch(`/api/wo-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setCategories(prev => prev.map(c => (c.id === id ? data : c)))
    else setError(data.error ?? 'Failed to update category')
  }

  async function deleteCategory(id: string) {
    if (!window.confirm('Delete this work order category? Work orders using it will be left unclassified.')) return
    const res = await fetch(`/api/wo-categories/${id}`, { method: 'DELETE' })
    if (res.ok) setCategories(prev => prev.filter(c => c.id !== id))
  }

  function moveCategory(index: number, dir: -1 | 1) {
    const next = [...categories]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const current = next[index]
    const other = next[target]
    next[index] = { ...other, sortOrder: current.sortOrder }
    next[target] = { ...current, sortOrder: other.sortOrder }
    setCategories(next)
    updateCategory(current.id, { sortOrder: other.sortOrder })
    updateCategory(other.id, { sortOrder: current.sortOrder })
  }

  if (loading) {
    return <div className="p-6 max-w-3xl mx-auto text-sm text-slate-400 font-semibold">Loading work order categories…</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Work Order Categories"
        subtitle="Admin-defined classifications for work orders. Selected when creating a work order; the dropdown starts unselected."
      />

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold">{error}</div>
      )}

      <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white space-y-3">
        {categories.length === 0 && (
          <p className="text-sm text-slate-400 font-medium">No work order categories yet. Add one below.</p>
        )}
        {categories.map((c, index) => (
          <div key={c.id} className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveCategory(index, -1)}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveCategory(index, 1)}
                disabled={index === categories.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={c.name}
              onChange={e => updateCategory(c.id, { name: e.target.value })}
              onBlur={e => { if (!e.target.value.trim()) updateCategory(c.id, { name: 'Untitled' }) }}
              className={`input-field text-xs bg-white flex-1 min-w-0 ${!c.isActive ? 'text-slate-400' : ''}`}
            />
            {!c.isActive && <span className="text-[10px] text-slate-400 font-bold uppercase">Inactive</span>}
            <button
              type="button"
              onClick={() => updateCategory(c.id, { isActive: !c.isActive })}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition"
              title={c.isActive ? 'Deactivate' : 'Activate'}
            >
              {c.isActive ? <Power className="w-4 h-4 text-emerald-600" /> : <PowerOff className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(c.id)}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="premium-card p-5 border border-slate-200/50 shadow-sm bg-white mt-4 space-y-4">
          <h2 className="font-bold text-slate-700 text-sm tracking-tight">New category</h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createCategory() }}
              placeholder="e.g. Inspection"
              className="input-field text-xs bg-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={createCategory} disabled={saving} className="btn-primary text-xs font-bold py-2.5 px-5">
              {saving ? 'Saving...' : 'Save category'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setName('') }} className="btn-secondary text-xs font-bold py-2.5 px-5 border-slate-200/65 transition hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 inline-flex items-center gap-2 btn-primary text-xs font-bold py-2.5 px-5"
        >
          <Plus className="w-4 h-4" /> Add category
        </button>
      )}
    </div>
  )
}
