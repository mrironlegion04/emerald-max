import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  try {
    const categories = await prisma.assetCategory.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { children: true, assets: true } },
      },
    })
    return Response.json(categories)
  } catch (error) {
    console.error('Error fetching asset categories:', error)
    return Response.json({ error: 'Failed to fetch asset categories' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name, parentId } = await req.json()
    if (!name?.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const category = await prisma.assetCategory.create({
      data: { name: name.trim(), parentId: parentId || null },
      include: { _count: { select: { children: true, assets: true } } },
    })

    return Response.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating asset category:', error)
    return Response.json({ error: 'Failed to create asset category' }, { status: 500 })
  }
}
