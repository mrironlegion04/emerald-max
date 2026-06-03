import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import BOMTemplatesManager from '@/components/BOMTemplatesManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function BOMTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [templates, allParts, totalCount] = await Promise.all([
    prisma.bOMTemplate.findMany({
      include: {
        _count: { select: { parts: true } },
        parts: { include: { part: true } }
      },
      orderBy: { name: 'asc' },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.part.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } }),
    prisma.bOMTemplate.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/bom-templates'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader 
        title="BOM Templates" 
        subtitle={`Create reusable Bill of Materials to quickly assign common parts to multiple assets. · ${totalCount} total · ${templates.length} showing`}
      />
      <BOMTemplatesManager key={page} initialTemplates={templates} allParts={allParts} />

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
