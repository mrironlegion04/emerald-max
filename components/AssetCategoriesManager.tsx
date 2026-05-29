'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, Check,
  FolderTree, ChevronRight, ChevronDown, Search, Layers, LayoutGrid
} from 'lucide-react'

interface Category {
  id: string
  name: string
  parentId: string | null
  _count?: { children: number; assets: number }
}

interface TreeNode extends Category {
  children: TreeNode[]
  depth: number
}

interface Domain {
  id: string
  name: string
}

interface Props {
  initialCategories: Category[]
  domains: Domain[]
  initialDomainMap: Record<string, string[]>  // categoryId → domainId[]
}

function buildTree(items: Category[], parentId: string | null = null, depth = 0): TreeNode[] {
  return items
    .filter(i => i.parentId === parentId)
    .map(i => ({
      ...i,
      depth,
      children: buildTree(items, i.id, depth + 1),
    }))
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenTree(node.children))
  }
  return result
}

function buildPath(categories: Category[], id: string): string {
  const crumbs: string[] = []
  let cur: Category | undefined = categories.find(c => c.id === id)
  while (cur) {
    crumbs.unshift(cur.name)
    cur = cur.parentId ? categories.find(c => c.id === cur!.parentId) : undefined
  }
  return crumbs.join(' › ')
}

