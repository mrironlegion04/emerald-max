import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import ChecklistTemplateForm from '@/components/ChecklistTemplateForm'

export default async function NewChecklistTemplatePage() {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const [assets, locations, assetCategories] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assetCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/settings/checklist-templates" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to templates
        </Link>
      </div>
      <PageHeader title="New Checklist Template" subtitle="Create a reusable checklist that can be auto-applied to work orders." />
      <ChecklistTemplateForm
        assets={assets}
        locations={locations}
        assetCategories={assetCategories}
      />
    </div>
  )
}
