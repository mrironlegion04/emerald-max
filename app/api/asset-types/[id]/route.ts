import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { name } = await req.json()
    if (!name?.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = await prisma.assetType.update({
      where: { id },
      data: { name: name.trim() },
      include: { _count: { select: { assets: true } } },
    })

    return Response.json(type)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return Response.json({ error: 'An asset type with this name already exists' }, { status: 409 })
    }
    console.error('Error updating asset type:', error)
    return Response.json({ error: 'Failed to update asset type' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (user?.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const assetCount = await prisma.asset.count({ where: { isDeleted: false, assetTypeId: id } })
    if (assetCount > 0) {
      return Response.json(
        { error: `Cannot delete — ${assetCount} asset(s) are using this type.` },
        { status: 409 }
      )
    }

    await prisma.assetType.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (error) {
    console.error('Error deleting asset type:', error)
    return Response.json({ error: 'Failed to delete asset type' }, { status: 500 })
  }
}
