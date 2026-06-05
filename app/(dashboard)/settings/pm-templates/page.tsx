import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import PMTemplatesManager from '@/components/PMTemplatesManager'

export default async function PMTemplatesPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const [categories, procedures, initialTemplates] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.procedure.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.pMTemplate.findMany({
      include: {
        category: { select: { id: true, name: true } },
        procedures: {
          include: { procedure: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Category PM Templates"
        subtitle="Configure recurring preventive maintenance checklists that auto-apply to new assets depending on their classification."
      />
      <PMTemplatesManager
        categories={categories}
        procedures={procedures}
        initialTemplates={initialTemplates}
      />
    </div>
  )
}
