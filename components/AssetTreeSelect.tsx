'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, X, Package, Search, MapPin, Check } from 'lucide-react'

interface Asset {
  id: string
  name: string
  assetCode: string | null
  imageUrl?: string | null
  categoryId?: string | null
  parentId?: string | null
  locationId?: string | null
}

interface Location {
  id: string
  name: string
  parentId: string | null
  path?: string | null
}

interface TreeNode extends Asset {
  children: TreeNode[]
}

interface CombinedNode {
  id: string // Unique tree node key e.g. "loc-{id}" or "asset-{id}"
  name: string
  isLocation: boolean
  assetCode?: string | null
  imageUrl?: string | null
  assetId?: string
  locationId?: string
  children: CombinedNode[]
}

interface Props {
  assets: Asset[]
  value: string | string[]
  onChange: (id: string | string[]) => void
  placeholder?: string
  multiSelect?: boolean
}

// ── Asset-Only Tree Builders ──
function buildTree(items: Asset[], parentId: string | null = null): TreeNode[] {
  const allIds = new Set(items.map(i => i.id))
  return items
    .filter(i => {
      if (parentId === null) {
        return !i.parentId || !allIds.has(i.parentId)
      }
      return i.parentId === parentId
    })
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

function buildPath(assets: Asset[], id: string): string {
  const crumbs: string[] = []
  let cur: Asset | undefined = assets.find(c => c.id === id)
  while (cur) {
    crumbs.unshift(`${cur.name}${cur.assetCode ? ` (${cur.assetCode})` : ''}`)
    cur = cur.parentId ? assets.find(c => c.id === cur!.parentId) : undefined
  }
  return crumbs.join(' › ')
}

// ── Combined Location-Asset Tree Builders ──
function buildLocationTree(
  locs: Location[],
  allAssets: Asset[],
  parentLocId: string | null = null
): CombinedNode[] {
  const nodes: CombinedNode[] = []

  // 1. Recursive child locations
  const childLocs = locs.filter(l => l.parentId === parentLocId)
  for (const loc of childLocs) {
    const locNode: CombinedNode = {
      id: `loc-${loc.id}`,
      name: loc.name,
      isLocation: true,
      locationId: loc.id,
      children: []
    }

    // Add nested child locations first
    locNode.children.push(...buildLocationTree(locs, allAssets, loc.id))

    // Add root assets that belong to this location
    const assetIds = new Set(allAssets.map(a => a.id))
    const locAssets = allAssets.filter(a =>
      a.locationId === loc.id &&
      (!a.parentId || !assetIds.has(a.parentId))
    )

    for (const asset of locAssets) {
      locNode.children.push(buildAssetSubtree(asset, allAssets))
    }

    // Only add location if it has child locations or assets
    if (locNode.children.length > 0) {
      nodes.push(locNode)
    }
  }

  // At root level, add assets that have no location or location isn't in current list
  if (parentLocId === null) {
    const assetIds = new Set(allAssets.map(a => a.id))
    const locIds = new Set(locs.map(l => l.id))
    
    const unassignedAssets = allAssets.filter(a =>
      (!a.parentId || !assetIds.has(a.parentId)) &&
      (!a.locationId || !locIds.has(a.locationId))
    )

    if (unassignedAssets.length > 0) {
      const unassignedNode: CombinedNode = {
        id: 'loc-unassigned',
        name: 'Unassigned Location',
        isLocation: true,
        children: unassignedAssets.map(asset => buildAssetSubtree(asset, allAssets))
      }
      nodes.push(unassignedNode)
    }
  }

  return nodes
}

function buildAssetSubtree(asset: Asset, allAssets: Asset[]): CombinedNode {
  const node: CombinedNode = {
    id: `asset-${asset.id}`,
    name: asset.name,
    isLocation: false,
    assetCode: asset.assetCode,
    imageUrl: asset.imageUrl,
    assetId: asset.id,
    children: []
  }

  const childAssets = allAssets.filter(a => a.parentId === asset.id)
  for (const child of childAssets) {
    node.children.push(buildAssetSubtree(child, allAssets))
  }

  return node
}

function buildAssetPath(assets: Asset[], locations: Location[], assetId: string): string {
  const crumbs: string[] = []
  
  let curAsset: Asset | undefined = assets.find(a => a.id === assetId)
  while (curAsset) {
    crumbs.unshift(`${curAsset.name}${curAsset.assetCode ? ` (${curAsset.assetCode})` : ''}`)
    
    // Once we reach a top-level asset, prepend its location path
    if (!curAsset.parentId || !assets.some(a => a.id === curAsset!.parentId)) {
      if (curAsset.locationId) {
        let curLoc: Location | undefined = locations.find(l => l.id === curAsset!.locationId)
        while (curLoc) {
          crumbs.unshift(curLoc.name)
          curLoc = curLoc.parentId ? locations.find(l => l.id === curLoc!.parentId) : undefined
        }
      }
      break
    }
    curAsset = assets.find(a => a.id === curAsset!.parentId)
  }
  
  return crumbs.join(' › ')
}

export default function AssetTreeSelect({
  assets,
  value,
  onChange,
  placeholder = '— No asset —',
  multiSelect = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'asset' | 'location'>('asset')
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Normalize value to array for multi-select support
  const selectedIds = useMemo(() => {
    if (Array.isArray(value)) return value
    return value ? [value] : []
  }, [value])

  const toggleAsset = (assetId: string) => {
    if (!multiSelect) {
      onChange(assetId)
      setOpen(false)
      setSearch('')
      return
    }
    
    const updated = selectedIds.includes(assetId)
      ? selectedIds.filter(id => id !== assetId)
      : [...selectedIds, assetId]
    onChange(updated)
  }

  const selectSingle = (assetId: string) => {
    if (multiSelect) {
      toggleAsset(assetId)
    } else {
      onChange(assetId)
      setOpen(false)
      setSearch('')
    }
  }

  // 1. Fetch locations client-side to keep the component self-contained
  useEffect(() => {
    if ((viewMode === 'location' || value) && locations.length === 0 && !loadingLocations) {
      setLoadingLocations(true)
      fetch('/api/locations')
        .then(r => r.json())
        .then((data: any[]) => {
          // The API returns nested tree, let's flatten it for easier tree processing
          const flat: Location[] = []
          function recurse(items: any[]) {
            for (const item of items) {
              flat.push({
                id: item.id,
                name: item.name,
                parentId: item.parentId,
                path: item.path
              })
              if (item.children) recurse(item.children)
            }
          }
          recurse(data)
          setLocations(flat)
        })
        .catch(err => console.error('Error loading locations inside AssetTreeSelect:', err))
        .finally(() => setLoadingLocations(false))
    }
  }, [viewMode, value, locations.length, loadingLocations])

  // Asset-only tree
  const assetRootTree = useMemo(() => buildTree(assets), [assets])

  // Combined location-asset tree
  const locationCombinedTree = useMemo(() => {
    if (locations.length === 0) return []
    return buildLocationTree(locations, assets)
  }, [locations, assets])

  // Get selected asset item (single-select only)
  const selectedAsset = useMemo(() => {
    if (multiSelect || !value || Array.isArray(value)) return undefined
    return assets.find(a => a.id === value)
  }, [assets, value, multiSelect])

  // Compute selected crumb path dynamically based on loaded locations (single-select only)
  const selectedPath = useMemo(() => {
    if (multiSelect || !value || Array.isArray(value)) return ''
    if (locations.length > 0) {
      return buildAssetPath(assets, locations, value)
    }
    return buildPath(assets, value)
  }, [assets, locations, value, multiSelect])

  const trimmed = search.trim().toLowerCase()

  // Search Results — only assets are searchable and selectable
  const searchResults = useMemo(() => {
    if (!trimmed) return []
    
    // We search the asset list, but enrich their paths based on what mode we are in
    return assets
      .filter(asset => 
        asset.name.toLowerCase().includes(trimmed) ||
        (asset.assetCode && asset.assetCode.toLowerCase().includes(trimmed))
      )
      .map(asset => {
        const path = locations.length > 0 
          ? buildAssetPath(assets, locations, asset.id)
          : buildPath(assets, asset.id)
        return { asset, path }
      })
  }, [trimmed, assets, locations])

  // Click outside listener to close dropdown
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

  // Auto-expand ancestors when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
      if (value) {
        const ancestors = new Set<string>()
        
        // 1. Expand asset ancestors in asset view mode
        let curAsset: Asset | undefined = assets.find(c => c.id === value)
        while (curAsset?.parentId) {
          ancestors.add(curAsset.parentId)
          curAsset = assets.find(c => c.id === curAsset!.parentId)
        }
        
        // 2. Expand location and asset ancestors in location view mode
        let activeAsset: Asset | undefined = assets.find(c => c.id === value)
        if (activeAsset) {
          let parentAsset: Asset | undefined = activeAsset
          while (parentAsset) {
            ancestors.add(`asset-${parentAsset.id}`)
            parentAsset = parentAsset.parentId ? assets.find(a => a.id === parentAsset!.parentId) : undefined
          }
          
          if (activeAsset.locationId) {
            ancestors.add(`loc-${activeAsset.locationId}`)
            let curLoc: Location | undefined = locations.find(l => l.id === activeAsset!.locationId)
            while (curLoc?.parentId) {
              ancestors.add(`loc-${curLoc.parentId}`)
              curLoc = locations.find(l => l.id === curLoc!.parentId)
            }
          }
        }
        
        setExpanded(prev => new Set([...prev, ...ancestors]))
      }
    }
  }, [open, value, assets, locations, viewMode])

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(multiSelect ? [] : '')
  }

  function selectAll() {
    if (!multiSelect) return
    onChange(assets.map(a => a.id))
  }

  function deselectAll() {
    if (!multiSelect) return
    onChange([])
  }

  // Render Asset-Only Tree
  function renderAssetTree(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.id)
      const isSelected = selectedIds.includes(node.id)

      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => selectSingle(node.id)}
            className={`w-full flex items-center gap-2 py-2 pr-3 text-sm transition-colors text-left ${
              isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            {multiSelect ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="flex-shrink-0 w-4 h-4 cursor-pointer"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
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
            )}

            {multiSelect && hasChildren && (
              <span
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
                onClick={e => toggleExpand(node.id, e)}
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                }
              </span>
            )}

            {node.imageUrl ? (
              <img
                src={node.imageUrl}
                alt={node.name}
                className="w-4 h-4 rounded object-cover flex-shrink-0"
              />
            ) : (
              <Package className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            )}

            <span className="flex-1 truncate">
              <span className={depth === 0 ? 'font-medium' : 'font-normal'}>{node.name}</span>
              {node.assetCode && (
                <span className="ml-1.5 text-xs font-mono text-gray-400">({node.assetCode})</span>
              )}
            </span>

            {!multiSelect && isSelected && <span className="text-indigo-600 text-xs font-semibold">✓</span>}
          </button>

          {hasChildren && isExpanded && renderAssetTree(node.children, depth + 1)}
        </div>
      )
    })
  }

  // Render Combined Location-Asset Tree
  function renderCombinedTree(nodes: CombinedNode[], depth = 0): React.ReactNode {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.id)
      const isSelected = !node.isLocation && selectedIds.includes(node.assetId!)

      if (node.isLocation) {
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={hasChildren ? e => toggleExpand(node.id, e) : undefined}
              className="w-full flex items-center gap-2 py-2.5 pr-3 text-sm transition-colors text-left text-gray-500 hover:bg-gray-50/50 cursor-pointer"
              style={{ paddingLeft: `${12 + depth * 20}px` }}
            >
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {hasChildren ? (
                  isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                )}
              </span>

              <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />

              <span className="flex-1 truncate font-semibold text-xs uppercase tracking-wider text-gray-400">
                {node.name}
              </span>
            </button>

            {hasChildren && isExpanded && renderCombinedTree(node.children, depth + 1)}
          </div>
        )
      } else {
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => selectSingle(node.assetId!)}
              className={`w-full flex items-center gap-2 py-2 pr-3 text-sm transition-colors text-left ${
                isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
              style={{ paddingLeft: `${12 + depth * 20}px` }}
            >
              {multiSelect ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="flex-shrink-0 w-4 h-4 cursor-pointer"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
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
              )}

              {multiSelect && hasChildren && (
                <span
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
                  onClick={e => toggleExpand(node.id, e)}
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  }
                </span>
              )}

              {node.imageUrl ? (
                <img
                  src={node.imageUrl}
                  alt={node.name}
                  className="w-4 h-4 rounded object-cover flex-shrink-0"
                />
              ) : (
                <Package className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              )}

              <span className="flex-1 truncate">
                <span className="font-normal">{node.name}</span>
                {node.assetCode && (
                  <span className="ml-1.5 text-xs font-mono text-gray-400">({node.assetCode})</span>
                )}
              </span>

              {!multiSelect && isSelected && <span className="text-indigo-600 text-xs font-semibold">✓</span>}
            </button>

            {hasChildren && isExpanded && renderCombinedTree(node.children, depth + 1)}
          </div>
        )
      }
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
        {multiSelect && selectedIds.length > 0 ? (
          <>
            <span className="flex-1 text-sm text-gray-900 flex items-center gap-1 flex-wrap">
              {selectedIds.slice(0, 2).map((id, idx) => {
                const asset = assets.find(a => a.id === id)
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {asset?.name}
                  </span>
                )
              })}
              {selectedIds.length > 2 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  +{selectedIds.length - 2}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={clearValue}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : value && selectedAsset && !multiSelect ? (
          <>
            {selectedAsset.imageUrl ? (
              <img
                src={selectedAsset.imageUrl}
                alt={selectedAsset.name}
                className="w-4 h-4 rounded object-cover flex-shrink-0"
              />
            ) : (
              <Package className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            )}
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
          {/* Tabs segmented control */}
          <div className="flex border-b border-gray-100 p-1 bg-gray-50">
            <button
              type="button"
              onClick={() => setViewMode('asset')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'asset'
                  ? 'bg-white text-indigo-700 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📦 By Asset
            </button>
            <button
              type="button"
              onClick={() => setViewMode('location')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'location'
                  ? 'bg-white text-emerald-700 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📍 By Location
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={viewMode === 'location' ? "Search assets in locations…" : "Search assets…"}
              className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select All / Clear buttons for multi-select */}
          {multiSelect && (
            <div className="flex gap-2 px-3 py-2 border-b border-gray-100">
              <button
                type="button"
                onClick={selectAll}
                className="flex-1 px-2 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="flex-1 px-2 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Clear (single-select only) */}
          {!multiSelect && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch('') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              No asset
            </button>
          )}

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {loadingLocations ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400 animate-pulse">
                Loading locations hierarchy…
              </div>
            ) : assets.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">No assets available.</p>
            ) : trimmed ? (
              searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">No results for &ldquo;{search}&rdquo;</p>
              ) : (
                <>
                  {searchResults.map(({ asset, path }) => {
                    const isSelected = selectedIds.includes(asset.id)
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => selectSingle(asset.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                          isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {multiSelect ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="flex-shrink-0 w-4 h-4 cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          asset.imageUrl ? (
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              className="w-4 h-4 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          )
                        )}
                        {!multiSelect && (
                          <>
                            {asset.imageUrl ? (
                              <img
                                src={asset.imageUrl}
                                alt={asset.name}
                                className="w-4 h-4 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            )}
                          </>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {asset.name}
                            {asset.assetCode && (
                              <span className="ml-1.5 text-xs font-mono text-gray-400">({asset.assetCode})</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{path}</p>
                        </div>
                        {!multiSelect && isSelected && <span className="text-indigo-600 text-xs font-semibold">✓</span>}
                      </button>
                    )
                  })}
                  <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 text-right">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                </>
              )
            ) : viewMode === 'location' ? (
              locationCombinedTree.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">No locations configured.</p>
              ) : (
                renderCombinedTree(locationCombinedTree)
              )
            ) : (
              renderAssetTree(assetRootTree)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
