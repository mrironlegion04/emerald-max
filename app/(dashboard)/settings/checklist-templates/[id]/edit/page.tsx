import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import ChecklistTemplateForm from '@/components/ChecklistTemplateForm'

export default async function EditChecklistTemplatePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) redirect('/dashboard')

  const { id } = await params
  const [template, assets, locations, assetCategories] = await Promise.all([
    prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        locations: true,
        categories: true,
        assets: true,
      },
    }),
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
  if (!template) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/settings/checklist-templates" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to templates
        </Link>
      </div>
      <PageHeader
        title={`Edit: ${template.name}`}
        subtitle="Update the template name, checklist items, and tag associations."
      />
      <ChecklistTemplateForm
        templateId={template.id}
        initialData={{
          name:       template.name,
          description:template.description ?? '',
          items:      template.items.map(i => ({
            id:          i.id,
            label:       i.label,
            type:        i.type,
            isMandatory: i.isMandatory,
            options:     i.options,
            sortOrder:   i.sortOrder,
          })),
          assetIds:    template.assets.map(a => a.id),
          categoryIds: template.categories.map(c => c.id),
          locationIds: template.locations.map(l => l.id),
        }}
        assets={assets}
        locations={locations}
        assetCategories={assetCategories}
      />
    </div>
  )
}
