'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import FilterDrawer from './FilterDrawer'

interface Category { id: string; name: string }
interface Location { id: string; name: string }

interface Props {
  categories: Category[]
  locations: Location[]
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
]

export default function AssetFilters({ categories, locations }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  const showDeleted = searchParams.get('showDeleted') === 'true'
  
  const filterKeys = ['status', 'categoryId', 'locationId', 'showDeleted']
  const activeCount = filterKeys.filter(k => !!searchParams.get(k)).length
  
  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('status') ||
    searchParams.get('categoryId') ||
    searchParams.get('locationId') ||
    showDeleted

  const handleClearAll = () => {
    router.push(pathname)
  }

  const filterInputs = (
    <div className="space-y-4 font-sans text-sm">
      <div id="drawer-filter-status" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
        <select
          value={searchParams.get('status') ?? ''}
          onChange={e => updateFilter('status', e.target.value)}
          className="input-field w-full text-sm bg-white"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div id="drawer-filter-category" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
        <select
          value={searchParams.get('categoryId') ?? ''}
          onChange={e => updateFilter('categoryId', e.target.value)}
          className="input-field w-full text-sm bg-white"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div id="drawer-filter-location" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
        <select
          value={searchParams.get('locationId') ?? ''}
          onChange={e => updateFilter('locationId', e.target.value)}
          className="input-field w-full text-sm bg-white"
        >
          <option value="">All locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div id="drawer-filter-deleted" className="pt-3 border-t border-dashed border-slate-150">
        <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={e => updateFilter('showDeleted', e.target.checked ? 'true' : '')}
            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          Show deleted assets
        </label>
      </div>
    </div>
  )

  return (
    <div id="asset-filters-container" className="mb-6 space-y-4">
      {/* 1. MOBILE FILTER VIEW */}
      <div id="asset-filters-mobile" className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Search assets..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => updateFilter('search', e.target.value)}
              className="input-field pl-10 text-sm w-full bg-white shadow-3xs"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 shadow-3xs focus:outline-none ${
              activeCount > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-650'
            }`}
          >
            <Filter className="w-5 h-5" />
            {activeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-white text-blue-700 rounded-full">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {hasFilters && (
          <div className="flex justify-end border-t border-dashed border-slate-150 pt-2">
            <button onClick={handleClearAll} className="text-xs text-rose-600 font-bold px-3 py-1 bg-rose-50 rounded-lg transition-colors flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}
      </div>

      {/* 2. TABLET HYBRID VIEW */}
      <div id="asset-filters-tablet" className="hidden md:flex lg:hidden flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/85 p-3.5 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm group">
            <input
              type="text"
              placeholder="Search assets..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => updateFilter('search', e.target.value)}
              className="input-field pl-10 text-sm bg-slate-50/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <select
            value={searchParams.get('status') ?? ''}
            onChange={e => updateFilter('status', e.target.value)}
            className="input-field w-40 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            {statusOptions.slice(1).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all shadow-3xs ${
              activeCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-650'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>More Filters</span>
            {activeCount > 0 && (
              <span className="flex items-center justify-center bg-blue-600 text-white font-extrabold text-[9px] h-4.5 px-1.5 rounded-full min-w-4.5">
                {activeCount}
              </span>
            )}
          </button>
          {hasFilters && (
            <button onClick={handleClearAll} className="text-xs text-slate-500 font-bold px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1 opacity-80 hover:opacity-100">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. DESKTOP ENTERPRISE VIEW */}
      <div id="asset-filters-desktop" className="hidden lg:flex flex-wrap items-center gap-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm group">
          <input
            type="text"
            placeholder="Search assets..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => updateFilter('search', e.target.value)}
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
        </div>

        <select
          value={searchParams.get('status') ?? ''}
          onChange={e => updateFilter('status', e.target.value)}
          className="input-field w-auto text-sm bg-white"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={searchParams.get('categoryId') ?? ''}
          onChange={e => updateFilter('categoryId', e.target.value)}
          className="input-field w-auto text-sm bg-white"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={searchParams.get('locationId') ?? ''}
          onChange={e => updateFilter('locationId', e.target.value)}
          className="input-field w-auto text-sm bg-white"
        >
          <option value="">All locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-650 cursor-pointer select-none font-semibold hover:text-slate-900 transition-colors">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={e => updateFilter('showDeleted', e.target.checked ? 'true' : '')}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          Show deleted
        </label>

        {hasFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors font-bold ml-auto flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Clear all
          </button>
        )}

        {isPending && (
          <span className="text-xs text-slate-400 self-center font-semibold animate-pulse">Filtering...</span>
        )}
      </div>

      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Asset Filters"
        activeCount={activeCount}
        onClear={handleClearAll}
      >
        {filterInputs}
      </FilterDrawer>
    </div>
  )
}
