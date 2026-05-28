import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import DomainsManager from '@/components/DomainsManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [domains, totalCount] = await Promise.all([
    prisma.maintenanceDomain.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { issues: true, categories: true } } },
      skip,
      take: ITEMS_PER_PAGE,
    }).then(domains => domains.map(d => ({ ...d, description: d.description ?? null, isActive: d.isActive ?? true }))),
    prisma.maintenanceDomain.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/domains'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Maintenance Domains"
        subtitle={`Define domains like Hydraulic, Electrical, Mechanical. Issues are grouped by domain. · ${totalCount} total · ${domains.length} showing`}
      />
      <DomainsManager key={page} initialDomains={domains} />

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
