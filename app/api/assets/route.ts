import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { checkCircularReference } from '@/lib/asset-hierarchy'
import { z } from 'zod'

const assetSchema = z.object({
  name:         z.string().min(1, 'Name is required'),
  assetCode:    z.string().transform(val => val.trim() === '' ? null : val).nullable().optional(),
  description:  z.string().nullable().optional(),
  status:       z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DECOMMISSIONED']).default('ACTIVE'),
  serialNumber: z.string().nullable().optional(),
  model:        z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseCost: z.number().nullable().optional(),
  categoryId:   z.string().nullable().optional(),
  locationId:   z.string().nullable().optional(),
  meterUnit:    z.string().nullable().optional(),
  parentId:     z.string().nullable().optional(),
  assetTypeId:  z.string().nullable().optional(),
  criticality:  z.string().nullable().optional(),
  ownerId:      z.string().nullable().optional(),
  primaryTeamId: z.string().nullable().optional(),
  customFields: z.any().nullable().optional(), // JSON field
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const showDeleted = searchParams.get('showDeleted') === 'true'

    const assets = await prisma.asset.findMany({
      where: showDeleted ? undefined : { isDeleted: false },
      include: {
        category: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(assets)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const data = assetSchema.parse(body)

    // Check unique asset code if provided
    if (data.assetCode) {
      const existing = await prisma.asset.findUnique({
        where: { assetCode: data.assetCode },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'Asset code already exists' },
          { status: 409 }
        )
      }
    }

    const assetCode = data.assetCode ?? null

    // Validate parentId if provided
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

      // Will check for circular references after creating the asset ID
      // For now, just ensure the parent exists
    }

    const asset = await prisma.asset.create({
      data: {
        name:         data.name,
        assetCode:    assetCode!,
        description:  data.description  ?? null,
        status:       data.status,
        serialNumber: data.serialNumber ?? null,
        model:        data.model        ?? null,
        manufacturer: data.manufacturer ?? null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost ?? null,
        categoryId:   data.categoryId   ?? null,
        locationId:   data.locationId   ?? null,
        meterUnit:    data.meterUnit    ?? null,
        parentId:     data.parentId     ?? null,
        assetTypeId:  data.assetTypeId  ?? null,
        criticality:  data.criticality  ?? null,
        ownerId:      data.ownerId      ?? null,
        primaryTeamId: data.primaryTeamId ?? null,
        customFields: data.customFields ?? null,
        createdById:  user.userId,
      },
    })

    await writeAudit({
      action: 'CREATE', entity: 'Asset',
      entityId: asset.id, entityName: asset.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    // Check if category has any associated PMTemplates and automatically generate maintenance schedules
    if (asset.categoryId) {
      try {
        const templates = await prisma.pMTemplate.findMany({
          where: { categoryId: asset.categoryId },
          include: { procedures: true }
        })

        for (const template of templates) {
          // Calculate standard next due date based on frequency
          let nextDueDate = new Date()
          if (template.frequency === 'DAILY') {
            nextDueDate.setDate(nextDueDate.getDate() + template.interval)
          } else if (template.frequency === 'WEEKLY') {
            nextDueDate.setDate(nextDueDate.getDate() + (template.interval * 7))
          } else if (template.frequency === 'MONTHLY') {
            nextDueDate.setMonth(nextDueDate.getMonth() + template.interval)
          } else if (template.frequency === 'QUARTERLY') {
            nextDueDate.setMonth(nextDueDate.getMonth() + (template.interval * 3))
          } else if (template.frequency === 'YEARLY') {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + template.interval)
          }

          // Create maintenance schedule for the asset using the category template definition
          await prisma.maintenanceSchedule.create({
            data: {
              title:              template.title,
              description:        template.description,
              triggerType:        template.triggerType,
              frequency:          template.frequency,
              interval:           template.interval,
              nextDueDate,
              assetId:            asset.id,
              createdById:        user.userId,
              isActive:           true,
              procedures: {
                create: template.procedures.map(p => ({
                  procedureId: p.procedureId,
                  sortOrder: p.sortOrder
                }))
              },
            }
          })
        }
      } catch (err) {
        console.error('Failed to trigger category auto PM template setup:', err)
      }
    }

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}
