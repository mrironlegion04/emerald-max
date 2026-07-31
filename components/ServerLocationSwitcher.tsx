import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getActiveLocationCookie } from '@/lib/access-control'
import LocationSwitcher from './LocationSwitcher'

export default async function ServerLocationSwitcher() {
  const user = await getCurrentUser()
  if (!user) return null

  let plants: { id: string; name: string }[]

  if (user.role === 'ADMIN') {
    plants = await prisma.location.findMany({
      where: { parentId: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  } else {
    const assignments = await prisma.userLocation.findMany({
      where: { userId: user.userId },
      select: { location: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    plants = assignments.map(a => a.location)
  }

  if (plants.length < 1) return null

  const activeLocationId = await getActiveLocationCookie()

  return (
    <Suspense fallback={null}>
      <LocationSwitcher plants={plants} activeLocationId={activeLocationId} />
    </Suspense>
  )
}
