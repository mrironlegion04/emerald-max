import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import LocationSwitcher from './LocationSwitcher'

export default async function ServerLocationSwitcher() {
  const user = await getCurrentUser()
  if (!user) return null

  const assignments = await prisma.userLocation.findMany({
    where: { userId: user.userId },
    select: {
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (assignments.length < 2) return null

  return (
    <Suspense fallback={null}>
      <LocationSwitcher plants={assignments.map(a => a.location)} />
    </Suspense>
  )
}
