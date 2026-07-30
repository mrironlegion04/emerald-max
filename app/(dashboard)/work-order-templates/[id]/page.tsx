import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { fmt } from '@/lib/utils'

const typeLabels: Record<string, string> = { PREVENTIVE: 'Preventive', BREAKDOWN: 'Breakdown', PREDICTIVE: 'Predictive' }
const priorityVariant = (p: string) => p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'orange' : p === 'LOW' ? 'gray' : 'yellow'

export default async function TemplateDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const template = await prisma.workOrderTemplate.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { name: true } },
      team:       { select: { name: true } },
      category:   { select: { name: true } },
      createdBy:  { select: { name: true } },
    },
  })

  if (!template) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/work-order-templates" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to templates
        </Link>
      </div>
      <PageHeader
        title={template.name}
        subtitle={`${typeLabels[template.woType] ?? template.woType} template`}
        action={
          canEdit ? (
            <div className="flex gap-2">
              <Link href={`/work-order-templates/${template.id}/edit`} className="btn-secondary text-sm">
                Edit template
              </Link>
              <Link
                href={`/work-orders/new?templateId=${template.id}`}
                className="btn-primary text-sm"
              >
                Use template
              </Link>
            </div>
          ) : (
            <Link
              href={`/work-orders/new?templateId=${template.id}`}
              className="btn-primary text-sm"
            >
              Use template
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Template details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Status',   value: <Badge label={template.isActive ? 'Active' : 'Inactive'} variant={template.isActive ? 'green' : 'gray'} /> },
                { label: 'Type',     value: typeLabels[template.woType] ?? template.woType },
                { label: 'Priority', value: template.priority },
                ...(template.assignedTo ? [{ label: 'Assignee', value: template.assignedTo.name }] : []),
                ...(template.team ? [{ label: 'Team', value: template.team.name }] : []),
                ...(template.category ? [{ label: 'Category', value: template.category.name }] : []),
                { label: 'Created by', value: template.createdBy?.name ?? '—' },
                { label: 'Created',    value: fmt(template.createdAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center gap-4">
                  <dt className="text-xs text-gray-400 flex-shrink-0">{row.label}</dt>
                  <dd className="text-xs text-gray-900 font-medium text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Description */}
          {template.woDescription && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-2">Default description</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{template.woDescription}</p>
            </div>
          )}

          {/* Notes */}
          {template.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-2">Internal notes</h2>
              <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">{template.notes}</p>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Quick actions</h2>
            <div className="space-y-2">
              <Link
                href={`/work-orders/new?templateId=${template.id}`}
                className="btn-primary text-sm w-full text-center block"
              >
                Create work order from template
              </Link>
              {canEdit && (
                <Link
                  href={`/work-order-templates/${template.id}/edit`}
                  className="btn-secondary text-sm w-full text-center block"
                >
                  Edit template
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
