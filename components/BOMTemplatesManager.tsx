'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, Wrench, X, Check, ClipboardCheck, ArrowLeft, Search } from 'lucide-react'

export default function BOMTemplatesManager({ initialTemplates, allParts }: any) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [managingId, setManagingId] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')

  // Part management state
  const [addingPart, setAddingPart] = useState(false)
  const [selPart, setSelPart] = useState('')
  const [qty, setQty] = useState('1')

  function openEdit(t: any) {
    setEditingId(t.id)
    setName(t.name)
    setDescription(t.description || '')
    setShowForm(true)
  }

  function openAdd() {
    setEditingId(null)
    setName('')
    setDescription('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const isEdit = !!editingId
      const res = await fetch(isEdit ? `/api/bom-templates/${editingId}` : '/api/bom-templates', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (res.ok) {
        const data = await res.json()
        if (isEdit) {
          setTemplates((prev: any[]) => prev.map((t: any) => t.id === editingId ? { ...t, name: data.name, description: data.description } : t))
        } else {
          setTemplates((prev: any[]) => [...prev, { ...data, parts: [], _count: { parts: 0 } }])
        }
        cancel()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(id: string, tName: string) {
    if (!confirm(`Are you sure you want to delete template "${tName}"?`)) return
    await fetch(`/api/bom-templates/${id}`, { method: 'DELETE' })
    setTemplates(templates.filter((t: any) => t.id !== id))
    router.refresh()
  }

  async function addPartToTemplate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/bom-templates/${managingId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selPart, expectedQuantity: parseInt(qty) })
      })
      if (res.ok) {
        const newPart = await res.json()
        setTemplates((prev: any[]) => prev.map((t: any) => 
          t.id === managingId 
            ? { ...t, parts: [...t.parts, newPart], _count: { parts: t._count.parts + 1 } }
            : t
        ))
        setAddingPart(false)
        setSelPart('')
        setQty('1')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function removePart(templateId: string, partId: string) {
    await fetch(`/api/bom-templates/${templateId}/parts/${partId}`, { method: 'DELETE' })
    setTemplates((prev: any[]) => prev.map((t: any) => 
      t.id === templateId 
        ? { ...t, parts: t.parts.filter((p: any) => p.partId !== partId), _count: { parts: t._count.parts - 1 } }
        : t
    ))
    router.refresh()
  }

  const activeTemplate = templates.find((t: any) => t.id === managingId)

  const filteredTemplates = templates.filter((t: any) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      {managingId && activeTemplate ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <button onClick={() => setManagingId(null)} className="text-sm text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to templates
          </button>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{activeTemplate.name}</h2>
              {activeTemplate.description && <p className="text-sm text-gray-500 mt-1">{activeTemplate.description}</p>}
            </div>
            <button onClick={() => setAddingPart(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Part
            </button>
          </div>

          {addingPart && (
            <form onSubmit={addPartToTemplate} className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-700 block mb-1">Part</label>
                <select value={selPart} onChange={e => setSelPart(e.target.value)} required className="input-field text-sm bg-white">
                  <option value="">Select a part...</option>
                  {allParts.filter((p: any) => !activeTemplate.parts.some((tp: any) => tp.partId === p.id)).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs font-medium text-gray-700 block mb-1">Qty</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} required className="input-field text-sm bg-white" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm">Add</button>
                <button type="button" onClick={() => setAddingPart(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          )}

          {activeTemplate.parts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg bg-gray-50">
              <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No parts added to this template yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {activeTemplate.parts.map((tp: any) => (
                <div key={tp.partId} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tp.part.name}</p>
                    <p className="text-xs text-gray-500">{tp.part.partNumber}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">Qty: {tp.expectedQuantity}</span>
                    <button onClick={() => removePart(activeTemplate.id, tp.partId)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-10 text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-shrink-0">
              <ClipboardCheck className="w-4 h-4" />
              <span>{templates.length} total</span>
            </div>

            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
              Add Template
            </button>
          </div>

          {searchQuery.trim() && (
            <p className="text-xs text-gray-400">
              Showing {filteredTemplates.length} result{filteredTemplates.length !== 1 ? 's' : ''} for &ldquo;{searchQuery.trim()}&rdquo;
            </p>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{editingId ? 'Edit BOM Template' : 'Add BOM Template'}</h3>
                <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="e.g. Standard HVAC Unit" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field" rows={2} placeholder="Brief description of when to use this template..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save template'}
                </button>
                <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          {templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No BOM templates yet</p>
              <p className="text-gray-400 text-sm mt-1">Create templates to quickly assign common parts to multiple assets.</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates match &ldquo;{searchQuery.trim()}&rdquo;</p>
              <button onClick={() => setSearchQuery('')} className="text-sm text-blue-600 hover:underline mt-1">
                Clear search
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {filteredTemplates.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500 truncate mt-0.5">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {t._count.parts} Parts
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                      onClick={() => setManagingId(t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      Manage Parts
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Edit template details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id, t.name)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
