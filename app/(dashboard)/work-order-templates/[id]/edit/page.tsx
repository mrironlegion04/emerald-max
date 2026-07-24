import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderTemplateForm from '@/components/WorkOrderTemplateForm'

export default async function EditTemplatePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect(`/work-order-templates/${id}`)

  const [template, users, teams, categories, procedures] = await Promise.all([
    prisma.workOrderTemplate.findUnique({
      where: { id },
      include: {
        procedures: {
          include: { procedure: true },
        },
      },
    }),
    prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assetCategory.findMany({
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.procedure.findMany({
      select:  { id: true, name: true, description: true, steps: { select: { id: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!template) notFound()

  const initialData = {
    name:          template.name,
    description:   template.description ?? '',
    woType:        template.woType,
    priority:      template.priority,
    woDescription: template.woDescription ?? '',
    notes:         template.notes ?? '',
    assignedToId:  template.assignedToId ?? '',
    teamId:        template.teamId ?? '',
    categoryId:    template.categoryId ?? '',
    procedures:    template.procedures,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/work-order-templates/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to template
        </Link>
      </div>
      <PageHeader title={`Edit: ${template.name}`} />
      <WorkOrderTemplateForm
        users={users} teams={teams} categories={categories} procedures={procedures}
        initialData={initialData} templateId={id}
      />
    </div>
  )
}
