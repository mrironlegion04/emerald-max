'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, Wrench, X, Check, ClipboardCheck, ArrowLeft, Search, Layers } from 'lucide-react'

interface Part {
  id: string
  name: string
  partNumber?: string | null
}

interface TemplatePart {
  partId: string
  expectedQuantity: number
  part: Part
}

interface BOMTemplate {
  id: string
  name: string
  description?: string | null
  parts: TemplatePart[]
  _count: { parts: number }
}

interface Props {
  initialTemplates: BOMTemplate[]
  allParts: Part[]
}

export default function BOMTemplatesManager({ initialTemplates, allParts }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<BOMTemplate[]>(initialTemplates)
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

  function openEdit(t: BOMTemplate) {
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
          setTemplates((prev: BOMTemplate[]) => prev.map((t: BOMTemplate) => t.id === editingId ? { ...t, name: data.name, description: data.description } : t))
        } else {
          setTemplates((prev: BOMTemplate[]) => [...prev, { ...data, parts: [], _count: { parts: 0 } }])
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
    setTemplates(templates.filter((t: BOMTemplate) => t.id !== id))
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
        setTemplates((prev: BOMTemplate[]) => prev.map((t: BOMTemplate) => 
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
    setTemplates((prev: BOMTemplate[]) => prev.map((t: BOMTemplate) => 
      t.id === templateId 
        ? { ...t, parts: t.parts.filter((p: TemplatePart) => p.partId !== partId), _count: { parts: t._count.parts - 1 } }
        : t
    ))
    router.refresh()
  }

  const activeTemplate = templates.find((t: BOMTemplate) => t.id === managingId)

  const filteredTemplates = templates.filter((t: BOMTemplate) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {managingId && activeTemplate ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-6">
          {/* Back button link */}
          <button 
            onClick={() => setManagingId(null)} 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200/60 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 
            <span>Back to templates</span>
          </button>

          {/* Active Title and Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>{activeTemplate.name}</span>
              </h2>
              {activeTemplate.description ? (
                <p className="text-sm text-slate-500 mt-1 sm:mt-1.5 leading-relaxed">{activeTemplate.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic mt-1 sm:mt-1.5">No description specified for this BOM library template.</p>
              )}
            </div>
            <button 
              onClick={() => setAddingPart(true)} 
              className="btn-primary text-sm flex items-center gap-2 flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> 
              <span>Add Part to BOM</span>
            </button>
          </div>

          {/* Adding Part Form Drawer */}
          {addingPart && (
            <form 
              onSubmit={addPartToTemplate} 
              className="p-5 bg-blue-50/40 border border-blue-100/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-end gap-4 shadow-2xs animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex-1 min-w-0">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Select Catalog Part</label>
                <select 
                  value={selPart} 
                  onChange={e => setSelPart(e.target.value)} 
                  required 
                  className="input-field text-sm bg-white"
                >
                  <option value="">Choose matching part...</option>
                  {allParts.filter((p: Part) => !activeTemplate.parts.some((tp: TemplatePart) => tp.partId === p.id)).map((p: Part) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.partNumber ? `(${p.partNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-32">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Required Qty</label>
                <input 
                  type="number" 
                  min="1" 
                  value={qty} 
                  onChange={e => setQty(e.target.value)} 
                  required 
                  className="input-field text-sm bg-white" 
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="submit" disabled={saving || !selPart} className="btn-primary text-sm font-semibold whitespace-nowrap">
                  {saving ? 'Adding...' : 'Add to BOM'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setAddingPart(false)} 
                  className="btn-secondary text-sm font-semibold whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Associated Part Listings */}
          {activeTemplate.parts.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-slate-700 font-bold">No registered parts</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">Add the standard bill of material parts required for this asset template.</p>
              <button onClick={() => setAddingPart(true)} className="btn-primary text-xs py-2 px-3.5 shadow-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> Associate First Part
              </button>
            </div>
          ) : (
            <div className="responsive-table-container">
              <div className="divide-y divide-slate-150/60">
                {activeTemplate.parts.map((tp: TemplatePart) => (
                  <div key={tp.partId} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-50/60 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{tp.part.name}</p>
                      {tp.part.partNumber && (
                        <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">{tp.part.partNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-105/20 px-3 py-1 rounded-full">
                        Qty: {tp.expectedQuantity}
                      </span>
                      <button 
                        onClick={() => removePart(activeTemplate.id, tp.partId)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                        title="Remove part standard association"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Main List Mode */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder="Search BOM templates by name or classification description…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-10 text-sm"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50 flex-shrink-0">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>{templates.length} total libraries</span>
              </div>

              <button onClick={openAdd} className="btn-primary flex items-center justify-center gap-2 flex-shrink-0 flex-1 sm:flex-initial shadow-sm">
                <Plus className="w-4 h-4" />
                <span>Add Template</span>
              </button>
            </div>
          </div>

          {searchQuery.trim() && (
            <p className="text-xs text-slate-400">
              Showing {filteredTemplates.length} result{filteredTemplates.length !== 1 ? 's' : ''} matching &ldquo;{searchQuery.trim()}&rdquo;
            </p>
          )}

          {/* Form Slide-over Drawer */}
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
                        {editingId ? 'Edit BOM Template' : 'Create BOM Template'}
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
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Template Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          required 
                          className="input-field font-semibold" 
                          placeholder="e.g., Standard HVAC Unit-A BOM" 
                          autoFocus 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                        <textarea 
                          value={description} 
                          onChange={e => setDescription(e.target.value)} 
                          className="input-field resize-none min-h-[100px]" 
                          rows={3} 
                          placeholder="Brief description of when or on which equipment assets to apply this template..." 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-5 pb-8 sm:pb-5 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex justify-end gap-3">
                    <button type="button" onClick={cancel} className="btn-secondary py-2 px-4 shadow-sm text-xs">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving || !name.trim()} className="btn-primary py-2 px-5 shadow-sm flex items-center gap-1.5 text-xs font-semibold">
                      <Check className="w-4 h-4" />
                      <span>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Template'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table view */}
          {templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-slate-700 font-bold text-base">No BOM templates exist</p>
              <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm mx-auto">Create lists of commonly pre-packaged repair parts to easily assign them to complex HVAC systems or pumps.</p>
              <button onClick={openAdd} className="btn-primary font-semibold">
                <Plus className="w-4 h-4" /> Add First BOM Template
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 px-4 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-705 text-slate-700 font-bold">No templates found</p>
              <p className="text-slate-400 text-sm mt-1">Try adapting your template search terms.</p>
              <button onClick={() => setSearchQuery('')} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors">
                Clear filter Query
              </button>
            </div>
          ) : (
            <div className="responsive-table-container">
              <div className="divide-y divide-slate-100">
                {filteredTemplates.map((t: BOMTemplate) => (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors group">
                    {/* Information Column */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 leading-snug truncate">{t.name}</p>
                        {t.description ? (
                          <p className="text-xs text-slate-500 mt-1 leading-normal">{t.description}</p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5 italic">No notes or description added</p>
                        )}
                      </div>
                    </div>

                    {/* Metrics and Actions Column */}
                    <div className="flex items-center gap-3.5 self-end sm:self-auto flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/50">
                        <Wrench className="w-3 h-3 text-blue-500" />
                        <span>{t._count.parts} Parts</span>
                      </span>

                      <div className="flex items-center gap-1.5 pl-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={() => setManagingId(t.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-3xs"
                        >
                          Manage Parts
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200/50"
                          title="Edit template fields"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id, t.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50/7 transition-colors border border-transparent hover:border-red-200/30"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
