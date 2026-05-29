'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState, useEffect } from 'react'
import { Search, Filter, X, Download, ChevronDown } from 'lucide-react'
import AssetTreeSelect from './AssetTreeSelect'
import FilterDrawer from './FilterDrawer'

interface Asset { id: string; name: string; assetCode: string | null; imageUrl?: string | null; categoryId?: string | null; parentId?: string | null }
interface User { id: string; name: string; role: string }
interface Team { id: string; name: string; trade: string }

interface Props {
  technicians: User[]
  teams: Team[]
  assets: Asset[]
  canExport?: boolean
}

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
  { value: 'CRITICAL', label: '🔴 Critical' },
  { value: 'HIGH',     label: '🟠 High' },
  { value: 'MEDIUM',   label: '🟡 Medium' },
  { value: 'LOW',      label: '🟢 Low' },
]
const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'PREVENTIVE', label: 'Preventive' },
  { value: 'PREDICTIVE', label: 'Predictive' },
]

export default function AdvancedWOFilters({ technicians, teams, assets, canExport = true }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams= useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const updateWithConflictCheck = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    // Clear conflicting filter
    if (key === 'teamId' && value) {
      params.delete('assignedToId') // Clear user filter when selecting team
    } else if (key === 'assignedToId' && value) {
      params.delete('teamId') // Clear team filter when selecting user
    }
    
    value ? params.set(key, value) : params.delete(key)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const advancedKeys = ['dueDateFrom','dueDateTo','createdFrom','createdTo','teamId','assetId']
  const hasAdvanced  = advancedKeys.some(k => searchParams.get(k))
  
  const filterKeys = ['status', 'priority', 'type', 'assignedToId', 'dueDateFrom', 'dueDateTo', 'createdFrom', 'createdTo', 'teamId', 'assetId']
  const activeCount = filterKeys.filter(k => !!searchParams.get(k)).length
  
  const hasAnyFilter = ['search','status','priority','type','assignedToId','teamId', ...advancedKeys]
    .some(k => searchParams.get(k))

  // Auto-open advanced panel if any advanced filter is active on desktop
  useEffect(() => { if (hasAdvanced) setShowAdvanced(true) }, [hasAdvanced])

  async function doExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set('type', 'work-orders')
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get('content-disposition') ?? ''
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? 'work-orders.csv'
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const handleClearAll = () => {
    router.push(pathname)
  }

  // Common inner filters to display either in Desktop View or the Mobile/Tablet Drawer
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
        <select value={searchParams.get('assignedToId') ?? ''} onChange={e => updateWithConflictCheck('assignedToId', e.target.value)} className="input-field w-full text-sm bg-white">
          <option value="">All assignees</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div id="drawer-filter-team" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">By Team</label>
        <select value={searchParams.get('teamId') ?? ''} onChange={e => updateWithConflictCheck('teamId', e.target.value)} className="input-field w-full text-sm bg-white">
          <option value="">All teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trade})</option>)}
        </select>
      </div>

      <div id="drawer-filter-asset" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">By Asset</label>
        <AssetTreeSelect
          assets={assets}
          value={searchParams.get('assetId') ?? ''}
          onChange={id => update('assetId', Array.isArray(id) ? id[0] ?? '' : id)}
          placeholder="All assets"
        />
      </div>

      <div id="drawer-filter-dates" className="space-y-3.5 pt-2.5 border-t border-dashed border-slate-150">
        <p className="text-xs font-bold text-slate-420 uppercase tracking-wider mb-1">Due Dates</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase">From</label>
            <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-xs bg-white mt-1" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase">To</label>
            <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-xs bg-white mt-1" />
          </div>
        </div>
      </div>

      <div id="drawer-filter-dates-created" className="space-y-3.5 pt-2.5 border-t border-dashed border-slate-150">
        <p className="text-xs font-bold text-slate-420 uppercase tracking-wider mb-1">Creation Dates</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase">From</label>
            <input type="date" value={searchParams.get('createdFrom') ?? ''} onChange={e => update('createdFrom', e.target.value)} className="input-field text-xs bg-white mt-1" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase">To</label>
            <input type="date" value={searchParams.get('createdTo') ?? ''} onChange={e => update('createdTo', e.target.value)} className="input-field text-xs bg-white mt-1" />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div id="work-orders-filter-container" className="mb-6 space-y-4">
      {/* 1. MOBILE RESPONSIVE FILTER ROW (< md) */}
      <div id="wo-filters-mobile" className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          {/* Search bar taking full width */}
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Search work orders..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-10 text-sm w-full bg-white shadow-3xs"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>

          {/* Compact visual filter trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 shadow-3xs focus:outline-none ${
              activeCount > 0
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-650'
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

        {/* Export / Clear buttons under */}
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-slate-150 pt-2.5">
          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold active:scale-97 transition-all shadow-3xs"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}

          {hasAnyFilter && (
            <button
              onClick={handleClearAll}
              className="text-xs text-rose-600 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
          {isPending && <span className="text-[10px] text-slate-400 font-medium">Filtering...</span>}
        </div>
      </div>

      {/* 2. TABLET RESPONSIVE HYBRID ROW (md to lg) */}
      <div id="wo-filters-tablet" className="hidden md:flex lg:hidden flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/85 p-3.5 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm group">
            <input
              type="text"
              placeholder="Search work orders..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-10 text-sm bg-slate-50/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>

          {/* Crucial status inline filter for quick access */}
          <select
            value={searchParams.get('status') ?? ''}
            onChange={e => update('status', e.target.value)}
            className="input-field w-40 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            {statusOptions.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all active:scale-95 shadow-3xs ${
              activeCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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

          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold active:scale-97 transition-all shadow-3xs"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}

          {hasAnyFilter && (
            <button
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* 3. DESKTOP ENTERPRISE-STYLE ROW (>= lg) */}
      <div id="wo-filters-desktop" className="hidden lg:block bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-xs group">
            <input
              type="text"
              placeholder="Search work orders..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-10 text-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
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

          <select value={searchParams.get('assignedToId') ?? ''} onChange={e => updateWithConflictCheck('assignedToId', e.target.value)} className="input-field w-auto text-sm">
            <option value="">All assignees</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all ${
              showAdvanced || hasAdvanced
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Advanced Filters</span>
            {hasAdvanced && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {/* Export with current filters */}
          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}

          {hasAnyFilter && (
            <button onClick={handleClearAll}
              className="text-xs text-slate-450 hover:text-slate-700 px-3 py-2 transition-colors flex items-center gap-1 font-bold">
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
          {isPending && <span className="text-xs text-slate-400 self-center font-semibold">Filtering...</span>}
        </div>

        {/* Large Inline Advanced filter panel */}
        {showAdvanced && (
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-4 select-none">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advanced Parameters</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Date Filters */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Due From</label>
                <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Due To</label>
                <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Created From</label>
                <input type="date" value={searchParams.get('createdFrom') ?? ''} onChange={e => update('createdFrom', e.target.value)} className="input-field text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Created To</label>
                <input type="date" value={searchParams.get('createdTo') ?? ''} onChange={e => update('createdTo', e.target.value)} className="input-field text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">By Team</label>
                <select value={searchParams.get('teamId') ?? ''} onChange={e => updateWithConflictCheck('teamId', e.target.value)} className="input-field text-sm bg-white">
                  <option value="">All teams</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trade})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">By Asset</label>
                <AssetTreeSelect
                  assets={assets}
                  value={searchParams.get('assetId') ?? ''}
                  onChange={id => update('assetId', Array.isArray(id) ? id[0] ?? '' : id)}
                  placeholder="All assets"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. REUSABLE DRAWER CONTAINER FOR MOBILE/TABLET */}
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

