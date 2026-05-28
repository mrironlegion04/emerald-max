import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const slaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable().optional(),
  assetCategoryId: z.string().nullable().optional(),
  responseTarget: z.number().min(1, 'Response target must be at least 1 minute'),
  resolutionTarget: z.number().min(1, 'Resolution target must be at least 1 minute'),
  isActive: z.boolean().default(true),
}).refine((data) => data.priority || data.assetCategoryId, {
  message: 'Select either Priority or Asset Category',
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10)))
    const skip = (page - 1) * limit

    const [policies, totalCount] = await Promise.all([
      prisma.sLAPolicy.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sLAPolicy.count(),
    ])

    return NextResponse.json({ policies, totalCount, page, limit })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch SLA policies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, priority, assetCategoryId, responseTarget, resolutionTarget, isActive } = slaSchema.parse(body)

    const policy = await prisma.sLAPolicy.create({
      data: {
        name,
        priority: priority || null,
        assetCategoryId: assetCategoryId || null,
        responseTarget,
        resolutionTarget,
        isActive,
      },
    })

    return NextResponse.json(policy, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create SLA policy' }, { status: 500 })
  }
}
