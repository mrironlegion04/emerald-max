import { prisma } from '@/lib/db'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import WorkOrderForm from '@/components/WorkOrderForm'

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>
}) {
  const { assetId } = await searchParams

  const [assets, locations, users, teams, templates] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select: { id: true, name: true, assetCode: true, imageUrl: true, categoryId: true, parentId: true, locationId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, trade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.checklistTemplate.findMany({
      select: { id: true, name: true, description: true, items: { select: { id: true } }, locations: { select: { id: true } }, categories: { select: { id: true } }, assets: { select: { id: true } } },
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
      <PageHeader title="New work order" subtitle="Fill in the details to create a new work order." />
      <WorkOrderForm assets={assets} locations={locations} users={users} teams={teams} templates={templates} preselectedAssetId={assetId} />
    </div>
  )
}
