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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),_0_5px_15px_0_rgba(0,0,0,0.01)] overflow-hidden">
          {/* Mobile/Tablet Card View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {parts.map((part: any) => {
              return (
                <div key={part.id} className={`p-4.5 space-y-3.5 hover:bg-slate-50/20 transition-colors ${part.isDeleted ? 'opacity-60 bg-red-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-950 text-sm leading-snug">{part.name}</p>
                      {part.description && (
                        <p className="text-xs text-slate-500 font-medium mt-1 truncate max-w-sm">{part.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-mono text-[11px] font-bold bg-slate-100 border border-slate-200/60 text-slate-650 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                        Ref: {part.partNumber}
                      </span>
                      {(part as any).isDeleted && <Badge label="Deleted" variant="red" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-100">
                    <div className="text-xs font-semibold text-slate-500">
                      Unit Cost: <span className="font-bold text-slate-800 font-mono text-sm">{fmtCurrency(part.unitCost)}</span>
                    </div>
                    <div className="flex gap-3">
                      <Link
                        href={`/inventory/${part.id}`}
                        className="text-xs text-slate-500 hover:text-blue-600 font-bold active:scale-95 transition-all"
                      >
                        View Stock
                      </Link>
                      {canEdit && !(part as any).isDeleted && (
                        <Link
                          href={`/inventory/${part.id}/edit`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold active:scale-95 transition-all"
                        >
                          Configure
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50/50">
                  <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Part details</th>
                  <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Reference Code #</th>
                  <th className="text-left px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Estimated Unit Cost</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((part: any) => {
                  return (
                    <tr key={part.id} className={`hover:bg-slate-50/40 transition-colors ${part.isDeleted ? 'opacity-55 bg-rose-50/30' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900 block leading-tight">{part.name}</p>
                        {part.description && (
                          <p className="text-xs text-slate-400 font-medium mt-1 truncate max-w-sm">{part.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-slate-50 border border-slate-205 text-slate-650 px-2.5 py-1 rounded-lg shadow-3xs">
                            {part.partNumber}
                          </span>
                          {(part as any).isDeleted && <Badge label="Deleted" variant="red" />}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700">{fmtCurrency(part.unitCost)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 justify-end">
                          <Link href={`/inventory/${part.id}`}
                            className="text-xs text-blue-600 hover:text-blue-805 font-bold">View</Link>
                          {canEdit && !(part as any).isDeleted && (
                            <Link href={`/inventory/${part.id}/edit`}
                              className="text-xs text-slate-500 hover:text-slate-805 font-bold">Edit</Link>
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
            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/25">
              <div className="text-xs text-slate-500 font-medium">
                Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex gap-1.5">
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=1'} className="btn-secondary !text-xs py-1.5 px-3">
                    ← First
                  </Link>
                )}
                {page > 1 && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page - 1}`} className="btn-secondary !text-xs py-1.5 px-3">
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page + 1}`} className="btn-secondary !text-xs py-1.5 px-3">
                    Next →
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${totalPages}`} className="btn-secondary !text-xs py-1.5 px-3">
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
