'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search } from 'lucide-react'

interface User { id: string; name: string; role: string }

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
const priorityOptions = [
  { value: '', label: 'All priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]
const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'PREVENTIVE', label: 'Preventive' },
  { value: 'PREDICTIVE', label: 'Predictive' },
]

export default function WorkOrderFilters({ technicians }: { technicians: User[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  const hasFilters = ['search','status','priority','type','assignedToId']
    .some(k => searchParams.get(k))

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search work orders..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => update('search', e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      <select value={searchParams.get('status') ?? ''} onChange={e => update('status', e.target.value)} className="input-field w-auto text-sm">
        {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={searchParams.get('priority') ?? ''} onChange={e => update('priority', e.target.value)} className="input-field w-auto text-sm">
        {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={searchParams.get('type') ?? ''} onChange={e => update('type', e.target.value)} className="input-field w-auto text-sm">
        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={searchParams.get('assignedToId') ?? ''} onChange={e => update('assignedToId', e.target.value)} className="input-field w-auto text-sm">
        <option value="">All assignees</option>
        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

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
