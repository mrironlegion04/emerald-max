import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import IssueManager from '@/components/IssueManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [issues, domains, totalCount] = await Promise.all([
    prisma.issue.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: {
        domains: { include: { domain: true } },
        _count: { select: { workOrders: true } },
      },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.maintenanceDomain.findMany({ orderBy: { name: 'asc' } }),
    prisma.issue.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/issues'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Issues"
        subtitle={`Manage the issue library. Each issue belongs to one or more maintenance domains. · ${totalCount} total · ${issues.length} showing`}
      />
      <IssueManager key={page} initialIssues={issues} domains={domains} />

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
