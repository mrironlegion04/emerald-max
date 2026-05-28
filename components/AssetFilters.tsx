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
    <div className="flex flex-wrap gap-3 mb-5">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search assets..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => updateFilter('search', e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      {/* Status */}
      <select
        value={searchParams.get('status') ?? ''}
        onChange={e => updateFilter('status', e.target.value)}
        className="input-field w-auto text-sm"
      >
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={searchParams.get('categoryId') ?? ''}
        onChange={e => updateFilter('categoryId', e.target.value)}
        className="input-field w-auto text-sm"
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
        className="input-field w-auto text-sm"
      >
        <option value="">All locations</option>
        {locations.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      {/* Show deleted toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDeleted}
          onChange={e => updateFilter('showDeleted', e.target.checked ? 'true' : '')}
          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        Show deleted
      </label>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Clear filters
        </button>
      )}

      {isPending && (
        <span className="text-xs text-gray-400 self-center">Filtering...</span>
      )}
    </div>
  )
}
