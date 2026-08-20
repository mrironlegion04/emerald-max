import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getPickerScope, getWriteScopeIds, hasScopeActionFlag } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PMScheduleForm from '@/components/PMScheduleForm'

export default async function NewPMPage({
  searchParams,
}: { searchParams: Promise<{ assetId?: string }> }) {
  const user = await getCurrentUser()
  if (!user || !(await hasScopeActionFlag(user, 'canManagePM')) || !(await hasPermission(user, 'pm:create'))) redirect('/preventive-maintenance')

  const { assetId } = await searchParams
  const scopeIds = user ? await getWriteScopeIds(user) : null
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
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' }, ...(assetFilter ?? {}) },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      where:   scopeIds ? { id: { in: scopeIds } } : {},
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where:   { isActive: true, ...(userFilter ?? {}) },
      select:  { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where:   { isActive: true, ...(scopeUserIds ? { members: { some: { userId: { in: scopeUserIds } } } } : {}) },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <Link href="/preventive-maintenance" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to PM schedules
        </Link>
      </div>
      <PageHeader title="New PM schedule" subtitle="Set up a recurring maintenance schedule for an asset or location." />
      <PMScheduleForm assets={assets} locations={locations} users={users} teams={teams} preselectedAssetId={assetId} />
    </div>
  )
}
