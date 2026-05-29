'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Search, Filter, X, Download, ChevronDown } from 'lucide-react'
import FilterDrawer from './FilterDrawer'

interface Asset { id: string; name: string; assetCode: string | null }

interface Props {
  assets: Asset[]
  canExport?: boolean
}

const freqOptions = [
  { value: '', label: 'All frequencies' },
  { value: 'DAILY',     label: 'Daily' },
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY',    label: 'Yearly' },
]

export default function AdvancedPMFilters({ assets, canExport = true }: Props) {
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

  const advancedKeys = ['assetId','dueDateFrom','dueDateTo']
  const filterKeys   = ['frequency','isActive','overdueOnly', ...advancedKeys]
  const hasAdvanced  = advancedKeys.some(k => searchParams.get(k))
  const activeCount  = filterKeys.filter(k => !!searchParams.get(k)).length
  const hasAnyFilter = ['search', ...filterKeys].some(k => searchParams.get(k))

  async function doExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set('type', 'pm-schedules')
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get('content-disposition') ?? ''
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? 'pm-schedules.csv'
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

  const filterInputs = (
    <div className="space-y-4 font-sans text-sm">
      <div id="drawer-pm-freq" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</label>
        <select value={searchParams.get('frequency') ?? ''} onChange={e => update('frequency', e.target.value)} className="input-field w-full text-sm bg-white">
          {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div id="drawer-pm-status" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
        <select value={searchParams.get('isActive') ?? ''} onChange={e => update('isActive', e.target.value)} className="input-field w-full text-sm bg-white">
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      <div id="drawer-pm-asset" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset</label>
        <select value={searchParams.get('assetId') ?? ''} onChange={e => update('assetId', e.target.value)} className="input-field w-full text-sm bg-white">
          <option value="">All assets</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>)}
        </select>
      </div>

      <div id="drawer-pm-from" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Due From</label>
        <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field w-full text-sm bg-white" />
      </div>

      <div id="drawer-pm-to" className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Due To</label>
        <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field w-full text-sm bg-white" />
      </div>

      <div id="drawer-pm-overdue" className="pt-3 border-t border-dashed border-slate-150">
        <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={searchParams.get('overdueOnly') === 'true'}
            onChange={e => update('overdueOnly', e.target.checked ? 'true' : '')}
            className="w-5 h-5 text-red-600 rounded border-slate-300"
          />
          Overdue Only
        </label>
      </div>
    </div>
  )

  return (
    <div id="pm-filters-container" className="mb-6 space-y-4">
      {/* 1. MOBILE RESPONSIVE pm filters */}
      <div id="pm-filters-mobile" className="flex md:hidden flex-col gap-2.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Search schedules..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
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

        <div className="flex items-center justify-between gap-2 border-t border-dashed border-slate-150 pt-2">
          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-655 hover:bg-slate-50 text-xs font-bold bg-white"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}

          {hasAnyFilter && (
            <button onClick={handleClearAll} className="text-xs text-rose-600 font-bold px-3 py-1.5 bg-rose-50 rounded-lg transition-colors flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* 2. TABLET RESPONSIVE HYBRID ROW (md to lg) */}
      <div id="pm-filters-tablet" className="hidden md:flex lg:hidden flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/85 p-3.5 rounded-2xl shadow-3xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm group">
            <input
              type="text"
              placeholder="Search schedules..."
              defaultValue={searchParams.get('search') ?? ''}
              onChange={e => update('search', e.target.value)}
              className="input-field pl-10 text-sm bg-slate-50/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <select value={searchParams.get('frequency') ?? ''} onChange={e => update('frequency', e.target.value)} className="input-field w-36 text-sm bg-white">
            <option value="">Frequencies</option>
            {freqOptions.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all shadow-3xs ${
              activeCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-650'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>More Filters</span>
            {activeCount > 0 && <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 font-bold">{activeCount}</span>}
          </button>

          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-650 hover:bg-slate-50 text-sm font-bold bg-white"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}

          {hasAnyFilter && (
            <button onClick={handleClearAll} className="text-xs text-slate-500 font-bold px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. DESKTOP ENTERPRISE-STYLE INLINE ROW */}
      <div id="pm-filters-desktop" className="hidden lg:flex flex-wrap gap-3 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-3xs items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm group">
          <input
            type="text"
            placeholder="Search schedules..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => update('search', e.target.value)}
            className="input-field pl-10 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
        </div>

        <select value={searchParams.get('frequency') ?? ''} onChange={e => update('frequency', e.target.value)} className="input-field w-auto text-sm">
          {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={searchParams.get('isActive') ?? ''} onChange={e => update('isActive', e.target.value)} className="input-field w-auto text-sm">
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-750 cursor-pointer hover:bg-slate-50 select-none shadow-3xs">
          <input
            type="checkbox"
            checked={searchParams.get('overdueOnly') === 'true'}
            onChange={e => update('overdueOnly', e.target.checked ? 'true' : '')}
            className="w-4 h-4 text-red-600 rounded border-slate-350 focus:ring-red-500"
          />
          Overdue only
        </label>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all shadow-3xs ${
            showAdvanced || hasAdvanced
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Advanced</span>
          {hasAdvanced && <span className="w-2 h-2 bg-blue-650 rounded-full" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {canExport && (
          <button
            onClick={doExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 text-sm font-bold transition-all shadow-3xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        )}

        {hasAnyFilter && (
          <button onClick={handleClearAll}
            className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 font-bold">
            <X className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
        {isPending && <span className="text-xs text-slate-400 self-center font-bold">Filtering...</span>}
      </div>

      {showAdvanced && (
        <div id="pm-filters-desktop-advanced" className="bg-blue-50/50 border border-blue-100/70 rounded-2xl p-4.5 space-y-3.5 shadow-3xs hidden lg:block">
          <p className="text-xs font-black text-blue-700 uppercase tracking-wider">Advanced Schedule Filters</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-550">Asset</label>
              <select value={searchParams.get('assetId') ?? ''} onChange={e => update('assetId', e.target.value)} className="input-field text-sm bg-white">
                <option value="">All assets</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-550">Due From</label>
              <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-sm bg-white" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-550">Due To</label>
              <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-sm bg-white" />
            </div>
          </div>
        </div>
      )}

      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Schedule Filters"
        activeCount={activeCount}
        onClear={handleClearAll}
      >
        {filterInputs}
      </FilterDrawer>
    </div>
  )
}
