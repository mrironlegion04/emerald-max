import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive:    z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'domain:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const { name, description, isActive } = schema.parse(await request.json())
    const domain = await prisma.maintenanceDomain.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive    !== undefined && { isActive }),
      },
    })
    return NextResponse.json(domain)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'domain:delete'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const domain = await prisma.maintenanceDomain.findUnique({ where: { id } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    if (domain.isDeleted) return NextResponse.json({ error: 'Domain is already archived' }, { status: 400 })

    if (!force) {
      const [linkedAssets, linkedTeams] = await Promise.all([
        prisma.assetDomain.count({ where: { domainId: id } }),
        prisma.teamDomain.count({ where: { domainId: id } }),
      ])
      if (linkedAssets > 0 || linkedTeams > 0) {
        return NextResponse.json({
          error: `Domain is linked to ${linkedAssets} asset${linkedAssets !== 1 ? 's' : ''} and ${linkedTeams} team${linkedTeams !== 1 ? 's' : ''}.`,
          requiresForce: true,
          linkedAssets,
          linkedTeams,
        }, { status: 409 })
      }
    }

    await prisma.maintenanceDomain.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    await writeAudit({
      action: 'DELETE', entity: 'MaintenanceDomain',
      entityId: id, entityName: domain.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive domain' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'domain:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const domain = await prisma.maintenanceDomain.findUnique({ where: { id } })
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    if (!domain.isDeleted) {
      return NextResponse.json({ error: 'Domain is not archived' }, { status: 400 })
    }

    const restored = await prisma.maintenanceDomain.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
    })

    await writeAudit({
      action: 'UPDATE', entity: 'MaintenanceDomain',
      entityId: id, entityName: domain.name,
      changes: { isDeleted: { before: true, after: false } },
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json(restored)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to restore domain' }, { status: 500 })
  }
}
