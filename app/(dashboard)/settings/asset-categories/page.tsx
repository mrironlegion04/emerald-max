import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import AssetCategoriesManager from '@/components/AssetCategoriesManager'

export default async function AssetCategoriesPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  const categories = await prisma.assetCategory.findMany({
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { children: true, assets: true } } },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Asset Categories"
        subtitle="Hierarchical classification for assets."
      />
      <AssetCategoriesManager
        initialCategories={categories}
      />
    </div>
  )
}
