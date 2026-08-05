import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getWriteScopeIds, canWriteToAssets, hasScopeActionFlag } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import AssetForm from '@/components/AssetForm'

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !(await hasScopeActionFlag(user, 'canManageAssets')) || !(await hasPermission(user, 'asset:edit'))) redirect(`/assets/${id}`)

  const scopeIds = user ? await getWriteScopeIds(user) : null

  const scopeUserIds = scopeIds
    ? (await prisma.user.findMany({
        where: { userLocations: { some: { locationId: { in: scopeIds } } } },
        select: { id: true },
      })).map(u => u.id)
    : null

  const [asset, categories, assetTypes, locations, assets, users, domains] = await Promise.all([
    prisma.asset.findUnique({
      where: { id },
      include: { domains: { select: { domainId: true } } },
    }),
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

  if (!asset) notFound()

  // Plant isolation: only users who can write to THIS asset may reach the edit form
  if (user && !(await canWriteToAssets(user, [asset.id]))) redirect(`/assets/${id}`)

  const initialData = {
    name:         asset.name,
    assetCode:    asset.assetCode ?? undefined,
    description:  asset.description  ?? '',
    status:       asset.status,
    serialNumber: asset.serialNumber  ?? '',
    model:        asset.model         ?? '',
    manufacturer: asset.manufacturer  ?? '',
    purchaseDate: asset.purchaseDate
      ? new Date(asset.purchaseDate).toISOString().split('T')[0]
      : '',
    purchaseCost: asset.purchaseCost != null ? String(asset.purchaseCost) : '',
    categoryId:   asset.categoryId   ?? '',
    locationId:   asset.locationId   ?? '',
    meterUnit:    asset.meterUnit    ?? '',
    parentId:     asset.parentId     ?? '',
    assetTypeId:  asset.assetTypeId  ?? '',
    criticality:  asset.criticality  ?? '',
    ownerId:      asset.ownerId      ?? '',
    domainIds:    asset.domains.map(d => d.domainId),
    customFields: (asset.customFields && typeof asset.customFields === 'object' ? asset.customFields : null) as Record<string, any> | null,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href={`/assets/${id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to asset
        </Link>
      </div>
      <PageHeader title={`Edit: ${asset.name}`} subtitle={asset.assetCode || undefined} />
      <AssetForm
        categories={categories}
        assetTypes={assetTypes}
        locations={locations}
        assets={assets}
        users={users}
        domains={domains}
        initialData={initialData}
        assetId={id}
        currentImageUrl={asset.imageUrl}
      />
    </div>
  )
}
