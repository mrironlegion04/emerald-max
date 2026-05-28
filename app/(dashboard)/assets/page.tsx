import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import { Building2, Package  } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Badge, { assetStatusVariant } from '@/components/Badge'
import EmptyState from '@/components/EmptyState'
import AssetFilters from '@/components/AssetFilters'
import ExportButton from '@/components/ExportButton'
import AssetViewToggle from '@/components/AssetViewToggle'

interface AssetWithRelations {
  id: string
  name: string
  assetCode: string
  status: string
  imageUrl?: string | null
  categoryId?: string | null
  locationId?: string | null
  parentId?: string | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  category?: { id: string; name: string } | null
  location?: { id: string; name: string } | null
  _count?: { workOrders: number; children: number } | null
}

interface SearchParams {
  search?: string
  status?: string
  categoryId?: string
  locationId?: string
  view?: string
  page?: string
  showDeleted?: string
}

const ITEMS_PER_PAGE = 25

async function getAssets(filters: SearchParams) {
  const where: Record<string, unknown> = {}

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { assetCode: { contains: filters.search, mode: 'insensitive' } },
      { serialNumber: { contains: filters.search, mode: 'insensitive' } },
      { manufacturer: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.status) where.status = filters.status
  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.locationId) where.locationId = filters.locationId

  // Soft-delete: hide deleted assets by default
  if (filters.showDeleted !== 'true') {
    where.isDeleted = false
  }

  // For hierarchy view, only show root assets (parentId = null)
  if (filters.view !== 'all') {
    where.parentId = null
  }

  const page = Math.max(1, parseInt(filters.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [assets, totalCount, categories, locations] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { workOrders: true, children: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.asset.count({ where }),
    prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
  ])

  return { assets, categories, locations, totalCount, page }
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  UNDER_MAINTENANCE: 'Under Maintenance',
  DECOMMISSIONED: 'Decommissioned',
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  const params = await searchParams
  const { assets, categories, locations, totalCount, page } = await getAssets(params)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const viewMode = (params.view || 'hierarchy') as 'hierarchy' | 'all'
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const queryString = new URLSearchParams(params as Record<string, string>)
  queryString.delete('page')
  const baseUrl = `/assets?${queryString.toString()}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Assets"
        subtitle={`${totalCount} total · ${assets.length} showing`}
        action={
          <div className="flex gap-2">
            <ExportButton types={['assets']} label="Export" canExport={canEdit} />
            {canEdit ? (
              <Link href="/assets/new" className="btn-primary text-sm">
                + Add asset
              </Link>
            ) : null}
          </div>
        }
      />

      <AssetFilters categories={categories} locations={locations} />

      {/* View toggle */}
      <AssetViewToggle currentView={viewMode} />

      {assets.length === 0 ? (
        <EmptyState
          title="No assets found"
          description={
            params.search || params.status || params.categoryId || params.locationId
              ? 'Try adjusting your filters.'
              : viewMode === 'hierarchy'
              ? 'Start by adding your first asset.'
              : 'No assets match your filters.'
          }
          action={
            canEdit ? (
              <Link href="/assets/new" className="btn-primary text-sm">
                Add first asset
              </Link>
            ) : undefined
          }
          icon={
            <Building2 className="w-7 h-7" />
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Photo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Asset</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  {viewMode === 'hierarchy' && (
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Children</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Work orders</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assets.map((asset: AssetWithRelations) => (
                  <tr key={asset.id} className={`hover:bg-gray-50 transition-colors ${asset.isDeleted ? 'opacity-50 bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      {asset.imageUrl ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"
                          title="No image available"
                          >
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{asset.name}</p>
                        {asset.manufacturer && (
                          <p className="text-xs text-gray-400">{asset.manufacturer}{asset.model ? ` · ${asset.model}` : ''}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {asset.assetCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{asset.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{asset.location?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {asset.isDeleted ? (
                        <Badge label="Deleted" variant="red" />
                      ) : (
                        <Badge
                          label={statusLabels[asset.status] ?? asset.status}
                          variant={assetStatusVariant(asset.status)}
                        />
                      )}
                    </td>
                    {viewMode === 'hierarchy' && (
                      <td className="px-4 py-3 text-gray-600">
                        {asset._count.children > 0 ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                            {asset._count.children}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600">{asset._count.workOrders}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          View
                        </Link>
                        {canEdit && (
                          <Link
                            href={`/assets/${asset.id}/edit`}
                            className="text-xs text-gray-500 hover:underline font-medium"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
