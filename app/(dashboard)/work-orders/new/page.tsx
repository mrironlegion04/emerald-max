import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPickerScope, getWriteScopeIds } from '@/lib/access-control'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderForm from '@/components/WorkOrderForm'

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string; locationId?: string; location?: string }>
}) {
  const { assetId, locationId, location } = await searchParams
  const user = await getCurrentUser()
  const scopeIds = user ? await getWriteScopeIds(user, location) : null
  const { assetFilter, userFilter } = user
    ? await getPickerScope(user.userId, scopeIds)
    : { assetFilter: null, userFilter: null }

  const scopeUserIds = scopeIds
    ? (await prisma.user.findMany({
        where: { userLocations: { some: { locationId: { in: scopeIds } } } },
        select: { id: true },
      })).map(u => u.id)
    : null

  const [assets, locations, users, teams] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: 'DECOMMISSIONED' }, ...(assetFilter ?? {}) },
      select: { id: true, name: true, assetCode: true, imageUrl: true, categoryId: true, parentId: true, locationId: true, description: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      where: scopeIds ? { id: { in: scopeIds } } : {},
      select: { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true, ...(userFilter ?? {}) },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: { isActive: true, ...(scopeUserIds ? { members: { some: { userId: { in: scopeUserIds } } } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/work-orders" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to work orders
        </Link>
      </div>
      <PageHeader
        title="New work order"
        subtitle="Fill in the details to create a new work order."
      />
      <WorkOrderForm assets={assets} locations={locations} users={users} teams={teams} preselectedAssetId={assetId} preselectedLocationId={locationId} />
    </div>
  )
}
