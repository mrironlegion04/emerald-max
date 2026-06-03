import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import PMScheduleForm from '@/components/PMScheduleForm'

export default async function NewPMPage({
  searchParams,
}: { searchParams: Promise<{ assetId?: string }> }) {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/preventive-maintenance')

  const { assetId } = await searchParams

  const [assets, locations, procedures] = await Promise.all([
    prisma.asset.findMany({
      where:   { isDeleted: false, status: { not: 'DECOMMISSIONED' } },
      select:  { id: true, name: true, assetCode: true, imageUrl: true, parentId: true, locationId: true, categoryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select:  { id: true, name: true, address: true, path: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.procedure.findMany({
      select:  { id: true, name: true, description: true, steps: { select: { id: true } }, locations: { select: { id: true } }, categories: { select: { id: true } }, assets: { select: { id: true } } },
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
      <PMScheduleForm assets={assets} locations={locations} procedures={procedures} preselectedAssetId={assetId} />
    </div>
  )
}
