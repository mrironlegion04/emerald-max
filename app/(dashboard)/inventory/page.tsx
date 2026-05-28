import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import EmptyState from '@/components/EmptyState'
import InventoryFilters from '@/components/InventoryFilters'
import ExportButton from '@/components/ExportButton'

interface SearchParams {
  search?: string
  page?:   string
  showDeleted?: string
}

const ITEMS_PER_PAGE = 25

function fmtCurrency(v: number | null) {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
}

async function getParts(filters: SearchParams) {
  const showDeleted = filters.showDeleted === 'true'
  const where: Record<string, unknown> = {}

  if (!showDeleted) {
    where.isDeleted = false
  }

  if (filters.search) {
    where.OR = [
      { name:       { contains: filters.search, mode: 'insensitive' } },
      { partNumber: { contains: filters.search, mode: 'insensitive' } },
      { description:{ contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const page = Math.max(1, parseInt(filters.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [parts, totalCount] = await Promise.all([
    prisma.part.findMany({
      where,
      include: {
        _count: { select: { usedInWorkOrders: true } },
      },
      orderBy: [{ name: 'asc' }],
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.part.count({ where }),
  ])

  return { parts, totalCount, page }
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const user    = await getCurrentUser()
  const params  = await searchParams
  const { parts, totalCount, page } = await getParts(params)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/inventory?${queryString.toString()}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Inventory"
        subtitle={`${totalCount} total · ${parts.length} showing`}
        action={
          <div className="flex gap-2">
            <ExportButton types={['inventory']} label="Export" canExport={canEdit} />
            {canEdit ? (
              <Link href="/inventory/new" className="btn-primary text-sm">+ Add part</Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-4">
        <InventoryFilters />
        <Link
          href={params.showDeleted === 'true' ? '/inventory' : '/inventory?showDeleted=true'}
          className={`text-sm whitespace-nowrap ${params.showDeleted === 'true' ? 'text-red-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {params.showDeleted === 'true' ? '✓ Showing deleted' : 'Show deleted'}
        </Link>
      </div>

      {parts.length === 0 ? (
        <EmptyState
          title="No parts found"
          description="Try adjusting your filters or add your first spare part."
          action={
            canEdit ? (
              <Link href="/inventory/new" className="btn-primary text-sm">Add first part</Link>
            ) : undefined
          }
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Part</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Part #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit cost</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parts.map(part => {
                  return (
                    <tr key={part.id} className={`hover:bg-gray-50 transition-colors ${part.isDeleted ? 'opacity-50 bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{part.name}</p>
                        {part.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{part.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {part.partNumber}
                          </span>
                          {(part as any).isDeleted && <Badge label="Deleted" variant="red" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{fmtCurrency(part.unitCost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/inventory/${part.id}`}
                            className="text-xs text-blue-600 hover:underline font-medium">View</Link>
                          {canEdit && !(part as any).isDeleted && (
                            <Link href={`/inventory/${part.id}/edit`}
                              className="text-xs text-gray-500 hover:underline font-medium">Edit</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=1'} className="btn-secondary text-sm">
                    ← First
                  </Link>
                )}
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page - 1}`} className="btn-secondary text-sm">
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page + 1}`} className="btn-secondary text-sm">
                    Next →
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${totalPages}`} className="btn-secondary text-sm">
                    Last →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
