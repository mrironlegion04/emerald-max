'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'

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

  const handleClearAll = () => {
    router.push(pathname)
  }

  return (
    <div id="inventory-filters-container" className="mb-6 flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[240px] max-w-md group">
        <input 
          type="text" 
          placeholder="Search inventory parts by name or SKU..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => update('search', e.target.value)}
          className="input-field pl-11 text-sm w-full bg-white shadow-3xs" 
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none z-10 group-focus-within:text-blue-500 transition-colors" />
      </div>
      
      {hasFilters && (
        <button 
          onClick={handleClearAll}
          className="text-xs text-rose-600 font-bold px-3 py-2 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1 active:scale-97"
        >
          <X className="w-3.5 h-3.5" /> Clear search
        </button>
      )}
      
      {isPending && (
        <span className="text-xs text-slate-400 font-medium animate-pulse ml-2">Searching...</span>
      )}
    </div>
  )
}

