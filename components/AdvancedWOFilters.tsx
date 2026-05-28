'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState, useEffect } from 'react'
import { Search, Filter, X, Download, ChevronDown } from 'lucide-react'
import AssetTreeSelect from './AssetTreeSelect'

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
  const hasAnyFilter = ['search','status','priority','type','assignedToId','teamId', ...advancedKeys]
    .some(k => searchParams.get(k))

  // Auto-open advanced panel if any advanced filter is active
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

  return (
    <div className="space-y-4 mb-6">
      {/* Basic responsive filter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-3">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search work orders..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => update('search', e.target.value)}
            className="input-field pl-9 text-sm w-full bg-white font-medium text-slate-800 shadow-3xs"
          />
        </div>

        <select 
          value={searchParams.get('status') ?? ''} 
          onChange={e => update('status', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select 
          value={searchParams.get('priority') ?? ''} 
          onChange={e => update('priority', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select 
          value={searchParams.get('type') ?? ''} 
          onChange={e => update('type', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select 
          value={searchParams.get('assignedToId') ?? ''} 
          onChange={e => updateWithConflictCheck('assignedToId', e.target.value)} 
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors col-span-1 sm:col-span-2 lg:col-span-1"
        >
          <option value="">All assignees</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Advanced & utility actions */}
        <div className="flex flex-wrap items-center gap-2.5 col-span-1 sm:col-span-2 lg:col-span-1">
          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer flex-1 lg:flex-none shadow-3xs ${
              showAdvanced || hasAdvanced
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Advanced
            {hasAdvanced && <span className="w-1.5 h-1.5 bg-blue-650 rounded-full" />}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {/* Export with current filters */}
          {canExport && (
            <button
              onClick={doExport}
              disabled={exporting}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all active:scale-95 cursor-pointer flex-1 lg:flex-none shadow-3xs"
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

      {/* Advanced filter panel */}
      {showAdvanced && (
        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4.5 space-y-4 shadow-3xs">
          <p className="text-xs font-bold text-slate-550 uppercase tracking-widest">Advanced Filters</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Date Filters */}
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Due From</label>
              <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Due To</label>
              <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Created From</label>
              <input type="date" value={searchParams.get('createdFrom') ?? ''} onChange={e => update('createdFrom', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">Created To</label>
              <input type="date" value={searchParams.get('createdTo') ?? ''} onChange={e => update('createdTo', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">By Team</label>
              <select value={searchParams.get('teamId') ?? ''} onChange={e => updateWithConflictCheck('teamId', e.target.value)} className="input-field text-sm cursor-pointer">
                <option value="">All teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trade})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-420 uppercase tracking-wider mb-1">By Asset</label>
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
  )
}
