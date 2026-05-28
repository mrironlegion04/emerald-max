import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { buildLocationPath, refreshLocationPaths } from '@/lib/location-path'
import { z } from 'zod'

const updateSchema = z.object({
  name:     z.string().min(1, 'Name is required').optional(),
  address:  z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    if (data.parentId === id) {
      return NextResponse.json({ error: 'Cannot set parent to itself' }, { status: 400 })
    }

    // Get current record to compute new path and track changes
    const current = await prisma.location.findUnique({
      where: { id },
      select: { name: true, parentId: true, address: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const newName     = data.name     ?? current.name
    const newParentId = data.parentId !== undefined ? (data.parentId ?? null) : current.parentId
    const path = await buildLocationPath(newParentId, newName)

    const location = await prisma.location.update({
      where: { id },
      data: {
        name:     newName,
        address:  data.address !== undefined ? (data.address ?? null) : undefined,
        parentId: newParentId,
        path,
      },
      include: { _count: { select: { assets: true, children: true } } },
    })

    // Refresh children paths if parent or name changed
    const parentChanged = newParentId !== current.parentId
    const nameChanged   = newName !== current.name
    if (parentChanged || nameChanged) {
      await refreshLocationPaths(id)
    }

    const changes: Record<string, { before: any; after: any }> = {}
    for (const key of Object.keys(data)) {
      const beforeVal = current[key as keyof typeof current]
      const afterVal = location[key as keyof typeof location]
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes[key] = { before: beforeVal, after: afterVal }
      }
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        action: 'UPDATE',
        entity: 'Location',
        entityId: location.id,
        entityName: location.name,
        changes,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })
    }

    return NextResponse.json(location)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const current = await prisma.location.findUnique({ where: { id }, select: { name: true } })
    if (!current) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const assetCount = await prisma.asset.count({ where: { isDeleted: false, locationId: id } })
    if (assetCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${assetCount} asset(s) are using this location.` },
        { status: 409 }
      )
    }

    const childCount = await prisma.location.count({ where: { parentId: id } })
    if (childCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this location has ${childCount} sub-location(s). Delete them first.` },
        { status: 409 }
      )
    }

    await prisma.location.delete({ where: { id } })

    await writeAudit({
      action: 'DELETE',
      entity: 'Location',
      entityId: id,
      entityName: current.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
  }
}
