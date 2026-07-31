'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Factory } from 'lucide-react'

interface Plant {
  id: string
  name: string
}

const COOKIE_NAME = 'activeLocation'

export default function LocationSwitcher({
  plants,
  activeLocationId,
}: {
  plants: Plant[]
  activeLocationId?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('location') ?? activeLocationId ?? 'all'

  const onChange = useCallback((value: string) => {
    if (value === 'all') {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
    } else {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`
    }
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('location')
    else params.set('location', value)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  return (
    <div className="flex items-center gap-1.5">
      <Factory className="w-4 h-4 text-slate-400" />
      <select
        value={current}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-label="Switch plant"
      >
        <option value="all">All plants</option>
        {plants.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}
