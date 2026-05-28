'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search } from 'lucide-react'

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
  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('status') ||
    searchParams.get('categoryId') ||
    searchParams.get('locationId') ||
    showDeleted

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch lg:items-center gap-3">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search assets..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={e => updateFilter('search', e.target.value)}
            className="input-field pl-9 text-sm w-full bg-white font-medium text-slate-805 shadow-3xs"
          />
        </div>

        {/* Status */}
        <select
          value={searchParams.get('status') ?? ''}
          onChange={e => updateFilter('status', e.target.value)}
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Category */}
        <select
          value={searchParams.get('categoryId') ?? ''}
          onChange={e => updateFilter('categoryId', e.target.value)}
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Location */}
        <select
          value={searchParams.get('locationId') ?? ''}
          onChange={e => updateFilter('locationId', e.target.value)}
          className="input-field text-sm cursor-pointer bg-white font-semibold text-slate-705 shadow-3xs hover:border-slate-300 transition-colors"
        >
          <option value="">All locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Show deleted toggle */}
        <label className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-650 cursor-pointer hover:bg-slate-50 transition-colors shadow-3xs select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={e => updateFilter('showDeleted', e.target.checked ? 'true' : '')}
            className="w-4.5 h-4.5 rounded border-slate-300 text-blue-650 focus:ring-blue-500 cursor-pointer"
          />
          Show deleted
        </label>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 self-start sm:self-auto shadow-3xs bg-white border-slate-205 lg:shadow-none lg:bg-transparent lg:border-transparent lg:hover:bg-slate-100"
          >
            Clear filters
          </button>
        )}

        {isPending && (
          <span className="text-xs text-slate-400 font-semibold self-center animate-pulse xl:ml-2 col-span-1 sm:col-span-2 lg:col-span-1">
            Updating list...
          </span>
        )}
      </div>
    </div>
  )
}
