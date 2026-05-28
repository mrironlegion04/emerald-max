import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { checkCircularReference } from '@/lib/asset-hierarchy'
import { z } from 'zod'

const updateSchema = z.object({
  name:         z.string().min(1).optional(),
  assetCode:    z.string().transform(val => val.trim() === '' ? null : val).nullable().optional(),
  description:  z.string().nullable().optional(),
  status:       z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DECOMMISSIONED']).optional(),
  serialNumber: z.string().nullable().optional(),
  model:        z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseCost: z.number().nullable().optional(),
  categoryId:   z.string().nullable().optional(),
  locationId:   z.string().nullable().optional(),
  meterUnit:    z.string().nullable().optional(),
  parentId:     z.string().nullable().optional(),
  assetType:    z.string().nullable().optional(),
  assetTypeId:  z.string().nullable().optional(),
  criticality:  z.string().nullable().optional(),
  ownerId:      z.string().nullable().optional(),
  customFields: z.any().nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        owner: { select: { id: true, name: true } },
        workOrders: {
          include: { assignedTo: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        maintenanceSchedules: true,
      },
    })
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
}

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

    const existingAsset = await prisma.asset.findUnique({ where: { id } })
    if (!existingAsset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (existingAsset.isDeleted) {
      return NextResponse.json({ error: 'Cannot edit a deleted asset. Restore it first.' }, { status: 400 })
    }

    // Check asset code uniqueness if changed
    if (data.assetCode) {
      const existing = await prisma.asset.findFirst({
        where: { assetCode: data.assetCode, NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Asset code already in use' }, { status: 409 })
      }
    }

    // Validate parentId if provided
    if (data.parentId !== undefined) {
      if (data.parentId) {
        // Check if parent exists
        const parentAsset = await prisma.asset.findUnique({
          where: { id: data.parentId },
        })
        if (!parentAsset) {
          return NextResponse.json(
            { error: 'Parent asset not found' },
            { status: 404 }
          )
        }

        // Check for circular reference
        const isCircular = await checkCircularReference(id, data.parentId)
        if (isCircular) {
          return NextResponse.json(
            { error: 'Cannot set parent: would create circular reference' },
            { status: 400 }
          )
        }
      }
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      } as any,
    })

    const changes: Record<string, { before: any; after: any }> = {}
    for (const key of Object.keys(data)) {
      const beforeVal = existingAsset[key as keyof typeof existingAsset]
      const afterVal = asset[key as keyof typeof asset]
      const beforeStr = beforeVal instanceof Date ? beforeVal.toISOString() : JSON.stringify(beforeVal)
      const afterStr = afterVal instanceof Date ? afterVal.toISOString() : JSON.stringify(afterVal)
      if (beforeStr !== afterStr) {
        changes[key] = {
          before: beforeVal instanceof Date ? beforeVal.toISOString() : beforeVal,
          after: afterVal instanceof Date ? afterVal.toISOString() : afterVal
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        action: 'UPDATE', entity: 'Asset',
        entityId: asset.id, entityName: asset.name,
        changes,
        userId: user.userId, userName: user.name, userEmail: user.email,
      })
    }

    return NextResponse.json(asset)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can archive assets' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Fetch asset for audit
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    if (asset.isDeleted) {
      return NextResponse.json({ error: 'Asset is already archived' }, { status: 400 })
    }

    if (!force) {
      const activeWOs = await prisma.workOrder.count({
        where: {
          assetId: id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })
      if (activeWOs > 0) {
        return NextResponse.json({
          error: `Asset has ${activeWOs} active work order${activeWOs !== 1 ? 's' : ''}. Complete or reassign them first.`,
          requiresForce: true,
          activeWorkOrders: activeWOs,
        }, { status: 409 })
      }
    }

    // Soft-delete: preserve all historical data, just mark as deleted
    await prisma.asset.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    await writeAudit({
      action: 'DELETE', entity: 'Asset',
      entityId: id, entityName: asset.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive asset' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can restore assets' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (!asset.isDeleted) {
      return NextResponse.json({ error: 'Asset is not deleted' }, { status: 400 })
    }

    const restored = await prisma.asset.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
    })

    await writeAudit({
      action: 'UPDATE', entity: 'Asset',
      entityId: id, entityName: asset.name,
      changes: {
        isDeleted: { before: true, after: false },
      },
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(restored)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to restore asset' }, { status: 500 })
  }
}
