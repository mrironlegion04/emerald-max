'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import FilterDrawer from './FilterDrawer'

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CONVERTED', label: 'Converted to WO' },
]

const priorityOptions = [
  { value: '', label: 'All priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

export default function RequestFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isTransitioning, startTransition] = useTransition()
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

  const filterKeys = ['status', 'priority']
  const activeCount = filterKeys.filter(k => !!searchParams.get(k)).length

  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('status') ||
    searchParams.get('priority')

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

      <div id="drawer-filter-priority" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
        <select
          value={searchParams.get('priority') ?? ''}
          onChange={e => updateFilter('priority', e.target.value)}
          className="input-field w-full text-sm bg-white"
        >
          {priorityOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <div id="request-filters-container" className="mb-6 space-y-4">
      {/* 1. MOBILE RESPONSIVE FILTER ROW */}
      <div id="request-filters-mobile" className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Search requests..."
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

      {/* 2. TABLET RESPONSIVE HYBRID ROW (md to lg) */}
      <div id="request-filters-tablet" className="hidden md:flex lg:hidden flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/85 p-3.5 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm group">
            <input
              type="text"
              placeholder="Search requests..."
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
            <button onClick={handleClearAll} className="text-xs text-slate-500 font-bold px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. DESKTOP ENTERPRISE-STYLE INLINE ROW */}
      <div id="request-filters-desktop" className="hidden lg:flex flex-wrap gap-3 p-4 bg-white border border-slate-200/95 rounded-2xl shadow-3xs items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm group">
          <input
            type="text"
            placeholder="Search requests..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => updateFilter('search', e.target.value)}
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
        </div>

        <select
          value={searchParams.get('status') ?? ''}
          onChange={e => updateFilter('status', e.target.value)}
          className="input-field w-auto text-sm bg-white cursor-pointer"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={searchParams.get('priority') ?? ''}
          onChange={e => updateFilter('priority', e.target.value)}
          className="input-field w-auto text-sm bg-white cursor-pointer"
        >
          {priorityOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors font-bold ml-auto flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Clear all
          </button>
        )}

        {isTransitioning && (
          <span className="text-xs text-slate-400 self-center animate-pulse font-semibold">Filtering...</span>
        )}
      </div>

      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Request Filters"
        activeCount={activeCount}
        onClear={handleClearAll}
      >
        {filterInputs}
      </FilterDrawer>
    </div>
  )
}
