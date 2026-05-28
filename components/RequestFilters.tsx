'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search } from 'lucide-react'

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

  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('status') ||
    searchParams.get('priority')

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-3">
        {/* Search Bar */}
        <div className="relative col-span-1 sm:col-span-2 lg:flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search requests by title or code..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => updateFilter('search', e.target.value)}
            className="input-field pl-9 text-sm w-full bg-white font-medium text-slate-805 shadow-3xs"
          />
        </div>

        {/* Status Filter */}
        <select
          value={searchParams.get('status') ?? ''}
          onChange={e => updateFilter('status', e.target.value)}
          className="input-field text-sm bg-white cursor-pointer font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={searchParams.get('priority') ?? ''}
          onChange={e => updateFilter('priority', e.target.value)}
          className="input-field text-sm bg-white cursor-pointer font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {priorityOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all cursor-pointer active:scale-95 self-start sm:self-auto shadow-3xs bg-white border-slate-205 lg:shadow-none lg:bg-transparent lg:border-transparent lg:hover:bg-slate-105"
          >
            Clear filters
          </button>
        )}

        {isTransitioning && (
          <span className="text-xs text-slate-400 font-semibold self-center animate-pulse xl:ml-2 col-span-1 sm:col-span-2 lg:col-span-1">
            Updating list...
          </span>
        )}
      </div>
    </div>
  )
}
