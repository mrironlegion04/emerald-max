import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import EmptyState from '@/components/EmptyState'
import { ClipboardList } from 'lucide-react'
import { fmt } from '@/lib/utils'

export default async function WOTemplatesPage() {
  const user = await getCurrentUser()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const templates = await prisma.workOrderTemplate.findMany({
    include: {
      assignedTo: { select: { name: true } },
      team:       { select: { name: true } },
      category:   { select: { name: true } },
      createdBy:  { select: { name: true } },
      _count:     { select: { procedures: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const typeLabels: Record<string, string> = { PREVENTIVE: 'Preventive', BREAKDOWN: 'Breakdown', PREDICTIVE: 'Predictive' }
  const priorityVariant = (p: string) => p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'orange' : p === 'LOW' ? 'gray' : 'yellow'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Work Order Templates"
        subtitle={`${templates.length} template${templates.length !== 1 ? 's' : ''}`}
        action={
          canEdit ? (
            <Link href="/work-order-templates/new" className="btn-primary text-sm">+ New template</Link>
          ) : undefined
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create reusable work order templates to speed up WO creation."
          action={
            canEdit ? (
              <Link href="/work-order-templates/new" className="btn-primary text-sm">Create first template</Link>
            ) : undefined
          }
          icon={<ClipboardList className="w-7 h-7" />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {templates.map(t => (
              <Link
                key={t.id}
                href={`/work-order-templates/${t.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {typeLabels[t.woType] ?? t.woType}
                    {t.assignedTo ? ` · ${t.assignedTo.name}` : ''}
                    {t.team ? ` · Team: ${t.team.name}` : ''}
                    {t._count.procedures > 0 ? ` · ${t._count.procedures} procedure${t._count.procedures !== 1 ? 's' : ''}` : ''}
                    {` · Created ${fmt(t.createdAt)}`}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Badge label={t.priority} variant={priorityVariant(t.priority)} />
                  {!t.isActive && <Badge label="Inactive" variant="gray" />}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
