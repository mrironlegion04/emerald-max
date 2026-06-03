import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AssetCategoriesManager from '@/components/AssetCategoriesManager'

export default async function AssetCategoriesPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const [categories, domains, categoryDomainLinks] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { children: true, assets: true } } },
    }),
    prisma.maintenanceDomain.findMany({ orderBy: { name: 'asc' } }),
    prisma.categoryDomain.findMany({ select: { categoryId: true, domainId: true } }),
  ])

  // Build a map: categoryId → domainId[]
  const domainMap: Record<string, string[]> = {}
  for (const link of categoryDomainLinks) {
    if (!domainMap[link.categoryId]) domainMap[link.categoryId] = []
    domainMap[link.categoryId].push(link.domainId)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Asset Categories"
        subtitle="Hierarchical classification for assets. Assign maintenance domains to each category."
      />
      <AssetCategoriesManager
        initialCategories={categories}
        domains={domains}
        initialDomainMap={domainMap}
      />
    </div>
  )
}
