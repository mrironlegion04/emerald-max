export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import AssetTypesManager from '@/components/AssetTypesManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function AssetTypesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [types, totalCount] = await Promise.all([
    prisma.assetType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } } },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.assetType.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/asset-types'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Asset Types"
        subtitle={`Simple labels used for grouping and filtering assets (e.g. Equipment, Vehicle, Tool) · ${totalCount} total · ${types.length} showing`}
      />
      <AssetTypesManager key={page} initialTypes={types} />

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-5 border-t border-gray-200 mt-6 rounded-xl bg-white">
          <div className="text-sm text-gray-600">
            Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={baseUrl + '?page=1'} className="btn-secondary text-sm">
                ← First
              </Link>
            )}
            {page > 1 && (
              <Link href={baseUrl + `?page=${page - 1}`} className="btn-secondary text-sm">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={baseUrl + `?page=${page + 1}`} className="btn-secondary text-sm">
                Next →
              </Link>
            )}
            {page < totalPages && (
              <Link href={baseUrl + `?page=${totalPages}`} className="btn-secondary text-sm">
                Last →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
