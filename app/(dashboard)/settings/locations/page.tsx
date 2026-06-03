export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import LocationsManager from '@/components/LocationsManager'

export default async function LocationsPage() {
  const user = await getCurrentUser()
  if (user?.role === 'TECHNICIAN') redirect('/dashboard')

  const locations = await prisma.location.findMany({
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { assets: true, children: true } } },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Locations"
        subtitle="Manage your location hierarchy (e.g. Plant → Building → Area → Line)"
      />
      <LocationsManager initialLocations={locations} />
    </div>
  )
}
