'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, AlertCircle, X, Check, FolderTree } from 'lucide-react'

interface HierarchyItem {
  id: string
  name: string
  parentId: string | null
  _count?: { children: number; assets: number }
}

interface Props {
  initialItems: HierarchyItem[]
  apiBase: string          // e.g. "/api/asset-types"
  entityLabel: string      // e.g. "Asset Type"
  entityLabelPlural: string
  assetLabel?: string      // label for "assets" count column (default "Assets")
}

interface TreeNode extends HierarchyItem {
  children: TreeNode[]
  depth: number
}

function buildTree(items: HierarchyItem[], parentId: string | null = null, depth = 0): TreeNode[] {
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

export default function HierarchyManager({
  initialItems,
  apiBase,
  entityLabel,
  entityLabelPlural,
  assetLabel = 'Assets',
}: Props) {
  const [items, setItems] = useState<HierarchyItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})

  const tree = useMemo(() => buildTree(items), [items])
  const flat = useMemo(() => flattenTree(tree), [tree])

  function openAddForm(parentId = '') {
    setEditingId(null)
    setFormName('')
    setFormParentId(parentId)
    setError('')
    setShowForm(true)
  }

  function openEditForm(item: HierarchyItem) {
    setEditingId(item.id)
    setFormName(item.name)
    setFormParentId(item.parentId ?? '')
    setError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormParentId('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setLoading(true)
    setError('')

    try {
      const isEdit = !!editingId
      const url = isEdit ? `${apiBase}/${editingId}` : apiBase
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), parentId: formParentId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      if (isEdit) {
        setItems(prev => prev.map(i => i.id === editingId ? { ...i, name: data.name, parentId: data.parentId } : i))
      } else {
        setItems(prev => [...prev, data])
      }
      cancelForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${entityLabel}? This cannot be undone.`)) return
    setDeleteError(prev => ({ ...prev, [id]: '' }))

    try {
      const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setDeleteError(prev => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to delete',
      }))
    }
  }

  // Parent options: exclude self and descendants when editing
  const parentOptions = useMemo(() => {
    if (!editingId) return flat
    const descendantIds = new Set<string>()
    const queue = [editingId]
    while (queue.length) {
      const cur = queue.shift()!
      items.filter(i => i.parentId === cur).forEach(i => {
        descendantIds.add(i.id)
        queue.push(i.id)
      })
    }
    return flat.filter(i => i.id !== editingId && !descendantIds.has(i.id))
  }, [flat, editingId, items])

  const rootItems = flat.filter(i => i.parentId === null)

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FolderTree className="w-4 h-4" />
          <span>{items.length} {items.length === 1 ? entityLabel : entityLabelPlural} total</span>
        </div>
        <button
          onClick={() => openAddForm()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add {entityLabel}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {editingId ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
            </h3>
            <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
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
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="input-field"
                placeholder={`e.g. ${entityLabel} name`}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent {entityLabel} <span className="text-gray-400 font-normal">(optional)</span>
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
              {loading ? 'Saving…' : editingId ? 'Save changes' : `Add ${entityLabel}`}
            </button>
            <button type="button" onClick={cancelForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tree list */}
      {flat.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FolderTree className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No {entityLabelPlural} yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Click "Add {entityLabel}" to create your first one.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {flat.map(item => {
            const childCount = item._count?.children ?? items.filter(i => i.parentId === item.id).length
            const assetCount = item._count?.assets ?? 0
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                style={{ paddingLeft: `${16 + item.depth * 24}px` }}
              >
                {/* Indent indicator */}
                {item.depth > 0 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
                {item.depth === 0 && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}

                {/* Name */}
                <span className="flex-1 text-sm font-medium text-gray-900">{item.name}</span>

                {/* Counts */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {childCount > 0 && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {childCount} sub-{childCount === 1 ? entityLabel.toLowerCase() : entityLabelPlural.toLowerCase()}
                    </span>
                  )}
                  {assetCount > 0 && (
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {assetCount} {assetLabel.toLowerCase()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title={`Add sub-${entityLabel}`}
                    onClick={() => openAddForm(item.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Edit"
                    onClick={() => openEditForm(item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Inline delete errors */}
          {Object.entries(deleteError).map(([id, msg]) =>
            msg ? (
              <div key={id} className="px-4 py-2 bg-red-50 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {msg}
                <button
                  onClick={() => setDeleteError(prev => ({ ...prev, [id]: '' }))}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Quick-add root hint */}
      {flat.length > 0 && !showForm && (
        <p className="text-xs text-gray-400 text-center">
          Hover any row and click <strong>+</strong> to add a sub-{entityLabel.toLowerCase()} under it.
        </p>
      )}
    </div>
  )
}
