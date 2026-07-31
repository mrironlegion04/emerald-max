import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getWriteScopeIds } from '@/lib/access-control'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import AssetForm from '@/components/AssetForm'

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>
}) {
  const { parentId } = await searchParams
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/assets')

  const scopeIds = user ? await getWriteScopeIds(user) : null

  const scopeUserIds = scopeIds
    ? (await prisma.user.findMany({
        where: { userLocations: { some: { locationId: { in: scopeIds } } } },
        select: { id: true },
      })).map(u => u.id)
    : null

  const [categories, assetTypes, locations, assets, users, domains] = await Promise.all([
    prisma.assetCategory.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
    prisma.assetType.findMany({ orderBy: { name: 'asc' } }),
    prisma.location.findMany({
      where: scopeIds ? { id: { in: scopeIds } } : {},
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true, path: true },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, ...(scopeIds ? { locationId: { in: scopeIds } } : {}) },
      select: { id: true, name: true, assetCode: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      where: { isActive: true, ...(scopeUserIds ? { id: { in: scopeUserIds } } : {}) },
      orderBy: { name: 'asc' },
    }),
    prisma.maintenanceDomain.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/assets" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to assets
        </Link>
      </div>
      <PageHeader title="Add new asset" subtitle="Fill in the details below to register a new asset." />
      <AssetForm
        categories={categories}
        assetTypes={assetTypes}
        locations={locations}
        assets={assets}
        users={users}
        domains={domains}
        initialData={{ parentId: parentId || '' }}
      />
    </div>
  )
}
