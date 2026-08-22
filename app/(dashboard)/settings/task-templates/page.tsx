import PageHeader from '@/components/PageHeader'
import TaskTemplateManager from '@/components/TaskTemplateManager'

export default function TaskTemplatesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Task Templates"
        subtitle="Reusable checklists for PM schedules"
      />
      <TaskTemplateManager />
    </div>
  )
}
