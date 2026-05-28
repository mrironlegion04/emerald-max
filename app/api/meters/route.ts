import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const assetId = searchParams.get('assetId')
    const meterType = searchParams.get('meterType')
    const unit = searchParams.get('unit')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

    const where: any = {}
    if (!includeDeleted) where.deletedAt = null
    if (assetId) where.assetId = assetId
    if (meterType) where.meterType = meterType
    if (unit) where.unit = unit

    const [meters, totalCount] = await Promise.all([
      prisma.meter.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetCode: true } },
          _count: { select: { readings: true } },
        },
        orderBy: [{ assetId: 'asc' }, { isPrimary: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.meter.count({ where }),
    ])

    return NextResponse.json({
      meters,
      totalCount,
      page,
      limit,
      hasMore: page * limit < totalCount,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meters' }, { status: 500 })
  }
}
