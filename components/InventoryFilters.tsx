'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search } from 'lucide-react'

export default function InventoryFilters() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const hasFilters = !!searchParams.get('search')

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search parts by name or part #..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => update('search', e.target.value)}
          className="input-field pl-9 text-sm w-full bg-white font-medium text-slate-805 shadow-3xs" />
      </div>
      {hasFilters && (
        <button onClick={() => router.push(pathname)}
          className="text-xs font-bold text-slate-550 hover:text-slate-800 px-3.5 py-2.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all cursor-pointer active:scale-95 self-start sm:self-auto">
          Clear filters
        </button>
      )}
      {isPending && <span className="text-xs font-semibold text-slate-400 animate-pulse self-center">Filtering...</span>}
    </div>
  )
}
