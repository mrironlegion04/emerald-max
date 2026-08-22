import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import TaskTemplateForm from '@/components/TaskTemplateForm'

export default async function NewTaskTemplatePage() {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TaskTemplateForm />
    </div>
  )
}
