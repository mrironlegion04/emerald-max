import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import TaskTemplateManager from '@/components/TaskTemplateManager'

interface SearchParams {
  page?: string
}

const ITEMS_PER_PAGE = 25

export default async function TaskTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * ITEMS_PER_PAGE

  const [templates, totalCount] = await Promise.all([
    prisma.taskTemplate.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      skip,
      take: ITEMS_PER_PAGE,
      include: {
        _count: { select: { tasks: true, pmSchedules: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
      }),
    prisma.taskTemplate.count({ where: { isDeleted: false } }),
  ])

  const serializedTemplates = templates.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
    updatedBy: t.updatedBy ? { id: t.updatedBy.id, name: t.updatedBy.name } : null,
  }))

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const baseUrl = '/settings/task-templates'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Task Templates"
        subtitle={`Reusable checklists for PM schedules · ${totalCount} total · ${serializedTemplates.length} showing`}
      />
      <TaskTemplateManager key={page} initialTemplates={serializedTemplates} />

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
