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
    <div className="space-y-3 mb-5">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search schedules..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => update('search', e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        <select value={searchParams.get('frequency') ?? ''} onChange={e => update('frequency', e.target.value)} className="input-field w-auto text-sm">
          {freqOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={searchParams.get('isActive') ?? ''} onChange={e => update('isActive', e.target.value)} className="input-field w-auto text-sm">
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={searchParams.get('overdueOnly') === 'true'}
            onChange={e => update('overdueOnly', e.target.checked ? 'true' : '')}
            className="w-4 h-4 text-red-600 rounded"
          />
          Overdue only
        </label>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showAdvanced || hasAdvanced
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Advanced
          {hasAdvanced && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {canExport && (
          <button
            onClick={doExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        )}

        {hasAnyFilter && (
          <button onClick={() => router.push(pathname)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
        {isPending && <span className="text-xs text-gray-400 self-center">Filtering...</span>}
      </div>

      {showAdvanced && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Advanced Filters</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset</label>
              <select value={searchParams.get('assetId') ?? ''} onChange={e => update('assetId', e.target.value)} className="input-field text-sm">
                <option value="">All assets</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due From</label>
              <input type="date" value={searchParams.get('dueDateFrom') ?? ''} onChange={e => update('dueDateFrom', e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due To</label>
              <input type="date" value={searchParams.get('dueDateTo') ?? ''} onChange={e => update('dueDateTo', e.target.value)} className="input-field text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
