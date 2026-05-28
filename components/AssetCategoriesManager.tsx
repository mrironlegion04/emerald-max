'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, Check,
  FolderTree, ChevronRight, ChevronDown, Search, Layers,
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
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
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
          <FolderTree className="w-4 h-4" />
          <span>{categories.length} total</span>
        </div>

        <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Search hint */}
      {trimmedSearch && (
        <p className="text-xs text-gray-400">
          Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{trimmedSearch}&rdquo;
        </p>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {editingId ? 'Edit Category' : 'Add Category'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="input-field"
                placeholder="e.g. Mechanical, Pump, Centrifugal Pump"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent category <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={formParentId}
                onChange={e => setFormParentId(e.target.value)}
                className="input-field"
              >
                <option value="">— Root level (no parent) —</option>
                {parentOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {'  '.repeat(opt.depth)}{opt.depth > 0 ? '↳ ' : ''}{opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add Category'}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tree / Search results list */}
      {displayFlat.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FolderTree className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {trimmedSearch ? (
            <>
              <p className="text-gray-500 font-medium">No categories match &ldquo;{trimmedSearch}&rdquo;</p>
              <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-1">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">No categories yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Add root categories like &ldquo;Mechanical&rdquo;, then nest sub-categories under them.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {displayFlat.map(cat => {
            const childCount = cat._count?.children ?? categories.filter(c => c.parentId === cat.id).length
            const assetCount = cat._count?.assets ?? 0
            const hasChildren = childCount > 0
            const isCollapsed = collapsed.has(cat.id)
            const pathStr = buildPath(categories, cat.id)

            return (
              <div key={cat.id}>
                <div
                  className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors group"
                  style={{ paddingLeft: `${16 + cat.depth * 24}px` }}
                >
                  {/* Collapse toggle */}
                  {!trimmedSearch && hasChildren ? (
                    <button
                      onClick={() => toggleCollapse(cat.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 -ml-1"
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                  ) : cat.depth > 0 ? (
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  )}

                  {/* Name + path */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    {trimmedSearch && cat.depth > 0 && (
                      <p className="text-xs text-indigo-500 truncate">{pathStr}</p>
                    )}
                  </div>

                  {/* Counts */}
                  <div className="flex items-center gap-2">
                    {hasChildren && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {childCount} sub-{childCount === 1 ? 'category' : 'categories'}
                      </span>
                    )}
                    {assetCount > 0 && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {assetCount} asset{assetCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Assign domains"
                      onClick={() => toggleDomainPanel(cat.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        expandedDomains.has(cat.id)
                          ? 'text-violet-600 bg-violet-50'
                          : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Add sub-category"
                      onClick={() => openAdd(cat.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Domain assignment panel */}
                {expandedDomains.has(cat.id) && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-t border-violet-100"
                    style={{ paddingLeft: `${28 + cat.depth * 24}px` }}
                  >
                    <Layers className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                    <span className="text-xs text-violet-600 font-medium flex-shrink-0">Domains:</span>
                    {domains.length === 0 ? (
                      <span className="text-xs text-gray-400">No domains yet — <a href="/settings/domains" className="underline hover:text-blue-600">add in Settings</a></span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {domains.map(d => {
                          const active = (domainMap[cat.id] ?? []).includes(d.id)
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => toggleDomain(cat.id, d.id)}
                              disabled={savingDomains.has(cat.id)}
                              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                active
                                  ? 'bg-violet-600 border-violet-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-violet-400'
                              }`}
                            >
                              {d.name}
                            </button>
                          )
                        })}
                        {savingDomains.has(cat.id) && (
                          <span className="text-xs text-violet-400 animate-pulse ml-1">Saving…</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Inline delete error */}
                {deleteErrors[cat.id] && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{deleteErrors[cat.id]}</span>
                    <button
                      onClick={() => setDeleteErrors(prev => ({ ...prev, [cat.id]: '' }))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {displayFlat.length > 0 && !showForm && !trimmedSearch && (
        <p className="text-xs text-gray-400 text-center">
          Click <strong>▶</strong> to collapse a group · Hover any row and click <strong>+</strong> to add a sub-category
        </p>
      )}
    </div>
  )
}
