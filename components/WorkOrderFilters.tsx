'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import FilterDrawer from './FilterDrawer'

interface User { id: string; name: string; role: string }

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
const priorityOptions = [
  { value: '', label: 'All priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]
const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'PREVENTIVE', label: 'Preventive' },
  { value: 'PREDICTIVE', label: 'Predictive' },
]

export default function WorkOrderFilters({ technicians }: { technicians: User[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const filterKeys = ['status', 'priority', 'type', 'assignedToId']
  const activeCount = filterKeys.filter(k => !!searchParams.get(k)).length
  const hasFilters = ['search','status','priority','type','assignedToId'].some(k => searchParams.get(k))

  const handleClearAll = () => {
    router.push(pathname)
  }

  const filterInputs = (
    <div className="space-y-4 font-sans text-sm">
      <div id="drawer-filter-status" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
        <select value={searchParams.get('status') ?? ''} onChange={e => update('status', e.target.value)} className="input-field w-full text-sm bg-white">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div id="drawer-filter-priority" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
        <select value={searchParams.get('priority') ?? ''} onChange={e => update('priority', e.target.value)} className="input-field w-full text-sm bg-white">
          {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div id="drawer-filter-type" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
        <select value={searchParams.get('type') ?? ''} onChange={e => update('type', e.target.value)} className="input-field w-full text-sm bg-white">
          {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div id="drawer-filter-assignee" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
        <select value={searchParams.get('assignedToId') ?? ''} onChange={e => update('assignedToId', e.target.value)} className="input-field w-full text-sm bg-white">
          <option value="">All assignees</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>
  )

  return (
    <div id="simple-wo-filters" className="mb-6 space-y-4">
      {/* 1. MOBILE VIEW */}
      <div id="wo-filters-simple-mobile" className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-9 text-sm w-full bg-white shadow-3xs"
            />
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
      <div id="wo-filters-simple-tablet" className="hidden md:flex lg:hidden flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/85 p-3.5 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <select value={searchParams.get('status') ?? ''} onChange={e => update('status', e.target.value)} className="input-field w-40 text-sm bg-white">
            <option value="">All Statuses</option>
            {statusOptions.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            {activeCount > 0 && <span className="text-xs bg-blue-600 text-white rounded-full px-1.5">{activeCount}</span>}
          </button>
          {hasFilters && (
            <button onClick={handleClearAll} className="text-xs text-slate-500 font-bold px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. DESKTOP VIEW */}
      <div id="wo-filters-simple-desktop" className="hidden lg:flex flex-wrap gap-3 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-3xs items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search work orders..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => update('search', e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        <select value={searchParams.get('status') ?? ''} onChange={e => update('status', e.target.value)} className="input-field w-auto text-sm">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={searchParams.get('priority') ?? ''} onChange={e => update('priority', e.target.value)} className="input-field w-auto text-sm">
          {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={searchParams.get('type') ?? ''} onChange={e => update('type', e.target.value)} className="input-field w-auto text-sm">
          {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={searchParams.get('assignedToId') ?? ''} onChange={e => update('assignedToId', e.target.value)} className="input-field w-auto text-sm">
          <option value="">All assignees</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {hasFilters && (
          <button onClick={handleClearAll}
            className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 font-bold">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        {isPending && <span className="text-xs text-slate-400 self-center">Filtering...</span>}
      </div>

      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Work Order Filters"
        activeCount={activeCount}
        onClear={handleClearAll}
      >
        {filterInputs}
      </FilterDrawer>
    </div>
  )
}

