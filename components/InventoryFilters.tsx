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
    <div className="flex flex-wrap gap-3 mb-5">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search parts..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => update('search', e.target.value)}
          className="input-field pl-9 text-sm" />
      </div>
      {hasFilters && (
        <button onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          Clear filters
        </button>
      )}
      {isPending && <span className="text-xs text-gray-400 self-center">Filtering...</span>}
    </div>
  )
}
