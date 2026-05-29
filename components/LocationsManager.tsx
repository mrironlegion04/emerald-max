'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, Check,
  MapPin, ChevronRight, ChevronDown, Search, EyeOff, LayoutGrid
} from 'lucide-react'

interface Location {
  id: string
  name: string
  address?: string | null
  parentId: string | null
  path?: string | null
  _count?: { children: number; assets: number }
}

interface TreeNode extends Location {
  children: TreeNode[]
  depth: number
}

interface Props {
  initialLocations: Location[]
}

function buildTree(items: Location[], parentId: string | null = null, depth = 0): TreeNode[] {
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

function buildPath(locations: Location[], id: string): string {
  const crumbs: string[] = []
  let cur: Location | undefined = locations.find(l => l.id === id)
  while (cur) {
    crumbs.unshift(cur.name)
    cur = cur.parentId ? locations.find(l => l.id === cur!.parentId) : undefined
  }
  return crumbs.join(' › ')
}

export default function LocationsManager({ initialLocations }: Props) {
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const tree = useMemo(() => buildTree(locations), [locations])
  const flat = useMemo(() => flattenTree(tree), [tree])

  // ── Search filtering ──
  const trimmedSearch = search.trim().toLowerCase()
  const visibleFlat = useMemo(() => {
    if (!trimmedSearch) return flat
    // Match by name or path
    return flat.filter(loc => {
      const path = loc.path ?? buildPath(locations, loc.id)
      return (
        loc.name.toLowerCase().includes(trimmedSearch) ||
        path.toLowerCase().includes(trimmedSearch)
      )
    })
  }, [flat, trimmedSearch, locations])

  // ── Collapse/expand ──
  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // When searching, temporarily ignore collapse state
  const displayFlat = useMemo(() => {
    if (trimmedSearch) return visibleFlat
    // Hide items whose ancestor is collapsed
    return flat.filter(loc => {
      let cur: Location | undefined = loc.parentId
        ? locations.find(l => l.id === loc.parentId) : undefined
      while (cur) {
        if (collapsed.has(cur.id)) return false
        cur = cur.parentId ? locations.find(l => l.id === cur!.parentId) : undefined
      }
      return true
    })
  }, [flat, trimmedSearch, visibleFlat, collapsed, locations])

  function openAdd(parentId = '') {
    setEditingId(null)
    setFormName('')
    setFormAddress('')
    setFormParentId(parentId)
    setError('')
    setShowForm(true)
  }

  function openEdit(loc: Location) {
    setEditingId(loc.id)
    setFormName(loc.name)
    setFormAddress(loc.address ?? '')
    setFormParentId(loc.parentId ?? '')
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormAddress('')
    setFormParentId('')
    setError('')
  }

  const parentOptions = useMemo(() => {
    if (!editingId) return flat
    const descendantIds = new Set<string>()
    const queue = [editingId]
    while (queue.length) {
      const cur = queue.shift()!
      locations.filter(l => l.parentId === cur).forEach(l => {
        descendantIds.add(l.id)
        queue.push(l.id)
      })
    }
    return flat.filter(l => l.id !== editingId && !descendantIds.has(l.id))
  }, [flat, editingId, locations])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setLoading(true)
    setError('')
    try {
      const isEdit = !!editingId
      const res = await fetch(
        isEdit ? `/api/locations/${editingId}` : '/api/locations',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     formName.trim(),
            address:  formAddress.trim() || null,
            parentId: formParentId || null,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      if (isEdit) {
        setLocations(prev =>
          prev.map(l =>
            l.id === editingId
              ? { ...l, name: data.name, address: data.address, parentId: data.parentId, path: data.path }
              : l
          )
        )
      } else {
        setLocations(prev => [...prev, data])
      }
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete physical location "${name}"? This cannot be undone.`)) return
    setDeleteErrors(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setLocations(prev => prev.filter(l => l.id !== id))
    } catch (err) {
      setDeleteErrors(prev => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to delete',
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search localized facilities by name, code or address crumbs…"
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
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{locations.length} total facilities</span>
          </div>

          <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 flex-shrink-0 w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      {trimmedSearch && (
        <p className="text-xs text-slate-400">
          Showing {visibleFlat.length} result{visibleFlat.length !== 1 ? 's' : ''} matched &ldquo;{trimmedSearch}&rdquo;
        </p>
      )}

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
                  <span className="w-1.5 h-3 bg-emerald-600 rounded-full"></span>
                  <h3 className="font-bold text-slate-900 text-base tracking-tight">
                    {editingId ? 'Edit Facility Location' : 'Register Corporate Facility'}
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
                  <div className="flex gap-2.5 p-3.5 bg-red-50/70 px-4 rounded-xl border border-red-100 text-sm text-red-700 animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Location Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Plant A, Building 4, Section 3"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nests Within Location <span className="text-slate-400 font-normal">(optional parent)</span>
                    </label>
                    <select
                      value={formParentId}
                      onChange={e => setFormParentId(e.target.value)}
                      className="input-field bg-white"
                    >
                      <option value="">— Primary Level Location —</option>
                      {parentOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {'\u00A0\u00A0'.repeat(opt.depth)}{opt.depth > 0 ? '↳ ' : ''}{opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Physical Coordinates or Street Address
                    </label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={e => setFormAddress(e.target.value)}
                      className="input-field"
                      placeholder="e.g. 1040 Executive Blvd SE, Level G"
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
                  <span>{loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Location'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trees Display list */}
      {displayFlat.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-250 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-slate-700 font-bold text-base">{trimmedSearch ? 'No facility matches' : 'No corporate facilities mapped yet'}</p>
          <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm mx-auto">
            {trimmedSearch
              ? 'Try adjusting your facilities search term.'
              : 'Add broad structures like "Corporate HQ" or "North warehouse" and anchor sub-divisions inside.'}
          </p>
          {trimmedSearch ? (
            <button onClick={() => setSearch('')} className="btn-secondary text-xs font-bold py-1.5 px-3">
              Clear filters
            </button>
          ) : (
            <button onClick={() => openAdd()} className="btn-primary font-semibold">
              <Plus className="w-4 h-4" /> Add Root Location
            </button>
          )}
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="divide-y divide-slate-100">
            {displayFlat.map(loc => {
              const childCount = loc._count?.children ?? locations.filter(l => l.parentId === loc.id).length
              const assetCount = loc._count?.assets ?? 0
              const hasChildren = childCount > 0
              const isCollapsed = collapsed.has(loc.id)
              const pathStr = loc.path ?? buildPath(locations, loc.id)

              return (
                <div key={loc.id} className="relative group/row">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
                    style={{ paddingLeft: `${Math.max(16, 16 + loc.depth * 20)}px` }}
                  >
                    
                    {/* Prefix and Title Column */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Collapse indicator icons */}
                      {!trimmedSearch && hasChildren ? (
                        <button
                          onClick={() => toggleCollapse(loc.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 -m-1 focus:outline-none flex-shrink-0"
                          title={isCollapsed ? 'Expand facility level' : 'Collapse facility level'}
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-4 h-4 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded p-0.5" />
                            : <ChevronDown className="w-4 h-4 text-emerald-600 bg-emerald-50 rounded p-0.5" />}
                        </button>
                      ) : loc.depth > 0 ? (
                        <div className="text-slate-300 font-light text-xs self-center flex-shrink-0 select-none mr-1.5">↳</div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 self-center flex-shrink-0 mr-1" />
                      )}

                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-800 leading-snug tracking-tight">{loc.name}</span>
                        {/* Show full path when searching, address otherwise */}
                        {trimmedSearch && loc.depth > 0 ? (
                          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mt-0.5">{pathStr}</p>
                        ) : loc.address ? (
                          <p className="text-xs text-slate-400 leading-relaxed truncate mt-0.5">{loc.address}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-0.5">No distinct street address registered</p>
                        )}
                      </div>
                    </div>

                    {/* Numeric and Button Column */}
                    <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                      {hasChildren && (
                        <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200/50 font-bold px-2 py-0.5 rounded text-[10px]">
                          {childCount} sub-{childCount === 1 ? 'place' : 'places'}
                        </span>
                      )}
                      
                      {assetCount > 0 ? (
                        <span className="inline-flex items-center bg-emerald-55/7 text-emerald-700 border border-emerald-100/50 font-bold px-2 py-0.5 rounded text-[10px]">
                          {assetCount} asset{assetCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-slate-50 text-slate-400 border border-slate-200/20 px-2 py-0.5 rounded text-[10px]">
                          0 assets
                        </span>
                      )}

                      {/* Operations on hover */}
                      <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity duration-150 ml-1">
                        <button
                          title="Add sub-location"
                          onClick={() => openAdd(loc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Edit Location info"
                          onClick={() => openEdit(loc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete Location map"
                          onClick={() => handleDelete(loc.id, loc.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Errors block */}
                  {deleteErrors[loc.id] && (
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100/50">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                      <span className="flex-1 font-medium">{deleteErrors[loc.id]}</span>
                      <button onClick={() => setDeleteErrors(prev => ({ ...prev, [loc.id]: '' }))} className="p-0.5 rounded text-red-400 hover:bg-red-100 hover:text-red-700">
                        <X className="w-3" />
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
          Click <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">▶</span> to expand lists · Hover lines to access quick <span className="font-semibold text-slate-600">+ Sub-location</span> triggers.
        </p>
      )}
    </div>
  )
}
