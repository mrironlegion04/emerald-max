import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  categoryId: z.string().min(1),
  domainIds:  z.array(z.string()),
})

/**
 * POST /api/category-domains
 * Replace all domain links for a category in one shot.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { categoryId, domainIds } = schema.parse(await request.json())

    // Delete existing, then insert new ones atomically
    await prisma.$transaction([
      prisma.categoryDomain.deleteMany({ where: { categoryId } }),
      prisma.categoryDomain.createMany({
        data: domainIds.map(domainId => ({ categoryId, domainId })),
        skipDuplicates: true,
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update category domains' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
    }
    const links = await prisma.categoryDomain.findMany({
      where: { categoryId },
      include: { domain: true },
    })
    return NextResponse.json(links.map(l => l.domain))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
