'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, X, FolderTree, Search } from 'lucide-react'

interface Category {
  id: string
  name: string
  parentId: string | null
}

interface TreeNode extends Category {
  children: TreeNode[]
}

interface Props {
  categories: Category[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

function buildTree(items: Category[], parentId: string | null = null): TreeNode[] {
  return items
    .filter(i => i.parentId === parentId)
    .map(i => ({ ...i, children: buildTree(items, i.id) }))
}

function flattenTree(nodes: TreeNode[], depth = 0): { node: TreeNode; depth: number }[] {
  const result: { node: TreeNode; depth: number }[] = []
  for (const n of nodes) {
    result.push({ node: n, depth })
    result.push(...flattenTree(n.children, depth + 1))
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

export default function CategorySelect({
  categories,
  value,
  onChange,
  placeholder = '— No category —',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const rootTree = useMemo(() => buildTree(categories), [categories])

  const selectedPath = useMemo(
    () => value ? buildPath(categories, value) : '',
    [categories, value]
  )

  const trimmed = search.trim().toLowerCase()

  const searchResults = useMemo(() => {
    if (!trimmed) return []
    return flattenTree(rootTree).filter(({ node }) => {
      const path = buildPath(categories, node.id)
      return node.name.toLowerCase().includes(trimmed) || path.toLowerCase().includes(trimmed)
    })
  }, [trimmed, rootTree, categories])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
      if (value) {
        const ancestors = new Set<string>()
        let cur: Category | undefined = categories.find(c => c.id === value)
        while (cur?.parentId) {
          ancestors.add(cur.parentId)
          cur = categories.find(c => c.id === cur!.parentId)
        }
        setExpanded(prev => new Set([...prev, ...ancestors]))
      }
    }
  }, [open, value, categories])

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  function renderTree(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.id)
      const isSelected = value === node.id

      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => select(node.id)}
            className={`w-full flex items-center gap-2 py-2 pr-3 text-sm transition-colors text-left ${
              isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <span
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
              onClick={hasChildren ? e => toggleExpand(node.id, e) : undefined}
            >
              {hasChildren ? (
                isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
              )}
            </span>

            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              depth === 0 ? 'bg-indigo-500' : depth === 1 ? 'bg-blue-400' : 'bg-sky-400'
            }`} />

            <span className={`flex-1 truncate ${depth === 0 ? 'font-medium' : 'font-normal'}`}>
              {node.name}
            </span>

            {isSelected && <span className="text-indigo-600 text-xs font-semibold">✓</span>}
          </button>

          {hasChildren && isExpanded && renderTree(node.children, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`input-field flex items-center gap-2 text-left w-full ${
          open ? 'ring-2 ring-blue-500 border-blue-500' : ''
        }`}
      >
        {value ? (
          <>
            <FolderTree className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-900 truncate">{selectedPath}</span>
            <button
              type="button"
              onClick={clearValue}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-gray-400">{placeholder}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clear */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setSearch('') }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            No category
          </button>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">No categories configured yet.</p>
            ) : trimmed ? (
              searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">No results for &ldquo;{search}&rdquo;</p>
              ) : (
                <>
                  {searchResults.map(({ node }) => {
                    const path = buildPath(categories, node.id)
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => select(node.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                          value === node.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <FolderTree className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{node.name}</p>
                          {node.parentId && (
                            <p className="text-xs text-gray-400 truncate">{path}</p>
                          )}
                        </div>
                        {value === node.id && <span className="text-indigo-600 text-xs font-semibold">✓</span>}
                      </button>
                    )
                  })}
                  <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 text-right">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                </>
              )
            ) : (
              renderTree(rootTree)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
