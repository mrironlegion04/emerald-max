'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Search, X } from 'lucide-react'

export default function MyRequestsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', search.trim())
  }

  const status = searchParams.get('status') ?? ''

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-3">
      <form onSubmit={applySearch} className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search requests..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {search && (
          <button type="button" onClick={() => { setSearch(''); updateFilter('search', '') }} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
      <div className="flex flex-wrap gap-1.5">
        {[
          { value: '', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'CONVERTED', label: 'Converted' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => updateFilter('status', opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              status === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