export default function AssetCategoriesManager({ initialCategories, domains, initialDomainMap }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  // Domain assignment state
  const [domainMap, setDomainMap] = useState<Record<string, string[]>>(initialDomainMap)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [savingDomains, setSavingDomains] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(categories), [categories])
  const flat = useMemo(() => flattenTree(tree), [tree])

  const trimmedSearch = search.trim().toLowerCase()

  // Search: filter by name or full path
  const searchResults = useMemo(() => {
    if (!trimmedSearch) return []
    return flat.filter(cat => {
      const path = buildPath(categories, cat.id)
      return (
        cat.name.toLowerCase().includes(trimmedSearch) ||
        path.toLowerCase().includes(trimmedSearch)
      )
    })
  }, [flat, trimmedSearch, categories])

  // Tree display: hide items whose ancestor is collapsed (only when not searching)
  const displayFlat = useMemo(() => {
    if (trimmedSearch) return searchResults
    return flat.filter(cat => {
      let cur: Category | undefined = cat.parentId
        ? categories.find(c => c.id === cat.parentId) : undefined
      while (cur) {
        if (collapsed.has(cur.id)) return false
        cur = cur.parentId ? categories.find(c => c.id === cur!.parentId) : undefined
      }
      return true
    })
  }, [flat, trimmedSearch, searchResults, collapsed, categories])

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openAdd(parentId = '') {
    setEditingId(null)
    setFormName('')
    setFormParentId(parentId)
    setError('')
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id)
    setFormName(cat.name)
    setFormParentId(cat.parentId ?? '')
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormParentId('')
    setError('')
  }

  const parentOptions = useMemo(() => {
    if (!editingId) return flat
    const descendantIds = new Set<string>()
    const queue = [editingId]
    while (queue.length) {
      const cur = queue.shift()!
      categories.filter(c => c.parentId === cur).forEach(c => {
        descendantIds.add(c.id)
        queue.push(c.id)
      })
    }
    return flat.filter(c => c.id !== editingId && !descendantIds.has(c.id))
  }, [flat, editingId, categories])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setLoading(true)
    setError('')
    try {
      const isEdit = !!editingId
      const res = await fetch(
        isEdit ? `/api/asset-categories/${editingId}` : '/api/asset-categories',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), parentId: formParentId || null }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      if (isEdit) {
        setCategories(prev =>
          prev.map(c =>
            c.id === editingId ? { ...c, name: data.name, parentId: data.parentId } : c
          )
        )
      } else {
        setCategories(prev => [...prev, data])
      }
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return
    setDeleteErrors(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/asset-categories/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setDeleteErrors(prev => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to delete',
      }))
    }
  }

  function toggleDomainPanel(id: string) {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function toggleDomain(categoryId: string, domainId: string) {
    const current = domainMap[categoryId] ?? []
    const newIds  = current.includes(domainId)
      ? current.filter(d => d !== domainId)
      : [...current, domainId]

    // Optimistic update
    setDomainMap(prev => ({ ...prev, [categoryId]: newIds }))
    setSavingDomains(prev => new Set(prev).add(categoryId))
    try {
      const res = await fetch('/api/category-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, domainIds: newIds }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Rollback on failure
      setDomainMap(prev => ({ ...prev, [categoryId]: current }))
    } finally {
      setSavingDomains(prev => { const s = new Set(prev); s.delete(categoryId); return s })
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Title Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search classification hierarchies by name or full path…"
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
            <FolderTree className="w-3.5 h-3.5 text-slate-400" />
            <span>{categories.length} total categories</span>
          </div>

          <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {trimmedSearch && (
        <p className="text-xs text-slate-400">
          Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} matched &ldquo;{trimmedSearch}&rdquo;
        </p>
      )}

      {/* Form Editor Panel */}
      {showForm && (
        <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-blue-105 border-blue-200 shadow-sm animate-in fade-in duration-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
              <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                {editingId ? 'Edit Configuration Category' : 'Create New Asset Category'}
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
              <div className="flex gap-2.5 p-3.5 bg-red-55/7 px-4 rounded-xl border border-red-100 text-sm text-red-700 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Mechanical, Centrifugal Pump, Boiler"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Parent Category <span className="text-slate-400 font-normal">(optional nesting)</span>
                </label>
                <select
                  value={formParentId}
                  onChange={e => setFormParentId(e.target.value)}
                  className="input-field bg-white"
                >
                  <option value="">— Root Level Category —</option>
                  {parentOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {'\u00A0\u00A0'.repeat(opt.depth)}{opt.depth > 0 ? '↳ ' : ''}{opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button type="button" onClick={cancel} className="btn-secondary py-2 px-4 shadow-2xs">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary py-2 px-4 shadow-sm flex items-center gap-1.5 font-semibold">
                <Check className="w-4 h-4" />
                <span>{loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Category'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trees Container */}
      {displayFlat.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-250 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-slate-700 font-bold text-base">{trimmedSearch ? 'No categories matched' : 'Asset hierarchy map is empty'}</p>
          <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm mx-auto">
            {trimmedSearch 
              ? 'Try adapting your subcategory search parameters.' 
              : 'Add broad classifications like "Mechanical Equipment" and bundle specialized subdivisions underneath.'}
          </p>
          {trimmedSearch ? (
            <button onClick={() => setSearch('')} className="btn-secondary text-xs font-bold py-1.5 px-3">
              Clear filters
            </button>
          ) : (
            <button onClick={() => openAdd()} className="btn-primary font-semibold">
              <Plus className="w-4 h-4" /> Add Root Category
            </button>
          )}
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="divide-y divide-slate-105/40 divide-slate-100">
            {displayFlat.map(cat => {
              const childCount = cat._count?.children ?? categories.filter(c => c.parentId === cat.id).length
              const assetCount = cat._count?.assets ?? 0
              const hasChildren = childCount > 0
              const isCollapsed = collapsed.has(cat.id)
              const pathStr = buildPath(categories, cat.id)

              return (
                <div key={cat.id} className="relative group/row">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
                    style={{ paddingLeft: `${Math.max(16, 16 + cat.depth * 20)}px` }}
                  >
                    
                    {/* Prefix and Title Column */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Collapse indicator chevron buttons */}
                      {!trimmedSearch && hasChildren ? (
                        <button
                          onClick={() => toggleCollapse(cat.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 -m-1 focus:outline-none flex-shrink-0"
                          title={isCollapsed ? 'Expand subcategory' : 'Collapse subcategory'}
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-4 h-4 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded p-0.5" />
                            : <ChevronDown className="w-4 h-4 text-indigo-600 bg-indigo-50 rounded p-0.5" />}
                        </button>
                      ) : cat.depth > 0 ? (
                        <div className="text-slate-300 font-light text-xs self-center flex-shrink-0 select-none mr-1.5">↳</div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-blue-500 self-center flex-shrink-0 mr-1" />
                      )}

                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-800 leading-snug tracking-tight">{cat.name}</span>
                        {trimmedSearch && cat.depth > 0 && (
                          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest mt-0.5">{pathStr}</p>
                        )}
                      </div>
                    </div>

                    {/* Numeric indicators and button panels */}
                    <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                      {hasChildren && (
                        <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200/50 font-bold px-2 py-0.5 rounded text-[10px]">
                          {childCount} sub-{childCount === 1 ? 'category' : 'categories'}
                        </span>
                      )}
                      
                      {assetCount > 0 ? (
                        <span className="inline-flex items-center bg-indigo-55/7 text-indigo-700 border border-indigo-100/50 font-bold px-2 py-0.5 rounded text-[10px]">
                          {assetCount} asset{assetCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-slate-50 text-slate-400 border border-slate-200/20 px-2 py-0.5 rounded text-[10px]">
                          0 assets
                        </span>
                      )}

                      {/* Hover action bars */}
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity duration-155 ml-1">
                        <button
                          title="Assign Maintenance Domains"
                          onClick={() => toggleDomainPanel(cat.id)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            expandedDomains.has(cat.id)
                              ? 'text-violet-700 bg-violet-100/80 border-violet-200'
                              : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-100 border-transparent'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Add nested subcategory"
                          onClick={() => openAdd(cat.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Edit Category"
                          onClick={() => openEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete Category"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Domain Assignment Tray */}
                  {expandedDomains.has(cat.id) && (
                    <div 
                      className="p-3 bg-violet-50/45 border-y border-violet-100/50 flex flex-col md:flex-row items-stretch md:items-center gap-3.5 animate-in slide-in-from-top-1 duration-150"
                      style={{ paddingLeft: `${Math.max(28, 28 + cat.depth * 20)}px` }}
                    >
                      <div className="flex items-center gap-2 flex-shrink-0 text-violet-700 font-bold text-xs select-none">
                        <Layers className="w-3.5 h-3.5 text-violet-500" />
                        <span>Assigned Domains:</span>
                      </div>

                      {domains.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No domains configured. Register domains first under <a href="/settings/domains" className="underline hover:text-indigo-700 font-semibold text-slate-600">Domains Settings</a>.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {domains.map(d => {
                            const active = (domainMap[cat.id] ?? []).includes(d.id)
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => toggleDomain(cat.id, d.id)}
                                disabled={savingDomains.has(cat.id)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border transition-all ${
                                  active
                                    ? 'bg-violet-600 border-violet-600 text-white shadow-3xs'
                                    : 'bg-white border-slate-250 text-slate-600 hover:border-violet-300'
                                }`}
                              >
                                {d.name}
                              </button>
                            )
                          })}
                          {savingDomains.has(cat.id) && (
                            <span className="text-[10px] font-bold text-violet-400 animate-pulse ml-1 tracking-wider uppercase">Syncing…</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Delete Errors */}
                  {deleteErrors[cat.id] && (
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100/50">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                      <span className="flex-1 font-medium">{deleteErrors[cat.id]}</span>
                      <button onClick={() => setDeleteErrors(prev => ({ ...prev, [cat.id]: '' }))} className="p-0.5 rounded text-red-400 hover:bg-red-100 hover:text-red-700">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {displayFlat.length > 0 && !showForm && !trimmedSearch && (
        <p className="text-center text-xs text-slate-400 tracking-normal leading-relaxed mt-2 select-none">
          Click <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">▶</span> to expand lists · Hover rows to access quick <span className="font-semibold text-slate-600">+ Subcategory</span> triggers.
        </p>
      )}
    </div>
  )
}
