'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, Check,
  MapPin, ChevronRight, ChevronDown, Search,
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
    if (!confirm(`Delete location "${name}"? This cannot be undone.`)) return
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
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search locations…"
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Count */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-shrink-0">
          <MapPin className="w-4 h-4" />
          <span>{locations.length} total</span>
        </div>

        <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {/* Search result hint */}
      {trimmedSearch && (
        <p className="text-xs text-gray-400">
          Showing {visibleFlat.length} result{visibleFlat.length !== 1 ? 's' : ''} for &ldquo;{trimmedSearch}&rdquo;
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
              {editingId ? 'Edit Location' : 'Add Location'}
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
                Location name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="input-field"
                placeholder="e.g. Plant A, Building 2, Line 3"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent location <span className="text-gray-400 font-normal">(optional)</span>
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                className="input-field"
                placeholder="e.g. 123 Main St, Floor 2"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add Location'}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tree list */}
      {displayFlat.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {trimmedSearch ? (
            <>
              <p className="text-gray-500 font-medium">No locations match &ldquo;{trimmedSearch}&rdquo;</p>
              <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-1">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">No locations yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Add root locations like &ldquo;Plant A&rdquo;, then nest sub-locations under them.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {displayFlat.map(loc => {
            const childCount = loc._count?.children ?? locations.filter(l => l.parentId === loc.id).length
            const assetCount = loc._count?.assets ?? 0
            const hasChildren = childCount > 0
            const isCollapsed = collapsed.has(loc.id)
            const pathStr = loc.path ?? buildPath(locations, loc.id)

            return (
              <div key={loc.id}>
                <div
                  className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors group"
                  style={{ paddingLeft: `${16 + loc.depth * 24}px` }}
                >
                  {/* Collapse toggle / depth indicator */}
                  {!trimmedSearch && hasChildren ? (
                    <button
                      onClick={() => toggleCollapse(loc.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 -ml-1"
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                  ) : loc.depth > 0 ? (
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  )}

                  {/* Name + path */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                    {/* Show full path when searching, address otherwise */}
                    {trimmedSearch && loc.depth > 0 ? (
                      <p className="text-xs text-emerald-600 truncate">{pathStr}</p>
                    ) : loc.address ? (
                      <p className="text-xs text-gray-400 truncate">{loc.address}</p>
                    ) : null}
                  </div>

                  {/* Counts */}
                  <div className="flex items-center gap-2">
                    {hasChildren && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {childCount} sub-{childCount === 1 ? 'location' : 'locations'}
                      </span>
                    )}
                    {assetCount > 0 && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        {assetCount} asset{assetCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Add sub-location"
                      onClick={() => openAdd(loc.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => openEdit(loc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDelete(loc.id, loc.name)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {deleteErrors[loc.id] && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{deleteErrors[loc.id]}</span>
                    <button
                      onClick={() => setDeleteErrors(prev => ({ ...prev, [loc.id]: '' }))}
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
          Click <strong>▶</strong> to collapse a group · Hover any row and click <strong>+</strong> to add a sub-location
        </p>
      )}
    </div>
  )
}
