'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Search, Filter, X, Download, ChevronDown } from 'lucide-react'

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

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const advancedKeys = ['assetId','dueDateFrom','dueDateTo']
  const hasAdvanced  = advancedKeys.some(k => searchParams.get(k))
  const hasAnyFilter = ['search','frequency','isActive','overdueOnly', ...advancedKeys].some(k => searchParams.get(k))

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

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-3">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search schedules..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => update('search', e.target.value)}
            className="input-field pl-9 text-sm w-full bg-white font-medium text-slate-805 shadow-3xs"
          />
        </div>

        <select 
          value={searchParams.get('frequency') ?? ''} 
          onChange={e => update('frequency', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select 
          value={searchParams.get('isActive') ?? ''} 
          onChange={e => update('isActive', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>

        <label className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-650 cursor-pointer hover:bg-slate-50 transition-colors shadow-3xs select-none">
          <input
            type="checkbox"
            checked={searchParams.get('overdueOnly') === 'true'}
            onChange={e => update('overdueOnly', e.target.checked ? 'true' : '')}
            className="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          Overdue only
        </label>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 col-span-1 sm:col-span-2 lg:col-span-1">
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer flex-1 lg:flex-none shadow-3xs ${
              showAdvanced || hasAdvanced
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-202 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Advanced
            {hasAdvanced && <span className="w-1.5 h-1.5 bg-blue-650 rounded-full" />}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-202 bg-white text-slate-655 hover:bg-slate-50 text-xs font-bold transition-all active:scale-95 cursor-pointer flex-1 lg:flex-none shadow-3xs"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}

          {hasAnyFilter && (
            <button 
              onClick={() => router.push(pathname)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 flex-1 lg:flex-none"
            >
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>

        {isPending && (
          <span className="text-xs text-slate-400 font-semibold self-center animate-pulse xl:ml-2 col-span-1 sm:col-span-2 lg:col-span-1">
            Updating list...
          </span>
        )}
      </div>

      {showAdvanced && (
        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4.5 space-y-4 shadow-3xs">
          <p className="text-xs font-bold text-slate-550 uppercase tracking-widest">Advanced Filters</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Asset</label>
              <select value={searchParams.get('assetId') ?? ''} onChange={e => update('assetId', e.target.value)} className="input-field text-sm cursor-pointer bg-white">
                <option value="">All assets</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Due From</label>
              <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Due To</label>
              <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
