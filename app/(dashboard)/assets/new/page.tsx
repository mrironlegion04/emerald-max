export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
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

  const [categories, assetTypes, locations, assets, users] = await Promise.all([
    prisma.assetCategory.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
    prisma.assetType.findMany({ orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }], select: { id: true, name: true, parentId: true, path: true } }),
    prisma.asset.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, assetCode: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
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
        initialData={{ parentId: parentId || '' }}
      />
    </div>
  )
}
