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
    <div className="flex flex-wrap gap-3 mb-5">
      {/* Search Bar */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search requests..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => updateFilter('search', e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      {/* Status Filter */}
      <select
        value={searchParams.get('status') ?? ''}
        onChange={e => updateFilter('status', e.target.value)}
        className="input-field w-auto text-sm bg-white cursor-pointer"
      >
        {statusOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Priority Filter */}
      <select
        value={searchParams.get('priority') ?? ''}
        onChange={e => updateFilter('priority', e.target.value)}
        className="input-field w-auto text-sm bg-white cursor-pointer"
      >
        {priorityOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear Filters Button */}
      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Clear filters
        </button>
      )}

      {isTransitioning && (
        <span className="text-xs text-gray-400 self-center animate-pulse">Filtering...</span>
      )}
    </div>
  )
}
