import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getUserLocationIds } from '@/lib/access-control'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 1) {
      return NextResponse.json([])
    }

    // Plant-scoped users only get mention suggestions from their plants (plus platform admins)
    const allowedIds = await getUserLocationIds(user.userId)

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        name: { contains: q, mode: 'insensitive' },
        ...(allowedIds
          ? { OR: [{ userLocations: { some: { locationId: { in: allowedIds } } } }, { role: 'ADMIN' }] }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
      take: 10,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 })
  }
}
