import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meterId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { meterId } = await params
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    const meter = await prisma.meter.findFirst({
      where: { id: meterId, deletedAt: null },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
      },
    })
    if (!meter) return NextResponse.json({ error: 'Meter not found' }, { status: 404 })

    const where: any = { meterId }
    if (fromDate) where.readingDate = { ...(where.readingDate || {}), gte: new Date(fromDate) }
    if (toDate) where.readingDate = { ...(where.readingDate || {}), lte: new Date(toDate) }

    const [readings, totalCount] = await Promise.all([
      prisma.meterReading.findMany({
        where,
        orderBy: { readingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          value: true,
          readingDate: true,
          notes: true,
          source: true,
          status: true,
          createdAt: true,
          recordedBy: true,
        },
      }),
      prisma.meterReading.count({ where }),
    ])

    return NextResponse.json({
      meter,
      readings,
      totalCount,
      page,
      limit,
      hasMore: page * limit < totalCount,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch readings' }, { status: 500 })
  }
}
