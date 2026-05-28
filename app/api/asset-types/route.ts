import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  try {
    const types = await prisma.assetType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } } },
    })
    return Response.json(types)
  } catch (error) {
    console.error('Error fetching asset types:', error)
    return Response.json({ error: 'Failed to fetch asset types' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name } = await req.json()
    if (!name?.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = await prisma.assetType.create({
      data: { name: name.trim() },
      include: { _count: { select: { assets: true } } },
    })

    return Response.json(type, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return Response.json({ error: 'An asset type with this name already exists' }, { status: 409 })
    }
    console.error('Error creating asset type:', error)
    return Response.json({ error: 'Failed to create asset type' }, { status: 500 })
  }
}
