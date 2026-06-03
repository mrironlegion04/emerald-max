import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import ProceduresManager from '@/components/ProceduresManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [procedures, totalCount] = await Promise.all([
    prisma.procedure.findMany({
      include: {
        steps: true,
        _count: { select: { pmSchedules: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.procedure.count(),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/procedures'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Procedures"
        subtitle={`Reusable step-by-step procedures that auto-apply to work orders based on assets, categories, locations, or PM schedules. · ${totalCount} total · ${procedures.length} showing`}
      />
      <ProceduresManager key={page} initialProcedures={procedures} />

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
