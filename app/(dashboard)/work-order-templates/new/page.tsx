import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderTemplateForm from '@/components/WorkOrderTemplateForm'

export default async function NewTemplatePage() {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/work-order-templates')

  const [users, teams, categories] = await Promise.all([
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
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/work-order-templates" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to templates
        </Link>
      </div>
      <PageHeader title="New work order template" subtitle="Create a reusable template for work orders." />
      <WorkOrderTemplateForm users={users} teams={teams} categories={categories} />
    </div>
  )
}
