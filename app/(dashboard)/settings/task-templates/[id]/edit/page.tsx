import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import TaskTemplateForm from '@/components/TaskTemplateForm'

interface Params {
  id: string
}

export default async function EditTaskTemplatePage({
  params,
}: {
  params: Promise<Params>
}) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const { id } = await params

  const template = await prisma.taskTemplate.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { order: 'asc' } },
    },
  })

  if (!template || template.isDeleted) notFound()

  const initialTasks = template.tasks.map(t => ({
    title: t.title,
    description: t.description ?? '',
    priority: t.priority,
    assignedToId: t.assignedToId ?? '',
    assignedTeamId: t.assignedTeamId ?? '',
    required: t.required,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TaskTemplateForm
        templateId={template.id}
        initialName={template.name}
        initialDescription={template.description ?? ''}
        initialTasks={initialTasks}
      />
    </div>
  )
}
