'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Factory } from 'lucide-react'

interface Plant {
  id: string
  name: string
}

export default function LocationSwitcher({ plants }: { plants: Plant[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('location') ?? 'all'

  const onChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('location')
    else params.set('location', value)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  if (plants.length < 2) return null

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
