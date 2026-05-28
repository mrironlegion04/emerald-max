import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { name, parentId } = await req.json()
    if (!name?.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    if (parentId === id) {
      return Response.json({ error: 'Cannot set parent to itself' }, { status: 400 })
    }

    const category = await prisma.assetCategory.update({
      where: { id },
      data: { name: name.trim(), parentId: parentId || null },
      include: { _count: { select: { children: true, assets: true } } },
    })

    return Response.json(category)
  } catch (error) {
    console.error('Error updating asset category:', error)
    return Response.json({ error: 'Failed to update asset category' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const assetCount = await prisma.asset.count({ where: { isDeleted: false, categoryId: id } })
    if (assetCount > 0) {
      return Response.json(
        { error: `Cannot delete — ${assetCount} asset(s) are using this category.` },
        { status: 409 }
      )
    }

    const childCount = await prisma.assetCategory.count({ where: { parentId: id } })
    if (childCount > 0) {
      return Response.json(
        { error: `Cannot delete — this category has ${childCount} sub-category(ies). Delete them first.` },
        { status: 409 }
      )
    }

    await prisma.assetCategory.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    console.error('Error deleting asset category:', error)
    return Response.json({ error: 'Failed to delete asset category' }, { status: 500 })
  }
}
